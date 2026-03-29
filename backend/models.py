# ============================================
# Database Models
# ============================================

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import secrets

db = SQLAlchemy()

# ============================================
# User Model
# ============================================

class User(db.Model):
    """User model for authentication and authorization"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    whatsapp_number = db.Column(db.String(20), index=True)
    role = db.Column(db.String(50), default='user', nullable=False)  # admin, user, speaker, volunteer
    active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    # Relationships
    chatbots = db.relationship('Chatbot', backref='creator', lazy=True, foreign_keys='Chatbot.created_by_id')
    messages = db.relationship('Message', backref='user', lazy=True, cascade='all, delete-orphan')
    conversations = db.relationship('Conversation', backref='user', lazy=True, cascade='all, delete-orphan')
    guests = db.relationship('Guest', backref='user', lazy=True, cascade='all, delete-orphan')
    login_otps = db.relationship('LoginOTP', backref='user', lazy=True, cascade='all, delete-orphan')
    whatsapp_send_history = db.relationship('WhatsAppSendHistory', backref='user', lazy=True)
    drive_image_backups = db.relationship('DriveImageBackup', backref='user', lazy=True)
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Verify password"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'name': self.name,
            'whatsapp_number': self.whatsapp_number,
            'role': self.role,
            'active': self.active,
            'created_at': self.created_at.isoformat(),
        }

# ============================================
# Chatbot Model
# ============================================

class Chatbot(db.Model):
    """Chatbot model for event chatbots"""
    __tablename__ = 'chatbots'
    INFINITE_END_DATE = datetime(9999, 12, 31).date()
    DEFAULT_SINGLE_PERSON_PROMPT = (
        'Generate a high-quality professional portrait image of the guest.\n\n'
        'Details:\n'
        '- Focus on one person only.\n'
        '- Center the person in the frame.\n'
        '- Do not change the user image.\n'
        '- Use the given background image.\n'
        '- Maintain realistic facial features.\n'
        '- Proper lighting and sharp focus.\n'
        '- Business or formal attire.\n'
        '- No extra people in the frame.\n'
        '- No distortion or overlapping elements.\n'
        '- Professional conference vibe.'
    )
    DEFAULT_MULTIPLE_PERSON_PROMPT = (
        'Generate a professional group image of multiple guests.\n\n'
        'Requirements:\n'
        '- Include all selected guests in one frame.\n'
        '- Arrange them naturally in a group.\n'
        '- Maintain correct proportions for each person.\n'
        '- Ensure no unnatural gaps between group members.\n'
        '- If people are close together, blend them naturally without visual separation.\n'
        '- Avoid cutting faces or overlapping distortions.\n'
        '- Use the given background image.\n'
        '- Maintain uniform lighting and perspective.\n'
        '- Make the group appear cohesive and professionally composed.'
    )
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    event_name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    
    # Dates
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False, default=INFINITE_END_DATE)
    
    # AI Configuration
    system_prompt = db.Column(db.Text, nullable=False)
    single_person_prompt = db.Column(db.Text, nullable=False, default=DEFAULT_SINGLE_PERSON_PROMPT)
    multiple_person_prompt = db.Column(db.Text, nullable=False, default=DEFAULT_MULTIPLE_PERSON_PROMPT)
    gemini_api_key = db.Column(db.String(255))
    
    # Media
    background_image = db.Column(db.String(255))
    drive_folder_id = db.Column(db.String(255), index=True)
    
    # Settings
    public = db.Column(db.Boolean, default=True)
    active = db.Column(db.Boolean, default=True)
    allow_previous_year_users = db.Column(db.Boolean, default=False, nullable=False)
    
    # Admin tracking
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    guests = db.relationship('Guest', backref='chatbot', lazy=True, cascade='all, delete-orphan')
    messages = db.relationship('Message', backref='chatbot', lazy=True, cascade='all, delete-orphan')
    conversations = db.relationship('Conversation', backref='chatbot', lazy=True, cascade='all, delete-orphan')
    participants = db.relationship('ChatbotParticipant', backref='chatbot', lazy=True, cascade='all, delete-orphan')
    drive_image_backups = db.relationship('DriveImageBackup', backref='chatbot', lazy=True, cascade='all, delete-orphan')
    
    @property
    def status(self):
        """Get chatbot status"""
        today = datetime.now().date()
        if today < self.start_date:
            return 'pending'
        elif self.end_date and self.end_date != self.INFINITE_END_DATE and today > self.end_date:
            return 'expired'
        else:
            return 'active'

    @property
    def is_infinite_end_date(self):
        """Whether chatbot has no explicit end date."""
        return self.end_date == self.INFINITE_END_DATE
    
    @property
    def days_until_event(self):
        """Calculate days until event"""
        delta = self.start_date - datetime.now().date()
        return delta.days

    @property
    def event_year(self):
        """Calendar year used for participant access policy."""
        if self.start_date:
            return int(self.start_date.year)
        return None
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'event_name': self.event_name,
            'description': self.description,
            'event_year': self.event_year,
            'start_date': self.start_date.isoformat(),
            'end_date': None if self.is_infinite_end_date else self.end_date.isoformat(),
            'has_infinite_end_date': self.is_infinite_end_date,
            'status': self.status,
            'active': self.active,
            'allow_previous_year_users': bool(self.allow_previous_year_users),
            'system_prompt': self.system_prompt,
            'single_person_prompt': self.single_person_prompt,
            'multiple_person_prompt': self.multiple_person_prompt,
            'gemini_api_key': self.gemini_api_key,
            'background_image': self.background_image,
            'drive_folder_id': self.drive_folder_id,
            'guests_count': len(self.guests),
            'participants_count': len(self.participants),
            'messages_count': len(self.messages),
            'created_at': self.created_at.isoformat(),
        }

# ============================================
# Guest Model
# ============================================

class Guest(db.Model):
    """Guest/Expert model for chatbots"""
    __tablename__ = 'guests'
    
    id = db.Column(db.Integer, primary_key=True)
    chatbot_id = db.Column(db.Integer, db.ForeignKey('chatbots.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    name = db.Column(db.String(255), nullable=False)
    photo = db.Column(db.String(255))
    active = db.Column(db.Boolean, default=True, nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'chatbot_id': self.chatbot_id,
            'name': self.name,
            'photo': self.photo,
            'active': self.active,
        }
        
        # Include chatbot event name and status if available
        if self.chatbot:
            data['event_name'] = self.chatbot.event_name
            data['chatbot_name'] = self.chatbot.name
            data['chatbot_active'] = self.chatbot.active
        
        return data

# ============================================
# Conversation Model
# ============================================

class Conversation(db.Model):
    """Per-user conversation history for a chatbot."""
    __tablename__ = 'conversations'

    id = db.Column(db.Integer, primary_key=True)
    chatbot_id = db.Column(db.Integer, db.ForeignKey('chatbots.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False, default='New chat')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    messages = db.relationship('Message', backref='conversation', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'chatbot_id': self.chatbot_id,
            'user_id': self.user_id,
            'title': self.title,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

# ============================================
# Message Model
# ============================================

class Message(db.Model):
    """Chat message model"""
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    chatbot_id = db.Column(db.Integer, db.ForeignKey('chatbots.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=True, index=True)
    
    content = db.Column(db.Text, nullable=True)
    is_user_message = db.Column(db.Boolean, default=True)
    message_type = db.Column(db.String(32), nullable=False, default='text')
    image_url = db.Column(db.String(512), nullable=True)  # For bot-generated or attached images
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        """Convert to dictionary"""
        result = {
            'id': self.id,
            'content': self.content,
            'sender': 'user' if self.is_user_message else 'bot',
            'message_type': self.message_type or 'text',
            'timestamp': self.created_at.isoformat(),
            'conversation_id': self.conversation_id,
            'user': self.user.to_dict() if self.user else None,
        }
        if self.image_url:
            result['image_url'] = self.image_url
        return result

# ============================================
# Chatbot Participant Model
# ============================================

class ChatbotParticipant(db.Model):
    """Track which users have joined which chatbots"""
    __tablename__ = 'chatbot_participants'
    
    id = db.Column(db.Integer, primary_key=True)
    chatbot_id = db.Column(db.Integer, db.ForeignKey('chatbots.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_active = db.Column(db.DateTime, default=datetime.utcnow)
    message_count = db.Column(db.Integer, default=0)
    
    __table_args__ = (db.UniqueConstraint('chatbot_id', 'user_id', name='unique_participant'),)

# ============================================
# Session Token Model (for API authentication)
# ============================================

class SessionToken(db.Model):
    """API session tokens"""
    __tablename__ = 'session_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    token = db.Column(db.String(255), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    user = db.relationship('User', backref=db.backref('tokens', lazy=True))
    
    @staticmethod
    def generate_token():
        """Generate a secure token"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def create_token(user_id, expires_in_days=30):
        """Create a new session token"""
        token = SessionToken.generate_token()
        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
        
        session = SessionToken(
            user_id=user_id,
            token=token,
            expires_at=expires_at
        )
        db.session.add(session)
        db.session.commit()
        
        return token
    
    @staticmethod
    def verify_token(token):
        """Verify a token and return user if valid"""
        session = SessionToken.query.filter_by(token=token).first()
        
        if not session:
            return None
        
        if session.expires_at < datetime.utcnow():
            db.session.delete(session)
            db.session.commit()
            return None
        
        return session.user


# ============================================
# Login OTP Model
# ============================================

class LoginOTP(db.Model):
    """OTP records for username + WhatsApp OTP login flow."""
    __tablename__ = 'login_otps'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    username = db.Column(db.String(120), nullable=False, index=True)
    whatsapp_number = db.Column(db.String(20), nullable=False, index=True)
    otp_code = db.Column(db.String(12), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)
    is_used = db.Column(db.Boolean, default=False, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.username,
            'whatsapp_number': self.whatsapp_number,
            'otp_code': self.otp_code,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_used': self.is_used,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ============================================
# WhatsApp Send History Model
# ============================================

class WhatsAppSendHistory(db.Model):
    """Track outbound WhatsApp sends and inbound webhook status events."""
    __tablename__ = 'whatsapp_send_history'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    whatsapp_number = db.Column(db.String(32), nullable=False, index=True)
    image_url = db.Column(db.String(1024))
    status = db.Column(db.String(100), nullable=False, index=True)
    provider_message_id = db.Column(db.String(255), index=True)
    response_payload = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'whatsapp_number': self.whatsapp_number,
            'image_url': self.image_url,
            'status': self.status,
            'provider_message_id': self.provider_message_id,
            'response_payload': self.response_payload,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ============================================
# Drive Image Backup Model
# ============================================

class DriveImageBackup(db.Model):
    """Track generated image backups stored on Google Drive."""
    __tablename__ = 'drive_image_backups'

    id = db.Column(db.Integer, primary_key=True)
    chatbot_id = db.Column(db.Integer, db.ForeignKey('chatbots.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    image_path = db.Column(db.String(1024), nullable=False)
    drive_file_id = db.Column(db.String(255), nullable=False, index=True)
    drive_folder_id = db.Column(db.String(255), nullable=False, index=True)
    drive_link = db.Column(db.String(1024), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'chatbot_id': self.chatbot_id,
            'user_id': self.user_id,
            'image_path': self.image_path,
            'drive_file_id': self.drive_file_id,
            'drive_folder_id': self.drive_folder_id,
            'drive_link': self.drive_link,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ============================================
# User Google Token Model
# ============================================

class UserGoogleToken(db.Model):
    """Store per-user Google OAuth tokens for Drive uploads."""
    __tablename__ = 'user_google_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True, index=True)
    access_token = db.Column(db.Text, nullable=False)
    refresh_token = db.Column(db.Text, nullable=True)
    token_expiry = db.Column(db.DateTime, nullable=True, index=True)
    scope = db.Column(db.String(512), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def is_access_token_valid(self, buffer_seconds=60):
        if not self.access_token:
            return False
        if not self.token_expiry:
            return True
        return self.token_expiry > (datetime.utcnow() + timedelta(seconds=max(int(buffer_seconds or 0), 0)))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'connected': bool(self.access_token),
            'scope': self.scope,
            'token_expiry': self.token_expiry.isoformat() if self.token_expiry else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
