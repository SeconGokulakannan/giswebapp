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
        const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${WORKSPACE}:Layer&outputFormat=application/json`;
        const response = await axios.get(url, {
            headers: {
                'Authorization': AUTH_HEADER
            }
        });

        if (response.data && response.data.features) {
            const filteredFeatures = response.data.features
                .filter(f => f.properties.LayerName !== 'Layer' && f.properties.IsShowLayer === true)
                .sort((a, b) => (a.properties.LayerSequenceNo ?? 999) - (b.properties.LayerSequenceNo ?? 999));

            return filteredFeatures.map(feature => ({
                fullName: `${WORKSPACE}:${feature.properties.LayerName}`,
                sequence: feature.properties.LayerSequenceNo ?? 999,
                initialVisibility: Boolean(feature.properties.LayerVisibilityOnLoad),
                layerId: feature.properties.LayerName,
                fid: feature.id, // Store fid for WFS-T updates
                geometryFieldName: feature.properties.GeometryFieldName || 'geom'
            }));
        }
    }
    catch (error) {
        console.error("Failed to fetch layers from GeoServer metadata layer", error);
    }
    return [];
};

export const saveSequence = async (sequenceList) => {
    try {
        const url = `${GEOSERVER_URL}/wfs`;

        // Constraint Handler: LayerSequenceNo is Unique.
        // We must avoid collisions during the update (e.g. swapping 1 and 2).
        // Strategy: Two-Pass Update in a single Transaction.
        // 1. Move all targeted layers to a temporary "safe" high range (e.g. 100000+).
        // 2. Move all targeted layers to their final destination.

        let tempUpdates = '';
        let finalUpdates = '';

        // Pass 1: Move to Temp Range
        sequenceList.forEach((item, index) => {
            if (item.sequenceNumber === undefined || item.sequenceNumber === null) return;

            // Should be safe enough, assuming strict integer was checked before calling or check here
            const tempSeq = 100000 + index + Math.floor(Math.random() * 1000); // Add randomness to ensure uniqueness even in temp

            if (item.fid) {
                tempUpdates += `
                <wfs:Update typeName="${WORKSPACE}:Layer">
                    <wfs:Property>
                        <wfs:Name>LayerSequenceNo</wfs:Name>
                        <wfs:Value>${tempSeq}</wfs:Value>
                    </wfs:Property>
                    <ogc:Filter>
                        <ogc:FeatureId fid="${item.fid}"/>
                    </ogc:Filter>
                </wfs:Update>`;
            } else {
                tempUpdates += `
                <wfs:Update typeName="${WORKSPACE}:Layer">
                    <wfs:Property>
                        <wfs:Name>LayerSequenceNo</wfs:Name>
                        <wfs:Value>${tempSeq}</wfs:Value>
                    </wfs:Property>
                    <ogc:Filter>
                        <ogc:PropertyIsEqualTo>
                            <ogc:PropertyName>LayerName</ogc:PropertyName>
                            <ogc:Literal>${item.layerId}</ogc:Literal>
                        </ogc:PropertyIsEqualTo>
                    </ogc:Filter>
                </wfs:Update>`;
            }
        });

        // Pass 2: Move to Final
        for (const item of sequenceList) {
            if (item.sequenceNumber === undefined || item.sequenceNumber === null) continue;

            const seqInt = parseInt(item.sequenceNumber, 10);
            if (isNaN(seqInt)) continue;

            if (item.fid) {
                finalUpdates += `
                <wfs:Update typeName="${WORKSPACE}:Layer">
                    <wfs:Property>
                        <wfs:Name>LayerSequenceNo</wfs:Name>
                        <wfs:Value>${seqInt}</wfs:Value>
                    </wfs:Property>
                    <ogc:Filter>
                        <ogc:FeatureId fid="${item.fid}"/>
                    </ogc:Filter>
                </wfs:Update>`;
            } else {
                finalUpdates += `
                <wfs:Update typeName="${WORKSPACE}:Layer">
                    <wfs:Property>
                        <wfs:Name>LayerSequenceNo</wfs:Name>
                        <wfs:Value>${seqInt}</wfs:Value>
                    </wfs:Property>
                    <ogc:Filter>
                        <ogc:PropertyIsEqualTo>
                            <ogc:PropertyName>LayerName</ogc:PropertyName>
                            <ogc:Literal>${item.layerId}</ogc:Literal>
                        </ogc:PropertyIsEqualTo>
                    </ogc:Filter>
                </wfs:Update>`;
            }
        }

        const updates = tempUpdates + finalUpdates;

        if (!updates) return false;

        const wfsTransactionXml = `
        <wfs:Transaction service="WFS" version="1.1.0"
        xmlns:wfs="http://www.opengis.net/wfs"
        xmlns:ogc="http://www.opengis.net/ogc"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
            ${updates}
        </wfs:Transaction>`.trim();

        console.log('Using Two-Pass Unique-Safe XML:', wfsTransactionXml);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'text/xml'
            },
            body: wfsTransactionXml
        });

        if (response.ok) {
            const resultText = await response.text();
            console.log('Save Sequence Response:', resultText);

            if (resultText.includes('ExceptionText')) {
                console.error('WFS-T Exception:', resultText);
                return false;
            }
            return resultText.includes('TransactionSummary');
        }
        return false;
    } catch (error) {
        console.error("Failed to save layer sequences via WFS-T", error);
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

export const getFeaturesForAttributeTable = async (layerId, fullLayerName) => {
    try {
        // WFS GetFeature request for the specified layer
        const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${fullLayerName}&outputFormat=application/json&maxFeatures=100000`;
        const response = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
        if (response.ok) {
            const data = await response.json();
            return data.features || [];
        }
    } catch (err) {
        console.error(`Failed to fetch features for attribute table (LayerID: ${layerId}):`, err);
    }
    return [];
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

export const deleteFeature = async (fullLayerName, feature) => {
    try {
        const fid = feature.id || (feature.properties && (feature.properties.id || feature.properties.fid));

        if (!fid) {
            console.error("Could not find Feature ID for deletion");
            return false;
        }

        // Construct WFS-T Delete XML
        const wfsTransactionXml = `
<wfs:Transaction service="WFS" version="1.1.0"
xmlns:wfs="http://www.opengis.net/wfs"
xmlns:ogc="http://www.opengis.net/ogc"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
<wfs:Delete typeName="${fullLayerName}"><ogc:Filter><ogc:FeatureId fid="${fid}"/></ogc:Filter></wfs:Delete>
</wfs:Transaction>`.trim();

        const response = await fetch(`${GEOSERVER_URL}/wfs`, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'text/xml'
            },
            body: wfsTransactionXml
        });

        if (response.ok) {
            const resultText = await response.text();
            // Check for success in the XML response
            if (resultText.includes('TransactionSummary') && resultText.includes('<wfs:totalDeleted>1</wfs:totalDeleted>')) {
                return true;
            } else if (resultText.includes('ExceptionText')) {
                console.error('WFS-T Exception:', resultText);
                return false;
            }
            return true; // Assume success if no exception and ok status
        }
        return false;
    } catch (error) {
        console.error(`Failed to delete feature via WFS-T (${fullLayerName}):`, error);
        return false;
    }
};

export const saveNewFeature = async (fullLayerName, properties) => {
    try {

        console.clear();
        console.log("properties ", properties);
        const [prefix, layerPart] = fullLayerName.includes(':') ? fullLayerName.split(':') : ['feature', fullLayerName];
        let featureContentXml = '';

        for (const [key, value] of Object.entries(properties)) {
            // Skip internal identifiers, private fields, and identity/auto-increment columns
            // Omitting 'LayerId' allows the database to handle its own identity generation
            if (!key ||
                key === 'id' ||
                key.toLowerCase() === 'layerid' ||
                key.toLowerCase() === 'fid' ||
                key.toLowerCase() === 'ogc_fid' ||
                key.startsWith('_') ||
                value === null ||
                value === undefined ||
                value === ''
            ) continue;
            featureContentXml += `<${prefix}:${key}>${value}</${prefix}:${key}>`;
        }

        // Use the exact targetNamespace discovered from GeoServer (gisweb)
        // Previous assumed http-formatted URI was causing feature type not found errors
        const namespaceUri = prefix;

        const wfsTransactionXml = `
        <wfs:Transaction service="WFS" version="1.1.0"
        xmlns:wfs="http://www.opengis.net/wfs"
        xmlns:ogc="http://www.opengis.net/ogc"
        xmlns:gml="http://www.opengis.net/gml"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:${prefix}="${namespaceUri}"
        xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
        <wfs:Insert>
            <${fullLayerName}>
                ${featureContentXml}
            </${fullLayerName}>
        </wfs:Insert>
        </wfs:Transaction>`.trim();

        console.log('Save New Feature XML:', wfsTransactionXml);

        const response = await fetch(`${GEOSERVER_URL}/wfs`, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'text/xml'
            },
            body: wfsTransactionXml
        });

        if (response.ok) {
            const resultText = await response.text();
            console.log('Save New Feature Response:', resultText);

            if (resultText.includes('ExceptionText')) {
                console.error('WFS-T Create Exception:', resultText);
                return false;
            }

            return resultText.includes('TransactionSummary') &&
                (resultText.includes('<wfs:totalInserted>1</wfs:totalInserted>') ||
                    resultText.includes('totalInserted="1"'));
        }
        return false;
    } catch (error) {
        console.error(`Failed to create feature via WFS-T (${fullLayerName}):`, error);
        return false;
    }
};

export const addNewLayerConfig = async (properties) => {
    try {
        console.clear();
        console.log("Saving New Layer Config:", properties);

        const fullLayerName = `${WORKSPACE}:Layer`;
        const prefix = WORKSPACE;
        let featureContentXml = '';

        for (const [key, value] of Object.entries(properties)) {
            // Explicitly exclude identity columns and empty values
            if (!key ||
                key === 'id' ||
                key.toLowerCase() === 'layerid' ||
                key.toLowerCase() === 'fid' ||
                key.toLowerCase() === 'ogc_fid' ||
                key.startsWith('_') ||
                value === null ||
                value === undefined ||
                value === ''
            ) continue;
            featureContentXml += `<${prefix}:${key}>${value}</${prefix}:${key}>`;
        }

        const namespaceUri = prefix;

        const wfsTransactionXml = `
        <wfs:Transaction service="WFS" version="1.1.0"
        xmlns:wfs="http://www.opengis.net/wfs"
        xmlns:ogc="http://www.opengis.net/ogc"
        xmlns:gml="http://www.opengis.net/gml"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:${prefix}="${namespaceUri}"
        xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
        <wfs:Insert>
            <${fullLayerName}>
                ${featureContentXml}
            </${fullLayerName}>
        </wfs:Insert>
        </wfs:Transaction>`.trim();

        console.log('addNewLayerConfig XML:', wfsTransactionXml);

        const response = await fetch(`${GEOSERVER_URL}/wfs`, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'text/xml'
            },
            body: wfsTransactionXml
        });

        if (response.ok) {
            const resultText = await response.text();
            console.log('addNewLayerConfig Response:', resultText);

            if (resultText.includes('ExceptionText')) {
                console.error('WFS-T Create Exception (Layer):', resultText);
                return false;
            }

            return resultText.includes('TransactionSummary') &&
                (resultText.includes('<wfs:totalInserted>1</wfs:totalInserted>') ||
                    resultText.includes('totalInserted="1"'));
        }
        return false;
    } catch (error) {
        console.error("Failed to create specialized layer configuration:", error);
        return false;
    }
};

export const SaveNewAttribute = async (fullLayerName, properties, geometryFeature, geometryName = 'geom') => {
    try {
        if (!geometryFeature) {
            console.error("No geometry feature provided for creation");
            return false;
        }

        const geometry = geometryFeature.getGeometry();
        // Use the geometryName provided (from layer metadata)
        // const geometryName = 'geom';
        // geometryName is now passed as an argument

        // Convert OpenLayers Geometry to GML3 fragment
        // This is a simplified GML construction. For complex cases, consider using ol/format/GML.
        const coords = geometry.getCoordinates();
        let gmlGeometry = '';
        const type = geometry.getType();

        if (type === 'Point') {
            gmlGeometry = `<gml:Point srsName="EPSG:3857"><gml:pos>${coords.join(' ')}</gml:pos></gml:Point>`;
        } else if (type === 'LineString') {
            gmlGeometry = `<gml:LineString srsName="EPSG:3857"><gml:posList>${coords.map(c => c.join(' ')).join(' ')}</gml:posList></gml:LineString>`;
        } else if (type === 'Polygon') {
            // Polygons in GML are rings. First ring is exterior.
            const exterior = coords[0].map(c => c.join(' ')).join(' ');
            gmlGeometry = `<gml:Polygon srsName="EPSG:3857"><gml:exterior><gml:LinearRing><gml:posList>${exterior}</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon>`;
        } else if (type === 'MultiPolygon') {
            // Simplified MultiPolygon support
            // ...implementation can be expanded if needed...
            console.warn("MultiPolygon auto-creation pending implementation, attempting simplistic fallback");
        }

        if (!gmlGeometry) {
            console.error(`Unsupported geometry type for auto-creation: ${type}`);
            return false;
        }

        // Extract workspace and layer name
        const [prefix, layerPart] = fullLayerName.includes(':') ? fullLayerName.split(':') : ['feature', fullLayerName];

        // Construct Feature Content XML
        // Unlike Update, Insert expects the actual feature structure: <prefix:LayerName><prefix:prop>val</prefix:prop></prefix:LayerName>
        let featureContentXml = '';

        // Helper function to escape XML special characters
        const escapeXml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        };

        // Add Attributes — match user request to send 0/empty for identity columns
        for (const [key, value] of Object.entries(properties)) {
            const lowKey = key.toLowerCase();

            // Skip internal/identity columns
            if (!key ||
                key === 'id' ||
                lowKey === 'layerid' ||
                lowKey === 'gid' ||
                lowKey === 'objectid' ||
                lowKey === 'fid' ||
                lowKey === 'ogc_fid' ||
                key.startsWith('_') ||
                value === null ||
                value === undefined ||
                value === '' // Skip empty strings to avoid type mismatch errors
            ) continue;

            // Skip computed/function columns (PostGIS functions)
            if (lowKey.startsWith('st_')) {
                console.log(`Skipping computed column: ${key}`);
                continue;
            }

            // Skip geometry columns (they're added separately)
            if (lowKey === 'geom' || lowKey === 'the_geom' || lowKey === 'geometry') {
                continue;
            }

            // Escape XML special characters in the value
            const escapedValue = escapeXml(value);
            featureContentXml += `<${prefix}:${key}>${escapedValue}</${prefix}:${key}>`;
        }

        // Add Geometry
        // Ensure geometryName matches what GeoServer expects (often 'geom' or 'the_geom').
        console.log('🔍 SaveNewAttribute - Geometry Debug:', {
            geometryName,
            geometryType: type,
            coordsLength: coords ? (Array.isArray(coords) ? coords.length : 'N/A') : 'null',
            gmlGeometry: gmlGeometry.substring(0, 150),
            fullGmlLength: gmlGeometry.length
        });
        featureContentXml += `<${prefix}:${geometryName}>${gmlGeometry}</${prefix}:${geometryName}>`;

        // Use the exact namespace matching saveNewFeature — just the workspace prefix
        const namespaceUri = prefix;

        const wfsTransactionXml = `
        <wfs:Transaction service="WFS" version="1.1.0"
        xmlns:wfs="http://www.opengis.net/wfs"
        xmlns:ogc="http://www.opengis.net/ogc"
        xmlns:gml="http://www.opengis.net/gml"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:${prefix}="${namespaceUri}"
        xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
        <wfs:Insert>
            <${fullLayerName}>
                ${featureContentXml}
            </${fullLayerName}>
        </wfs:Insert>
        </wfs:Transaction>`.trim();

        console.log('📤 SaveNewAttribute - Complete WFS-T XML:\n', wfsTransactionXml);

        const response = await fetch(`${GEOSERVER_URL}/wfs`, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'text/xml'
            },
            body: wfsTransactionXml
        });

        if (response.ok) {
            const resultText = await response.text();
            if (resultText.includes('TransactionSummary') && resultText.includes('<wfs:totalInserted>1</wfs:totalInserted>')) {
                return true;
            } else if (resultText.includes('ExceptionText')) {
                console.error('WFS-T Insert Exception:', resultText);
                return false;
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Failed to create feature via WFS-T (${fullLayerName}):`, error);
        return false;
    }
};

export const updateFeature = async (fullLayerName, featureId, properties) => {
    try {
        if (!featureId) {
            console.error("No Feature ID provided for update");
            return false;
        }

        // Construct WFS-T Update XML
        let propertyXml = '';
        for (const [key, value] of Object.entries(properties)) {
            // Skip internal properties if any
            if (key === 'id' || key === 'ogc_fid' || key === 'geometry' || key === '_feature' || key === 'isDirty' || key === 'objectid' || key === 'fid' || key === 'featid') continue;

            propertyXml += `<wfs:Property><wfs:Name>${key}</wfs:Name><wfs:Value>${value}</wfs:Value></wfs:Property>`;
        }

        const wfsTransactionXml = `
        <wfs:Transaction service="WFS" version="1.1.0"
        xmlns:wfs="http://www.opengis.net/wfs"
        xmlns:ogc="http://www.opengis.net/ogc"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
        <wfs:Update typeName="${fullLayerName}">${propertyXml}<ogc:Filter><ogc:FeatureId fid="${featureId}"/></ogc:Filter></wfs:Update>
        </wfs:Transaction>`.trim();

        const response = await fetch(`${GEOSERVER_URL}/wfs`, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'text/xml'
            },
            body: wfsTransactionXml
        });

        if (response.ok) {
            const resultText = await response.text();
            if (resultText.includes('TransactionSummary') && resultText.includes('<wfs:totalUpdated>1</wfs:totalUpdated>')) {
                return true;
            } else if (resultText.includes('ExceptionText')) {
                console.error('WFS-T Update Exception:', resultText);
                return false;
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Failed to update feature via WFS-T (${fullLayerName}):`, error);
        return false;
    }
};

export const QueryBuilderFilter = (conditions) => {
    if (!conditions || conditions.length === 0) return null;

    const validConditions = conditions.filter(c => c.field && c.value);
    if (validConditions.length === 0) return null;

    let cqlParts = [];
    validConditions.forEach((cond, index) => {
        let formattedValue = cond.value;

        // Handle LIKE/ILIKE wrapping
        if (cond.operator === 'LIKE' || cond.operator === 'ILIKE') {
            formattedValue = `'%${cond.value}%'`;
        } else {
            // Check if value is numeric
            if (cond.value === '' || isNaN(cond.value)) {
                formattedValue = `'${cond.value}'`;
            }
        }

        const part = `${cond.field} ${cond.operator} ${formattedValue}`;

        if (index > 0) {
            cqlParts.push(` ${cond.logic} `);
        }
        cqlParts.push(part);
    });

    return cqlParts.join("");
};
