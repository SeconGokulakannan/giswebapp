import { GEOSERVER_URL, AUTH_HEADER, WORKSPACE } from './ServerCredentials';
export { WORKSPACE };
import axios from 'axios';

// Force GeoServer to reload its configuration
export const reloadGeoServer = async () => {
    try {
        const response = await fetch(`${GEOSERVER_URL}/rest/reload`, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            return true;
        } else {
            console.warn('GeoServer reload returned status:', response.status);
            return false;
        }
    } catch (err) {
        console.error('GeoServer reload failed:', err);
        return false;
    }
};


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


//Get Data Only from the Layer meta data Table
export const getGeoServerLayers = async () => {
    try {
        const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${WORKSPACE}:Layer&outputFormat=application/json`;
        const response = await axios.get(url,
            {
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
                fid: feature.id,
                geometryFieldName: feature.properties.GeometryFieldName || 'undef',
                geometryType: feature.properties.GeometryType || 'undef',
                srid: feature.properties.SRId || 'undef'
            }));
        }
    }
    catch (error) {
        console.error("Failed to fetch layers from GeoServer metadata layer", error);
    }
    return [];
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

        if (!layerResponse.ok)
            return null;

        const layerData = await layerResponse.json();
        const type = layerData.layer.type.toLowerCase(); // 'featuretype' or 'coverage'

        // Fetch the actual resource (featuretype or coverage)
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
            return [parseFloat(bbox.minx), parseFloat(bbox.miny), parseFloat(bbox.maxx), parseFloat(bbox.maxy)];
        }
    }
    catch (err) {
        console.error('Failed to fetch layer extent:', err);
    }
    return null;
};

//Retrive Layer Styles based on Layer Name
export const getLayerStyle = async (fullLayerName) => {
    try {
        const [ws, name] = fullLayerName.split(':');
        const layerResponse = await fetch(`${GEOSERVER_URL}/rest/layers/${name}.json?t=${Date.now()}`,
            {
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Accept': 'application/json'
                }
            });

        if (!layerResponse.ok)
            return null;
        const layerData = await layerResponse.json();
        const styleName = layerData.layer.defaultStyle.name;

        // Fetch the SLD 
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

        //Check workspace-specific style
        const wsCheck = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/styles/${targetStyleName}.json`,
            {
                headers: { 'Authorization': AUTH_HEADER }
            });

        let styleExists = wsCheck.ok;
        let updateUrl = `${GEOSERVER_URL}/rest/workspaces/${ws}/styles/${targetStyleName}`;

        if (!styleExists) {
            // Apply Default Style if not exists
            const globalCheck = await fetch(`${GEOSERVER_URL}/rest/styles/${targetStyleName}.json`,
                {
                    headers: { 'Authorization': AUTH_HEADER }
                });

            if (globalCheck.ok) {
                styleExists = true;
                updateUrl = `${GEOSERVER_URL}/rest/styles/${targetStyleName}`;
            }
        }

        if (!styleExists) {
            //  Create the style if it doesn't exist (target workspace)
            const createResponse = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/styles`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': AUTH_HEADER,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        style:
                        {
                            name: targetStyleName,
                            filename: `${targetStyleName}.sld`
                        }
                    })
                });

            if (!createResponse.ok) {
                // Create globally if workspace fails
                await fetch(`${GEOSERVER_URL}/rest/styles`,
                    {
                        method: 'POST',
                        headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ style: { name: targetStyleName, filename: `${targetStyleName}.sld` } })
                    });
                updateUrl = `${GEOSERVER_URL}/rest/styles/${targetStyleName}`;
            }
        }

        //PUT the SLD body
        const putSldResponse = await fetch(updateUrl,
            {
                method: 'PUT',
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Content-Type': 'application/vnd.ogc.sld+xml'
                },
                body: sldBody
            });

        if (!putSldResponse.ok) return false;

        //Ensure the layer is using this style
        const layerInfoRes = await fetch(`${GEOSERVER_URL}/rest/layers/${layerName}.json`,
            {
                headers: { 'Authorization': AUTH_HEADER }
            });

        //retrive Update Styles
        if (layerInfoRes.ok) {
            const layerData = await layerInfoRes.json();

            if (layerData && layerData.layer.defaultStyle.name !== targetStyleName) {
                await fetch(`${GEOSERVER_URL}/rest/layers/${layerName}`,
                    {
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

//Load Symbology to the Styles directory in geoserver
export const uploadIcon = async (file, workspace) => {
    try {
        const url = `${GEOSERVER_URL}/rest/resource/workspaces/${workspace}/styles/${file.name}`;
        const response = await fetch(url,
            {
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
    }
    catch (err) {
        console.error('Icon upload failed:', err);
    }
    return null;
};

export const getFeaturesForAttributeTable = async (layerId, fullLayerName) => {
    try {

        let maxFeatures = 100000;
        const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${fullLayerName}&outputFormat=application/json&maxFeatures=${maxFeatures}`;
        const response = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
        if (response.ok) {
            const data = await response.json();
            return data.features || [];
        }
    }
    catch (err) {
        console.error(`Failed to fetch features for attribute table (LayerID: ${layerId}):`, err);
    }
    return [];
};

//Gets Layer Attributes (Column Properties)
export const getLayerAttributes = async (fullLayerName, includeDetails = false) => {
    try {
        const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=DescribeFeatureType&typeName=${fullLayerName}&outputFormat=application/json`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data.featureTypes && data.featureTypes.length > 0) {
                const props = data.featureTypes[0].properties || [];

                if (includeDetails) {
                    return props.map(p => {
                        const isGeom = p.type.startsWith('gml:') || p.type.includes('PropertyType') || p.name.toLowerCase() === 'geom' || p.name.toLowerCase() === 'the_geom' || p.name.toLowerCase() === 'geometry';
                        let geomType = 'Unknown';
                        if (isGeom && p.type.includes('PropertyType')) {
                            // Extract 'MultiPolygon' from 'gml:MultiPolygonPropertyType'
                            geomType = p.type.split(':')[1].replace('PropertyType', '');
                        }
                        return {
                            name: p.name,
                            type: p.type,
                            isGeometry: isGeom,
                            geometryType: geomType
                        };
                    });
                }

                // Return just names, but filter out common internal/geometry identifiers if not detailed
                return props.map(p => p.name);
            }
        }
    }
    catch (err) {
        console.error('Failed to fetch layer attributes:', err);
    }
    return [];
};

// Delete Feature By feature id (fid) for layer wise and metadata table
export const deleteFeature = async (fullLayerName, feature) => {
    try {
        const fid = feature.id || (feature.properties && (feature.properties.id || feature.properties.fid));

        if (!fid) {
            console.error("Could not find Feature ID for deletion");
            return false;
        }

        const wfsTransactionXml = `
        <wfs:Transaction service="WFS" version="1.1.0"
        xmlns:wfs="http://www.opengis.net/wfs"
        xmlns:ogc="http://www.opengis.net/ogc"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
        <wfs:Delete typeName="${fullLayerName}"><ogc:Filter><ogc:FeatureId fid="${fid}"/></ogc:Filter></wfs:Delete>
        </wfs:Transaction>`.trim();

        const response = await fetch(`${GEOSERVER_URL}/wfs`,
            {
                method: 'POST',
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Content-Type': 'text/xml'
                },
                body: wfsTransactionXml
            });

        if (response.ok) {
            const resultText = await response.text();
            if (resultText.includes('TransactionSummary') && resultText.includes('<wfs:totalDeleted>1</wfs:totalDeleted>')) {
                return true;
            }
            else if (resultText.includes('ExceptionText')) {
                console.error('WFS-T Exception:', resultText);
                return false;
            }
            return true;
        }
        return false;
    }
    catch (error) {
        console.error(`Failed to delete feature via WFS-T (${fullLayerName}):`, error);
        return false;
    }
};


// Add New Feature from Attribute Table
export const SaveNewAttribute = async (fullLayerName, properties, geometryFeature, geometryName = 'geom', srid = '3857', targetGeometryType = 'Unknown') => {
    try {
        if (!geometryFeature) {
            console.error("No geometry feature provided for creation");
            return false;
        }

        const geometry = geometryFeature.getGeometry().clone();

        if (srid && srid !== '3857') {
            try {
                geometry.transform('EPSG:3857', `EPSG:${srid}`);
            }
            catch (err) {
                console.error(`Failed to transform geometry to EPSG:${srid}`, err);
            }
        }

        const coords = geometry.getCoordinates();
        let gmlGeometry = '';
        const type = geometry.getType();

        if (type === 'Point') {
            gmlGeometry = `<gml:Point srsName="EPSG:${srid}"><gml:pos>${coords.join(' ')}</gml:pos></gml:Point>`;
        }
        else if (type === 'LineString') {
            gmlGeometry = `<gml:LineString srsName="EPSG:${srid}"><gml:posList>${coords.map(c => c.join(' ')).join(' ')}</gml:posList></gml:LineString>`;
        }
        else if (type === 'Polygon') {
            const exterior = coords[0].map(c => c.join(' ')).join(' ');
            let polygonXml = `<gml:Polygon srsName="EPSG:${srid}"><gml:exterior><gml:LinearRing><gml:posList>${exterior}</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon>`;
            if (targetGeometryType && targetGeometryType.toLowerCase().includes('multipolygon')) {
                gmlGeometry = `<gml:MultiPolygon srsName="EPSG:${srid}"><gml:polygonMember>${polygonXml}</gml:polygonMember></gml:MultiPolygon>`;
            } else {
                gmlGeometry = polygonXml;
            }
        }
        else if (type === 'MultiPolygon') {
            console.warn("MultiPolygon auto-creation pending implementation, attempting simplistic fallback");
        }

        if (!gmlGeometry) {
            console.error(`Unsupported geometry type for auto-creation: ${type}`);
            return false;
        }

        // Extract workspace and layer name
        const [prefix, layerPart] = fullLayerName.includes(':') ? fullLayerName.split(':') : ['feature', fullLayerName];

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

        // Add Attributes identity columns
        for (const [key, value] of Object.entries(properties)) {
            const lowKey = key.toLowerCase();
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
                value === ''
            ) continue;

            if (lowKey.startsWith('st_')) {
                continue;
            }

            // Skip geometry columns (they're added separately)
            if (lowKey === 'geom' || lowKey === 'the_geom' || lowKey === 'geometry' || lowKey === 'wkb_geometry') {
                continue;
            }

            // Escape XML special characters in the value
            const escapedValue = escapeXml(value);
            featureContentXml += `<${prefix}:${key}>${escapedValue}</${prefix}:${key}>`;
        }

        // Add Geometry
        // Ensure geometryName matches what GeoServer expects (often 'geom' or 'the_geom').
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

        const response = await fetch(`${GEOSERVER_URL}/wfs`,
            {
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
    }
    catch (error) {
        console.error(`Failed to create feature via WFS-T (${fullLayerName}):`, error);
        return false;
    }
};

//Update Feature 
export const updateFeature = async (fullLayerName, featureId, properties) => {
    try {
        if (!featureId) {
            console.error("No Feature ID provided for update");
            return false;
        }

        let propertyXml = '';
        for (const [key, value] of Object.entries(properties)) {
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

        const response = await fetch(`${GEOSERVER_URL}/wfs`,
            {
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
    }
    catch (error) {
        console.error(`Failed to update feature via WFS-T (${fullLayerName}):`, error);
        return false;
    }
};

//Query Builder Filter
export const QueryBuilderFilter = (conditions) => {
    if (!conditions || conditions.length === 0) return null;

    const validConditions = conditions.filter(c => c.field && c.value);

    if (validConditions.length === 0)
        return null;

    let cqlParts = [];
    validConditions.forEach((cond, index) => {
        let formattedValue = cond.value;
        if (cond.operator === 'LIKE' || cond.operator === 'ILIKE') {
            formattedValue = `'%${cond.value}%'`;
        }
        else {
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


// Layer Status For Layer Management
export const fetchLayerStatuses = async () => {
    const statuses = {};
    try {
        const restUrl = `${GEOSERVER_URL}/rest/layers.json`;
        const restResponse = await fetch(restUrl,
            {
                headers:
                {
                    'Authorization': AUTH_HEADER,
                    'Accept': 'application/json'
                }
            });

        let configuredLayers = [];
        if (restResponse.ok) {
            const data = await restResponse.json();
            if (data && data.layers && data.layers.layer) {
                configuredLayers = data.layers.layer.map(l => l.name);
            }
        }
        const wfsUrl = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetCapabilities`;
        const wfsResponse = await fetch(wfsUrl,
            {
                headers:
                {
                    'Authorization': AUTH_HEADER
                }
            });

        let activeLayers = [];
        if (wfsResponse.ok) {
            const text = await wfsResponse.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const featureTypes = xmlDoc.getElementsByTagName("FeatureType");

            for (let i = 0; i < featureTypes.length; i++) {
                const nameNodes = featureTypes[i].getElementsByTagName("Name");
                if (nameNodes.length > 0) {
                    activeLayers.push(nameNodes[0].textContent);
                }
            }
        }

        configuredLayers.forEach(layerName => {

            const normalizedLayerName = layerName.includes(':') ? layerName.split(':').pop() : layerName;
            const isActive = activeLayers.some(al => {
                const normalizedAl = al.includes(':') ? al.split(':').pop() : al;
                return al === layerName || normalizedAl === normalizedLayerName;
            });

            if (isActive) {
                statuses[layerName] = 'Valid Layer';
            } else {
                statuses[layerName] = 'Layer Error';
            }
        });

    }
    catch (err) {
        console.error('Failed to fetch layer statuses:', err);
    }
    return statuses;
};

// Add New Layer Configuration for "Layer" metadata table 
export const addNewLayerConfig = async (properties) => {
    try {

        const fullLayerName = `${WORKSPACE}:Layer`;
        const prefix = WORKSPACE;
        let featureContentXml = '';

        //Primary Key Ignore
        for (const [key, value] of Object.entries(properties)) {
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
            if (resultText.includes('ExceptionText')) {
                console.error('WFS-T Create Exception (Layer):', resultText);
                return false;
            }

            return resultText.includes('TransactionSummary') && (resultText.includes('<wfs:totalInserted>1</wfs:totalInserted>') || resultText.includes('totalInserted="1"'));
        }
        return false;
    }
    catch (error) {
        console.error("Failed to create specialized layer configuration:", error);
        return false;
    }
};

//Update Sequence In "Layer"
export const saveSequence = async (sequenceList) => {
    try {
        const url = `${GEOSERVER_URL}/wfs`;
        let tempUpdates = '';
        let finalUpdates = '';

        // Pass 1: Move to Temp Range reason Unique Index
        sequenceList.forEach((item, index) => {
            if (item.sequenceNumber === undefined || item.sequenceNumber === null) return;
            const tempSeq = 100000 + index + Math.floor(Math.random() * 1000);
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
            }
            else {
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

        // Pass 2: Then acutal Update Sequence Number
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
            }
            else {
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


        const response = await fetch(url,
            {
                method: 'POST',
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Content-Type': 'text/xml'
                },
                body: wfsTransactionXml
            });

        if (response.ok) {
            const resultText = await response.text();
            if (resultText.includes('ExceptionText')) {
                return false;
            }
            return resultText.includes('TransactionSummary');
        }
        return false;
    }
    catch (error) {
        console.error("Failed to save layer sequences via WFS-T", error);
        return false;
    }
};

export const publishNewLayer = async (config) => {
    const { layerName, geometryType, srid = '4326', attributes = [] } = config;

    try {
        // Find the PostGIS DataStore name
        const dsRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores.json`,
            {
                headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' }
            });

        if (!dsRes.ok) throw new Error("Failed to find datastores in workspace");
        const dsData = await dsRes.json();
        const dataStoreName = dsData.dataStores?.dataStore?.[0]?.name;

        if (!dataStoreName) throw new Error("No PostGIS DataStore found in workspace. Please ensure one is configured.");

        //Create the FeatureType (and PostGIS Table)
        // Compute attributes
        const computedAttributes = [
            {
                name: 'geom',
                binding: `org.locationtech.jts.geom.${geometryType}`,
                nillable: true
            },
            ...attributes
                .filter(attr => {
                    const lowName = (attr.name || '').trim().toLowerCase();
                    return !['geom', 'the_geom', 'geometry', 'wkb_geometry', 'shape', 'shp'].includes(lowName);
                })
                .map(attr => ({
                    name: attr.name,
                    binding: attr.type === 'String' ? 'java.lang.String' :
                        attr.type === 'Integer' ? 'java.lang.Integer' :
                            attr.type === 'Boolean' ? 'java.lang.Boolean' : 'java.lang.Double',
                    nillable: true
                }))
        ];

        //Create the FeatureType (and PostGIS Table)
        const featureTypeBody =
        {
            featureType: {
                name: layerName,
                nativeName: layerName,
                title: layerName,
                srs: `EPSG:${srid}`,
                attributes: {
                    attribute: computedAttributes
                }
            }
        };

        const ftRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${dataStoreName}/featuretypes`, {
            method: 'POST',
            headers:
            {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(featureTypeBody)
        });

        if (!ftRes.ok) {
            const errorText = await ftRes.text();
            throw new Error(`GeoServer creation failed: ${errorText}`);
        }

        // Add published layer infos to the metadata layer
        const metadata =
        {
            LayerName: layerName,
            LayerSequenceNo: 0,
            LayerVisibilityOnLoad: true,
            IsShowLayer: true,
            GeometryFieldName: 'geom',
            GeometryType: geometryType,
            SRId: srid
        };

        const registered = await addNewLayerConfig(metadata);
        if (!registered) {
            console.warn("Layer published in GeoServer but metadata registration failed.");
        }
        return true;
    }
    catch (err) {
        console.error("Publishing error:", err);
        throw err;
    }
};

// Data Add On
export const batchInsertFeatures = async (fullLayerName, features, geometryName = 'geom', srid = '3857', targetGeometryType = 'Unknown') => {
    try {
        if (!features || features.length === 0) return true;
        const [prefix, layerPart] = fullLayerName.includes(':') ? fullLayerName.split(':') : [WORKSPACE, fullLayerName];
        let insertsXml = '';
        const escapeXml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        };

        for (const feature of features) {
            let featureContentXml = '';

            // 1. Process Geometry FIRST (Standard WFS schema often expects geometry first)
            const geom = feature.geometry;
            if (geom) {
                let gmlGeom = '';
                const type = geom.type;
                const coords = geom.coordinates;

                if (coords && Array.isArray(coords) && coords.length > 0) {
                    if (type === 'Point') {
                        gmlGeom = `<gml:Point srsName="EPSG:${srid}"><gml:pos>${coords.join(' ')}</gml:pos></gml:Point>`;
                    } else if (type === 'LineString') {
                        gmlGeom = `<gml:LineString srsName="EPSG:${srid}"><gml:posList>${coords.map(c => c.join(' ')).join(' ')}</gml:posList></gml:LineString>`;
                    } else if (type === 'Polygon') {
                        const ring = coords[0].map(c => c.join(' ')).join(' ');
                        const polygonXml = `<gml:Polygon srsName="EPSG:${srid}"><gml:exterior><gml:LinearRing><gml:posList>${ring}</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon>`;

                        // Promotion to MultiPolygon if target requires it
                        if (targetGeometryType && targetGeometryType.toLowerCase().includes('multipolygon')) {
                            gmlGeom = `<gml:MultiPolygon srsName="EPSG:${srid}"><gml:polygonMember>${polygonXml}</gml:polygonMember></gml:MultiPolygon>`;
                        } else {
                            gmlGeom = polygonXml;
                        }
                    } else if (type === 'MultiPolygon') {
                        let polygonsXml = '';
                        coords.forEach(poly => {
                            const ring = poly[0].map(c => c.join(' ')).join(' ');
                            polygonsXml += `<gml:polygonMember><gml:Polygon srsName="EPSG:${srid}"><gml:exterior><gml:LinearRing><gml:posList>${ring}</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></gml:polygonMember>`;
                        });
                        gmlGeom = `<gml:MultiPolygon srsName="EPSG:${srid}">${polygonsXml}</gml:MultiPolygon>`;
                    }

                    if (gmlGeom) {
                        featureContentXml += `<${prefix}:${geometryName}>${gmlGeom}</${prefix}:${geometryName}>`;
                    }
                }
            }

            // 2. Process properties
            for (const [key, value] of Object.entries(feature.properties || {})) {
                const lowKey = key.trim().toLowerCase();
                const lowGeomName = (geometryName || '').trim().toLowerCase();
                // Skip system/internal/geometry columns
                if (['id', 'fid', 'ogc_fid', 'gid', 'objectid', 'geom', 'the_geom', 'geometry', 'wkb_geometry', 'shape', 'shp'].includes(lowKey) ||
                    lowKey === lowGeomName ||
                    key.startsWith('_') ||
                    value === null ||
                    value === undefined) continue;

                featureContentXml += `<${prefix}:${key}>${escapeXml(value)}</${prefix}:${key}>`;
            }

            // Build the complete feature XML
            const featureXml = `<${fullLayerName}>${featureContentXml}</${fullLayerName}>`;
            insertsXml += `<wfs:Insert>${featureXml}</wfs:Insert>`;
        }

        // Check if we have any features to insert
        if (!insertsXml) {
            console.warn('No valid features to insert after processing');
            return false;
        }

        const wfsTransactionXml = `
        <wfs:Transaction service="WFS" version="1.1.0"
        xmlns:wfs="http://www.opengis.net/wfs"
        xmlns:gml="http://www.opengis.net/gml"
        xmlns:${prefix}="${prefix}"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
            ${insertsXml}
        </wfs:Transaction>`.trim();


        const response = await fetch(`${GEOSERVER_URL}/wfs`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/xml',
                    'Authorization': AUTH_HEADER
                },
                body: wfsTransactionXml
            });

        if (response.ok) {
            const result = await response.text();
            const hasException = result.includes('ExceptionText');
            const hasSuccess = result.includes('TransactionSummary');

            if (hasException) {
                console.error('WFS-T Insert Exception Response:', result);
            }

            if (!hasSuccess) {
                console.error('WFS-T response missing TransactionSummary:', result);
            }

            return hasSuccess && !hasException;
        } else {
            const errorText = await response.text();
            console.error(`Batch insert HTTP error (${response.status}):`, errorText);
        }
        return false;
    }
    catch (err) {
        console.error("Batch insert failed:", err);
        return false;
    }
};

//data Updation
export const batchUpdateFeaturesByProperty = async (fullLayerName, features, matchingKey) => {
    try {
        if (!features || features.length === 0) return true;

        const [prefix, layerPart] = fullLayerName.includes(':') ? fullLayerName.split(':') : [WORKSPACE, fullLayerName];
        const escapeXml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        };

        let updatesXml = '';

        for (const feature of features) {
            const keyValue = feature.properties?.[matchingKey];
            if (keyValue === undefined || keyValue === null) continue;

            let propertyXml = '';
            for (const [key, value] of Object.entries(feature.properties || {})) {
                const lowKey = key.trim().toLowerCase();
                // Skip system/internal/geometry columns
                if (['id', 'fid', 'ogc_fid', 'gid', 'objectid', 'geom', 'the_geom', 'geometry', 'wkb_geometry', 'shape', 'shp'].includes(lowKey) ||
                    key === matchingKey ||
                    key.startsWith('_') ||
                    value === null ||
                    value === undefined) continue;

                propertyXml += `<wfs:Property><wfs:Name>${key}</wfs:Name><wfs:Value>${escapeXml(value)}</wfs:Value></wfs:Property>`;
            }

            if (!propertyXml) continue;

            updatesXml += `
            <wfs:Update typeName="${fullLayerName}">
                ${propertyXml}
                <ogc:Filter>
                    <ogc:PropertyIsEqualTo>
                        <ogc:PropertyName>${matchingKey}</ogc:PropertyName>
                        <ogc:Literal>${escapeXml(keyValue)}</ogc:Literal>
                    </ogc:PropertyIsEqualTo>
                </ogc:Filter>
            </wfs:Update>`;
        }

        if (!updatesXml) return true;

        const wfsTransactionXml = `
        <wfs:Transaction service="WFS" version="1.1.0"
        xmlns:wfs="http://www.opengis.net/wfs"
        xmlns:ogc="http://www.opengis.net/ogc"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:${prefix}="${prefix}"
        xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
            ${updatesXml}
        </wfs:Transaction>`.trim();

        const response = await fetch(`${GEOSERVER_URL}/wfs`,
            {
                method: 'POST',
                headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'text/xml' },
                body: wfsTransactionXml
            });

        if (response.ok) {
            const result = await response.text();
            return result.includes('TransactionSummary') && !result.includes('ExceptionText');
        }
        return false;
    }
    catch (err) {
        console.error("Batch update failed:", err);
        return false;
    }
};

//Retrive GeoServer all Layer Configuration for Workspace
export const GetGeoServerAllLayerDetails = async () => {
    try {

        const listRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/layers.json`,
            {
                headers: { 'Authorization': AUTH_HEADER }
            });

        if (!listRes.ok) throw new Error("Could not fetch layers list");
        const listData = await listRes.json();
        const layers = listData.layers?.layer || [];

        const detailsPromises = layers.map(async (l) => {
            const layerUrl = `${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/layers/${l.name}.json`;
            const detailRes = await fetch(layerUrl, {
                headers: { 'Authorization': AUTH_HEADER }
            });

            if (!detailRes.ok) return null;
            const detailData = await detailRes.json();

            const resourceUrl = `${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/featuretypes/${l.name}.json`;
            const resourceRes = await fetch(resourceUrl,
                {
                    headers: { 'Authorization': AUTH_HEADER }
                });

            if (!resourceRes.ok) return null;
            const resourceData = await resourceRes.json();

            const featureType = resourceData.featureType;
            return {
                id: l.name,
                name: l.name,
                fullPath: `${WORKSPACE}:${l.name}`,
                srs: featureType.srs,
                nativeSRS: featureType.nativeCRS,
                store: featureType.store.name,
                attributes: featureType.attributes?.attribute || [],
                geometryType: featureType.attributes?.attribute?.find(a =>
                    ['geom', 'the_geom', 'wkb_geometry', 'geometry', 'way'].includes(a.name.toLowerCase())
                )?.binding?.split('.').pop() || 'Unknown'
            };
        });

        const allDetails = await Promise.all(detailsPromises);
        return allDetails.filter(Boolean);

    } catch (err) {
        console.error("Fetch full GeoServer details failed:", err);
        return [];
    }
};

// Update Projection of Layer in Geoserver
export const UpdateLayerProjection = async (layerName, newSrid) => {
    try {
        const body = {
            featureType: {
                srs: `EPSG:${newSrid}`,
                projectionPolicy: 'FORCE_DECLARED'
            }
        };

        const response = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/featuretypes/${layerName}.json`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

        return response.ok;

    } catch (err) {
        console.error("SRS update failed:", err);
        return false;
    }
};

// Delete Acutal Layer From Geoserver
export const DeleteLayerInGeoServer = async (layerName) => {
    try {
        const layerDel = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/layers/${layerName}.json`,
            {
                method: 'DELETE',
                headers: { 'Authorization': AUTH_HEADER }
            });

        const ftDel = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/featuretypes/${layerName}.json?recurse=true`, {
            method: 'DELETE',
            headers: { 'Authorization': AUTH_HEADER }
        });

        return layerDel.ok || ftDel.ok;
    }
    catch (err) {
        console.error("Delete GeoServer layer failed:", err);
        return false;
    }
};
