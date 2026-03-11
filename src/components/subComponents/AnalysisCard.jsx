import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Activity, RefreshCw, Loader2, Play, Pause, Minimize2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLayerAttributes } from './LayerOperations';
import { PRESET_COLORS, GEOSERVER_URL, AUTH_HEADER } from '../../constants/AppConstants';

// OL Imports
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';

// Utils
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const AnalysisCard = ({
    isOpen,
    onClose,
    visibleLayers,
    setGeoServerLayers,
    mapInstance,
    mapRef,
    theme = 'light',
    isParentPanelMinimized = false,
    layoutMode = 'sidebar'
}) => {
    const [isPeriodic, setIsPeriodic] = useState(false);
    const [dateProperty, setDateProperty] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [attributes, setAttributes] = useState([]);
    const [attributeDetails, setAttributeDetails] = useState([]);
    const [uniqueDates, setUniqueDates] = useState([]);
    const [isMinimized, setIsMinimized] = useState(false);
    const [selectedLayerId, setSelectedLayerId] = useState('');
    const [selectedProperty, setSelectedProperty] = useState('');
    const [mappings, setMappings] = useState([{ value: '', color: PRESET_COLORS[0], operator: '=' }]);
    const [isJoining, setIsJoining] = useState(false);
    const [analysisConfig, setAnalysisConfig] = useState(null);

    // Playback State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);

    const analysisVectorLayersRef = useRef({});
    const playbackIntervalRef = useRef(null);

    const activeLayer = visibleLayers.find(l => l.id === selectedLayerId);
    const filteredDates = uniqueDates.filter(d => (!startDate || !endDate) ? true : (d >= startDate && d <= endDate));

    // Reset when closed
    useEffect(() => {
        if (!isOpen) {
            handleReset();
            setIsPeriodic(false);
            setDateProperty('');
            setStartDate('');
            setEndDate('');
            setSelectedProperty('');
            setMappings([{ value: '', color: PRESET_COLORS[0], operator: '=' }]);
            setIsMinimized(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedLayerId && activeLayer) fetchAttributes();
        else { setAttributes([]); setSelectedProperty(''); setUniqueDates([]); }

        if (visibleLayers.length > 0 && (!selectedLayerId || !visibleLayers.find(l => l.id === selectedLayerId))) {
            setSelectedLayerId(visibleLayers[0].id);
        } else if (visibleLayers.length === 0) {
            setSelectedLayerId('');
        }
    }, [selectedLayerId, visibleLayers]);

    const fetchAttributes = async () => {
        if (!activeLayer) return;
        try {
            const details = await getLayerAttributes(activeLayer.fullName, true);
            setAttributeDetails(details || []);
            setAttributes((details || []).map(p => p.name));
        } catch (error) { console.error(error); }
    };

    const fetchUniqueDates = async (prop) => {
        if (!activeLayer || !prop) return;
        try {
            const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${activeLayer.fullName}&propertyName=${prop}&outputFormat=application/json&maxFeatures=1000`;
            const res = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
            const data = await res.json();
            const dates = [...new Set(data.features.map(f => f.properties[prop]))].sort();
            setUniqueDates(dates);
        } catch (error) { console.error(error); }
    };

    useEffect(() => {
        if (isPeriodic && dateProperty) fetchUniqueDates(dateProperty);
    }, [isPeriodic, dateProperty]);

    // Playback Logic
    useEffect(() => {
        if (isPlaying && isPeriodic && filteredDates.length > 0) {
            playbackIntervalRef.current = setInterval(() => {
                setCurrentFrameIndex(prev => (prev + 1) % filteredDates.length);
            }, 1000);
        } else {
            clearInterval(playbackIntervalRef.current);
        }
        return () => clearInterval(playbackIntervalRef.current);
    }, [isPlaying, isPeriodic, filteredDates]);

    useEffect(() => {
        if (isPeriodic && analysisConfig && filteredDates.length > 0) {
            updateAnalysisFrame(currentFrameIndex);
        }
    }, [currentFrameIndex]);

    const updateAnalysisFrame = async (frameIdx) => {
        if (!analysisConfig || !mapInstance) return;
        const frameDate = filteredDates[frameIdx];
        const toastId = 'analysis-frame-toast';
        toast.loading(`Loading: ${frameDate}`, { id: toastId });

        try {
            const cql = `${analysisConfig.property} IS NOT NULL AND ${analysisConfig.dateProperty} = '${frameDate}'`;
            const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${activeLayer.fullName}&outputFormat=application/json&srsName=EPSG:3857&cql_filter=${encodeURIComponent(cql)}`;
            const res = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
            const geojson = await res.json();

            const source = new VectorSource({ features: new GeoJSON().readFeatures(geojson) });
            const style = (feature) => {
                const val = feature.get(analysisConfig.property);
                const match = analysisConfig.mappings.find(m => {
                    const mVal = String(m.value).trim();
                    const fVal = String(val).trim();
                    if (!mVal) return false;
                    switch (m.operator) {
                        case '=': return fVal === mVal;
                        case '!=': return fVal !== mVal;
                        case '>': return Number(fVal) > Number(mVal);
                        case '<': return Number(fVal) < Number(mVal);
                        case '>=': return Number(fVal) >= Number(mVal);
                        case '<=': return Number(fVal) <= Number(mVal);
                        case 'LIKE': return fVal.toLowerCase().includes(mVal.toLowerCase());
                        default: return false;
                    }
                });
                if (!match) return null;
                return new Style({
                    fill: new Fill({ color: match.color + 'cc' }),
                    stroke: new Stroke({ color: '#fff', width: 1 }),
                    image: new CircleStyle({ radius: 6, fill: new Fill({ color: match.color }), stroke: new Stroke({ color: '#fff', width: 1 }) })
                });
            };

            const layer = new VectorLayer({ source, style, zIndex: 1002 });
            Object.values(analysisVectorLayersRef.current).forEach(l => mapInstance.removeLayer(l));
            mapInstance.addLayer(layer);
            analysisVectorLayersRef.current = { [analysisConfig.layerId]: layer };
            toast.success(`Shown: ${frameDate}`, { id: toastId });
        } catch (err) {
            toast.error('Frame load failed', { id: toastId });
        }
    };

    const handleRunAnalysis = async () => {
        if (!selectedLayerId || !selectedProperty || !mapInstance) {
            toast.error('Incomplete selection');
            return;
        }

        const config = { layerId: selectedLayerId, property: selectedProperty, mappings, isPeriodic, dateProperty, startDate, endDate };
        setAnalysisConfig(config);

        if (isPeriodic) {
            setCurrentFrameIndex(0);
            setIsPlaying(true);
        } else {
            const toastId = toast.loading('Running analysis...');
            try {
                const cql = `${selectedProperty} IS NOT NULL`;
                const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${activeLayer.fullName}&outputFormat=application/json&srsName=EPSG:3857&cql_filter=${encodeURIComponent(cql)}`;
                const res = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
                const geojson = await res.json();

                // Hide original
                setGeoServerLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, visible: false, wasVisibleBeforeAnalysis: l.visible } : l));

                const source = new VectorSource({ features: new GeoJSON().readFeatures(geojson) });
                const style = (feature) => {
                    const val = feature.get(selectedProperty);
                    const match = mappings.find(m => {
                        const mVal = String(m.value).trim();
                        const fVal = String(val).trim();
                        if (!mVal) return false;
                        switch (m.operator) {
                            case '=': return fVal === mVal;
                            case '!=': return fVal !== mVal;
                            case '>': return Number(fVal) > Number(mVal);
                            case '<': return Number(fVal) < Number(mVal);
                            case '>=': return Number(fVal) >= Number(mVal);
                            case '<=': return Number(fVal) <= Number(mVal);
                            case 'LIKE': return fVal.toLowerCase().includes(mVal.toLowerCase());
                            default: return false;
                        }
                    });
                    if (!match) return null;
                    return new Style({
                        fill: new Fill({ color: match.color + 'cc' }),
                        stroke: new Stroke({ color: '#fff', width: 1.5 }),
                        image: new CircleStyle({ radius: 7, fill: new Fill({ color: match.color }), stroke: new Stroke({ color: '#fff', width: 1 }) })
                    });
                };

                const layer = new VectorLayer({ source, style, zIndex: 1002 });
                Object.values(analysisVectorLayersRef.current).forEach(l => mapInstance.removeLayer(l));
                mapInstance.addLayer(layer);
                analysisVectorLayersRef.current[selectedLayerId] = layer;

                toast.success('Analysis complete', { id: toastId });
            } catch (err) {
                toast.error('Analysis failed', { id: toastId });
            }
        }
    };

    const handleReset = () => {
        if (!mapInstance) return;
        Object.keys(analysisVectorLayersRef.current).forEach(id => {
            const l = analysisVectorLayersRef.current[id];
            if (l) mapInstance.removeLayer(l);
            setGeoServerLayers(prev => prev.map(lyr => lyr.id === id ? { ...lyr, visible: lyr.wasVisibleBeforeAnalysis ?? lyr.visible } : lyr));
        });
        analysisVectorLayersRef.current = {};
        setAnalysisConfig(null);
        setIsPlaying(false);
    };

    const handleExportReport = async () => {
        if (!analysisConfig || !mapRef.current) return;
        const toastId = toast.loading('Generating report...');
        try {
            const canvas = await html2canvas(mapRef.current, { useCORS: true, backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc' });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageW = pdf.internal.pageSize.getWidth();
            pdf.setFillColor(49, 82, 232); pdf.rect(0, 0, pageW, 22, 'F');
            pdf.setTextColor(255); pdf.setFontSize(11); pdf.text('GIS Map Analysis Report', 12, 14);
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 12, 28, pageW - 24, 90);
            pdf.save(`Analysis_Report_${Date.now()}.pdf`);
            toast.success('Report saved', { id: toastId });
        } catch (e) { toast.error('Report failed', { id: toastId }); }
    };

    if (!isOpen) return null;

    return (
        <div className={`ac-panel-wrapper ${isMinimized ? 'ac-panel-minimized' : ''} ${isParentPanelMinimized ? 'ac-parent-panel-minimized' : ''} layout-${layoutMode}`}>
            {isMinimized && (
                <button onClick={() => setIsMinimized(false)} className="card-expand-float-btn card-expand-float-btn-analysis">
                    <Activity size={24} strokeWidth={2.5} />
                </button>
            )}

            <div className="ac-card">
                <div className="ac-header">
                    <div className="ac-header-left">
                        <div className="ac-header-icon"><Activity size={16} strokeWidth={2.5} /></div>
                        <div>
                            <h3 className="ac-title">Map Analysis</h3>
                            <p className="ac-subtitle">Analyze layer dynamics</p>
                        </div>
                    </div>
                    <div className="ac-header-actions">
                        <button onClick={() => setIsMinimized(true)} className="card-minimize-btn"><Minimize2 size={16} /></button>
                        <button onClick={onClose} className="ac-close-btn"><X size={16} /></button>
                    </div>
                </div>

                <div className="ac-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="qb-field-group">
                            <label className="qb-field-label">Condition Attribute</label>
                            <select value={selectedProperty} onChange={(e) => setSelectedProperty(e.target.value)} className="qb-select">
                                <option value="">Select attribute...</option>
                                {attributes.map(attr => <option key={attr} value={attr}>{attr}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <label className="qb-field-label">Value Mappings</label>
                            {mappings.map((m, idx) => (
                                <div key={idx} className="qb-condition-card-clean" style={{ padding: '8px', display: 'flex', gap: '6px' }}>
                                    <select value={m.operator} onChange={(e) => setMappings(mappings.map((mat, i) => i === idx ? { ...mat, operator: e.target.value } : mat))} className="qb-select" style={{ width: '60px' }}>
                                        {['=', '!=', '>', '<', '>=', '<=', 'LIKE'].map(op => <option key={op} value={op}>{op}</option>)}
                                    </select>
                                    <input type="text" value={m.value} onChange={(e) => setMappings(mappings.map((mat, i) => i === idx ? { ...mat, value: e.target.value } : mat))} placeholder="Value..." className="qb-input" />
                                    <input type="color" value={m.color} onChange={(e) => setMappings(mappings.map((mat, i) => i === idx ? { ...mat, color: e.target.value } : mat))} style={{ width: '32px', height: '32px', border: 'none', cursor: 'pointer' }} />
                                    {mappings.length > 1 && <button onClick={() => setMappings(mappings.filter((_, i) => i !== idx))} className="qb-remove-btn"><X size={14} /></button>}
                                </div>
                            ))}
                            <button onClick={() => setMappings([...mappings, { value: '', color: PRESET_COLORS[mappings.length % PRESET_COLORS.length], operator: '=' }])} className="qb-add-condition-btn">
                                <Plus size={14} /> <span>Add Condition</span>
                            </button>
                        </div>

                        <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Loader2 size={16} className={isPeriodic ? "animate-spin" : ""} color="var(--color-primary)" />
                                    <label className="qb-field-label" style={{ margin: 0 }}>Periodic Playback</label>
                                </div>
                                <input type="checkbox" checked={isPeriodic} onChange={(e) => setIsPeriodic(e.target.checked)} />
                            </div>
                            {isPeriodic && (
                                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <select value={dateProperty} onChange={(e) => setDateProperty(e.target.value)} className="qb-select">
                                        <option value="">Select Date Field...</option>
                                        {attributeDetails.filter(a => /date|time|year/i.test(a.name)).map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={handleReset} className="qb-reset-btn" style={{ flex: 1 }}><RefreshCw size={14} /> <span>Reset</span></button>
                            <button onClick={handleRunAnalysis} className="qb-apply-btn" style={{ flex: 2 }}>Run Analysis</button>
                            {analysisConfig && <button onClick={handleExportReport} className="qb-report-btn"><FileText size={14} /></button>}
                        </div>

                        {isPeriodic && analysisConfig && filteredDates.length > 0 && (
                            <div style={{ padding: '16px', background: 'var(--color-bg-secondary)', borderRadius: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '12px' }}>
                                    <button onClick={() => setIsPlaying(!isPlaying)} className="qb-apply-btn" style={{ width: '48px', height: '48px', borderRadius: '50%' }}>
                                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                                    </button>
                                </div>
                                <div style={{ fontSize: '12px', textAlign: 'center' }}>{filteredDates[currentFrameIndex]}</div>
                                <input type="range" min="0" max={filteredDates.length - 1} value={currentFrameIndex} onChange={(e) => setCurrentFrameIndex(parseInt(e.target.value))} style={{ width: '100%' }} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Hook to manage Analysis state and operations.
 */
export const useAnalysisLogic = () => {
    const [analysisLayerIds, setAnalysisLayerIds] = useState([]);

    const handleToggleAnalysisLayer = (layerId) => {
        setAnalysisLayerIds(prev => {
            if (prev.includes(layerId)) {
                return [];
            }
            return [layerId];
        });
    };

    return {
        analysisLayerIds,
        setAnalysisLayerIds,
        handleToggleAnalysisLayer
    };
};

export default AnalysisCard;

