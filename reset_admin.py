
import os
import sys

# Add the current directory to sys.path
sys.path.append(os.getcwd())

from backend.app import create_app
from backend.models import db, User

app = create_app('development')

with app.app_context():
    print(f"DB URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
    try:
        # Check if admin exists
        admin = User.query.filter_by(username='admin').first()
        
        if not admin:
            print("Admin user not found. Creating...")
            admin = User(username='admin', email='admin@convergeai.com', role='admin')
            admin.set_password('password')
            db.session.add(admin)
        else:
            print("Admin user found. Resetting password...")
            admin.set_password('password')
            
        db.session.commit()
        print("Admin credentials set to: admin / password")
        
    except Exception as e:
        print(f"Error: {e}")
        db.session.rollback()
