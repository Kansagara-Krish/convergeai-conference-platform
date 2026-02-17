
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
        # Create a dummy user to force a DB write
        u = User(username='debug_test_user', email='debug@test.com')
        u.set_password('password')
        db.session.add(u)
        db.session.commit()
        print("User added successfully.")
        
        # Verify it exists
        user = User.query.filter_by(username='debug_test_user').first()
        if user:
            print(f"Verified user: {user.username}")
            
        # Clean up
        db.session.delete(user)
        db.session.commit()
        print("User deleted.")
        
    except Exception as e:
        print(f"Error: {e}")
        db.session.rollback()
