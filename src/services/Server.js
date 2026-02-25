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

//Retrieve Layer Styles based on Layer Name
export const getLayerStyle = async (fullLayerName) => {
    try {
        const [ws, name] = fullLayerName.split(':');
        console.log(`[SLD Fetch] Initiating fetch for layer: ${fullLayerName}`);

        // ─── PHASE 1: Check for layer-specific style ({LayerName}_Style) ───────────
        const scopedStyleName = `${name}_Style`;
        const scopedCheck = await fetch(
            `${GEOSERVER_URL}/rest/workspaces/${ws}/styles/${scopedStyleName}.json?t=${Date.now()}`,
            { headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' } }
        );
        if (scopedCheck.ok) {
            console.log(`[SLD Fetch] Found layer-specific style: ${ws}:${scopedStyleName}`);
            const sldResult = await fetchSLD(scopedStyleName, ws);
            if (sldResult?.sldBody) {
                return { ...sldResult, isLayerSpecificStyle: true };
            }
        }

        // ─── PHASE 2: Fall back to GeoServer default style ──────────────────────────
        console.warn(`[SLD Fetch] Layer-specific style '${scopedStyleName}' not found. Reading current default...`);

        // Use workspace-qualified URL for layer info to be precise
        const layerResponse = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/layers/${name}.json?t=${Date.now()}`,
            { headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' } });

        if (!layerResponse.ok) {
            console.warn(`[SLD Fetch] Layer ${fullLayerName} not found in workspace context (Status: ${layerResponse.status}), trying global...`);
            const globalLayerRes = await fetch(`${GEOSERVER_URL}/rest/layers/${name}.json?t=${Date.now()}`, {
                headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' }
            });
            if (!globalLayerRes.ok) {
                console.error(`[SLD Fetch] Layer ${name} not found globally either (Status: ${globalLayerRes.status})`);
                return null;
            }
            const data = await globalLayerRes.json();
            const defaultStyle = data.layer.defaultStyle.name;
            console.log(`[SLD Fetch] Found global layer. Default style: ${defaultStyle}`);
            const sldResult = await fetchSLD(defaultStyle, ws);
            // isLayerSpecificStyle: false → caller will bootstrap a dedicated style
            return sldResult
                ? { ...sldResult, isLayerSpecificStyle: false }
                : { styleName: defaultStyle, sldBody: null, isLayerSpecificStyle: false };
        }

        const layerData = await layerResponse.json();
        const styleInfo = layerData.layer.defaultStyle;
        const styleName = styleInfo.name;

        // Use href to determine if style is workspace-specific
        const isWorkspaceStyle = styleInfo.href.includes('/workspaces/');
        const targetWs = isWorkspaceStyle ? ws : null;

        console.log(`[SLD Fetch] Found layer. Style: ${styleName}, Workspace-Specific: ${isWorkspaceStyle}`);
        const sldResult = await fetchSLD(styleName, targetWs);
        // isLayerSpecificStyle: false because this is a generic/shared GeoServer style
        return sldResult
            ? { ...sldResult, isLayerSpecificStyle: false }
            : { styleName, sldBody: null, isLayerSpecificStyle: false };
    }
    catch (err) {
        console.error('[SLD Fetch] Failed to fetch layer style:', err);
    }
    return null;
};

// Helper to fetch SLD from either workspace or global
const fetchSLD = async (styleName, workspace) => {
    try {
        // Strip workspace prefix if present (e.g., "cite:States" -> "States")
        const cleanStyleName = styleName.includes(':') ? styleName.split(':')[1] : styleName;
        console.log(`[SLD Fetch] Fetching body for style: ${styleName} (Clean: ${cleanStyleName}) | Target Workspace: ${workspace || 'GLOBAL'}`);

        let sldResponse = null;

        // 1. Try workspace paths ONLY if workspace is provided
        if (workspace) {
            // Try workspace style with .sld
            sldResponse = await fetch(`${GEOSERVER_URL}/rest/workspaces/${workspace}/styles/${cleanStyleName}.sld?t=${Date.now()}`, {
                headers: { 'Authorization': AUTH_HEADER }
            });

            // Try workspace style without .sld extension
            if (!sldResponse.ok) {
                console.warn(`[SLD Fetch] Workspace SLD (.sld) failed for ${cleanStyleName}, trying without extension...`);
                sldResponse = await fetch(`${GEOSERVER_URL}/rest/workspaces/${workspace}/styles/${cleanStyleName}?t=${Date.now()}`, {
                    headers: { 'Authorization': AUTH_HEADER }
                });
            }
        }

        // 2. Try global paths if workspace fetch failed or wasn't attempted
        if (!sldResponse || !sldResponse.ok) {
            console.warn(`[SLD Fetch] Workspace style not found/skipped for ${cleanStyleName}, trying global...`);

            // Global style with .sld
            sldResponse = await fetch(`${GEOSERVER_URL}/rest/styles/${styleName}.sld?t=${Date.now()}`, {
                headers: { 'Authorization': AUTH_HEADER }
            });

            // Global style without extension
            if (!sldResponse.ok) {
                console.warn(`[SLD Fetch] Global SLD (.sld) failed for ${styleName}, trying without extension...`);
                sldResponse = await fetch(`${GEOSERVER_URL}/rest/styles/${styleName}?t=${Date.now()}`, {
                    headers: { 'Authorization': AUTH_HEADER }
                });
            }
        }

        if (sldResponse && sldResponse.ok) {
            const sldBody = await sldResponse.text();
            console.log(`[SLD Fetch] Successfully retrieved SLD body for ${styleName}. Size: ${sldBody.length} chars.`);
            return { styleName, sldBody };
        } else {
            const status = sldResponse ? sldResponse.status : 'No Response';
            console.error(`[SLD Fetch] All attempts to fetch SLD for ${styleName} failed. Final Status: ${status}`);
        }
    } catch (err) {
        console.error(`[SLD Fetch] Error fetching SLD for style ${styleName}:`, err);
    }
    return null;
};

export const updateLayerStyle = async (fullLayerName, styleName, sldBody) => {
    try {
        const [layerWs] = fullLayerName.split(':');

        // Determine target workspace and clean style name
        let styleWs = layerWs;
        let cleanStyleName = styleName;
        if (styleName && styleName.includes(':')) {
            const parts = styleName.split(':');
            styleWs = parts[0];
            cleanStyleName = parts[1];
        }

        console.log(`[Style Update] Layer: ${fullLayerName}, Style: ${styleWs}:${cleanStyleName}`);

        // ─── STEP 1: Determine where the style lives (or needs to be created) ────────
        const wsCheckRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${styleWs}/styles/${cleanStyleName}.json`, {
            headers: { 'Authorization': AUTH_HEADER }
        });
        const globalCheckRes = await fetch(`${GEOSERVER_URL}/rest/styles/${cleanStyleName}.json`, {
            headers: { 'Authorization': AUTH_HEADER }
        });

        const existsInWs = wsCheckRes.ok;
        const existsGlobal = globalCheckRes.ok;

        // Determine the PUT target URL
        let putUrl;
        if (existsInWs) {
            putUrl = `${GEOSERVER_URL}/rest/workspaces/${styleWs}/styles/${cleanStyleName}`;
            console.log(`[Style Update] Style exists in workspace. Updating in-place.`);
        } else if (existsGlobal) {
            putUrl = `${GEOSERVER_URL}/rest/styles/${cleanStyleName}`;
            console.log(`[Style Update] Style exists globally. Updating global style.`);
        } else {
            // ─── STEP 2: Style doesn't exist — POST to create, then PUT SLD body ─────
            console.log(`[Style Update] Style '${cleanStyleName}' not found. Creating in workspace '${styleWs}'...`);
            const createRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${styleWs}/styles`, {
                method: 'POST',
                headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
                body: JSON.stringify({ style: { name: cleanStyleName, filename: `${cleanStyleName}.sld` } })
            });
            if (!createRes.ok) {
                const errText = await createRes.text();
                console.error(`[Style Update] POST create failed (${createRes.status}):`, errText);
                return false;
            }
            console.log(`[Style Update] Style record created. Uploading SLD body...`);
            putUrl = `${GEOSERVER_URL}/rest/workspaces/${styleWs}/styles/${cleanStyleName}`;
        }

        // ─── STEP 3: PUT the SLD body ─────────────────────────────────────────────────
        const putRes = await fetch(putUrl, {
            method: 'PUT',
            headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/vnd.ogc.sld+xml' },
            body: sldBody
        });

        if (!putRes.ok) {
            const errText = await putRes.text();
            console.error(`[Style Update] PUT SLD failed (${putRes.status}):`, errText);
            return false;
        }

        console.log(`[Style Update] SLD body uploaded successfully.`);
        return true;
    }
    catch (err) {
        console.error('[Style Update] Failed to update layer style:', err);
        return false;
    }
};

// Set a layer default style (workspace style preferred)
export const setLayerDefaultStyle = async (fullLayerName, styleName) => {
    try {
        const [layerWs, layerName] = fullLayerName.split(':');
        const cleanStyleName = styleName.includes(':') ? styleName.split(':')[1] : styleName;

        const response = await fetch(`${GEOSERVER_URL}/rest/workspaces/${layerWs}/layers/${layerName}.json`, {
            method: 'PUT',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                layer: {
                    defaultStyle: {
                        name: cleanStyleName,
                        workspace: { name: layerWs }
                    }
                }
            })
        });

        if (!response.ok) {
            console.error(`Failed to set default style for ${fullLayerName}:`, await response.text());
        }

        return response.ok;
    } catch (err) {
        console.error('Failed to set layer default style:', err);
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

        // GML 3: Space-separated coordinates: "x y x y"
        const fmtCoords = (arr) => arr.map(c => `${c[0]} ${c[1]}`).join(' ');

        if (type === 'Point') {
            gmlGeometry = `<gml:Point srsName="EPSG:${srid}"><gml:pos>${coords[0]} ${coords[1]}</gml:pos></gml:Point>`;
        }
        else if (type === 'LineString') {
            gmlGeometry = `<gml:LineString srsName="EPSG:${srid}"><gml:posList>${fmtCoords(coords)}</gml:posList></gml:LineString>`;
        }
        else if (type === 'Polygon') {
            const exterior = fmtCoords(coords[0]);
            let interiors = '';
            if (coords.length > 1) {
                for (let j = 1; j < coords.length; j++) {
                    interiors += `<gml:interior><gml:LinearRing><gml:posList>${fmtCoords(coords[j])}</gml:posList></gml:LinearRing></gml:interior>`;
                }
            }
            let polygonXml = `<gml:Polygon srsName="EPSG:${srid}"><gml:exterior><gml:LinearRing><gml:posList>${exterior}</gml:posList></gml:LinearRing></gml:exterior>${interiors}</gml:Polygon>`;
            if (targetGeometryType && targetGeometryType.toLowerCase().includes('multipolygon')) {
                gmlGeometry = `<gml:MultiPolygon srsName="EPSG:${srid}"><gml:polygonMember>${polygonXml}</gml:polygonMember></gml:MultiPolygon>`;
            } else {
                gmlGeometry = polygonXml;
            }
        }
        else if (type === 'MultiPolygon') {
            // MultiPolygon for single insert (e.g. from existing feature)
            let polygonsXml = '';
            coords.forEach(poly => {
                const exterior = fmtCoords(poly[0]);
                let interiors = '';
                if (poly.length > 1) {
                    for (let j = 1; j < poly.length; j++) {
                        interiors += `<gml:interior><gml:LinearRing><gml:posList>${fmtCoords(poly[j])}</gml:posList></gml:LinearRing></gml:interior>`;
                    }
                }
                polygonsXml += `<gml:polygonMember><gml:Polygon srsName="EPSG:${srid}"><gml:exterior><gml:LinearRing><gml:posList>${exterior}</gml:posList></gml:LinearRing></gml:exterior>${interiors}</gml:Polygon></gml:polygonMember>`;
            });
            gmlGeometry = `<gml:MultiPolygon srsName="EPSG:${srid}"><gml:polygonMember>${polygonsXml}</gml:polygonMember></gml:MultiPolygon>`;
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
export const recalculateLayerBBox = async (fullLayerName) => {
    try {
        const [ws, name] = fullLayerName.split(':');

        // 1. Find the actual datastore for this specific layer
        const layerRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/layers/${name}.json`,
            { headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' } });

        if (!layerRes.ok) throw new Error(`Layer lookup failed: ${layerRes.status}`);
        const layerData = await layerRes.json();
        const resourceUrl = layerData.layer.resource.href;

        // Extract datastore name from URL: .../datastores/{dsName}/featuretypes/...
        const dsMatch = resourceUrl.match(/\/datastores\/([^/]+)\//);
        const dataStoreName = dsMatch ? dsMatch[1] : null;

        if (!dataStoreName) throw new Error('Could not determine datastore for layer');

        const url = `${GEOSERVER_URL}/rest/workspaces/${ws}/datastores/${dataStoreName}/featuretypes/${name}?recalculate=nativebbox,latlonbbox`;
        const recalcRes = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
            body: JSON.stringify({ featureType: { name } })
        });

        if (!recalcRes.ok) {
            const errorText = await recalcRes.text();
            console.error(`[BBox] Recalculation failed for ${fullLayerName}: ${recalcRes.status}`, errorText);
            return false;
        }
        return true;
    } catch (err) {
        console.error('[BBox] Error recalculating extent:', err);
        return false;
    }
};
export const batchInsertFeatures = async (fullLayerName, features, geometryName = 'geom', srid = '3857', targetGeometryType = 'Unknown', onProgress = null) => {
    try {
        if (!features || features.length === 0) return true;
        const [prefix, layerPart] = fullLayerName.includes(':') ? fullLayerName.split(':') : [WORKSPACE, fullLayerName];

        // Use the workspace prefix as the namespace URI (matches GeoServer config)
        const namespaceUri = prefix;
        const BATCH_SIZE = 25; // Reduced for greater stability with complex geometries
        const totalChunks = Math.ceil(features.length / BATCH_SIZE);

        const escapeXml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        };

        const sanitizeXmlTagName = (name) => {
            if (!name) return 'field';
            let sanitized = name.trim().replace(/^[^a-zA-Z_]+/, '_');
            sanitized = sanitized.replace(/[^a-zA-Z0-9_\-.]/g, '_');
            return sanitized;
        };

        const cleanGeomName = sanitizeXmlTagName(geometryName);

        for (let i = 0; i < features.length; i += BATCH_SIZE) {
            const chunk = features.slice(i, i + BATCH_SIZE);
            const currentChunkNum = Math.floor(i / BATCH_SIZE) + 1;

            if (onProgress) {
                onProgress(currentChunkNum, totalChunks, chunk.length);
            }

            let insertsXml = '';
            for (const feature of chunk) {
                let featureContentXml = '';

                // 1. Process Geometry
                const geom = feature.geometry;
                if (geom) {
                    let gmlGeom = '';
                    const type = geom.type;
                    const coords = geom.coordinates;

                    if (coords && Array.isArray(coords) && coords.length > 0) {
                        // GML 3: Space-separated coordinates: "x y x y"
                        const fmtCoords = (arr) => arr.map(c => `${c[0]} ${c[1]}`).join(' ');

                        if (type === 'Point') {
                            gmlGeom = `<gml:Point srsName="EPSG:${srid}" xmlns:gml="http://www.opengis.net/gml"><gml:pos>${coords[0]} ${coords[1]}</gml:pos></gml:Point>`;
                        } else if (type === 'LineString') {
                            gmlGeom = `<gml:LineString srsName="EPSG:${srid}" xmlns:gml="http://www.opengis.net/gml"><gml:posList>${fmtCoords(coords)}</gml:posList></gml:LineString>`;
                        } else if (type === 'Polygon') {
                            const exterior = `<gml:exterior><gml:LinearRing><gml:posList>${fmtCoords(coords[0])}</gml:posList></gml:LinearRing></gml:exterior>`;
                            let interiors = '';
                            if (coords.length > 1) {
                                for (let j = 1; j < coords.length; j++) {
                                    interiors += `<gml:interior><gml:LinearRing><gml:posList>${fmtCoords(coords[j])}</gml:posList></gml:LinearRing></gml:interior>`;
                                }
                            }
                            const polygonXml = `<gml:Polygon srsName="EPSG:${srid}" xmlns:gml="http://www.opengis.net/gml">${exterior}${interiors}</gml:Polygon>`;

                            if (targetGeometryType && targetGeometryType.toLowerCase().includes('multipolygon')) {
                                gmlGeom = `<gml:MultiPolygon srsName="EPSG:${srid}" xmlns:gml="http://www.opengis.net/gml"><gml:polygonMember>${polygonXml}</gml:polygonMember></gml:MultiPolygon>`;
                            } else {
                                gmlGeom = polygonXml;
                            }
                        } else if (type === 'MultiPolygon') {
                            let polygonsXml = '';
                            coords.forEach(poly => {
                                const exterior = `<gml:exterior><gml:LinearRing><gml:posList>${fmtCoords(poly[0])}</gml:posList></gml:LinearRing></gml:exterior>`;
                                let interiors = '';
                                if (poly.length > 1) {
                                    for (let j = 1; j < poly.length; j++) {
                                        interiors += `<gml:interior><gml:LinearRing><gml:posList>${fmtCoords(poly[j])}</gml:posList></gml:LinearRing></gml:interior>`;
                                    }
                                }
                                polygonsXml += `<gml:polygonMember><gml:Polygon srsName="EPSG:${srid}">${exterior}${interiors}</gml:Polygon></gml:polygonMember>`;
                            });
                            gmlGeom = `<gml:MultiPolygon srsName="EPSG:${srid}" xmlns:gml="http://www.opengis.net/gml">${polygonsXml}</gml:MultiPolygon>`;
                        }

                        if (gmlGeom) {
                            featureContentXml += `<${prefix}:${cleanGeomName}>${gmlGeom}</${prefix}:${cleanGeomName}>`;
                        }
                    }
                }

                // 2. Process properties
                for (const [key, value] of Object.entries(feature.properties || {})) {
                    const lowKey = key.trim().toLowerCase();
                    const lowGeomName = (geometryName || '').trim().toLowerCase();
                    if (['id', 'fid', 'ogc_fid', 'gid', 'objectid', 'geom', 'the_geom', 'geometry', 'wkb_geometry', 'shape', 'shp'].includes(lowKey) ||
                        lowKey === lowGeomName || key.startsWith('_') || value === null || value === undefined) continue;

                    const sanitizedKey = sanitizeXmlTagName(key);
                    featureContentXml += `<${prefix}:${sanitizedKey}>${escapeXml(value)}</${prefix}:${sanitizedKey}>`;
                }

                insertsXml += `<wfs:Insert><${prefix}:${layerPart}>${featureContentXml}</${prefix}:${layerPart}></wfs:Insert>`;
            }

            if (!insertsXml) continue;

            const wfsTransactionXml = `
            <wfs:Transaction service="WFS" version="1.1.0"
                xmlns:wfs="http://www.opengis.net/wfs"
                xmlns:gml="http://www.opengis.net/gml"
                xmlns:${prefix}="${namespaceUri}"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
                ${insertsXml}
            </wfs:Transaction>`.trim();

            // ROBUST FETCH: Retry mechanism + Delay
            let attempt = 0;
            const maxRetries = 3;
            let success = false;

            while (attempt <= maxRetries && !success) {
                try {
                    const response = await fetch(`${GEOSERVER_URL}/wfs`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/xml', 'Authorization': AUTH_HEADER },
                        body: wfsTransactionXml
                    });

                    const result = await response.text();

                    if (response.ok) {
                        const hasException = result.includes('ExceptionText');
                        if (hasException) {
                            console.error(`[WFS-T] GeoServer Exception in chunk ${currentChunkNum}:`, result);
                            return false;
                        }
                        success = true;
                    } else if (response.status >= 500 && attempt < maxRetries) {
                        // Proxy Timeout / Server Error - Retry
                        attempt++;
                        console.warn(`[WFS-T] Chunk ${currentChunkNum} failed with ${response.status} (Attempt ${attempt}/${maxRetries + 1}). Retrying in ${attempt * 2}s...`);
                        await new Promise(r => setTimeout(r, attempt * 2000));
                        continue;
                    } else {
                        console.error(`[WFS-T] HTTP ${response.status} in chunk ${currentChunkNum}:`, result);
                        return false;
                    }
                } catch (err) {
                    attempt++;
                    console.warn(`[WFS-T] Chunk ${currentChunkNum} failed (Attempt ${attempt}/${maxRetries + 1}):`, err.message);
                    if (attempt > maxRetries) {
                        console.error(`[WFS-T] Batch insert final failure at chunk ${currentChunkNum} after ${attempt} attempts`);
                        throw err; // Re-throw to be caught by the outer try-catch
                    }
                    // Wait a bit before retry
                    await new Promise(r => setTimeout(r, attempt * 2000));
                }
            }

            // Small delay between successful chunks to prevent server saturation
            await new Promise(r => setTimeout(r, 500));
        }

        // After all chunks are successfully inserted, trigger a bbox recalculation once
        await recalculateLayerBBox(fullLayerName);
        return true;
    }
    catch (err) {
        console.error("[WFS-T] Batch insert failed:", err);
        return false;
    }
};

//data Updation
export const batchUpdateFeaturesByProperty = async (fullLayerName, features, matchingKey, onProgress = null) => {
    try {
        if (!features || features.length === 0) return true;

        const [prefix, layerPart] = fullLayerName.includes(':') ? fullLayerName.split(':') : [WORKSPACE, fullLayerName];
        const BATCH_SIZE = 20;
        const totalChunks = Math.ceil(features.length / BATCH_SIZE);

        const escapeXml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        };

        const sanitizeXmlTagName = (name) => {
            if (!name) return 'field';
            let sanitized = name.trim().replace(/^[^a-zA-Z_]+/, '_');
            sanitized = sanitized.replace(/[^a-zA-Z0-9_\-.]/g, '_');
            return sanitized;
        };

        for (let i = 0; i < features.length; i += BATCH_SIZE) {
            const chunk = features.slice(i, i + BATCH_SIZE);
            const currentChunkNum = Math.floor(i / BATCH_SIZE) + 1;

            if (onProgress) {
                onProgress(currentChunkNum, totalChunks, chunk.length);
            }

            let updatesXml = '';
            for (const feature of chunk) {
                const keyValue = feature.properties?.[matchingKey];
                if (keyValue === undefined || keyValue === null) continue;

                let propertyXml = '';
                for (const [key, value] of Object.entries(feature.properties || {})) {
                    const lowKey = key.trim().toLowerCase();
                    if (['id', 'fid', 'ogc_fid', 'gid', 'objectid', 'geom', 'the_geom', 'geometry', 'wkb_geometry', 'shape', 'shp'].includes(lowKey) ||
                        key === matchingKey ||
                        key.startsWith('_') ||
                        value === null ||
                        value === undefined) continue;

                    const sanitizedKey = sanitizeXmlTagName(key);
                    propertyXml += `<wfs:Property><wfs:Name>${sanitizedKey}</wfs:Name><wfs:Value>${escapeXml(value)}</wfs:Value></wfs:Property>`;
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

            if (!updatesXml) continue;

            const wfsTransactionXml = `
            <wfs:Transaction service="WFS" version="1.1.0"
            xmlns:wfs="http://www.opengis.net/wfs"
            xmlns:ogc="http://www.opengis.net/ogc"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xmlns:${prefix}="${prefix}">
                ${updatesXml}
            </wfs:Transaction>`.trim();

            let attempt = 0;
            const maxRetries = 3;
            let success = false;

            while (attempt <= maxRetries && !success) {
                try {
                    const response = await fetch(`${GEOSERVER_URL}/wfs`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/xml', 'Authorization': AUTH_HEADER },
                        body: wfsTransactionXml
                    });

                    const result = await response.text();
                    if (response.ok) {
                        if (result.includes('ExceptionText')) {
                            console.error(`[Batch Update] GeoServer Error in chunk ${currentChunkNum}:`, result);
                            return false;
                        }
                        success = true;
                    } else if (response.status >= 500 && attempt < maxRetries) {
                        attempt++;
                        console.warn(`[Batch Update] Chunk ${currentChunkNum} failed with ${response.status} (Attempt ${attempt}/${maxRetries + 1}). Retrying in ${attempt * 2}s...`);
                        await new Promise(r => setTimeout(r, attempt * 2000));
                        continue;
                    } else {
                        console.error(`[Batch Update] HTTP Error ${response.status} in chunk ${currentChunkNum}:`, result);
                        return false;
                    }
                } catch (err) {
                    attempt++;
                    console.warn(`[Batch Update] Chunk ${currentChunkNum} failed (Attempt ${attempt}/${maxRetries + 1}):`, err.message);
                    if (attempt > maxRetries) {
                        console.error(`[Batch Update] Final failure at chunk ${currentChunkNum} after ${attempt} attempts`);
                        throw err;
                    }
                    await new Promise(r => setTimeout(r, attempt * 2000));
                }
            }

            // Delay between chunks
            await new Promise(r => setTimeout(r, 500));
        }

        return true;
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
