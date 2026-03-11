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
                srid: feature.properties.SRId || 'undef',
                extent: feature.properties.Extent || null
            }));
        }
    }
    catch (error) {
        console.error("Failed to fetch layers from GeoServer metadata layer", error);
    }
    return [];
};




//Retrieve Layer Styles based on Layer Name



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




//Gets Layer Attributes (Column Properties)


// Delete Feature By feature id (fid) for layer wise and metadata table



// Add New Feature from Attribute Table


//Update Feature 


//Query Builder Filter



// Layer Status For Layer Management
export const fetchLayerStatuses = async () => {
    const statuses = {};
    try {
        // 1. Get all LAYERS configured in GeoServer via REST
        const restUrl = `${GEOSERVER_URL}/rest/layers.json`;
        const restResponse = await fetch(restUrl, {
            headers: {
                'Authorization': AUTH_HEADER,
                'Accept': 'application/json'
            }
        });

        let configuredLayers = [];
        if (restResponse.ok) {
            const data = await restResponse.json();
            if (data && data.layers && data.layers.layer) {
                // Return full names like "cite:layer_name"
                configuredLayers = data.layers.layer.map(l => l.name);
            }
        }

        // 2. Get all FEATURE TYPES active in WFS GetCapabilities
        const wfsUrl = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetCapabilities`;
        const wfsResponse = await fetch(wfsUrl, {
            headers: { 'Authorization': AUTH_HEADER }
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

        // 3. Map status: Configured + In GetCapabilities = "Active"
        //    Configured but NOT in GetCapabilities = "Error"
        //    Otherwise = "Inactive"
        configuredLayers.forEach(layerName => {
            const shortName = layerName.includes(':') ? layerName.split(':').pop() : layerName;
            const isActive = activeLayers.includes(layerName);

            const status = isActive ? 'Active' : 'Error';

            // Store both keys for flexible matching in the UI
            statuses[layerName] = status;
            statuses[shortName] = status;
        });

    } catch (err) {
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

// Initialize the "Layer" metadata table in GeoServer (REST API)
export const initializeMetadataLayer = async () => {
    try {
        // 1. Find the PostGIS DataStore name
        const dsRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores.json`,
            {
                headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' }
            });

        if (!dsRes.ok) throw new Error("Failed to find datastores");
        const dsData = await dsRes.json();
        const dataStoreName = dsData.dataStores?.dataStore?.[0]?.name;
        if (!dataStoreName) throw new Error("No DataStore found to host metadata.");

        // 2. Define the schema for the "Layer" metadata table (no geometry)
        const attributes = [
            { name: 'LayerLabel', binding: 'java.lang.String', nillable: true },
            { name: 'LayerName', binding: 'java.lang.String', nillable: true },
            { name: 'LayerSequenceNo', binding: 'java.lang.Integer', nillable: true },
            { name: 'IsShowLayer', binding: 'java.lang.Boolean', nillable: true },
            { name: 'LayerVisibilityOnLoad', binding: 'java.lang.Boolean', nillable: true },
            { name: 'AttributeTableName', binding: 'java.lang.String', nillable: true }
        ];

        const body = {
            featureType: {
                name: 'Layer',
                nativeName: 'Layer',
                title: 'Layer Management Metadata',
                srs: 'EPSG:4326',
                attributes: {
                    attribute: attributes
                }
            }
        };

        const ftRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${dataStoreName}/featuretypes`, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (ftRes.ok) {
            await reloadGeoServer();
            return true;
        } else {
            const errorText = await ftRes.text();
            console.error("GeoServer init failed:", errorText);
            return false;
        }
    } catch (err) {
        console.error("Initialization failed:", err);
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

        // Compute initial extent if provided
        let nativeBBox = null;
        if (config.extent) {
            const ext = config.extent.split(',').map(Number);
            if (ext.length === 4 && ext.every(n => !isNaN(n))) {
                nativeBBox = {
                    minx: ext[0],
                    miny: ext[1],
                    maxx: ext[2],
                    maxy: ext[3],
                    crs: `EPSG:${srid}`
                };
            }
        }

        //Create the FeatureType (and PostGIS Table)
        const featureTypeBody =
        {
            featureType: {
                name: layerName,
                nativeName: layerName,
                title: layerName,
                srs: `EPSG:${srid}`,
                nativeCRS: `EPSG:${srid}`,
                projectionPolicy: 'FORCE_DECLARED',
                attributes: {
                    attribute: computedAttributes
                },
                ...(nativeBBox && {
                    nativeBoundingBox: nativeBBox,
                    latLonBoundingBox: nativeBBox // For 4326/3857, we can use same if simplified
                })
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
            SRId: srid,
            Extent: config.extent || null
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

/**
 * Force GeoServer to recompute the native and lat/lon bounding boxes for a layer.
 * This is necessary when GeoServer stores a placeholder [0,0,-1,-1] extent.
 */



//data Updation


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
            const layerType = detailData.layer?.type; // "VECTOR" or "RASTER"

            let resourceUrl = '';
            if (layerType === 'RASTER') {
                resourceUrl = `${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/coverages/${l.name}.json`;
            } else {
                resourceUrl = `${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/featuretypes/${l.name}.json`;
            }

            const resourceRes = await fetch(resourceUrl,
                {
                    headers: { 'Authorization': AUTH_HEADER }
                });

            if (!resourceRes.ok) return null;
            const resourceData = await resourceRes.json();

            // Handle both FeatureType and Coverage structures
            const resourceInfo = resourceData.featureType || resourceData.coverage;
            if (!resourceInfo) return null;

            const attrRaw = resourceInfo.attributes?.attribute || [];
            const attributes = Array.isArray(attrRaw) ? attrRaw : (attrRaw ? [attrRaw] : []);

            return {
                id: l.name,
                name: l.name,
                fullPath: `${WORKSPACE}:${l.name}`,
                srs: resourceInfo.srs,
                nativeSRS: resourceInfo.nativeCRS,
                store: resourceInfo.store?.name || 'Unknown',
                attributes: attributes,
                geometryType: layerType === 'RASTER' ? 'Raster' : (attributes.find(a =>
                    ['geom', 'the_geom', 'wkb_geometry', 'geometry', 'way'].includes(a.name.toLowerCase())
                )?.binding?.split('.').pop() || 'Unknown')
            };
        });

        const allDetails = await Promise.all(detailsPromises);
        return allDetails.filter(Boolean);

    } catch (err) {
        console.error("Fetch full GeoServer details failed:", err);
        return [];
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
