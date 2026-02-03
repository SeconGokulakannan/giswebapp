import { GEOSERVER_URL, AUTH_HEADER, WORKSPACE } from './ServerCredentials';
export const searchLocation = async (query) => {
    if (!query) return null;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        const response = await fetch(url,
            {
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
    }
    catch (err) {
        console.error('Geocoding error:', err);
    }
    return null;
};


export const getLegendUrl = (layerName) => {
    return `${GEOSERVER_URL}/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&WIDTH=20&HEIGHT=20&LAYER=${layerName}`;
};



// User Configuration
const TARGET_LAYERS = ['Districts'];


export const getGeoServerLayers = async () => {
    return TARGET_LAYERS.map(name => `${WORKSPACE}:${name}`);
};


export const getLayerBBox = async (fullLayerName) => {
    try {
        const [ws, name] = fullLayerName.split(':');
        const response = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/layers/${name}.json`,
            {
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Accept': 'application/json'
                }
            });

        if (!response.ok) return null;

        const layerData = await response.json();
        const resourceUrl = layerData.layer.resource.href;

        const resResponse = await fetch(resourceUrl,
            {
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Accept': 'application/json'
                }
            });

        if (!resResponse.ok) return null;

        const resData = await resResponse.json();
        const info = resData.featureType || resData.coverage;

        if (info && info.latLonBoundingBox) {
            const bbox = info.latLonBoundingBox;
            return [bbox.minx, bbox.miny, bbox.maxx, bbox.maxy];
        }
    }
    catch (err) {
        console.error('Failed to fetch layer extent:', err);
    }
    return null;
};


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
