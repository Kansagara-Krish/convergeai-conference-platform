# ============================================
# Admin Routes
# ============================================

from flask import Blueprint, request, jsonify
from datetime import datetime

try:
    from models import db, User, Chatbot, Guest, Message
    from routes.auth import token_required, admin_required
except ImportError:
    from backend.models import db, User, Chatbot, Guest, Message
    from backend.routes.auth import token_required, admin_required

admin_bp = Blueprint('admin', __name__)

# ============================================
# Dashboard Statistics
# ============================================

@admin_bp.route('/dashboard/stats', methods=['GET'])
@token_required
@admin_required
def get_stats(user):
    """Get dashboard statistics"""
    
    stats = {
        'total_chatbots': Chatbot.query.count(),
        'active_chatbots': Chatbot.query.filter_by(active=True).count(),
        'total_users': User.query.count(),
        'active_users': User.query.filter_by(active=True).count(),
        'total_messages': Message.query.count(),
        'upcoming_events': Chatbot.query.filter(Chatbot.start_date > datetime.now().date()).count(),
    }
    
    return jsonify({
        'success': True,
        'data': stats
    }), 200

# ============================================
# User Management
# ============================================

@admin_bp.route('/users', methods=['GET'])
@token_required
@admin_required
def list_users(user):
    """List all users with pagination"""
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    role = request.args.get('role')
    active = request.args.get('active')
    
    query = User.query
    
    if role:
        query = query.filter_by(role=role)
    
    if active is not None:
        active_bool = active.lower() == 'true'
        query = query.filter_by(active=active_bool)
    
    paginated = query.paginate(page=page, per_page=per_page)
    
    return jsonify({
        'success': True,
        'data': [user.to_dict() for user in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page
    }), 200

@admin_bp.route('/users/<int:user_id>', methods=['GET'])
@token_required
@admin_required
def get_user(user, user_id):
    """Get user details"""
    
    target_user = User.query.get(user_id)
    
    if not target_user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    user_data = target_user.to_dict()
    user_data['chatbots_created'] = len(target_user.chatbots)
    user_data['messages_sent'] = len(target_user.messages)
    
    return jsonify({
        'success': True,
        'data': user_data
    }), 200

@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@token_required
@admin_required
def update_user(user, user_id):
    """Update user details"""
    
    target_user = User.query.get(user_id)
    
    if not target_user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    data = request.get_json()
    
    # Allow updating specific fields
    if 'active' in data:
        target_user.active = data['active']
    if 'role' in data and data['role'] in ['admin', 'user', 'speaker']:
        target_user.role = data['role']
    if 'name' in data:
        target_user.name = data['name']
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'User updated successfully',
        'data': target_user.to_dict()
    }), 200

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_user(user, user_id):
    """Delete user"""
    
    if user_id == user.id:
        return jsonify({'success': False, 'message': 'Cannot delete your own account'}), 400
    
    target_user = User.query.get(user_id)
    
    if not target_user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    db.session.delete(target_user)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'User deleted successfully'
    }), 200

# ============================================
# Chatbot Management
# ============================================

@admin_bp.route('/chatbots', methods=['GET'])
@token_required
@admin_required
def list_chatbots(user):
    """List all chatbots"""
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    paginated = Chatbot.query.paginate(page=page, per_page=per_page)
    
    return jsonify({
        'success': True,
        'data': [chatbot.to_dict() for chatbot in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages
    }), 200

@admin_bp.route('/chatbots/<int:chatbot_id>', methods=['GET'])
@token_required
@admin_required
def get_chatbot(user, chatbot_id):
    """Get chatbot details"""
    
    chatbot = Chatbot.query.get(chatbot_id)
    
    if not chatbot:
        return jsonify({'success': False, 'message': 'Chatbot not found'}), 404
    
    chatbot_data = chatbot.to_dict()
    chatbot_data['guests'] = [guest.to_dict() for guest in chatbot.guests]
    
    return jsonify({
        'success': True,
        'data': chatbot_data
    }), 200

@admin_bp.route('/chatbots/<int:chatbot_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_chatbot(user, chatbot_id):
    """Delete chatbot"""
    
    chatbot = Chatbot.query.get(chatbot_id)
    
    if not chatbot:
        return jsonify({'success': False, 'message': 'Chatbot not found'}), 404
    
    db.session.delete(chatbot)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Chatbot deleted successfully'
    }), 200

# ============================================
# Guest Management
# ============================================

@admin_bp.route('/chatbots/<int:chatbot_id>/guests', methods=['GET'])
@token_required
@admin_required
def get_guests(user, chatbot_id):
    """Get chatbot guests"""
    
    chatbot = Chatbot.query.get(chatbot_id)
    
    if not chatbot:
        return jsonify({'success': False, 'message': 'Chatbot not found'}), 404
    
    return jsonify({
        'success': True,
        'data': [guest.to_dict() for guest in chatbot.guests]
    }), 200

@admin_bp.route('/chatbots/<int:chatbot_id>/guests', methods=['POST'])
@token_required
@admin_required
def add_guest(user, chatbot_id):
    """Add guest to chatbot"""
    
    chatbot = Chatbot.query.get(chatbot_id)
    
    if not chatbot:
        return jsonify({'success': False, 'message': 'Chatbot not found'}), 404
    
    data = request.get_json()
    
    guest = Guest(
        chatbot_id=chatbot_id,
        name=data.get('name'),
        title=data.get('title'),
        description=data.get('description'),
        organization=data.get('organization'),
        email=data.get('email'),
        is_speaker=data.get('is_speaker', False),
        is_moderator=data.get('is_moderator', False)
    )
    
    db.session.add(guest)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Guest added successfully',
        'data': guest.to_dict()
    }), 201

# ============================================
# Import Users
# ============================================

@admin_bp.route('/import/excel', methods=['POST'])
@token_required
@admin_required
def import_users_from_excel(user):
    """Import users from Excel file"""
    
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file provided'}), 400
    
    file = request.files['file']
    
    if not file.filename.endswith('.xlsx'):
        return jsonify({'success': False, 'message': 'Only .xlsx files are allowed'}), 400
    
    try:
        # Simulated import - would use openpyxl in production
        credentials = [
            {
                'username': f'user_{i}',
                'password': SessionToken.generate_token()[:12],
                'email': f'user_{i}@example.com'
            }
            for i in range(5)  # Simulated 5 users
        ]
        
        return jsonify({
            'success': True,
            'message': 'Users imported successfully',
            'count': len(credentials),
            'credentials': credentials
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Import failed: {str(e)}'
        }), 400
