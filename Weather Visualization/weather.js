/**
 * weather.js
 * This file contains the core functionality for the weather map visualization application.
 * It handles map initialization, data fetching, and rendering of weather data using canvas.
 */

// Initialize the Leaflet map with optimized settings for smooth performance
let map = L.map('map', {
    preferCanvas: true,  // Use canvas rendering for better performance
    renderer: L.canvas({
        padding: 0.5,    // Small padding to prevent edge artifacts
        tolerance: 0     // Zero tolerance for precise rendering
    }),
    zoomSnap: 0.1,      // Allow fine-grained zoom levels
    zoomDelta: 0.1,     // Smooth zoom transitions
    wheelPxPerZoomLevel: 120  // Adjust mouse wheel sensitivity
}).setView([37.0902, -95.7129], 4);  // Center on continental US

// Add the OpenStreetMap tile layer with high-resolution settings
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    tileSize: 256,
    zoomOffset: 0,
    maxNativeZoom: 19,
    tms: false,
    detectRetina: true  // Support for high DPI displays
}).addTo(map);

/**
 * Generates an optimized grid of coordinate points covering the continental United States
 * The grid includes additional points for important geographical features like the Great Lakes
 * @returns {Array} Array of [latitude, longitude] coordinate pairs
 */
const generateOptimizedGrid = () => {
    // Define the geographical boundaries of the continental US
    const latStart = 24.0;  // Southern boundary
    const latEnd = 50.0;    // Northern boundary
    const lonStart = -126.0; // Western boundary
    const lonEnd = -66.0;   // Eastern boundary
    const step = 0.25;      // Grid resolution in degrees

    const grid = [];
    const seen = new Set();  // Track unique coordinates

    // Generate primary grid points
    for (let lat = latStart; lat <= latEnd; lat += step) {
        const row = [];
        for (let lon = lonStart; lon <= lonEnd; lon += step) {
            const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
            if (!seen.has(key)) {
                // Round coordinates to 4 decimal places for consistency
                row.push([
                    Math.round(lat * 10000) / 10000,
                    Math.round(lon * 10000) / 10000
                ]);
                seen.add(key);
            }
        }
        // Sort each row for optimized API requests
        row.sort((a, b) => a[1] - b[1]);
        grid.push(...row);
    }

    // Add important geographical points for better coverage
    const extraPoints = [
        // Great Lakes region
        [45.5, -87.0], [46.5, -84.5], [43.5, -82.5], [42.5, -81.5], [44.0, -76.5],
        // US-Canada border regions
        [49.0, -123.0], [48.5, -120.0], [47.5, -95.0], [45.0, -83.0], [44.5, -75.0],
        // Coastal areas for better ocean-land transition
        [48.5, -124.5], [40.5, -124.0], [25.0, -81.0], [44.0, -67.0]
    ];

    // Add extra points if they don't already exist in the grid
    extraPoints.forEach(point => {
        const key = `${point[0].toFixed(4)},${point[1].toFixed(4)}`;
        if (!seen.has(key)) {
            grid.push(point);
            seen.add(key);
        }
    });

    return grid;
};

/**
 * WeatherDataManager class handles fetching and managing weather data
 * Includes batch processing and error handling capabilities
 */
class WeatherDataManager {
    constructor() {
        this.weatherData = [];
        this.apiKey = 'zTdChqFCDsm2vSJU';  // API key for Open-Meteo service
    }

    /**
     * Fetches weather data for given coordinates in optimized batches
     * @param {Array} coordinates Array of coordinate pairs
     * @param {Function} updateProgress Callback for updating progress UI
     * @returns {Promise<Array>} Processed weather data
     */
    async fetchData(coordinates, updateProgress) {
        const maxPointsPerRequest = 100;  // API request batch size limit
        const chunks = [];
        
        // Split coordinates into manageable chunks
        for (let i = 0; i < coordinates.length; i += maxPointsPerRequest) {
            chunks.push(coordinates.slice(i, i + maxPointsPerRequest));
        }

        let processedChunks = 0;
        const totalChunks = chunks.length;

        // Process each chunk of coordinates
        for (const chunk of chunks) {
            try {
                // Create comma-separated coordinate lists for API request
                const lats = chunk.map(coord => coord[0].toFixed(4)).join(',');
                const lons = chunk.map(coord => coord[1].toFixed(4)).join(',');
                
                // Construct API URL with parameters
                const url = `https://customer-api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&hourly=temperature_2m&temperature_unit=fahrenheit&forecast_days=1&models=gfs_graphcast025&apikey=${this.apiKey}`;
                
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();

                // Process response data
                if (Array.isArray(data)) {
                    data.forEach((point, index) => {
                        if (point.hourly && point.hourly.temperature_2m) {
                            this.weatherData.push({
                                coords: chunk[index],
                                temperatures: point.hourly.temperature_2m
                            });
                        }
                    });
                }

                // Update progress indicator
                processedChunks++;
                updateProgress(processedChunks / totalChunks * 100);
                
                // Rate limiting protection
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('Error fetching chunk:', error);
                chunks.push(chunk);  // Retry failed chunks
            }
        }

        return this.weatherData;
    }
}

/**
 * WeatherRenderer class handles the visual representation of weather data
 * Uses HTML5 Canvas for efficient rendering
 */
class WeatherRenderer {
    constructor(map) {
        this.map = map;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set up canvas overlay
        this.canvas.style.position = 'absolute';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.opacity = 0.8;
        map.getPanes().overlayPane.appendChild(this.canvas);

        // Bind map events
        map.on('moveend', () => this.draw());
        map.on('zoomend', () => this.draw());
        this.updateCanvasSize();
    }

    /**
     * Updates canvas size to match map container
     */
    updateCanvasSize() {
        const size = this.map.getSize();
        this.canvas.width = size.x;
        this.canvas.height = size.y;
        this.canvas.style.width = `${size.x}px`;
        this.canvas.style.height = `${size.y}px`;

        const topLeft = this.map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(this.canvas, topLeft);
    }

    /**
     * Generates color for temperature value using interpolation
     * @param {number} temp Temperature value
     * @returns {string} RGBA color string
     */
    getTemperatureColor(temp) {
        // Temperature color mapping table
        const colorTable = new Map([
            [-20, [138, 43, 226, 0.8]],  // Dark Violet for extreme cold
            [-10, [75, 0, 130, 0.8]],    // Indigo/purple
            [0, [0, 0, 255, 0.8]],       // Blue
            [10, [0, 100, 255, 0.8]],    // Light Blue
            [20, [0, 150, 255, 0.8]],    // Sky Blue
            [30, [0, 200, 255, 0.8]],    // Light Cyan
            [40, [0, 255, 200, 0.8]],    // Cyan
            [50, [0, 255, 0, 0.8]],      // Green
            [60, [173, 255, 47, 0.8]],   // Green Yellow
            [70, [255, 255, 0, 0.8]],    // Yellow
            [80, [255, 200, 0, 0.8]],    // Orange Yellow
            [90, [255, 150, 0, 0.8]],    // Orange
            [100, [255, 69, 0, 0.8]],    // Orange Red
            [110, [255, 0, 0, 0.8]],     // Red
            [120, [139, 0, 0, 0.8]]      // Dark Red/Maroon for extreme heat
        ]);

        const colorStops = Array.from(colorTable.entries());

        // Handle temperature extremes
        if (temp <= colorStops[0][0]) {
            return `rgba(${colorStops[0][1].join(',')})`;
        }
        if (temp >= colorStops[colorStops.length - 1][0]) {
            return `rgba(${colorStops[colorStops.length - 1][1].join(',')})`;
        }

        // Interpolate between color stops
        for (let i = 0; i < colorStops.length - 1; i++) {
            if (temp <= colorStops[i + 1][0]) {
                const [temp1, color1] = colorStops[i];
                const [temp2, color2] = colorStops[i + 1];
                const factor = (temp - temp1) / (temp2 - temp1);
                const color = color1.map((c, j) =>
                    j === 3 ? c + (color2[j] - c) * factor :
                        Math.floor(c + (color2[j] - c) * factor)
                );
                return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
            }
        }
        
        return 'transparent';
    }

    /**
     * Renders the weather data on the canvas
     */
    draw() {
        this.updateCanvasSize();
        const bounds = this.map.getBounds();
        const zoom = this.map.getZoom();

        // Clear previous render
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Calculate rectangle size based on map zoom
        const topLeft = this.map.latLngToContainerPoint([bounds.getNorth(), bounds.getWest()]);
        const bottomRight = this.map.latLngToContainerPoint([bounds.getNorth() - 0.5, bounds.getWest() + 0.5]);
        const rectWidth = Math.abs(bottomRight.x - topLeft.x);
        const rectHeight = Math.abs(bottomRight.y - topLeft.y);

        // Draw each data point
        this.weatherData.forEach(point => {
            const temp = point.temperatures[this.currentHour];
            const color = this.getTemperatureColor(temp);

            // Convert geographic coordinates to pixel coordinates
            const pixelPoint = this.map.latLngToContainerPoint([
                point.coords[0],
                point.coords[1]
            ]);

            // Draw temperature rectangle
            this.ctx.fillStyle = color;
            this.ctx.fillRect(
                pixelPoint.x - rectWidth / 2,
                pixelPoint.y - rectHeight / 2,
                rectWidth,
                rectHeight
            );
        });
    }

    /**
     * Updates render with new weather data
     * @param {Array} weatherData Array of weather data points
     * @param {number} hour Current hour to display
     */
    render(weatherData, hour) {
        this.weatherData = weatherData;
        this.currentHour = hour;
        this.draw();
    }
}

/**
 * Creates and sets up UI control elements
 * @returns {Object} References to UI elements
 */
const createUIElements = () => {
    // Create time slider control
    const timeSliderContainer = document.createElement('div');
    timeSliderContainer.className = 'control-container time-slider';
    timeSliderContainer.innerHTML = `
        <input type="range" id="timeSlider" min="0" max="23" value="0">
        <span id="timeDisplay">00:00</span>`;
    document.body.appendChild(timeSliderContainer);

    // Create progress bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'control-container progress-bar';
    progressContainer.innerHTML = `
        <div id="progressText">Loading weather data...</div>
        <div class="progress-track">
            <div id="progressBar"></div>
        </div>`;
    document.body.appendChild(progressContainer);

    // Create temperature tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'temperature-tooltip';
    document.body.appendChild(tooltip);

    return {
        progressBar: document.getElementById('progressBar'),
        progressText: document.getElementById('progressText'),
        tooltip
    };
};

/**
 * Main application initialization function
 * Sets up the weather map and all its components
 */
async function initWeatherMap() {
    const { progressBar, progressText, tooltip } = createUIElements();
    const dataManager = new WeatherDataManager();
    const renderer = new WeatherRenderer(map);

    // Set up mousemove event for temperature tooltip
    map.on('mousemove', (e) => {
        const { lat, lng } = e.latlng;
        if (!dataManager.weatherData.length) return;

        // Find nearest data point
        const point = dataManager.weatherData.find(p => {
            const latDiff = Math.abs(p.coords[0] - lat);
            const lngDiff = Math.abs(p.coords[1] - lng);
            return latDiff < 0.25 && lngDiff < 0.25;
        });

        // Update tooltip
        if (point) {
            const hour = parseInt(document.getElementById('timeSlider').value);
            const temperature = point.temperatures[hour];
            tooltip.style.display = 'none';
            tooltip.style.left = e.originalEvent.pageX + 10 + 'px';
            tooltip.style.top = e.originalEvent.pageY + 10 + 'px';
            tooltip.innerHTML = `${temperature.toFixed(1)}&#176;F`;
        } else {
            tooltip.
        }
    });

    // Hide tooltip when mouse leaves map
    map.on('mouseout', () => {
        tooltip.style.display = 'none';
    });

    // Set up time slider event listener
    document.getElementById('timeSlider').addEventListener('input', (e) => {
        const hour = parseInt(e.target.value);
        renderer.render(dataManager.weatherData, hour);
        document.getElementById('timeDisplay').textContent = `${hour.toString().padStart(2, '0')}:00`;
    });

    try {
        // Generate coordinate grid
        console.log('Generating optimized grid...');
        const grid = generateOptimizedGrid();
        console.log('Grid generated. Points:', grid.length);
        
        // Fetch weather data with progress updates
        console.log('Fetching weather data...');
        const weatherData = await dataManager.fetchData(grid, (progress) => {
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `Loading weather data... ${Math.round(progress)}%`;
        });
        console.log('Weather data fetched. Points:', weatherData.length);

        // Initial render
        renderer.render(weatherData, 0);
        progressText.textContent = 'Loading complete!';
        
        // Fade out and remove progress bar
        setTimeout(() => {
            const container = progressBar.parentElement.parentElement;
            container.style.opacity = '0';
            container.style.transition = 'opacity 1s';
            setTimeout(() => container.remove(), 1000);
        }, 2000);
    } catch (error) {
        console.error('Error initializing weather map:', error);
        progressText.textContent = 'Error loading weather data';
    }
}

// Initialize the application when the page loads
initWeatherMap();style.display = 'block';
