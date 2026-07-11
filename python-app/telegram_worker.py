import asyncio
from datetime import datetime, timedelta, timezone

from telethon import TelegramClient, events
from telethon.errors.rpcerrorlist import ApiIdInvalidError

import config
import media_store
import message_store
import state
from geocode import extract_locations
from translator import translate_text

_emit_callback = None  # wired up by app.py to push events to connected browsers


def set_emit_callback(callback):
    global _emit_callback
    _emit_callback = callback


async def resolve_monitored_entities(client):
    """Only channels/groups the account is already a member of - no
    auto-joining anything."""
    monitored = {}

    async for dialog in client.iter_dialogs():
        if dialog.is_channel or dialog.is_group:
            monitored[dialog.id] = {
                'entity': dialog.entity,
                'username': getattr(dialog.entity, 'username', None),
                'title': dialog.title,
            }

    return monitored


async def process_message(client, message, is_edit, known_source=None, notify=True):
    try:
        if known_source is not None:
            username, title = known_source
        else:
            chat = await message.get_chat()
            username = getattr(chat, 'username', None)
            title = getattr(chat, 'title', None) or username or 'Unknown'
        chat_id = str(message.chat_id)

        text = message.message or ''
        translated_text, detected_lang = ('', None)
        if text.strip():
            translated_text, detected_lang = translate_text(text)
        translated_text = translated_text or text

        media = None
        if message.media:
            try:
                media = await media_store.save_media(client, message)
            except Exception as err:
                print(f'Media download failed: {err}')

        locations = extract_locations(f'{translated_text}\n{text}')

        date = message.date.replace(tzinfo=timezone.utc).isoformat() if message.date else None

        payload = {
            'id': f'{chat_id}_{message.id}',
            'chatId': chat_id,
            'messageId': message.id,
            'source': {'username': username, 'title': title},
            'date': date,
            'originalText': text,
            'translatedText': translated_text,
            'detectedLang': detected_lang,
            'media': media,
            'locations': locations,
            'link': f'https://t.me/{username}/{message.id}' if username else None,
            'edited': bool(is_edit),
        }

        if is_edit:
            message_store.update(payload)
        else:
            message_store.add(payload)

        if notify and _emit_callback:
            _emit_callback(payload, is_edit)
    except Exception as err:
        print(f'Failed to process message: {err}')


async def _backfill_one_channel(client, entry, cutoff):
    label = entry['username'] or entry['title']
    count = 0
    try:
        async for message in client.iter_messages(entry['entity'], limit=config.BACKFILL_LIMIT):
            if message.date and message.date < cutoff:
                break  # newest-first order, so everything after this is even older
            if not message.message and not message.media:
                continue
            await process_message(
                client, message, False,
                known_source=(entry['username'], entry['title']),
                notify=False,
            )
            count += 1
    except Exception as err:
        print(f'  @{label}: stopped early after {count} - {err}')
    else:
        print(f'  @{label}: {count} message(s)')
    return count


async def backfill_history(client, monitored):
    """On startup, load each monitored channel's recent history so the
    timeline isn't empty until new messages happen to arrive - without this,
    the app would only ever show messages sent after it started. Channels
    are backfilled several at a time so a large account (dozens of channels)
    fills in within a reasonable time instead of one channel at a time."""
    if config.BACKFILL_LIMIT <= 0:
        return

    cutoff = datetime.now(timezone.utc) - timedelta(hours=config.BACKFILL_HOURS)
    print(
        f'Backfilling up to {config.BACKFILL_LIMIT} recent message(s) per channel '
        f'(last {config.BACKFILL_HOURS}h) across {len(monitored)} channel(s), '
        f'{config.BACKFILL_CONCURRENCY} at a time...'
    )

    semaphore = asyncio.Semaphore(config.BACKFILL_CONCURRENCY)

    async def bounded(entry):
        async with semaphore:
            return await _backfill_one_channel(client, entry, cutoff)

    counts = await asyncio.gather(*(bounded(entry) for entry in monitored.values()))
    print(f'Backfill complete: {sum(counts)} message(s) loaded across {len(monitored)} channel(s).')


async def _connect():
    """Create and start a client, looping back to re-prompt for credentials
    if Telegram rejects the api_id/api_hash pair instead of crashing."""
    while True:
        client = TelegramClient(str(config.SESSION_FILE), config.API_ID, config.API_HASH)
        try:
            await client.start()
            return client
        except ApiIdInvalidError:
            try:
                await client.disconnect()
            except Exception:
                pass
            print()
            print("Telegram rejected that api_id/api_hash - they don't match a real app.")
            print('Double check both values from https://my.telegram.org (API development tools) and try again.')
            config.reset_credentials()
            config.ensure_credentials()


async def _main_async():
    client = await _connect()
    print('Connected to Telegram.')

    monitored = await resolve_monitored_entities(client)
    print(f'Monitoring {len(monitored)} channel(s)/group(s):')
    for entry in monitored.values():
        handle = f" (@{entry['username']})" if entry['username'] else ''
        print(f"  - {entry['title']}{handle}")

    state.set_monitored_sources([
        {'username': entry['username'], 'title': entry['title']}
        for entry in monitored.values()
        if entry['username']
    ])

    chat_entities = [entry['entity'] for entry in monitored.values()] or None

    @client.on(events.NewMessage(chats=chat_entities))
    async def _on_new(event):
        await process_message(client, event.message, False)

    @client.on(events.MessageEdited(chats=chat_entities))
    async def _on_edit(event):
        await process_message(client, event.message, True)

    # Register live handlers first so nothing is missed while backfill runs.
    asyncio.create_task(backfill_history(client, monitored))

    await client.run_until_disconnected()


def run():
    """Blocking call - runs Telethon's asyncio loop and never returns while
    connected. Intended to be called from a background thread."""
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not config.API_ID or not config.API_HASH:
        print(
            'TELEGRAM_API_ID / TELEGRAM_API_HASH are not set. '
            'Copy .env.example to .env and fill them in (get them from https://my.telegram.org).'
        )
        return

    asyncio.run(_main_async())
