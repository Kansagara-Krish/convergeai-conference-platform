# ============================================
# User Routes
# ============================================

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import and_, or_
from datetime import datetime
import base64
import json
import os
from pathlib import Path
import re
import requests
import uuid
from werkzeug.utils import secure_filename

try:
    from models import db, Chatbot, Message, ChatbotParticipant, User, Conversation, Guest
    from routes.auth import token_required
except ImportError:
    from backend.models import db, Chatbot, Message, ChatbotParticipant, User, Conversation, Guest
    from backend.routes.auth import token_required

user_bp = Blueprint('user', __name__)

# default to a free flash model
GEMINI_MODEL = 'gemini-flash-latest'
GEMINI_IMAGE_MODEL = os.environ.get('GEMINI_IMAGE_MODEL', 'gemini-2.0-flash-exp')
ALLOWED_IMAGE_MIME_TYPES = {
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif'
}
MAX_CHAT_IMAGE_SIZE_BYTES = 8 * 1024 * 1024
MAX_GENERATED_IMAGE_SIZE_BYTES = 20 * 1024 * 1024
USER_IMAGE_GENERATION_LIMIT = 3

IMAGE_EXTENSION_TO_MIME = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
}

MIME_TO_EXTENSION = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
}


def _is_limited_image_generation_user(user):
    return str(getattr(user, 'role', '') or '').strip().lower() == 'user'


def _count_generated_images_for_user(user_id):
    return Message.query.filter_by(
        user_id=user_id,
        is_user_message=False,
        message_type='image'
    ).count()


def _build_generation_usage(user):
    used = _count_generated_images_for_user(user.id)
    limited = _is_limited_image_generation_user(user)
    limit = USER_IMAGE_GENERATION_LIMIT if limited else None
    remaining = max(limit - used, 0) if limited else None

    return {
        'role': str(getattr(user, 'role', '') or '').strip().lower() or 'user',
        'limited': limited,
        'limit': limit,
        'used': used,
        'remaining': remaining,
        'unlimited': not limited,
    }


def _parse_guest_ids(raw_guest_ids):
    if raw_guest_ids is None:
        return []

    parsed = raw_guest_ids
    if isinstance(raw_guest_ids, str):
        raw = raw_guest_ids.strip()
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError):
            if ',' in raw:
                parsed = [chunk.strip() for chunk in raw.split(',') if chunk.strip()]
            else:
                parsed = [raw]

    if not isinstance(parsed, list):
        parsed = [parsed]

    normalized = []
    for item in parsed:
        try:
            guest_id = int(item)
        except (TypeError, ValueError):
            continue
        if guest_id not in normalized:
            normalized.append(guest_id)

    return normalized


def _resolve_guest_photo_path(photo_value):
    raw_photo = str(photo_value or '').strip().replace('\\', '/')
    if not raw_photo:
        return None

    lowered = raw_photo.lower()
    uploads_marker = '/uploads/'
    if uploads_marker in lowered:
        marker_index = lowered.index(uploads_marker)
        raw_photo = raw_photo[marker_index + len(uploads_marker):]

    if raw_photo.startswith('/'):
        raw_photo = raw_photo.lstrip('/')

    if raw_photo.startswith('uploads/'):
        raw_photo = raw_photo[len('uploads/'):]

    upload_root = Path(current_app.root_path) / 'uploads'
    absolute_path = upload_root / raw_photo
    return absolute_path if absolute_path.exists() and absolute_path.is_file() else None


def _build_guest_image_payloads(chatbot_id, guest_ids):
    if not guest_ids:
        return []

    guests = Guest.query.filter(
        Guest.chatbot_id == chatbot_id,
        Guest.id.in_(guest_ids)
    ).all()
    guests_by_id = {guest.id: guest for guest in guests}

    payloads = []
    seen_paths = set()

    for guest_id in guest_ids:
        guest = guests_by_id.get(guest_id)
        if not guest or not guest.photo:
            continue

        photo_path = _resolve_guest_photo_path(guest.photo)
        if not photo_path:
            continue

        path_key = str(photo_path)
        if path_key in seen_paths:
            continue

        extension = photo_path.suffix.lower()
        mime_type = IMAGE_EXTENSION_TO_MIME.get(extension)
        if mime_type not in ALLOWED_IMAGE_MIME_TYPES:
            continue

        image_bytes = photo_path.read_bytes()
        if not image_bytes or len(image_bytes) > MAX_CHAT_IMAGE_SIZE_BYTES:
            continue

        payloads.append({
            'mime_type': mime_type,
            'data_b64': base64.b64encode(image_bytes).decode('utf-8')
        })
        seen_paths.add(path_key)

    return payloads


def _normalize_media_url_for_message(path_value):
    raw_value = str(path_value or '').strip().replace('\\', '/')
    if not raw_value:
        return None

    if raw_value.startswith('http://') or raw_value.startswith('https://'):
        return raw_value

    lowered = raw_value.lower()
    uploads_marker = '/uploads/'
    if uploads_marker in lowered:
        marker_index = lowered.index(uploads_marker)
        raw_value = raw_value[marker_index + 1:]
    else:
        raw_value = raw_value.lstrip('/')
        if raw_value.startswith('guests/') or raw_value.startswith('backgrounds/'):
            raw_value = f'uploads/{raw_value}'

    normalized = raw_value.lstrip('/')
    return f'/{normalized}' if normalized else None


def _build_guest_image_urls(chatbot_id, guest_ids):
    if not guest_ids:
        return []

    guests = Guest.query.filter(
        Guest.chatbot_id == chatbot_id,
        Guest.id.in_(guest_ids)
    ).all()
    guests_by_id = {guest.id: guest for guest in guests}

    urls = []
    seen = set()
    for guest_id in guest_ids:
        guest = guests_by_id.get(guest_id)
        normalized = _normalize_media_url_for_message(guest.photo if guest else '')
        if not normalized:
            continue

        if not normalized or normalized in seen:
            continue

        seen.add(normalized)
        urls.append(normalized)

    return urls


def _save_message_image(image_bytes, original_filename):
    safe_name = secure_filename(str(original_filename or '').strip())
    extension = Path(safe_name).suffix.lower() if safe_name else ''
    if extension not in IMAGE_EXTENSION_TO_MIME:
        extension = '.jpg'

    upload_root = Path(current_app.root_path) / 'uploads' / 'messages'
    upload_root.mkdir(parents=True, exist_ok=True)

    file_name = f"{uuid.uuid4().hex}{extension}"
    absolute_path = upload_root / file_name
    absolute_path.write_bytes(image_bytes)

    return f"uploads/messages/{file_name}"


def _save_generated_image_to_static(image_bytes, mime_type='image/png'):
    extension = MIME_TO_EXTENSION.get(str(mime_type or '').lower(), '.png')
    static_root = Path(current_app.static_folder or (Path(current_app.root_path) / 'static'))
    generated_root = static_root / 'generated'
    generated_root.mkdir(parents=True, exist_ok=True)

    file_name = f"{uuid.uuid4().hex}{extension}"
    file_path = generated_root / file_name
    file_path.write_bytes(image_bytes)
    return f"/static/generated/{file_name}"


def _is_path_within_root(candidate_path, root_path):
    try:
        candidate_path.resolve().relative_to(root_path.resolve())
        return True
    except Exception:
        return False


def _resolve_deletable_message_image_path(image_url):
    raw_value = str(image_url or '').strip().replace('\\', '/')
    if not raw_value:
        return None

    if raw_value.startswith('http://') or raw_value.startswith('https://'):
        return None

    normalized = raw_value.split('?', 1)[0].split('#', 1)[0].lstrip('/')
    if not normalized:
        return None

    uploads_root = Path(current_app.root_path) / 'uploads' / 'messages'
    static_generated_root = Path(current_app.static_folder or (Path(current_app.root_path) / 'static')) / 'generated'

    if normalized.startswith('uploads/messages/'):
        candidate_path = Path(current_app.root_path) / normalized
        if _is_path_within_root(candidate_path, uploads_root):
            return candidate_path

    if normalized.startswith('static/generated/'):
        candidate_path = Path(current_app.root_path) / normalized
        if _is_path_within_root(candidate_path, static_generated_root):
            return candidate_path

    return None


def _delete_message_image_assets(messages):
    seen_paths = set()

    for message in messages:
        image_path = _resolve_deletable_message_image_path(getattr(message, 'image_url', None))
        if not image_path:
            continue

        path_key = str(image_path)
        if path_key in seen_paths:
            continue

        seen_paths.add(path_key)

        try:
            if image_path.exists() and image_path.is_file():
                image_path.unlink()
        except Exception as error:
            current_app.logger.warning('Failed to delete message image asset %s: %s', image_path, error)


def _extract_first_http_image_url(text):
    lines = _extract_markdown_image_lines(text)
    for line in lines:
        match = re.search(r'!\[[^\]]*\]\(([^)]+)\)', line)
        if not match:
            continue
        url = str(match.group(1) or '').strip()
        if url.startswith('http://') or url.startswith('https://'):
            return url

    direct_match = re.search(r'(https?://\S+)', str(text or ''))
    if direct_match:
        candidate = str(direct_match.group(1) or '').strip().rstrip(').,')
        if candidate.startswith('http://') or candidate.startswith('https://'):
            return candidate

    return None


def _download_image_from_url(url):
    try:
        response = requests.get(url, timeout=30)
    except Exception:
        return None, None

    if response.status_code >= 400:
        return None, None

    image_bytes = response.content or b''
    if not image_bytes or len(image_bytes) > MAX_GENERATED_IMAGE_SIZE_BYTES:
        return None, None

    mime_type = str(response.headers.get('Content-Type', '')).split(';')[0].strip().lower()
    if mime_type not in ALLOWED_IMAGE_MIME_TYPES:
        mime_type = 'image/png'

    return image_bytes, mime_type


def _extract_generated_image_parts(parts):
    for part in parts:
        inline_data = part.get('inline_data') or part.get('inlineData')
        if not inline_data:
            continue

        data_b64 = inline_data.get('data')
        mime_type = str(inline_data.get('mime_type') or inline_data.get('mimeType') or 'image/png').lower()
        if not data_b64:
            continue
        try:
            image_bytes = base64.b64decode(data_b64)
        except Exception:
            continue
        if not image_bytes or len(image_bytes) > MAX_GENERATED_IMAGE_SIZE_BYTES:
            continue
        if mime_type not in ALLOWED_IMAGE_MIME_TYPES:
            mime_type = 'image/png'
        return image_bytes, mime_type

    for part in parts:
        file_data = part.get('file_data') or part.get('fileData')
        if not file_data:
            continue
        uri = str(file_data.get('file_uri') or file_data.get('fileUri') or file_data.get('uri') or '').strip()
        if not uri or not (uri.startswith('http://') or uri.startswith('https://')):
            continue
        image_bytes, mime_type = _download_image_from_url(uri)
        if image_bytes:
            return image_bytes, mime_type

    return None, None


def _build_recent_context(chatbot_id, user_id, limit=8):
    recent_messages = (
        Message.query
        .filter_by(chatbot_id=chatbot_id, user_id=user_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )

    if not recent_messages:
        return ''

    ordered = list(reversed(recent_messages))
    lines = []
    for msg in ordered:
        role = 'User' if msg.is_user_message else 'Assistant'
        lines.append(f"{role}: {msg.content}")

    return '\n'.join(lines)


def _extract_markdown_image_lines(text):
    raw_text = str(text or '').strip()
    if not raw_text:
        return []

    explicit_lines = []
    for line in raw_text.splitlines():
        cleaned = line.strip()
        if re.search(r'!\[[^\]]*\]\(([^)]+)\)', cleaned):
            explicit_lines.append(cleaned)

    if explicit_lines:
        return explicit_lines

    matches = re.findall(r'!\[[^\]]*\]\(([^)]+)\)', raw_text)
    return [f'![]({url.strip()})' for url in matches if str(url).strip()]


def _clean_message_text_for_preview(text):
    raw_text = str(text or '').strip()
    if not raw_text:
        return ''

    without_images = re.sub(r'!\[[^\]]*\]\(([^)]+)\)', ' ', raw_text)
    normalized = re.sub(r'\s+', ' ', without_images).strip()
    return normalized


def _build_message_preview(message):
    if not message:
        return ''

    cleaned = _clean_message_text_for_preview(message.content)
    if cleaned:
        return cleaned[:120]

    message_type = str(getattr(message, 'message_type', '') or 'text').lower()
    if message_type == 'image' or getattr(message, 'image_url', None):
        return 'Image'

    return ''


def _call_gemini(chatbot, user, user_text, image_payloads=None, generation_mode='single', expect_image=False):
    api_key = (chatbot.gemini_api_key or '').strip()
    if not api_key:
        api_key = (
            str(current_app.config.get('GEMINI_API_KEY') or '').strip()
            or str(os.environ.get('GEMINI_API_KEY') or '').strip()
            or str(os.environ.get('GOOGLE_API_KEY') or '').strip()
        )

    if not api_key:
        raise ValueError('Gemini API key is not configured. Set chatbot key in admin or server GEMINI_API_KEY')

    prompt_chunks = [
        f"Event: {chatbot.event_name}",
        f"Chatbot Name: {chatbot.name}",
        'System Instructions:',
        (chatbot.system_prompt or '').strip() or 'You are a helpful conference assistant.',
    ]

    if expect_image:
        base_generation_prompt = (
            (chatbot.multiple_person_prompt or '').strip()
            if generation_mode == 'multiple'
            else (chatbot.single_person_prompt or '').strip()
        )
        if not base_generation_prompt:
            base_generation_prompt = (
                Chatbot.DEFAULT_MULTIPLE_PERSON_PROMPT
                if generation_mode == 'multiple'
                else Chatbot.DEFAULT_SINGLE_PERSON_PROMPT
            )

        prompt_chunks.extend([
            'Image Generation Prompt:',
            base_generation_prompt,
            'User Input:',
            str(user_text or '').strip() or 'Generate the image based on provided references.',
            'Output Rules:',
            '- Generate image output only.',
            '- Do not include analysis, plans, or extra text unless generation fails.',
        ])
    else:
        history = _build_recent_context(chatbot.id, user.id)
        if history:
            prompt_chunks.extend([
                'Recent Conversation Context:',
                history
            ])

        prompt_chunks.extend([
            'User Input:',
            str(user_text or '').strip() or 'Analyze the provided image and respond helpfully.',
            'Respond clearly and concisely.'
        ])

    parts = [{
        'text': '\n\n'.join(prompt_chunks)
    }]

    # Handle multiple images (user image, guest image, background image)
    if image_payloads:
        if not isinstance(image_payloads, list):
            image_payloads = [image_payloads]
        
        for image_payload in image_payloads:
            if image_payload:
                parts.append({
                    'inline_data': {
                        'mime_type': image_payload['mime_type'],
                        'data': image_payload['data_b64']
                    }
                })

    def _post_generate(model_name, include_response_modalities):
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        generation_config = {
            'temperature': 0.2 if expect_image else 0.6,
            'topP': 0.9,
            'maxOutputTokens': 1024
        }
        if include_response_modalities:
            generation_config['responseModalities'] = ['IMAGE', 'TEXT']

        return requests.post(
            endpoint,
            json={
                'contents': [{
                    'role': 'user',
                    'parts': parts
                }],
                'generationConfig': generation_config
            },
            timeout=45
        )

    payload = None
    model_name = GEMINI_MODEL
    errors = []

    if expect_image:
        requested_models = [
            GEMINI_IMAGE_MODEL,
            GEMINI_MODEL,
            'gemini-1.5-flash-latest',
        ]
        unique_models = []
        for candidate in requested_models:
            normalized = str(candidate or '').strip()
            if normalized and normalized not in unique_models:
                unique_models.append(normalized)

        for candidate_model in unique_models:
            for include_modalities in (True, False):
                response = _post_generate(candidate_model, include_modalities)
                if response.status_code < 400:
                    payload = response.json() or {}
                    model_name = candidate_model
                    break

                try:
                    details = response.json()
                except Exception:
                    details = response.text
                errors.append(
                    f"({response.status_code}) model={candidate_model}, responseModalities={include_modalities}: {details}"
                )
            if payload is not None:
                break

        if payload is None:
            raise RuntimeError(f"Gemini image generation failed across models: {' | '.join(errors)}")
    else:
        response = _post_generate(GEMINI_MODEL, include_response_modalities=False)
        if response.status_code >= 400:
            try:
                details = response.json()
            except Exception:
                details = response.text
            raise RuntimeError(f'Gemini API error ({response.status_code}) on model {GEMINI_MODEL}: {details}')
        payload = response.json() or {}

    candidates = payload.get('candidates') or []
    if not candidates:
        raise RuntimeError('No response candidate returned by Gemini')

    parts = ((candidates[0].get('content') or {}).get('parts') or [])
    combined = '\n'.join([part.get('text', '') for part in parts if part.get('text')]).strip()

    if expect_image:
        image_bytes, mime_type = _extract_generated_image_parts(parts)
        if image_bytes:
            return {
                'message_type': 'image',
                'image_bytes': image_bytes,
                'mime_type': mime_type,
                'content': None,
            }

        image_url = _extract_first_http_image_url(combined)
        if image_url:
            downloaded_bytes, downloaded_mime_type = _download_image_from_url(image_url)
            if downloaded_bytes:
                return {
                    'message_type': 'image',
                    'image_bytes': downloaded_bytes,
                    'mime_type': downloaded_mime_type,
                    'content': None,
                }
            current_app.logger.warning('Image URL returned but download failed; using external URL directly: %s', image_url)
            return {
                'message_type': 'image',
                'image_url': image_url,
                'content': None,
            }

        if combined:
            current_app.logger.warning('Image generation response had no usable image payload/url. Response text: %s', combined[:500])
        else:
            current_app.logger.warning('Image generation response had no text and no usable image payload/url (model=%s).', model_name)

        return {
            'message_type': 'text',
            'content': 'Image generation failed. Please try again.'
        }

    if not combined:
        raise RuntimeError('Gemini returned an empty response')

    return {
        'message_type': 'text',
        'content': combined,
    }


def _sanitize_chatbot_payload(chatbot):
    data = chatbot.to_dict()
    data.pop('gemini_api_key', None)
    return data


def _is_chatbot_expired(chatbot):
    if not chatbot or not chatbot.end_date:
        return False
    if chatbot.end_date == Chatbot.INFINITE_END_DATE:
        return False
    return chatbot.end_date < datetime.utcnow().date()


def _sync_inactive_if_expired(chatbot):
    expired = _is_chatbot_expired(chatbot)
    if expired and chatbot.active:
        chatbot.active = False
        db.session.commit()
    return expired


def _get_participant(chatbot_id, user_id):
    return ChatbotParticipant.query.filter(
        and_(
            ChatbotParticipant.chatbot_id == chatbot_id,
            ChatbotParticipant.user_id == user_id
        )
    ).first()


def _get_conversation_for_user(chatbot_id, conversation_id, user_id):
    if not conversation_id:
        return None

    return Conversation.query.filter(
        and_(
            Conversation.id == conversation_id,
            Conversation.chatbot_id == chatbot_id,
            Conversation.user_id == user_id,
        )
    ).first()


def _serialize_conversation(conversation):
    data = conversation.to_dict()
    latest_message = (
        Message.query
        .filter_by(conversation_id=conversation.id)
        .order_by(Message.created_at.desc())
        .first()
    )
    message_count = Message.query.filter_by(conversation_id=conversation.id).count()

    data['message_count'] = message_count
    data['last_message_at'] = latest_message.created_at.isoformat() if latest_message else None
    data['last_message_preview'] = _build_message_preview(latest_message)
    return data

# ============================================
# Available Chatbots
# ============================================

@user_bp.route('/guests', methods=['GET'])
@token_required
def get_user_guests(user):
    chatbot_id = request.args.get('chatbot_id', type=int)
    if not chatbot_id:
        return jsonify({'success': False, 'message': 'chatbot_id is required'}), 400

    chatbot = Chatbot.query.get(chatbot_id)
    if not chatbot:
        return jsonify({'success': False, 'message': 'Chatbot not found'}), 404

    participant = _get_participant(chatbot_id, user.id)
    if not participant:
        return jsonify({'success': False, 'message': 'Not joined this chatbot'}), 403

    guests = (
        Guest.query
        .filter_by(chatbot_id=chatbot_id, active=True)
        .order_by(Guest.created_at.asc())
        .all()
    )

    return jsonify({
        'success': True,
        'data': [guest.to_dict() for guest in guests]
    }), 200

@user_bp.route('/chatbots', methods=['GET'])
@token_required
def get_available_chatbots(user):
    """Get available chatbots for user"""
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 12, type=int)
    search = request.args.get('search', '')
    
    today = datetime.utcnow().date()
    query = Chatbot.query.filter(
        Chatbot.public == True,
        Chatbot.active == True,
        or_(
            Chatbot.end_date == Chatbot.INFINITE_END_DATE,
            Chatbot.end_date >= today
        )
    )
    
    if search:
        query = query.filter(
            or_(
                Chatbot.name.ilike(f'%{search}%'),
                Chatbot.event_name.ilike(f'%{search}%'),
                Chatbot.description.ilike(f'%{search}%')
            )
        )
    
    paginated = query.paginate(page=page, per_page=per_page)
    
    return jsonify({
        'success': True,
        'data': [_sanitize_chatbot_payload(chatbot) for chatbot in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages
    }), 200


@user_bp.route('/usage', methods=['GET'])
@token_required
def get_usage_summary(user):
    usage = _build_generation_usage(user)
    return jsonify({
        'success': True,
        'data': usage
    }), 200

# ============================================
# Join Chatbot
# ============================================

@user_bp.route('/chatbots/<int:chatbot_id>/join', methods=['POST'])
@token_required
def join_chatbot(user, chatbot_id):
    """Join a chatbot"""
    
    chatbot = Chatbot.query.get(chatbot_id)
    
    if not chatbot:
        return jsonify({'success': False, 'message': 'Chatbot not found'}), 404
    
    if not chatbot.public:
        return jsonify({'success': False, 'message': 'This chatbot is private'}), 403

    is_expired = _sync_inactive_if_expired(chatbot)
    if is_expired or not chatbot.active:
        return jsonify({'success': False, 'message': 'This chatbot is inactive because the event has ended'}), 400
    
    # Check if already joined
    existing = ChatbotParticipant.query.filter(
        and_(
            ChatbotParticipant.chatbot_id == chatbot_id,
            ChatbotParticipant.user_id == user.id
        )
    ).first()
    
    if existing:
        return jsonify({'success': False, 'message': 'Already joined this chatbot'}), 409
    
    participant = ChatbotParticipant(
        chatbot_id=chatbot_id,
        user_id=user.id
    )
    
    db.session.add(participant)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Successfully joined chatbot'
    }), 200

# ============================================
# User Chatbots
# ============================================

@user_bp.route('/my-chatbots', methods=['GET'])
@token_required
def get_my_chatbots(user):
    """Get chatbots user has joined"""
    
    participants = ChatbotParticipant.query.filter_by(user_id=user.id).all()
    chatbot_ids = [p.chatbot_id for p in participants]
    
    chatbots = Chatbot.query.filter(Chatbot.id.in_(chatbot_ids)).all()

    changed = False
    results = []
    for chatbot in chatbots:
        if _is_chatbot_expired(chatbot) and chatbot.active:
            chatbot.active = False
            changed = True

        # Provide full chatbot details for participants, including gemini key, guests and background image
        chatbot_data = chatbot.to_dict()
        chatbot_data['guests'] = [g.to_dict() for g in chatbot.guests]
        # background_image is present in to_dict already; keep gemini_api_key present for frontend confirmation
        results.append(chatbot_data)

    if changed:
        db.session.commit()

    return jsonify({
        'success': True,
        'data': results
    }), 200

# ============================================
# User Profile
# ============================================

@user_bp.route('/profile', methods=['GET'])
@token_required
def get_profile(user):
    """Get user profile"""
    
    profile_data = user.to_dict()
    profile_data['joined_chatbots'] = ChatbotParticipant.query.filter_by(user_id=user.id).count()
    profile_data['messages_sent'] = Message.query.filter_by(user_id=user.id).count()
    
    return jsonify({
        'success': True,
        'data': profile_data
    }), 200

@user_bp.route('/profile', methods=['PUT'])
@token_required
def update_profile(user):
    """Update user profile"""
    
    data = request.get_json()
    
    if 'name' in data:
        user.name = data['name']
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Profile updated successfully',
        'data': user.to_dict()
    }), 200

# ============================================
# Conversations
# ============================================

@user_bp.route('/chatbots/<int:chatbot_id>/conversations', methods=['GET'])
@token_required
def list_conversations(user, chatbot_id):
    participant = _get_participant(chatbot_id, user.id)
    if not participant:
        return jsonify({'success': False, 'message': 'Not joined this chatbot'}), 403

    rows = (
        Conversation.query
        .filter_by(chatbot_id=chatbot_id, user_id=user.id)
        .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
        .all()
    )

    return jsonify({
        'success': True,
        'data': [_serialize_conversation(row) for row in rows]
    }), 200


@user_bp.route('/chatbots/<int:chatbot_id>/conversations', methods=['POST'])
@token_required
def create_conversation(user, chatbot_id):
    participant = _get_participant(chatbot_id, user.id)
    if not participant:
        return jsonify({'success': False, 'message': 'Not joined this chatbot'}), 403

    data = request.get_json(silent=True) or {}
    title = str(data.get('title', '')).strip() or 'New chat'

    conversation = Conversation(
        chatbot_id=chatbot_id,
        user_id=user.id,
        title=title,
        updated_at=datetime.utcnow(),
    )
    db.session.add(conversation)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Conversation created',
        'data': _serialize_conversation(conversation)
    }), 201


@user_bp.route('/chatbots/<int:chatbot_id>/conversations/<int:conversation_id>', methods=['PUT'])
@token_required
def rename_conversation(user, chatbot_id, conversation_id):
    participant = _get_participant(chatbot_id, user.id)
    if not participant:
        return jsonify({'success': False, 'message': 'Not joined this chatbot'}), 403

    conversation = _get_conversation_for_user(chatbot_id, conversation_id, user.id)
    if not conversation:
        return jsonify({'success': False, 'message': 'Conversation not found'}), 404

    data = request.get_json(silent=True) or {}
    title = str(data.get('title', '')).strip()
    if not title:
        return jsonify({'success': False, 'message': 'Conversation title is required'}), 400

    conversation.title = title
    conversation.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Conversation updated',
        'data': _serialize_conversation(conversation)
    }), 200


@user_bp.route('/chatbots/<int:chatbot_id>/conversations/<int:conversation_id>', methods=['DELETE'])
@token_required
def delete_conversation(user, chatbot_id, conversation_id):
    participant = _get_participant(chatbot_id, user.id)
    if not participant:
        return jsonify({'success': False, 'message': 'Not joined this chatbot'}), 403

    conversation = _get_conversation_for_user(chatbot_id, conversation_id, user.id)
    if not conversation:
        return jsonify({'success': False, 'message': 'Conversation not found'}), 404

    conversation_messages = Message.query.filter_by(conversation_id=conversation.id).all()
    _delete_message_image_assets(conversation_messages)
    for message in conversation_messages:
        db.session.delete(message)

    db.session.delete(conversation)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Conversation deleted'
    }), 200


@user_bp.route('/chatbots/<int:chatbot_id>/conversations/<int:conversation_id>/messages', methods=['GET'])
@token_required
def get_conversation_messages(user, chatbot_id, conversation_id):
    participant = _get_participant(chatbot_id, user.id)
    if not participant:
        return jsonify({'success': False, 'message': 'Not joined this chatbot'}), 403

    conversation = _get_conversation_for_user(chatbot_id, conversation_id, user.id)
    if not conversation:
        return jsonify({'success': False, 'message': 'Conversation not found'}), 404

    messages = (
        Message.query
        .filter_by(chatbot_id=chatbot_id, user_id=user.id, conversation_id=conversation.id)
        .order_by(Message.created_at)
        .all()
    )

    return jsonify({
        'success': True,
        'data': [message.to_dict() for message in messages]
    }), 200


# ============================================
# Messages
# ============================================

@user_bp.route('/chatbots/<int:chatbot_id>/messages', methods=['GET'])
@token_required
def get_chatbot_messages(user, chatbot_id):
    """Get messages for a chatbot"""

    participant = _get_participant(chatbot_id, user.id)
    if not participant:
        return jsonify({'success': False, 'message': 'Not joined this chatbot'}), 403

    conversation_id = request.args.get('conversation_id', type=int)
    query = Message.query.filter_by(chatbot_id=chatbot_id, user_id=user.id)

    if conversation_id:
        conversation = _get_conversation_for_user(chatbot_id, conversation_id, user.id)
        if not conversation:
            return jsonify({'success': False, 'message': 'Conversation not found'}), 404
        query = query.filter_by(conversation_id=conversation.id)

    messages = query.order_by(Message.created_at).all()
    
    return jsonify({
        'success': True,
        'data': [message.to_dict() for message in messages]
    }), 200

@user_bp.route('/chatbots/<int:chatbot_id>/messages', methods=['POST'])
@token_required
def send_message(user, chatbot_id):
    """Send message in chatbot"""

    participant = _get_participant(chatbot_id, user.id)
    if not participant:
        return jsonify({'success': False, 'message': 'Not joined this chatbot'}), 403

    chatbot = Chatbot.query.get(chatbot_id)
    if not chatbot:
        return jsonify({'success': False, 'message': 'Chatbot not found'}), 404

    is_expired = _sync_inactive_if_expired(chatbot)
    if is_expired:
        return jsonify({'success': False, 'message': 'This chatbot is inactive because the event has ended'}), 400

    if not chatbot.active:
        return jsonify({'success': False, 'message': 'This chatbot is currently inactive'}), 400
    
    data = request.form.to_dict() if request.form else (request.get_json() or {})
    content = str(data.get('content', '')).strip()
    conversation_id = data.get('conversation_id')
    guest_ids = _parse_guest_ids(data.get('guest_ids'))
    if not guest_ids and data.get('guest_id') is not None:
        guest_ids = _parse_guest_ids(data.get('guest_id'))

    try:
        conversation_id = int(conversation_id) if conversation_id is not None and str(conversation_id).strip() else None
    except (TypeError, ValueError):
        return jsonify({'success': False, 'message': 'Invalid conversation_id'}), 400

    conversation = _get_conversation_for_user(chatbot_id, conversation_id, user.id) if conversation_id else None
    if conversation_id and not conversation:
        return jsonify({'success': False, 'message': 'Conversation not found'}), 404

    if not conversation:
        conversation = Conversation(
            chatbot_id=chatbot_id,
            user_id=user.id,
            title='New chat',
            updated_at=datetime.utcnow(),
        )
        db.session.add(conversation)
        db.session.flush()

    uploaded_image = request.files.get('image') if request.files else None
    image_payload = None
    message_image_url = None

    if uploaded_image and uploaded_image.filename:
        mime_type = (uploaded_image.mimetype or '').lower().strip()
        if mime_type not in ALLOWED_IMAGE_MIME_TYPES:
            return jsonify({'success': False, 'message': 'Only PNG, JPG, JPEG, WEBP, or GIF images are allowed'}), 400

        image_bytes = uploaded_image.read()
        if not image_bytes:
            return jsonify({'success': False, 'message': 'Uploaded image is empty'}), 400

        if len(image_bytes) > MAX_CHAT_IMAGE_SIZE_BYTES:
            return jsonify({'success': False, 'message': 'Image too large. Max allowed is 8MB'}), 400

        image_payload = {
            'mime_type': mime_type,
            'data_b64': base64.b64encode(image_bytes).decode('utf-8')
        }
        message_image_url = _save_message_image(image_bytes, uploaded_image.filename)

    # Extract guest image if provided (legacy fallback)
    guest_image_payloads = []
    guest_image_file = request.files.get('guest_image') if request.files else None
    if guest_image_file and guest_image_file.filename:
        mime_type = (guest_image_file.mimetype or '').lower().strip()
        if mime_type in ALLOWED_IMAGE_MIME_TYPES:
            guest_image_bytes = guest_image_file.read()
            if guest_image_bytes and len(guest_image_bytes) <= MAX_CHAT_IMAGE_SIZE_BYTES:
                guest_image_payloads.append({
                    'mime_type': mime_type,
                    'data_b64': base64.b64encode(guest_image_bytes).decode('utf-8')
                })

    guest_image_files = request.files.getlist('guest_images') if request.files else []
    for guest_image in guest_image_files:
        if not guest_image or not guest_image.filename:
            continue
        mime_type = (guest_image.mimetype or '').lower().strip()
        if mime_type not in ALLOWED_IMAGE_MIME_TYPES:
            continue
        guest_image_bytes = guest_image.read()
        if guest_image_bytes and len(guest_image_bytes) <= MAX_CHAT_IMAGE_SIZE_BYTES:
            guest_image_payloads.append({
                'mime_type': mime_type,
                'data_b64': base64.b64encode(guest_image_bytes).decode('utf-8')
            })

    # Primary guest source: selected guest IDs from chatbot guest list
    guest_image_payloads.extend(_build_guest_image_payloads(chatbot_id, guest_ids))

    # Extract background image if provided
    background_image_payload = None
    background_image_file = request.files.get('background_image') if request.files else None
    if background_image_file and background_image_file.filename:
        mime_type = (background_image_file.mimetype or '').lower().strip()
        if mime_type in ALLOWED_IMAGE_MIME_TYPES:
            background_image_bytes = background_image_file.read()
            if background_image_bytes and len(background_image_bytes) <= MAX_CHAT_IMAGE_SIZE_BYTES:
                background_image_payload = {
                    'mime_type': mime_type,
                    'data_b64': base64.b64encode(background_image_bytes).decode('utf-8')
                }

    if not content and not image_payload:
        return jsonify({'success': False, 'message': 'Message text or image is required'}), 400

    content_for_model = content
    requested_mode = str(data.get('mode', '')).strip().lower()
    multiple_person_mode_flag = str(data.get('multiple_person_mode', '')).strip().lower() in ('1', 'true', 'yes', 'on')
    generation_mode = 'multiple' if requested_mode == 'multiple' or multiple_person_mode_flag or len(guest_ids) > 1 else 'single'
    guest_image_urls_for_message = _build_guest_image_urls(chatbot_id, guest_ids)
    background_image_url_for_message = _normalize_media_url_for_message(chatbot.background_image)
    message_image_urls = list(guest_image_urls_for_message)
    if background_image_url_for_message and background_image_url_for_message not in message_image_urls:
        message_image_urls.append(background_image_url_for_message)

    if message_image_urls:
        guest_markdown_block = '\n'.join(
            [f'![]({url})' for url in message_image_urls]
        )
        content = f"{content}\n\n{guest_markdown_block}" if content else guest_markdown_block

    all_image_payloads = []
    if image_payload:
        all_image_payloads.append(image_payload)
    if guest_image_payloads:
        all_image_payloads.extend(guest_image_payloads)
    if background_image_payload:
        all_image_payloads.append(background_image_payload)

    content_lower = str(content_for_model or '').lower()
    keyword_image_request = bool(re.search(r'(generate|create|make|render)\s+.*(image|photo|portrait|picture)', content_lower))
    mode_image_request = requested_mode in ('single', 'multiple', 'guest')
    is_image_request = bool(mode_image_request or keyword_image_request)
    if not is_image_request and not str(content_for_model or '').strip() and len(all_image_payloads) > 0:
        is_image_request = True

    if is_image_request and _is_limited_image_generation_user(user):
        usage = _build_generation_usage(user)
        if (usage.get('used') or 0) >= USER_IMAGE_GENERATION_LIMIT:
            return jsonify({
                'success': False,
                'message': f'Generation limit reached ({USER_IMAGE_GENERATION_LIMIT}). Please contact admin to upgrade to volunteer access.',
                'limit': USER_IMAGE_GENERATION_LIMIT,
                'used': usage.get('used') or 0,
                'remaining': 0,
                'usage': usage
            }), 403
    
    message = Message(
        chatbot_id=chatbot_id,
        user_id=user.id,
        conversation_id=conversation.id,
        content=content,
        is_user_message=True,
        message_type='image' if message_image_url else 'text',
        image_url=message_image_url
    )
    
    db.session.add(message)
    
    # Update participant activity
    participant.last_active = db.func.now()
    participant.message_count += 1
    conversation.updated_at = datetime.utcnow()

    if conversation.title == 'New chat':
        cleaned_title = _clean_message_text_for_preview(content_for_model)
        if cleaned_title:
            conversation.title = cleaned_title[:60]
        elif message_image_url:
            conversation.title = 'Image conversation'
    
    db.session.commit()

    def _friendly_image_failure_message(error_text=''):
        normalized = str(error_text or '').lower()
        if (
            'api key' in normalized
            or 'invalid_argument' in normalized
            or 'permission denied' in normalized
            or 'unauthorized' in normalized
            or 'forbidden' in normalized
            or 'authentication' in normalized
        ):
            return 'Image generation is temporarily unavailable due to API configuration. Please contact admin or volunteer support.'

        if (
            'quota' in normalized
            or 'resource_exhausted' in normalized
            or 'rate limit' in normalized
            or 'too many requests' in normalized
            or '429' in normalized
            or 'billing' in normalized
            or 'limit' in normalized
        ):
            return 'Image generation limit is currently reached. Please contact admin or volunteer support.'

        return 'Unable to generate image right now. Please try again or contact admin/volunteer support.'

    bot_response = None
    try:
        gemini_result = _call_gemini(
            chatbot,
            user,
            content_for_model,
            image_payloads=all_image_payloads if all_image_payloads else None,
            generation_mode=generation_mode,
            expect_image=is_image_request,
        )

        if is_image_request and gemini_result.get('message_type') == 'image':
            generated_image_url = None
            generated_bytes = gemini_result.get('image_bytes') or b''
            if generated_bytes:
                generated_image_url = _save_generated_image_to_static(
                    generated_bytes,
                    gemini_result.get('mime_type') or 'image/png'
                )
            else:
                generated_image_url = str(gemini_result.get('image_url') or '').strip() or None

            if not generated_image_url:
                generated_image_url = None

            if generated_image_url:
                bot_response = Message(
                    chatbot_id=chatbot_id,
                    user_id=user.id,
                    conversation_id=conversation.id,
                    content=None,
                    is_user_message=False,
                    message_type='image',
                    image_url=generated_image_url
                )
            else:
                bot_response = Message(
                    chatbot_id=chatbot_id,
                    user_id=user.id,
                    conversation_id=conversation.id,
                    content=_friendly_image_failure_message('empty image output'),
                    is_user_message=False,
                    message_type='text'
                )
        elif is_image_request:
            bot_response = Message(
                chatbot_id=chatbot_id,
                user_id=user.id,
                conversation_id=conversation.id,
                content=_friendly_image_failure_message('text fallback returned for image request'),
                is_user_message=False,
                message_type='text'
            )
        else:
            bot_response = Message(
                chatbot_id=chatbot_id,
                user_id=user.id,
                conversation_id=conversation.id,
                content=str(gemini_result.get('content') or '').strip(),
                is_user_message=False,
                message_type='text'
            )
    except Exception as exc:
        current_app.logger.exception('Gemini generation failed (is_image_request=%s, chatbot_id=%s, conversation_id=%s)', is_image_request, chatbot_id, conversation.id)
        if is_image_request:
            bot_response = Message(
                chatbot_id=chatbot_id,
                user_id=user.id,
                conversation_id=conversation.id,
                content=_friendly_image_failure_message(exc),
                is_user_message=False,
                message_type='text'
            )
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to generate response'
            }), 502

    if not bot_response:
        return jsonify({
            'success': False,
            'message': 'Failed to generate response'
        }), 502
    
    db.session.add(bot_response)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Message sent successfully',
        'data': {
            'conversation': _serialize_conversation(conversation),
            'user_message': message.to_dict(),
            'bot_response': bot_response.to_dict()
        }
    }), 201
