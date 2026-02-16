import React, { useState, useEffect } from 'react';
import { X, Plus, Activity, RefreshCw, Loader2, ChevronDown, ChevronUp, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLayerAttributes } from '../../services/Server';

const PRESET_COLORS = [
    '#22c55e', '#ef4444', '#3b82f6', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#64748b'
];

const AnalysisCard = ({
    isOpen,
    onClose,
    visibleLayers,
    onRunAnalysis,
    onRefreshLayer,
    onUpdateStyle,
    currentFrameIndex: externalFrameIndex,
    isPlaying: externalIsPlaying,
    onPlaybackToggle,
    onFrameChange,
    onReset
}) => {
    const [selectedLayerId, setSelectedLayerId] = useState('');

    // Dynamic State
    const [selectedProperty, setSelectedProperty] = useState('');
    const [mappings, setMappings] = useState([{ value: '', color: PRESET_COLORS[0], operator: '=' }]);
    const [isPeriodic, setIsPeriodic] = useState(false);
    const [dateProperty, setDateProperty] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [attributes, setAttributes] = useState([]);
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
        // setIsFetchingAttributes(true);
        try {
            const attrs = await getLayerAttributes(activeLayer.fullName);
            setAttributes(attrs || []);
        } catch (error) {
            console.error("Error fetching attributes:", error);
            // toast.error("Failed to fetch layer attributes.");
        } finally {
            // setIsFetchingAttributes(false);
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
        <div
            className={`analysis-card ${isMinimized ? 'minimized' : ''}`}
            style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                width: '380px', // Match QueryBuilderCard width
                background: 'rgba(var(--color-bg-primary-rgb), 0.95)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-2xl), inset 0 0 0 1px rgba(var(--color-bg-primary-rgb), 0.05)',
                zIndex: 1001,
                userSelect: 'none',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                color: 'var(--color-text-primary)'
            }}
        >
            {/* Header */}
            <div style={{
                padding: '14px 18px',
                background: 'rgba(var(--color-bg-secondary-rgb, 200, 200, 200), 0.2)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        background: 'linear-gradient(135deg, var(--color-primary), #6366f1)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(var(--color-primary-rgb), 0.3)'
                    }}>
                        <Activity size={18} color="white" />
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '0.02em', color: 'var(--color-text-primary)' }}>
                            MAP ANALYSIS
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                            Dynamics
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {isMinimized ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    <button
                        onClick={onClose}
                        className="close-btn"
                        style={{ background: 'rgba(var(--color-danger-rgb, 239, 68, 68), 0.1)', border: 'none', color: 'var(--color-danger)', width: '28px', height: '28px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyItems: 'center', padding: '6px' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {/* Sliding Content */}
            <div style={{
                maxHeight: isMinimized ? '0' : '800px',
                opacity: isMinimized ? 0 : 1,
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                <div style={{ padding: '24px', paddingTop: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>



                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.4s ease' }}>

                            {/* Property Selection */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>CONDITION ATTRIBUTE</label>
                                <select
                                    value={selectedProperty}
                                    onChange={(e) => setSelectedProperty(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-bg-secondary)',
                                        color: 'var(--color-text-primary)',
                                        fontSize: '13px'
                                    }}
                                >
                                    <option value="" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>Select attribute...</option>
                                    {attributes.map(attr => (
                                        <option key={attr} value={attr} style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>{attr}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Mappings with Operators */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>VALUE MAPPINGS</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {mappings.map((m, index) => (
                                        <div key={index} style={{
                                            display: 'flex',
                                            gap: '6px',
                                            alignItems: 'center',
                                            background: 'var(--color-bg-tertiary)',
                                            padding: '6px',
                                            borderRadius: '14px',
                                            border: '1px solid var(--color-border)'
                                        }}>
                                            {/* Operator Dropdown */}
                                            <select
                                                value={m.operator || '='}
                                                onChange={(e) => updateMapping(index, { operator: e.target.value })}
                                                style={{
                                                    width: '60px',
                                                    padding: '8px 4px',
                                                    borderRadius: '10px',
                                                    border: 'none',
                                                    background: 'var(--color-primary)',
                                                    color: 'white',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    textAlign: 'center',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <option value="=" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>=</option>
                                                <option value="!=" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>≠</option>
                                                <option value=">" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>&gt;</option>
                                                <option value="<" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>&lt;</option>
                                                <option value=">=" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>≥</option>
                                                <option value="<=" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>≤</option>
                                                <option value="LIKE" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>LIKE</option>
                                            </select>
                                            {/* Value Input */}
                                            <input
                                                type="text"
                                                value={m.value}
                                                onChange={(e) => updateMapping(index, { value: e.target.value })}
                                                placeholder="Value..."
                                                style={{
                                                    flex: 1,
                                                    padding: '8px 12px',
                                                    borderRadius: '10px',
                                                    border: 'none',
                                                    background: 'var(--color-bg-secondary)',
                                                    color: 'var(--color-text-secondary)',
                                                    fontSize: '12px',
                                                    fontWeight: '600'
                                                }}
                                            />
                                            {/* Color Picker */}
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '8px',
                                                background: m.color,
                                                position: 'relative',
                                                overflow: 'hidden',
                                                border: '2px solid var(--color-border)',
                                                flexShrink: 0
                                            }}>
                                                <input
                                                    type="color"
                                                    value={m.color}
                                                    onChange={(e) => updateMapping(index, { color: e.target.value })}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '-5px',
                                                        left: '-5px',
                                                        width: '50px',
                                                        height: '50px',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        background: 'none'
                                                    }}
                                                />
                                            </div>
                                            {/* Remove Button */}
                                            {mappings.length > 1 && (
                                                <button
                                                    onClick={() => removeMapping(index)}
                                                    style={{ background: 'rgba(var(--color-danger-rgb), 0.1)', border: 'none', color: 'var(--color-danger)', padding: '8px', borderRadius: '10px', cursor: 'pointer', flexShrink: 0 }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={addMapping}
                                        style={{
                                            marginTop: '4px',
                                            padding: '10px',
                                            background: 'rgba(var(--color-primary-rgb), 0.1)',
                                            border: '1px dashed var(--color-primary)',
                                            borderRadius: '12px',
                                            color: 'var(--color-primary)',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Plus size={14} /> ADD CONDITION
                                    </button>
                                </div>
                            </div>

                            {/* Periodic Analysis Switch */}
                            <div style={{
                                background: 'var(--color-bg-secondary)',
                                borderRadius: '16px',
                                border: '1px solid var(--color-border)',
                                padding: '16px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isPeriodic ? '16px' : '0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Loader2 size={16} className={isPeriodic ? "animate-spin" : ""} color="var(--color-primary)" />
                                        <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Periodic Playback</label>
                                    </div>
                                    <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                                        <input
                                            type="checkbox"
                                            checked={isPeriodic}
                                            onChange={(e) => setIsPeriodic(e.target.checked)}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>

                                {isPeriodic && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'slideDown 0.3s ease-out' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)', marginLeft: '4px' }}>DATE FIELD</label>
                                            <select
                                                value={dateProperty}
                                                onChange={(e) => setDateProperty(e.target.value)}
                                                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', fontSize: '12px' }}
                                            >
                                                <option value="">Select Date...</option>
                                                {attributes.map(attr => (
                                                    <option key={attr} value={attr}>{attr}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)', marginLeft: '4px' }}>FROM</label>
                                                <select
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', fontSize: '12px' }}
                                                >
                                                    <option value="">Start...</option>
                                                    {uniqueDates.map(date => <option key={date} value={date}>{date}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)', marginLeft: '4px' }}>TO</label>
                                                <select
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', fontSize: '12px' }}
                                                >
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
                                    onClick={() => {
                                        setSelectedProperty('');
                                        setMappings([{ value: '', color: PRESET_COLORS[0], operator: '=' }]);
                                        setIsPeriodic(false);
                                        if (onReset) onReset();
                                    }}
                                    style={{ flex: 1, padding: '12px', borderRadius: '14px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <RefreshCw size={14} /> RESET
                                </button>
                                <button
                                    onClick={handleRunAnalysis}
                                    style={{ flex: 2, padding: '12px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, var(--color-primary), #6366f1)', color: 'var(--color-text-inverse)', fontSize: '12px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 8px 20px rgba(var(--color-primary-rgb), 0.3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                                >
                                    RUN ANALYSIS
                                </button>
                            </div>

                            {/* Playback Console (Only after running and if periodic) */}
                            {isPeriodic && filteredDates.length > 0 && (
                                <div style={{
                                    marginTop: '4px',
                                    padding: '18px',
                                    borderRadius: '20px',
                                    background: 'var(--color-bg-secondary)',
                                    border: '1px solid var(--color-border)',
                                    boxShadow: 'var(--shadow-lg)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
                                        <button
                                            onClick={() => onFrameChange(Math.max(0, externalFrameIndex - 1))}
                                            style={{ background: 'var(--color-bg-tertiary)', border: 'none', color: 'var(--color-text-primary)', width: '36px', height: '36px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <SkipBack size={18} fill="#fff" />
                                        </button>
                                        <button
                                            onClick={onPlaybackToggle}
                                            style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'var(--color-primary)', border: 'none', color: 'var(--color-text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 20px rgba(var(--color-primary-rgb), 0.4)' }}
                                        >
                                            {externalIsPlaying ? <Pause size={24} fill="#fff" /> : <Play size={24} fill="#fff" style={{ marginLeft: '4px' }} />}
                                        </button>
                                        <button
                                            onClick={() => onFrameChange(Math.min(filteredDates.length - 1, externalFrameIndex + 1))}
                                            style={{ background: 'var(--color-bg-tertiary)', border: 'none', color: 'var(--color-text-primary)', width: '36px', height: '36px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <SkipForward size={18} fill="#fff" />
                                        </button>
                                    </div>

                                    <div style={{ background: 'var(--color-bg-tertiary)', padding: '12px', borderRadius: '14px', border: '1px solid var(--color-border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '10px' }}>
                                            <span style={{ color: 'var(--color-primary)', fontWeight: '800', background: 'rgba(var(--color-primary-rgb), 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                                                {filteredDates[externalFrameIndex] || '---'}
                                            </span>
                                            <span style={{ color: 'var(--color-text-muted)', fontWeight: '700' }}>
                                                {externalFrameIndex + 1} / {filteredDates.length}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max={filteredDates.length > 0 ? filteredDates.length - 1 : 0}
                                            value={externalFrameIndex}
                                            onChange={(e) => onFrameChange(parseInt(e.target.value))}
                                            style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalysisCard;
