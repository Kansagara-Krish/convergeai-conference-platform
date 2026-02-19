# Conference Chatbot Management System

A modern, professional web application for managing AI-powered chatbots at academic conferences. Features include event management, user administration, intelligent chat interfaces, and comprehensive analytics.

## ✅ Current Working Status

The following features are implemented and working:

- Chatbot create flow with required background image upload
- Background image preview on create and edit forms
- Edit mode current image display, replace, and clear (delete) support
- Uploaded image serving from backend uploads directory
- Chatbot Active/Inactive admin toggle in create and edit
- Active/Inactive state persistence in database and API responses
- Chatbot list search by chatbot name, event name, and description
- Chatbot list filter by admin status only: Active / Inactive

## 🎯 Features

### Admin Panel
- **Dashboard Overview**: Real-time statistics (total chatbots, active events, users, upcoming events)
- **Chatbot Management**: Create, edit, delete, and configure chatbots
- **Chatbot Status Control**: Toggle chatbot state between Active and Inactive
- **Guest Management**: Add expert speakers and moderators
- **User Management**: Manage users, reset passwords, activate/deactivate accounts
- **Excel Import**: Bulk import users with auto-generated credentials
- **Settings**: Configure chatbot behavior, mode selection, and access control

### User Panel
- **Dashboard**: Browse available conference chatbots
- **Chat Interface**: Modern AI-powered chat with real-time messaging
- **Profile Management**: Update profile and change password
- **Event Participation**: Join and participate in multiple events

### Design Features
- **Glassmorphism Effect**: Modern frosted glass UI components
- **Gradient Backgrounds**: Deep blue, purple, and cyan gradient theme
- **Smooth Animations**: Fluid transitions and interactive elements
- **Responsive Layout**: Fully mobile-optimized design
- **Dark Theme**: Professional dark mode optimized for extended use
- **Custom Components**: Professional badges, cards, and form elements

## 📁 Project Structure

```
convergeai_conference_chatbot_system/
├── frontend/                    # Frontend files
│   ├── index.html              # Login page
│   ├── admin/                  # Admin panel pages
│   │   ├── dashboard.html
│   │   ├── create-chatbot.html
│   │   ├── chatbot-list.html
│   │   ├── import-excel.html
│   │   ├── user-management.html
│   │   ├── edit-chatbot.html
│   │   ├── chatbot-settings.html
│   │   └── guest-management.html
│   ├── user/                   # User panel pages
│   │   ├── dashboard.html
│   │   ├── chat.html
│   │   └── profile.html
│   ├── css/                    # Stylesheets
│   │   ├── style.css           # Main styles with glassmorphism
│   │   ├── admin.css           # Admin dashboard styles
│   │   ├── user.css            # User panel styles
│   │   └── chat.css            # Chat interface styles
│   ├── js/                     # JavaScript
│   │   ├── utils.js            # Utility functions & helpers
│   │   ├── main.js             # Main application logic
│   │   ├── admin.js            # Admin-specific functionality
│   │   └── chat.js             # Chat functionality
│   └── assets/                 # Images and media
├── backend/                    # Flask backend
│   ├── app.py                  # Flask application factory
│   ├── config.py               # Configuration management
│   ├── models.py               # Database models
│   ├── requirements.txt        # Python dependencies
│   └── routes/                 # API endpoints
│       ├── auth.py             # Authentication routes
│       ├── admin.py            # Admin endpoints
│       ├── user.py             # User endpoints
│       └── chatbot.py          # Chatbot endpoints
├── database/                   # Database utilities
│   └── init_db.py             # Database initialization script
├── .env                        # Environment variables
└── README.md                   # This file
```

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Modern web browser
- SQLite or MySQL

### Installation

1. **Clone the repository**
```bash
cd convergeai_conference_chatbot_system
```

2. **Install backend dependencies**
```bash
cd backend
pip install -r requirements.txt
```

3. **Configure environment**
```bash
# Copy .env template and update as needed
cp .env.example .env
```

4. **Initialize database**
```bash
cd database
python init_db.py
```

5. **Start backend server**
```bash
cd backend
python app.py
```

The backend will run on `http://localhost:5000`

6. **Open frontend in browser**
```bash
# Open index.html in your browser
# Or use a local server like Python's http.server
cd frontend
python -m http.server 8000
```

Navigate to `http://localhost:8000`

## 🔐 Authentication

### Demo Credentials

| Role  | Username | Password |
|-------|----------|----------|
| Admin | admin    | password |
| User  | user     | password |

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify token
- `PUT /api/auth/change-password` - Change password

### Admin Routes
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/users` - List users
- `POST /api/admin/import/excel` - Import users from Excel
- `GET /api/admin/chatbots` - List chatbots
- `POST /api/admin/chatbots/<id>/guests` - Add guests

### User Routes
- `GET /api/user/chatbots` - Get available chatbots
- `POST /api/user/chatbots/<id>/join` - Join chatbot
- `GET /api/user/profile` - Get profile
- `PUT /api/user/profile` - Update profile
- `GET /api/user/chatbots/<id>/messages` - Get messages
- `POST /api/user/chatbots/<id>/messages` - Send message

### Chatbot Routes
- `POST /api/chatbots` - Create chatbot
- `GET /api/chatbots/<id>` - Get chatbot
- `PUT /api/chatbots/<id>` - Update chatbot
- `DELETE /api/chatbots/<id>` - Delete chatbot
- `GET /api/chatbots/<id>/stats` - Get statistics

## 🎨 Design System

### Color Palette
- **Primary**: `#4f46e5` (Indigo)
- **Secondary**: `#9333ea` (Purple)
- **Accent**: `#06b6d4` (Cyan)
- **Dark BG**: `#0f1419`
- **Card BG**: `rgba(26, 31, 46, 0.7)` (with glassmorphism)

### Typography
- **Font**: Inter, Poppins, or system sans-serif
- **Headings**: 600-700 weight
- **Body**: 400-500 weight
- **Mono**: Fira Code for code snippets

### Components
- **Cards**: Glassmorphism effect with backdrop blur
- **Buttons**: Gradient fills with hover animations
- **Inputs**: Subtle focus states with border highlights
- **Badges**: Colored backgrounds for status indicators
- **Modals**: Centered with backdrop blur

## 🔧 Configuration

### Environment Variables (.env)
```env
# Flask
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your-secret-key

# Database
DATABASE_URL=sqlite:///chat_system.db

# JWT
JWT_SECRET_KEY=your-jwt-secret

# Upload
MAX_UPLOAD_SIZE=52428800
UPLOAD_FOLDER=uploads
```

## 📊 Database Schema

### Users
- id, username, email, password_hash, name, role, active, created_at

### Chatbots
- id, name, event_name, description, start_date, end_date, system_prompt, created_by_id

### Guests
- id, chatbot_id, name, title, description, photo, is_speaker, is_moderator

### Messages
- id, chatbot_id, user_id, content, is_user_message, created_at

### ChatbotParticipants
- id, chatbot_id, user_id, joined_at, message_count

## 🚢 Deployment

### Using Gunicorn
```bash
cd backend
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Docker Support (Optional)
Create a `Dockerfile` in the root directory:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "backend.app:app"]
```

## 📱 Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🔒 Security Features
- Password hashing with Werkzeug
- JWT token authentication
- CORS protection
- Session management
- SQL injection prevention (SQLAlchemy ORM)
- CSRF protection ready

## 🚀 Performance Optimization
- Lazy loading for images
- Efficient database queries
- CSS animations using GPU acceleration
- Responsive images
- Minified assets (in production)

## 📝 License
MIT License - feel free to use for commercial and personal projects

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 🆘 Support
For issues and questions, please check the documentation or contact the development team.

---

**Built with ❤️ using Flask, SQLAlchemy, and modern web technologies**
