# Quick Start Guide

Get the Conference Chatbot Management System up and running in 5 minutes.

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Any modern web browser
- Terminal/Command Prompt

## Step 1: Clone or Extract Project

```bash
# Navigate to the project directory
cd convergeai_conference_chatbot_system
```

## Step 2: Create Python Virtual Environment

### Windows (PowerShell):
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### Windows (Command Prompt):
```cmd
python -m venv venv
venv\Scripts\activate.bat
```

### macOS/Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

## Step 3: Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
cd ..
```

## Step 4: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# On Windows, you might need:
# copy .env.example .env
```

Edit `.env` file with your settings (optional for development):
- Keep `FLASK_ENV=development`
- Keep `FLASK_DEBUG=True`
- Keep `DATABASE_URL=sqlite:///./chat_system.db`

## Step 5: Initialize Database

```bash
cd database
python init_db.py
cd ..
```

You should see output like:
```
Creating tables...
Tables created successfully!
Created demo admin user: admin / password
Created demo regular user: user / password
Database initialized successfully!
```

## Step 6: Start Backend Server

```bash
cd backend
python app.py
```

You should see:
```
WARNING in flask.app: Use a production WSGI server to run the app. See "How to deploy Flask" for more information.
 * Running on http://127.0.0.1:5000
```

**Keep this terminal open!**

## Step 7: Start Frontend (New Terminal)

### Option A: Use Python HTTP Server
```bash
# In a new terminal, navigate to project root
cd frontend
python -m http.server 8000
```

You should see:
```
Serving HTTP on 0.0.0.0 port 8000
```

### Option B: Use Node.js HTTP Server (if installed)
```bash
cd frontend
npx http-server -p 8000
```

## Step 8: Open in Browser

1. Open your browser
2. Navigate to: `http://localhost:8000`
3. You should see the login page

## Step 9: Login

Use these demo credentials:

**Admin Account:**
- Username: `admin`
- Password: `password`

**User Account:**
- Username: `user`
- Password: `password`

After login, you'll see either the admin dashboard or user dashboard depending on the account.

## Testing the System

### Admin Panel Features:
1. **Dashboard** → View statistics and recent chatbots
2. **Create Chatbot** → Add a new chatbot/event
3. **Chatbot List** → View all chatbots
4. **Import Excel** → Bulk import users
5. **User Management** → Manage user accounts

### User Panel Features:
1. **Dashboard** → Browse available chatbots
2. **Chat Interface** → Chat with a bot
3. **Profile** → Update profile and change password

## API Testing

### Test Login Endpoint
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

Expected response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin",
      ...
    }
  }
}
```

### Get Dashboard Stats
```bash
curl http://localhost:5000/api/admin/dashboard/stats \
  -H "Authorization: Bearer YOUR_TOKEN_FROM_LOGIN"
```

## Stopping the Servers

Press `Ctrl+C` in each terminal running the server:
1. Backend terminal: `Ctrl+C`
2. Frontend terminal: `Ctrl+C`
3. Deactivate venv: `deactivate`

## Troubleshooting

### Python not found
**Solution**: Make sure Python 3.8+ is installed and in your PATH
```bash
python --version
python3 --version
```

### Port already in use
**Solution**: Change the port numbers
```bash
# Backend on different port
python backend/app.py --port 5001

# Frontend on different port
python -m http.server 8001
```

### Database file not found
**Solution**: Rerun initialization
```bash
cd database
python init_db.py
```

### Can't connect frontend to backend
**Solution**: 
1. Verify backend is running on `http://localhost:5000`
2. Check CORS is enabled in Flask (should be by default)
3. Check backend error logs

### Module not found error
**Solution**: Install missing packages
```bash
cd backend
pip install -r requirements.txt
```

## Next Steps

Once everything is working:

1. **Explore the code**:
   - Backend routes: `backend/routes/`
   - Frontend JS: `frontend/js/`
   - Stylesheets: `frontend/css/`

2. **Create your own chatbots** via the admin dashboard

3. **Customize the design**:
   - Edit `frontend/css/style.css` for theme changes
   - Modify colors in CSS variables (lines 1-36)

4. **Connect to AI service**:
   - Edit `backend/routes/user.py` → `send_message()` function
   - Replace simulated response with real AI API call

5. **Set up real database**:
   - Update `DATABASE_URL` in `.env` to use MySQL/PostgreSQL
   - Run `flask db upgrade` for migrations

6. **Deploy to production**:
   - See deployment options in README.md

## Additional Resources

- Flask Documentation: https://flask.palletsprojects.com
- SQLAlchemy Documentation: https://docs.sqlalchemy.org
- HTML/CSS/JS MDN Docs: https://developer.mozilla.org

## Getting Help

1. Check error messages in terminal
2. Review code comments in source files
3. Check README.md for more information
4. Verify all prerequisites are installed

---

**You're all set! Enjoy building awesome chatbot experiences! 🚀**
