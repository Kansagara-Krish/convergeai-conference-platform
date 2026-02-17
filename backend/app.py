# ============================================
# Flask Application Main File
# ============================================

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_migrate import Migrate
import os
from datetime import datetime

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
    
    app = Flask(__name__)
    app.config.from_object(config.get(config_name, config['default']))
    
    # Initialize extensions
    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    Migrate(app, db)
    
    # Register blueprints
    try:
        from routes.auth import auth_bp
        from routes.admin import admin_bp
        from routes.user import user_bp
        from routes.chatbot import chatbot_bp
    except ImportError:
        from backend.routes.auth import auth_bp
        from backend.routes.admin import admin_bp
        from backend.routes.user import user_bp
        from backend.routes.chatbot import chatbot_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(user_bp, url_prefix='/api/user')
    app.register_blueprint(chatbot_bp, url_prefix='/api/chatbots')
    
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
    
    # Create database tables
    with app.app_context():
        db.create_all()
    
    return app

# ============================================
# Application Initialization
# ============================================

if __name__ == '__main__':
    app = create_app()
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=app.config['DEBUG']
    )
