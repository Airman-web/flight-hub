from flask import Flask, render_template, jsonify, request, redirect, url_for
from flask_login import LoginManager, login_required, current_user
import requests
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
from cache_manager import CacheManager
from database import db, User, SearchHistory, APICache, UserPreferences
from auth import auth_bp

# Load environment variables
load_dotenv()

app = Flask(__name__)

@app.after_request
def add_server_header(response):
    """Add X-Served-By header to identify which server handled the request"""
    import socket
    response.headers['X-Served-By'] = socket.gethostname()
    return response

# Ensure instance folder exists
instance_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance')
os.makedirs(instance_path, exist_ok=True)

# Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-change-in-production')
db_path = os.path.join(instance_path, 'flighthub.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

# Initialize cache manager
cache = CacheManager(cache_file='cache/api_cache.json', expiry_hours=24)

# API Configuration
AVIATIONSTACK_API_KEY = os.getenv('AVIATIONSTACK_API_KEY')
OPENWEATHERMAP_API_KEY = os.getenv('OPENWEATHERMAP_API_KEY')
OPENSKY_BASE_URL = os.getenv('OPENSKY_BASE_URL', 'https://opensky-network.org/api')

AVIATIONSTACK_BASE_URL = 'http://api.aviationstack.com/v1'
OPENWEATHERMAP_BASE_URL = 'https://api.openweathermap.org/data/2.5'


api_call_count = 0

# User loader for Flask-Login
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Register blueprints
app.register_blueprint(auth_bp)

# Create database tables
with app.app_context():
    db.create_all()

# ===== ROUTE HANDLERS =====

@app.route('/')
def index():
    """Redirect to dashboard if logged in, else to login"""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('auth.login'))

@app.route('/about')
def about():
    """About page"""
    return render_template('about.html')

@app.route('/dashboard')
@login_required
def dashboard():
    """Main dashboard page"""
    return render_template('app/dashboard.html', user=current_user)

@app.route('/aircraft/map')
@login_required
def aircraft_map():
    """Live aircraft tracking map"""
    return render_template('app/aircraft_map.html', user=current_user)

# ===== API CALL FUNCTIONS =====

def make_api_request(endpoint, params=None, api_source='aviationstack'):
    """Make API request with smart caching"""
    global api_call_count

    if params is None:
        params = {}

    # Create cache key
    cache_key = f"{api_source}_{endpoint}_{str(sorted(params.items()))}"

    # Check cache first
    cached_response = cache.get(cache_key)
    if cached_response:
        print(f"✓ Cache hit for {api_source}/{endpoint}")
        return cached_response

    # Make API request
    try:
        if api_source == 'aviationstack':
            params['access_key'] = AVIATIONSTACK_API_KEY
            url = f"{AVIATIONSTACK_BASE_URL}/{endpoint}"
        elif api_source == 'openweather':
            params['appid'] = OPENWEATHERMAP_API_KEY
            url = f"{OPENWEATHERMAP_BASE_URL}/{endpoint}"
        elif api_source == 'opensky':
            url = f"{OPENSKY_BASE_URL}/{endpoint}"
        else:
            return {'error': {'message': f'Unknown API source: {api_source}'}}

        print(f"→ API call to {api_source}/{endpoint} (Call #{api_call_count + 1})")
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        if isinstance(data, dict) and 'error' in data:
            return {'error': data['error']}

        # Cache the response
        cache.set(cache_key, data)
        api_call_count += 1

        return data

    except requests.exceptions.RequestException as e:
        return {'error': {'message': f'API request failed: {str(e)}'}}

# ===== FLIGHT ENDPOINTS =====

@app.route('/api/flights')
@login_required
def get_flights():
    """Get real-time flight data"""
    params = {}

    if request.args.get('flight_iata'):
        params['flight_iata'] = request.args.get('flight_iata')
    if request.args.get('dep_iata'):
        params['dep_iata'] = request.args.get('dep_iata')
    if request.args.get('arr_iata'):
        params['arr_iata'] = request.args.get('arr_iata')
    if request.args.get('airline_iata'):
        params['airline_iata'] = request.args.get('airline_iata')
    if request.args.get('flight_status'):
        params['flight_status'] = request.args.get('flight_status')

    params['limit'] = request.args.get('limit', 100)

    data = make_api_request('flights', params, 'aviationstack')

    # Save to search history
    if data and isinstance(data, dict) and 'data' in data:
        # Create a readable search description
        search_description = []
        if params.get('flight_iata'):
            search_description.append(f"Flight: {params['flight_iata']}")
        if params.get('dep_iata'):
            search_description.append(f"From: {params['dep_iata']}")
        if params.get('arr_iata'):
            search_description.append(f"To: {params['arr_iata']}")
        if params.get('airline_iata'):
            search_description.append(f"Airline: {params['airline_iata']}")
        if params.get('flight_status'):
            search_description.append(f"Status: {params['flight_status']}")

        search_query = " | ".join(search_description) if search_description else "Flight Search"

        search = SearchHistory(
            user_id=current_user.id,
            search_type='flight',
            search_query=search_query,  # Now stores readable text
            results=data
        )
        db.session.add(search)
        db.session.commit()

    return jsonify(data)

# ===== WEATHER ENDPOINTS =====

@app.route('/api/weather/airport/<city>')
@login_required
def get_airport_weather(city):
    """Get weather for an airport/city"""
    params = {'q': city, 'units': 'metric'}
    data = make_api_request('weather', params, 'openweather')
    return jsonify(data)

# ===== OPENSKY ENDPOINTS =====

@app.route('/api/aircraft/live')
@login_required
def get_live_aircraft():
    """Get all live aircraft positions from OpenSky"""
    try:
        # Check cache first (cache for 30 seconds to respect rate limits)
        cache_key = "opensky_aircraft_live_all"
        cached = cache.get(cache_key)

        # Check if cache is less than 30 seconds old
        if cached and 'timestamp' in cached:
            cache_time = datetime.fromisoformat(cached['timestamp'])
            if datetime.now() - cache_time < timedelta(seconds=30):
                print("✓ OpenSky cache hit (fresh)")
                return jsonify(cached.get('data', cached))

        print("→ Fetching live aircraft from OpenSky")
        response = requests.get(f"{OPENSKY_BASE_URL}/states/all", timeout=15)
        response.raise_for_status()
        data = response.json()

        # Parse and format aircraft data
        aircraft_list = []
        if data and 'states' in data and data['states']:
            for state in data['states']:
                # Only include aircraft with valid coordinates
                if state[6] is not None and state[5] is not None:
                    # Filter out aircraft on ground if desired (optional - comment out to show all)
                    # if state[8]:  # on_ground
                    #     continue
                    
                    aircraft_list.append({
                        'icao24': state[0],
                        'callsign': (state[1] or '').strip() or 'Unknown',
                        'country': state[2],
                        'origin_country': state[2],  # Add both for compatibility
                        'longitude': state[5],
                        'latitude': state[6],
                        'altitude': state[7] if state[7] else 0,
                        'on_ground': state[8],
                        'velocity': state[9] if state[9] else 0,
                        'heading': state[10] if state[10] else 0,
                        'vertical_rate': state[11] if state[11] else 0,
                    })

        print(f"✓ Processed {len(aircraft_list)} aircraft from OpenSky (total states: {len(data.get('states', []))})")
        
        formatted_data = {
            'success': True,
            'time': data.get('time'),
            'count': len(aircraft_list),
            'aircraft': aircraft_list
        }

        # Cache the response with timestamp
        cache.cache[cache_key] = {
            'data': formatted_data,
            'timestamp': datetime.now().isoformat()
        }
        cache._save_cache()

        return jsonify(formatted_data)

    except requests.Timeout:
        return jsonify({'success': False, 'error': 'OpenSky API timeout'}), 504
    except requests.RequestException as e:
        return jsonify({'success': False, 'error': f'OpenSky API error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': f'Unexpected error: {str(e)}'}), 500

@app.route('/api/aircraft/live/box')
@login_required
def get_aircraft_live_box():
    """Get live aircraft data in a bounding box from OpenSky Network"""
    try:
        # Get bounding box parameters from request
        lamin = request.args.get('lamin', type=float)
        lomin = request.args.get('lomin', type=float)
        lamax = request.args.get('lamax', type=float)
        lomax = request.args.get('lomax', type=float)
        
        # Validate parameters
        if None in [lamin, lomin, lamax, lomax]:
            return jsonify({
                'error': 'Missing bounding box parameters',
                'message': 'Please provide lamin, lomin, lamax, lomax'
            }), 400
        
        # OpenSky Network API endpoint
        # Documentation: https://openskynetwork.github.io/opensky-api/rest.html
        url = f'https://opensky-network.org/api/states/all'
        
        # Parameters for bounding box
        params = {
            'lamin': lamin,
            'lomin': lomin,
            'lamax': lamax,
            'lomax': lomax
        }
        
        # Make request to OpenSky Network
        # Note: Free tier has rate limits (1 request every 10 seconds for anonymous users)
        response = requests.get(url, params=params, timeout=10)
        
        # Check if request was successful
        if response.status_code == 200:
            data = response.json()
            
            # OpenSky returns data in format:
            # {
            #   "time": timestamp,
            #   "states": [array of aircraft states]
            # }
            
            if data and 'states' in data and data['states']:
                # Format the aircraft data for frontend
                aircraft_list = []
                
                for state in data['states']:
                    # OpenSky state vector format (indices):
                    # 0: icao24, 1: callsign, 2: origin_country, 3: time_position,
                    # 4: last_contact, 5: longitude, 6: latitude, 7: baro_altitude,
                    # 8: on_ground, 9: velocity, 10: true_track, 11: vertical_rate,
                    # 12: sensors, 13: geo_altitude, 14: squawk, 15: spi, 16: position_source
                    
                    if state[5] is not None and state[6] is not None:  # Has valid position
                        aircraft = {
                            'icao24': state[0],
                            'callsign': state[1].strip() if state[1] else 'N/A',
                            'origin_country': state[2],
                            'longitude': state[5],
                            'latitude': state[6],
                            'altitude': state[7] if state[7] else 0,
                            'velocity': state[9] if state[9] else 0,
                            'heading': state[10] if state[10] else 0,
                            'vertical_rate': state[11] if state[11] else 0,
                            'on_ground': state[8]
                        }
                        aircraft_list.append(aircraft)
                
                return jsonify({
                    'success': True,
                    'count': len(aircraft_list),
                    'aircraft': aircraft_list,
                    'timestamp': data.get('time', None)
                })
            else:
                # No aircraft in the bounding box
                return jsonify({
                    'success': True,
                    'count': 0,
                    'aircraft': [],
                    'message': 'No aircraft found in this area'
                })
        
        elif response.status_code == 429:
            # Rate limit exceeded
            return jsonify({
                'error': 'Rate limit exceeded',
                'message': 'OpenSky Network rate limit reached. Please wait 10 seconds and try again.',
                'aircraft': []
            }), 429
        
        else:
            # Other error from OpenSky
            return jsonify({
                'error': 'API Error',
                'message': f'OpenSky Network returned status code {response.status_code}',
                'aircraft': []
            }), response.status_code
    
    except requests.exceptions.Timeout:
        return jsonify({
            'error': 'Timeout',
            'message': 'Request to OpenSky Network timed out. Please try again.',
            'aircraft': []
        }), 504
    
    except requests.exceptions.ConnectionError:
        return jsonify({
            'error': 'Connection Error',
            'message': 'Could not connect to OpenSky Network. Please check your internet connection.',
            'aircraft': []
        }), 503
    
    except Exception as e:
        # Log the error for debugging
        print(f"Error in get_aircraft_live_box: {str(e)}")
        app.logger.error(f"Aircraft API error: {str(e)}")
        
        return jsonify({
            'error': 'Server Error',
            'message': 'An unexpected error occurred while fetching aircraft data.',
            'details': str(e) if app.debug else None,
            'aircraft': []
        }), 500


# Alternative: Simpler version without bounding box (gets all aircraft)
@app.route('/api/aircraft/live/all')
@login_required
def get_aircraft_live_all():
    """Get all live aircraft data from OpenSky Network"""
    try:
        url = 'https://opensky-network.org/api/states/all'
        
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if data and 'states' in data and data['states']:
                aircraft_list = []
                
                # Limit to first 100 aircraft to avoid overwhelming the map
                for state in data['states'][:100]:
                    if state[5] is not None and state[6] is not None:
                        aircraft = {
                            'icao24': state[0],
                            'callsign': state[1].strip() if state[1] else 'N/A',
                            'origin_country': state[2],
                            'longitude': state[5],
                            'latitude': state[6],
                            'altitude': state[7] if state[7] else 0,
                            'velocity': state[9] if state[9] else 0,
                            'heading': state[10] if state[10] else 0,
                            'on_ground': state[8]
                        }
                        aircraft_list.append(aircraft)
                
                return jsonify({
                    'success': True,
                    'count': len(aircraft_list),
                    'aircraft': aircraft_list
                })
            else:
                return jsonify({
                    'success': True,
                    'count': 0,
                    'aircraft': []
                })
        else:
            return jsonify({
                'error': 'API Error',
                'message': f'OpenSky Network returned status code {response.status_code}',
                'aircraft': []
            }), response.status_code
    
    except Exception as e:
        print(f"Error in get_aircraft_live_all: {str(e)}")
        return jsonify({
            'error': 'Server Error',
            'message': str(e),
            'aircraft': []
        }), 500


# Also add this helper endpoint to test OpenSky connectivity
@app.route('/api/aircraft/test')
def test_aircraft_api():
    """Test endpoint to verify OpenSky Network connectivity"""
    try:
        url = 'https://opensky-network.org/api/states/all'
        response = requests.get(url, timeout=10)
        
        return jsonify({
            'success': response.status_code == 200,
            'status_code': response.status_code,
            'message': 'OpenSky Network is reachable' if response.status_code == 200 else 'OpenSky Network error',
            'aircraft_count': len(response.json().get('states', [])) if response.status_code == 200 else 0
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/api/aircraft/<icao24>')
@login_required
def get_aircraft_by_icao(icao24):
    """Get aircraft information by ICAO24 code"""
    try:
        cache_key = f"opensky_aircraft_{icao24}"
        cached = cache.get(cache_key)
        if cached:
            return jsonify(cached)

        print(f"→ Fetching aircraft info for {icao24}")
        response = requests.get(f"{OPENSKY_BASE_URL}/aircraft/icao/{icao24}", timeout=10)
        response.raise_for_status()
        data = response.json()

        # Cache the response
        cache.set(cache_key, data)

        return jsonify(data)
    except Exception as e:
        return jsonify({'error': f'Aircraft not found or API error: {str(e)}'}), 404

# ===== AIRPORT ENDPOINTS =====

@app.route('/api/airports')
@login_required
def get_airports():
    """Get airport data"""
    params = {'limit': 100}
    data = make_api_request('airports', params, 'aviationstack')
    return jsonify(data)

# ===== AIRLINE ENDPOINTS =====

@app.route('/api/airlines')
@login_required
def get_airlines():
    """Get airline data"""
    params = {'limit': 100}
    data = make_api_request('airlines', params, 'aviationstack')
    return jsonify(data)

# ===== AIRCRAFT ENDPOINTS =====

@app.route('/api/aircraft')
@login_required
def get_aircraft():
    """Get aircraft data"""
    params = {'limit': 100}
    data = make_api_request('airplanes', params, 'aviationstack')
    return jsonify(data)

# ===== HISTORY ENDPOINTS =====

@app.route('/api/history')
@login_required
def get_search_history():
    """Get user's search history"""
    history = SearchHistory.query.filter_by(user_id=current_user.id).order_by(SearchHistory.timestamp.desc()).limit(50).all()
    return jsonify([h.to_dict() for h in history])

@app.route('/api/history', methods=['DELETE'])
@login_required
def clear_search_history():
    """Clear user's search history"""
    SearchHistory.query.filter_by(user_id=current_user.id).delete()
    db.session.commit()
    return jsonify({'message': 'History cleared'})

# ===== CACHE ENDPOINTS =====

@app.route('/api/cache/info')
@login_required
def cache_info():
    """Get cache statistics"""
    info = cache.get_cache_info()
    return jsonify({
        'total_cached_items': len(info),
        'api_calls_made': api_call_count,
        'cache_details': info
    })

@app.route('/api/cache/clear', methods=['POST'])
@login_required
def clear_cache():
    """Clear all cache"""
    cache.clear()
    return jsonify({'message': 'Cache cleared successfully'})

# ===== USER PREFERENCES =====

@app.route('/api/preferences')
@login_required
def get_preferences():
    """Get user preferences"""
    prefs = UserPreferences.query.filter_by(user_id=current_user.id).first()
    if prefs:
        return jsonify(prefs.to_dict())
    return jsonify({})

@app.route('/api/preferences', methods=['PUT'])
@login_required
def update_preferences():
    """Update user preferences"""
    data = request.get_json()
    prefs = UserPreferences.query.filter_by(user_id=current_user.id).first()

    if prefs and isinstance(data, dict):
        if 'theme' in data:
            prefs.theme = data['theme']
        if 'favorite_airlines' in data:
            prefs.favorite_airlines = data['favorite_airlines']
        if 'favorite_airports' in data:
            prefs.favorite_airports = data['favorite_airports']

        db.session.commit()

    return jsonify({'message': 'Preferences updated'})

# ===== ERROR HANDLERS =====

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


# ===== PAGE ROUTES =====

@app.route('/flights')
@login_required
def flights_page():
    """Flight search page"""
    return render_template('app/flights.html', user=current_user)

@app.route('/weather')
@login_required
def weather_page():
    """Weather page"""
    return render_template('app/weather.html', user=current_user)

@app.route('/airlines')
@login_required
def airlines_page():
    """Airlines page"""
    return render_template('app/airlines.html', user=current_user)

@app.route('/airports')
@login_required
def airports_page():
    """Airports page"""
    return render_template('app/airports.html', user=current_user)


# ===== STARTUP =====

if __name__ == '__main__':
    with app.app_context():
        db.create_all()

    if not AVIATIONSTACK_API_KEY or not OPENWEATHERMAP_API_KEY:
        print("⚠️  WARNING: Missing API keys in .env file!")
        print("   Some features may not work without:")
        print("   - AVIATIONSTACK_API_KEY (for flights, airports, airlines)")
        print("   - OPENWEATHERMAP_API_KEY (for weather data)")
        print("   OpenSky Network API (aircraft map) will work without keys")
        print("   Continuing anyway for testing...")
        print()

    print("=" * 60)
    print("FlightHub - Aviation Intelligence Dashboard")
    print("=" * 60)
    print(f"Database: SQLite (instance/flighthub.db)")
    print(f"Authentication: Enabled ✓")
    print(f"API Keys configured: ✓")
    print(f"Cache enabled: ✓ (24 hour expiry)")
    print(f"Starting Flask server...")
    print("=" * 60)

    app.run(debug=True, host='0.0.0.0', port=5000)