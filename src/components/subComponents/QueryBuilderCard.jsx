import React, { useState, useEffect } from 'react';
import { X, Plus, DatabaseZap, RefreshCw, Loader2, ChevronLeft, ChevronRight, Filter, Trash2, Minimize2, FileText } from 'lucide-react';
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
    { value: 'ILIKE', label: 'Case-Insensitive (ILIKE)' },
];

const QueryBuilderCard = ({
    isOpen,
    onClose,
    activeLayer,
    availableLayers,
    handleApplyLayerFilter,
    onRunQuery,
    onGenerateReport,
    onGenerateSnapshotReport,
    selectedLayerIds,
    setSelectedLayerIds,
    isParentPanelMinimized = false
}) => {
    const [qbConditions, setQbConditions] = useState([{ layerId: '', field: '', operator: '=', value: '', logic: 'AND' }]);
    const [layerAttributesMap, setLayerAttributesMap] = useState({});
    const [isFetchingAttributes, setIsFetchingAttributes] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [showReportButton, setShowReportButton] = useState(false);
    const [lastQuerySummary, setLastQuerySummary] = useState(null);

    useEffect(() => {
        if (isOpen && availableLayers) {
            const visibleLayerIds = availableLayers.filter(l => l.visible).map(l => l.id);
            if (selectedLayerIds.length === 0) {
                setSelectedLayerIds(visibleLayerIds);
            }
            if (activeLayer && !selectedLayerIds.includes(activeLayer.id)) {
                setSelectedLayerIds(prev => [...prev, activeLayer.id]);
            }
            if (qbConditions.length === 1 && !qbConditions[0].layerId && (activeLayer || selectedLayerIds.length > 0 || visibleLayerIds.length > 0)) {
                const targetId = activeLayer?.id || selectedLayerIds[0] || visibleLayerIds[0];
                if (targetId) {
                    setQbConditions([{ layerId: targetId, field: '', operator: '=', value: '', logic: 'AND' }]);
                }
            }
        }
    }, [isOpen, availableLayers?.length, activeLayer?.id]);

    useEffect(() => {
        if (isOpen && selectedLayerIds.length > 0) {
            fetchAllAttributes();
        }
    }, [isOpen, selectedLayerIds.length]);

    useEffect(() => {
        if (!isOpen) {
            setShowReportButton(false);
            setLastQuerySummary(null);
        }
    }, [isOpen]);

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

    const buildLayerFilters = () => {
        const layerFilters = {};
        selectedLayerIds.forEach(id => {
            const conditionsForLayer = qbConditions.filter(c => c.layerId === id);
            if (conditionsForLayer.length > 0) {
                const cql = QueryBuilderFilter(conditionsForLayer);
                if (cql) layerFilters[id] = cql;
            }
        });
        return layerFilters;
    };

    const handleApplyFilter = async () => {
        if (selectedLayerIds.length === 0) {
            toast.error("Please select at least one layer.");
            return;
        }
        const layerFilters = buildLayerFilters();
        let appliedCount = 0;
        Object.entries(layerFilters).forEach(([id, cql]) => {
            handleApplyLayerFilter(id, cql);
            appliedCount++;
        });
        if (appliedCount > 0) {
            toast.success(`Applied filters to ${appliedCount} layer${appliedCount > 1 ? 's' : ''}!`);
            if (typeof onRunQuery === 'function') {
                const summary = await onRunQuery({
                    layerFilters,
                    conditions: qbConditions,
                    selectedLayerIds
                });
                const totalCount = Number(summary?.totalCount || 0);
                setLastQuerySummary(summary || null);
                setShowReportButton(totalCount > 0);
                if (totalCount > 0) {
                    toast.success(`Found ${totalCount} matching feature${totalCount > 1 ? 's' : ''}.`);
                } else {
                    toast.error("No matching features found for report.");
                }
            } else {
                setShowReportButton(false);
                setLastQuerySummary(null);
            }
        } else {
            setShowReportButton(false);
            setLastQuerySummary(null);
            toast.error("No valid conditions found.");
        }
    };

    const handleGenerateReport = async () => {
        if (!showReportButton || !lastQuerySummary || Number(lastQuerySummary.totalCount || 0) <= 0) {
            toast.error("Run query with matching features first.");
            return;
        }

        if (typeof onGenerateReport === 'function') {
            await onGenerateReport({
                querySummary: lastQuerySummary,
                conditions: qbConditions,
                selectedLayerIds
            });
            return;
        }

        toast.success('Report option is ready. Connect report export handler to generate output.');
    };

    const handleGenerateSnapshotReport = async () => {
        if (!showReportButton || !lastQuerySummary || Number(lastQuerySummary.totalCount || 0) <= 0) {
            toast.error("Run query with matching features first.");
            return;
        }

        if (typeof onGenerateSnapshotReport === 'function') {
            await onGenerateSnapshotReport({
                querySummary: lastQuerySummary,
                conditions: qbConditions,
                selectedLayerIds
            });
            return;
        }

        toast.success('Snapshot report option is ready. Connect snapshot export handler to generate output.');
    };

    const handleResetAll = () => {
        selectedLayerIds.forEach(id => handleApplyLayerFilter(id, null));
        const firstId = selectedLayerIds[0] || '';
        const firstAttr = layerAttributesMap[firstId]?.[0] || '';
        setQbConditions([{ layerId: firstId, field: firstAttr, operator: '=', value: '', logic: 'AND' }]);
        setShowReportButton(false);
        setLastQuerySummary(null);
        toast.success("All filters cleared!");
    };

    const addCondition = () => {
        const firstId = selectedLayerIds[0] || '';
        const firstAttr = layerAttributesMap[firstId]?.[0] || '';
        setShowReportButton(false);
        setLastQuerySummary(null);
        setQbConditions([...qbConditions, { layerId: firstId, field: firstAttr, operator: '=', value: '', logic: 'AND' }]);
    };

    const removeCondition = (index) => {
        if (qbConditions.length > 1) {
            setShowReportButton(false);
            setLastQuerySummary(null);
            setQbConditions(qbConditions.filter((_, i) => i !== index));
        } else {
            const firstId = selectedLayerIds[0] || '';
            const firstAttr = layerAttributesMap[firstId]?.[0] || '';
            setShowReportButton(false);
            setLastQuerySummary(null);
            setQbConditions([{ layerId: firstId, field: firstAttr, operator: '=', value: '', logic: 'AND' }]);
        }
    };

    const updateCondition = (index, updates) => {
        setShowReportButton(false);
        setLastQuerySummary(null);
        setQbConditions(qbConditions.map((c, i) => {
            if (i === index) {
                const newCond = { ...c, ...updates };
                if (updates.layerId && updates.layerId !== c.layerId) {
                    newCond.field = layerAttributesMap[updates.layerId]?.[0] || '';
                }
                return newCond;
            }
            return c;
        }));
    };

    const activeSelectedLayers = availableLayers.filter(l => selectedLayerIds.includes(l.id));

    if (!isOpen) return null;

    return (
        <div className={`qb-panel-wrapper ${isMinimized ? 'qb-panel-minimized' : ''} ${isParentPanelMinimized ? 'qb-parent-panel-minimized' : ''}`}>
            {/* Floating Expand Button (shown only when minimized) */}
            {isMinimized && (
                <button
                    onClick={() => setIsMinimized(false)}
                    className="card-expand-float-btn card-expand-float-btn-query"
                    title="Expand Query Builder"
                >
                    <Filter size={24} strokeWidth={2.5} />
                </button>
            )}

            {/* Main Card */}
            <div className="qb-card">
                {/* Header */}
                <div className="qb-header">
                    <div className="qb-header-left">
                        <div className="qb-header-icon">
                            <Filter size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="qb-title">Query Builder</h3>
                            <p className="qb-subtitle">Filter map data by attributes</p>
                        </div>
                    </div>
                    <div className="qb-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="card-minimize-btn"
                            title="Minimize"
                        >
                            <Minimize2 size={16} strokeWidth={2.5} />
                        </button>
                        <button onClick={onClose} className="qb-close-btn" title="Close">
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="qb-body">
                    {selectedLayerIds.length === 0 ? (
                        <div className="qb-empty-state">
                            <div className="qb-empty-icon">
                                <DatabaseZap size={28} />
                            </div>
                            <p className="qb-empty-title">No Layers Selected</p>
                            <p className="qb-empty-desc">Enable layers from the layers panel to start building queries.</p>
                        </div>
                    ) : isFetchingAttributes ? (
                        <div className="qb-loading-state">
                            <Loader2 size={24} className="qb-spinner" />
                            <span className="qb-loading-text">Loading attributes...</span>
                        </div>
                    ) : (
                        <div className="qb-conditions-list">
                            {qbConditions.map((cond, index) => (
                                <div key={index} className="qb-condition-block">
                                    {/* Logic connector between conditions */}
                                    {index > 0 && (
                                        <div className="qb-logic-connector">
                                            {['AND', 'OR'].map(l => (
                                                <button
                                                    key={l}
                                                    onClick={() => updateCondition(index, { logic: l })}
                                                    className={`qb-logic-pill ${cond.logic === l ? 'active' : ''}`}
                                                >
                                                    {l}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="qb-condition-card-clean">
                                        {/* Row 1: Layer */}
                                        <div className="qb-field-group">
                                            <label className="qb-field-label">Layer</label>
                                            <select
                                                value={cond.layerId}
                                                onChange={(e) => updateCondition(index, { layerId: e.target.value })}
                                                className="qb-select"
                                            >
                                                {activeSelectedLayers.map(l => (
                                                    <option key={l.id} value={l.id}>{l.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Row 2: Attribute + Operator */}
                                        <div className="qb-field-row">
                                            <div className="qb-field-group" style={{ flex: 1.3 }}>
                                                <label className="qb-field-label">Attribute</label>
                                                <select
                                                    value={cond.field}
                                                    onChange={(e) => updateCondition(index, { field: e.target.value })}
                                                    className="qb-select"
                                                >
                                                    {(layerAttributesMap[cond.layerId] || []).map(attr => (
                                                        <option key={attr} value={attr}>{attr}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Operator</label>
                                                <select
                                                    value={cond.operator}
                                                    onChange={(e) => updateCondition(index, { operator: e.target.value })}
                                                    className="qb-select"
                                                >
                                                    {QB_OPERATORS.map(op => (
                                                        <option key={op.value} value={op.value}>{op.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Row 3: Value + Delete */}
                                        <div className="qb-field-row" style={{ alignItems: 'flex-end' }}>
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Value</label>
                                                <input
                                                    type="text"
                                                    value={cond.value}
                                                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                                                    placeholder="Enter value..."
                                                    className="qb-input"
                                                    onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
                                                />
                                            </div>
                                            <button
                                                onClick={() => removeCondition(index)}
                                                className="qb-remove-btn"
                                                title="Remove condition"
                                            >
                                                <Trash2 size={14} strokeWidth={2} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Add Condition */}
                            <button onClick={addCondition} className="qb-add-condition-btn">
                                <Plus size={16} strokeWidth={2.5} />
                                <span>Add Condition</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                {selectedLayerIds.length > 0 && !isFetchingAttributes && (
                    <div className="qb-footer" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={handleResetAll} className="qb-reset-btn">
                                <RefreshCw size={14} strokeWidth={2.5} />
                                <span>Reset</span>
                            </button>
                            <button onClick={handleApplyFilter} className="qb-apply-btn">
                                <Filter size={14} strokeWidth={2.5} />
                                <span>Run Query</span>
                            </button>
                        </div>
                        {showReportButton && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={handleGenerateReport} className="qb-report-btn" style={{ flex: 1 }}>
                                    <FileText size={14} strokeWidth={2.5} />
                                    <span>Features Report (20)</span>
                                </button>
                                <button onClick={handleGenerateSnapshotReport} className="qb-report-btn qb-report-secondary-btn" style={{ flex: 1 }}>
                                    <FileText size={14} strokeWidth={2.5} />
                                    <span>Snapshot Report</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QueryBuilderCard;
