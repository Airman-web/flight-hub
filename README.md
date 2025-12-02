FlightHub - Aviation Intelligence Platform
Show Image
Show Image
Show Image
Show Image
FlightHub is a comprehensive aviation intelligence platform that provides real-time flight tracking, live aircraft positions, airport weather data, and an extensive database of airports and airlines worldwide.
 Live Demo: https://atigbi.tech
 Link to Demo video  https://youtu.be/xlAAfONgUkw
 Table of Contents

Features
Technology Stack
System Architecture
Installation
Deployment
API Integration
Project Structure
Configuration
Problems Encountered & Solutions
Dark Mode Implementation
Security
Performance Optimization
Contributing
License


 Features
Core Features

Real-Time Flight Tracking: Search and track flights worldwide with detailed status information
Live Aircraft Map: Interactive map showing real-time aircraft positions globally using OpenSky Network data
Airport Weather: Current weather conditions for airports worldwide
Airport Directory: Browse 6,000+ airports with detailed information
Airlines Database: Explore 13,000+ airlines with comprehensive data
Search History: Automatic tracking and display of user search history

User Features

User Authentication: Secure login/signup with email & password or Google OAuth
User Profiles: Manage account settings and preferences
Dark Mode: Full dark mode support across all pages with persistent settings
Responsive Design: Mobile-friendly interface that works on all devices
Smart Caching: Intelligent data caching to reduce API calls and improve performance


 Technology Stack
Backend

Python 3.8+: Core programming language
Flask 2.0+: Web framework
Flask-Login: User session management
Flask-SQLAlchemy: Database ORM
SQLite/MySQL: Database options
Werkzeug: Security utilities (password hashing)

Frontend

HTML5, CSS3, JavaScript: Core web technologies
Leaflet.js: Interactive maps for aircraft tracking
Font Awesome: Icon library
Responsive CSS Grid & Flexbox: Modern layout system

Infrastructure

2 Ubuntu Web Servers: Load-balanced application servers
1 Load Balancer (HAProxy/Nginx): Traffic distribution
Nginx: Web server and reverse proxy
Gunicorn: WSGI HTTP server
Let's Encrypt: SSL/TLS certificates
GitHub: Version control and deployment

External APIs

AviationStack API: Flight data and schedules
OpenWeatherMap API: Airport weather data
OpenSky Network API: Live aircraft tracking data


 System Architecture
                                    ┌─────────────────┐
                                    │   CloudFlare    │
                                    │   (Optional)    │
                                    └────────┬────────┘
                                             │
                                             │ HTTPS
                                             ▼
                          ┌──────────────────────────────────┐
                          │    Load Balancer (lb-01)         │
                          │    IP: 44.202.82.65             │
                          │    - HAProxy/Nginx              │
                          │    - SSL Termination            │
                          │    - Round Robin Load Balancing │
                          └──────────┬──────────┬───────────┘
                                     │          │
                        ┌────────────┘          └──────────────┐
                        │                                       │
                        ▼                                       ▼
            ┌───────────────────────┐              ┌───────────────────────┐
            │  Web Server 1         │              │  Web Server 2         │
            │  IP: 52.87.245.215   │              │  IP: 54.165.247.234  │
            │  - Nginx              │              │  - Nginx              │
            │  - Gunicorn           │              │  - Gunicorn           │
            │  - Flask App          │              │  - Flask App          │
            │  - SQLite Database    │              │  - SQLite Database    │
            └───────────────────────┘              └───────────────────────┘
                        │                                       │
                        └───────────────┬───────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────┐
                        │   External APIs           │
                        │   - AviationStack         │
                        │   - OpenWeatherMap        │
                        │   - OpenSky Network       │
                        └───────────────────────────┘
Traffic Flow

User accesses https://atigbi.tech
Request hits Load Balancer (lb-01)
Load Balancer distributes to Web Server 1 or 2
Nginx serves static files or forwards to Gunicorn
Flask application processes request
External APIs called as needed (with caching)
Response sent back through the chain


📥 Installation
Prerequisites
bash# System requirements
- Ubuntu 20.04/22.04 LTS
- Python 3.8+
- Git
- 4GB RAM minimum
- 20GB disk space

# Required packages
sudo apt update
sudo apt install python3 python3-pip python3-venv nginx git
Local Development Setup

Clone the Repository

bashgit clone https://github.com/yourusername/flight-hub.git
cd flight-hub

Create Virtual Environment

bashpython3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

Install Dependencies

bashpip install -r requirements.txt

Set Environment Variables

bash# Create .env file
cat > .env << EOF
FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
AVIATIONSTACK_API_KEY=your-api-key
OPENWEATHER_API_KEY=your-api-key
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
EOF

Initialize Database

bashflask db init
flask db migrate
flask db upgrade

Run Development Server

bashflask run
# Visit http://localhost:5000

🚀 Deployment
Server Setup (Web Servers)
1. Initial Server Configuration
bash# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install python3 python3-pip python3-venv nginx git -y

# Create application user (optional)
sudo useradd -m -s /bin/bash flighthub
sudo su - flighthub
2. Clone and Setup Application
bash# Clone repository
git clone https://github.com/yourusername/flight-hub.git
cd flight-hub

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install gunicorn
3. Configure Gunicorn
Create systemd service file:
bashsudo nano /etc/systemd/system/flighthub.service
Add content:
ini[Unit]
Description=Gunicorn service for FlightHub Flask app
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/flight-hub
Environment="PATH=/home/ubuntu/flight-hub/venv/bin"
ExecStart=/home/ubuntu/flight-hub/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:8000 wsgi:app

[Install]
WantedBy=multi-user.target
Enable and start service:
bashsudo systemctl daemon-reload
sudo systemctl enable flighthub
sudo systemctl start flighthub
sudo systemctl status flighthub
4. Configure Nginx (Web Servers)
Create Nginx configuration:
bashsudo nano /etc/nginx/sites-available/flighthub
Add content:
nginxserver {
    listen 80;
    server_name atigbi.tech www.atigbi.tech;

    # Serve static files directly
    location /static/ {
        alias /home/ubuntu/flight-hub/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Proxy to Flask application
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Add server identifier
        add_header X-Served-By web-01 always;  # Change to web-02 for second server
    }
}
Enable site:
bashsudo ln -s /etc/nginx/sites-available/flighthub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
Load Balancer Setup (lb-01)
Configure Nginx as Load Balancer
bashsudo nano /etc/nginx/sites-available/default
Add content:
nginxupstream flighthub_backend {
    server 52.87.245.215:80;  # web-01
    server 54.165.247.234:80; # web-02
}

server {
    listen 80;
    server_name atigbi.tech www.atigbi.tech;
    
    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name atigbi.tech www.atigbi.tech;
    
    # SSL Configuration (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/www.atigbi.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.atigbi.tech/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Static files - forwarded to backend
    location /static/ {
        proxy_pass http://flighthub_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Application requests
    location / {
        proxy_pass http://flighthub_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_header X-Served-By;
    }
}
Test and restart:
bashsudo nginx -t
sudo systemctl restart nginx
SSL Certificate Setup
bash# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate (on load balancer)
sudo certbot --nginx -d atigbi.tech -d www.atigbi.tech

# Auto-renewal is configured automatically
sudo certbot renew --dry-run
Deployment Script
Create deployment script for easy updates:
bashnano ~/deploy.sh
bash#!/bin/bash
cd ~/flight-hub
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart flighthub
sudo systemctl reload nginx
echo "✅ Deployment complete!"
Make executable:
bashchmod +x ~/deploy.sh

🔌 API Integration
AviationStack API
python# Get flight data
BASE_URL = "http://api.aviationstack.com/v1/flights"
params = {
    'access_key': AVIATIONSTACK_API_KEY,
    'flight_iata': 'AA100'
}
OpenWeatherMap API
python# Get airport weather
BASE_URL = "http://api.openweathermap.org/data/2.5/weather"
params = {
    'q': 'JFK Airport',
    'appid': OPENWEATHER_API_KEY,
    'units': 'metric'
}
OpenSky Network API
python# Get live aircraft
BASE_URL = "https://opensky-network.org/api/states/all"
# Rate limit: 1 request per 10 seconds (anonymous)

 Project Structure
flight-hub/
├── app.py                      # Main Flask application
├── auth.py                     # Authentication routes
├── wsgi.py                     # WSGI entry point
├── requirements.txt            # Python dependencies
├── .env                        # Environment variables
├── .gitignore                 # Git ignore file
│
├── static/                     # Static files
│   ├── css/
│   │   ├── style.css          # Main styles
│   │   ├── about.css          # About page styles
│   │   └── auth.css           # Auth pages styles
│   ├── js/
│   │   └── main.js            # Dark mode & utilities
│   └── assets/                # Images, icons
│
├── templates/                  # Jinja2 templates
│   ├── index.html             # Landing page
│   ├── dashboard.html         # User dashboard
│   ├── about.html             # About page
│   │
│   ├── auth/                  # Authentication pages
│   │   ├── login.html
│   │   ├── signup.html
│   │   ├── profile.html
│   │   └── forgot_password.html
│   │
│   └── app/                   # Application pages
│       ├── flights.html       # Flight search
│       ├── aircraft_map.html  # Live aircraft map
│       ├── weather.html       # Weather data
│       ├── airports.html      # Airport directory
│       └── airlines.html      # Airlines database
│
└── instance/                  # Instance-specific files
    └── flighthub.db          # SQLite database

⚙️ Configuration
Environment Variables
bash# Flask Configuration
FLASK_APP=app.py
FLASK_ENV=production
SECRET_KEY=your-super-secret-key-change-this

# Database
DATABASE_URL=sqlite:///instance/flighthub.db

# API Keys
AVIATIONSTACK_API_KEY=your-key-here
OPENWEATHER_API_KEY=your-key-here

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration

# Application Settings
MAX_CONTENT_LENGTH=16777216  # 16MB max upload
SESSION_COOKIE_SECURE=True
SESSION_COOKIE_HTTPONLY=True
PERMANENT_SESSION_LIFETIME=2592000  # 30 days
Database Configuration
python# SQLite (Development/Small Scale)
SQLALCHEMY_DATABASE_URI = 'sqlite:///instance/flighthub.db'

# MySQL (Production)
SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://user:pass@localhost/flighthub'

 Problems Encountered & Solutions
1. Static Files Not Loading (404 Errors)
Problem: After deployment, CSS and JavaScript files returned 404 errors.
Root Cause:

Files existed but nginx wasn't configured to serve /static/ directory
Missing trailing slash in nginx alias directive
Incorrect URL patterns in templates (using .html instead of Flask routes)

Solution:
nginx# Correct nginx configuration
location /static/ {
    alias /home/ubuntu/flight-hub/static/;  # Note the trailing slash
    expires 30d;
}
Template Fix:
html<!-- Wrong -->
<link rel="stylesheet" href="../static/css/style.css">

<!-- Correct -->
<link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
2. Load Balancer Not Forwarding Static Files
Problem: Load balancer returned 404 for /static/ requests despite web servers working correctly.
Root Cause: Load balancer needed explicit /static/ location block with trailing slash.
Solution:
nginx# On load balancer
location /static/ {
    proxy_pass http://flighthub_backend;
    proxy_set_header Host $host;
    # ... other headers
}
Key Learning: Order matters! Place /static/ location block before generic / location block.
3. Dark Mode Not Working Across Pages
Problem: Dark mode only worked on profile page, not on dashboard, flights, or other pages.
Root Cause: main.js with dark mode CSS wasn't loaded on all pages.
Solution:

Created centralized main.js with dark mode styles
Added <script src="{{ url_for('static', filename='js/main.js') }}"></script> to all templates
Used CSS variables for consistent theming:

javascript// main.js injects dark mode styles dynamically
const darkModeCSS = `
    [data-theme="dark"] {
        --alu-primary: #FF6B35 !important;
        --bg-light: #2a2a2a !important;
        // ... more variables
    }
`;
4. Footer Not Positioned Correctly
Problem: Footer was visible on page load instead of only when scrolling to bottom.
Root Cause: Used position: fixed or margin-top: auto with flexbox incorrectly.
Solution:
css/* Removed flexbox from body for pages where footer should be at bottom */
body {
    background: #f5f7fa;
    margin: 0;
    /* Removed: display: flex; flex-direction: column; */
}

.footer {
    background: #333;
    padding: 40px 20px;
    margin-top: 100px;  /* Natural spacing */
    position: relative;  /* Not fixed */
}
5. Hardcoded HTML Links Breaking Navigation
Problem: Links like href="login.html" caused 404 errors in production.
Root Cause: Using .html file extensions instead of Flask routes.
Solution: Replace all hardcoded links with Flask's url_for():
html<!-- Wrong -->
<a href="dashboard.html">Dashboard</a>
<a href="../auth/login.html">Login</a>

<!-- Correct -->
<a href="{{ url_for('dashboard') }}">Dashboard</a>
<a href="{{ url_for('auth.login') }}">Login</a>
6. Gunicorn Service Not Starting
Problem: systemctl start flighthub failed silently.
Solution:
bash# Check logs
sudo journalctl -u flighthub -n 50

# Common fixes:
# 1. Wrong path in ExecStart
# 2. Missing wsgi.py file
# 3. Virtual environment not activated
# 4. Port already in use

# Verify manually first
cd ~/flight-hub
source venv/bin/activate
gunicorn --bind 127.0.0.1:8000 wsgi:app
7. SSL Certificate Issues
Problem: Certbot failed to obtain certificate.
Solution:
bash# Ensure domain points to load balancer IP
dig atigbi.tech

# Temporarily stop nginx
sudo systemctl stop nginx

# Try standalone mode
sudo certbot certonly --standalone -d atigbi.tech -d www.atigbi.tech

# Restart nginx
sudo systemctl start nginx
8. Database Sync Issues Between Servers
Problem: Users couldn't login on web-02 after registering on web-01.
Solution Options:

Use centralized database (MySQL on separate server)
Database replication (master-slave setup)
Session storage (Redis for session data)

Currently using SQLite per server (acceptable for demo, not for production scale).
9. Aircraft Map Not Loading
Problem: Live aircraft map showed 0 aircraft despite API working.
Root Cause: OpenSky Network API rate limiting (10 seconds between requests).
Solution:
javascript// Added rate limit handling
const MIN_INTERVAL = 12000; // 12 seconds
let rateLimitedUntil = 0;

if (res.status === 429) {
    rateLimitedUntil = Date.now() + 15000;
    // Wait before retry
}
10. File Permissions Issues
Problem: Nginx couldn't read static files (403 Forbidden).
Solution:
bash# Fix permissions
sudo chmod 755 /home/ubuntu/flight-hub
sudo chmod -R 755 /home/ubuntu/flight-hub/static

# If nginx runs as www-data
sudo chown -R www-data:www-data /home/ubuntu/flight-hub/static

 Dark Mode Implementation
Architecture
Dark mode is implemented using:

CSS Custom Properties for theming
Data attribute (data-theme="dark") on <html> element
localStorage for persistence
Centralized JavaScript in main.js

How It Works

On Page Load:

javascript// main.js checks localStorage
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
}

CSS Responds to Attribute:

css[data-theme="dark"] {
    --alu-primary: #FF6B35;
    --bg-light: #2a2a2a;
    --text-dark: #e0e0e0;
}

[data-theme="dark"] body {
    background: #121212 !important;
    color: #e0e0e0 !important;
}

Toggle Function:

javascriptfunction toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}
Color Scheme
Light Mode:

Primary: #FF6B35 (ALU Orange)
Secondary: #5B2C6F (ALU Purple)
Background: #f5f7fa
Text: #333

Dark Mode:

Primary: #FF6B35 (Same orange, good contrast)
Secondary: #5B2C6F (Same purple)
Background: #121212
Text: #e0e0e0


 Security
Implemented Security Measures

Password Hashing: Werkzeug's generate_password_hash()
CSRF Protection: Flask-WTF
SQL Injection Prevention: SQLAlchemy ORM
XSS Protection: Jinja2 auto-escaping
Secure Session Cookies: HttpOnly, Secure flags
HTTPS: Let's Encrypt SSL/TLS
Environment Variables: Sensitive data not in code
Login Required Decorator: Protected routes

Security Best Practices
python# Password hashing
from werkzeug.security import generate_password_hash, check_password_hash

hashed = generate_password_hash(password, method='pbkdf2:sha256')
valid = check_password_hash(hashed_password, password)

# Session security
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Login protection
from flask_login import login_required

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

 Performance Optimization
Caching Strategy

Application-Level Caching: Cache API responses in memory/database
Static File Caching: Nginx serves with long expiration
Browser Caching: Cache-Control headers

nginxlocation /static/ {
    alias /home/ubuntu/flight-hub/static/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
Database Optimization
python# Use indexes for frequent queries
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
Load Balancing Benefits

Redundancy: If one server fails, other continues
Performance: Distribute load across servers
Zero-downtime Deployments: Update one server at a time


 Contributing
Contributions are welcome! Please follow these steps:

Fork the repository
Create a feature branch (git checkout -b feature/AmazingFeature)
Commit your changes (git commit -m 'Add some AmazingFeature')
Push to the branch (git push origin feature/AmazingFeature)
Open a Pull Request

Development Guidelines

Follow PEP 8 style guide
Write descriptive commit messages
Add comments for complex logic
Test thoroughly before submitting PR


 License
This project is licensed under the MIT License - see the LICENSE file for details.

 Author
Emmanuel Atigbi

Email: e.atigbi@alustudent.com
GitHub: @Airman-web
Project: FlightHub


 Acknowledgments

AviationStack for flight data API
OpenWeatherMap for weather data API
OpenSky Network for live aircraft tracking
ALU (African Leadership University) for education and support
Let's Encrypt for free SSL certificates
Flask and Python communities


 Support
For issues, questions, or suggestions:

Open an issue on GitHub
Email: e.atigbi@alustudent.com


Made with the love of Aviation by Emmanuel Atigbi | FlightHub © 2024
