import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, DatabaseZap, RefreshCw, Loader2, Filter, Trash2, Minimize2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLayerAttributes } from './LayerOperations';
import { QB_OPERATORS, GEOSERVER_URL, AUTH_HEADER } from '../../constants/AppConstants';

// OL Imports
import GeoJSON from 'ol/format/GeoJSON';

// Utils
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const QueryBuilderCard = ({
    isOpen,
    onClose,
    activeLayer,
    availableLayers,
    handleApplyLayerFilter,
    selectedLayerIds,
    setSelectedLayerIds,
    mapInstance,
    mapRef,
    selectionSource,
    theme = 'light',
    isParentPanelMinimized = false,
    layoutMode = 'sidebar'
}) => {
    const [qbConditions, setQbConditions] = useState([{ layerId: '', field: '', operator: '=', value: '', logic: 'AND' }]);
    const [layerAttributesMap, setLayerAttributesMap] = useState({});
    const [isFetchingAttributes, setIsFetchingAttributes] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [showReportButton, setShowReportButton] = useState(false);
    const [lastQuerySummary, setLastQuerySummary] = useState(null);

    // Initial Setup
    useEffect(() => {
        if (isOpen && availableLayers) {
            const visibleLayerIds = availableLayers.filter(l => l.visible).map(l => l.id);
            if (selectedLayerIds.length === 0) setSelectedLayerIds(visibleLayerIds);
            if (activeLayer && !selectedLayerIds.includes(activeLayer.id)) {
                setSelectedLayerIds(prev => [...prev, activeLayer.id]);
            }
            if (qbConditions.length === 1 && !qbConditions[0].layerId) {
                const targetId = activeLayer?.id || selectedLayerIds[0] || visibleLayerIds[0];
                if (targetId) setQbConditions([{ layerId: targetId, field: '', operator: '=', value: '', logic: 'AND' }]);
            }
        }
    }, [isOpen, availableLayers?.length, activeLayer?.id]);

    useEffect(() => {
        if (isOpen && selectedLayerIds.length > 0) fetchAllAttributes();
    }, [isOpen, selectedLayerIds.length]);

    useEffect(() => {
        if (!isOpen) {
            setShowReportButton(false);
            setLastQuerySummary(null);
            setQbConditions([{ layerId: '', field: '', operator: '=', value: '', logic: 'AND' }]);
            setSelectedLayerIds([]);
            setIsMinimized(false);
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
        } catch (error) { console.error(error); }
        finally { setIsFetchingAttributes(false); }
    };

    const fetchFeatures = async (layer, cql) => {
        try {
            let url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${layer.fullName}&outputFormat=application/json&srsName=EPSG:3857&maxFeatures=10000`;
            if (cql) url += `&cql_filter=${encodeURIComponent(cql)}`;
            const res = await fetch(url, { headers: { Authorization: AUTH_HEADER } });
            const data = await res.json();
            return data.features || [];
        } catch (e) { return []; }
    };

    const handleApplyFilter = async () => {
        if (selectedLayerIds.length === 0) { toast.error("Select at least one layer."); return; }
        const layerFilters = {};
        selectedLayerIds.forEach(id => {
            const conds = qbConditions.filter(c => c.layerId === id);
            if (conds.length > 0) {
                const cql = QueryBuilderFilter(conds);
                if (cql) layerFilters[id] = cql;
            }
        });

        Object.entries(layerFilters).forEach(([id, cql]) => handleApplyLayerFilter(id, cql));

        const toastId = toast.loading('Running query summary...');
        const entries = Object.entries(layerFilters);
        const layerReports = [];
        let total = 0;

        for (const [id, cql] of entries) {
            const layer = availableLayers.find(l => String(l.id) === String(id));
            if (!layer) continue;
            const features = await fetchFeatures(layer, cql);
            layerReports.push({ layerId: layer.id, layerName: layer.name, fullName: layer.fullName, cqlFilter: cql, features, featureCount: features.length });
            total += features.length;
        }

        const summary = { totalCount: total, layerReports, generatedAt: new Date().toISOString() };
        setLastQuerySummary(summary);
        setShowReportButton(total > 0);

        if (total > 0) toast.success(`Found ${total} matching features.`, { id: toastId });
        else toast.error("No matches found.", { id: toastId });
    };

    const waitForMap = async () => {
        if (!mapInstance) return;
        await new Promise(r => {
            mapInstance.once('rendercomplete', () => setTimeout(r, 150));
            mapInstance.renderSync();
            setTimeout(r, 900);
        });
    };

    const focusAndCapture = async (featureJson) => {
        if (!mapInstance || !mapRef.current) return null;
        const format = new GeoJSON();
        const olFeature = format.readFeature(featureJson, { dataProjection: 'EPSG:3857', featureProjection: 'EPSG:3857' });
        if (selectionSource) { selectionSource.clear(); selectionSource.addFeature(olFeature.clone()); }
        const geom = olFeature.getGeometry();
        if (geom) {
            mapInstance.getView().fit(geom.getExtent(), { padding: [80, 80, 80, 80], duration: 500, maxZoom: 17 });
            await new Promise(r => setTimeout(r, 600));
        }
        await waitForMap();
        const canvas = await html2canvas(mapRef.current, { useCORS: true, backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc' });
        return canvas.toDataURL('image/png');
    };

    const handleGenerateReport = async () => {
        if (!lastQuerySummary || lastQuerySummary.totalCount === 0) return;
        const toastId = toast.loading('Generating premium report...');
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageW = pdf.internal.pageSize.getWidth();
            const reports = lastQuerySummary.layerReports.filter(r => r.features.length > 0);
            let processed = 0;
            const totalToProcess = Math.min(20, lastQuerySummary.totalCount);

            for (const lr of reports) {
                for (let i = 0; i < lr.features.length && processed < totalToProcess; i++) {
                    if (processed > 0) pdf.addPage();
                    processed++;
                    toast.loading(`Processing feature ${processed}/${totalToProcess}...`, { id: toastId });

                    pdf.setFillColor(49, 82, 232); pdf.rect(0, 0, pageW, 22, 'F');
                    pdf.setTextColor(255); pdf.setFontSize(10); pdf.text(`Query Report - ${lr.layerName} #${i + 1}`, 12, 14);

                    const img = await focusAndCapture(lr.features[i]);
                    if (img) pdf.addImage(img, 'PNG', 12, 28, pageW - 24, 60);

                    let y = 100;
                    const props = lr.features[i].properties || {};
                    Object.entries(props).slice(0, 15).forEach(([k, v]) => {
                        if (['geom', 'the_geom', 'geometry'].includes(k.toLowerCase())) return;
                        pdf.setTextColor(30); pdf.setFontSize(8); pdf.text(`${k}: ${v}`, 14, y);
                        y += 5;
                    });
                }
            }
            pdf.save(`Query_Report_${Date.now()}.pdf`);
            toast.success('Report exported!', { id: toastId });
        } catch (e) { toast.error('Report failed', { id: toastId }); }
        finally { if (selectionSource) selectionSource.clear(); }
    };

    const handleGenerateSnapshotReport = async () => {
        if (!mapRef.current) return;
        const toastId = toast.loading('Exporting snapshot...');
        try {
            await waitForMap();
            const canvas = await html2canvas(mapRef.current, { useCORS: true, backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc' });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageW = pdf.internal.pageSize.getWidth();
            pdf.setFillColor(49, 82, 232); pdf.rect(0, 0, pageW, 22, 'F');
            pdf.setTextColor(255); pdf.text('Map selection snapshot', 12, 14);
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 12, 28, pageW - 24, 130);
            pdf.save(`Snapshot_${Date.now()}.pdf`);
            toast.success('Snapshot exported!', { id: toastId });
        } catch (e) { toast.error('Snapshot failed', { id: toastId }); }
    };

    const handleResetAll = () => {
        selectedLayerIds.forEach(id => handleApplyLayerFilter(id, null));
        setQbConditions([{ layerId: selectedLayerIds[0] || '', field: '', operator: '=', value: '', logic: 'AND' }]);
        setShowReportButton(false);
        setLastQuerySummary(null);
        toast.success("Filters cleared!");
    };

    const activeSelectedLayers = availableLayers.filter(l => selectedLayerIds.includes(l.id));

    if (!isOpen) return null;

    return (
        <div className={`qb-panel-wrapper ${isMinimized ? 'qb-panel-minimized' : ''} ${isParentPanelMinimized ? 'ac-parent-panel-minimized' : ''} layout-${layoutMode}`}>
            {isMinimized && (
                <button onClick={() => setIsMinimized(false)} className="card-expand-float-btn card-expand-float-btn-query">
                    <Filter size={24} strokeWidth={2.5} />
                </button>
            )}

            <div className="qb-card">
                <div className="qb-header">
                    <div className="qb-header-left">
                        <div className="qb-header-icon"><Filter size={16} strokeWidth={2.5} /></div>
                        <div>
                            <h3 className="qb-title">Query Builder</h3>
                            <p className="qb-subtitle">Filter map data by attributes</p>
                        </div>
                    </div>
                    <div className="qb-header-actions">
                        <button onClick={() => setIsMinimized(true)} className="card-minimize-btn"><Minimize2 size={16} /></button>
                        <button onClick={onClose} className="qb-close-btn"><X size={16} /></button>
                    </div>
                </div>

                <div className="qb-body">
                    {selectedLayerIds.length === 0 ? (
                        <div className="qb-empty-state">
                            <div className="qb-empty-icon"><DatabaseZap size={28} /></div>
                            <p className="qb-empty-title">No Layers Selected</p>
                        </div>
                    ) : isFetchingAttributes ? (
                        <div className="qb-loading-state"><Loader2 size={24} className="qb-spinner" /></div>
                    ) : (
                        <div className="qb-conditions-list">
                            {qbConditions.map((cond, idx) => (
                                <div key={idx} className="qb-condition-block">
                                    <div className="qb-condition-card-clean">
                                        <select value={cond.layerId} onChange={(e) => setQbConditions(qbConditions.map((c, i) => i === idx ? { ...c, layerId: e.target.value, field: layerAttributesMap[e.target.value]?.[0] || '' } : c))} className="qb-select">
                                            {activeSelectedLayers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                        <select value={cond.field} onChange={(e) => setQbConditions(qbConditions.map((c, i) => i === idx ? { ...c, field: e.target.value } : c))} className="qb-select">
                                            {(layerAttributesMap[cond.layerId] || []).map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                        <select value={cond.operator} onChange={(e) => setQbConditions(qbConditions.map((c, i) => i === idx ? { ...c, operator: e.target.value } : c))} className="qb-select">
                                            {QB_OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                                        </select>
                                        <input type="text" value={cond.value} onChange={(e) => setQbConditions(qbConditions.map((c, i) => i === idx ? { ...c, value: e.target.value } : c))} className="qb-input" placeholder="Value..." />
                                        <button onClick={() => setQbConditions(qbConditions.filter((_, i) => i !== idx))} className="qb-remove-btn"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => setQbConditions([...qbConditions, { layerId: selectedLayerIds[0], field: layerAttributesMap[selectedLayerIds[0]]?.[0] || '', operator: '=', value: '', logic: 'AND' }])} className="qb-add-condition-btn">
                                <Plus size={16} /> <span>Add Condition</span>
                            </button>
                        </div>
                    )}
                </div>

                {selectedLayerIds.length > 0 && !isFetchingAttributes && (
                    <div className="qb-footer">
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <button onClick={handleResetAll} className="qb-reset-btn" style={{ flex: 1 }}><RefreshCw size={14} /> <span>Reset</span></button>
                            <button onClick={handleApplyFilter} className="qb-apply-btn" style={{ flex: 2 }}><Filter size={14} /> <span>Run Query</span></button>
                        </div>
                        {showReportButton && (
                            <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '8px' }}>
                                <button onClick={handleGenerateReport} className="qb-report-btn" style={{ flex: 1 }}><FileText size={14} /> <span>Premium Report</span></button>
                                <button onClick={handleGenerateSnapshotReport} className="qb-report-btn qb-report-secondary-btn" style={{ flex: 1 }}><FileText size={14} /> <span>Snapshot</span></button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


/**
 * Hook to manage Query Builder state.
 */
export const useQueryBuilder = () => {
    const [showQueryBuilder, setShowQueryBuilder] = useState(false);
    const [queryingLayer, setQueryingLayer] = useState(null);
    const [selectedQueryLayerIds, setSelectedQueryLayerIds] = useState([]);

    const handleOpenQueryBuilder = (layer) => {
        setQueryingLayer(layer);
        setShowQueryBuilder(true);
    };

    const handleCloseQueryBuilder = () => {
        setShowQueryBuilder(false);
        setQueryingLayer(null);
    };

    return {
        showQueryBuilder,
        setShowQueryBuilder,
        queryingLayer,
        setQueryingLayer,
        selectedQueryLayerIds,
        setSelectedQueryLayerIds,
        handleOpenQueryBuilder,
        handleCloseQueryBuilder
    };
};


/**
 * Query Builder Utilities (Localised)
 */

export const QueryBuilderFilter = (conditions) => {
    if (!conditions || conditions.length === 0) return null;
    const validConditions = conditions.filter(c => c.field && c.value);
    if (validConditions.length === 0) return null;
    let cqlParts = [];
    validConditions.forEach((cond) => {
        let formattedValue = cond.value;
        if (cond.operator === 'LIKE' || cond.operator === 'ILIKE') {
            formattedValue = `'%${cond.value}%'`;
        } else {
            if (cond.value === '' || isNaN(cond.value)) {
                formattedValue = `'${cond.value}'`;
            }
        }
        cqlParts.push(`${cond.field} ${cond.operator} ${formattedValue}`);
    });
    return cqlParts.join(' AND ');
};

export default QueryBuilderCard;


