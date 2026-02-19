# ============================================
# User Routes
# ============================================

from flask import Blueprint, request, jsonify
from sqlalchemy import and_, or_

try:
    from models import db, Chatbot, Message, ChatbotParticipant, User
    from routes.auth import token_required
except ImportError:
    from backend.models import db, Chatbot, Message, ChatbotParticipant, User
    from backend.routes.auth import token_required

user_bp = Blueprint('user', __name__)

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
    
    query = Chatbot.query.filter(Chatbot.public == True, Chatbot.active == True)
    
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
        'data': [chatbot.to_dict() for chatbot in paginated.items],
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
    
    return jsonify({
        'success': True,
        'data': [chatbot.to_dict() for chatbot in chatbots]
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
    if 'bio' in data:
        user.bio = data['bio']
    if 'organization' in data:
        user.organization = data['organization']
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Profile updated successfully',
        'data': user.to_dict()
    }), 200

# ============================================
# Messages (Placeholder for future chat feature)
# ============================================

@user_bp.route('/chatbots/<int:chatbot_id>/messages', methods=['GET'])
@token_required
def get_chatbot_messages(user, chatbot_id):
    """Get messages for a chatbot"""
    
    # Check if user is participant
    participant = ChatbotParticipant.query.filter(
        and_(
            ChatbotParticipant.chatbot_id == chatbot_id,
            ChatbotParticipant.user_id == user.id
        )
    ).first()
    
    if not participant:
        return jsonify({'success': False, 'message': 'Not joined this chatbot'}), 403
    
    messages = Message.query.filter_by(chatbot_id=chatbot_id).order_by(Message.created_at).all()
    
    return jsonify({
        'success': True,
        'data': [message.to_dict() for message in messages]
    }), 200

@user_bp.route('/chatbots/<int:chatbot_id>/messages', methods=['POST'])
@token_required
def send_message(user, chatbot_id):
    """Send message in chatbot"""
    
    # Check if user is participant
    participant = ChatbotParticipant.query.filter(
        and_(
            ChatbotParticipant.chatbot_id == chatbot_id,
            ChatbotParticipant.user_id == user.id
        )
    ).first()
    
    if not participant:
        return jsonify({'success': False, 'message': 'Not joined this chatbot'}), 403
    
    data = request.get_json()
    
    if not data or not data.get('content'):
        return jsonify({'success': False, 'message': 'Message content required'}), 400
    
    message = Message(
        chatbot_id=chatbot_id,
        user_id=user.id,
        content=data['content'],
        is_user_message=True
    )
    
    db.session.add(message)
    
    # Update participant activity
    participant.last_active = db.func.now()
    participant.message_count += 1
    
    db.session.commit()
    
    # Simulate bot response
    bot_response = Message(
        chatbot_id=chatbot_id,
        user_id=user.id,
        content="Thank you for your message. This is a simulated bot response.",
        is_user_message=False
    )
    
    db.session.add(bot_response)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Message sent successfully',
        'data': {
            'user_message': message.to_dict(),
            'bot_response': bot_response.to_dict()
        }
    }), 201
