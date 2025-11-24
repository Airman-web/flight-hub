# ✈️ FlightHub - Aviation Intelligence Dashboard

A comprehensive web application that provides real-time flight tracking, airport information, airline data, and aircraft details using the AviationStack API. Built with Flask (Python) backend and vanilla JavaScript frontend.

## 📋 Table of Contents
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Prerequisites](#prerequisites)
- [Local Installation & Setup](#local-installation--setup)
- [Server Deployment](#server-deployment)
- [Load Balancer Configuration](#load-balancer-configuration)
- [API Usage](#api-usage)
- [Project Structure](#project-structure)
- [Challenges & Solutions](#challenges--solutions)
- [Credits](#credits)

---

## 🚀 Features

### Core Functionality
- **Real-Time Flight Tracking**: Search and track flights by flight number, airport, airline, or status
- **Airport Directory**: Browse and search through 6,000+ global airports
- **Airline Database**: Explore detailed information about 13,000+ airlines worldwide
- **Aircraft Information**: View specifications and details of various aircraft

### User Interaction Features
- ✅ **Sort**: Order flights by departure time, arrival time, delay duration, airline, or status
- ✅ **Filter**: Filter flights by status (active, landed, scheduled, delayed, cancelled)
- ✅ **Search**: Real-time search within loaded results
- ✅ **Smart Caching**: Reduces API calls by caching responses for 24 hours

### Technical Features
- **Intelligent Caching System**: Minimizes API usage (important for free tier with 100 requests/month)
- **Error Handling**: Graceful handling of API failures and network errors
- **Responsive Design**: Mobile-friendly interface
- **Real-time Status Indicators**: Visual flight status badges with color coding

---

## 🛠️ Technologies Used

### Backend
- **Flask 3.0.0** - Python web framework
- **Python 3.8+** - Programming language
- **Requests 2.31.0** - HTTP library for API calls
- **python-dotenv 1.0.0** - Environment variable management

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling with modern gradients and animations
- **Vanilla JavaScript** - Client-side logic (no frameworks)

### API
- **AviationStack API** - Aviation data provider
  - Documentation: https://aviationstack.com/documentation

---

## 📦 Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- AviationStack API key (free tier available)
- Git

---

## 💻 Local Installation & Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/aviation-api-project.git
cd aviation-api-project
```

### Step 2: Create Virtual Environment
```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables
```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your API key
# Use nano, vim, or any text editor
nano .env
```

In the `.env` file, add your AviationStack API key:
```env
AVIATIONSTACK_API_KEY=your_actual_api_key_here
FLASK_ENV=development
FLASK_DEBUG=True
CACHE_EXPIRY_HOURS=24
```

**Get your free API key at**: https://aviationstack.com/signup/free

### Step 5: Create Cache Directory
```bash
mkdir -p cache
```

### Step 6: Run the Application
```bash
python app.py
```

The application will be available at: **http://localhost:5000**

---

## 🌐 Server Deployment

### Deploying to Web01 and Web02

#### Step 1: Connect to Server
```bash
ssh username@web01_ip_address
```

#### Step 2: Install Dependencies on Server
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and pip
sudo apt install python3 python3-pip python3-venv -y

# Install nginx (web server)
sudo apt install nginx -y
```

#### Step 3: Clone Repository on Server
```bash
cd /var/www
sudo git clone https://github.com/YOUR_USERNAME/aviation-api-project.git
cd aviation-api-project
```

#### Step 4: Set Up Virtual Environment on Server
```bash
sudo python3 -m venv venv
sudo chown -R $USER:$USER venv
source venv/bin/activate
pip install -r requirements.txt
```

#### Step 5: Configure Environment Variables
```bash
sudo nano .env
```
Add your API key and save.

#### Step 6: Set Up Gunicorn (Production WSGI Server)
```bash
# Install Gunicorn
pip install gunicorn

# Test Gunicorn
gunicorn --bind 0.0.0.0:5000 app:app
```

#### Step 7: Create Systemd Service File
```bash
sudo nano /etc/systemd/system/flighthub.service
```

Add the following content:
```ini
[Unit]
Description=FlightHub Aviation Dashboard
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/aviation-api-project
Environment="PATH=/var/www/aviation-api-project/venv/bin"
ExecStart=/var/www/aviation-api-project/venv/bin/gunicorn --workers 3 --bind 0.0.0.0:5000 app:app

[Install]
WantedBy=multi-user.target
```

#### Step 8: Start and Enable Service
```bash
sudo systemctl start flighthub
sudo systemctl enable flighthub
sudo systemctl status flighthub
```

#### Step 9: Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/flighthub
```

Add:
```nginx
server {
    listen 80;
    server_name web01_ip_address;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/flighthub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 10: Repeat for Web02
Follow the same steps on Web02 server.

---

## ⚖️ Load Balancer Configuration

### Setting Up Lb01 (Load Balancer)

#### Step 1: Connect to Load Balancer
```bash
ssh username@lb01_ip_address
```

#### Step 2: Install Nginx
```bash
sudo apt update
sudo apt install nginx -y
```

#### Step 3: Configure Load Balancer
```bash
sudo nano /etc/nginx/sites-available/flighthub-lb
```

Add this configuration:
```nginx
upstream flighthub_backend {
    # Round-robin load balancing
    server WEB01_IP_ADDRESS:80;
    server WEB02_IP_ADDRESS:80;
}

server {
    listen 80;
    server_name LB01_IP_ADDRESS;

    location / {
        proxy_pass http://flighthub_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health check settings
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_connect_timeout 5s;
    }
}
```

Replace:
- `WEB01_IP_ADDRESS` with your Web01 IP
- `WEB02_IP_ADDRESS` with your Web02 IP
- `LB01_IP_ADDRESS` with your Load Balancer IP

#### Step 4: Enable Configuration
```bash
sudo ln -s /etc/nginx/sites-available/flighthub-lb /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default config
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 5: Test Load Balancer
```bash
# Test multiple times to see round-robin in action
curl http://LB01_IP_ADDRESS
curl http://LB01_IP_ADDRESS
curl http://LB01_IP_ADDRESS
```

### Verification
1. Access the application via Load Balancer: `http://LB01_IP_ADDRESS`
2. Check nginx logs to verify traffic distribution:
```bash
# On Web01 and Web02
sudo tail -f /var/log/nginx/access.log
```
3. Test failover by stopping one web server and verifying the app still works

---

## 🔌 API Usage

### Available Endpoints

#### Frontend Routes
- `GET /` - Main application page

#### Backend API Routes
- `GET /api/flights` - Get flight data
  - Query params: `flight_iata`, `dep_iata`, `arr_iata`, `airline_iata`, `flight_status`
- `GET /api/airports` - Get airport data
- `GET /api/airlines` - Get airline data
- `GET /api/aircraft` - Get aircraft data
- `GET /api/cache/info` - Get cache statistics
- `POST /api/cache/clear` - Clear cache

### Example API Calls
```bash
# Search flights by departure airport
curl "http://localhost:5000/api/flights?dep_iata=JFK"

# Get all airports
curl "http://localhost:5000/api/airports"

# Get cache information
curl "http://localhost:5000/api/cache/info"
```

---

## 📁 Project Structure

```
aviation-api-project/
├── app.py                      # Flask application (main backend)
├── cache_manager.py            # Caching logic
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
├── README.md                   # This file
├── cache/
│   └── api_cache.json          # Cached API responses (auto-generated)
├── static/
│   ├── css/
│   │   └── style.css           # Application styling
│   └── js/
│       └── main.js             # Frontend JavaScript logic
└── templates/
    └── index.html              # Main HTML template
```

---

## 🧩 Challenges & Solutions

### Challenge 1: Limited API Calls (100/month on Free Tier)
**Problem**: Free tier only allows 100 API requests per month (~3 per day)

**Solution**: 
- Implemented intelligent caching system that stores API responses for 24 hours
- Cache manager prevents duplicate requests for the same data
- Reduces API usage by 90%+ during development and testing

### Challenge 2: No HTTPS Support on Free Tier
**Problem**: AviationStack free plan only supports HTTP (not HTTPS)

**Solution**:
- Used HTTP for API calls as documented
- Noted security limitation in documentation
- Recommended upgrade to paid plan for production use

### Challenge 3: No Search Parameter on Free Tier
**Problem**: Free tier doesn't support the `search` parameter for autocomplete

**Solution**:
- Implemented client-side filtering and searching
- Load full datasets and filter in JavaScript
- Provides similar user experience without API limitations

### Challenge 4: Deployment Complexity
**Problem**: Deploying to multiple servers and configuring load balancer

**Solution**:
- Created detailed step-by-step deployment guide
- Used systemd for process management
- Configured Nginx for reverse proxy and load balancing
- Tested failover scenarios

### Challenge 5: Error Handling
**Problem**: API can fail or return errors

**Solution**:
- Comprehensive try-catch blocks in both Python and JavaScript
- User-friendly error messages
- Graceful degradation when API is unavailable

---

## 🙏 Credits

### API Provider
- **AviationStack API** - https://aviationstack.com
  - Provides real-time flight data, airport information, airline details, and aircraft data
  - Free tier: 100 requests/month

### Technologies & Libraries
- **Flask** - https://flask.palletsprojects.com
- **Python Requests** - https://requests.readthedocs.io
- **Python dotenv** - https://github.com/theskumar/python-dotenv

### Developer
- **[Your Name]**
- GitHub: https://github.com/YOUR_USERNAME
- Email: your.email@example.com

---

## 📝 License

This project is for educational purposes as part of a university assignment.

---

## 🐛 Known Issues & Future Improvements

### Current Limitations
- Free tier API has 100 requests/month limit
- No HTTPS support on free tier
- Historical flight data not available on free tier

### Planned Improvements
- Add data visualization (charts/graphs)
- Implement user authentication
- Add flight alerts and notifications
- Create mobile app version
- Add more detailed analytics

---

## 📞 Support

For questions or issues:
1. Check the [AviationStack Documentation](https://aviationstack.com/documentation)
2. Review this README
3. Contact: your.email@example.com

---

**Last Updated**: November 2025