# ============================================
# Admin Routes
# ============================================

from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
from openpyxl import load_workbook
from io import BytesIO
from sqlalchemy import or_
import re
import smtplib
import ssl
from email.message import EmailMessage
import threading

try:
    from models import db, User, Chatbot, Guest, Message, SessionToken, ChatbotParticipant, AdminNotification
    from routes.auth import token_required, admin_required
except ImportError:
    from backend.models import db, User, Chatbot, Guest, Message, SessionToken, ChatbotParticipant, AdminNotification
    from backend.routes.auth import token_required, admin_required

admin_bp = Blueprint('admin', __name__)
EMAIL_REGEX = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')
NOTIFICATION_RETENTION_DAYS = 7


def purge_old_notifications():
    cutoff = datetime.utcnow() - timedelta(days=NOTIFICATION_RETENTION_DAYS)
    AdminNotification.query.filter(AdminNotification.created_at < cutoff).delete(synchronize_session=False)


def create_admin_notification(title, message, entity_type='system', entity_id=None):
    purge_old_notifications()
    notification = AdminNotification(
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
        is_read=False
    )
    db.session.add(notification)


def is_valid_email(email):
    return bool(email and EMAIL_REGEX.match(email))


def send_user_credentials_email(recipient_email, name, role, username, password):
    """Send credentials email synchronously"""
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
    msg['Subject'] = 'Your ConvergeAI Account Credentials'
    msg['From'] = mail_sender
    msg['To'] = recipient_email
    msg.set_content(
        (
            f"Hello {name},\n\n"
            "Your account has been created in ConvergeAI.\n\n"
            f"Role: {role}\n"
            f"Username: {username}\n"
            f"Password: {password}\n\n"
            "Please login and change your password after first login.\n\n"
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


def send_email_background(app, recipient_email, name, role, username, password):
    """Send email in background thread with app context"""
    with app.app_context():
        try:
            send_user_credentials_email(recipient_email, name, role, username, password)
        except Exception as e:
            # Log error but don't crash the thread
            print(f"Background email failed for {recipient_email}: {str(e)}")


def send_bulk_emails_background(app, credentials_list):
    """Send multiple emails in background thread with app context"""
    with app.app_context():
        for cred in credentials_list:
            try:
                send_user_credentials_email(
                    recipient_email=cred['email'],
                    name=cred['name'],
                    role=cred['role'],
                    username=cred['username'],
                    password=cred['password']
                )
            except Exception as e:
                print(f"Background email failed for {cred['email']}: {str(e)}")

# ============================================
# Dashboard Statistics
# ============================================

@admin_bp.route('/dashboard/stats', methods=['GET'])
@token_required
@admin_required
def get_stats(user):
    """Get dashboard statistics"""
    now = datetime.now()
    first_day_of_month = datetime(now.year, now.month, 1)
    
    stats = {
        'total_chatbots': Chatbot.query.count(),
        'active_chatbots': Chatbot.query.filter_by(active=True).count(),
        'total_guests': Guest.query.count(),
        'total_users': User.query.count(),
        'active_users': User.query.filter_by(active=True).count(),
        'new_users_this_month': User.query.filter(User.created_at >= first_day_of_month).count(),
        'total_messages': Message.query.count(),
        'upcoming_events': Chatbot.query.filter(Chatbot.start_date > datetime.now().date()).count(),
    }
    
    return jsonify({
        'success': True,
        'data': stats
    }), 200


@admin_bp.route('/notifications', methods=['GET'])
@token_required
@admin_required
def get_notifications(user):
    """Get recent admin notifications (retained for 7 days)."""
    limit = request.args.get('limit', 50, type=int)
    safe_limit = max(1, min(limit, 100))

    purge_old_notifications()
    db.session.commit()

    notifications = AdminNotification.query.order_by(
        AdminNotification.created_at.desc(),
        AdminNotification.id.desc()
    ).limit(safe_limit).all()

    unread_count = AdminNotification.query.filter_by(is_read=False).count()

    return jsonify({
        'success': True,
        'data': [item.to_dict() for item in notifications],
        'unread_count': unread_count
    }), 200


@admin_bp.route('/notifications/read', methods=['PUT'])
@token_required
@admin_required
def mark_notifications_read(user):
    """Mark all notifications as read when admin opens notification list."""
    unread_notifications = AdminNotification.query.filter_by(is_read=False).all()
    read_at = datetime.utcnow()

    for item in unread_notifications:
        item.is_read = True
        item.read_at = read_at

    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Notifications marked as read',
        'updated': len(unread_notifications)
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
    search = (request.args.get('search') or '').strip()
    
    query = User.query.order_by(User.created_at.desc(), User.id.desc())
    
    if role:
        query = query.filter_by(role=role)
    
    if active is not None:
        active_bool = active.lower() == 'true'
        query = query.filter_by(active=active_bool)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                User.name.ilike(search_pattern),
                User.username.ilike(search_pattern)
            )
        )
    
    paginated = query.paginate(page=page, per_page=per_page)
    
    # Include chatbot associations for each user
    users_data = []
    for u in paginated.items:
        user_dict = u.to_dict()
        # Get chatbots this user is associated with
        participants = ChatbotParticipant.query.filter_by(user_id=u.id).all()
        chatbot_data = []
        for participant in participants:
            chatbot = Chatbot.query.get(participant.chatbot_id)
            if chatbot:
                chatbot_data.append({
                    'id': chatbot.id,
                    'name': chatbot.name,
                    'event_name': chatbot.event_name
                })
        user_dict['chatbots'] = chatbot_data
        users_data.append(user_dict)
    
    return jsonify({
        'success': True,
        'data': users_data,
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page
    }), 200

@admin_bp.route('/users', methods=['POST'])
@token_required
@admin_required
def create_user(user):
    """Create a single user from admin panel"""

    data = request.get_json() or {}

    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    role = (data.get('role') or 'user').strip().lower()
    active_raw = data.get('active', True)

    if not name or not email or not username or not password:
        return jsonify({'success': False, 'message': 'name, email, username, and password are required'}), 400

    if not is_valid_email(email):
        return jsonify({'success': False, 'message': 'Invalid email format'}), 400

    if role not in ['admin', 'user', 'speaker']:
        return jsonify({'success': False, 'message': 'Invalid role'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'Email already exists'}), 409

    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'message': 'Username already exists'}), 409

    active = str(active_raw).strip().lower() in ['1', 'true', 'yes', 'y'] if isinstance(active_raw, str) else bool(active_raw)

    new_user = User(
        name=name,
        email=email,
        username=username,
        role=role,
        active=active
    )
    new_user.set_password(password)

    db.session.add(new_user)
    db.session.commit()

    # Associate user with chatbots if provided
    chatbot_ids = data.get('chatbot_ids', [])
    if chatbot_ids and isinstance(chatbot_ids, list):
        for chatbot_id in chatbot_ids:
            # Verify chatbot exists
            chatbot = Chatbot.query.get(chatbot_id)
            if chatbot:
                # Check if already a participant
                existing = ChatbotParticipant.query.filter_by(
                    chatbot_id=chatbot_id,
                    user_id=new_user.id
                ).first()
                
                if not existing:
                    participant = ChatbotParticipant(
                        chatbot_id=chatbot_id,
                        user_id=new_user.id
                    )
                    db.session.add(participant)
        
        db.session.commit()

    # Send email in background thread so admin doesn't wait
    app = current_app._get_current_object()
    thread = threading.Thread(
        target=send_email_background,
        args=(app, email, name, role, username, password)
    )
    thread.daemon = True
    thread.start()

    assigned_count = len(chatbot_ids) if chatbot_ids else 0
    create_admin_notification(
        title='New user created',
        message=f'{name} ({username}) was created with role {role}.',
        entity_type='user',
        entity_id=new_user.id
    )
    db.session.commit()

    message = f'User created successfully and assigned to {assigned_count} event(s)! Credentials email is being sent.' if assigned_count > 0 else 'User created successfully! Credentials email is being sent.'

    return jsonify({
        'success': True,
        'message': message,
        'data': new_user.to_dict(),
        'chatbots_assigned': assigned_count
    }), 201

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
    
    # Delete all session tokens for this user first
    SessionToken.query.filter_by(user_id=user_id).delete()

    # Remove participant links so chatbot participant counts stay accurate
    ChatbotParticipant.query.filter_by(user_id=user_id).delete()
    
    # Now delete the user
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

    # Keep participant counts accurate by removing orphan participant rows
    # (can exist if users were deleted earlier without participant cleanup).
    ChatbotParticipant.query.filter(
        ~ChatbotParticipant.user_id.in_(db.session.query(User.id))
    ).delete(synchronize_session=False)
    db.session.commit()
    
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
        description=data.get('description')
    )
    
    db.session.add(guest)
    db.session.flush()
    create_admin_notification(
        title='New guest added',
        message=f'{guest.name} was added to "{chatbot.name}".',
        entity_type='guest',
        entity_id=guest.id
    )
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Guest added successfully',
        'data': guest.to_dict()
    }), 201

@admin_bp.route('/guests', methods=['GET'])
@token_required
@admin_required
def list_all_guests(user):
    """List all guests across all chatbots"""
    
    guests = Guest.query.all()
    
    return jsonify({
        'success': True,
        'data': [guest.to_dict() for guest in guests],
        'count': len(guests)
    }), 200


@admin_bp.route('/guests', methods=['POST'])
@token_required
@admin_required
def create_guest(user):
    """Create a new guest"""
    
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'success': False, 'message': 'Guest name is required'}), 400
    
    guest = Guest(
        chatbot_id=data.get('chatbot_id'),
        name=data.get('name'),
        title=data.get('title'),
        description=data.get('description')
    )
    
    db.session.add(guest)
    db.session.flush()
    create_admin_notification(
        title='New guest added',
        message=f'{guest.name} was added as a guest.',
        entity_type='guest',
        entity_id=guest.id
    )
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Guest created successfully',
        'data': guest.to_dict()
    }), 201



@admin_bp.route('/guests/<int:guest_id>', methods=['GET'])
@token_required
@admin_required
def get_guest(user, guest_id):
    """Get a single guest"""
    
    guest = Guest.query.get(guest_id)
    
    if not guest:
        return jsonify({'success': False, 'message': 'Guest not found'}), 404
    
    return jsonify({
        'success': True,
        'data': guest.to_dict()
    }), 200


@admin_bp.route('/guests/<int:guest_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_guest(user, guest_id):
    """Delete a guest"""
    
    guest = Guest.query.get(guest_id)
    
    if not guest:
        return jsonify({'success': False, 'message': 'Guest not found'}), 404
    
    db.session.delete(guest)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Guest deleted successfully'
    }), 200


@admin_bp.route('/guests/<int:guest_id>', methods=['PUT'])
@token_required
@admin_required
def update_guest(user, guest_id):
    """Update a guest"""
    
    guest = Guest.query.get(guest_id)
    
    if not guest:
        return jsonify({'success': False, 'message': 'Guest not found'}), 404
    
    data = request.get_json()
    
    if 'name' in data:
        guest.name = data['name']
    if 'title' in data:
        guest.title = data['title']
    if 'description' in data:
        guest.description = data['description']
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Guest updated successfully',
        'data': guest.to_dict()
    }), 200

# ============================================
# Import Users
# ============================================

@admin_bp.route('/import/excel/preview', methods=['POST'])
@token_required
@admin_required
def preview_users_from_excel(user):
    """Preview users from Excel file without saving to DB"""

    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file provided'}), 400

    file = request.files['file']

    if not file.filename.endswith('.xlsx'):
        return jsonify({'success': False, 'message': 'Only .xlsx files are allowed'}), 400

    try:
        workbook = load_workbook(filename=BytesIO(file.read()), data_only=True)
        sheet = workbook.active

        rows = list(sheet.iter_rows(values_only=True))
        if len(rows) < 2:
            return jsonify({'success': False, 'message': 'Excel file has no data rows'}), 400

        headers = [str(cell).strip().lower() if cell is not None else '' for cell in rows[0]]
        header_map = {name: idx for idx, name in enumerate(headers) if name}

        def get_value(row, keys, default=''):
            for key in keys:
                index = header_map.get(key)
                if index is not None and index < len(row):
                    value = row[index]
                    if value is not None:
                        return str(value).strip()
            return default

        total_rows = 0
        valid_rows = 0
        skipped_rows = 0
        duplicate_email_rows = 0
        invalid_email_rows = 0

        for row in rows[1:]:
            if row is None or all(cell is None or str(cell).strip() == '' for cell in row):
                continue

            total_rows += 1

            name = get_value(row, ['name', 'full_name', 'fullname'])
            email = get_value(row, ['email', 'mail']).lower()

            if not name or not email:
                skipped_rows += 1
                continue

            if not is_valid_email(email):
                invalid_email_rows += 1
                skipped_rows += 1
                continue

            if User.query.filter_by(email=email).first() is not None:
                duplicate_email_rows += 1
                skipped_rows += 1
                continue

            valid_rows += 1

        return jsonify({
            'success': True,
            'message': 'Preview generated successfully',
            'preview': {
                'total_rows': total_rows,
                'valid_rows': valid_rows,
                'skipped_rows': skipped_rows,
                'duplicate_email_rows': duplicate_email_rows,
                'invalid_email_rows': invalid_email_rows
            }
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Preview failed: {str(e)}'
        }), 400

@admin_bp.route('/import/excel', methods=['POST'])
@token_required
@admin_required
def import_users_from_excel(user):
    """Import users from Excel file"""
    
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file provided'}), 400
    
    file = request.files['file']
    event_id = request.form.get('event_id')  # Get selected event/chatbot ID
    
    if not file.filename.endswith('.xlsx'):
        return jsonify({'success': False, 'message': 'Only .xlsx files are allowed'}), 400
    
    # Validate event_id if provided
    chatbot = None
    if event_id:
        try:
            chatbot = Chatbot.query.get(int(event_id))
            if not chatbot:
                return jsonify({'success': False, 'message': 'Selected event/chatbot not found'}), 404
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid event ID'}), 400
    
    try:
        workbook = load_workbook(filename=BytesIO(file.read()), data_only=True)
        sheet = workbook.active

        rows = list(sheet.iter_rows(values_only=True))
        if len(rows) < 2:
            return jsonify({'success': False, 'message': 'Excel file has no data rows'}), 400

        headers = [str(cell).strip().lower() if cell is not None else '' for cell in rows[0]]
        header_map = {name: idx for idx, name in enumerate(headers) if name}

        def get_value(row, keys, default=''):
            for key in keys:
                index = header_map.get(key)
                if index is not None and index < len(row):
                    value = row[index]
                    if value is not None:
                        return str(value).strip()
            return default

        def parse_bool(value, default=True):
            if value is None or value == '':
                return default
            return str(value).strip().lower() in ['1', 'true', 'yes', 'y', 'active']

        def normalize_username(raw_username, email):
            base = (raw_username or '').strip()
            if not base:
                base = (email.split('@')[0] if '@' in email else email).strip()
            base = re.sub(r'[^a-zA-Z0-9._-]', '_', base)
            base = base or 'user'
            candidate = base
            suffix = 1
            while User.query.filter_by(username=candidate).first() is not None:
                candidate = f"{base}_{suffix}"
                suffix += 1
            return candidate

        credentials = []
        skipped = 0

        for row in rows[1:]:
            if row is None or all(cell is None or str(cell).strip() == '' for cell in row):
                continue

            name = get_value(row, ['name', 'full_name', 'fullname'])
            email = get_value(row, ['email', 'mail']).lower()
            role = get_value(row, ['role', 'user_role'], 'user').lower()
            raw_username = get_value(row, ['username', 'user_name'])
            password = get_value(row, ['password', 'pass'])
            active_value = get_value(row, ['active', 'is_active'], '')

            if not name or not email:
                skipped += 1
                continue

            if role not in ['admin', 'user', 'speaker']:
                role = 'user'

            if User.query.filter_by(email=email).first() is not None:
                skipped += 1
                continue

            username = normalize_username(raw_username, email)
            if not password:
                password = SessionToken.generate_token()[:12]

            new_user = User(
                name=name,
                email=email,
                username=username,
                role=role,
                active=parse_bool(active_value, True)
            )
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.flush()  # Get the user ID
            
            # Associate user with the selected chatbot/event
            if chatbot:
                existing_participant = ChatbotParticipant.query.filter_by(
                    chatbot_id=chatbot.id,
                    user_id=new_user.id
                ).first()
                
                if not existing_participant:
                    participant = ChatbotParticipant(
                        chatbot_id=chatbot.id,
                        user_id=new_user.id
                    )
                    db.session.add(participant)


            credentials.append({
                'name': name,
                'role': role,
                'username': username,
                'password': password,
                'email': email
            })

        if not credentials:
            db.session.rollback()
            return jsonify({'success': False, 'message': 'No valid users imported (check required columns and duplicates)'}), 400

        db.session.commit()

        event_name = chatbot.event_name if chatbot else 'None'
        create_admin_notification(
            title='Users imported',
            message=f'{len(credentials)} users imported from Excel for event "{event_name}".',
            entity_type='import',
            entity_id=chatbot.id if chatbot else None
        )
        db.session.commit()

        # Send all emails in background thread so admin doesn't wait
        app = current_app._get_current_object()
        thread = threading.Thread(
            target=send_bulk_emails_background,
            args=(app, credentials)
        )
        thread.daemon = True
        thread.start()

        return jsonify({
            'success': True,
            'message': f'Users imported successfully and assigned to event "{event_name}"! Credentials emails are being sent to {len(credentials)} users.',
            'count': len(credentials),
            'skipped': skipped,
            'event_name': event_name,
            'credentials': credentials
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Import failed: {str(e)}'
        }), 400
