import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { GEOSERVER_URL, AUTH_HEADER, WORKSPACE } from '../../constants/AppConstants';
import { X, LayoutGrid, RefreshCw, Layers, Trash2, Check, AlertCircle, Loader2, LayersPlus, Server, Settings2, Toolbox, HardDrive, FunnelPlus, BookPlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getFeaturesForAttributeTable, deleteFeature, updateFeature } from './LayerOperations';

const LayerManagementCard = ({ isOpen, onClose, data, isLoading, onDeleteFeature, onUpdateFeatures, onSaveNewFeature, onRefresh, onOpenLoadTempModal, onOpenCreateLayer, onOpenDataManipulation, onOpenServerInfo }) => {

    const [layerStatuses, setLayerStatuses] = useState({});
    const [pendingChanges, setPendingChanges] = useState({});
    const [newRows, setNewRows] = useState({});
    const [selectedIds, setSelectedIds] = useState([]);
    const [isInitializing, setIsInitializing] = useState(false);


    const loadLayers = async () => {
        const statusMap = await fetchLayerStatuses();
        setLayerStatuses(statusMap || {});
    };

    useEffect(() => {
        setPendingChanges({});
        setNewRows({});
        setSelectedIds([]);
        loadLayers();
    }, [data]);

    const RefreshGridData = () => {
        setPendingChanges({});
        setNewRows({});
        setSelectedIds([]);
        if (onRefresh) onRefresh();
    };

    const attributeKeys = useMemo(() => {
        const redundant = ['LayerId', 'AttributeTableSchema', 'GeometryFieldName', 'GeometryType', 'SRId'];
        if (!data || data.length === 0) {
            return ['LayerLabel', 'LayerName', 'LayerSequenceNo', 'IsShowLayer', 'LayerVisibilityOnLoad', 'AttributeTableName', 'GeoServerStatus'];
        }
        return [...Object.keys(data[0].properties), 'GeoServerStatus'].filter(k => !redundant.includes(k));
    }, [data]);

    const displayKeys = useMemo(() => {
        return ['LayerLabel', 'LayerName', 'LayerSequenceNo', 'IsShowLayer', 'LayerVisibilityOnLoad', 'AttributeTableName', 'GeoServerStatus'];
    }, []);

    const allConfigs = useMemo(() => {
        const rows = (data || []).map(f => {
            const id = f.id; // Correctly use WFS fid
            return {
                id,
                original: f.properties,
                current: { ...f.properties, ...(pendingChanges[id] || {}) },
                isDirty: !!pendingChanges[id],
                isNew: false,
                feature: f
            };
        });

        const newItems = Object.keys(newRows).map(id => ({
            id,
            original: {},
            current: newRows[id],
            isDirty: true,
            isNew: true
        }));

        return [...newItems, ...rows];
    }, [data, pendingChanges, newRows]);

    const UpdateLayerConfig = (id, field, value, isNew = false) => {
        if (isNew) {
            setNewRows(prev => ({
                ...prev,
                [id]: { ...prev[id], [field]: value }
            }));
        } else {
            setPendingChanges(prev => ({
                ...prev,
                [id]: { ...(prev[id] || {}), [field]: value }
            }));
        }
    };

    const SaveLayerMetaData = async () => {
        let successCount = 0;
        const layerFullName = `${WORKSPACE}:Layer`;

        const newRowIds = Object.keys(newRows);
        if (newRowIds.length > 0) {
            let failureCount = 0;
            for (const id of newRowIds) {
                const row = { ...newRows[id] };
                const success = await onSaveNewFeature(layerFullName, row);
                if (success) {
                    successCount++;
                    setNewRows(prev => {
                        const next = { ...prev };
                        delete next[id];
                        return next;
                    });
                }
                else {
                    failureCount++;
                }
            }

            if (successCount > 0) toast.success(`Created ${successCount} new layer(s).`);
            if (failureCount > 0) toast.error(`Failed to create ${failureCount} rows.`);
        }

        const updateIds = Object.keys(pendingChanges);
        if (updateIds.length > 0) {
            const success = await onUpdateFeatures(layerFullName, pendingChanges);
            if (success) {
                toast.success("Updated configurations.");
                setPendingChanges({});
            }
        }

        if (onRefresh) onRefresh();
    };

    const AddNewLayerConfig = () => {
        const newId = `new- ${Date.now()} `;
        const initialRow = {};
        attributeKeys.forEach(key => {
            if (['IsShowLayer', 'LayerVisibilityOnLoad'].includes(key)) initialRow[key] = true;
            else if (['LayerSequenceNo'].includes(key)) initialRow[key] = 0;
            else if (['LayerLabel', 'LayerName', 'AttributeTableName'].includes(key)) initialRow[key] = '';
            else initialRow[key] = '';
        });

        setNewRows(prev => ({ ...prev, [newId]: initialRow }));
    };

    const DeleteLayerConfig = async () => {
        if (selectedIds.length === 0) return;
        const layerFullName = `${WORKSPACE}:Layer`;
        if (window.confirm(`Delete ${selectedIds.length} items ? `)) {
            for (const id of selectedIds) {
                const config = allConfigs.find(c => c.id == id);
                if (config && config.feature) await onDeleteFeature(layerFullName, config.feature);
            }
            setSelectedIds([]);
            if (onRefresh) onRefresh();
        }
    };

    const HandleInitializeMetadata = async () => {
        setIsInitializing(true);
        const loadingToast = toast.loading("Initializing metadata layer...");
        try {
            const success = await initializeMetadataLayer();
            if (success) {
                toast.success("Metadata layer 'Layer' created successfully!", { id: loadingToast });
                loadLayers();
                if (onRefresh) onRefresh();
            } else {
                toast.error("Failed to initialize metadata layer. Check server configuration.", { id: loadingToast });
            }
        } catch (err) {
            toast.error(`Error: ${err.message}`, { id: loadingToast });
        } finally {
            setIsInitializing(false);
        }
    };

    const toggleSelection = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    if (!isOpen) return null;

    const gridTemplate = `40px repeat(${displayKeys.length}, minmax(130px, 1fr)) 40px`;

    return (
        <div className="layer-management-overlay" onClick={onClose}>
            <div className="elite-modal layer-management-card" onClick={e => e.stopPropagation()} style={{
                width: 'min(1600px, 98vw)', display: 'flex', flexDirection: 'column'
            }}>
                <div className="elite-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <LayoutGrid size={20} color="white" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Layer Management</h3>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Configuration portal</p>
                        </div>
                    </div>
                    <button className="elite-modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                {/* Header */}
                <div style={{ padding: '12px 20px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(!layerStatuses[`${WORKSPACE}:Layer`] && !layerStatuses['Layer']) ? (
                            <button
                                className="elite-btn primary"
                                onClick={HandleInitializeMetadata}
                                disabled={isInitializing}
                                style={{
                                    padding: '6px 14px',
                                    fontSize: '0.8rem',
                                    background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
                                    boxShadow: '0 0 15px rgba(239, 68, 68, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                {isInitializing ? <Loader2 size={14} className="animate-spin" /> : <Settings2 size={14} />}
                                Initialize Metadata Layer (Required)
                            </button>
                        ) : (
                            <>
                                <button className="elite-btn primary" onClick={onOpenLoadTempModal} style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <LayersPlus size={16} />Add Acting Layer
                                </button>
                                <button className="elite-btn primary" onClick={onOpenCreateLayer} style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <FunnelPlus size={16} />Publish New Layer
                                </button>
                                <button className="elite-btn primary" onClick={onOpenDataManipulation} style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'linear-gradient(135deg, #f59e0b, #3b82f6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <HardDrive size={16} />Data Manipulation
                                </button>
                                <button className="elite-btn primary" onClick={onOpenServerInfo} style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'linear-gradient(135deg, #1e293b, #475569)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Toolbox size={16} />Server Info
                                </button>
                                <button className="elite-btn secondary" onClick={AddNewLayerConfig} style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <BookPlus size={16} />Add Layer Config
                                </button>
                            </>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {selectedIds.length > 0 && (
                            <button className="elite-btn danger" onClick={DeleteLayerConfig} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Trash2 size={14} />Delete ({selectedIds.length})
                            </button>
                        )}
                        <button className="elite-btn primary" onClick={RefreshGridData} style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
                            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />Refresh
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <div style={{ flex: 1, overflow: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: '12px', padding: '10px 20px', background: 'var(--color-bg-secondary)', position: 'sticky', top: 0, zIndex: 10, minWidth: 'fit-content' }}>
                        <div />
                        {displayKeys.map(key => <div key={key} style={{ fontSize: '0.65rem', fontWeight: 800, textAlign: 'center' }}>{key}</div>)}
                        <div />
                    </div>

                    <div style={{ minWidth: 'fit-content' }}>
                        {allConfigs.map((config) => (
                            <div key={config.id} style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: '12px', padding: '8px 20px', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
                                <div onClick={() => toggleSelection(config.id)} style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${selectedIds.includes(config.id) ? 'var(--color-primary)' : 'var(--color-border)'} `, background: selectedIds.includes(config.id) ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    {selectedIds.includes(config.id) && <Check size={14} color="white" />}
                                </div>
                                {displayKeys.map(key => {
                                    const value = config.current[key];
                                    if (key === 'GeoServerStatus') {
                                        const layerName = config.current['LayerName'];
                                        const fullLayerName = `${WORKSPACE}:${layerName}`;
                                        // Try matching by full name first, then short name
                                        const status = layerStatuses[fullLayerName] || layerStatuses[layerName] || 'Inactive';

                                        const statusConfig = {
                                            'Active': { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' },
                                            'Error': { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' },
                                            'Inactive': { bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' }
                                        };
                                        const style = statusConfig[status] || statusConfig['Inactive'];

                                        return (
                                            <div key={key} style={{ textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '2px 10px',
                                                    borderRadius: '12px',
                                                    background: style.bg,
                                                    color: style.color,
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600,
                                                    display: 'inline-block',
                                                    minWidth: '65px'
                                                }}>
                                                    {status}
                                                </span>
                                            </div>
                                        );
                                    }
                                    if (typeof value === 'boolean' || ['IsShowLayer', 'LayerVisibilityOnLoad'].includes(key)) return <div key={key} style={{ display: 'flex', justifyContent: 'center' }}><input type="checkbox" checked={!!value} onChange={(e) => UpdateLayerConfig(config.id, key, e.target.checked, config.isNew)} /></div>;
                                    return <input key={key} className="row-input" value={value ?? ''} onChange={(e) => UpdateLayerConfig(config.id, key, e.target.value, config.isNew)} style={{ width: '100%', padding: '4px', textAlign: 'center' }} />;
                                })}
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    {config.isDirty && <AlertCircle size={16} color="var(--color-primary)" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="elite-modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem' }}>{allConfigs.length} Layers</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="elite-btn secondary" onClick={onClose}>Close</button>
                        {(Object.keys(pendingChanges).length > 0 || Object.keys(newRows).length > 0) && <button className="elite-btn primary" onClick={SaveLayerMetaData}>Apply Changes</button>}
                    </div>
                </div>
            </div>
            <style>{`
    .row - input { background: var(--color - bg - secondary); border: 1px solid var(--color - border); border - radius: 4px; outline: none; }
                .row - input:focus { border - color: var(--color - primary); }
`}</style>
        </div >
    );
};

export const reloadGeoServer = async () => {
    try {
        const response = await fetch(`${GEOSERVER_URL}/rest/reload`, {
            method: 'POST',
            headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' }
        });
        return response.ok;
    } catch (err) { console.error('GeoServer reload failed:', err); return false; }
};

export const fetchLayerStatuses = async () => {
    const statuses = {};
    try {
        const restUrl = `${GEOSERVER_URL}/rest/layers.json`;
        const restResponse = await fetch(restUrl, { headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' } });
        let configuredLayers = [];
        if (restResponse.ok) {
            const data = await restResponse.json();
            if (data?.layers?.layer) configuredLayers = data.layers.layer.map(l => l.name);
        }
        const wfsUrl = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetCapabilities`;
        const wfsResponse = await fetch(wfsUrl, { headers: { 'Authorization': AUTH_HEADER } });
        let activeLayers = [];
        if (wfsResponse.ok) {
            const text = await wfsResponse.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const featureTypes = xmlDoc.getElementsByTagName("FeatureType");
            for (let i = 0; i < featureTypes.length; i++) {
                const nameNodes = featureTypes[i].getElementsByTagName("Name");
                if (nameNodes.length > 0) activeLayers.push(nameNodes[0].textContent);
            }
        }
        configuredLayers.forEach(layerName => {
            const shortName = layerName.includes(':') ? layerName.split(':').pop() : layerName;
            const isActive = activeLayers.includes(layerName);
            const status = isActive ? 'Active' : 'Error';
            statuses[layerName] = status;
            statuses[shortName] = status;
        });
    } catch (err) { console.error('Failed to fetch layer statuses:', err); }
    return statuses;
};

export const addNewLayerConfig = async (properties) => {
    try {
        const fullLayerName = `${WORKSPACE}:Layer`;
        const prefix = WORKSPACE;
        let featureContentXml = '';
        for (const [key, value] of Object.entries(properties)) {
            if (!key || ['id', 'layerid', 'fid', 'ogc_fid'].includes(key.toLowerCase()) || key.startsWith('_') || value === null || value === undefined || value === '') continue;
            featureContentXml += `<${prefix}:${key}>${value}</${prefix}:${key}>`;
        }
        const wfsTransactionXml = `
        <wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:gml="http://www.opengis.net/gml" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:${prefix}="${prefix}" xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
        <wfs:Insert><${fullLayerName}>${featureContentXml}</${fullLayerName}></wfs:Insert>
        </wfs:Transaction>`.trim();
        const response = await fetch(`${GEOSERVER_URL}/wfs`, { method: 'POST', headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'text/xml' }, body: wfsTransactionXml });
        if (response.ok) {
            const resultText = await response.text();
            return resultText.includes('TransactionSummary') && (resultText.includes('totalInserted="1"') || resultText.includes('>1</wfs:totalInserted>'));
        }
        return false;
    } catch (error) { console.error("Failed to create layer config:", error); return false; }
};

export const initializeMetadataLayer = async () => {
    try {
        const dsRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores.json`, { headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' } });
        if (!dsRes.ok) throw new Error("Failed to find datastores");
        const dsData = await dsRes.json();
        const dataStoreName = dsData.dataStores?.dataStore?.[0]?.name;
        if (!dataStoreName) throw new Error("No DataStore found");
        const attributes = [
            { name: 'LayerLabel', binding: 'java.lang.String', nillable: true },
            { name: 'LayerName', binding: 'java.lang.String', nillable: true },
            { name: 'LayerSequenceNo', binding: 'java.lang.Integer', nillable: true },
            { name: 'IsShowLayer', binding: 'java.lang.Boolean', nillable: true },
            { name: 'LayerVisibilityOnLoad', binding: 'java.lang.Boolean', nillable: true },
            { name: 'AttributeTableName', binding: 'java.lang.String', nillable: true }
        ];
        const body = { featureType: { name: 'Layer', nativeName: 'Layer', title: 'Layer Management Metadata', srs: 'EPSG:4326', attributes: { attribute: attributes } } };
        const ftRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${dataStoreName}/featuretypes`, {
            method: 'POST', headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        if (ftRes.ok) { await reloadGeoServer(); return true; }
        return false;
    } catch (err) { console.error("Initialization failed:", err); return false; }
};

export const saveSequence = async (sequenceList) => {
    try {
        let tempUpdates = '', finalUpdates = '';
        sequenceList.forEach((item, index) => {
            if (item.sequenceNumber === undefined || item.sequenceNumber === null) return;
            const tempSeq = 100000 + index + Math.floor(Math.random() * 1000);
            const filter = item.fid ? `<ogc:FeatureId fid="${item.fid}"/>` : `<ogc:PropertyIsEqualTo><ogc:PropertyName>LayerName</ogc:PropertyName><ogc:Literal>${item.layerId}</ogc:Literal></ogc:PropertyIsEqualTo>`;
            tempUpdates += `<wfs:Update typeName="${WORKSPACE}:Layer"><wfs:Property><wfs:Name>LayerSequenceNo</wfs:Name><wfs:Value>${tempSeq}</wfs:Value></wfs:Property><ogc:Filter>${filter}</ogc:Filter></wfs:Update>`;
            finalUpdates += `<wfs:Update typeName="${WORKSPACE}:Layer"><wfs:Property><wfs:Name>LayerSequenceNo</wfs:Name><wfs:Value>${item.sequenceNumber}</wfs:Value></wfs:Property><ogc:Filter>${filter}</ogc:Filter></wfs:Update>`;
        });
        if (!tempUpdates) return false;
        const wfsTransactionXml = `<wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">${tempUpdates + finalUpdates}</wfs:Transaction>`;
        const response = await fetch(`${GEOSERVER_URL}/wfs`, { method: 'POST', headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'text/xml' }, body: wfsTransactionXml });
        if (response.ok) {
            const resultText = await response.text();
            return resultText.includes('TransactionSummary');
        }
        return false;
    } catch (error) { console.error("Failed to save sequences:", error); return false; }
};

export const publishNewLayer = async (config) => {
    const { layerName, geometryType, srid = '4326', attributes = [] } = config;
    try {
        const dsRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores.json`, { headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' } });
        if (!dsRes.ok) throw new Error("Failed to find datastores");
        const dsData = await dsRes.json();
        const dataStoreName = dsData.dataStores?.dataStore?.[0]?.name;
        if (!dataStoreName) throw new Error("No DataStore found");
        const computedAttributes = [{ name: 'geom', binding: `org.locationtech.jts.geom.${geometryType}`, nillable: true }, ...attributes.filter(attr => !['geom', 'the_geom', 'geometry'].includes((attr.name || '').toLowerCase())).map(attr => ({ name: attr.name, binding: attr.type === 'String' ? 'java.lang.String' : attr.type === 'Integer' ? 'java.lang.Integer' : attr.type === 'Boolean' ? 'java.lang.Boolean' : 'java.lang.Double', nillable: true }))];
        let nativeBBox = null;
        if (config.extent) {
            const ext = config.extent.split(',').map(Number);
            if (ext.length === 4) nativeBBox = { minx: ext[0], miny: ext[1], maxx: ext[2], maxy: ext[3], crs: `EPSG:${srid}` };
        }
        const body = { featureType: { name: layerName, nativeName: layerName, title: layerName, srs: `EPSG:${srid}`, nativeCRS: `EPSG:${srid}`, projectionPolicy: 'FORCE_DECLARED', attributes: { attribute: computedAttributes }, ...(nativeBBox && { nativeBoundingBox: nativeBBox, latLonBoundingBox: nativeBBox }) } };
        const ftRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${dataStoreName}/featuretypes`, { method: 'POST', headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!ftRes.ok) throw new Error(await ftRes.text());
        const metadata = { LayerName: layerName, LayerSequenceNo: 0, LayerVisibilityOnLoad: true, IsShowLayer: true, AttributeTableName: layerName };
        await addNewLayerConfig(metadata);
        return true;
    } catch (err) { console.error("Publishing error:", err); throw err; }
};

export const GetGeoServerAllLayerDetails = async () => {
    try {
        const listRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/layers.json`, { headers: { 'Authorization': AUTH_HEADER } });
        if (!listRes.ok) throw new Error("Could not fetch layers");
        const listData = await listRes.json();
        const layers = listData.layers?.layer || [];
        const details = await Promise.all(layers.map(async (l) => {
            const layerRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/layers/${l.name}.json`, { headers: { 'Authorization': AUTH_HEADER } });
            if (!layerRes.ok) return null;
            const layerData = await layerRes.json();
            const type = layerData.layer?.type;
            const endpoint = type === 'RASTER' ? 'coverages' : 'featuretypes';
            const resRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/${endpoint}/${l.name}.json`, { headers: { 'Authorization': AUTH_HEADER } });
            if (!resRes.ok) return null;
            const resData = await resRes.json();
            const info = resData.featureType || resData.coverage;
            const attrs = info.attributes?.attribute || [];
            return { id: l.name, name: l.name, fullPath: `${WORKSPACE}:${l.name}`, srs: info.srs, store: info.store?.name, attributes: Array.isArray(attrs) ? attrs : [attrs], geometryType: type === 'RASTER' ? 'Raster' : (Array.isArray(attrs) ? attrs : [attrs]).find(a => ['geom', 'the_geom', 'geometry'].includes(a.name.toLowerCase()))?.binding?.split('.').pop() || 'Unknown' };
        }));
        return details.filter(Boolean);
    } catch (err) { console.error("Fetch full details failed:", err); return []; }
};

export const DeleteLayerInGeoServer = async (layerName) => {
    try {
        const layerDel = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/layers/${layerName}.json`, { method: 'DELETE', headers: { 'Authorization': AUTH_HEADER } });
        const ftDel = await fetch(`${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/featuretypes/${layerName}.json?recurse=true`, { method: 'DELETE', headers: { 'Authorization': AUTH_HEADER } });
        return layerDel.ok || ftDel.ok;
    } catch (err) { console.error("Delete failed:", err); return false; }
};

export const getGeoServerLayers = async () => {
    try {
        const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${WORKSPACE}:Layer&outputFormat=application/json`;
        const response = await axios.get(url, { headers: { 'Authorization': AUTH_HEADER } });
        if (response.data?.features) {
            return response.data.features
                .filter(f => f.properties.LayerName !== 'Layer' && f.properties.IsShowLayer === true)
                .sort((a, b) => (a.properties.LayerSequenceNo ?? 999) - (b.properties.LayerSequenceNo ?? 999))
                .map(f => ({
                    fullName: `${WORKSPACE}:${f.properties.LayerName}`,
                    sequence: f.properties.LayerSequenceNo ?? 999,
                    initialVisibility: Boolean(f.properties.LayerVisibilityOnLoad),
                    layerId: f.properties.LayerName,
                    fid: f.id,
                    geometryFieldName: f.properties.GeometryFieldName || 'geom',
                    geometryType: f.properties.GeometryType || 'Unknown',
                    srid: f.properties.SRId || '4326',
                    extent: f.properties.Extent || null
                }));
        }
    } catch (error) { console.error("Failed to fetch layers:", error); }
    return [];
};

/**
 * Hook to manage Layer Management state and operations.
 */
export const useLayerManagement = () => {
    const [showLayerManagement, setShowLayerManagement] = useState(false);
    const [layerManagementData, setLayerManagementData] = useState([]);
    const [isLayerManagementLoading, setIsLayerManagementLoading] = useState(false);

    const handleRefreshLayerManagement = async () => {
        setIsLayerManagementLoading(true);
        try {
            const data = await getFeaturesForAttributeTable('Layer', `${WORKSPACE}:Layer`);
            setLayerManagementData(data);
        } catch (err) {
            console.error("Failed to refresh layer management data:", err);
        } finally {
            setIsLayerManagementLoading(false);
        }
    };

    const handleUpdateLayerMetadata = async (fullLayerName, changes) => {
        let successCount = 0;
        for (const [rowId, props] of Object.entries(changes)) {
            const feature = layerManagementData.find(f =>
                (f.properties?.LayerId?.toString() === rowId.toString()) ||
                (f.id === rowId) ||
                (f.properties?.id?.toString() === rowId.toString())
            );

            const targetId = feature ? feature.id : rowId;
            const ok = await updateFeature(fullLayerName, targetId, props);
            if (ok) successCount++;
        }
        if (successCount > 0) handleRefreshLayerManagement();
        return successCount > 0;
    };

    const handleSaveNewLayerMetadata = async (fullLayerName, props) => {
        const success = await addNewLayerConfig(props);
        if (success) handleRefreshLayerManagement();
        return success;
    };

    const handleDeleteLayerMetadata = async (fullLayerName, feature) => {
        const success = await deleteFeature(fullLayerName, feature);
        if (success) handleRefreshLayerManagement();
        return success;
    };

    const handleOpenLayerManagement = () => {
        setShowLayerManagement(true);
        handleRefreshLayerManagement();
    };

    return {
        showLayerManagement,
        setShowLayerManagement,
        layerManagementData,
        setLayerManagementData,
        isLayerManagementLoading,
        handleRefreshLayerManagement,
        handleOpenLayerManagement,
        handleUpdateLayerMetadata,
        handleSaveNewLayerMetadata,
        handleDeleteLayerMetadata
    };
};

export default LayerManagementCard;

