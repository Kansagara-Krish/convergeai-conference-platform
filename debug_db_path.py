
import os
import sys

# Add the current directory to sys.path so we can import backend
sys.path.append(os.getcwd())

try:
    from backend.config import Config
    print(f"Base Dir: {Config.BASE_DIR}")
    print(f"DB Path: {Config.DB_PATH}")
    print(f"SQL URI: {Config.SQLALCHEMY_DATABASE_URI}")
except ImportError as e:
    print(f"Import Error: {e}")
    # Try importing directly if we are inside backend (simulating different run location)
    try:
        sys.path.append(os.path.join(os.getcwd(), 'backend'))
        from config import Config
        print(f"Base Dir: {Config.BASE_DIR}")
        print(f"DB Path: {Config.DB_PATH}")
        print(f"SQL URI: {Config.SQLALCHEMY_DATABASE_URI}")
    except params as e2:
        print(f"Import Error 2: {e2}")

