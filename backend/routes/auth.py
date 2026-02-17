# ============================================
# Authentication Routes
# ============================================

from flask import Blueprint, request, jsonify
from datetime import datetime
from functools import wraps

try:
    from models import db, User, SessionToken
except ImportError:
    from backend.models import db, User, SessionToken

auth_bp = Blueprint('auth', __name__)

# ============================================
# Authentication Decorators
# ============================================

def token_required(f):
    """Decorator to require authentication token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'success': False, 'message': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'success': False, 'message': 'Token is missing'}), 401
        
        user = SessionToken.verify_token(token)
        if not user:
            return jsonify({'success': False, 'message': 'Invalid or expired token'}), 401
        
        return f(user, *args, **kwargs)
    
    return decorated

def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    def decorated(user, *args, **kwargs):
        if user.role != 'admin':
            return jsonify({'success': False, 'message': 'Admin access required'}), 403
        return f(user, *args, **kwargs)
    
    return decorated

# ============================================
# Login Endpoint
# ============================================

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint"""
    
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'success': False, 'message': 'Username and password required'}), 400
    
    user = User.query.filter_by(username=data['username']).first()
    
    if not user:
        return jsonify({
            'success': False, 
            'message': 'Username not found',
            'field': 'username'
        }), 401
    
    if not user.check_password(data['password']):
        return jsonify({
            'success': False, 
            'message': 'Incorrect password',
            'field': 'password'
        }), 401
    
    if not user.active:
        return jsonify({'success': False, 'message': 'Account is inactive'}), 403
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.session.commit()
    
    # Create session token
    token = SessionToken.create_token(user.id)
    
    return jsonify({
        'success': True,
        'message': 'Login successful',
        'token': token,
        'user': user.to_dict()
    }), 200

# ============================================
# Register Endpoint
# ============================================

@auth_bp.route('/register', methods=['POST'])
def register():
    """User registration endpoint"""
    
    data = request.get_json()
    
    required_fields = ['username', 'email', 'password', 'name']
    if not all(field in data for field in required_fields):
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400
    
    # Check if user already exists
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'success': False, 'message': 'Username already exists'}), 409
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'success': False, 'message': 'Email already exists'}), 409
    
    # Create new user
    user = User(
        username=data['username'],
        email=data['email'],
        name=data['name'],
        role=data.get('role', 'user')
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    # Create session token
    token = SessionToken.create_token(user.id)
    
    return jsonify({
        'success': True,
        'message': 'Registration successful',
        'token': token,
        'user': user.to_dict()
    }), 201

# ============================================
# Logout Endpoint
# ============================================

@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout(user):
    """User logout endpoint"""
    
    token = request.headers.get('Authorization', '').split(' ')[1] if 'Authorization' in request.headers else None
    
    if token:
        session = SessionToken.query.filter_by(token=token).first()
        if session:
            db.session.delete(session)
            db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Logout successful'
    }), 200

# ============================================
# Verify Token Endpoint
# ============================================

@auth_bp.route('/verify', methods=['GET'])
@token_required
def verify_token(user):
    """Verify token and return user info"""
    
    return jsonify({
        'success': True,
        'user': user.to_dict()
    }), 200

# ============================================
# Change Password Endpoint
# ============================================

@auth_bp.route('/change-password', methods=['PUT'])
@token_required
def change_password(user):
    """Change user password"""
    
    data = request.get_json()
    
    if not data or not data.get('current_password') or not data.get('new_password'):
        return jsonify({'success': False, 'message': 'Current and new password required'}), 400
    
    if not user.check_password(data['current_password']):
        return jsonify({'success': False, 'message': 'Current password is incorrect'}), 401
    
    user.set_password(data['new_password'])
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Password changed successfully'
    }), 200

# ============================================
# Reset Password Endpoint (Admin)
# ============================================

@auth_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@token_required
@admin_required
def reset_password(user, user_id):
    """Reset user password (admin only)"""
    
    target_user = User.query.get(user_id)
    
    if not target_user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    # Generate temporary password
    temp_password = SessionToken.generate_token()[:12]
    target_user.set_password(temp_password)
    db.session.commit()
    
    # In production, send email with temporary password
    
    return jsonify({
        'success': True,
        'message': 'Password reset email sent',
        'temporary_password': temp_password  # Remove in production
    }), 200
