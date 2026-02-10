import React, { useState, useEffect } from 'react';
import { X, Loader2, ChevronDown, ChevronUp, RefreshCw, MessageSquareShare, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLayerAttributes } from '../../services/Server';

const PRESET_COLORS = [
    '#22c55e', '#ef4444', '#3b82f6', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#64748b'
];

const getRandomColor = (exclude = null) => {
    const available = PRESET_COLORS.filter(c => c !== exclude);
    return available[Math.floor(Math.random() * available.length)];
};

const SpatialJoinCard = ({
    isOpen,
    onClose,
    visibleLayers = [],
    allGeoServerLayers = [],
    onPerformSpatialJoin,
    onResetSpatialJoin
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [selectedLayerIds, setSelectedLayerIds] = useState([]);
    const [layerA, setLayerA] = useState('');
    const [layerB, setLayerB] = useState('');
    const [attrA, setAttrA] = useState('');
    const [attrB, setAttrB] = useState('');
    const [colorA, setColorA] = useState(() => getRandomColor());
    const [colorB, setColorB] = useState(() => getRandomColor(colorA));
    const [attributesMapA, setAttributesMapA] = useState({});
    const [attributesMapB, setAttributesMapB] = useState({});
    const [isFetchingA, setIsFetchingA] = useState(false);
    const [isFetchingB, setIsFetchingB] = useState(false);
    const [isJoining, setIsJoining] = useState(false);

    // Sync selected layers with visible layers on open
    useEffect(() => {
        if (isOpen && allGeoServerLayers.length > 0) {
            const visibleIds = allGeoServerLayers.filter(l => l.visible).map(l => l.id);
            if (selectedLayerIds.length === 0) {
                setSelectedLayerIds(visibleIds);
            }
        }
    }, [isOpen, allGeoServerLayers.length]);

    // Fetch attributes for Layer A when selected
    useEffect(() => {
        if (layerA) {
            fetchAttributes(layerA, 'A');
        } else {
            setAttrA('');
        }
    }, [layerA]);

    // Fetch attributes for Layer B when selected
    useEffect(() => {
        if (layerB) {
            fetchAttributes(layerB, 'B');
        } else {
            setAttrB('');
        }
    }, [layerB]);

    // If layerB becomes same as layerA, reset it
    useEffect(() => {
        if (layerB && layerB === layerA) {
            setLayerB('');
            setAttrB('');
        }
    }, [layerA]);

    const fetchAttributes = async (layerId, side) => {
        const layer = allGeoServerLayers.find(l => l.id === layerId);
        if (!layer) return;

        const setFetching = side === 'A' ? setIsFetchingA : setIsFetchingB;
        const setMap = side === 'A' ? setAttributesMapA : setAttributesMapB;
        const setAttr = side === 'A' ? setAttrA : setAttrB;
        const currentMap = side === 'A' ? attributesMapA : attributesMapB;

        // Cache check
        if (currentMap[layerId]) {
            if (currentMap[layerId].length > 0) {
                setAttr(currentMap[layerId][0]);
            }
            return;
        }

        setFetching(true);
        try {
            const attrs = await getLayerAttributes(layer.fullName);
            const attrList = attrs || [];
            setMap(prev => ({ ...prev, [layerId]: attrList }));
            if (attrList.length > 0) {
                setAttr(attrList[0]);
            }
        } catch (err) {
            console.error('Failed to fetch attributes:', err);
            toast.error('Failed to fetch layer attributes');
        } finally {
            setFetching(false);
        }
    };

    const toggleLayerSelection = (layerId) => {
        setSelectedLayerIds(prev =>
            prev.includes(layerId)
                ? prev.filter(id => id !== layerId)
                : [...prev, layerId]
        );
    };

    const toggleAllLayers = () => {
        if (selectedLayerIds.length === allGeoServerLayers.length) {
            setSelectedLayerIds([]);
        } else {
            setSelectedLayerIds(allGeoServerLayers.map(l => l.id));
        }
    };

    const selectedLayers = allGeoServerLayers.filter(l => selectedLayerIds.includes(l.id));
    const layerBOptions = selectedLayers.filter(l => l.id !== layerA);
    const attrsA = attributesMapA[layerA] || [];
    const attrsB = attributesMapB[layerB] || [];

    const handlePerformJoin = async () => {
        if (!layerA || !layerB || !attrA || !attrB) {
            toast.error('Please select both layers and attributes');
            return;
        }

        setIsJoining(true);
        try {
            await onPerformSpatialJoin({
                layerA, attrA, layerB, attrB, colorA, colorB
            });
        } catch (err) {
            console.error('Spatial join failed:', err);
        } finally {
            setIsJoining(false);
        }
    };

    const handleReset = () => {
        onResetSpatialJoin();
        setColorA(getRandomColor());
        setColorB(getRandomColor(colorA));
    };

    if (!isOpen) return null;

    return (
        <div className={`spatial-join-card ${isMinimized ? 'minimized' : ''}`} style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            width: '400px',
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
        }}>
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
                        background: 'linear-gradient(135deg, #f97316, #ef4444)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)'
                    }}>
                        <MessageSquareShare size={18} color="white" />
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '0.02em', color: 'var(--color-text-primary)' }}>
                            SPATIAL JOIN
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                            Attribute Matching
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        style={{
                            background: 'transparent', border: 'none', color: 'var(--color-text-muted)',
                            cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', transition: 'all 0.2s ease'
                        }}
                    >
                        {isMinimized ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(var(--color-danger-rgb, 239, 68, 68), 0.1)', border: 'none',
                            color: 'var(--color-danger)', width: '28px', height: '28px', borderRadius: '8px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyItems: 'center', padding: '6px'
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div style={{
                maxHeight: isMinimized ? '0' : '800px',
                opacity: isMinimized ? 0 : 1,
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                <div style={{ padding: '16px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Layer Switches */}
                        <div style={{
                            background: 'var(--color-bg-secondary)',
                            borderRadius: '12px',
                            border: '1px solid var(--color-border)',
                            padding: '12px',
                            maxHeight: '160px',
                            overflowY: 'auto'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                    AVAILABLE LAYERS
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)' }}>ALL</span>
                                    <label className="toggle-switch" style={{ transform: 'scale(0.7)' }}>
                                        <input
                                            type="checkbox"
                                            checked={allGeoServerLayers.length > 0 && selectedLayerIds.length === allGeoServerLayers.length}
                                            onChange={toggleAllLayers}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                            {allGeoServerLayers.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                                    No GeoServer layers available
                                </div>
                            ) : (
                                allGeoServerLayers.map(layer => (
                                    <div key={layer.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '6px 8px', borderRadius: '8px',
                                        background: selectedLayerIds.includes(layer.id)
                                            ? 'rgba(var(--color-primary-rgb), 0.08)' : 'transparent',
                                        transition: 'all 0.2s'
                                    }}>
                                        <span style={{
                                            fontSize: '12px', fontWeight: '600',
                                            color: selectedLayerIds.includes(layer.id) ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1
                                        }}>
                                            {layer.name}
                                        </span>
                                        <label className="toggle-switch" style={{ transform: 'scale(0.7)', flexShrink: 0 }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedLayerIds.includes(layer.id)}
                                                onChange={() => toggleLayerSelection(layer.id)}
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                ))
                            )}
                        </div>

                        {selectedLayers.length < 2 && (
                            <div style={{
                                textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)',
                                background: 'rgba(var(--color-bg-secondary-rgb), 0.3)',
                                borderRadius: '12px', border: '1px dashed var(--color-border)'
                            }}>
                                <MessageSquareShare size={24} style={{ opacity: 0.4, marginBottom: '8px' }} />
                                <p style={{ fontSize: '12px', fontWeight: '600' }}>Select at least 2 layers to perform a spatial join.</p>
                            </div>
                        )}

                        {selectedLayers.length >= 2 && (
                            <>
                                {/* Layer A */}
                                <div style={{
                                    background: 'rgba(var(--color-bg-secondary-rgb), 0.3)',
                                    padding: '14px', borderRadius: '12px',
                                    border: `2px solid ${colorA}30`
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <div style={{
                                            width: '10px', height: '10px', borderRadius: '50%',
                                            background: colorA, flexShrink: 0
                                        }} />
                                        <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            LAYER A
                                        </label>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>LAYER</label>
                                            <select
                                                value={layerA}
                                                onChange={(e) => setLayerA(e.target.value)}
                                                style={{
                                                    width: '100%', height: '34px',
                                                    background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                                                    borderRadius: '8px', color: 'var(--color-text-primary)',
                                                    fontSize: '12px', padding: '0 8px', outline: 'none', fontWeight: '600'
                                                }}
                                            >
                                                <option value="">Select layer...</option>
                                                {selectedLayers.map(l => (
                                                    <option key={l.id} value={l.id}>{l.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>ATTRIBUTE</label>
                                            {isFetchingA ? (
                                                <div style={{ height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                                                </div>
                                            ) : (
                                                <select
                                                    value={attrA}
                                                    onChange={(e) => setAttrA(e.target.value)}
                                                    disabled={!layerA || attrsA.length === 0}
                                                    style={{
                                                        width: '100%', height: '34px',
                                                        background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                                                        borderRadius: '8px', color: 'var(--color-text-primary)',
                                                        fontSize: '12px', padding: '0 8px', outline: 'none'
                                                    }}
                                                >
                                                    <option value="">Select attr...</option>
                                                    {attrsA.map(attr => (
                                                        <option key={attr} value={attr}>{attr}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                    {/* Color Picker */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)' }}>COLOR</label>
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '8px',
                                            background: colorA, position: 'relative', overflow: 'hidden',
                                            border: '2px solid var(--color-border)', flexShrink: 0, cursor: 'pointer'
                                        }}>
                                            <input
                                                type="color"
                                                value={colorA}
                                                onChange={(e) => setColorA(e.target.value)}
                                                style={{
                                                    position: 'absolute', top: '-5px', left: '-5px',
                                                    width: '50px', height: '50px', border: 'none',
                                                    cursor: 'pointer', background: 'none'
                                                }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            {PRESET_COLORS.slice(0, 6).map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setColorA(c)}
                                                    style={{
                                                        width: '18px', height: '18px', borderRadius: '4px',
                                                        background: c, border: colorA === c ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border)',
                                                        cursor: 'pointer', padding: 0, transition: 'all 0.15s'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* VS Divider */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                                    <span style={{
                                        fontSize: '11px', fontWeight: '800', color: 'var(--color-text-muted)',
                                        background: 'var(--color-bg-secondary)', padding: '4px 12px', borderRadius: '20px',
                                        border: '1px solid var(--color-border)', letterSpacing: '1px'
                                    }}>JOIN</span>
                                    <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                                </div>

                                {/* Layer B */}
                                <div style={{
                                    background: 'rgba(var(--color-bg-secondary-rgb), 0.3)',
                                    padding: '14px', borderRadius: '12px',
                                    border: `2px solid ${colorB}30`
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <div style={{
                                            width: '10px', height: '10px', borderRadius: '50%',
                                            background: colorB, flexShrink: 0
                                        }} />
                                        <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            LAYER B
                                        </label>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>LAYER</label>
                                            <select
                                                value={layerB}
                                                onChange={(e) => setLayerB(e.target.value)}
                                                disabled={!layerA}
                                                style={{
                                                    width: '100%', height: '34px',
                                                    background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                                                    borderRadius: '8px', color: 'var(--color-text-primary)',
                                                    fontSize: '12px', padding: '0 8px', outline: 'none', fontWeight: '600'
                                                }}
                                            >
                                                <option value="">Select layer...</option>
                                                {layerBOptions.map(l => (
                                                    <option key={l.id} value={l.id}>{l.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>ATTRIBUTE</label>
                                            {isFetchingB ? (
                                                <div style={{ height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                                                </div>
                                            ) : (
                                                <select
                                                    value={attrB}
                                                    onChange={(e) => setAttrB(e.target.value)}
                                                    disabled={!layerB || attrsB.length === 0}
                                                    style={{
                                                        width: '100%', height: '34px',
                                                        background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                                                        borderRadius: '8px', color: 'var(--color-text-primary)',
                                                        fontSize: '12px', padding: '0 8px', outline: 'none'
                                                    }}
                                                >
                                                    <option value="">Select attr...</option>
                                                    {attrsB.map(attr => (
                                                        <option key={attr} value={attr}>{attr}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                    {/* Color Picker */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)' }}>COLOR</label>
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '8px',
                                            background: colorB, position: 'relative', overflow: 'hidden',
                                            border: '2px solid var(--color-border)', flexShrink: 0, cursor: 'pointer'
                                        }}>
                                            <input
                                                type="color"
                                                value={colorB}
                                                onChange={(e) => setColorB(e.target.value)}
                                                style={{
                                                    position: 'absolute', top: '-5px', left: '-5px',
                                                    width: '50px', height: '50px', border: 'none',
                                                    cursor: 'pointer', background: 'none'
                                                }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            {PRESET_COLORS.slice(0, 6).map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setColorB(c)}
                                                    style={{
                                                        width: '18px', height: '18px', borderRadius: '4px',
                                                        background: c, border: colorB === c ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border)',
                                                        cursor: 'pointer', padding: 0, transition: 'all 0.15s'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={handleReset}
                                        style={{
                                            flex: 1, padding: '12px', borderRadius: '14px',
                                            border: '1px solid var(--color-border)',
                                            background: 'var(--color-bg-secondary)',
                                            color: 'var(--color-text-muted)', fontSize: '12px',
                                            fontWeight: '700', cursor: 'pointer', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', gap: '8px'
                                        }}
                                    >
                                        <RefreshCw size={14} /> RESET
                                    </button>
                                    <button
                                        onClick={handlePerformJoin}
                                        disabled={isJoining || !layerA || !layerB || !attrA || !attrB}
                                        style={{
                                            flex: 2, padding: '12px', borderRadius: '14px',
                                            border: 'none',
                                            background: (!layerA || !layerB || !attrA || !attrB)
                                                ? 'var(--color-bg-secondary)'
                                                : 'linear-gradient(135deg, #f97316, #ef4444)',
                                            color: (!layerA || !layerB || !attrA || !attrB)
                                                ? 'var(--color-text-muted)' : '#fff',
                                            fontSize: '12px', fontWeight: '800', cursor: isJoining ? 'not-allowed' : 'pointer',
                                            boxShadow: (!layerA || !layerB || !attrA || !attrB)
                                                ? 'none' : '0 8px 20px rgba(249, 115, 22, 0.3)',
                                            textTransform: 'uppercase', letterSpacing: '0.5px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            transition: 'all 0.3s'
                                        }}
                                    >
                                        {isJoining ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                        {isJoining ? 'JOINING...' : 'PERFORM JOIN'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SpatialJoinCard;
