import asyncio
import json
from datetime import timezone

from telethon import TelegramClient, events
from telethon.errors.rpcerrorlist import ApiIdInvalidError
from telethon.tl.functions.channels import JoinChannelRequest

import config
import media_store
import message_store
from geocode import extract_locations
from translator import translate_text

with open(config.SOURCES_FILE, 'r', encoding='utf-8') as f:
    SOURCES = json.load(f)

_emit_callback = None  # wired up by app.py to push events to connected browsers


def set_emit_callback(callback):
    global _emit_callback
    _emit_callback = callback


async def resolve_monitored_entities(client):
    """Everything already joined on the account (if enabled) plus the
    explicit sources list, joining any public channel from that list that
    isn't already joined."""
    monitored = {}

    if config.INCLUDE_ALL_DIALOGS:
        async for dialog in client.iter_dialogs():
            if dialog.is_channel or dialog.is_group:
                monitored[dialog.id] = {
                    'entity': dialog.entity,
                    'username': getattr(dialog.entity, 'username', None),
                    'title': dialog.title,
                }

    for source in SOURCES:
        username = source['username']
        try:
            entity = await client.get_entity(username)
        except Exception as err:
            print(f'Could not resolve @{username}: {err}')
            continue

        if entity.id not in monitored:
            try:
                await client(JoinChannelRequest(entity))
                print(f'Joined @{username}')
            except Exception as err:
                print(f'Could not join @{username} (may already be joined or private): {err}')
            monitored[entity.id] = {
                'entity': entity,
                'username': username,
                'title': getattr(entity, 'title', username) or username,
            }

    return monitored


async def process_message(client, message, is_edit):
    try:
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

        if _emit_callback:
            _emit_callback(payload, is_edit)
    except Exception as err:
        print(f'Failed to process message: {err}')


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

    chat_entities = [entry['entity'] for entry in monitored.values()] or None

    @client.on(events.NewMessage(chats=chat_entities))
    async def _on_new(event):
        await process_message(client, event.message, False)

    @client.on(events.MessageEdited(chats=chat_entities))
    async def _on_edit(event):
        await process_message(client, event.message, True)

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
