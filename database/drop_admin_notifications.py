# ============================================
# Drop Admin Notifications Table
# ============================================
# This script removes the admin_notifications table as it's no longer needed

import sys
import os
from sqlalchemy import text

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import create_app
from backend.models import db

def drop_admin_notifications_table():
    """Drop the admin_notifications table"""
    
    app = create_app('development')
    
    with app.app_context():
        # Drop the table if it exists
        with db.engine.connect() as connection:
            connection.execute(text('DROP TABLE IF EXISTS admin_notifications;'))
            connection.commit()
        print("✓ admin_notifications table dropped successfully")

if __name__ == '__main__':
    drop_admin_notifications_table()
