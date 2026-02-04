import { GEOSERVER_URL, AUTH_HEADER, WORKSPACE } from './ServerCredentials';
import axios from 'axios';
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

let TARGET_LAYERS = [];
export const getGeoServerLayers = async () => {
    try {
        let response = await axios.get(`/giswebapi/api/GIS/GetAllLayers`);
        if (response.data) {
            const sortedData = response.data
                .filter(x => x.IsShowLayer == true)
                .sort((a, b) => (a.LayerSequenceNo || 999) - (b.LayerSequenceNo || 999));

            return sortedData.map(layer => ({
                fullName: `${WORKSPACE}:${layer.LayerName}`,
                sequence: layer.LayerSequenceNo || 999,
                initialVisibility: Boolean(layer.LayerVisibilityOnLoad),
                layerId: layer.LayerId // Added from API property
            }));
        }
    }
    catch (error) {
        console.error("Failed to fetch layers from API", error);
    }
    return [];
};

export const saveSequence = async (sequenceList) => {

    const layerSequenceMap = {};
    sequenceList.forEach(x => {
        layerSequenceMap[x.layerId] = x.sequenceNumber;
    });

    try {
        const response = await axios.put(
            "/giswebapi/api/GIS/UpdateLayerSequence",
            layerSequenceMap,
            {
                headers:
                {
                    "Content-Type": "application/json"
                }
            }
        );
        return response.data === true;
    }
    catch (err) {
        console.error("Update failed", err);
        return false;
    }
};


export const getLayerBBox = async (fullLayerName) => {
    try {
        const [ws, name] = fullLayerName.split(':');

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
        const layerResponse = await fetch(`${GEOSERVER_URL}/rest/layers/${name}.json?t=${Date.now()}`,
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
        const sldResponse = await fetch(`${GEOSERVER_URL}/rest/styles/${styleName}.sld?t=${Date.now()}`,
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

        // Priority 1: Check workspace-specific style
        const wsCheck = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/styles/${targetStyleName}.json`, {
            headers: { 'Authorization': AUTH_HEADER }
        });

        let styleExists = wsCheck.ok;
        let updateUrl = `${GEOSERVER_URL}/rest/workspaces/${ws}/styles/${targetStyleName}`;

        if (!styleExists) {
            // Priority 2: Check global style
            const globalCheck = await fetch(`${GEOSERVER_URL}/rest/styles/${targetStyleName}.json`, {
                headers: { 'Authorization': AUTH_HEADER }
            });
            if (globalCheck.ok) {
                styleExists = true;
                updateUrl = `${GEOSERVER_URL}/rest/styles/${targetStyleName}`;
            }
        }

        if (!styleExists) {
            // Step 2: Create the style if it doesn't exist (target workspace)
            const createResponse = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/styles`, {
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
                // Final fallback: Create globally if workspace fails
                await fetch(`${GEOSERVER_URL}/rest/styles`, {
                    method: 'POST',
                    headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ style: { name: targetStyleName, filename: `${targetStyleName}.sld` } })
                });
                updateUrl = `${GEOSERVER_URL}/rest/styles/${targetStyleName}`;
            }
        }

        // Step 3: PUT the SLD body
        const putSldResponse = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/vnd.ogc.sld+xml'
            },
            body: sldBody
        });

        if (!putSldResponse.ok) return false;

        // Step 4: Ensure the layer is using this style
        const layerInfoRes = await fetch(`${GEOSERVER_URL}/rest/layers/${layerName}.json`, {
            headers: { 'Authorization': AUTH_HEADER }
        });

        if (layerInfoRes.ok) {
            const layerData = await layerInfoRes.json();
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

export const uploadIcon = async (file, workspace) => {
    try {
        // Upload to the workspace styles directory
        const url = `${GEOSERVER_URL}/rest/resource/workspaces/${workspace}/styles/${file.name}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/octet-stream'
            },
            body: file
        });

        if (response.ok) {
            return file.name;
        }
    } catch (err) {
        console.error('Icon upload failed:', err);
    }
    return null;
};

export const getLayerAttributes = async (fullLayerName) => {
    try {
        const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=DescribeFeatureType&typeName=${fullLayerName}&outputFormat=application/json`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data.featureTypes && data.featureTypes.length > 0) {
                return data.featureTypes[0].properties.map(p => p.name);
            }
        }
    } catch (err) {
        console.error('Failed to fetch layer attributes:', err);
    }
    return [];
};
