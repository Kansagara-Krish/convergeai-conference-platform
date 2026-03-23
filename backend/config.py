# ============================================
# Flask Application Configuration
# ============================================

import os
from datetime import timedelta


def _build_database_uri():
    """Return normalized SQLAlchemy DB URI from environment."""
    database_url = os.environ.get(
        'DATABASE_URL',
        'postgresql+psycopg2://username:password@localhost:5432/database_name'
    )

    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql+psycopg2://', 1)

    return database_url


def _validate_production_env():
    """Ensure required environment variables are set for production."""
    missing = []

    if not os.environ.get('DATABASE_URL'):
        missing.append('DATABASE_URL')

    secret_key = os.environ.get('SECRET_KEY')
    if not secret_key or secret_key == 'your-secret-key-change-in-production':
        missing.append('SECRET_KEY')

    jwt_secret = os.environ.get('JWT_SECRET_KEY')
    if not jwt_secret or jwt_secret == 'jwt-secret-key':
        missing.append('JWT_SECRET_KEY')

    if missing:
        raise RuntimeError(
            f"Missing required production environment variables: {', '.join(missing)}"
        )

class Config:
    """Base configuration"""
    # Flask
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-change-in-production'
    DEBUG = False
    TESTING = False
    
    # Database
    SQLALCHEMY_DATABASE_URI = _build_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'pool_size': int(os.environ.get('DB_POOL_SIZE', 10)),
        'max_overflow': int(os.environ.get('DB_MAX_OVERFLOW', 20)),
        'pool_timeout': int(os.environ.get('DB_POOL_TIMEOUT', 30)),
    }
    
    # Session
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # JWT
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-secret-key'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=30)
    
    # Upload
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
    UPLOAD_FOLDER = 'uploads'
    ALLOWED_EXTENSIONS = {'xlsx', 'csv', 'png', 'jpg', 'jpeg', 'gif', 'pdf'}

    # Email (SMTP)
    MAIL_SERVER = os.environ.get('MAIL_SERVER') or os.environ.get('SMTP_SERVER', '')
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or os.environ.get('SMTP_PORT', 587))
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME') or os.environ.get('SMTP_USERNAME', '')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD') or os.environ.get('SMTP_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER') or os.environ.get('SMTP_FROM_EMAIL') or MAIL_USERNAME or 'noreply@localhost'
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() == 'true'
    MAIL_USE_SSL = os.environ.get('MAIL_USE_SSL', 'false').lower() == 'true'

    # WhatsApp Cloud API
    WHATSAPP_ACCESS_TOKEN = os.environ.get('WHATSAPP_ACCESS_TOKEN', '')
    WHATSAPP_PHONE_NUMBER_ID = os.environ.get('WHATSAPP_PHONE_NUMBER_ID') or os.environ.get('PHONE_NUMBER_ID', '')
    WHATSAPP_VERIFY_TOKEN = os.environ.get('WHATSAPP_VERIFY_TOKEN') or os.environ.get('VERIFY_TOKEN', '')
    WHATSAPP_TEMPLATE_NAME = os.environ.get('WHATSAPP_TEMPLATE_NAME', '')
    WHATSAPP_TEMPLATE_LANGUAGE = os.environ.get('WHATSAPP_TEMPLATE_LANGUAGE', 'en')
    WHATSAPP_LOGIN_OTP_TEMPLATE_NAME = os.environ.get('WHATSAPP_LOGIN_OTP_TEMPLATE_NAME', '')
    WHATSAPP_LOGIN_OTP_TEMPLATE_LANGUAGE = os.environ.get('WHATSAPP_LOGIN_OTP_TEMPLATE_LANGUAGE', 'en')
    WHATSAPP_API_VERSION = os.environ.get('WHATSAPP_API_VERSION', 'v23.0')

    # Public base URL used when external providers need to fetch local media.
    PUBLIC_URL = os.environ.get('PUBLIC_URL', '')

    # Google Drive backup integration
    GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = os.environ.get('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON', '')
    GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE = os.environ.get('GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE', '')
    GOOGLE_DRIVE_OAUTH_ACCESS_TOKEN = os.environ.get('GOOGLE_DRIVE_OAUTH_ACCESS_TOKEN', '')
    GOOGLE_DRIVE_PREDEFINED_FOLDERS = os.environ.get('GOOGLE_DRIVE_PREDEFINED_FOLDERS', '[]')
    GOOGLE_DRIVE_ROOT_FOLDER_ID = os.environ.get('GOOGLE_DRIVE_ROOT_FOLDER_ID', '')
    GOOGLE_DRIVE_AUTO_CREATE_CHATBOT_FOLDER = os.environ.get('GOOGLE_DRIVE_AUTO_CREATE_CHATBOT_FOLDER', 'true').lower() == 'true'
    GOOGLE_DRIVE_SHARE_PUBLIC = os.environ.get('GOOGLE_DRIVE_SHARE_PUBLIC', 'false').lower() == 'true'

    # Google OAuth for per-user Drive access
    GOOGLE_OAUTH_CLIENT_ID = os.environ.get('GOOGLE_OAUTH_CLIENT_ID', '')
    GOOGLE_OAUTH_CLIENT_SECRET = os.environ.get('GOOGLE_OAUTH_CLIENT_SECRET', '')
    GOOGLE_OAUTH_REDIRECT_URI = os.environ.get('GOOGLE_OAUTH_REDIRECT_URI', '')

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    SESSION_COOKIE_SECURE = False

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    SESSION_COOKIE_SECURE = True
    PREFERRED_URL_SCHEME = 'https'

    @staticmethod
    def validate():
        _validate_production_env()

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False

# ============================================
# Environment-based config selection
# ============================================

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
