import React, { useState, useEffect } from 'react';
import { X, Loader2, ChevronDown, ChevronUp, RefreshCw, MessageSquareShare, Zap, ChevronLeft, ChevronRight, Minimize2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLayerAttributes } from '../../services/Server';

const PRESET_COLORS = [
    '#22c55e', '#ef4444', '#3b82f6', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#64748b'
];

const getRandomColor = (exclude = null) => {
    const available = PRESET_COLORS.filter(c => c !== exclude);
    return available[Math.floor(Math.random() * available.length)];
};

const SpatialJoinCard = ({ isOpen, onClose, allGeoServerLayers = [], selectedLayerIds = [], onPerformSpatialJoin, onResetSpatialJoin, targetLayerId, isParentPanelMinimized = false, layoutMode = 'sidebar'
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
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
    const [joinType, setJoinType] = useState('union'); // 'union', 'left', 'right'
    const [matchColor, setMatchColor] = useState(() => getRandomColor());

    // Set Layer A when targetLayerId changes or on open
    useEffect(() => {
        if (isOpen && targetLayerId) {
            setLayerA(targetLayerId);
        }
    }, [isOpen, targetLayerId]);

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
    }, [layerA, layerB]);

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

    const selectedLayers = allGeoServerLayers.filter(l => (selectedLayerIds || []).includes(l.id));
    const layerAOptions = selectedLayers;
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
                layerA, attrA, layerB, attrB, colorA, colorB, joinType, matchColor
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
        <div className={`sj-panel-wrapper ${isMinimized ? 'sj-panel-minimized' : ''} ${isParentPanelMinimized ? 'sj-parent-panel-minimized' : ''} layout-${layoutMode}`}>
            {/* Floating Expand Button (shown only when minimized) */}
            {isMinimized && (
                <button
                    onClick={() => setIsMinimized(false)}
                    className="card-expand-float-btn card-expand-float-btn-spatial"
                    title="Expand Spatial Join"
                >
                    <Zap size={24} strokeWidth={2.5} />
                </button>
            )}

            {/* Main Card */}
            <div className="sj-card">
                {/* Header */}
                <div className="sj-header">
                    <div className="sj-header-left">
                        <div className="sj-header-icon">
                            <MessageSquareShare size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="sj-title">Spatial Join</h3>
                            <p className="sj-subtitle">Attribute Matching</p>
                        </div>
                    </div>
                    <div className="sj-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="card-minimize-btn"
                            title="Minimize"
                        >
                            <Minimize2 size={16} strokeWidth={2.5} />
                        </button>
                        <button onClick={onClose} className="sj-close-btn" title="Close">
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="sj-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {allGeoServerLayers.length < 2 ? (
                            <div className="qb-empty-state">
                                <div className="qb-empty-icon" style={{ background: '#fff7ed' }}>
                                    <MessageSquareShare size={28} color="#f97316" />
                                </div>
                                <p className="qb-empty-title">Insufficient Layers</p>
                                <p className="qb-empty-desc">Enable at least two layers to perform a spatial join.</p>
                            </div>
                        ) : (
                            <>
                                {/* Join Type Selection */}
                                <div className="qb-field-group">
                                    <label className="qb-field-label">Join Type</label>
                                    <select
                                        value={joinType}
                                        onChange={(e) => setJoinType(e.target.value)}
                                        className="qb-select"
                                    >
                                        <option value="union">Union Join</option>
                                        <option value="left">Left Join</option>
                                        <option value="right">Right Join</option>
                                    </select>
                                </div>

                                {/* Layer A (Target) */}
                                <div className="qb-condition-card-clean" style={{ borderLeftWidth: '4px', borderLeftColor: colorA }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colorA }} />
                                        <label className="qb-field-label" style={{ margin: 0 }}>Layer A (Target)</label>
                                    </div>
                                    <div className="qb-field-row">
                                        <div className="qb-field-group" style={{ flex: 1 }}>
                                            <label className="qb-field-label">Layer</label>
                                            <select
                                                value={layerA}
                                                onChange={(e) => setLayerA(e.target.value)}
                                                className="qb-select"
                                            >
                                                <option value="">Select layer...</option>
                                                {layerAOptions.map(l => (
                                                    <option key={l.id} value={l.id}>{l.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="qb-field-group" style={{ flex: 1 }}>
                                            <label className="qb-field-label">Attribute</label>
                                            <select
                                                value={attrA}
                                                onChange={(e) => setAttrA(e.target.value)}
                                                disabled={!layerA || attrsA.length === 0}
                                                className="qb-select"
                                            >
                                                <option value="">Select attr...</option>
                                                {attrsA.map(attr => (
                                                    <option key={attr} value={attr}>{attr}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    {joinType !== 'union' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: colorA, position: 'relative', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                                <input type="color" value={colorA} onChange={(e) => setColorA(e.target.value)} style={{ position: 'absolute', top: '-5px', left: '-5px', width: '40px', height: '40px', border: 'none', cursor: 'pointer', background: 'none' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '2px' }}>
                                                {PRESET_COLORS.slice(0, 5).map(c => (
                                                    <button key={c} onClick={() => setColorA(c)} style={{ width: '16px', height: '16px', borderRadius: '3px', background: c, border: 'none', cursor: 'pointer' }} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ flex: 1, height: '1px', background: 'var(--color-border)', opacity: 0.5 }} />
                                    <Zap size={14} color="#f97316" />
                                    <div style={{ flex: 1, height: '1px', background: 'var(--color-border)', opacity: 0.5 }} />
                                </div>

                                {/* Layer B (Source) */}
                                <div className="qb-condition-card-clean" style={{ borderLeftWidth: '4px', borderLeftColor: colorB }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colorB }} />
                                        <label className="qb-field-label" style={{ margin: 0 }}>Layer B (Source)</label>
                                    </div>
                                    <div className="qb-field-row">
                                        <div className="qb-field-group" style={{ flex: 1 }}>
                                            <label className="qb-field-label">Layer</label>
                                            <select
                                                value={layerB}
                                                onChange={(e) => setLayerB(e.target.value)}
                                                disabled={!layerA}
                                                className="qb-select"
                                            >
                                                <option value="">Select layer...</option>
                                                {layerBOptions.map(l => (
                                                    <option key={l.id} value={l.id}>{l.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="qb-field-group" style={{ flex: 1 }}>
                                            <label className="qb-field-label">Attribute</label>
                                            <select
                                                value={attrB}
                                                onChange={(e) => setAttrB(e.target.value)}
                                                disabled={!layerB || attrsB.length === 0}
                                                className="qb-select"
                                            >
                                                <option value="">Select attr...</option>
                                                {attrsB.map(attr => (
                                                    <option key={attr} value={attr}>{attr}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    {joinType !== 'union' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: colorB, position: 'relative', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                                <input type="color" value={colorB} onChange={(e) => setColorB(e.target.value)} style={{ position: 'absolute', top: '-5px', left: '-5px', width: '40px', height: '40px', border: 'none', cursor: 'pointer', background: 'none' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '2px' }}>
                                                {PRESET_COLORS.slice(0, 5).map(c => (
                                                    <button key={c} onClick={() => setColorB(c)} style={{ width: '16px', height: '16px', borderRadius: '3px', background: c, border: 'none', cursor: 'pointer' }} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Features Pattern (Union Join only) */}
                                {joinType === 'union' && (
                                    <div className="qb-condition-card-clean" style={{ borderLeftWidth: '4px', borderLeftColor: matchColor }}>
                                        <label className="qb-field-label">Features Pattern Color</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: matchColor, position: 'relative', overflow: 'hidden', border: '2px solid var(--color-border)' }}>
                                                <input type="color" value={matchColor} onChange={(e) => setMatchColor(e.target.value)} style={{ position: 'absolute', top: '-5px', left: '-5px', width: '50px', height: '50px', border: 'none', cursor: 'pointer', background: 'none' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {PRESET_COLORS.map(c => (
                                                    <button key={c} onClick={() => setMatchColor(c)} style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, border: matchColor === c ? '2px solid var(--color-text-primary)' : 'none', cursor: 'pointer', padding: 0 }} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                    <button onClick={handleReset} className="qb-reset-btn" style={{ flex: 1 }}>
                                        <RefreshCw size={14} /> <span>Reset</span>
                                    </button>
                                    <button
                                        onClick={handlePerformJoin}
                                        disabled={isJoining || !layerA || !layerB || !attrA || !attrB}
                                        className="qb-apply-btn"
                                        style={{
                                            flex: 2,
                                            background: (!layerA || !layerB || !attrA || !attrB) ? 'var(--color-bg-secondary)' : 'linear-gradient(135deg, #f97316, #ef4444)',
                                            color: (!layerA || !layerB || !attrA || !attrB) ? 'var(--color-text-muted)' : '#fff',
                                            boxShadow: (!layerA || !layerB || !attrA || !attrB) ? 'none' : '0 8px 20px rgba(249, 115, 22, 0.3)'
                                        }}
                                    >
                                        {isJoining ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                        <span>{isJoining ? 'Joining...' : 'Perform Join'}</span>
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
