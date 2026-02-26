# ============================================
# Authentication Routes
# ============================================

from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
from functools import wraps
import smtplib
import ssl
import random
import threading
import hashlib
from email.message import EmailMessage

try:
    from models import db, User, SessionToken, ChatbotParticipant, Chatbot
except ImportError:
    from backend.models import db, User, SessionToken, ChatbotParticipant, Chatbot

auth_bp = Blueprint('auth', __name__)

OTP_EXPIRY_MINUTES = 10
OTP_RESEND_COOLDOWN_SECONDS = 60
OTP_MAX_ATTEMPTS = 5
_FORGOT_PASSWORD_OTP_STORE = {}
_FORGOT_PASSWORD_OTP_LOCK = threading.Lock()


def _otp_store_key(username, email):
    return f"{(username or '').strip().lower()}|{(email or '').strip().lower()}"


def _hash_otp(otp):
    secret = str(current_app.config.get('SECRET_KEY') or '')
    raw = f"{otp}:{secret}".encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def _cleanup_expired_otp_records(now=None):
    now = now or datetime.utcnow()
    expired_keys = []

    for key, record in _FORGOT_PASSWORD_OTP_STORE.items():
        if record.get('expires_at') and record['expires_at'] <= now:
            expired_keys.append(key)

    for key in expired_keys:
        _FORGOT_PASSWORD_OTP_STORE.pop(key, None)


def send_forgot_password_otp_email(recipient_email, name, otp_code):
    mail_server = current_app.config.get('MAIL_SERVER')
    mail_port = current_app.config.get('MAIL_PORT', 587)
    mail_username = current_app.config.get('MAIL_USERNAME')
    mail_password = current_app.config.get('MAIL_PASSWORD')
    mail_sender = current_app.config.get('MAIL_DEFAULT_SENDER') or mail_username or 'noreply@localhost'
    use_tls = current_app.config.get('MAIL_USE_TLS', True)
    use_ssl = current_app.config.get('MAIL_USE_SSL', False)

    if not mail_server:
        return False, 'MAIL_SERVER is not configured'

    msg = EmailMessage()
    msg['Subject'] = 'ConvergeAI Password Reset OTP'
    msg['From'] = mail_sender
    msg['To'] = recipient_email
    msg.set_content(
        (
            f"Hello {name},\n\n"
            "We received a request to reset your password.\n\n"
            f"Your OTP code is: {otp_code}\n"
            f"This code expires in {OTP_EXPIRY_MINUTES} minutes.\n\n"
            "If you did not request this, please ignore this email.\n\n"
            "Regards,\nConvergeAI Team"
        )
    )

    try:
        if use_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(mail_server, mail_port, context=context, timeout=20) as server:
                if mail_username:
                    server.login(mail_username, mail_password or '')
                server.send_message(msg)
        else:
            with smtplib.SMTP(mail_server, mail_port, timeout=20) as server:
                if use_tls:
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                if mail_username:
                    server.login(mail_username, mail_password or '')
                server.send_message(msg)
        return True, None
    except Exception as exc:
        return False, str(exc)


def send_reset_password_email(recipient_email, name, username, temp_password, event_names, admin_name):
    mail_server = current_app.config.get('MAIL_SERVER')
    mail_port = current_app.config.get('MAIL_PORT', 587)
    mail_username = current_app.config.get('MAIL_USERNAME')
    mail_password = current_app.config.get('MAIL_PASSWORD')
    mail_sender = current_app.config.get('MAIL_DEFAULT_SENDER') or mail_username or 'noreply@localhost'
    use_tls = current_app.config.get('MAIL_USE_TLS', True)
    use_ssl = current_app.config.get('MAIL_USE_SSL', False)

    if not mail_server:
        return False, 'MAIL_SERVER is not configured'

    msg = EmailMessage()
    msg['Subject'] = 'Your ConvergeAI Password Has Been Reset'
    msg['From'] = mail_sender
    msg['To'] = recipient_email

    events_text = ', '.join(event_names) if event_names else 'No event assigned yet'
    admin_label = admin_name or 'Admin'

    msg.set_content(
        (
            f"Hello {name},\n\n"
            "Your password has been reset by an administrator.\n\n"
            f"Username: {username}\n"
            f"Temporary Password: {temp_password}\n\n"
            f"Assigned Event(s): {events_text}\n"
            f"Reset by Admin: {admin_label}\n\n"
            "Important: Please login and update your password immediately.\n"
            "You may remember this temporary password only for first login, then change it.\n\n"
            "Regards,\nConvergeAI Admin"
        )
    )

    try:
        if use_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(mail_server, mail_port, context=context, timeout=20) as server:
                if mail_username:
                    server.login(mail_username, mail_password or '')
                server.send_message(msg)
        else:
            with smtplib.SMTP(mail_server, mail_port, timeout=20) as server:
                if use_tls:
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                if mail_username:
                    server.login(mail_username, mail_password or '')
                server.send_message(msg)
        return True, None
    except Exception as exc:
        return False, str(exc)

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
                print("DEBUG: Invalid token format")
                return jsonify({'success': False, 'message': 'Invalid token format'}), 401
        
        if not token:
            print("DEBUG: Token is missing")
            return jsonify({'success': False, 'message': 'Token is missing'}), 401
        
        user = SessionToken.verify_token(token)
        if not user:
            print(f"DEBUG: Token verification failed for token: {token[:10]}...")
            return jsonify({'success': False, 'message': 'Invalid or expired token'}), 401
        
        print(f"DEBUG: User authenticated: {user.username} ({user.role})")
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
    
    data = request.get_json() or {}
    login_id = (data.get('username') or '').strip()
    password = data.get('password')
    remember = bool(data.get('remember', False))
    
    if not login_id or password is None or password == '':
        return jsonify({'success': False, 'message': 'Username and password required'}), 400
    
    user = User.query.filter(
        (User.username.ilike(login_id)) | (User.email.ilike(login_id))
    ).first()
    
    if not user:
        return jsonify({
            'success': False, 
            'message': 'Username not found',
            'field': 'username'
        }), 401
    
    if not user.check_password(password):
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
    # Remember me: longer-lived token; otherwise shorter-lived session token
    expires_in_days = 30 if remember else 1
    token = SessionToken.create_token(user.id, expires_in_days=expires_in_days)
    
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
# Forgot Password (OTP)
# ============================================

@auth_bp.route('/forgot-password/request-otp', methods=['POST'])
def request_forgot_password_otp():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()

    if not username or not email:
        return jsonify({'success': False, 'message': 'Username and email are required'}), 400

    user = User.query.filter(User.username.ilike(username)).first()
    if not user or (user.email or '').strip().lower() != email:
        return jsonify({'success': False, 'message': 'Username and email do not match our records'}), 404

    now = datetime.utcnow()
    key = _otp_store_key(username, email)

    with _FORGOT_PASSWORD_OTP_LOCK:
        _cleanup_expired_otp_records(now)
        existing = _FORGOT_PASSWORD_OTP_STORE.get(key)
        if existing:
            resend_available_at = existing.get('resend_available_at')
            if resend_available_at and resend_available_at > now:
                wait_seconds = int((resend_available_at - now).total_seconds())
                return jsonify({
                    'success': False,
                    'message': f'Please wait {wait_seconds} seconds before requesting another OTP',
                    'wait_seconds': max(wait_seconds, 1)
                }), 429

    otp_code = f"{random.randint(0, 999999):06d}"
    email_sent, email_error = send_forgot_password_otp_email(
        recipient_email=user.email,
        name=user.name or user.username,
        otp_code=otp_code
    )

    if not email_sent:
        return jsonify({'success': False, 'message': f'Failed to send OTP email: {email_error}'}), 500

    with _FORGOT_PASSWORD_OTP_LOCK:
        _FORGOT_PASSWORD_OTP_STORE[key] = {
            'user_id': user.id,
            'otp_hash': _hash_otp(otp_code),
            'expires_at': now + timedelta(minutes=OTP_EXPIRY_MINUTES),
            'resend_available_at': now + timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS),
            'attempts_left': OTP_MAX_ATTEMPTS
        }

    return jsonify({
        'success': True,
        'message': f'OTP sent to {user.email}',
        'expires_in_seconds': OTP_EXPIRY_MINUTES * 60,
        'resend_in_seconds': OTP_RESEND_COOLDOWN_SECONDS
    }), 200


@auth_bp.route('/forgot-password/reset', methods=['POST'])
def reset_password_with_otp():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    otp_code = (data.get('otp') or '').strip()
    new_password = data.get('new_password') or ''
    confirm_password = data.get('confirm_password') or ''

    if not username or not email or not otp_code or not new_password or not confirm_password:
        return jsonify({'success': False, 'message': 'All fields are required'}), 400

    if len(new_password) < 6:
        return jsonify({'success': False, 'message': 'New password must be at least 6 characters'}), 400

    if new_password != confirm_password:
        return jsonify({'success': False, 'message': 'New password and confirm password do not match'}), 400

    user = User.query.filter(User.username.ilike(username)).first()
    if not user or (user.email or '').strip().lower() != email:
        return jsonify({'success': False, 'message': 'Username and email do not match our records'}), 404

    now = datetime.utcnow()
    key = _otp_store_key(username, email)

    with _FORGOT_PASSWORD_OTP_LOCK:
        _cleanup_expired_otp_records(now)
        record = _FORGOT_PASSWORD_OTP_STORE.get(key)
        if not record:
            return jsonify({'success': False, 'message': 'OTP expired or not requested'}), 400

        if record.get('user_id') != user.id:
            return jsonify({'success': False, 'message': 'OTP validation failed'}), 400

        attempts_left = int(record.get('attempts_left', 0))
        if attempts_left <= 0:
            _FORGOT_PASSWORD_OTP_STORE.pop(key, None)
            return jsonify({'success': False, 'message': 'Too many invalid attempts. Request a new OTP'}), 429

        if record.get('otp_hash') != _hash_otp(otp_code):
            record['attempts_left'] = attempts_left - 1
            remaining = record['attempts_left']
            if remaining <= 0:
                _FORGOT_PASSWORD_OTP_STORE.pop(key, None)
                return jsonify({'success': False, 'message': 'Too many invalid attempts. Request a new OTP'}), 429

            return jsonify({
                'success': False,
                'message': 'Invalid OTP code',
                'attempts_left': remaining
            }), 400

        _FORGOT_PASSWORD_OTP_STORE.pop(key, None)

    user.set_password(new_password)
    SessionToken.query.filter_by(user_id=user.id).delete()
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Password reset successful. Please login with your new password.'
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
    temp_password = '123'
    target_user.set_password(temp_password)
    db.session.commit()

    assigned_events = (
        db.session.query(Chatbot.event_name)
        .join(ChatbotParticipant, ChatbotParticipant.chatbot_id == Chatbot.id)
        .filter(ChatbotParticipant.user_id == target_user.id)
        .distinct()
        .all()
    )
    event_names = [event_name for (event_name,) in assigned_events if event_name]

    email_sent, email_error = send_reset_password_email(
        recipient_email=target_user.email,
        name=target_user.name or target_user.username,
        username=target_user.username,
        temp_password=temp_password,
        event_names=event_names,
        admin_name=user.name or user.username
    )

    if email_sent:
        message = 'Password reset email sent'
    else:
        message = f'Password reset, but email failed: {email_error}'

    return jsonify({
        'success': True,
        'message': message,
        'email_sent': email_sent,
        'temporary_password': temp_password,  # Remove in production
        'username': target_user.username,
        'event_names': event_names,
        'reset_by': user.name or user.username
    }), 200
