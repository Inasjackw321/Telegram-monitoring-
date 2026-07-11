import uuid

import config

config.MEDIA_DIR.mkdir(parents=True, exist_ok=True)


def _type_for(message):
    if message.photo:
        return 'photo'
    if message.video:
        return 'video'
    doc = message.document
    if doc and doc.mime_type:
        if doc.mime_type.startswith('video/'):
            return 'video'
        if doc.mime_type.startswith('image/'):
            return 'photo'
    return None  # skip generic documents/audio - keep map/feed focused on visual media


def _ext_for(message, media_type):
    doc = message.document
    if doc:
        for attr in doc.attributes:
            file_name = getattr(attr, 'file_name', None)
            if file_name and '.' in file_name:
                return file_name.rsplit('.', 1)[-1].lower()
    return 'mp4' if media_type == 'video' else 'jpg'


async def save_media(client, message):
    media_type = _type_for(message)
    if not media_type:
        return None

    ext = _ext_for(message, media_type)
    filename = f'{uuid.uuid4()}.{ext}'
    path = config.MEDIA_DIR / filename

    await client.download_media(message, file=str(path))

    return {'type': media_type, 'url': f'/media/{filename}'}
