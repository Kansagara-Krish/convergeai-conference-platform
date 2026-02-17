"""
WSGI Entry Point for Production Deployment

Usage with Gunicorn:
    gunicorn -w 4 -b 0.0.0.0:5000 wsgi:app

Usage with uWSGI:
    uwsgi --http :5000 --wsgi-file wsgi.py --callable app --processes 4 --threads 2
"""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app import create_app

# Create Flask app with production config
app = create_app(config_name=os.getenv('FLASK_ENV', 'production'))

if __name__ == '__main__':
    app.run()
