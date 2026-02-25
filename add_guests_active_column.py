from backend.app import create_app
from backend.models import db
from sqlalchemy import text

app = create_app('development')

with app.app_context():
    try:
        # Add active column to guests table
        db.session.execute(text('ALTER TABLE guests ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE'))
        db.session.commit()
        print("✓ Successfully added 'active' column to guests table")
    except Exception as e:
        db.session.rollback()
        print(f"✗ Error adding column: {e}")
