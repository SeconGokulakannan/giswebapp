import React, { useState, useMemo, useEffect } from 'react';
import { fetchLayerStatuses } from '../../services/Server';
import { X, LayoutGrid, Plus, Eraser, Save, RefreshCw, Layers, Upload, Trash2, Check, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const LayerManagementCard = ({
    isOpen,
    onClose,
    data,
    isLoading,
    onDeleteFeature,
    onUpdateFeatures,
    onSaveNewFeature,
    onRefresh,
    onOpenLoadTempModal
}) => {
    // Import the new service function at the top of the file, but since I can only replace chunks, I'll assumme the import is handled or I'll add it here if possible. 
    // Wait, I cannot add imports easily with multi_replace if they are at the top. 
    // I will use a separate replace for the import or just use the existing import if I can find it.
    // Actually, I should probably check if `fetchAllPublishedLayers` is exported from `Server.js` (Yes it is).
    // I need to add it to the import statement.

    const [layerStatuses, setLayerStatuses] = useState({});
    const [pendingChanges, setPendingChanges] = useState({});
    const [newRows, setNewRows] = useState({});
    const [selectedIds, setSelectedIds] = useState([]);

    // Clear local state when new data is received (to sync with server)
    useEffect(() => {
        setPendingChanges({});
        setNewRows({});
        setSelectedIds([]);

        const loadLayers = async () => {
            const statusMap = await fetchLayerStatuses();
            setLayerStatuses(statusMap || {});
        };
        loadLayers();
    }, [data]);

    // Handle internal refresh that clears stale local edits
    const handleInternalRefresh = () => {
        setPendingChanges({});
        setNewRows({});
        setSelectedIds([]);
        if (onRefresh) onRefresh();
    };

    // Dynamically detect attribute keys from the data source
    const attributeKeys = useMemo(() => {
        if (!data || data.length === 0) {
            // Fallback to standard keys if no data is loaded yet
            return ['LayerName', 'LayerSequenceNo', 'IsShowLayer', 'LayerVisibilityOnLoad', 'GeometryType', 'GeometryFieldName', 'AttributeTableName', 'AttributeTableSchema', 'SRId', 'GeoServerStatus'];
        }
        // Use properties of the first feature as the schema + Status
        return [...Object.keys(data[0].properties), 'GeoServerStatus'];
    }, [data]);

    const allConfigs = useMemo(() => {
        const rows = (data || []).map(f => {
            // Prioritize LayerId as the primary identifier
            const id = f.properties?.LayerId || f.id || f.properties?.id || f.properties?.fid;
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

    const handleUpdateField = (id, field, value, isNew = false) => {
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

    const handleSave = async () => {
        let successCount = 0;
        const layerFullName = 'gisweb:Layer';

        // 1. Handle New Rows
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
                } else {
                    failureCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`Created ${successCount} new layer configuration(s).`);
            }
            if (failureCount > 0) {
                toast.error(`Failed to create ${failureCount} configuration(s). Check console for details.`);
            }
        }

        // 2. Handle Updates
        const updateIds = Object.keys(pendingChanges);
        if (updateIds.length > 0) {
            const success = await onUpdateFeatures(layerFullName, pendingChanges);
            if (success) {
                toast.success("Updated layer configurations.");
                setPendingChanges({});
            }
        }

        if (onRefresh) onRefresh();
    };

    const handleAddRow = () => {
        const newId = `new-${Date.now()}`;
        // Initialize new row with all detected keys
        const initialRow = {};
        attributeKeys.forEach(key => {
            // Pick sensible defaults based on key name or data types
            if (key.includes('Visibility') || key.includes('Show') || key.startsWith('Is')) {
                initialRow[key] = key === 'IsShowLayer'; // Default IsShowLayer to true, others false
            } else if (key.includes('Sequence') || key.includes('SRId')) {
                initialRow[key] = key === 'SRId' ? 4326 : 0;
            } else if (key === 'GeometryType') {
                initialRow[key] = 'Point';
            } else if (key === 'AttributeTableSchema') {
                initialRow[key] = 'public';
            } else {
                initialRow[key] = '';
            }
        });

        setNewRows(prev => ({
            ...prev,
            [newId]: initialRow
        }));
    };

    const handleDelete = async () => {
        if (selectedIds.length === 0) return;
        const layerFullName = 'gisweb:Layer';
        if (window.confirm(`Delete ${selectedIds.length} configuration(s)?`)) {
            for (const id of selectedIds) {
                const config = allConfigs.find(c => c.id == id);
                if (config && config.feature) {
                    await onDeleteFeature(layerFullName, config.feature);
                }
            }
            setSelectedIds([]);
            if (onRefresh) onRefresh();
        }
    };

    const toggleSelection = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    if (!isOpen) return null;

    // Calculate grid template based on number of keys
    // Fixed columns: Selection (40px) + Dynamic Keys + Status (40px)
    // Using minmax(130px, 1fr) to ensure headers aren't cut off
    const gridTemplate = `40px repeat(${attributeKeys.length}, minmax(130px, 1fr)) 40px`;

    return (
        <div className="layer-management-overlay" onClick={onClose}>
            <div className="elite-modal layer-management-card" onClick={e => e.stopPropagation()} style={{
                width: 'min(1600px, 98vw)',
                height: '85vh',
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideUp 0.3s ease-out'
            }}>
                {/* Header */}
                <div className="elite-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                        }}>
                            <LayoutGrid size={20} color="white" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Layer Management</h3>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Dynamic configuration portal</p>
                        </div>
                    </div>
                    <button className="elite-modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                <div style={{
                    padding: '12px 20px',
                    background: 'var(--color-bg-secondary)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="elite-btn primary" onClick={onOpenLoadTempModal} style={{ padding: '6px 14px', fontSize: '0.8rem', gap: '6px' }}>
                            <Upload size={14} />&nbsp;
                            Add Acting Layer
                        </button>
                        <button className="elite-btn secondary" onClick={handleAddRow} style={{ padding: '6px 14px', fontSize: '0.8rem', gap: '6px' }}>
                            <Plus size={14} />&nbsp;
                            Add Configuration
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {selectedIds.length > 0 && (
                            <button className="elite-btn danger" onClick={handleDelete} style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <Trash2 size={14} />
                                <span>Delete ({selectedIds.length})</span>
                            </button>
                        )}
                        <button className="action-icon-btn" onClick={handleInternalRefresh} title="Refresh Data">
                            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Grid Container with Horizontal Scroll Support */}
                <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

                    {/* Dynamic Header Row */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: gridTemplate,
                        gap: '12px',
                        padding: '10px 20px',
                        background: 'var(--color-bg-secondary)',
                        borderBottom: '1px solid var(--color-border)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        minWidth: 'fit-content'
                    }}>
                        <div /> {/* Selection */}
                        {attributeKeys.map(key => (
                            <div key={key} className="row-label">{key}</div>
                        ))}
                        <div /> {/* Status */}
                    </div>

                    {/* Data Rows */}
                    <div className="elite-modal-content" style={{
                        flex: 1,
                        padding: '0',
                        background: 'rgba(var(--color-bg-primary-rgb), 0.3)',
                        minWidth: 'fit-content'
                    }}>
                        {isLoading && allConfigs.length === 0 ? (
                            <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                                <Loader2 size={32} className="animate-spin" style={{ marginBottom: '12px', color: 'var(--color-primary)' }} />
                                <span style={{ fontSize: '0.9rem' }}>Fetching features...</span>
                            </div>
                        ) : allConfigs.length === 0 ? (
                            <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                                <Layers size={48} style={{ marginBottom: '16px' }} />
                                <span>No configurations found.</span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {allConfigs.map((config) => (
                                    <div key={config.id} className={`config-row ${config.isDirty ? 'dirty' : ''} ${config.isNew ? 'new' : ''}`} style={{
                                        display: 'grid',
                                        gridTemplateColumns: gridTemplate,
                                        gap: '12px',
                                        padding: '8px 20px',
                                        alignItems: 'center',
                                        borderBottom: '1px solid var(--color-border)',
                                        transition: 'background 0.2s',
                                        minHeight: '40px'
                                    }}>
                                        {/* Selection */}
                                        <div
                                            onClick={() => toggleSelection(config.id)}
                                            style={{
                                                width: '20px', height: '20px', borderRadius: '4px',
                                                border: `2px solid ${selectedIds.includes(config.id) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                                background: selectedIds.includes(config.id) ? 'var(--color-primary)' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer'
                                            }}>
                                            {selectedIds.includes(config.id) && <Check size={14} color="white" />}
                                        </div>

                                        {/* Dynamic Attributes Inputs */}
                                        {attributeKeys.map(key => {
                                            const value = config.current[key];
                                            const isBoolean = typeof value === 'boolean';
                                            const isReadOnly = (key.toLowerCase().includes('id') || key.toLowerCase().includes('fid')) && key.toLowerCase() !== 'srid';

                                            if (isBoolean) {
                                                return (
                                                    <div key={key} style={{ display: 'flex', justifyContent: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!!value}
                                                            onChange={(e) => handleUpdateField(config.id, key, e.target.checked, config.isNew)}
                                                            className="row-checkbox"
                                                        />
                                                    </div>
                                                );
                                            }



                                            if (key === 'GeoServerStatus') {
                                                const layerName = config.current['LayerName'];

                                                // Check for exact match or workspace-stripped match in the status map
                                                let status = layerStatuses[layerName];
                                                if (!status) {
                                                    // Try finding key by matching suffix
                                                    const matchingKey = Object.keys(layerStatuses).find(k => k === layerName || k.split(':').pop() === layerName || layerName.split(':').pop() === k);
                                                    status = matchingKey ? layerStatuses[matchingKey] : 'Layer Pending';
                                                }

                                                let bgColor, textColor, borderColor;
                                                if (status === 'Valid Layer') {
                                                    bgColor = 'rgba(16, 185, 129, 0.1)';
                                                    textColor = '#10b981';
                                                    borderColor = 'rgba(16, 185, 129, 0.2)';
                                                } else if (status === 'Layer Error') {
                                                    bgColor = 'rgba(239, 68, 68, 0.1)';
                                                    textColor = '#ef4444';
                                                    borderColor = 'rgba(239, 68, 68, 0.2)';
                                                } else { // Pending
                                                    bgColor = 'rgba(245, 158, 11, 0.1)';
                                                    textColor = '#f59e0b';
                                                    borderColor = 'rgba(245, 158, 11, 0.2)';
                                                }

                                                return (
                                                    <div key={key} style={{
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        height: '100%',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600
                                                    }}>
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '12px',
                                                            background: bgColor,
                                                            color: textColor,
                                                            border: `1px solid ${borderColor}`
                                                        }}>
                                                            {status}
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <input
                                                    key={key}
                                                    type={typeof value === 'number' ? 'number' : 'text'}
                                                    className={`row-input ${isReadOnly ? 'readonly' : ''}`}
                                                    value={value ?? ''}
                                                    readOnly={isReadOnly}
                                                    onChange={(e) => {
                                                        if (isReadOnly) return;
                                                        const val = e.target.type === 'number' ? (parseInt(e.target.value) || 0) : e.target.value;
                                                        handleUpdateField(config.id, key, val, config.isNew);
                                                    }}
                                                    placeholder={isReadOnly ? '-' : key}
                                                    title={isReadOnly ? "Read-only identity field" : ""}
                                                />
                                            );
                                        })}

                                        {/* Status */}
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            {config.isDirty && <AlertCircle size={16} color="var(--color-primary)" title="Unsaved changes" />}
                                            {config.isNew && <Plus size={16} color="#10b981" title="New unsaved row" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="elite-modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {allConfigs.length} Layer{allConfigs.length !== 1 ? 's' : ''} detected
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="elite-btn secondary" onClick={onClose}>Close</button>
                        {(Object.keys(pendingChanges).length > 0 || Object.keys(newRows).length > 0) && (
                            <>
                                <button className="elite-btn secondary" onClick={() => { setPendingChanges({}); setNewRows({}); }}>Discard</button>
                                <button className="elite-btn primary" onClick={handleSave}>Apply Changes</button>
                            </>
                        )}
                    </div>
                </div>

                <style>{`
                    .row-label {
                        font-size: 0.65rem;
                        font-weight: 800;
                        color: var(--color-text-muted);
                        letter-spacing: 0.5px;
                        white-space: nowrap;
                        text-align: center;
                        overflow: visible;
                    }
                    .config-row:hover {
                        background: rgba(var(--color-primary-rgb), 0.03);
                    }
                    .row-input {
                        width: 100%;
                        background: var(--color-bg-secondary);
                        border: 1px solid var(--color-border);
                        border-radius: 4px;
                        padding: 4px 8px;
                        font-size: 0.8rem;
                        color: var(--color-text);
                        outline: none;
                        transition: all 0.2s;
                        text-align: center;
                    }
                    .row-input:focus {
                        border-color: var(--color-primary);
                        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
                    }
                    .row-input.readonly {
                        background: rgba(var(--color-text-muted-rgb), 0.05);
                        border-color: transparent;
                        color: var(--color-text-muted);
                        cursor: not-allowed;
                        pointer-events: none;
                        font-style: italic;
                    }
                    .row-checkbox {
                        width: 18px;
                        height: 18px;
                        cursor: pointer;
                        accent-color: var(--color-primary);
                    }
                    .config-row.dirty {
                        border-left: 3px solid var(--color-primary);
                    }
                    .config-row.new {
                        border-left: 3px solid #10b981;
                    }
                `}</style>
            </div>
        </div>
    );
};

export default LayerManagementCard;
