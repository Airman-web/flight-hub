// Global data storage
let flightsData = [];
let airportsData = [];
let airlinesData = [];
let aircraftData = [];

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    setupTabs();
    loadCacheInfo();
});

// Tab functionality
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Remove active class from all tabs and buttons
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            tabBtns.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked tab
            document.getElementById(targetTab).classList.add('active');
            this.classList.add('active');
        });
    });
}

// Show/hide loading spinner
function showLoading(show = true) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

// Display error message
function showError(container, message) {
    const errorHTML = `
        <div class="error-message">
            <strong>Error:</strong> ${message}
        </div>
    `;
    document.getElementById(container).innerHTML = errorHTML;
}

// FLIGHTS FUNCTIONS
async function searchFlights() {
    showLoading();
    
    const flightNumber = document.getElementById('flight-number').value.trim();
    const depAirport = document.getElementById('departure-airport').value.trim();
    const arrAirport = document.getElementById('arrival-airport').value.trim();
    const airlineCode = document.getElementById('airline-code').value.trim();
    const flightStatus = document.getElementById('flight-status').value;
    
    let url = '/api/flights?';
    
    if (flightNumber) url += `flight_iata=${flightNumber}&`;
    if (depAirport) url += `dep_iata=${depAirport}&`;
    if (arrAirport) url += `arr_iata=${arrAirport}&`;
    if (airlineCode) url += `airline_iata=${airlineCode}&`;
    if (flightStatus) url += `flight_status=${flightStatus}&`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            showError('flights-results', data.error.message || 'Failed to fetch flights');
            flightsData = [];
        } else if (data.data && data.data.length > 0) {
            flightsData = data.data;
            displayFlights(flightsData);
        } else {
            document.getElementById('flights-results').innerHTML = 
                '<div class="empty-state"><p>No flights found. Try different search criteria.</p></div>';
            flightsData = [];
        }
    } catch (error) {
        showError('flights-results', 'Network error: ' + error.message);
        flightsData = [];
    }
    
    showLoading(false);
    loadCacheInfo();
}

function displayFlights(flights) {
    const container = document.getElementById('flights-results');
    
    if (!flights || flights.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No flights to display</p></div>';
        return;
    }
    
    let html = '';
    
    flights.forEach(flight => {
        const status = flight.flight_status || 'unknown';
        const delay = flight.departure?.delay || 0;
        const isDelayed = delay > 0;
        
        html += `
            <div class="flight-card">
                <div class="flight-header">
                    <span class="flight-number">
                        ${flight.airline?.name || 'Unknown'} 
                        ${flight.flight?.iata || flight.flight?.number || 'N/A'}
                    </span>
                    <span class="flight-status status-${status}">
                        ${status}
                    </span>
                </div>
                
                <div class="flight-route">
                    <div class="airport-info">
                        <div class="airport-code">${flight.departure?.iata || 'N/A'}</div>
                        <div class="airport-name">${flight.departure?.airport || 'Unknown Airport'}</div>
                    </div>
                    <div class="route-arrow">✈️</div>
                    <div class="airport-info">
                        <div class="airport-code">${flight.arrival?.iata || 'N/A'}</div>
                        <div class="airport-name">${flight.arrival?.airport || 'Unknown Airport'}</div>
                    </div>
                </div>
                
                <div class="flight-details">
                    <div class="detail-item">
                        <span class="detail-label">Flight Date</span>
                        <span class="detail-value">${flight.flight_date || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Departure</span>
                        <span class="detail-value">${formatTime(flight.departure?.scheduled)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Arrival</span>
                        <span class="detail-value">${formatTime(flight.arrival?.scheduled)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Terminal</span>
                        <span class="detail-value">
                            ${flight.departure?.terminal || 'N/A'} → ${flight.arrival?.terminal || 'N/A'}
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Gate</span>
                        <span class="detail-value">
                            ${flight.departure?.gate || 'N/A'} → ${flight.arrival?.gate || 'N/A'}
                        </span>
                    </div>
                    ${isDelayed ? `
                    <div class="detail-item">
                        <span class="detail-label">Delay</span>
                        <span class="detail-value">
                            <span class="delay-badge">${delay} min</span>
                        </span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Sort flights
function sortFlights() {
    const sortBy = document.getElementById('flight-sort').value;
    
    if (!flightsData || flightsData.length === 0) return;
    
    flightsData.sort((a, b) => {
        switch(sortBy) {
            case 'departure':
                return new Date(a.departure?.scheduled) - new Date(b.departure?.scheduled);
            case 'arrival':
                return new Date(a.arrival?.scheduled) - new Date(b.arrival?.scheduled);
            case 'delay':
                return (b.departure?.delay || 0) - (a.departure?.delay || 0);
            case 'airline':
                return (a.airline?.name || '').localeCompare(b.airline?.name || '');
            case 'status':
                return (a.flight_status || '').localeCompare(b.flight_status || '');
            default:
                return 0;
        }
    });
    
    displayFlights(flightsData);
}

// Filter flights
function filterFlights() {
    const filter = document.getElementById('status-filter').value;
    
    if (!flightsData || flightsData.length === 0) return;
    
    let filtered = flightsData;
    
    if (filter === 'delayed') {
        filtered = flightsData.filter(f => (f.departure?.delay || 0) > 0);
    } else if (filter !== 'all') {
        filtered = flightsData.filter(f => f.flight_status === filter);
    }
    
    displayFlights(filtered);
}

// Search in results
function searchInResults() {
    const searchTerm = document.getElementById('search-box').value.toLowerCase();
    
    if (!searchTerm) {
        displayFlights(flightsData);
        return;
    }
    
    const filtered = flightsData.filter(flight => {
        const flightNumber = (flight.flight?.iata || '').toLowerCase();
        const airline = (flight.airline?.name || '').toLowerCase();
        const depAirport = (flight.departure?.airport || '').toLowerCase();
        const arrAirport = (flight.arrival?.airport || '').toLowerCase();
        
        return flightNumber.includes(searchTerm) || 
               airline.includes(searchTerm) ||
               depAirport.includes(searchTerm) ||
               arrAirport.includes(searchTerm);
    });
    
    displayFlights(filtered);
}

// AIRPORTS FUNCTIONS
async function loadAirports() {
    showLoading();
    
    try {
        const response = await fetch('/api/airports');
        const data = await response.json();
        
        if (data.error) {
            showError('airports-results', data.error.message || 'Failed to fetch airports');
            airportsData = [];
        } else if (data.data && data.data.length > 0) {
            airportsData = data.data;
            displayAirports(airportsData);
        } else {
            showError('airports-results', 'No airport data available');
            airportsData = [];
        }
    } catch (error) {
        showError('airports-results', 'Network error: ' + error.message);
        airportsData = [];
    }
    
    showLoading(false);
    loadCacheInfo();
}

function displayAirports(airports) {
    const container = document.getElementById('airports-results');
    
    if (!airports || airports.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No airports to display</p></div>';
        return;
    }
    
    let html = '';
    
    airports.forEach(airport => {
        html += `
            <div class="info-card">
                <h3>${airport.airport_name || 'Unknown Airport'}</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">IATA Code:</span>
                        <span class="info-value">${airport.iata_code || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">ICAO Code:</span>
                        <span class="info-value">${airport.icao_code || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Country:</span>
                        <span class="info-value">${airport.country_name || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Timezone:</span>
                        <span class="info-value">${airport.timezone || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Location:</span>
                        <span class="info-value">${airport.latitude || 'N/A'}, ${airport.longitude || 'N/A'}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function searchAirports() {
    const searchTerm = document.getElementById('airport-search').value.toLowerCase();
    
    if (!searchTerm) {
        displayAirports(airportsData);
        return;
    }
    
    const filtered = airportsData.filter(airport => {
        const name = (airport.airport_name || '').toLowerCase();
        const iata = (airport.iata_code || '').toLowerCase();
        const country = (airport.country_name || '').toLowerCase();
        
        return name.includes(searchTerm) || 
               iata.includes(searchTerm) ||
               country.includes(searchTerm);
    });
    
    displayAirports(filtered);
}

// AIRLINES FUNCTIONS
async function loadAirlines() {
    showLoading();
    
    try {
        const response = await fetch('/api/airlines');
        const data = await response.json();
        
        if (data.error) {
            showError('airlines-results', data.error.message || 'Failed to fetch airlines');
            airlinesData = [];
        } else if (data.data && data.data.length > 0) {
            airlinesData = data.data;
            displayAirlines(airlinesData);
        } else {
            showError('airlines-results', 'No airline data available');
            airlinesData = [];
        }
    } catch (error) {
        showError('airlines-results', 'Network error: ' + error.message);
        airlinesData = [];
    }
    
    showLoading(false);
    loadCacheInfo();
}

function displayAirlines(airlines) {
    const container = document.getElementById('airlines-results');
    
    if (!airlines || airlines.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No airlines to display</p></div>';
        return;
    }
    
    let html = '';
    
    airlines.forEach(airline => {
        html += `
            <div class="info-card">
                <h3>${airline.airline_name || 'Unknown Airline'}</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">IATA Code:</span>
                        <span class="info-value">${airline.iata_code || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">ICAO Code:</span>
                        <span class="info-value">${airline.icao_code || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Callsign:</span>
                        <span class="info-value">${airline.callsign || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Country:</span>
                        <span class="info-value">${airline.country_name || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Fleet Size:</span>
                        <span class="info-value">${airline.fleet_size || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status:</span>
                        <span class="info-value">${airline.status || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Founded:</span>
                        <span class="info-value">${airline.date_founded || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Hub Code:</span>
                        <span class="info-value">${airline.hub_code || 'N/A'}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function searchAirlines() {
    const searchTerm = document.getElementById('airline-search').value.toLowerCase();
    
    if (!searchTerm) {
        displayAirlines(airlinesData);
        return;
    }
    
    const filtered = airlinesData.filter(airline => {
        const name = (airline.airline_name || '').toLowerCase();
        const iata = (airline.iata_code || '').toLowerCase();
        const country = (airline.country_name || '').toLowerCase();
        
        return name.includes(searchTerm) || 
               iata.includes(searchTerm) ||
               country.includes(searchTerm);
    });
    
    displayAirlines(filtered);
}

// AIRCRAFT FUNCTIONS
async function loadAircraft() {
    showLoading();
    
    try {
        const response = await fetch('/api/aircraft');
        const data = await response.json();
        
        if (data.error) {
            showError('aircraft-results', data.error.message || 'Failed to fetch aircraft');
            aircraftData = [];
        } else if (data.data && data.data.length > 0) {
            aircraftData = data.data;
            displayAircraft(aircraftData);
        } else {
            showError('aircraft-results', 'No aircraft data available');
            aircraftData = [];
        }
    } catch (error) {
        showError('aircraft-results', 'Network error: ' + error.message);
        aircraftData = [];
    }
    
    showLoading(false);
    loadCacheInfo();
}

function displayAircraft(aircraft) {
    const container = document.getElementById('aircraft-results');
    
    if (!aircraft || aircraft.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No aircraft to display</p></div>';
        return;
    }
    
    let html = '';
    
    aircraft.forEach(plane => {
        html += `
            <div class="info-card">
                <h3>${plane.model_name || 'Unknown'} - ${plane.registration_number || 'N/A'}</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">IATA Type:</span>
                        <span class="info-value">${plane.iata_type || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Production Line:</span>
                        <span class="info-value">${plane.production_line || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Model Code:</span>
                        <span class="info-value">${plane.model_code || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Owner:</span>
                        <span class="info-value">${plane.plane_owner || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Age:</span>
                        <span class="info-value">${plane.plane_age || 'N/A'} years</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status:</span>
                        <span class="info-value">${plane.plane_status || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Engines:</span>
                        <span class="info-value">${plane.engines_count || 'N/A'} (${plane.engines_type || 'N/A'})</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function searchAircraft() {
    const searchTerm = document.getElementById('aircraft-search').value.toLowerCase();
    
    if (!searchTerm) {
        displayAircraft(aircraftData);
        return;
    }
    
    const filtered = aircraftData.filter(plane => {
        const model = (plane.model_name || '').toLowerCase();
        const registration = (plane.registration_number || '').toLowerCase();
        const owner = (plane.plane_owner || '').toLowerCase();
        
        return model.includes(searchTerm) || 
               registration.includes(searchTerm) ||
               owner.includes(searchTerm);
    });
    
    displayAircraft(filtered);
}

// UTILITY FUNCTIONS
function formatTime(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch (e) {
        return dateString;
    }
}

// LIVE AIRCRAFT MAP
async function loadLiveAircraft(bounds = null) {
    showLoading();

    let url = '/api/aircraft/live';
    
    if (bounds) {
        // bounds = {lamin, lomin, lamax, lomax}
        url = `/api/aircraft/live/box?lamin=${bounds.lamin}&lomin=${bounds.lomin}&lamax=${bounds.lamax}&lomax=${bounds.lomax}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success || !data.aircraft) {
            console.warn('No live aircraft data:', data.error || 'Unknown error');
            return;
        }

        aircraftData = data.aircraft; // store for search/filter if needed

        updateAircraftMarkers(aircraftData);

    } catch (error) {
        console.warn('Failed to load live aircraft:', error.message);
    }

    showLoading(false);
}

let aircraftMarkers = [];

function updateAircraftMarkers(aircraftList) {
    // Clear previous markers
    aircraftMarkers.forEach(marker => map.removeLayer(marker));
    aircraftMarkers = [];

    aircraftList.forEach(plane => {
        if (plane.lat != null && plane.lng != null) {
            const marker = L.marker([plane.lat, plane.lng])
                .bindPopup(`
                    <strong>${plane.callsign || plane.icao24}</strong><br>
                    Country: ${plane.country || 'N/A'}<br>
                    Altitude: ${plane.altitude || 0} m<br>
                    Velocity: ${plane.velocity || 0} m/s
                `)
                .addTo(map);

            aircraftMarkers.push(marker);
        }
    });
}


async function loadCacheInfo() {
    try {
        const response = await fetch('/api/cache/info');
        
        if (!response.ok) {
            console.warn(`Cache info endpoint not available: ${response.status}`);
            return;  // This should stop execution
        }
        
        const data = await response.json();  // Only parse if response.ok is true
        
        const cacheElement = document.getElementById('cache-info');
        if (cacheElement && data && typeof data === 'object') {
            const total = data.total_cached_items ?? 0;
            const calls = data.api_calls_made ?? 0;
            cacheElement.textContent = `Cached Items: ${total} | API Calls Made: ${calls}`;
        }
    } catch (error) {
        console.warn('Cache info unavailable:', error && error.message ? error.message : error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setupTabs();
    loadCacheInfo();

    // If map tab exists, start loading live aircraft every 10s
    if (document.getElementById('aircraft-map')) {
        loadLiveAircraft();
        setInterval(() => loadLiveAircraft(), 10000); // refresh every 10s
    }
});

// Main.js - Dark Mode for All Pages
(function() {
    'use strict';
    
    // Create and inject dark mode styles
    const darkModeCSS = `
        /* Dark Mode Global Variables - Matching Profile.html */
        [data-theme="dark"] {
            --alu-primary: #FF6B35 !important;
            --alu-secondary: #5B2C6F !important;
            --alu-primary-shadow: rgba(255, 107, 53, 0.4) !important;
            --white: #1a1a1a !important;
            --light-gray: #121212 !important;
            --border-gray: #333 !important;
            --text-dark: #e0e0e0 !important;
            --bg-light: #2a2a2a !important;
        }
        
        /* Body & Background */
        [data-theme="dark"] body {
            background: #121212 !important;
            color: #FF6B35 !important;
        }
        
        /* Navigation */
        [data-theme="dark"] .navbar {
            background: #1a1a1a !important;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5) !important;
        }
        
        [data-theme="dark"] .nav-brand {
            color: #FF6B35 !important;
        }
        
        [data-theme="dark"] .nav-links a {
            color: #e0e0e0 !important;
        }
        
        [data-theme="dark"] .nav-links a:hover {
            color: #FF6B35 !important;
        }
        
        [data-theme="dark"] .user-link {
            color: #FF6B35 !important;
        }
        
        [data-theme="dark"] .btn-logout {
            background: #FF6B35 !important;
        }
        
        /* Header */
        [data-theme="dark"] .header {
            background: #121212 !important;
        }
        
        [data-theme="dark"] .header-content {
            background: #2a2a2a !important;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5) !important;
        }
        
        [data-theme="dark"] .header h1,
        [data-theme="dark"] .header p {
            color: #FF6B35 !important;
        }
        
        /* Cards & Containers */
        [data-theme="dark"] .feature-card,
        [data-theme="dark"] .stat-card,
        [data-theme="dark"] .action-btn,
        [data-theme="dark"] .info-card,
        [data-theme="dark"] .profile-card,
        [data-theme="dark"] .flight-card,
        [data-theme="dark"] .search-section,
        [data-theme="dark"] .results-container,
        [data-theme="dark"] .auth-card,
        [data-theme="dark"] .modal-content,
        [data-theme="dark"] .history-item {
            background: #1a1a1a !important;
            color: #e0e0e0 !important;
            border-color: #333 !important;
        }
        
        [data-theme="dark"] .feature-card:hover,
        [data-theme="dark"] .flight-card:hover {
            background: #2a2a2a !important;
        }
        
        /* Sections */
        [data-theme="dark"] .stats-section,
        [data-theme="dark"] .quick-actions,
        [data-theme="dark"] .info-section {
            background: #1a1a1a !important;
        }
        
        [data-theme="dark"] .features-section h2 {
            color: #FF6B35 !important;
        }
        
        [data-theme="dark"] .stats-section h2,
        [data-theme="dark"] .quick-actions h2,
        [data-theme="dark"] .info-section h2,
        [data-theme="dark"] .feature-card h3,
        [data-theme="dark"] .search-section h2 {
            color: #FF6B35 !important;
        }
        
        /* Text Elements */
        [data-theme="dark"] .feature-card p,
        [data-theme="dark"] .stat-label,
        [data-theme="dark"] .detail-label,
        [data-theme="dark"] .info-label,
        [data-theme="dark"] .airport-name,
        [data-theme="dark"] .subtitle {
            color: #b0b0b0 !important;
        }
        
        [data-theme="dark"] .airport-code,
        [data-theme="dark"] .flight-number,
        [data-theme="dark"] .detail-value,
        [data-theme="dark"] .info-value,
        [data-theme="dark"] .stat-number {
            color: #FF6B35 !important;
        }
        
        /* Icons */
        [data-theme="dark"] .feature-icon,
        [data-theme="dark"] .route-arrow {
            color: #FF6B35 !important;
        }
        
        [data-theme="dark"] .feature-card h3,
        [data-theme="dark"] .profile-card h2,
        [data-theme="dark"] .profile-card h2 i,
        [data-theme="dark"] .info-item label,
        [data-theme="dark"] .info-item label i {
            color: #FF6B35 !important;
        }
        
        /* Forms & Inputs */
        [data-theme="dark"] input:not([type="checkbox"]):not([type="radio"]),
        [data-theme="dark"] select,
        [data-theme="dark"] textarea {
            background: #2a2a2a !important;
            color: #e0e0e0 !important;
            border-color: #444 !important;
        }
        
        [data-theme="dark"] input:focus,
        [data-theme="dark"] select:focus,
        [data-theme="dark"] textarea:focus {
            background: #333 !important;
            border-color: #FF6B35 !important;
        }
        
        [data-theme="dark"] .input-group label,
        [data-theme="dark"] .control-group label,
        [data-theme="dark"] .form-group label {
            color: #FF6B35 !important;
        }
        
        /* Buttons */
        [data-theme="dark"] .btn-secondary {
            background: #2a2a2a !important;
            color: #e0e0e0 !important;
            border-color: #444 !important;
        }
        
        [data-theme="dark"] .btn-secondary:hover {
            background: #FF6B35 !important;
            color: white !important;
        }
        
        [data-theme="dark"] .action-btn {
            background: #1a1a1a !important;
            border-color: #444 !important;
        }
        
        [data-theme="dark"] .action-btn:hover {
            background: #FF6B35 !important;
            color: white !important;
        }
        
        [data-theme="dark"] .btn-primary {
            background: #FF6B35 !important;
        }
        
        /* Tabs */
        [data-theme="dark"] .auth-tabs,
        [data-theme="dark"] .tabs {
            border-bottom-color: #333 !important;
        }
        
        [data-theme="dark"] .auth-tab,
        [data-theme="dark"] .tab-btn {
            color: #b0b0b0 !important;
            background: #1a1a1a !important;
        }
        
        [data-theme="dark"] .auth-tab.active,
        [data-theme="dark"] .tab-btn.active {
            color: #FF6B35 !important;
            border-bottom-color: #FF6B35 !important;
        }
        
        /* Stat Cards - Special handling for colored backgrounds */
        [data-theme="dark"] .stat-card {
            background: #2a2a2a !important;
            color: #e0e0e0 !important;
        }
        
        /* Footer */
        [data-theme="dark"] .footer {
            background: #0a0a0a !important;
            color: #e0e0e0 !important;
        }
        
        [data-theme="dark"] .footer p {
            color: #e0e0e0 !important;
        }
        
        [data-theme="dark"] .footer a {
            color: #FF6B35 !important;
        }
        
        [data-theme="dark"] .footer a:hover {
            color: #5B2C6F !important;
        }
        
        /* About Page Specific */
        [data-theme="dark"] .hero,
        [data-theme="dark"] .mission,
        [data-theme="dark"] .features,
        [data-theme="dark"] .how-it-works,
        [data-theme="dark"] .apis,
        [data-theme="dark"] .technology,
        [data-theme="dark"] .contact {
            background: #121212 !important;
        }
        
        [data-theme="dark"] .hero h1,
        [data-theme="dark"] .hero p,
        [data-theme="dark"] .mission h2,
        [data-theme="dark"] .mission p {
            color: #FF6B35 !important;
        }
        
        [data-theme="dark"] .api-card,
        [data-theme="dark"] .tech-item,
        [data-theme="dark"] .contact-item,
        [data-theme="dark"] .use-case,
        [data-theme="dark"] .smart-card {
            background: #1a1a1a !important;
        }
        
        [data-theme="dark"] .tech-item {
            background: #1a1a1a !important;
            border-left-color: #FF6B35 !important;
        }
        
        /* Flight Cards */
        [data-theme="dark"] .flight-card {
            border-bottom-color: #333 !important;
        }
        
        [data-theme="dark"] .flight-card:hover {
            background: #2a2a2a !important;
        }
        
        /* Empty States & Messages */
        [data-theme="dark"] .empty-state,
        [data-theme="dark"] .error-message {
            color: #b0b0b0 !important;
            background: #1a1a1a !important;
        }
        
        /* Controls */
        [data-theme="dark"] .controls {
            background: #1a1a1a !important;
        }
        
        /* Loading Spinner */
        [data-theme="dark"] .loading {
            background: rgba(0, 0, 0, 0.95) !important;
        }
        
        /* Alerts */
        [data-theme="dark"] .alert {
            background: #2a2a2a !important;
            color: #e0e0e0 !important;
        }
        
        [data-theme="dark"] .alert-success {
            background: #1a3a1a !important;
            border-left-color: #4CAF50 !important;
        }
        
        [data-theme="dark"] .alert-error {
            background: #3a1a1a !important;
            border-left-color: #f44336 !important;
        }
        
        /* Info Items */
        [data-theme="dark"] .info-item,
        [data-theme="dark"] .preference-item,
        [data-theme="dark"] .detail-item,
        [data-theme="dark"] .cache-details {
            background: #2a2a2a !important;
        }
        
        /* Auth Links */
        [data-theme="dark"] .auth-links {
            border-top-color: #333 !important;
        }
        
        [data-theme="dark"] .auth-links a {
            color: #FF8C61 !important;
        }
        
        [data-theme="dark"] .auth-footer {
            background: transparent !important;
            color: #b0b0b0 !important;
            border-top-color: #333 !important;
        }
        
        [data-theme="dark"] .auth-footer a {
            color: #FF8C61 !important;
        }
        
        /* Password Toggle */
        [data-theme="dark"] .password-toggle {
            background: #2a2a2a !important;
            border-color: #444 !important;
            color: #e0e0e0 !important;
        }
        
        [data-theme="dark"] .password-toggle:hover {
            background: #333 !important;
            border-color: #FF6B35 !important;
        }
        
        /* Step Numbers */
        [data-theme="dark"] .step-number {
            background: #FF6B35 !important;
        }
        
        /* Divider */
        [data-theme="dark"] .divider {
            color: #666 !important;
        }
        
        [data-theme="dark"] .divider::before,
        [data-theme="dark"] .divider::after {
            background: #333 !important;
        }
        
        /* Contact Items */
        [data-theme="dark"] .contact-item a,
        [data-theme="dark"] .api-link {
            color: #FF6B35 !important;
        }
        
        [data-theme="dark"] .contact-link {
            background: #FF6B35 !important;
        }
        
        [data-theme="dark"] .info-item {
            border-left-color: #FF6B35 !important;
        }
        
        [data-theme="dark"] .history-item {
            border-left-color: #FF6B35 !important;
        }
        
        [data-theme="dark"] .history-item strong {
            color: #5B2C6F !important;
        }
        
        /* Additional Override for Stubborn Elements */
        [data-theme="dark"] * {
            border-color: #333 !important;
        }
        
        [data-theme="dark"] h1, 
        [data-theme="dark"] h2, 
        [data-theme="dark"] h3, 
        [data-theme="dark"] h4, 
        [data-theme="dark"] h5, 
        [data-theme="dark"] h6 {
            color: #FF6B35!important;
        }
    `;
    
    // Create style element
    const styleElement = document.createElement('style');
    styleElement.id = 'dark-mode-styles';
    styleElement.textContent = darkModeCSS;
    document.head.appendChild(styleElement);
    
    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    // Listen for theme changes from other tabs/windows
    window.addEventListener('storage', function(e) {
        if (e.key === 'theme') {
            if (e.newValue === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
        }
    });
})();

// Toggle dark mode function (can be called from any page)
function toggleDarkMode() {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    if (isDarkMode) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
    
    // Trigger storage event for other tabs
    window.dispatchEvent(new Event('storage'));
    
    // Update toggle button if it exists
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.checked = !isDarkMode;
    }
}

// Initialize dark mode toggle on profile page if it exists
document.addEventListener('DOMContentLoaded', function() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        // Set initial state
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        darkModeToggle.checked = isDarkMode;
        
        // Add event listener
        darkModeToggle.addEventListener('change', toggleDarkMode);
    }
});