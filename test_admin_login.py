
import os
import sys
import json
from flask import Flask

# Ensure backend can be imported
sys.path.append(os.getcwd())

from backend.app import create_app
from backend.models import db, User

def ensure_admin_exists():
    app = create_app('development')
    with app.app_context():
        # Check for existing admin
        admin = User.query.filter_by(role='admin').first()
        
        if admin:
            print(f"Admin user found: {admin.username} (ID: {admin.id})")
            # For testing purposes, we might want to reset the password to a known value
            # But let's first checking if we can login with the default 'admin123' or similar
            # If we created it, we know the password. If it exists, we might not.
            # Let's create a specific test admin if needed, or update the existing one's password if safe.
            # To be safe and avoiding breaking existing usage, let's create a 'test_admin'
        
        test_admin_username = 'test_admin'
        test_admin_password = 'password123'
        
        test_admin = User.query.filter_by(username=test_admin_username).first()
        if not test_admin:
            print(f"Creating test admin user: {test_admin_username}")
            test_admin = User(
                username=test_admin_username,
                email='test_admin@example.com',
                name='Test Admin',
                role='admin'
            )
            test_admin.set_password(test_admin_password)
            db.session.add(test_admin)
            db.session.commit()
            print("Test admin created.")
        else:
            print(f"Test admin user exists: {test_admin_username}")
            # Reset password to ensure test works
            test_admin.set_password(test_admin_password)
            db.session.commit()
            print("Test admin password updated to 'password123'.")

        return test_admin_username, test_admin_password

def test_login(username, password):
    app = create_app('development')
    
    with app.test_client() as client:
        print(f"\nAttempting login for: {username}")
        response = client.post('/api/auth/login', json={
            'username': username,
            'password': password
        })
        
        print(f"Response Status: {response.status_code}")
        data = response.get_json()
        print(f"Response Body: {json.dumps(data, indent=2)}")
        
        if response.status_code == 200 and data.get('success'):
            print("LOGIN SUCCESSFUL")
            user_data = data.get('user', {})
            print(f"Role: {user_data.get('role')}")
            if user_data.get('role') == 'admin':
                print("VERIFIED: User has admin role.")
            else:
                print("WARNING: User does NOT have admin role.")
        else:
            print("LOGIN FAILED")

if __name__ == "__main__":
    username, password = ensure_admin_exists()
    test_login(username, password)
