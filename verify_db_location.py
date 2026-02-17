
import sqlite3
import os
import sys

# Ensure backend can be imported
sys.path.append(os.getcwd())
from backend.app import create_app
from backend.models import db, User

VERIFICATION_TOKEN = "ACTIVE_DB_VERIFICATION_TOKEN_12345"

def verify_active_db():
    # 1. Write to the configured DB via Flask App
    app = create_app('development')
    with app.app_context():
        print(f"Configured DB URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
        try:
            # Check if token exists, delete if so
            existing = User.query.filter_by(username=VERIFICATION_TOKEN).first()
            if existing:
                db.session.delete(existing)
                db.session.commit()
            
            # Create verification user
            u = User(username=VERIFICATION_TOKEN, email=f"{VERIFICATION_TOKEN}@test.com")
            u.set_password('pass')
            db.session.add(u)
            db.session.commit()
            print("Successfully wrote verification token to configured DB.")
        except Exception as e:
            print(f"Error writing to DB: {e}")
            return

    # 2. Check physical files
    files_to_check = [
        os.path.join(os.getcwd(), 'backend', 'instance', 'chat_system.db'),
        os.path.join(os.getcwd(), 'instance', 'chat_system.db')
    ]

    for file_path in files_to_check:
        print(f"\nChecking file: {file_path}")
        if not os.path.exists(file_path):
            print("  File does not exist.")
            continue
            
        try:
            conn = sqlite3.connect(file_path)
            cursor = conn.cursor()
            cursor.execute("SELECT count(*) FROM users WHERE username=?", (VERIFICATION_TOKEN,))
            count = cursor.fetchone()[0]
            conn.close()
            
            if count > 0:
                print(f"  [MATCH] Verification token FOUND in this file.")
            else:
                print(f"  [NO MATCH] Verification token NOT found.")
        except Exception as e:
            print(f"  Error reading file: {e}")

if __name__ == "__main__":
    verify_active_db()
