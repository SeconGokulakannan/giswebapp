import React, { useState, useEffect } from 'react';
import { X, Plus, Activity, RefreshCw, Loader2, ChevronDown, ChevronUp, Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, Minimize2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLayerAttributes } from '../../services/Server';

const PRESET_COLORS = [
    '#22c55e', '#ef4444', '#3b82f6', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#64748b'
];

const AnalysisCard = ({ isOpen, onClose, visibleLayers, onRunAnalysis, onRefreshLayer, onUpdateStyle, currentFrameIndex: externalFrameIndex, isPlaying: externalIsPlaying, onPlaybackToggle, onFrameChange, onReset }) => {
    const [selectedLayerId, setSelectedLayerId] = useState('');

    // Dynamic State
    const [selectedProperty, setSelectedProperty] = useState('');
    const [mappings, setMappings] = useState([{ value: '', color: PRESET_COLORS[0], operator: '=' }]);
    const [isPeriodic, setIsPeriodic] = useState(false);
    const [dateProperty, setDateProperty] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [attributes, setAttributes] = useState([]);
    const [attributeDetails, setAttributeDetails] = useState([]);
    const [uniqueDates, setUniqueDates] = useState([]);
    const [isMinimized, setIsMinimized] = useState(false);

    const activeLayer = visibleLayers.find(l => l.id === selectedLayerId);

    // Filter unique dates based on selection
    const filteredDates = uniqueDates.filter(d => {
        if (!startDate || !endDate) return true;
        return d >= startDate && d <= endDate;
    });

    useEffect(() => {
        if (selectedLayerId && activeLayer) {
            fetchAttributes();
        } else {
            setAttributes([]);
            setSelectedProperty('');
            setUniqueDates([]);
        }

        // Auto-select first layer if none selected or current is gone
        if (visibleLayers.length > 0) {
            if (!selectedLayerId || !visibleLayers.find(l => l.id === selectedLayerId)) {
                setSelectedLayerId(visibleLayers[0].id);
            }
        } else if (selectedLayerId) {
            setSelectedLayerId('');
        }
    }, [selectedLayerId, visibleLayers]);


    const fetchAttributes = async () => {
        if (!activeLayer) return;
        try {
            const details = await getLayerAttributes(activeLayer.fullName, true);
            setAttributeDetails(details || []);
            const names = (details || []).map(p => p.name);
            setAttributes(names);
        } catch (error) {
            console.error("Error fetching attributes:", error);
        }
    };



    const fetchUniqueDates = async (prop) => {
        if (!activeLayer || !prop) return;
        // setIsFetchingDates(true);
        try {
            // Fetch unique dates from GeoServer
            const url = `${activeLayer.url || '/geoserver'}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${activeLayer.fullName}&propertyName=${prop}&outputFormat=application/json&maxFeatures=1000`;
            const response = await fetch(url);
            const data = await response.json();
            const dates = [...new Set(data.features.map(f => f.properties[prop]))].sort();
            setUniqueDates(dates);
        } catch (error) {
            console.error("Error fetching dates:", error);
        } finally {
            // setIsFetchingDates(false);
        }
    };

    useEffect(() => {
        if (isPeriodic && dateProperty) {
            fetchUniqueDates(dateProperty);
        }
    }, [isPeriodic, dateProperty]);

    const addMapping = () => {
        setMappings([...mappings, { value: '', color: PRESET_COLORS[mappings.length % PRESET_COLORS.length], operator: '=' }]);
    };

    const removeMapping = (index) => {
        if (mappings.length > 1) {
            setMappings(mappings.filter((_, i) => i !== index));
        }
    };

    const updateMapping = (index, updates) => {
        setMappings(mappings.map((m, i) => i === index ? { ...m, ...updates } : m));
    };

    const handleRunAnalysis = () => {
        if (!selectedLayerId || !selectedProperty) {
            toast.error('Please select a layer and an attribute.');
            return;
        }

        onRunAnalysis({
            layerId: selectedLayerId,
            property: selectedProperty,
            mappings,
            isPeriodic,
            dateProperty,
            startDate,
            endDate,
            filteredDates // Pass the sequence of dates for playback
        });
    };

    if (!isOpen) return null;

    return (
        <div className={`ac-panel-wrapper ${isMinimized ? 'ac-panel-minimized' : ''}`}>
            {/* Floating Expand Button (shown only when minimized) */}
            {isMinimized && (
                <button
                    onClick={() => setIsMinimized(false)}
                    className="card-expand-float-btn"
                    title="Expand Analysis"
                >
                    <Activity size={24} strokeWidth={2.5} />
                </button>
            )}

            {/* Main Card */}
            <div className="ac-card">
                {/* Header */}
                <div className="ac-header">
                    <div className="ac-header-left">
                        <div className="ac-header-icon">
                            <Activity size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="ac-title">Map Analysis</h3>
                            <p className="ac-subtitle">Analyze layer dynamics</p>
                        </div>
                    </div>
                    <div className="ac-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="card-minimize-btn"
                            title="Minimize"
                        >
                            <Minimize2 size={16} strokeWidth={2.5} />
                        </button>
                        <button onClick={onClose} className="ac-close-btn" title="Close">
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="ac-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Property Selection */}
                        <div className="qb-field-group">
                            <label className="qb-field-label">Condition Attribute</label>
                            <select
                                value={selectedProperty}
                                onChange={(e) => setSelectedProperty(e.target.value)}
                                className="qb-select"
                            >
                                <option value="">Select attribute...</option>
                                {attributes.map(attr => (
                                    <option key={attr} value={attr}>{attr}</option>
                                ))}
                            </select>
                        </div>

                        {/* Mappings */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <label className="qb-field-label">Value Mappings</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {mappings.map((m, index) => (
                                    <div key={index} className="qb-condition-card-clean" style={{ padding: '8px' }}>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <select
                                                value={m.operator || '='}
                                                onChange={(e) => updateMapping(index, { operator: e.target.value })}
                                                className="qb-select"
                                                style={{ width: '60px', background: 'var(--color-primary)', color: 'white', border: 'none' }}
                                            >
                                                <option value="=">=</option>
                                                <option value="!=">≠</option>
                                                <option value=">">&gt;</option>
                                                <option value="<">&lt;</option>
                                                <option value=">=">≥</option>
                                                <option value="<=">≤</option>
                                                <option value="LIKE">LIKE</option>
                                            </select>
                                            <input
                                                type="text"
                                                value={m.value}
                                                onChange={(e) => updateMapping(index, { value: e.target.value })}
                                                placeholder="Value..."
                                                className="qb-input"
                                                style={{ flex: 1 }}
                                            />
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '8px',
                                                background: m.color, position: 'relative', overflow: 'hidden',
                                                border: '2px solid var(--color-border)', flexShrink: 0
                                            }}>
                                                <input
                                                    type="color"
                                                    value={m.color}
                                                    onChange={(e) => updateMapping(index, { color: e.target.value })}
                                                    style={{ position: 'absolute', top: '-5px', left: '-5px', width: '50px', height: '50px', border: 'none', cursor: 'pointer', background: 'none' }}
                                                />
                                            </div>
                                            {mappings.length > 1 && (
                                                <button
                                                    onClick={() => removeMapping(index)}
                                                    className="qb-remove-btn"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addMapping} className="qb-add-condition-btn">
                                    <Plus size={14} /> <span>Add Condition</span>
                                </button>
                            </div>
                        </div>

                        {/* Periodic Switch */}
                        <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Loader2 size={16} className={isPeriodic ? "animate-spin" : ""} color="var(--color-primary)" />
                                    <label className="qb-field-label" style={{ margin: 0 }}>Periodic Playback</label>
                                </div>
                                <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                                    <input
                                        type="checkbox"
                                        checked={isPeriodic}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            if (checked) {
                                                const dateAttrs = attributeDetails.filter(attr => /date|time|year|timestamp/i.test(attr.localType || attr.type || '') || /date|time|year|timestamp/i.test(attr.name));
                                                if (dateAttrs.length === 0) { toast.error("No Attribute found with date"); return; }
                                                if (!dateProperty) setDateProperty(dateAttrs[0].name);
                                            }
                                            setIsPeriodic(checked);
                                            if (!checked && selectedProperty) {
                                                onRunAnalysis({ layerId: selectedLayerId, property: selectedProperty, mappings, isPeriodic: false, dateProperty, startDate, endDate, filteredDates: [] });
                                            }
                                        }}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            {isPeriodic && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                                    <div className="qb-field-group">
                                        <label className="qb-field-label">Date Field</label>
                                        <select value={dateProperty} onChange={(e) => setDateProperty(e.target.value)} className="qb-select">
                                            <option value="">Select Date Field...</option>
                                            {attributeDetails.filter(attr => /date|time|year|timestamp/i.test(attr.localType || attr.type || '') || /date|time|year|timestamp/i.test(attr.name)).map(attr => (
                                                <option key={attr.name} value={attr.name}>{attr.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div className="qb-field-group">
                                            <label className="qb-field-label">From</label>
                                            <select value={startDate} onChange={(e) => setStartDate(e.target.value)} className="qb-select">
                                                <option value="">Start...</option>
                                                {uniqueDates.map(date => <option key={date} value={date}>{date}</option>)}
                                            </select>
                                        </div>
                                        <div className="qb-field-group">
                                            <label className="qb-field-label">To</label>
                                            <select value={endDate} onChange={(e) => setEndDate(e.target.value)} className="qb-select">
                                                <option value="">End...</option>
                                                {uniqueDates.map(date => <option key={date} value={date}>{date}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => { setSelectedProperty(''); setMappings([{ value: '', color: PRESET_COLORS[0], operator: '=' }]); setIsPeriodic(false); if (onReset) onReset(); }}
                                className="qb-reset-btn"
                                style={{ flex: 1 }}
                            >
                                <RefreshCw size={14} /> <span>Reset</span>
                            </button>
                            <button
                                onClick={handleRunAnalysis}
                                className="qb-apply-btn"
                                style={{ flex: 2, background: 'linear-gradient(135deg, var(--color-primary), #6366f1)' }}
                            >
                                Run Analysis
                            </button>
                        </div>

                        {/* Playback Console */}
                        {isPeriodic && filteredDates.length > 0 && (
                            <div style={{ padding: '16px', borderRadius: '20px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
                                    <button onClick={() => onFrameChange(Math.max(0, externalFrameIndex - 1))} className="ac-close-btn" style={{ width: '36px', height: '36px' }}>
                                        <SkipBack size={16} fill="currentColor" />
                                    </button>
                                    <button onClick={onPlaybackToggle} style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-primary)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 15px rgba(var(--color-primary-rgb), 0.3)' }}>
                                        {externalIsPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" style={{ marginLeft: '3px' }} />}
                                    </button>
                                    <button onClick={() => onFrameChange(Math.min(filteredDates.length - 1, externalFrameIndex + 1))} className="ac-close-btn" style={{ width: '36px', height: '36px' }}>
                                        <SkipForward size={16} fill="currentColor" />
                                    </button>
                                </div>
                                <div style={{ background: 'var(--color-bg-tertiary)', padding: '10px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '8px' }}>
                                        <span style={{ color: 'var(--color-primary)', fontWeight: '800' }}>{filteredDates[externalFrameIndex] || '---'}</span>
                                        <span style={{ color: 'var(--color-text-muted)' }}>{externalFrameIndex + 1} / {filteredDates.length}</span>
                                    </div>
                                    <input type="range" min="0" max={filteredDates.length - 1} value={externalFrameIndex} onChange={(e) => onFrameChange(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalysisCard;
