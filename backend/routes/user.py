# ============================================
# User Routes
# ============================================

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import and_, or_
from datetime import datetime
import base64
import os
import requests

try:
    from models import db, Chatbot, Message, ChatbotParticipant, User, Conversation
    from routes.auth import token_required
except ImportError:
    from backend.models import db, Chatbot, Message, ChatbotParticipant, User, Conversation
    from backend.routes.auth import token_required

user_bp = Blueprint('user', __name__)

# default to a free flash model
GEMINI_MODEL = 'gemini-flash-latest'
ALLOWED_IMAGE_MIME_TYPES = {
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif'
}
MAX_CHAT_IMAGE_SIZE_BYTES = 8 * 1024 * 1024


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


def _call_gemini(chatbot, user, user_text, image_payload=None):
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

    history = _build_recent_context(chatbot.id, user.id)
    if history:
        prompt_chunks.extend([
            'Recent Conversation Context:',
            history
        ])

    prompt_chunks.extend([
        'User Input:',
        user_text.strip() or 'Analyze the provided image and answer helpfully.',
        'Respond clearly and concisely.'
    ])

    parts = [{
        'text': '\n\n'.join(prompt_chunks)
    }]

    if image_payload:
        parts.append({
            'inline_data': {
                'mime_type': image_payload['mime_type'],
                'data': image_payload['data_b64']
            }
        })

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    response = requests.post(
        endpoint,
        json={
            'contents': [{
                'role': 'user',
                'parts': parts
            }],
            'generationConfig': {
                'temperature': 0.6,
                'topP': 0.9,
                'maxOutputTokens': 1024
            }
        },
        timeout=45
    )

    if response.status_code >= 400:
        try:
            details = response.json()
        except Exception:
            details = response.text
        raise RuntimeError(f'Gemini API error ({response.status_code}): {details}')

    payload = response.json() or {}
    candidates = payload.get('candidates') or []
    if not candidates:
        raise RuntimeError('No response candidate returned by Gemini')

    parts = ((candidates[0].get('content') or {}).get('parts') or [])
    combined = '\n'.join([part.get('text', '') for part in parts if part.get('text')]).strip()
    if not combined:
        raise RuntimeError('Gemini returned an empty response')

    return combined


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
    data['last_message_preview'] = (latest_message.content[:120] if latest_message and latest_message.content else '')
    return data

# ============================================
# Available Chatbots
# ============================================

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

    Message.query.filter_by(conversation_id=conversation.id).delete()
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

    if not content and not image_payload:
        return jsonify({'success': False, 'message': 'Message text or image is required'}), 400

    if image_payload and not content:
        content = '[Image uploaded]'
    
    message = Message(
        chatbot_id=chatbot_id,
        user_id=user.id,
        conversation_id=conversation.id,
        content=content,
        is_user_message=True
    )
    
    db.session.add(message)
    
    # Update participant activity
    participant.last_active = db.func.now()
    participant.message_count += 1
    conversation.updated_at = datetime.utcnow()

    if conversation.title == 'New chat' and content and content != '[Image uploaded]':
        conversation.title = content[:60]
    
    db.session.commit()
    
    try:
        bot_reply_text = _call_gemini(chatbot, user, content, image_payload=image_payload)
    except Exception as error:
        return jsonify({
            'success': False,
            'message': f'Failed to generate response: {str(error)}'
        }), 502

    bot_response = Message(
        chatbot_id=chatbot_id,
        user_id=user.id,
        conversation_id=conversation.id,
        content=bot_reply_text,
        is_user_message=False
    )
    
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
