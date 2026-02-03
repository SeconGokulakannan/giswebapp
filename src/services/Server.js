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
const TARGET_LAYERS = ['States', 'Districts', 'Villages'];


export const getGeoServerLayers = async () => {
    return TARGET_LAYERS.map(name => `${WORKSPACE}:${name}`);
};


export const getLayerBBox = async (fullLayerName) => {
    try {
        const [ws, name] = fullLayerName.split(':');

        // Step 1: Get Layer Info to find if it's a featureType or coverage
        const layerResponse = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/layers/${name}.json`,
            {
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Accept': 'application/json'
                }
            });

        if (!layerResponse.ok) return null;
        const layerData = await layerResponse.json();
        const type = layerData.layer.type.toLowerCase(); // 'featuretype' or 'coverage'

        // Step 2: Fetch the actual resource (featuretype or coverage)
        // We build the URL ourselves to avoid absolute URL / CORS issues
        const endpoint = type === 'raster' ? 'coverages' : 'featuretypes';
        const resourceUrl = `${GEOSERVER_URL}/rest/workspaces/${ws}/${endpoint}/${name}.json`;

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


export const getLayerStyle = async (fullLayerName) => {
    try {
        const [ws, name] = fullLayerName.split(':');

        // Step 1: Get Layer Info to find default style name
        const layerResponse = await fetch(`${GEOSERVER_URL}/rest/layers/${name}.json`,
            {
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Accept': 'application/json'
                }
            });

        if (!layerResponse.ok) return null;
        const layerData = await layerResponse.json();
        const styleName = layerData.layer.defaultStyle.name;

        // Step 2: Fetch the SLD body
        const sldResponse = await fetch(`${GEOSERVER_URL}/rest/styles/${styleName}.sld`,
            {
                headers: {
                    'Authorization': AUTH_HEADER,
                }
            });

        if (!sldResponse.ok) return null;
        const sldBody = await sldResponse.text();

        return { styleName, sldBody };
    }
    catch (err) {
        console.error('Failed to fetch layer style:', err);
    }
    return null;
};

export const updateLayerStyle = async (fullLayerName, sldBody) => {
    try {
        const [ws, layerName] = fullLayerName.split(':');
        const targetStyleName = `${layerName}_style`;

        // Step 1: Check if the style already exists
        const checkResponse = await fetch(`${GEOSERVER_URL}/rest/styles/${targetStyleName}.json`, {
            headers: { 'Authorization': AUTH_HEADER }
        });

        if (!checkResponse.ok) {
            // Step 2: Create the style if it doesn't exist
            const createResponse = await fetch(`${GEOSERVER_URL}/rest/workspace/${ws}/styles`, {
                method: 'POST',
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    style: {
                        name: targetStyleName,
                        filename: `${targetStyleName}.sld`
                    }
                })
            });

            if (!createResponse.ok) {
                // Try global styles if workspace-specific fails
                await fetch(`${GEOSERVER_URL}/rest/styles`, {
                    method: 'POST',
                    headers: {
                        'Authorization': AUTH_HEADER,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        style: {
                            name: targetStyleName,
                            filename: `${targetStyleName}.sld`
                        }
                    })
                });
            }
        }

        // Step 3: PUT the SLD body
        const putSldResponse = await fetch(`${GEOSERVER_URL}/rest/styles/${targetStyleName}`, {
            method: 'PUT',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/vnd.ogc.sld+xml'
            },
            body: sldBody
        });

        if (!putSldResponse.ok) return false;

        // Step 4: Ensure the layer is using this style
        // First check if it's already the default style
        const layerInfoRes = await fetch(`${GEOSERVER_URL}/rest/layers/${layerName}.json`, {
            headers: { 'Authorization': AUTH_HEADER }
        });

        if (layerInfoRes.ok) {
            const layerData = await layerInfoRes.ok ? await layerInfoRes.json() : null;
            if (layerData && layerData.layer.defaultStyle.name !== targetStyleName) {
                // Update layer to use the new style
                await fetch(`${GEOSERVER_URL}/rest/layers/${layerName}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': AUTH_HEADER,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        layer: {
                            defaultStyle: { name: targetStyleName }
                        }
                    })
                });
            }
        }

        return true;
    }
    catch (err) {
        console.error('Failed to update unique layer style:', err);
        return false;
    }
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
