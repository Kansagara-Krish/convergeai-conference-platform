# ============================================
# Database Initialization Script
# ============================================

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import create_app
from backend.models import db, User

def init_database():
    """Initialize database with sample data"""
    
    app = create_app('development')
    
    with app.app_context():
        # Create all tables
        db.create_all()
        print("✓ Database tables created")
        
        # Delete existing users to ensure fresh demo data
        User.query.delete()
        db.session.commit()
        
        # Create sample admin user
        admin = User(
            username='admin',
            email='admin@convergeai.com',
            name='Administrator',
            role='admin',
            active=True
        )
        admin.set_password('password')
        db.session.add(admin)
        print("✓ Admin user created (username: admin, password: password)")
        
        # Create sample regular user
        user = User(
            username='user',
            email='user@convergeai.com',
            name='John Doe',
            role='user',
            active=True
        )
        user.set_password('password')
        db.session.add(user)
        print("✓ Regular user created (username: user, password: password)")
        
        db.session.commit()
        print("\n✓ Database initialized successfully!")
        print("\nDemo Credentials:")
        print("  Admin   - Username: admin   | Password: password")
        print("  User    - Username: user    | Password: password")

if __name__ == '__main__':
    init_database()
