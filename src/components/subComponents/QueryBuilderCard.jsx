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


    const activeSelectedLayers = availableLayers.filter(l => selectedLayerIds.includes(l.id));

    return (
        <div className={`query-builder-side-popup ${isOpen ? 'open' : ''} ${isMinimized ? 'is-minimized' : ''}`}>
            {/* Toggle Minimize/Expand Button */}
            <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="qb-side-close-btn"
                title={isMinimized ? "Expand Query Builder" : "Minimize Query Builder"}
                style={{
                    top: isMinimized ? '50%' : '10px',
                    transform: isMinimized ? 'translateY(-50%) scale(1.1)' : 'none',
                    right: isMinimized ? '50%' : '-15px',
                    left: isMinimized ? '50%' : 'auto',
                    margin: isMinimized ? '-18px 0 0 -18px' : '0'
                }}
            >
                {isMinimized ? <ChevronUp size={20} strokeWidth={3} /> : <ChevronDown size={20} strokeWidth={3} />}
            </button>

            {!isMinimized && (
                <div style={{ padding: '12px', height: '520px', overflowY: 'auto' }}>
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
                            <p style={{ fontSize: '13px', fontWeight: '500' }}>Please select at least one layer to start building.</p>
                        </div>
                    ) : isFetchingAttributes ? (
                        <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: '500' }}>Loading properties...</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {qbConditions.map((cond, index) => (
                                <div key={index} className="qb-condition-card">
                                    {/* Logic Operator Toggle */}
                                    {index > 0 && (
                                        <div className="qb-logic-toggle" style={{ marginBottom: '14px' }}>
                                            {['AND', 'OR'].map(l => (
                                                <button
                                                    key={l}
                                                    onClick={() => updateCondition(index, { logic: l })}
                                                    className={`qb-logic-btn ${cond.logic === l ? 'active' : ''}`}
                                                >
                                                    {l}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div>
                                            <label className="qb-label-vertical">Target Layer</label>
                                            <select
                                                value={cond.layerId}
                                                onChange={(e) => updateCondition(index, { layerId: e.target.value })}
                                                className="qb-select-premium"
                                            >
                                                {activeSelectedLayers.map(l => (
                                                    <option key={l.id} value={l.id}>{l.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="qb-label-vertical">Field</label>
                                            <select
                                                value={cond.field}
                                                onChange={(e) => updateCondition(index, { field: e.target.value })}
                                                className="qb-select-premium"
                                            >
                                                {(layerAttributesMap[cond.layerId] || []).map(attr => (
                                                    <option key={attr} value={attr}>{attr}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="qb-label-vertical">Operator</label>
                                            <select
                                                value={cond.operator}
                                                onChange={(e) => updateCondition(index, { operator: e.target.value })}
                                                className="qb-select-premium"
                                            >
                                                {QB_OPERATORS.map(op => (
                                                    <option key={op.value} value={op.value}>{op.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="qb-label-vertical">Value</label>
                                            <input
                                                type="text"
                                                value={cond.value}
                                                onChange={(e) => updateCondition(index, { value: e.target.value })}
                                                placeholder="Enter query value..."
                                                className="qb-input-premium"
                                                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => removeCondition(index)}
                                        className="qb-delete-floating"
                                        title="Remove Condition"
                                    >
                                        <X size={14} strokeWidth={3} />
                                    </button>
                                </div>
                            ))}

                            <button
                                onClick={addCondition}
                                className="qb-add-btn-minimal"
                                style={{ margin: '4px 0 12px' }}
                            >
                                <Plus size={16} strokeWidth={3} /> ADD NEW CONDITION
                            </button>

                            <div style={{ textAlign: 'end', flexDirection: 'column', gap: '8px' }}>
                                <button
                                    onClick={handleApplyFilter}
                                    className="qb-action-apply"
                                    style={{ height: '35px', padding: '6px', color: '#fff', width: 'auto' }}
                                >
                                    Apply Filters
                                </button>
                                <button
                                    onClick={handleResetAll}
                                    className="qb-action-reset"
                                    style={{ height: '35px', width: 'auto', padding: '6px' }}
                                >
                                    <RefreshCw size={14} style={{ marginRight: '8px' }} /> RESET
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
