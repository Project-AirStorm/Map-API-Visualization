# Interactive Weather Map

A high-performance, interactive weather visualization application that displays temperature data across the continental United States using a dynamic heatmap overlay.

## Features

- Real-time temperature visualization using color-coded heatmap
- Interactive time slider for 24-hour forecast navigation
- Tooltip displaying exact temperature on hover
- Optimized data fetching with progress indication

## Technical Stack

- **Map Framework**: Leaflet.js
- **Base Map**: OpenStreetMap
- **Weather Data**: Open-Meteo API with GFS GraphCast model
- **Utilities**: Lodash
- **Rendering**: HTML5 Canvas

## Installation

1. Clone the repository
2. Place the files in a web server directory:
   - `index.html`
   - `styles.css`
   - `weather.js`

## Configuration

### API Key
The application uses the Open-Meteo API. You'll need to replace the API key in `weather.js`:

```javascript
this.apiKey = 'YOUR_API_KEY';
```

### Map Settings
Default map settings can be adjusted in `weather.js`:

```javascript
let map = L.map('map', {
    preferCanvas: true,
    renderer: L.canvas({
        padding: 0.5,
        tolerance: 0
    }),
    zoomSnap: 0.1,
    zoomDelta: 0.1,
    wheelPxPerZoomLevel: 120
}).setView([37.0902, -95.7129], 4);
```

## Data Structure

The application uses a grid-based system for temperature data:
- Latitude range: 24.0°N to 50.0°N
- Longitude range: -126.0°W to -66.0°W
- Grid resolution: 0.25 degrees
- Additional points for important geographical features (Great Lakes, coastal areas)

## Components

### WeatherDataManager
Handles data fetching and processing:
- Batch processing of coordinate requests
- Rate limiting protection
- Progress tracking
- Error handling and retry mechanism

### WeatherRenderer
Manages the visual representation:
- Canvas-based rendering for performance
- Dynamic color interpolation
- Responsive to map zoom and pan
- Automatic canvas size adjustment

## Performance Optimizations

1. Canvas-based rendering instead of DOM elements
2. Batch processing of API requests
3. Optimized grid generation
4. Debounced render updates
5. Memory-efficient data structures
6. Hardware-accelerated graphics

## Known Limitations

1. Coverage limited to continental United States
2. Maximum of 24-hour forecast
3. Data updates based on API refresh rate
4. Weather data resolution limited to 0.25-degree grid

## Customization

### Color Scheme
Modify the temperature color mapping in `getTemperatureColor()`:

```javascript
const colorTable = new Map([
    [-20, [138, 43, 226, 0.8]], // Dark Violet
    [0, [0, 0, 255, 0.8]],      // Blue
    [50, [0, 255, 0, 0.8]],     // Green
    [80, [255, 200, 0, 0.8]],   // Orange Yellow
    [120, [139, 0, 0, 0.8]]     // Dark Red
]);
```

### Grid Resolution
Adjust the data resolution in `generateOptimizedGrid()`:

```javascript
const step = 0.25; // Modify this value to change grid density
```

## Contributing

When contributing to this project:
1. Fork the repository
2. Create a feature branch
3. Follow the existing code style
4. Add appropriate documentation
5. Submit a pull request

## Acknowledgments

- OpenStreetMap for map tiles
- Open-Meteo for weather data
- Leaflet.js team for the mapping framework

## Support

For issues and feature requests, please use the GitHub issue tracker.
