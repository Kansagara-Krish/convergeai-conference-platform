# ============================================
# Chatbot Management Routes
# ============================================

from flask import Blueprint, request, jsonify
from datetime import datetime

try:
    from models import db, Chatbot, Guest, Message
    from routes.auth import token_required, admin_required
except ImportError:
    from backend.models import db, Chatbot, Guest, Message
    from backend.routes.auth import token_required, admin_required

chatbot_bp = Blueprint('chatbot', __name__)


def to_bool(value, default=False):
    """Normalize common request boolean formats to real booleans."""
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return bool(value)

    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ('1', 'true', 'yes', 'on'):
            return True
        if normalized in ('0', 'false', 'no', 'off', ''):
            return False

    return default

# ============================================
# Create Chatbot
# ============================================

@chatbot_bp.route('', methods=['POST'])
@token_required
@admin_required
def create_chatbot(user):
    """Create a new chatbot"""
    
    data = request.get_json()
    if not isinstance(data, dict):
        return jsonify({'success': False, 'message': 'Invalid request body'}), 400
    
    # Validate required fields
    required_fields = ['name', 'event_name', 'start_date', 'end_date', 'system_prompt']
    if not all(field in data for field in required_fields):
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400
    
    try:
        chatbot = Chatbot(
            name=data['name'],
            event_name=data['event_name'],
            description=data.get('description', ''),
            start_date=datetime.fromisoformat(data['start_date']).date(),
            end_date=datetime.fromisoformat(data['end_date']).date(),
            system_prompt=data['system_prompt'],
            single_mode=to_bool(data.get('single_mode'), False),
            multiple_mode=to_bool(data.get('multiple_mode'), True),
            public=to_bool(data.get('public'), True),
            active=to_bool(data.get('active'), True),
            created_by_id=user.id
        )
        
        db.session.add(chatbot)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Chatbot created successfully',
            'data': chatbot.to_dict()
        }), 201
    
    except ValueError as e:
        return jsonify({'success': False, 'message': f'Invalid date format: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Error creating chatbot: {str(e)}'}), 500

# ============================================
# Update Chatbot
# ============================================

@chatbot_bp.route('/<int:chatbot_id>', methods=['PUT'])
@token_required
@admin_required
def update_chatbot(user, chatbot_id):
    """Update chatbot"""
    
    chatbot = Chatbot.query.get(chatbot_id)
    
    if not chatbot:
        return jsonify({'success': False, 'message': 'Chatbot not found'}), 404
    
    data = request.get_json()
    
    # Update fields
    if 'name' in data:
        chatbot.name = data['name']
    if 'event_name' in data:
        chatbot.event_name = data['event_name']
    if 'description' in data:
        chatbot.description = data['description']
    if 'system_prompt' in data:
        chatbot.system_prompt = data['system_prompt']
    if 'public' in data:
        chatbot.public = to_bool(data['public'], chatbot.public)
    if 'active' in data:
        chatbot.active = to_bool(data['active'], chatbot.active)
    if 'single_mode' in data:
        chatbot.single_mode = to_bool(data['single_mode'], chatbot.single_mode)
    if 'multiple_mode' in data:
        chatbot.multiple_mode = to_bool(data['multiple_mode'], chatbot.multiple_mode)
    
    if 'start_date' in data:
        chatbot.start_date = datetime.fromisoformat(data['start_date']).date()
    if 'end_date' in data:
        chatbot.end_date = datetime.fromisoformat(data['end_date']).date()
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Chatbot updated successfully',
        'data': chatbot.to_dict()
    }), 200

# ============================================
# Get Chatbot
# ============================================

@chatbot_bp.route('/<int:chatbot_id>', methods=['GET'])
@token_required
def get_chatbot(user, chatbot_id):
    """Get chatbot details"""
    
    chatbot = Chatbot.query.get(chatbot_id)
    
    if not chatbot:
        return jsonify({'success': False, 'message': 'Chatbot not found'}), 404
    
    # Check access (user can only see public chatbots or their own)
    if not chatbot.public and chatbot.created_by_id != user.id and user.role != 'admin':
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    chatbot_data = chatbot.to_dict()
    chatbot_data['guests'] = [guest.to_dict() for guest in chatbot.guests]
    
    return jsonify({
        'success': True,
        'data': chatbot_data
    }), 200

# ============================================
# Delete Chatbot Settings
# ============================================

@chatbot_bp.route('/<int:chatbot_id>/settings', methods=['GET'])
@token_required
@admin_required
def get_chatbot_settings(user, chatbot_id):
    """Get chatbot settings"""
    
    chatbot = Chatbot.query.get(chatbot_id)
    
    if not chatbot:
        return jsonify({'success': False, 'message': 'Chatbot not found'}), 404
    
    return jsonify({
        'success': True,
        'data': {
            'id': chatbot.id,
            'name': chatbot.name,
            'system_prompt': chatbot.system_prompt,
            'single_mode': chatbot.single_mode,
            'multiple_mode': chatbot.multiple_mode,
            'public': chatbot.public,
            'active': chatbot.active
        }
    }), 200

# ============================================
# Statistics
# ============================================

@chatbot_bp.route('/<int:chatbot_id>/stats', methods=['GET'])
@token_required
def get_chatbot_stats(user, chatbot_id):
    """Get chatbot statistics"""
    
    chatbot = Chatbot.query.get(chatbot_id)
    
    if not chatbot:
        return jsonify({'success': False, 'message': 'Chatbot not found'}), 404
    
    stats = {
        'total_messages': Message.query.filter_by(chatbot_id=chatbot_id).count(),
        'total_guests': len(chatbot.guests),
        'total_participants': len(chatbot.participants),
        'user_messages': Message.query.filter(
            Message.chatbot_id == chatbot_id,
            Message.is_user_message == True
        ).count(),
        'bot_messages': Message.query.filter(
            Message.chatbot_id == chatbot_id,
            Message.is_user_message == False
        ).count()
    }
    
    return jsonify({
        'success': True,
        'data': stats
    }), 200
