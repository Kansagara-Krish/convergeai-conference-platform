# Deployment Guide

Complete guide for deploying the Conference Chatbot Management System to production.

## Pre-Deployment Checklist

- [ ] All environment variables configured (.env file)
- [ ] Database migrations completed
- [ ] Static assets optimized
- [ ] Dependencies installed (requirements.txt)
- [ ] Security headers configured
- [ ] CORS origins whitelisted
- [ ] Error logging configured
- [ ] SSL/TLS certificates obtained
- [ ] Backup strategy in place
- [ ] Monitoring/alerting set up

## Deployment Options

### Option 1: Docker (Recommended)

#### Prerequisites
- Docker and Docker Compose installed
- Docker Hub account (optional, for image registry)

#### Deploy with Docker Compose

1. **Prepare for production**
```bash
# Update .env file
cp .env.example .env
# Edit .env with production values
```

2. **Build and run**
```bash
docker-compose build
docker-compose up -d
```

3. **Initialize database**
```bash
docker-compose exec backend python database/init_db.py
```

4. **View logs**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

5. **Stop services**
```bash
docker-compose down
```

#### Docker Stack Deployment (Production)

Create `docker-stack.yml`:
```yaml
version: '3.8'
services:
  backend:
    image: your-registry/convergeai:backend-latest
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    environment:
      - FLASK_ENV=production
  database:
    image: postgres:15
    # ... database config
```

Deploy:
```bash
docker stack deploy -c docker-stack.yml convergeai
```

---

### Option 2: Traditional Virtual Machine

#### Prerequisites
- Ubuntu 20.04+ or similar
- Python 3.8+
- Nginx
- PostgreSQL (recommended for production)

#### Step 1: SSH into Server

```bash
ssh user@your-server-ip
cd /home/user
```

#### Step 2: Clone Repository

```bash
git clone https://github.com/your-org/convergeai.git
cd convergeai
```

#### Step 3: Set Up Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

#### Step 4: Configure Environment

```bash
cp .env.example .env
nano .env  # Edit with production values
```

**Important settings:**
```env
FLASK_ENV=production
DATABASE_URL=postgresql://user:pass@localhost:5432/convergeai
SECRET_KEY=<generate-strong-random-key>
FORCE_HTTPS=True
```

#### Step 5: Set Up PostgreSQL

```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE convergeai_prod;
CREATE USER convergeai WITH PASSWORD 'secure-password';
ALTER ROLE convergeai SET client_encoding TO 'utf8';
ALTER ROLE convergeai SET default_transaction_isolation TO 'read committed';
GRANT ALL PRIVILEGES ON DATABASE convergeai_prod TO convergeai;
\q
```

#### Step 6: Initialize Database

```bash
cd database
python init_db.py
```

#### Step 7: Configure Gunicorn

Create `gunicorn_config.py`:
```python
import multiprocessing

bind = "127.0.0.1:5000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 120
keepalive = 2
max_requests = 1000
max_requests_jitter = 50
```

#### Step 8: Configure Nginx

Create `/etc/nginx/sites-available/convergeai`:
```nginx
upstream convergeai_backend {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Frontend
    root /home/user/convergeai/frontend;
    
    location / {
        try_files $uri /index.html;
    }
    
    # API Proxy
    location /api/ {
        proxy_pass http://convergeai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_request_buffering off;
    }
    
    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/convergeai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 9: Set Up SSL with Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d your-domain.com -d www.your-domain.com
```

#### Step 10: Create Systemd Service

Create `/etc/systemd/system/convergeai.service`:
```ini
[Unit]
Description=ConvergeAI Backend
After=network.target
Requires=postgresql.service

[Service]
User=www-data
WorkingDirectory=/home/user/convergeai
Environment="PATH=/home/user/convergeai/venv/bin"
Environment="FLASK_ENV=production"
ExecStart=/home/user/convergeai/venv/bin/gunicorn \
    -c gunicorn_config.py wsgi:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable convergeai
sudo systemctl start convergeai
sudo systemctl status convergeai
```

---

### Option 3: Platform-as-a-Service (PaaS)

#### Heroku Deployment

1. **Install Heroku CLI**
```bash
curl https://cli.heroku.com/install.sh | sh
heroku login
```

2. **Create app**
```bash
heroku create convergeai-prod
```

3. **Add PostgreSQL**
```bash
heroku addons:create heroku-postgresql:standard-0
```

4. **Set environment variables**
```bash
heroku config:set FLASK_ENV=production
heroku config:set SECRET_KEY=<strong-random-key>
heroku config:set JWT_SECRET_KEY=<strong-random-key>
```

5. **Create Procfile**
```
web: gunicorn -w 4 -b 0.0.0.0:$PORT wsgi:app
release: python database/init_db.py
```

6. **Deploy**
```bash
git push heroku main
```

#### Railway.app Deployment

1. **Connect GitHub repository**
2. **Set environment variables**
3. **Configure build command**: `pip install -r backend/requirements.txt`
4. **Configure start command**: `gunicorn wsgi:app`

---

## Performance Optimization

### Database Optimization

```sql
-- Create indexes for frequently queried fields
CREATE INDEX idx_user_username ON users(username);
CREATE INDEX idx_chatbot_created_by ON chatbots(created_by_id);
CREATE INDEX idx_message_chatbot ON messages(chatbot_id);
CREATE INDEX idx_message_created_at ON messages(created_at);
CREATE INDEX idx_session_token_token ON session_tokens(token);
```

### Caching Strategy

Add Redis for caching:
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

Update `.env`:
```env
REDIS_URL=redis://localhost:6379/0
```

### Frontend Optimization

```bash
# Minify CSS
# Use online tools or Node.js minifiers

# Minify JavaScript  
# Use online tools or UglifyJS

# Compress images
# Use ImageMagick or similar

# Enable gzip compression in Nginx
```

---

## Monitoring & Logging

### Application Logging

Update `config.py`:
```python
import logging
from logging.handlers import RotatingFileHandler

def setup_logging(app):
    if not app.debug:
        file_handler = RotatingFileHandler(
            'logs/convergeai.log',
            maxBytes=10240000,
            backupCount=10
        )
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s'
        ))
        app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)
```

### System Monitoring

```bash
# Install monitoring tools
sudo apt-get install htop iotop nethogs
```

### Uptime Monitoring

Use services like:
- UptimeRobot (free - monitors HTTP endpoints)
- Pingdom
- StatusCake

### Error Tracking

Integrate Sentry:
```bash
pip install sentry-sdk
```

Update `app.py`:
```python
import sentry_sdk
sentry_sdk.init(
    dsn="your-sentry-dsn",
    traces_sample_rate=1.0
)
```

---

## Backup Strategy

### Automated Daily Backups

Create `backup.sh`:
```bash
#!/bin/bash

BACKUP_DIR="/backups/convergeai"
DB_NAME="convergeai_prod"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
pg_dump $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup uploads directory
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /home/user/convergeai/uploads

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
```

Add to crontab:
```bash
crontab -e

# Add this line:
0 2 * * * /home/user/convergeai/backup.sh
```

---

## Security Hardening

### 1. SSL/TLS

```bash
# Check SSL configuration
sudo ssl-test your-domain.com
```

### 2. Firewall

```bash
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

### 3. Fail2Ban

```bash
sudo apt-get install fail2ban

# Create /etc/fail2ban/jail.local:
[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
maxretry = 5

[convergeai]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 10
bantime = 3600
```

### 4. Security Headers

Already configured in Nginx config above.

### 5. SQL Injection Prevention

✅ Using SQLAlchemy ORM (safe by default)
✅ Parameterized queries
✅ Input validation

---

## Health Checks

### API Health Endpoint

Already implemented: `GET /api/health`

```bash
curl http://localhost:5000/api/health
```

### Nginx Health Check

```nginx
location /health {
    return 200 "OK";
    add_header Content-Type text/plain;
}
```

---

## Rollback Procedures

### Docker Rollback

```bash
# View previous images
docker image ls

# Revert to previous version
docker-compose down
git checkout previous-version
docker-compose build
docker-compose up -d
```

### Git Rollback

```bash
# View history
git log --oneline

# Revert to previous commit
git revert <commit-hash>
git push
```

---

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer**: Use Nginx, HAProxy, or cloud provider LB
2. **Database**: PostgreSQL with replication
3. **Cache Layer**: Redis cluster
4. **Static Files**: CDN (CloudFront, Cloudflare)

### Vertical Scaling

1. **Increase server resources**: CPU, RAM, disk
2. **Database tuning**: Connection pooling, query optimization
3. **Caching strategy**: Implement Redis

---

## Troubleshooting

### Backend Won't Start

```bash
# Check logs
docker logs convergeai-backend
# or
systemctl status convergeai

# Check port availability
lsof -i :5000
```

### Database Connection Failed

```bash
# Test connection
psql postgresql://user:pass@localhost:5432/convergeai

# Check PostgreSQL status
sudo systemctl status postgresql
```

### Frontend Not Loading

```bash
# Check Nginx errors
sudo tail -f /var/log/nginx/error.log

# Test Nginx config
sudo nginx -t
```

### High Memory Usage

```bash
# Check process memory
ps aux | grep gunicorn

# Reduce worker count in gunicorn_config.py
# Add memory limits in docker-compose.yml
```

---

## Post-Deployment

1. **Test all features**
   - Admin login and operations
   - User login and chat
   - Message creation and retrieval

2. **Monitor performance**
   - API response times
   - Database query performance
   - Memory/CPU usage

3. **Set up alerts**
   - Uptime monitoring
   - Error rate tracking
   - Resource usage thresholds

4. **Regular maintenance**
   - Security patches
   - Dependency updates
   - Database optimization

---

## Quick Reference Commands

```bash
# Development server
python backend/app.py

# Production with Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 wsgi:app

# Database initialization
python database/init_db.py

# View logs
tail -f logs/app.log

# Backup database
pg_dump convergeai_prod > backup.sql

# Check running processes
ps aux | grep python

# Kill running process
kill -9 <PID>
```

---

For additional support, check:
- README.md - General documentation
- QUICKSTART.md - Quick setup guide
- API.md - API reference
- ARCHITECTURE.md - System architecture
