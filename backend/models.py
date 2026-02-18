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
    role = db.Column(db.String(50), default='user', nullable=False)  # admin, user, speaker
    active = db.Column(db.Boolean, default=True)
    
    # Profile information
    profile_picture = db.Column(db.String(255))
    bio = db.Column(db.Text)
    organization = db.Column(db.String(255))
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    # Relationships
    chatbots = db.relationship('Chatbot', backref='creator', lazy=True, foreign_keys='Chatbot.created_by_id')
    messages = db.relationship('Message', backref='user', lazy=True, cascade='all, delete-orphan')
    guests = db.relationship('Guest', backref='user', lazy=True, cascade='all, delete-orphan')
    
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
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    event_name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    
    # Dates
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    
    # AI Configuration
    system_prompt = db.Column(db.Text, nullable=False)
    single_mode = db.Column(db.Boolean, default=False)
    multiple_mode = db.Column(db.Boolean, default=True)
    
    # Media
    background_image = db.Column(db.String(255))
    logo = db.Column(db.String(255))
    
    # Settings
    public = db.Column(db.Boolean, default=True)
    active = db.Column(db.Boolean, default=True)
    
    # Admin tracking
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    guests = db.relationship('Guest', backref='chatbot', lazy=True, cascade='all, delete-orphan')
    messages = db.relationship('Message', backref='chatbot', lazy=True, cascade='all, delete-orphan')
    participants = db.relationship('ChatbotParticipant', backref='chatbot', lazy=True, cascade='all, delete-orphan')
    
    @property
    def status(self):
        """Get chatbot status"""
        today = datetime.now().date()
        if today < self.start_date:
            return 'pending'
        elif today > self.end_date:
            return 'expired'
        else:
            return 'active'
    
    @property
    def days_until_event(self):
        """Calculate days until event"""
        delta = self.start_date - datetime.now().date()
        return delta.days
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'event_name': self.event_name,
            'description': self.description,
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(),
            'status': self.status,
            'active': self.active,
            'system_prompt': self.system_prompt,
            'single_mode': self.single_mode,
            'multiple_mode': self.multiple_mode,
            'guests_count': len(self.guests),
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
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    photo = db.Column(db.String(255))
    organization = db.Column(db.String(255))
    email = db.Column(db.String(255))
    
    is_speaker = db.Column(db.Boolean, default=False)
    is_moderator = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'title': self.title,
            'description': self.description,
            'organization': self.organization,
            'is_speaker': self.is_speaker,
            'is_moderator': self.is_moderator,
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
    
    content = db.Column(db.Text, nullable=False)
    is_user_message = db.Column(db.Boolean, default=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'content': self.content,
            'sender': 'user' if self.is_user_message else 'bot',
            'timestamp': self.created_at.isoformat(),
            'user': self.user.to_dict() if self.user else None,
        }

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
