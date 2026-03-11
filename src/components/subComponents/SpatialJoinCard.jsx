import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, ChevronDown, ChevronUp, RefreshCw, MessageSquareShare, Zap, Minimize2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLayerAttributes } from '../../services/Server';
import { PRESET_COLORS, GEOSERVER_URL, AUTH_HEADER } from '../../constants/AppConstants';

// OL Imports for internal logic
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';

const getRandomColor = (exclude = null) => {
    const available = PRESET_COLORS.filter(c => c !== exclude);
    return available[Math.floor(Math.random() * available.length)];
};

const SpatialJoinCard = ({
    isOpen,
    onClose,
    allGeoServerLayers = [],
    setGeoServerLayers,
    selectedLayerIds = [],
    mapInstance, // Pass the OL map instance directly
    targetLayerId,
    isParentPanelMinimized = false,
    layoutMode = 'sidebar'
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
    const [joinType, setJoinType] = useState('union');
    const [matchColor, setMatchColor] = useState(() => getRandomColor());

    // Internal Refs for Map Management (avoiding re-renders)
    const vectorLayersRef = useRef({});
    const wmsVisibilitiesRef = useRef({});

    // Set Layer A when targetLayerId changes
    useEffect(() => {
        if (isOpen && targetLayerId) setLayerA(targetLayerId);
    }, [isOpen, targetLayerId]);

    // Reset state and cleanup map when card is closed
    useEffect(() => {
        if (!isOpen) {
            handleReset();
            setLayerA('');
            setLayerB('');
            setAttrA('');
            setAttrB('');
            setJoinType('union');
            setIsMinimized(false);
        }
    }, [isOpen]);

    // Fetch attributes when layers transition
    useEffect(() => {
        if (layerA) fetchAttributes(layerA, 'A');
        else setAttrA('');
    }, [layerA]);

    useEffect(() => {
        if (layerB) fetchAttributes(layerB, 'B');
        else setAttrB('');
    }, [layerB]);

    const fetchAttributes = async (layerId, side) => {
        const layer = allGeoServerLayers.find(l => l.id === layerId);
        if (!layer) return;

        const setFetching = side === 'A' ? setIsFetchingA : setIsFetchingB;
        const setMap = side === 'A' ? setAttributesMapA : setAttributesMapB;
        const setAttr = side === 'A' ? setAttrA : setAttrB;
        const currentMap = side === 'A' ? attributesMapA : attributesMapB;

        if (currentMap[layerId]) {
            if (currentMap[layerId].length > 0) setAttr(currentMap[layerId][0]);
            return;
        }

        setFetching(true);
        try {
            const attrs = await getLayerAttributes(layer.fullName);
            const list = attrs || [];
            setMap(prev => ({ ...prev, [layerId]: list }));
            if (list.length > 0) setAttr(list[0]);
        } catch (err) {
            toast.error('Failed to fetch attributes');
        } finally {
            setFetching(false);
        }
    };

    const handlePerformJoin = async () => {
        if (!layerA || !layerB || !attrA || !attrB || !mapInstance) {
            toast.error('Please select layers and attributes');
            return;
        }

        setIsJoining(true);
        const toastId = toast.loading('Performing spatial join...');

        try {
            const layerAObj = allGeoServerLayers.find(l => l.id === layerA);
            const layerBObj = allGeoServerLayers.find(l => l.id === layerB);

            const fetchWFS = async (l) => {
                const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${l.fullName}&outputFormat=application/json&srsName=EPSG:3857`;
                const res = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
                return res.json();
            };

            const [geojsonA, geojsonB] = await Promise.all([fetchWFS(layerAObj), fetchWFS(layerBObj)]);

            // Hide original WMS layers
            [layerA, layerB].forEach(id => {
                const layer = allGeoServerLayers.find(l => l.id === id);
                if (layer) {
                    wmsVisibilitiesRef.current[id] = layer.visible;
                    setGeoServerLayers(prev => prev.map(l => l.id === id ? { ...l, visible: false } : l));
                }
            });

            // Cleanup previous join layers
            Object.values(vectorLayersRef.current).forEach(l => mapInstance.removeLayer(l));
            vectorLayersRef.current = {};

            const valuesA = new Set(geojsonA.features.map(f => String(f.properties?.[attrA] ?? '')));
            const valuesB = new Set(geojsonB.features.map(f => String(f.properties?.[attrB] ?? '')));

            const addLayer = (geojson, id, attr, matchSet, mainColor, altColor, showAll) => {
                const source = new VectorSource({ features: new GeoJSON().readFeatures(geojson) });
                const style = (feature) => {
                    const isMatch = matchSet.has(String(feature.get(attr) ?? ''));
                    if (!isMatch && !showAll) return null;
                    const color = isMatch ? mainColor : altColor;
                    if (!color) return null;
                    return new Style({
                        fill: new Fill({ color: color + 'b3' }),
                        stroke: new Stroke({ color: '#fff', width: 1.5 }),
                        image: new CircleStyle({ radius: 6, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 1 }) })
                    });
                };
                const layer = new VectorLayer({ source, style, zIndex: 1001 });
                mapInstance.addLayer(layer);
                vectorLayersRef.current[id] = layer;
            };

            if (joinType === 'union') addLayer(geojsonA, layerA, attrA, valuesB, matchColor, null, false);
            else if (joinType === 'left') addLayer(geojsonA, layerA, attrA, valuesB, colorB, colorA, true);
            else if (joinType === 'right') addLayer(geojsonB, layerB, attrB, valuesA, colorA, colorB, true);

            toast.success('Join complete!', { id: toastId });
        } catch (err) {
            toast.error('Join failed', { id: toastId });
        } finally {
            setIsJoining(false);
        }
    };

    const handleReset = () => {
        if (!mapInstance) return;

        // 1. Remove Join Layers
        Object.keys(vectorLayersRef.current).forEach(id => {
            mapInstance.removeLayer(vectorLayersRef.current[id]);
            const originalVisible = wmsVisibilitiesRef.current[id];
            if (originalVisible !== undefined) {
                setGeoServerLayers(prev => prev.map(l => l.id === id ? { ...l, visible: originalVisible } : l));
            }
        });

        vectorLayersRef.current = {};
        wmsVisibilitiesRef.current = {};
        setColorA(getRandomColor());
        setColorB(getRandomColor(colorA));
    };

    if (!isOpen) return null;

    const selectedLayers = allGeoServerLayers.filter(l => (selectedLayerIds || []).includes(l.id));

    return (
        <div className={`sj-panel-wrapper ${isMinimized ? 'sj-panel-minimized' : ''} ${isParentPanelMinimized ? 'sj-parent-panel-minimized' : ''} layout-${layoutMode}`}>
            {isMinimized && (
                <button onClick={() => setIsMinimized(false)} className="card-expand-float-btn card-expand-float-btn-spatial">
                    <Zap size={24} strokeWidth={2.5} />
                </button>
            )}

            <div className="sj-card">
                <div className="sj-header">
                    <div className="sj-header-left">
                        <div className="sj-header-icon"><MessageSquareShare size={16} strokeWidth={2.5} /></div>
                        <div>
                            <h3 className="sj-title">Spatial Join</h3>
                            <p className="sj-subtitle">Attribute Matching</p>
                        </div>
                    </div>
                    <div className="sj-header-actions">
                        <button onClick={() => setIsMinimized(true)} className="card-minimize-btn"><Minimize2 size={16} /></button>
                        <button onClick={onClose} className="sj-close-btn"><X size={16} /></button>
                    </div>
                </div>

                <div className="sj-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {allGeoServerLayers.length < 2 ? (
                            <div className="qb-empty-state">
                                <p className="qb-empty-desc">Enable at least two layers to perform a spatial join.</p>
                            </div>
                        ) : (
                            <>
                                <div className="qb-field-group">
                                    <label className="qb-field-label">Join Type</label>
                                    <select value={joinType} onChange={(e) => setJoinType(e.target.value)} className="qb-select">
                                        <option value="union">Union Join</option>
                                        <option value="left">Left Join</option>
                                        <option value="right">Right Join</option>
                                    </select>
                                </div>

                                {/* Target Layer A */}
                                <div className="qb-condition-card-clean" style={{ borderLeftColor: colorA }}>
                                    <label className="qb-field-label">Layer A (Target)</label>
                                    <div className="qb-field-row">
                                        <select value={layerA} onChange={(e) => setLayerA(e.target.value)} className="qb-select">
                                            <option value="">Select layer...</option>
                                            {selectedLayers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                        <select value={attrA} onChange={(e) => setAttrA(e.target.value)} disabled={!layerA} className="qb-select">
                                            <option value="">Select attr...</option>
                                            {(attributesMapA[layerA] || []).map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Source Layer B */}
                                <div className="qb-condition-card-clean" style={{ borderLeftColor: colorB }}>
                                    <label className="qb-field-label">Layer B (Source)</label>
                                    <div className="qb-field-row">
                                        <select value={layerB} onChange={(e) => setLayerB(e.target.value)} disabled={!layerA} className="qb-select">
                                            <option value="">Select layer...</option>
                                            {selectedLayers.filter(l => l.id !== layerA).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                        <select value={attrB} onChange={(e) => setAttrB(e.target.value)} disabled={!layerB} className="qb-select">
                                            <option value="">Select attr...</option>
                                            {(attributesMapB[layerB] || []).map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={handleReset} className="qb-reset-btn" style={{ flex: 1 }}><RefreshCw size={14} /> <span>Reset</span></button>
                                    <button onClick={handlePerformJoin} disabled={isJoining || !layerA || !layerB} className="qb-apply-btn" style={{ flex: 2 }}>
                                        {isJoining ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                        <span>Join</span>
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
