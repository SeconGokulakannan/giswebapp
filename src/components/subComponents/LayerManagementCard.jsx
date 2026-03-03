import React, { useState, useMemo, useEffect } from 'react';
import { fetchLayerStatuses, WORKSPACE, initializeMetadataLayer } from '../../services/Server';
import { X, LayoutGrid, Plus, Save, RefreshCw, Layers, Trash2, Check, AlertCircle, Loader2, Globe, LayersPlus, ArrowRightLeft, Server, Settings2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

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
                                    <Globe size={14} />Add Acting Layer
                                </button>
                                <button className="elite-btn primary" onClick={onOpenCreateLayer} style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <LayersPlus size={14} />Publish New Layer
                                </button>
                                <button className="elite-btn primary" onClick={onOpenDataManipulation} style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'linear-gradient(135deg, #f59e0b, #3b82f6)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ArrowRightLeft size={14} />Data Manipulation
                                </button>
                                <button className="elite-btn primary" onClick={onOpenServerInfo} style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'linear-gradient(135deg, #1e293b, #475569)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Server size={14} />Server Info
                                </button>
                                <button className="elite-btn secondary" onClick={AddNewLayerConfig} style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Plus size={14} />Add Layer Config
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

export default LayerManagementCard;
