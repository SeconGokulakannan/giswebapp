import React, { useState, useEffect } from 'react';
import { X, Plus, DatabaseZap, RefreshCw, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLayerAttributes, QueryBuilderFilter } from '../../services/Server';

const QB_OPERATORS = [
    { value: '=', label: 'Equals (=)' },
    { value: '<>', label: 'Not Equals (<>)' },
    { value: '>', label: 'Greater Than (>)' },
    { value: '<', label: 'Less Than (<)' },
    { value: '>=', label: 'Greater or Equal (>=)' },
    { value: '<=', label: 'Less or Equal (<=)' },
    { value: 'LIKE', label: 'Contains (LIKE)' },
    { value: 'ILIKE', label: 'Contains Case-Insensitive (ILIKE)' },
];

const QueryBuilderCard = ({
    isOpen,
    onClose,
    activeLayer, // The layer that was clicked to open this (if any)
    availableLayers,
    handleApplyLayerFilter,
    selectedLayerIds,
    setSelectedLayerIds
}) => {
    // State for query building
    const [qbConditions, setQbConditions] = useState([{ layerId: '', field: '', operator: '=', value: '', logic: 'AND' }]);
    const [layerAttributesMap, setLayerAttributesMap] = useState({}); // { layerId: [attr1, attr2] }
    const [isFetchingAttributes, setIsFetchingAttributes] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);


    // sync selected layers with visibility and initial active layer
    useEffect(() => {
        if (isOpen && availableLayers) {
            const visibleLayerIds = availableLayers.filter(l => l.visible).map(l => l.id);

            // If nothing is selected yet, or if we just opened, sync with visible layers
            if (selectedLayerIds.length === 0) {
                setSelectedLayerIds(visibleLayerIds);
            }

            // If opened from a specific layer, make sure it's selected
            if (activeLayer && !selectedLayerIds.includes(activeLayer.id)) {
                setSelectedLayerIds(prev => [...prev, activeLayer.id]);
            }

            // Initialize conditions if empty or if we have an active layer
            if (qbConditions.length === 1 && !qbConditions[0].layerId && (activeLayer || selectedLayerIds.length > 0 || visibleLayerIds.length > 0)) {
                const targetId = activeLayer?.id || selectedLayerIds[0] || visibleLayerIds[0];
                if (targetId) {
                    setQbConditions([{ layerId: targetId, field: '', operator: '=', value: '', logic: 'AND' }]);
                }
            }
        }
    }, [isOpen, availableLayers?.length, activeLayer?.id]);

    // Fetch attributes for all selected layers
    useEffect(() => {
        if (isOpen && selectedLayerIds.length > 0) {
            fetchAllAttributes();
        }
    }, [isOpen, selectedLayerIds.length]);

    const fetchAllAttributes = async () => {
        setIsFetchingAttributes(true);
        const newMap = { ...layerAttributesMap };
        let changed = false;

        try {
            await Promise.all(selectedLayerIds.map(async (id) => {
                if (!newMap[id]) {
                    const layer = availableLayers.find(l => l.id === id);
                    if (layer) {
                        const attrs = await getLayerAttributes(layer.fullName);
                        newMap[id] = attrs || [];
                        changed = true;
                    }
                }
            }));

            if (changed) {
                setLayerAttributesMap(newMap);

                // Update any conditions that don't have a field yet
                setQbConditions(prev => prev.map(cond => {
                    if (cond.layerId && !cond.field && newMap[cond.layerId]?.length > 0) {
                        return { ...cond, field: newMap[cond.layerId][0] };
                    }
                    return cond;
                }));
            }
        } catch (error) {
            console.error("Error fetching attributes:", error);
            toast.error("Failed to fetch some layer attributes.");
        } finally {
            setIsFetchingAttributes(false);
        }
    };

    const handleApplyFilter = () => {
        if (selectedLayerIds.length === 0) {
            toast.error("Please select at least one layer.");
            return;
        }

        // Group conditions by layer
        const layerFilters = {};
        selectedLayerIds.forEach(id => {
            const conditionsForLayer = qbConditions.filter(c => c.layerId === id);
            if (conditionsForLayer.length > 0) {
                const cql = QueryBuilderFilter(conditionsForLayer);
                if (cql) {
                    layerFilters[id] = cql;
                }
            }
        });

        // Apply filters
        let appliedCount = 0;
        Object.entries(layerFilters).forEach(([id, cql]) => {
            handleApplyLayerFilter(id, cql);
            appliedCount++;
        });

        if (appliedCount > 0) {
            toast.success(`Applied filters to ${appliedCount} layers!`);
        } else {
            toast.error("No valid conditions found.");
        }
    };

    const handleResetAll = () => {
        selectedLayerIds.forEach(id => {
            handleApplyLayerFilter(id, null);
        });

        const firstId = selectedLayerIds[0] || '';
        const firstAttr = layerAttributesMap[firstId]?.[0] || '';

        setQbConditions([{ layerId: firstId, field: firstAttr, operator: '=', value: '', logic: 'AND' }]);
        toast.success("All filters cleared!");
    };

    const addCondition = () => {
        const firstId = selectedLayerIds[0] || '';
        const firstAttr = layerAttributesMap[firstId]?.[0] || '';
        setQbConditions([...qbConditions, {
            layerId: firstId,
            field: firstAttr,
            operator: '=',
            value: '',
            logic: 'AND'
        }]);
    };

    const removeCondition = (index) => {
        if (qbConditions.length > 1) {
            setQbConditions(qbConditions.filter((_, i) => i !== index));
        } else {
            const firstId = selectedLayerIds[0] || '';
            const firstAttr = layerAttributesMap[firstId]?.[0] || '';
            setQbConditions([{ layerId: firstId, field: firstAttr, operator: '=', value: '', logic: 'AND' }]);
        }
    };

    const updateCondition = (index, updates) => {
        setQbConditions(qbConditions.map((c, i) => {
            if (i === index) {
                const newCond = { ...c, ...updates };
                // If layer changed, reset field to first attribute of new layer
                if (updates.layerId && updates.layerId !== c.layerId) {
                    newCond.field = layerAttributesMap[updates.layerId]?.[0] || '';
                }
                return newCond;
            }
            return c;
        }));
    };


    if (!isOpen) return null;

    const activeSelectedLayers = availableLayers.filter(l => selectedLayerIds.includes(l.id));

    return (
        <div className={`query-builder-card ${isMinimized ? 'minimized' : ''}`} style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            zIndex: 1000,
            width: '380px',
            background: 'rgba(var(--color-bg-primary-rgb), 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-2xl)',
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                background: 'rgba(var(--color-bg-secondary-rgb), 0.4)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        padding: '6px',
                        background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                        borderRadius: '8px',
                        color: '#fff',
                        boxShadow: '0 2px 8px rgba(var(--color-primary-rgb), 0.3)'
                    }}>
                        <DatabaseZap size={16} />
                    </div>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '0.02em' }}>QUERY BUILDER</div>
                        <div style={{ fontSize: '10px', opacity: 0.7, textTransform: 'uppercase', fontWeight: '600' }}>Multi-Layer Analysis</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                    >
                        {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                        onClick={onClose}
                        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {!isMinimized && (
                <div style={{ padding: '16px', maxHeight: '580px', overflowY: 'auto' }}>
                    {selectedLayerIds.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: 'rgba(var(--color-bg-secondary-rgb), 0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 12px'
                            }}>
                                <DatabaseZap size={24} style={{ opacity: 0.5 }} />
                            </div>
                            <p style={{ fontSize: '13px', fontWeight: '500' }}>Please select at least one layer to start building your query.</p>
                        </div>
                    ) : isFetchingAttributes ? (
                        <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: '500' }}>Fetching layer properties...</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {qbConditions.map((cond, index) => (
                                <div key={index} style={{
                                    position: 'relative',
                                    background: 'rgba(var(--color-bg-secondary-rgb), 0.2)',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--color-border)',
                                    animation: 'fadeIn 0.3s ease'
                                }}>
                                    {/* Logic Operator Toggle */}
                                    {index > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '-10px',
                                            left: '32px',
                                            background: 'var(--color-bg-primary)',
                                            padding: '2px',
                                            borderRadius: '6px',
                                            border: '1px solid var(--color-border)',
                                            display: 'flex',
                                            gap: '2px',
                                            zIndex: 2,
                                            boxShadow: 'var(--shadow-sm)'
                                        }}>
                                            {['AND', 'OR'].map(l => (
                                                <button
                                                    key={l}
                                                    onClick={() => updateCondition(index, { logic: l })}
                                                    style={{
                                                        padding: '2px 10px',
                                                        fontSize: '10px',
                                                        fontWeight: '700',
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        background: cond.logic === l ? 'var(--color-primary)' : 'transparent',
                                                        color: cond.logic === l ? '#fff' : 'var(--color-text-muted)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {l}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Target Layer</label>
                                            <select
                                                value={cond.layerId}
                                                onChange={(e) => updateCondition(index, { layerId: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    height: '34px',
                                                    background: 'var(--color-bg-primary)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '8px',
                                                    color: 'var(--color-text-primary)',
                                                    fontSize: '12px',
                                                    padding: '0 8px',
                                                    outline: 'none',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                {activeSelectedLayers.map(l => (
                                                    <option key={l.id} value={l.id}>{l.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Field</label>
                                            <select
                                                value={cond.field}
                                                onChange={(e) => updateCondition(index, { field: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    height: '34px',
                                                    background: 'var(--color-bg-primary)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '8px',
                                                    color: 'var(--color-text-primary)',
                                                    fontSize: '12px',
                                                    padding: '0 8px',
                                                    outline: 'none'
                                                }}
                                            >
                                                {(layerAttributesMap[cond.layerId] || []).map(attr => (
                                                    <option key={attr} value={attr}>{attr}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Operator</label>
                                            <select
                                                value={cond.operator}
                                                onChange={(e) => updateCondition(index, { operator: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    height: '34px',
                                                    background: 'var(--color-bg-primary)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '8px',
                                                    color: 'var(--color-text-primary)',
                                                    fontSize: '12px',
                                                    padding: '0 8px',
                                                    outline: 'none'
                                                }}
                                            >
                                                {QB_OPERATORS.map(op => (
                                                    <option key={op.value} value={op.value}>{op.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Value</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    type="text"
                                                    value={cond.value}
                                                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                                                    placeholder="Search pattern..."
                                                    style={{
                                                        flex: 1,
                                                        height: '34px',
                                                        background: 'var(--color-bg-primary)',
                                                        border: '1px solid var(--color-border)',
                                                        borderRadius: '8px',
                                                        color: 'var(--color-text-primary)',
                                                        fontSize: '12px',
                                                        padding: '0 12px',
                                                        outline: 'none'
                                                    }}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
                                                />
                                                <button
                                                    onClick={() => removeCondition(index)}
                                                    className="delete-btn-mini"
                                                    style={{
                                                        width: '34px',
                                                        height: '34px',
                                                        background: 'rgba(var(--color-danger-rgb), 0.1)',
                                                        border: '1px solid rgba(var(--color-danger-rgb), 0.2)',
                                                        borderRadius: '8px',
                                                        color: 'var(--color-danger)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={addCondition}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'rgba(var(--color-primary-rgb), 0.05)',
                                    border: '1.5px dashed var(--color-primary)',
                                    borderRadius: '10px',
                                    color: 'var(--color-primary)',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Plus size={14} /> ADD NEW CONDITION
                            </button>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button
                                    onClick={handleResetAll}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        background: 'var(--color-bg-secondary)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '10px',
                                        color: 'var(--color-text-secondary)',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <RefreshCw size={14} /> RESET
                                </button>
                                <button
                                    onClick={handleApplyFilter}
                                    style={{
                                        flex: 2,
                                        padding: '10px',
                                        background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                                        border: 'none',
                                        borderRadius: '10px',
                                        color: '#fff',
                                        fontSize: '13px',
                                        fontWeight: '700',
                                        boxShadow: '0 4px 12px rgba(var(--color-primary-rgb), 0.25)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    APPLY ALL FILTERS
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default QueryBuilderCard;
