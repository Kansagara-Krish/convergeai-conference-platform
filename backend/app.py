# ============================================
# Flask Application Main File
# ============================================

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv
from sqlalchemy import inspect, text
import os
import sys
from datetime import datetime

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

try:
    from config import config
    from models import db
except ImportError:
    from backend.config import config
    from backend.models import db

# ============================================
# Application Factory
# ============================================

def create_app(config_name=None):
    """Create and configure Flask application"""
    
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    frontend_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), '..', 'frontend')
    )

    app = Flask(__name__)
    app.config.from_object(config.get(config_name, config['default']))

    if config_name == 'production':
        config['production'].validate()
    
    # Initialize extensions
    db.init_app(app)
    CORS(app, resources={r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        "allow_headers": ["Content-Type", "Authorization", "Accept"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False,
        "max_age": 3600
    }})
    Migrate(app, db, compare_type=True)
    
    # Register blueprints
    try:
        from routes.auth import auth_bp
        from routes.admin import admin_bp
        from routes.user import user_bp
        from routes.chatbot import chatbot_bp
        from routes.whatsapp import whatsapp_bp
        from routes.drive import drive_bp
        from routes.google_oauth import google_bp
    except ImportError:
        from backend.routes.auth import auth_bp
        from backend.routes.admin import admin_bp
        from backend.routes.user import user_bp
        from backend.routes.chatbot import chatbot_bp
        from backend.routes.whatsapp import whatsapp_bp
        from backend.routes.drive import drive_bp
        from backend.routes.google_oauth import google_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(user_bp, url_prefix='/api/user')
    app.register_blueprint(chatbot_bp, url_prefix='/api/chatbots')
    app.register_blueprint(whatsapp_bp, url_prefix='/api/whatsapp')
    app.register_blueprint(drive_bp, url_prefix='/api/drive')
    app.register_blueprint(google_bp, url_prefix='/api/google')
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'success': False,
            'message': 'Resource not found'
        }), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500
    
    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat()
        }), 200

    # Serve uploaded files (images, etc.)
    @app.route('/uploads/<path:filename>')
    def serve_uploads(filename):
        upload_folder = os.path.join(app.root_path, 'uploads')
        return send_from_directory(upload_folder, filename)
    
    # Serve generated images
    @app.route('/static/generated/<path:filename>')
    def serve_generated(filename):
        static_folder = os.path.join(app.root_path, 'static', 'generated')
        return send_from_directory(static_folder, filename)

    # Frontend routes
    @app.route('/')
    def serve_frontend_index():
        return send_from_directory(frontend_dir, 'index.html')

    @app.route('/<path:path>')
    def serve_frontend(path):
        if path.startswith('api/'):
            return jsonify({
                'success': False,
                'message': 'Resource not found'
            }), 404

        target_path = os.path.join(frontend_dir, path)
        if os.path.exists(target_path) and os.path.isfile(target_path):
            return send_from_directory(frontend_dir, path)

        return send_from_directory(frontend_dir, 'index.html')
    
    def ensure_chatbot_prompt_columns():
        inspector = inspect(db.engine)
        table_names = inspector.get_table_names()
        if 'chatbots' not in table_names:
            return

        columns = {column['name'] for column in inspector.get_columns('chatbots')}

        if 'single_person_prompt' not in columns:
            db.session.execute(text(
                """
                ALTER TABLE chatbots
                ADD COLUMN single_person_prompt TEXT NOT NULL
                DEFAULT 'Generate a high-quality professional portrait image of the guest.

Details:
- Focus on one person only.
- Center the person in the frame.
- Use a given background image
- Maintain realistic facial features.
- Proper lighting and sharp focus.
- Business or formal attire.
- No extra people in the frame.
- No distortion or overlapping elements.
- Professional conference vibe.'
                """
            ))

        if 'multiple_person_prompt' not in columns:
            db.session.execute(text(
                """
                ALTER TABLE chatbots
                ADD COLUMN multiple_person_prompt TEXT NOT NULL
                DEFAULT 'Generate a professional group image of multiple guests.

Requirements:
- Include all selected guests in one frame.
- Arrange them naturally in a group.
- Maintain correct proportions for each person.
- Ensure no unnatural gaps between group members.
- If people are close together, blend them naturally without visual separation.
- Avoid cutting faces or overlapping distortions.
- Use a conference or stage background.
- Maintain uniform lighting and perspective.
- Make the group appear cohesive and professionally composed.'
                """
            ))

        if 'gemini_api_key' not in columns:
            db.session.execute(text(
                """
                ALTER TABLE chatbots
                ADD COLUMN gemini_api_key VARCHAR(255)
                """
            ))

        db.session.commit()

    def remove_unused_model_columns():
        inspector = inspect(db.engine)
        table_names = inspector.get_table_names()
        removable_by_table = {
            'chatbots': ['single_mode', 'multiple_mode', 'logo', 'updated_at'],
            'users': ['profile_picture', 'updated_at', 'bio', 'organization'],
            'guests': ['title', 'description']
        }

        for table_name, removable_columns in removable_by_table.items():
            if table_name not in table_names:
                continue

            columns = {column['name'] for column in inspector.get_columns(table_name)}
            for column_name in removable_columns:
                if column_name in columns:
                    try:
                        db.session.execute(text(f'ALTER TABLE {table_name} DROP COLUMN {column_name}'))
                    except Exception:
                        db.session.rollback()
                        continue

        db.session.commit()

    def ensure_conversation_schema():
        inspector = inspect(db.engine)
        table_names = inspector.get_table_names()

        if 'messages' in table_names:
            columns = {column['name'] for column in inspector.get_columns('messages')}
            if 'conversation_id' not in columns:
                db.session.execute(text(
                    """
                    ALTER TABLE messages
                    ADD COLUMN conversation_id INTEGER
                    """
                ))
                db.session.commit()

    def ensure_messages_schema():
        inspector = inspect(db.engine)
        table_names = inspector.get_table_names()
        if 'messages' not in table_names:
            return

        columns = {column['name'] for column in inspector.get_columns('messages')}

        if 'message_type' not in columns:
            db.session.execute(text(
                """
                ALTER TABLE messages
                ADD COLUMN message_type VARCHAR(32) NOT NULL DEFAULT 'text'
                """
            ))
            db.session.commit()

        try:
            db.session.execute(text(
                """
                ALTER TABLE messages
                ALTER COLUMN content DROP NOT NULL
                """
            ))
            db.session.commit()
        except Exception:
            db.session.rollback()

    def ensure_users_schema():
        inspector = inspect(db.engine)
        table_names = inspector.get_table_names()
        if 'users' not in table_names:
            return

        columns = {column['name'] for column in inspector.get_columns('users')}

        if 'whatsapp_number' not in columns:
            db.session.execute(text(
                """
                ALTER TABLE users
                ADD COLUMN whatsapp_number VARCHAR(20)
                """
            ))
            db.session.commit()

    should_bootstrap_db = not (
        len(sys.argv) > 1 and sys.argv[1] == 'db'
    )

    # Create database tables for normal app startup, but skip during Flask-Migrate commands
    if should_bootstrap_db:
        with app.app_context():
            db.create_all()
            ensure_chatbot_prompt_columns()
            ensure_conversation_schema()
            ensure_messages_schema()
            ensure_users_schema()
            remove_unused_model_columns()
    
    return app

# ============================================
# Application Initialization
# ============================================

if __name__ == '__main__':
    app = create_app()
    app.run(
        host='0.0.0.0',
        port=7000,
        debug=app.config['DEBUG']
    )
