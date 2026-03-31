# Database Schema and Data Export Summary

I have analyzed the database schema and successfully exported the complete data from each table using a custom Python script.

## Database Schema Overview

The system uses a PostgreSQL database with 11 main tables, organized to manage users, event chatbots, conversations, and integrations (WhatsApp and Google Drive).

### Core Tables
- **users**: Stores authentication details, roles (admin, user, etc.), and contact information for the conference participants.
- **chatbots**: Represents individual event chatbots, each with its own configuration, prompts, and event duration.
- **guests**: Stores information about event guests or experts associated with specific chatbots.

### Interaction & Messaging
- **conversations**: Tracks chat sessions between users and chatbots.
- **messages**: Contains the actual message content (text or image) and flow within conversations.
- **chatbot_participants**: Records which users have joined which chatbot event sessions.

### Integrations and Services
- **whatsapp_send_history**: Detailed logs of messages sent via the WhatsApp Business API, including delivery status.
- **drive_image_backups**: Tracks AI-generated images that have been backed up to specific Google Drive folders.
- **login_otps**: Manages One-Time Passwords for the WhatsApp-based authentication flow.
- **session_tokens**: Manages active user sessions for secure API access.
- **app_settings**: Configuration settings for the system (e.g., event flags).

---

## Data Export Process

I created and executed `export_db_data.py`, which performs the following steps:
1. Connects to the PostgreSQL database using the `DATABASE_URL` from the `.env` file.
2. Identifies all tables in the `public` schema.
3. Exports every row from each table into individual CSV files with timestamps.

### Exported Files Location
All data exports are saved in the `exports/` directory:

- [users_20260331_121254.csv](file:///c:/Users/kansa/OneDrive/Desktop/convergeai_conference_chatbot_system/exports/users_20260331_121254.csv)
- [chatbots_20260331_121254.csv](file:///c:/Users/kansa/OneDrive/Desktop/convergeai_conference_chatbot_system/exports/chatbots_20260331_121254.csv)
- [messages_20260331_121254.csv](file:///c:/Users/kansa/OneDrive/Desktop/convergeai_conference_chatbot_system/exports/messages_20260331_121254.csv)
- [whatsapp_send_history_20260331_121254.csv](file:///c:/Users/kansa/OneDrive/Desktop/convergeai_conference_chatbot_system/exports/whatsapp_send_history_20260331_121254.csv)
- ...and others for every table in the database.

---

### Scripts Created
- [export_db_data.py](file:///c:/Users/kansa/OneDrive/Desktop/convergeai_conference_chatbot_system/export_db_data.py): The main script used for the export.
