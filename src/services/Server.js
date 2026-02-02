/**
 * Server.js
 * Dedicated service for GeoServer and External API operations.
 * Centralizes all AJAX/Fetch calls for the application.
 */

/**
 * Geocoding Service: Search for a location using OSM Nominatim
 * @param {string} query Search text
 * @returns {Promise<Object|null>} Location object with lat, lon, and name
 */
export const searchLocation = async (query) => {
    if (!query) return null;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'EliteGIS/1.0' }
        });
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                lon: parseFloat(data[0].lon),
                lat: parseFloat(data[0].lat),
                display_name: data[0].display_name
            };
        }
    } catch (err) {
        console.error('Geocoding error:', err);
    }
    return null;
};

const GEOSERVER_URL = 'http://192.168.7.70:8080/geoserver';
const AUTH_HEADER = 'Basic ' + btoa('admin:geoserver');

// User Configuration
const WORKSPACE = 'gisweb';
const TARGET_LAYERS = ['districts', 'states', 'villages'];

/**
 * Fetch specific Layers from GeoServer
 * @returns {Promise<Array>} List of formatted layer names (workspace:layer)
 */
export const getGeoServerLayers = async () => {
    // Return the specific layers requested by the user
    return TARGET_LAYERS.map(name => `${WORKSPACE}:${name}`);
};

/**
 * Returns WMS source configuration for a specific layer
 * @param {string} layerName 
 * @returns {Object} WMS parameters
 */
export const getWMSSourceParams = (layerName) => {
    return {
        url: `${GEOSERVER_URL}/wms`,
        params: {
            'LAYERS': layerName,
            'TILED': true,
        },
        serverType: 'geoserver',
        transition: 0,
    };
};
