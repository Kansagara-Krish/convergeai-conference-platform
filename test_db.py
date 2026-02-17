import sqlite3
import os

# Use absolute path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'backend', 'instance', 'chat_system.db')

print(f"Database path: {DB_PATH}")
print(f"Database exists: {os.path.exists(DB_PATH)}")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tables:", tables)

# Check users
try:
    cursor.execute("SELECT id, username, email, name FROM users")
    users = cursor.fetchall()
    print("Users:", users)
except Exception as e:
    print("Error fetching users:", e)

conn.close()
