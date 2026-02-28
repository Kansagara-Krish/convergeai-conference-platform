from backend.app import create_app
from backend.models import db
from sqlalchemy import inspect

app = create_app('development')

with app.app_context():
    inspector = inspect(db.engine)
    columns = inspector.get_columns('guests')
    print("\nGuests table columns:")
    print("=" * 40)
    for col in columns:
        nullable = "NULL" if col.get('nullable', True) else "NOT NULL"
        default = f" DEFAULT {col.get('default', 'None')}" if col.get('default') else ""
        print(f"{col['name']:20} {col['type']} {nullable}{default}")
