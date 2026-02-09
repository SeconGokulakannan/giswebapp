import React, { useState, useEffect } from 'react';
import { X, Plus, FileChartPie, RefreshCw, Loader2, ChevronDown, ChevronUp, Play, Pause, Square, SkipBack, SkipForward } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLayerAttributes } from '../../services/Server';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement
);

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
    onFrameChange
}) => {
    const [selectedLayerId, setSelectedLayerId] = useState('');
    const [analysisMode, setAnalysisMode] = useState('dynamic'); // 'dynamic' or 'chart'

    // Dynamic State
    const [selectedProperty, setSelectedProperty] = useState('');
    const [mappings, setMappings] = useState([{ value: '', color: PRESET_COLORS[0] }]);

    // Chart State
    const [chartAttribute1, setChartAttribute1] = useState('');
    const [chartAttribute2, setChartAttribute2] = useState('');
    const [chartType, setChartType] = useState('bar');
    const [chartData, setChartData] = useState(null);
    const [isGeneratingChart, setIsGeneratingChart] = useState(false);
    const [isPeriodic, setIsPeriodic] = useState(false);
    const [dateProperty, setDateProperty] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [attributes, setAttributes] = useState([]);
    const [uniqueDates, setUniqueDates] = useState([]);
    const [isFetchingAttributes, setIsFetchingAttributes] = useState(false);
    const [isFetchingDates, setIsFetchingDates] = useState(false);
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
            setAttributes([]);
            setSelectedProperty('');
            setUniqueDates([]);
            setChartAttribute1('');
            setChartAttribute2('');
            setChartData(null);
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
        setIsFetchingAttributes(true);
        try {
            const attrs = await getLayerAttributes(activeLayer.fullName);
            setAttributes(attrs || []);
        } catch (error) {
            console.error("Error fetching attributes:", error);
            // toast.error("Failed to fetch layer attributes.");
        } finally {
            setIsFetchingAttributes(false);
        }
    };

    const handleGenerateChart = async () => {
        if (!selectedLayerId || !chartAttribute1) {
            toast.error('Please select at least Attribute 1.');
            return;
        }

        setIsGeneratingChart(true);

        try {
            // Fetch ALL features for this layer to aggregate on client side
            // Ideally this should be a WFS aggregation query, but WFS 1.1.0 aggregation is complex/server-dependent.
            // For reasonable datasets (<10k), client-side aggregation is acceptable.
            const url = `${activeLayer.url || '/geoserver'}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${activeLayer.fullName}&outputFormat=application/json&maxFeatures=5000`;
            const response = await fetch(url);
            const data = await response.json();
            const features = data.features || [];

            if (features.length === 0) {
                toast.error('No data found for this layer.');
                setChartData(null);
                return;
            }

            // Aggregate Data
            const aggregation = {};

            features.forEach(f => {
                const key = f.properties[chartAttribute1];
                if (key === undefined || key === null) return;

                const safeKey = String(key); // Ensure key is string

                if (!aggregation[safeKey]) {
                    aggregation[safeKey] = {
                        count: 0,
                        sum: 0
                    };
                }

                aggregation[safeKey].count += 1;

                if (chartAttribute2) {
                    const val = parseFloat(f.properties[chartAttribute2]);
                    if (!isNaN(val)) {
                        aggregation[safeKey].sum += val;
                    }
                }
            });

            // Prepare Chart Data
            const labels = Object.keys(aggregation);
            const values = labels.map(label => {
                if (chartAttribute2) {
                    return aggregation[label].sum;
                } else {
                    return aggregation[label].count;
                }
            });

            const dataset = {
                label: chartAttribute2 ? `Sum of ${chartAttribute2} by ${chartAttribute1}` : `Count by ${chartAttribute1}`,
                data: values,
                backgroundColor: PRESET_COLORS.map(c => `${c}CC`), // Add transparency
                borderColor: PRESET_COLORS,
                borderWidth: 1,
            };

            setChartData({
                labels: labels,
                datasets: [dataset]
            });

        } catch (error) {
            console.error("Chart generation failed:", error);
            toast.error("Failed to generate chart data.");
        } finally {
            setIsGeneratingChart(false);
        }
    };

    const fetchUniqueDates = async (prop) => {
        if (!activeLayer || !prop) return;
        setIsFetchingDates(true);
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
            setIsFetchingDates(false);
        }
    };

    useEffect(() => {
        if (isPeriodic && dateProperty) {
            fetchUniqueDates(dateProperty);
        }
    }, [isPeriodic, dateProperty]);

    const addMapping = () => {
        setMappings([...mappings, { value: '', color: PRESET_COLORS[mappings.length % PRESET_COLORS.length] }]);
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
        <div className={`analysis-card ${isMinimized ? 'minimized' : ''}`} style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            zIndex: 1000,
            width: '320px',
            background: 'rgba(var(--color-bg-primary-rgb), 0.90)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-xl)',
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                background: 'rgba(var(--color-bg-secondary-rgb), 0.3)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        padding: '6px',
                        background: 'rgba(var(--color-primary-rgb), 0.15)',
                        borderRadius: '8px',
                        color: 'var(--color-primary)'
                    }}>
                        <FileChartPie size={16} />
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '0.02em' }}>
                        {analysisMode === 'chart' ? 'CHART ANALYSIS' : 'DYNAMIC ANALYSIS'}
                    </div>
                    <div style={{ fontSize: '10px', opacity: 0.7, textTransform: 'uppercase' }}>
                        {analysisMode === 'chart' ? 'Data Visualization' : 'Attribute-Based Exploration'}
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
                <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                    {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                    <X size={16} />
                </button>
            </div>


            {/* Content */}
            {
                !isMinimized && (
                    <div style={{ padding: '16px', maxHeight: '500px', overflowY: 'auto' }}>

                        {/* Mode Tabs */}
                        <div style={{ display: 'flex', marginBottom: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
                            <button
                                onClick={() => setAnalysisMode('dynamic')}
                                style={{
                                    flex: 1,
                                    padding: '6px',
                                    border: 'none',
                                    background: analysisMode === 'dynamic' ? 'var(--color-primary)' : 'transparent',
                                    color: analysisMode === 'dynamic' ? '#fff' : 'var(--color-text-secondary)',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Map Analysis
                            </button>
                            <button
                                onClick={() => setAnalysisMode('chart')}
                                style={{
                                    flex: 1,
                                    padding: '6px',
                                    border: 'none',
                                    background: analysisMode === 'chart' ? 'var(--color-primary)' : 'transparent',
                                    color: analysisMode === 'chart' ? '#fff' : 'var(--color-text-secondary)',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Chart Analysis
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                            {selectedLayerId && analysisMode === 'dynamic' && (
                                <>
                                    {/* Property Selection */}
                                    <div className="input-group">
                                        <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block' }}>CONDITION ATTRIBUTE</label>
                                        <select
                                            value={selectedProperty}
                                            onChange={(e) => setSelectedProperty(e.target.value)}
                                            className="elite-select"
                                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(var(--color-bg-primary-rgb), 0.1)', color: 'inherit' }}
                                        >
                                            <option value="">Select an attribute...</option>
                                            {attributes.map(attr => (
                                                <option key={attr} value={attr}>{attr}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Mappings */}
                                    <div className="input-group">
                                        <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block' }}>VALUE MAPPINGS</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {mappings.map((m, index) => (
                                                <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <input
                                                        type="text"
                                                        value={m.value}
                                                        onChange={(e) => updateMapping(index, { value: e.target.value })}
                                                        placeholder="Attribute value..."
                                                        className="elite-input"
                                                        style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(var(--color-bg-primary-rgb), 0.1)', color: 'inherit', fontSize: '12px' }}
                                                    />
                                                    <input
                                                        type="color"
                                                        value={m.color}
                                                        onChange={(e) => updateMapping(index, { color: e.target.value })}
                                                        style={{ width: '32px', height: '32px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                                                    />
                                                    {mappings.length > 1 && (
                                                        <button
                                                            onClick={() => removeMapping(index)}
                                                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
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
                                                    padding: '8px',
                                                    background: 'rgba(var(--color-primary-rgb), 0.05)',
                                                    border: '1px dashed var(--color-primary)',
                                                    borderRadius: '8px',
                                                    color: 'var(--color-primary)',
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Plus size={14} /> Add Value
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ height: '1px', background: 'var(--color-border)', margin: '8px 0' }} />

                                    {/* Periodic Analysis */}
                                    <div className="input-group">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Periodic Analysis</label>
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
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', background: 'rgba(var(--color-primary-rgb), 0.05)', borderRadius: '12px', border: '1px solid rgba(var(--color-primary-rgb), 0.1)' }}>
                                                <div>
                                                    <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>DATE ATTRIBUTE</label>
                                                    <select
                                                        value={dateProperty}
                                                        onChange={(e) => setDateProperty(e.target.value)}
                                                        className="elite-select"
                                                        style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'inherit', fontSize: '12px' }}
                                                    >
                                                        <option value="">Select Date Field...</option>
                                                        {attributes.map(attr => (
                                                            <option key={attr} value={attr}>{attr}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                    <div>
                                                        <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>START DATE</label>
                                                        <select
                                                            value={startDate}
                                                            onChange={(e) => setStartDate(e.target.value)}
                                                            className="elite-select"
                                                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'inherit', fontSize: '12px' }}
                                                        >
                                                            <option value="">Start Date...</option>
                                                            {uniqueDates.map(date => (
                                                                <option key={date} value={date}>{date}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>END DATE</label>
                                                        <select
                                                            value={endDate}
                                                            onChange={(e) => setEndDate(e.target.value)}
                                                            className="elite-select"
                                                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'inherit', fontSize: '12px' }}
                                                        >
                                                            <option value="">End Date...</option>
                                                            {uniqueDates.map(date => (
                                                                <option key={date} value={date}>{date}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                        <button
                                            onClick={() => {
                                                setSelectedProperty('');
                                                setMappings([{ value: '', color: PRESET_COLORS[0] }]);
                                                setIsPeriodic(false);
                                            }}
                                            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                                        >
                                            <RefreshCw size={14} style={{ marginRight: '6px', display: 'inline' }} /> Reset
                                        </button>
                                        <button
                                            onClick={handleRunAnalysis}
                                            style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(var(--color-primary-rgb), 0.3)' }}
                                        >
                                            Run Analysis
                                        </button>
                                    </div>

                                    {/* Playback Control */}
                                    {isPeriodic && (
                                        <div style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--color-border)' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '12px', textAlign: 'center' }}>PLAYBACK CONTROL</div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                                                <button
                                                    onClick={() => onFrameChange(Math.max(0, externalFrameIndex - 1))}
                                                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                                                >
                                                    <SkipBack size={20} />
                                                </button>
                                                <button
                                                    onClick={onPlaybackToggle}
                                                    style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-primary)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                >
                                                    {externalIsPlaying ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" />}
                                                </button>
                                                <button
                                                    onClick={() => onFrameChange(Math.min(filteredDates.length - 1, externalFrameIndex + 1))}
                                                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                                                >
                                                    <SkipForward size={20} />
                                                </button>
                                            </div>

                                            <div style={{ marginTop: '16px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '8px', opacity: 0.8 }}>
                                                    <span style={{ color: 'var(--color-primary)', fontWeight: '700' }}>
                                                        {filteredDates[externalFrameIndex] || '---'}
                                                    </span>
                                                    <span style={{ opacity: 0.5 }}>
                                                        {externalFrameIndex + 1} / {filteredDates.length}
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max={filteredDates.length > 0 ? filteredDates.length - 1 : 0}
                                                    value={externalFrameIndex}
                                                    onChange={(e) => onFrameChange(parseInt(e.target.value))}
                                                    style={{ width: '100%', accentColor: 'var(--color-primary)', height: '4px' }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {selectedLayerId && analysisMode === 'chart' && (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {/* Attr 1 */}
                                        <div className="input-group" style={{ marginBottom: 0 }}>
                                            <label style={{ fontSize: '10px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>GROUP BY (X-AXIS)</label>
                                            <select
                                                value={chartAttribute1}
                                                onChange={(e) => setChartAttribute1(e.target.value)}
                                                className="elite-select"
                                                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(var(--color-bg-primary-rgb), 0.1)', color: 'inherit', fontSize: '12px' }}
                                            >
                                                <option value="">Select Categorical...</option>
                                                {attributes.map(attr => (
                                                    <option key={attr} value={attr}>{attr}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Attr 2 */}
                                        <div className="input-group" style={{ marginBottom: 0 }}>
                                            <label style={{ fontSize: '10px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>VALUE (Y-AXIS) [Optional]</label>
                                            <select
                                                value={chartAttribute2}
                                                onChange={(e) => setChartAttribute2(e.target.value)}
                                                className="elite-select"
                                                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(var(--color-bg-primary-rgb), 0.1)', color: 'inherit', fontSize: '12px' }}
                                            >
                                                <option value="">Count (Default)</option>
                                                {attributes.map(attr => (
                                                    <option key={attr} value={attr}>{attr}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Chart Type */}
                                    <div className="input-group">
                                        <label style={{ fontSize: '10px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>CHART TYPE</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {['bar', 'line', 'pie', 'doughnut'].map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => setChartType(type)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px',
                                                        borderRadius: '6px',
                                                        border: '1px solid var(--color-border)',
                                                        background: chartType === type ? 'rgba(var(--color-primary-rgb), 0.15)' : 'transparent',
                                                        color: chartType === type ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                                        fontSize: '11px',
                                                        textTransform: 'capitalize',
                                                        cursor: 'pointer',
                                                        fontWeight: chartType === type ? '700' : '500'
                                                    }}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleGenerateChart}
                                        disabled={isGeneratingChart}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '10px',
                                            border: 'none',
                                            background: 'var(--color-primary)',
                                            color: '#fff',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            cursor: isGeneratingChart ? 'not-allowed' : 'pointer',
                                            opacity: isGeneratingChart ? 0.7 : 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        {isGeneratingChart ? <Loader2 className="animate-spin" size={16} /> : <FileChartPie size={16} />}
                                        {isGeneratingChart ? 'Aggregating Data...' : 'Generate Chart'}
                                    </button>

                                    {chartData && (
                                        <div style={{
                                            marginTop: '16px',
                                            padding: '12px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: '12px',
                                            height: '220px',
                                            position: 'relative'
                                        }}>
                                            {chartType === 'bar' && <Bar data={chartData} options={{ maintainAspectRatio: false }} />}
                                            {chartType === 'line' && <Line data={chartData} options={{ maintainAspectRatio: false }} />}
                                            {chartType === 'pie' && <Pie data={chartData} options={{ maintainAspectRatio: false }} />}
                                            {chartType === 'doughnut' && <Doughnut data={chartData} options={{ maintainAspectRatio: false }} />}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default AnalysisCard;
