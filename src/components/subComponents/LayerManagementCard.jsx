import React, { useState, useMemo, useEffect } from 'react';
import { fetchLayerStatuses } from '../../services/Server';
import { X, LayoutGrid, Plus, Save, RefreshCw, Layers, Trash2, Check, AlertCircle, Loader2, Globe, LayersPlus, ArrowRightLeft, Server } from 'lucide-react';
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
    onOpenLoadTempModal,
    onOpenCreateLayer,
    onOpenDataManipulation,
    onOpenServerInfo
}) => {
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
            return ['LayerId', 'LayerName', 'LayerSequenceNo', 'IsShowLayer', 'LayerVisibilityOnLoad', 'GeometryType', 'GeometryFieldName', 'AttributeTableName', 'AttributeTableSchema', 'SRId', 'GeoServerStatus'];
        }
        return [...Object.keys(data[0].properties), 'GeoServerStatus'];
    }, [data]);

    const allConfigs = useMemo(() => {
        const rows = (data || []).map(f => {
            const id = f.properties?.LayerId || f.id || f.properties?.id;
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

    const handleAddRow = () => {
        const newId = `new-${Date.now()}`;
        const initialRow = {};
        attributeKeys.forEach(key => {
            if (key === 'IsShowLayer') initialRow[key] = true;
            else if (key === 'SRId') initialRow[key] = 4326;
            else if (key === 'GeometryType') initialRow[key] = 'Point';
            else initialRow[key] = '';
        });

        setNewRows(prev => ({ ...prev, [newId]: initialRow }));
    };

    const handleDelete = async () => {
        if (selectedIds.length === 0) return;
        const layerFullName = 'gisweb:Layer';
        if (window.confirm(`Delete ${selectedIds.length} items?`)) {
            for (const id of selectedIds) {
                const config = allConfigs.find(c => c.id == id);
                if (config && config.feature) await onDeleteFeature(layerFullName, config.feature);
            }
            setSelectedIds([]);
            if (onRefresh) onRefresh();
        }
    };

    const toggleSelection = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    if (!isOpen) return null;

    const gridTemplate = `40px repeat(${attributeKeys.length}, minmax(130px, 1fr)) 40px`;

    return (
        <div className="layer-management-overlay" onClick={onClose}>
            <div className="elite-modal layer-management-card" onClick={e => e.stopPropagation()} style={{
                width: 'min(1600px, 98vw)', height: '85vh', display: 'flex', flexDirection: 'column'
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

                <div style={{ padding: '12px 20px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="elite-btn primary" onClick={onOpenLoadTempModal} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                            <Globe size={14} />&nbsp;Add Acting Layer
                        </button>
                        <button className="elite-btn primary" onClick={onOpenCreateLayer} style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
                            <LayersPlus size={14} />&nbsp;Publish New Layer
                        </button>
                        <button className="elite-btn primary" onClick={onOpenDataManipulation} style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'linear-gradient(135deg, #f59e0b, #3b82f6)' }}>
                            <ArrowRightLeft size={14} />&nbsp;Data Manipulation
                        </button>
                        <button className="elite-btn primary" onClick={onOpenServerInfo} style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'linear-gradient(135deg, #1e293b, #475569)' }}>
                            <Server size={14} />&nbsp;Server Info
                        </button>
                        <button className="elite-btn secondary" onClick={handleAddRow} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                            <Plus size={14} />&nbsp;Add Layer Config
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {selectedIds.length > 0 && (
                            <button className="elite-btn danger" onClick={handleDelete} style={{ padding: '6px 12px' }}>
                                <Trash2 size={14} />&nbsp;Delete ({selectedIds.length})
                            </button>
                        )}
                        <button className="action-icon-btn" onClick={handleInternalRefresh}><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /></button>
                    </div>
                </div>

                <div style={{ flex: 1, overflow: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: '12px', padding: '10px 20px', background: 'var(--color-bg-secondary)', position: 'sticky', top: 0, zIndex: 10, minWidth: 'fit-content' }}>
                        <div />
                        {attributeKeys.map(key => <div key={key} style={{ fontSize: '0.65rem', fontWeight: 800, textAlign: 'center' }}>{key}</div>)}
                        <div />
                    </div>

                    <div style={{ minWidth: 'fit-content' }}>
                        {allConfigs.map((config) => (
                            <div key={config.id} style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: '12px', padding: '8px 20px', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
                                <div onClick={() => toggleSelection(config.id)} style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${selectedIds.includes(config.id) ? 'var(--color-primary)' : 'var(--color-border)'}`, background: selectedIds.includes(config.id) ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    {selectedIds.includes(config.id) && <Check size={14} color="white" />}
                                </div>
                                {attributeKeys.map(key => {
                                    const value = config.current[key];
                                    if (key === 'GeoServerStatus') {
                                        const status = layerStatuses[config.current['LayerName']] || 'Un-Available';
                                        return <div key={key} style={{ textAlign: 'center' }}><span style={{ padding: '2px 8px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontSize: '0.75rem' }}>{status}</span></div>;
                                    }
                                    if (typeof value === 'boolean') return <div key={key} style={{ display: 'flex', justifyContent: 'center' }}><input type="checkbox" checked={!!value} onChange={(e) => handleUpdateField(config.id, key, e.target.checked, config.isNew)} /></div>;
                                    return <input key={key} className="row-input" value={value ?? ''} onChange={(e) => handleUpdateField(config.id, key, e.target.value, config.isNew)} style={{ width: '100%', padding: '4px', textAlign: 'center' }} />;
                                })}
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    {config.isDirty && <AlertCircle size={16} color="var(--color-primary)" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="elite-modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem' }}>{allConfigs.length} Layers</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="elite-btn secondary" onClick={onClose}>Close</button>
                        {(Object.keys(pendingChanges).length > 0 || Object.keys(newRows).length > 0) && <button className="elite-btn primary" onClick={handleSave}>Apply Changes</button>}
                    </div>
                </div>
            </div>
            <style>{`
                .row-input { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 4px; outline: none; }
                .row-input:focus { border-color: var(--color-primary); }
            `}</style>
        </div>
    );
};

export default LayerManagementCard;
