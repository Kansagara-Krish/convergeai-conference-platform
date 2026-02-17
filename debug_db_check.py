
import os
import sys

# Ensure backend can be imported
sys.path.append(os.getcwd())

from backend.app import create_app
from backend.models import db, User
from sqlalchemy import inspect

app = create_app('development')

def check_db():
    with app.app_context():
        db_uri = app.config['SQLALCHEMY_DATABASE_URI']
        print(f"configured_db_uri: {db_uri}")
        
        # Check if file exists
        if db_uri.startswith('sqlite:///'):
            path = db_uri.replace('sqlite:///', '')
            print(f"resolved_db_path: {path}")
            if os.path.exists(path):
                print(f"file_exists: True")
                print(f"file_size: {os.path.getsize(path)} bytes")
            else:
                print(f"file_exists: False")
        
        # Check tables
        try:
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            print(f"tables_found: {tables}")
        except Exception as e:
            print(f"error_checking_tables: {e}")

if __name__ == "__main__":
    check_db()
