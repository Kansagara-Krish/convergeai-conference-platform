# 🎯 Conference Chatbot Management System

A sophisticated event management platform with AI-powered image generation, WhatsApp integration, and real-time chat capabilities for conference attendees.

## ✨ Key Features

### 🤖 AI Image Generation
- **Single-Person Portraits**: Generate professional portrait images of individual guests
- **Group Photos**: Create professional group images with multiple attendees
- **Custom Backgrounds**: Apply custom background images to generated content
- **Gemini Integration**: Powered by Google Gemini API for high-quality image synthesis
- **Google Drive Backup**: Automatic backup of all AI-generated images to Google Drive

### 💬 Real-Time Chat System
- **Multi-conversation Support**: Users can manage multiple concurrent conversations
- **Message Threading**: Organized conversation threads with full history
- **Media Support**: Share images and attachments in chat
- **Typing Indicators**: Real-time presence awareness
- **Message Preservation**: AI-generated images are preserved when conversations are deleted

### 📱 WhatsApp Integration
- **Direct Messaging**: Send and receive messages via WhatsApp
- **Image Distribution**: Share AI-generated images via WhatsApp
- **Template-Based Messages**: Pre-configured message templates (e.g., `auto_image_send`)
- **Webhook Support**: Real-time webhook processing for incoming messages
- **Meta Cloud API**: Full Meta WhatsApp Cloud API integration

### 👥 User Management
- **Role-Based Access Control**: Admin, User, Speaker, Volunteer roles
- **Google OAuth**: Secure Google authentication integration
- **Guest Lists**: Import and manage conference guest lists
- **Profile Management**: User profile customization and settings
- **Activity Tracking**: Last login and user activity monitoring

### 📊 Admin Dashboard
- **Analytics**: Real-time conference analytics and statistics
- **User Management**: Complete user administration interface
- **Chatbot List**: Manage multiple event chatbots
- **Guest Management**: Organize and track guest information
- **Settings Management**: Configure chatbot behaviors and templates

### 📈 Analytics & Reporting
- **Chart Visualizations**: Interactive charts for conference metrics
- **Real-Time Updates**: Live data refresh without page reload
- **Skeleton Loaders**: Smooth loading states for data visualization
- **Export Capabilities**: Export analytics data for reports

### 📧 Email Integration
- **SMTP Support**: Gmail, custom SMTP servers
- **Notification System**: Automated email notifications
- **Multi-Provider**: SendGrid, Mailgun, AWS SES support
- **Email Templates**: Professional email templates for various events

## 🎨 Frontend Features & Animations

### UI/UX Components
```
✅ Responsive Design - Mobile, tablet, and desktop support
✅ Dark Mode Support - Comfortable low-light experience
✅ Accessibility Features - ARIA labels, keyboard navigation, screen reader support
✅ Toast Notifications - Non-intrusive user feedback
✅ Modal Dialogs - Confirmation and action dialogs
✅ Loading States - Skeleton loaders for smooth transitions
```

### Animation Library

#### 1. **Skeleton Loading Animations**
- `skeletonPulse` (1.4s ease-in-out infinite): Pulsing effect for loading placeholders
- Applied to: User lists, analytics charts, guest tables, message boxes
- Location: `frontend/components/css/admin.css`

#### 2. **Notification Animations**
- `slideOut` (0.3s ease-out): Toast message slide-out effect
- Applied to: Success/error messages, notifications
- Location: `frontend/components/js/utils.js`

#### 3. **Panel & Modal Animations**
- `bellPanelReveal` (260ms cubic-bezier): Notification panel appearance
- Applied to: Admin notification panels, dropdown menus
- Location: `frontend/components/css/admin.css`

#### 4. **Item List Animations**
- `bellItemIn` (280ms ease both): Individual list item fade-in with stagger effect
- Stagger Delays: 30ms, 60ms, 90ms, 120ms, 150ms intervals
- Applied to: Notification list items, dropdown items
- Location: `frontend/components/css/admin.css`

#### 5. **Functional Animations**
- `bellRing` (1.1s ease-in-out 2): Attention-seeking bell ring animation
- Applied to: Notification bell icon
- Location: `frontend/components/css/admin.css`

#### 6. **Fade & Slide Animations**
- `fadeIn` (customizable ms): Fade-in effect for new elements
- `slideUp` (customizable ms): Slide up entrance animation
- `slideDown` (customizable ms): Slide down entrance animation
- Location: `frontend/components/js/utils.js`

#### 7. **Analytics Animations**
- `analyticsFadeUp` (0.45s ease forwards): Analytics card appearance
- Chart Animations: Built-in animation configs for Chart.js visualizations
- Location: `frontend/components/css/analytics.css`

#### 8. **Performance Optimizations**
- `requestAnimationFrame`: Smooth animation scheduling
- Used for: Viewport updates, message rendering, DOM manipulations
- Prevents layout thrashing and improves performance

### Frontend Pages & Components

#### User Interface
| Page | Location | Features |
|------|----------|----------|
| **Login** | `index.html` | Google OAuth, username/password auth, forgot password |
| **Dashboard** | `components/dashboard.html` | Overview, recent chats, user activity |
| **Chat** | `components/chat.html` | Real-time messaging, image generation, file upload |
| **Profile** | `components/profile.html` | User settings, preferences, account management |
| **Chatbot List** | `components/chatbot-list.html` | Browse available chatbots, join events |

#### Admin Interface
| Page | Location | Features |
|------|----------|----------|
| **Admin Dashboard** | `admin/dashboard.html` | System overview, key metrics |
| **Chatbot Management** | `admin/create-chatbot.html` | Create, edit, delete event chatbots |
| **User Management** | `admin/user-management.html` | Admin user controls and permissions |
| **Guest Management** | `admin/guest-management.html` | Bulk import, manage guest lists |
| **Analytics** | `admin/analytics.html` | Charts, reports, conference metrics |
| **Settings** | `admin/settings.html` | Global configuration and preferences |

## 🏗️ Architecture

### Database Models

```
User
├── Chatbot (created_by_id)
├── Message (user_id)
├── Conversation (user_id)
├── Guest (user_id)
├── LoginOTP (user_id)
├── WhatsAppSendHistory (user_id)
└── DriveImageBackup (user_id)

Chatbot
├── Guest (many)
├── Message (many)
├── Conversation (many)
├── ChatbotParticipant (many)
└── DriveImageBackup (many)

Conversation
└── Message (many)

Message
└── image_url (bot-generated or user-uploaded)
```

#### Core Models
1. **User Model** - Authentication, roles, profiles
2. **Chatbot Model** - Event configuration, prompts, settings
3. **Guest Model** - Attendee information with photos
4. **Conversation Model** - Chat session management
5. **Message Model** - Chat messages with image support
6. **ChatbotParticipant Model** - User-chatbot relationships
7. **DriveImageBackup Model** - Image redundancy tracking
8. **LoginOTP Model** - Two-factor authentication
9. **WhatsAppSendHistory Model** - Message delivery tracking
10. **SessionToken Model** - JWT token management

## 🔌 Backend Routes

### Authentication Routes
- `POST /api/auth/login` - Username/password login
- `POST /api/auth/google` - Google OAuth authentication
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Password recovery

### Chatbot Routes
- `GET /api/chatbots` - List all chatbots
- `POST /api/chatbots` - Create new chatbot
- `GET /api/chatbots/<id>` - Get chatbot details
- `PUT /api/chatbots/<id>` - Update chatbot
- `DELETE /api/chatbots/<id>` - Delete chatbot
- `POST /api/chatbots/<id>/settings` - Update settings

### Chat Routes
- `GET /api/chatbots/<id>/conversations` - List user conversations
- `POST /api/chatbots/<id>/conversations` - Create conversation
- `DELETE /api/chatbots/<id>/conversations/<id>` - Delete conversation (AI images preserved)
- `GET /api/chatbots/<id>/conversations/<id>/messages` - Get messages
- `POST /api/chatbots/<id>/chat` - Send message

### User Routes
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `POST /api/users/generate-image` - Generate AI image

### Admin Routes
- `GET /api/admin/users` - List users
- `POST /api/admin/users` - Create user
- `DELETE /api/admin/users/<id>` - Delete user
- `GET /api/admin/analytics` - Get analytics data
- `POST /api/admin/chatbots/<id>/guests/import` - Import guest list

### WhatsApp Routes
- `POST /api/whatsapp/webhook` - Receive WhatsApp messages
- `POST /api/whatsapp/send` - Send WhatsApp message

### Google Drive Routes
- `POST /api/drive/upload` - Upload file to Drive
- `GET /api/drive/folder-info` - Get folder information

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- PostgreSQL 12+
- Node.js (for frontend build tools, optional)
- Google OAuth credentials
- WhatsApp Business Account
- Gemini API key
- Google Drive API access

### Installation

1. **Clone and Setup**
```bash
cd convergeai_conference_chatbot_system
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\Activate.ps1
```

2. **Install Dependencies**
```bash
pip install -r backend/requirements.txt
pip install -r requirements-dev.txt
```

3. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your credentials:
# - DATABASE_URL
# - WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
# - SMTP credentials
# - Google OAuth credentials
# - Gemini API key
# - Google Drive settings
```

4. **Initialize Database**
```bash
flask db upgrade
python backend/seed_test_users.py
```

5. **Run Application**

**Development Mode:**
```bash
python backend/app.py
# Server runs on http://localhost:7000
# Frontend: http://localhost:8000
```

**Production Mode:**
```bash
gunicorn -w 4 -b 0.0.0.0:5000 wsgi:app
```

## 📋 Environment Variables

### Critical Configuration
```env
# Flask
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret

# Database
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/convergeai_db

# WhatsApp
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_VERIFY_TOKEN=your-verify-token
PUBLIC_URL=https://your-ngrok-url

# Email (SMTP)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@conference.com

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:7000/api/google/auth/callback

# Google Drive
GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE=backend/google_service_account.json
GOOGLE_DRIVE_ROOT_FOLDER_ID=your-folder-id

# AI Services
GEMINI_API_KEY=your-gemini-key

# URLs
API_URL=http://localhost:7000/api
FRONTEND_URL=http://localhost:8000
```

## 👥 User Roles & Permissions

### Admin Role
- Manage all chatbots
- Create/delete users
- View analytics
- Configure settings
- Import guest lists

### User Role
- Create personal chatbots
- Chat and generate images
- Manage conversations
- View own profile

### Speaker Role
- Limited chatbot access
- Chat capabilities
- View assigned conversations

### Volunteer Role
- Assist with event management
- Limited administrative functions
- Access to guest lists

## 🔐 Security Features

- ✅ Password hashing with werkzeug
- ✅ JWT token-based authentication
- ✅ CORS protection
- ✅ HTTPS/HSTS headers
- ✅ SQL injection prevention (SQLAlchemy ORM)
- ✅ XSS protection (templating)
- ✅ CSRF token support
- ✅ Rate limiting (optional, configurable)
- ✅ Session cookie security

## 📦 Project Structure

```
convergeai_conference_chatbot_system/
├── backend/
│   ├── app.py                 # Flask application
│   ├── config.py              # Configuration management
│   ├── models.py              # Database models
│   ├── routes/
│   │   ├── auth.py            # Authentication
│   │   ├── admin.py           # Admin functions
│   │   ├── user.py            # User operations
│   │   ├── chatbot.py         # Chatbot management
│   │   ├── whatsapp.py        # WhatsApp integration
│   │   ├── drive.py           # Google Drive integration
│   │   └── google_oauth.py    # OAuth handling
│   ├── services/
│   │   ├── google_drive_service.py
│   │   ├── whatsapp_service.py
│   │   └── email_templates.py
│   └── requirements.txt
├── frontend/
│   ├── index.html             # Login page
│   ├── components/
│   │   ├── dashboard.html
│   │   ├── chat.html
│   │   ├── admin/
│   │   ├── user/
│   │   ├── css/
│   │   │   ├── style.css      # Core styles
│   │   │   ├── admin.css      # Admin animations
│   │   │   ├── analytics.css  # Analytics styles
│   │   │   └── chat.css       # Chat styles
│   │   └── js/
│   │       ├── main.js        # Core functionality
│   │       ├── admin.js       # Admin scripts
│   │       ├── analytics.js   # Analytics logic
│   │       └── utils.js       # Utility functions (animations)
│   └── css/                   # Static CSS files
├── database/
│   └── init_db.py            # Database initialization
├── .env                       # Environment configuration
├── requirements-dev.txt       # Development dependencies
└── wsgi.py                    # Production entry point
```

## 🧪 Testing

Run tests with pytest:
```bash
pytest -v
pytest -v --cov=backend
```

## 📝 API Documentation

Access API docs when `ENABLE_API_DOCS=True`:
```
http://localhost:7000/api/docs
```

## 🤝 Contributing

1. Create a feature branch
2. Make changes
3. Run tests
4. Submit pull request

## 📞 Support

For issues and questions:
- Check existing documentation
- Review database schema
- Check environment configuration
- Review logs at `logs/app.log`

## 📄 License

Proprietary - Conference Chatbot Management System

## 🎉 Features Highlight

| Category | Features |
|----------|----------|
| **Image Generation** | Single/group photos, custom backgrounds, Gemini integration |
| **Messaging** | Real-time chat, WhatsApp integration, image sharing |
| **User Management** | Multi-role system, OAuth authentication, profile management |
| **Analytics** | Real-time dashboards, charts, exportable reports |
| **Admin Tools** | User management, chatbot creation, guest list import |
| **Animations** | Skeleton loaders, panel reveals, smooth transitions |
| **Integrations** | Google Drive, WhatsApp, Gmail, Gemini AI |
| **Security** | JWT auth, CORS, password hashing, rate limiting |

---

**Version**: 1.0.0  
**Last Updated**: March 30, 2026  
**Status**: Production Ready
