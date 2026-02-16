import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, Database, Layers, Loader2, Info, Upload, File, FileType, CheckCircle2, AlertCircle, Eye, EyeOff, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { parseShp, parseDbf, combine } from 'shpjs';
import { batchInsertFeatures, publishNewLayer, WORKSPACE, reloadGeoServer } from '../../services/Server';

const CreateLayerCard = ({ isOpen, onClose, handleLayerRefresh }) => {
    const [activeTab, setActiveTab] = useState('manual'); // 'manual' or 'upload'
    const [layerName, setLayerName] = useState('');
    const [geometryType, setGeometryType] = useState('Point');
    const [isPublishing, setIsPublishing] = useState(false);
    const [attributes, setAttributes] = useState([
        { name: 'name', type: 'String' },
        { name: 'description', type: 'String' }
    ]);

    const [uploadFiles, setUploadFiles] = useState({ shp: null, dbf: null, shx: null, prj: null });
    const [parsedData, setParsedData] = useState(null);
    const fileInputRef = useRef(null);

    const resetState = () => {
        setLayerName('');
        setGeometryType('Point');
        if (activeTab === 'upload') {
            setAttributes([]);
        } else {
            setAttributes([
                { name: 'name', type: 'String' },
                { name: 'description', type: 'String' }
            ]);
        }
        setUploadFiles({ shp: null, dbf: null, shx: null, prj: null });
        setParsedData(null);
    };

    // Clear on close
    useEffect(() => {
        if (!isOpen) {
            setLayerName('');
            setGeometryType('Point');
            setAttributes([
                { name: 'name', type: 'String' },
                { name: 'description', type: 'String' }
            ]);
            setUploadFiles({ shp: null, dbf: null, shx: null, prj: null });
            setParsedData(null);
            setActiveTab('manual');
        }
    }, [isOpen]);


    // Helper function to verify layer is ready for WFS-T operations
    const verifyLayerReady = async (fullLayerName, maxAttempts = 8) => {
        console.log(`Verifying layer ${fullLayerName} is ready...`);
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch(
                    `/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${fullLayerName}&maxFeatures=1&outputFormat=application/json`,
                    { headers: { 'Authorization': 'Basic ' + btoa('admin:geoserver') } }
                );
                console.log(`Attempt ${attempt}/${maxAttempts}: Response status ${response.status}`);
                if (response.ok) {
                    const data = await response.json();
                    console.log(`✓ Layer ${fullLayerName} is ready after ${attempt} attempt(s)`);
                    return true;
                } else {
                    const errorText = await response.text();
                    console.log(`Attempt ${attempt} failed:`, errorText.substring(0, 200));
                }
            } catch (err) {
                console.log(`Layer verification attempt ${attempt}/${maxAttempts} failed:`, err.message);
            }
            // Wait 2 seconds between attempts
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        console.error(`✗ Layer ${fullLayerName} not ready after ${maxAttempts} attempts`);
        return false;
    };

    const handlePublishNewLayer = async (config) => {
        try {
            // Step 1: Create the Layer structure
            const success = await publishNewLayer(config);
            if (!success) return false;

            // Step 2: If we have data (Shapefile upload), insert features
            if (config.data && config.data.features && config.data.features.length > 0) {
                const fullLayerName = `${WORKSPACE}:${config.layerName}`;

                toast.loading(`Reloading GeoServer configuration...`, { id: 'publish-toast' });
                // Reload GeoServer to force it to recognize the new layer
                await reloadGeoServer();

                // Force WFS capabilities refresh to clear metadata cache
                try {
                    await fetch(`/geoserver/wfs?request=GetCapabilities&version=1.1.0`, {
                        headers: { 'Authorization': 'Basic ' + btoa('admin:geoserver') }
                    });
                } catch (e) { console.log("Capabilities refresh ignored"); }

                toast.loading(`Waiting for layer registration...`, { id: 'publish-toast' });
                // Wait 5 seconds after reload
                await new Promise(resolve => setTimeout(resolve, 5000));

                toast.loading(`Importing ${config.data.features.length} features...`, { id: 'publish-toast' });
                const insertSuccess = await batchInsertFeatures(fullLayerName, config.data.features, 'geom', config.srid || '4326', geometryType);

                if (insertSuccess) {
                    toast.success(`Layer published with ${config.data.features.length} features!`, { id: 'publish-toast' });
                } else {
                    toast.error("Layer created but feature import failed. Check console for details.", { id: 'publish-toast' });
                }
            }

            // Refresh layers list to show the newly published layer
            handleLayerRefresh();
            return true;
        } catch (err) {
            console.error("Publishing error in GISMap:", err);
            toast.error(`Publishing failed: ${err.message}`, { id: 'publish-toast' });
            return false;
        }
    };

    const hasData = () => {
        if (activeTab === 'manual') {
            // Check if layerName is set or attributes modified from default
            return layerName.trim() !== '' ||
                attributes.length !== 2 ||
                attributes[0].name !== 'name' ||
                attributes[1].name !== 'description';
        } else {
            // Check if any files uploaded
            return Object.values(uploadFiles).some(f => f !== null);
        }
    };

    const handleTabSwitch = (tab) => {
        if (activeTab === tab) return;
        if (hasData()) {
            toast.error(`Please discard changes in ${activeTab === 'manual' ? 'Manual' : 'Upload'} mode before switching.`, {
                id: 'tab-switch-warn'
            });
            return;
        }

        if (tab === 'upload') {
            setAttributes([]);
        } else {
            setAttributes([
                { name: 'name', type: 'String' },
                { name: 'description', type: 'String' }
            ]);
        }

        setActiveTab(tab);
    };

    const handleAddAttribute = () => {
        setAttributes([...attributes, { name: '', type: 'String' }]);
    };

    const handleRemoveAttribute = (index) => {
        setAttributes(attributes.filter((_, i) => i !== index));
    };

    const handleAttributeChange = (index, field, value) => {
        const newAttrs = [...attributes];
        newAttrs[index][field] = value;
        setAttributes(newAttrs);
    };

    const readFileAsArrayBuffer = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });

    const readFileAsText = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        const newFiles = { ...uploadFiles };

        files.forEach(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            if (['shp', 'dbf', 'shx', 'prj'].includes(ext)) {
                newFiles[ext] = file;
            }
        });

        setUploadFiles(newFiles);

        // Auto-set layer name if not already set
        if (!layerName && newFiles.shp) {
            setLayerName(newFiles.shp.name.replace(/\.shp$/i, ''));
        }

        // If we have at least SHP and PRJ (and ideally DBF), we can preview schema
        if (newFiles.shp && newFiles.prj) {
            try {
                const shpBuffer = await readFileAsArrayBuffer(newFiles.shp);
                const dbfBuffer = newFiles.dbf ? await readFileAsArrayBuffer(newFiles.dbf) : null;
                const prjText = await readFileAsText(newFiles.prj);

                const parsedShp = parseShp(shpBuffer, prjText);
                const parsedDbf = dbfBuffer ? parseDbf(dbfBuffer) : null;
                const geojson = combine([parsedShp, parsedDbf]);

                if (geojson && geojson.features && geojson.features.length > 0) {
                    const firstFeature = geojson.features[0];
                    const gType = firstFeature.geometry.type;
                    setGeometryType(gType === 'MultiPolygon' ? 'MultiPolygon' :
                        gType === 'Polygon' ? 'Polygon' :
                            gType === 'LineString' ? 'LineString' : 'Point');

                    // Deduce attributes from first feature properties
                    const props = firstFeature.properties;
                    const deducedAttrs = Object.keys(props).map(key => {
                        const val = props[key];
                        const lowKey = key.trim().toLowerCase();

                        // Check if this is a geometry column to ignore
                        const isGeom = ['geom', 'the_geom', 'geometry', 'wkb_geometry', 'shape', 'shp'].includes(lowKey);

                        let type = 'String';
                        if (typeof val === 'number') {
                            type = Number.isInteger(val) ? 'Integer' : 'Double';
                        } else if (typeof val === 'boolean') {
                            type = 'Boolean';
                        }
                        return {
                            name: key,
                            sourceName: key,
                            type: type,
                            originalType: type,
                            ignored: isGeom // Auto-ignore geometry columns
                        };
                    });
                    setAttributes(deducedAttrs);
                    setParsedData(geojson);
                    toast.success("Shapefile parsed. Schema detected.");
                }
            } catch (err) {
                console.error("Shapefile parsing error:", err);
                toast.error("Failed to parse shapefile schema.");
            }
        }
    };

    const handleFormSubmit = async (e) => {
        if (e) e.preventDefault();

        if (!layerName.trim()) {
            toast.error("Please provide a layer name.");
            return;
        }

        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(layerName)) {
            toast.error("Layer name must start with a letter and contain only letters, numbers, or underscores.");
            return;
        }

        if (activeTab === 'upload') {
            if (!uploadFiles.shp || !uploadFiles.prj) {
                toast.error("Shapefile (.shp) and Projection (.prj) files are required.");
                return;
            }
        } else {
            const emptyAttrs = attributes.some(attr => !attr.name.trim());
            if (emptyAttrs) {
                toast.error("Please provide names for all attributes.");
                return;
            }
        }

        setIsPublishing(true);
        try {
            // Filter out ignored attributes and clean up data
            const filteredAttributes = attributes.filter(attr => !attr.ignored);
            let finalData = parsedData;

            if (activeTab === 'upload' && parsedData) {
                const filteredFeatures = parsedData.features.map(f => {
                    const newProps = {};
                    filteredAttributes.forEach(attr => {
                        // Use sourceName (original key in DBF) to get the value
                        const sourceKey = attr.sourceName || attr.name;
                        // Only include if the property exists in the source data
                        if (f.properties.hasOwnProperty(sourceKey)) {
                            newProps[attr.name] = f.properties[sourceKey];
                        }
                    });
                    return { ...f, properties: newProps };
                });
                finalData = { ...parsedData, features: filteredFeatures };

                // Log for debugging
                console.log('Schema attributes:', filteredAttributes.map(a => a.name));
                console.log('Sample feature properties:', filteredFeatures[0]?.properties);
            }

            const published = await handlePublishNewLayer({
                layerName: layerName.trim(),
                geometryType,
                attributes: filteredAttributes,
                srid: '4326',
                data: activeTab === 'upload' ? finalData : null
            });

            if (published) {
                toast.success(activeTab === 'upload' ? "Layer published with data!" : "Layer created and published successfully!");
                onClose();
                resetState();
            }
        } catch (err) {
            toast.error(`Failed to publish layer: ${err.message}`);
        } finally {
            setIsPublishing(false);
        }
    };

    const fileCount = Object.values(uploadFiles).filter(Boolean).length;
    const fileExtColors = {
        shp: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
        dbf: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
        shx: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
        prj: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' }
    };

    if (!isOpen) return null;

    return (
        <div className="elite-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            <div className="elite-modal" onClick={e => e.stopPropagation()} style={{
                width: '520px',
                maxHeight: '90vh',
                animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Header */}
                <div className="elite-modal-header" style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(16, 185, 129, 0.05))',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '14px 20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #3b82f6, #10b981)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)'
                        }}>
                            <Database size={16} color="white" />
                        </div>
                        <div>
                            <div className="elite-modal-title" style={{ fontSize: '0.95rem' }}>Publish New Layer</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                                Create permanent layers via manual schema or file upload
                            </div>
                        </div>
                    </div>
                    <button className="elite-modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    padding: '0 20px',
                    borderBottom: '1px solid var(--color-border)',
                    gap: '20px'
                }}>
                    <button
                        onClick={() => handleTabSwitch('manual')}
                        style={{
                            padding: '12px 0',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            color: activeTab === 'manual' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            borderBottom: `2px solid ${activeTab === 'manual' ? 'var(--color-primary)' : 'transparent'}`,
                            background: 'none',
                            borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Manual Configuration
                    </button>
                    <button
                        onClick={() => handleTabSwitch('upload')}
                        style={{
                            padding: '12px 0',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            color: activeTab === 'upload' ? '#10b981' : 'var(--color-text-muted)',
                            borderBottom: `2px solid ${activeTab === 'upload' ? '#10b981' : 'transparent'}`,
                            background: 'none',
                            borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Upload Shapefile
                    </button>
                </div>

                {/* Body */}
                <div className="elite-modal-content" style={{
                    padding: '16px 20px',
                    overflowY: 'auto',
                    maxHeight: 'calc(90vh - 180px)'
                }}>
                    <form onSubmit={handleFormSubmit} className="space-y-4">

                        {activeTab === 'upload' && (
                            <div style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: '10px',
                                background: 'var(--color-bg-secondary)',
                                padding: '16px',
                                marginBottom: '16px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                    <Upload size={14} style={{ color: '#10b981' }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Files to Publish</span>
                                </div>

                                <div
                                    onClick={() => !isPublishing && fileInputRef.current.click()}
                                    style={{
                                        border: `1.5px dashed ${fileCount > 0 ? '#10b981' : 'var(--color-border)'}`,
                                        borderRadius: '8px',
                                        padding: '20px',
                                        textAlign: 'center',
                                        cursor: isPublishing ? 'default' : 'pointer',
                                        background: fileCount > 0 ? 'rgba(16, 185, 129, 0.02)' : 'transparent',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {fileCount > 0 ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                                            {Object.entries(uploadFiles).map(([ext, file]) => file && (
                                                <div key={ext} style={{
                                                    backgroundColor: fileExtColors[ext].bg,
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    color: fileExtColors[ext].text
                                                }}>
                                                    <File size={11} />
                                                    <span>.{ext}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div>
                                            <Upload size={24} style={{ opacity: 0.3, marginBottom: '8px', color: '#10b981' }} />
                                            <p style={{ fontSize: '0.8rem', margin: '0 0 4px', color: 'var(--color-text)' }}>
                                                Drop shapefile components here
                                            </p>
                                            <p style={{ fontSize: '0.65rem', opacity: 0.5, margin: 0 }}>
                                                Required: .shp, .prj | Optional: .dbf, .shx
                                            </p>
                                        </div>
                                    )}
                                    <input
                                        type="file" multiple accept=".shp,.dbf,.shx,.prj"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                    />
                                </div>
                                {parsedData && (
                                    <div style={{
                                        marginTop: '12px', padding: '10px', borderRadius: '8px',
                                        background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.1)',
                                        display: 'flex', alignItems: 'center', gap: '8px'
                                    }}>
                                        <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                                        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 500 }}>
                                            Detected {parsedData.features.length} features
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Common Configuration */}
                        <div style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: '10px',
                            background: 'var(--color-bg-secondary)',
                            padding: '14px',
                            marginBottom: '16px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <FileType size={14} style={{ color: activeTab === 'manual' ? 'var(--color-primary)' : '#10b981' }} />
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Layer Info</span>
                            </div>

                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Layer Name (System Name)</label>
                                <input
                                    type="text"
                                    className="elite-input"
                                    value={layerName}
                                    onChange={(e) => setLayerName(e.target.value)}
                                    placeholder="e.g. city_parks"
                                    disabled={isPublishing}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '0.65rem', color: 'var(--color-text-muted)', opacity: 0.8 }}>
                                    <Info size={10} />
                                    <span>Used for PostGIS table and GeoServer layer</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Geometry Type</label>
                                <select
                                    className="elite-input"
                                    value={geometryType}
                                    onChange={(e) => setGeometryType(e.target.value)}
                                    disabled={isPublishing || activeTab === 'upload'}
                                    style={{ width: '100%', boxSizing: 'border-box', opacity: activeTab === 'upload' ? 0.7 : 1 }}
                                >
                                    <option value="Point">Point</option>
                                    <option value="LineString">LineString</option>
                                    <option value="Polygon">Polygon</option>
                                    <option value="MultiPolygon">MultiPolygon</option>
                                </select>
                            </div>
                        </div>

                        {/* Attributes Section */}
                        <div style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: '10px',
                            background: 'var(--color-bg-secondary)',
                            padding: '14px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Layers size={14} style={{ color: activeTab === 'manual' ? 'var(--color-primary)' : '#10b981' }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
                                        {activeTab === 'upload' ? 'Detected Attributes' : 'Layer Attributes'}
                                    </span>
                                </div>
                                {activeTab === 'manual' && (
                                    <button
                                        type="button"
                                        onClick={handleAddAttribute}
                                        disabled={isPublishing}
                                        style={{
                                            border: '1px solid var(--color-border)',
                                            background: 'transparent',
                                            color: 'var(--color-text-muted)',
                                            fontSize: '0.7rem',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                        onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                                        onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                                    >
                                        <Plus size={12} /> Add Field
                                    </button>
                                )}
                            </div>

                            <div className="attributes-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {attributes.map((attr, index) => (
                                    <div key={index} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            className="elite-input"
                                            placeholder="Field Name"
                                            value={attr.name}
                                            onChange={(e) => handleAttributeChange(index, 'name', e.target.value)}
                                            disabled={isPublishing || attr.ignored}
                                            style={{
                                                flex: 1,
                                                padding: '6px 10px',
                                                fontSize: '0.8rem',
                                                opacity: attr.ignored ? 0.7 : 1,
                                                textDecoration: attr.ignored ? 'line-through' : 'none'
                                            }}
                                        />
                                        <select
                                            className="elite-input"
                                            value={attr.type}
                                            onChange={(e) => handleAttributeChange(index, 'type', e.target.value)}
                                            disabled={isPublishing || activeTab === 'upload' || attr.ignored}
                                            style={{
                                                width: '100px',
                                                padding: '6px 10px',
                                                fontSize: '0.8rem',
                                                opacity: (activeTab === 'upload' || attr.ignored) ? 0.6 : 1,
                                                textDecoration: attr.ignored ? 'line-through' : 'none',
                                                backgroundColor: attr.ignored ? 'rgba(0,0,0,0.05)' : 'white'
                                            }}
                                        >
                                            <option value="String">String</option>
                                            <option value="Double">Double</option>
                                            <option value="Integer">Integer</option>
                                            <option value="Boolean">Boolean</option>
                                        </select>

                                        {activeTab === 'upload' && (
                                            <button
                                                type="button"
                                                title={attr.ignored ? "Don't Ignore" : "Ignore Attribute"}
                                                onClick={() => handleAttributeChange(index, 'ignored', !attr.ignored)}
                                                className="action-icon-btn"
                                                style={{
                                                    padding: '6px',
                                                    color: attr.ignored ? '#ef4444' : 'var(--color-primary)',
                                                    background: attr.ignored ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                                                    border: attr.ignored ? '1px solid #ef4444' : '1px solid var(--color-border)',
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {attr.ignored ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        )}
                                        {activeTab === 'manual' && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAttribute(index)}
                                                disabled={isPublishing}
                                                style={{
                                                    border: 'none', background: 'transparent', color: 'var(--color-text-muted)',
                                                    padding: '4px', borderRadius: '4px', cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                                                onMouseOut={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {attributes.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '10px', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                        No attributes defined.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Info Note */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(16, 185, 129, 0.04))',
                            border: '1px solid rgba(59, 130, 246, 0.12)',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start',
                            marginTop: '4px'
                        }}>
                            <Info size={15} style={{ color: activeTab === 'manual' ? '#3b82f6' : '#10b981', flexShrink: 0, marginTop: '1px' }} />
                            <p style={{ margin: 0, fontSize: '0.68rem', lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
                                {activeTab === 'upload' ?
                                    "Data will be imported into PostGIS and published to GeoServer. All fields from the shapefile will be preserved." :
                                    "This creates an empty table structure. You can add data later using the map drawing tools."}
                            </p>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="elite-modal-footer" style={{
                    padding: '12px 20px', gap: '10px',
                    borderTop: '1px solid var(--color-border)'
                }}>
                    <button className="elite-btn secondary" onClick={onClose} style={{ padding: '8px 20px' }} disabled={isPublishing}>
                        Cancel
                    </button>
                    {hasData() && !isPublishing && (
                        <button
                            className="elite-btn danger"
                            onClick={resetState}
                            style={{
                                padding: '8px 16px',
                                background: 'transparent',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#ef4444'
                            }}
                        >
                            <RotateCcw size={14} />&nbsp;Discard
                        </button>
                    )}
                    <button
                        className="elite-btn primary"
                        onClick={handleFormSubmit}
                        disabled={isPublishing || (activeTab === 'upload' && !parsedData)}
                        style={{
                            padding: '8px 24px',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: activeTab === 'manual' ?
                                'linear-gradient(135deg, #3b82f6, #6366f1)' :
                                'linear-gradient(135deg, #10b981, #059669)',
                            boxShadow: activeTab === 'manual' ?
                                '0 2px 12px rgba(59, 130, 246, 0.25)' :
                                '0 2px 12px rgba(16, 185, 129, 0.25)',
                            opacity: (activeTab === 'upload' && !parsedData) ? 0.6 : 1
                        }}
                    >
                        {isPublishing ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            activeTab === 'manual' ? <Database size={15} /> : <Upload size={15} />
                        )}
                        {isPublishing ? 'Publishing...' : 'Publish Layer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateLayerCard;
