import React, { useState, useRef, useMemo, useEffect } from 'react';
import { X, Upload, File, Database, Layers, Loader2, Info, CheckCircle2, ChevronRight, Settings2, ArrowRightLeft, Plus, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { parseShp, parseDbf, combine } from 'shpjs';
import { getLayerAttributes } from '../../services/Server';
import { batchInsertFeatures, batchUpdateFeaturesByProperty } from '../../services/Server';

const DataManipulationCard = ({ isOpen, onClose, geoServerLayers }) => {
    const [activeStep, setActiveStep] = useState(1); // 1: Upload & Select, 2: Map Attributes, 3: Finalize
    const [operation, setOperation] = useState('addon'); // 'addon' or 'update'
    const [targetLayerId, setTargetLayerId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Upload State
    const [uploadFiles, setUploadFiles] = useState({ shp: null, dbf: null, shx: null, prj: null });
    const [sourceData, setSourceData] = useState(null);
    const [sourceAttributes, setSourceAttributes] = useState([]);
    const [destAttributes, setDestAttributes] = useState([]);

    // Mapping State
    const [mapping, setMapping] = useState({}); // { destAttr: sourceAttr }
    const [matchingConditions, setMatchingConditions] = useState([{ dest: '', src: '' }]); // For 'update' operation
    const [targetGeometryName, setTargetGeometryName] = useState('geom');
    const [targetGeometryType, setTargetGeometryType] = useState('Unknown');

    const fileInputRef = useRef(null);

    const targetLayer = useMemo(() =>
        geoServerLayers.find(l => l.id === targetLayerId),
        [targetLayerId, geoServerLayers]);

    // Reset when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setActiveStep(1);
            setUploadFiles({ shp: null, dbf: null, shx: null, prj: null });
            setSourceData(null);
            setSourceAttributes([]);
            setDestAttributes([]);
            setMapping({});
            setMatchingConditions([{ dest: '', src: '' }]);
            setTargetGeometryName('geom');
            setTargetGeometryType('Unknown');
        }
    }, [isOpen]);

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
                    const attrs = Object.keys(firstFeature.properties);
                    setSourceAttributes(attrs);
                    setSourceData(geojson);
                    toast.success(`Shapefile parsed: ${geojson.features.length} features found.`);
                }
            } catch (err) {
                console.error("Shapefile parsing error:", err);
                toast.error("Failed to parse shapefile.");
            }
        }
    };

    const handleNextStep = async () => {
        if (activeStep === 1) {
            if (!sourceData) return toast.error("Please upload a shapefile first.");
            if (!targetLayerId) return toast.error("Please select a target layer.");

            // Load destination attributes
            setIsProcessing(true);
            try {
                // Fetch detailed attributes to distinguish geometry column
                const detailedAttrs = await getLayerAttributes(targetLayer.fullName, true);

                // Identify the geometry column name (usually 'geom' or 'the_geom')
                const geomAttr = detailedAttrs.find(a => a.isGeometry);
                const actualGeomName = geomAttr ? geomAttr.name : 'geom';
                const actualGeomType = geomAttr ? geomAttr.geometryType : 'Unknown';

                // Filter out the geometry column from the mapping list to avoid confusion/conflicts
                const regularAttrs = detailedAttrs
                    .filter(a => !a.isGeometry)
                    .map(a => a.name);

                setDestAttributes(regularAttrs);
                setTargetGeometryName(actualGeomName);
                setTargetGeometryType(actualGeomType);

                // Auto-map based on exact name match
                const initialMapping = {};
                regularAttrs.forEach(dest => {
                    const match = sourceAttributes.find(src => src.toLowerCase() === dest.toLowerCase());
                    if (match) initialMapping[dest] = match;
                });
                setMapping(initialMapping);
                setActiveStep(2);
            } catch (err) {
                console.error("Mapping error:", err);
                toast.error("Failed to load target layer attributes.");
            } finally {
                setIsProcessing(false);
            }
        } else if (activeStep === 2) {
            if (operation === 'update') {
                const validConditions = matchingConditions.filter(c => c.dest && c.src);
                if (validConditions.length === 0) {
                    return toast.error("Please add at least one valid matching condition for the update operation.");
                }
            }
            if (Object.keys(mapping).length === 0) {
                return toast.error("Please map at least one attribute.");
            }
            setActiveStep(3);
        }
    };

    const handleExecute = async () => {
        setIsProcessing(true);
        try {
            await handleDataManipulation({
                operation,
                targetLayer,
                sourceData,
                mapping,
                matchingConditions: matchingConditions.filter(c => c.dest && c.src)
            });
            onClose();
        } catch (err) {
            toast.error(`Operation failed: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    const fileCount = Object.values(uploadFiles).filter(Boolean).length;

    //#region Data Manipulation
    const handleDataManipulation = async (config) => {
        const { operation, targetLayer, sourceData, mapping, matchingConditions } = config;
        const fullLayerName = targetLayer.fullName;

        try {
            const toastId = 'manipulate-toast';
            toast.loading(`Preparing ${operation === 'addon' ? 'Addon' : 'Update'} for ${sourceData.features.length} features...`, { id: toastId });

            const mappedFeatures = sourceData.features.map(f => {
                const newProps = {};

                // 1. Add Mapped Properties
                Object.entries(mapping).forEach(([destKey, srcKey]) => {
                    if (srcKey) {
                        newProps[destKey] = f.properties[srcKey];
                    }
                });

                // 2. Ensure Matching Keys are present in properties
                if (operation === 'update' && matchingConditions) {
                    matchingConditions.forEach(cond => {
                        // Even if not explicitly mapped for update, we need the value for the filter
                        newProps[cond.src] = f.properties[cond.src];
                    });
                }

                return {
                    ...f,
                    properties: newProps
                };
            });

            const onProgress = (current, total, batchSize) => {
                toast.loading(`Processing ${operation === 'addon' ? 'Addon' : 'Update'}: Chunk ${current} of ${total} (${batchSize} features)...`, { id: toastId });
            };

            let success = false;
            if (operation === 'addon') {
                success = await batchInsertFeatures(fullLayerName, mappedFeatures, targetGeometryName, '4326', targetGeometryType, onProgress);
            } else {
                success = await batchUpdateFeaturesByProperty(fullLayerName, mappedFeatures, matchingConditions, onProgress);
            }

            if (success) {
                toast.success(`${operation === 'addon' ? 'Data Addon' : 'Data Update'} completed successfully!`, { id: toastId });
                return true;
            } else {
                toast.error("Operation failed. Some batches may have failed. Check server logs.", { id: toastId });
                return false;
            }
        } catch (err) {
            console.error("Manual manipulation error:", err);
            toast.error(`Fatal error: ${err.message}`, { id: 'manipulate-toast' });
            return false;
        }
    };
    //#endregion

    return (
        <div className="elite-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            <div className="elite-modal" onClick={e => e.stopPropagation()} style={{
                width: '580px',
                maxHeight: '90vh',
                animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Header */}
                <div className="elite-modal-header" style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(245, 158, 11, 0.05))',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '14px 20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #f59e0b, #3b82f6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)'
                        }}>
                            <ArrowRightLeft size={16} color="white" />
                        </div>
                        <div>
                            <div className="elite-modal-title" style={{ fontSize: '0.95rem' }}>Data Manipulation</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                                bulk addon or update from shapefile
                            </div>
                        </div>
                    </div>
                    <button className="elite-modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                    {[1, 2, 3].map(step => (
                        <div key={step} style={{
                            flex: 1,
                            padding: '10px 0',
                            textAlign: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: activeStep >= step ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            borderBottom: `2px solid ${activeStep === step ? 'var(--color-primary)' : 'transparent'}`,
                            opacity: activeStep >= step ? 1 : 0.5,
                            transition: 'all 0.3s'
                        }}>
                            {step === 1 ? '1. Upload & Target' : step === 2 ? '2. Map Attributes' : '3. Confirm'}
                        </div>
                    ))}
                </div>

                {/* Body */}
                <div className="elite-modal-content" style={{ padding: '20px', overflowY: 'auto' }}>

                    {activeStep === 1 && (
                        <div className="space-y-4">
                            {/* Upload Section */}
                            <div style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: '12px',
                                background: 'var(--color-bg-secondary)',
                                padding: '16px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                    <Upload size={14} style={{ color: '#f59e0b' }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Source Shapefile</span>
                                </div>

                                <div
                                    onClick={() => !isProcessing && fileInputRef.current.click()}
                                    style={{
                                        border: `1.5px dashed ${fileCount > 0 ? '#10b981' : 'var(--color-border)'}`,
                                        borderRadius: '8px', padding: '24px', textAlign: 'center', cursor: 'pointer',
                                        background: fileCount > 0 ? 'rgba(16, 185, 129, 0.02)' : 'transparent'
                                    }}
                                >
                                    {fileCount > 0 ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                                            {Object.entries(uploadFiles).map(([ext, file]) => file && (
                                                <div key={ext} style={{
                                                    backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
                                                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600
                                                }}>
                                                    .{ext}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div>
                                            <Upload size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                            <p style={{ fontSize: '0.8rem', margin: 0 }}>Drop .shp, .dbf, .prj, .shx files here</p>
                                        </div>
                                    )}
                                    <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                                </div>
                            </div>

                            {/* Target Selection */}
                            <div style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: '12px',
                                background: 'var(--color-bg-secondary)',
                                padding: '16px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                    <Database size={14} style={{ color: '#3b82f6' }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Destination Layer</span>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>Target GIS Layer</label>
                                        <select
                                            className="elite-input"
                                            value={targetLayerId}
                                            onChange={(e) => setTargetLayerId(e.target.value)}
                                            style={{ width: '100%', boxSizing: 'border-box' }}
                                        >
                                            <option value="">Select a layer...</option>
                                            {geoServerLayers.map(l => (
                                                <option key={l.id} value={l.id}>{l.name} ({l.fullName.split(':')[0]})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>Operation Type</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button
                                                onClick={() => setOperation('addon')}
                                                style={{
                                                    flex: 1, padding: '10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500,
                                                    border: `1.5px solid ${operation === 'addon' ? '#10b981' : 'var(--color-border)'}`,
                                                    background: operation === 'addon' ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                                                    color: operation === 'addon' ? '#10b981' : 'var(--color-text-muted)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Plus size={14} style={{ marginBottom: '4px' }} /><br />
                                                Data Addon
                                            </button>
                                            <button
                                                onClick={() => setOperation('update')}
                                                style={{
                                                    flex: 1, padding: '10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500,
                                                    border: `1.5px solid ${operation === 'update' ? '#3b82f6' : 'var(--color-border)'}`,
                                                    background: operation === 'update' ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                                                    color: operation === 'update' ? '#3b82f6' : 'var(--color-text-muted)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Save size={14} style={{ marginBottom: '4px' }} /><br />
                                                Update Data
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeStep === 2 && (
                        <div className="space-y-4">
                            {operation === 'update' && (
                                <div style={{
                                    border: '1.5px solid rgba(59, 130, 246, 0.3)',
                                    borderRadius: '12px', background: 'rgba(59, 130, 246, 0.03)', padding: '16px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <Settings2 size={14} style={{ color: '#3b82f6' }} />
                                        <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>Update Key (Matching conditions)</span>
                                    </div>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                                        Identify records to update using one or more matching fields (AND logic).
                                    </p>

                                    <div className="space-y-2">
                                        {matchingConditions.map((cond, idx) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <select
                                                        className="elite-input"
                                                        value={cond.dest}
                                                        onChange={(e) => {
                                                            const newConds = [...matchingConditions];
                                                            newConds[idx].dest = e.target.value;
                                                            setMatchingConditions(newConds);
                                                        }}
                                                        style={{ width: '100%', fontSize: '0.75rem', padding: '6px' }}
                                                    >
                                                        <option value="">PostGIS Field...</option>
                                                        {destAttributes.map(attr => (
                                                            <option key={attr} value={attr}>{attr}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <ChevronRight size={12} style={{ opacity: 0.3 }} />
                                                <div style={{ flex: 1 }}>
                                                    <select
                                                        className="elite-input"
                                                        value={cond.src}
                                                        onChange={(e) => {
                                                            const newConds = [...matchingConditions];
                                                            newConds[idx].src = e.target.value;
                                                            setMatchingConditions(newConds);
                                                        }}
                                                        style={{ width: '100%', fontSize: '0.75rem', padding: '6px' }}
                                                    >
                                                        <option value="">Shapefile Field...</option>
                                                        {sourceAttributes.map(attr => (
                                                            <option key={attr} value={attr}>{attr}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {matchingConditions.length > 1 && (
                                                    <button
                                                        onClick={() => setMatchingConditions(matchingConditions.filter((_, i) => i !== idx))}
                                                        style={{
                                                            padding: '4px', borderRadius: '4px', border: 'none',
                                                            background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer'
                                                        }}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => setMatchingConditions([...matchingConditions, { dest: '', src: '' }])}
                                        style={{
                                            marginTop: '12px', width: '100%', padding: '6px', borderRadius: '6px',
                                            border: '1px dashed #3b82f6', background: 'transparent', color: '#3b82f6',
                                            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', gap: '6px'
                                        }}
                                    >
                                        <Plus size={12} /> Add Matching Condition
                                    </button>
                                </div>
                            )}

                            <div style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: '12px', background: 'var(--color-bg-secondary)', padding: '16px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                    <ArrowRightLeft size={14} style={{ color: 'var(--color-primary)' }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>Attribute Mapping</span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', padding: '0 10px' }}>
                                        <div style={{ flex: 1 }}>DESTINATION (LAYER)</div>
                                        <div style={{ width: '30px' }}></div>
                                        <div style={{ flex: 1 }}>SOURCE (SHAPEFILE)</div>
                                    </div>

                                    {destAttributes.map(dest => (
                                        <div key={dest} style={{
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            background: 'var(--color-bg-primary)', padding: '8px', borderRadius: '8px',
                                            border: '1px solid var(--color-border)'
                                        }}>
                                            <div style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, paddingLeft: '5px' }}>{dest}</div>
                                            <ChevronRight size={14} style={{ opacity: 0.3 }} />
                                            <div style={{ flex: 1 }}>
                                                <select
                                                    className="elite-input"
                                                    style={{ width: '100%', padding: '4px 8px', fontSize: '0.75rem' }}
                                                    value={mapping[dest] || ''}
                                                    onChange={(e) => setMapping({ ...mapping, [dest]: e.target.value })}
                                                >
                                                    <option value="">-- Ignore --</option>
                                                    {sourceAttributes.map(src => (
                                                        <option key={src} value={src}>{src}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeStep === 3 && (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
                            }}>
                                <CheckCircle2 size={32} style={{ color: '#10b981' }} />
                            </div>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>Ready to Process</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', maxWidth: '300px', margin: '0 auto 20px' }}>
                                You are about to {operation === 'addon' ? 'add new features to' : 'update existing features in'} <strong>{targetLayer?.name}</strong>.
                            </p>

                            <div style={{
                                background: 'var(--color-bg-secondary)', padding: '16px', borderRadius: '12px',
                                textAlign: 'left', border: '1px solid var(--color-border)'
                            }}>
                                <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Source Features:</span>
                                    <span style={{ fontWeight: 600 }}>{sourceData?.features.length}</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Mapped Fields:</span>
                                    <span style={{ fontWeight: 600 }}>{Object.keys(mapping).length}</span>
                                </div>
                                {operation === 'update' && (
                                    <div style={{ fontSize: '0.75rem', marginTop: '8px' }}>
                                        <div style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>Matching Conditions:</div>
                                        {matchingConditions.map((cond, idx) => (
                                            <div key={idx} style={{
                                                display: 'flex', justifyContent: 'space-between', paddingLeft: '8px',
                                                borderLeft: '2px solid #3b82f6', marginBottom: '2px'
                                            }}>
                                                <span style={{ fontSize: '0.7rem' }}>{cond.dest}</span>
                                                <span style={{ fontSize: '0.7rem', color: '#3b82f6' }}>← {cond.src}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="elite-modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)', gap: '12px' }}>
                    {activeStep > 1 && (
                        <button
                            className="elite-btn secondary"
                            onClick={() => setActiveStep(activeStep - 1)}
                            disabled={isProcessing}
                        >
                            Back
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    <button className="elite-btn secondary" onClick={onClose} disabled={isProcessing}>Cancel</button>

                    {activeStep < 3 ? (
                        <button
                            className="elite-btn primary"
                            onClick={handleNextStep}
                            disabled={isProcessing || (activeStep === 1 && (!sourceData || !targetLayerId))}
                            style={{ padding: '8px 24px' }}
                        >
                            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Continue'}
                        </button>
                    ) : (
                        <button
                            className="elite-btn primary"
                            onClick={handleExecute}
                            disabled={isProcessing}
                            style={{
                                padding: '8px 28px',
                                background: operation === 'addon' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                boxShadow: operation === 'addon' ? '0 4px 12px rgba(16, 185, 129, 0.2)' : '0 4px 12px rgba(59, 130, 246, 0.2)'
                            }}
                        >
                            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : `Execute ${operation === 'addon' ? 'Addon' : 'Update'}`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DataManipulationCard;
