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
