import { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { useMap } from '../context/MapContext';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import DragZoom from 'ol/interaction/DragZoom';
import { createRegularPolygon, createBox } from 'ol/interaction/Draw';
import { always } from 'ol/events/condition';
import { LineString, Point } from 'ol/geom';
import { styleFunction, modifyStyle, formatArea, formatLength, highlightStyleFunction } from '../utils/mapUtils';
import { DRAWING_SOLID_COLORS } from '../constants/AppConstants';

export const useDrawingTools = (saveWorkspaceCallback) => {
    const {
        mapInstanceRef,
        geoServerLayers,
        operationalLayersRef,
        isLocked,
        vectorSourceRef,
        selectionSourceRef
    } = useMap();

    // Use internal refs for highlight state if not provided by context
    // Actually highlight state is in GISMap.jsx and useLayerActions. 
    // Let's see if we should move highlight state to context too.
    const isHighlightAnimatingRef = useRef(false);
    const activeHighlightLayerIdRef = useRef(null);
    const [activeTool, setActiveTool] = useState(null);
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [measurementValue, setMeasurementValue] = useState('');
    const [hasDrawings, setHasDrawings] = useState(false);
    const [isDrawingVisible, setIsDrawingVisible] = useState(true);
    const [availableDrawings, setAvailableDrawings] = useState([]);

    const [showDrawingLabels, setShowDrawingLabels] = useState(() => {
        const saved = localStorage.getItem('showDrawingLabels');
        return saved === null ? false : saved === 'true';
    });



    const [measurementUnits, setMeasurementUnits] = useState(() => {
        return localStorage.getItem('measurementUnits') || 'kilometers';
    });

    const measurementUnitsRef = useRef(measurementUnits);
    const showDrawingLabelsRef = useRef(showDrawingLabels);

    const drawingColorIndexRef = useRef(0);
    const animationOffsetRef = useRef(0);
    const activeFeatureRef = useRef(null);
    const drawInteractionRef = useRef(null);
    const vectorLayerRef = useRef(null);
    const selectionLayerRef = useRef(null);

    const animationFrameRef = useRef(null);

    // Sync unit refs and trigger redraws
    useEffect(() => {
        measurementUnitsRef.current = measurementUnits;
        showDrawingLabelsRef.current = showDrawingLabels;
        if (saveWorkspaceCallback) saveWorkspaceCallback();

        if (vectorLayerRef.current) vectorLayerRef.current.changed();
        if (drawInteractionRef.current && drawInteractionRef.current.getOverlay) {
            drawInteractionRef.current.getOverlay().getSource().getFeatures().forEach(f => f.changed());
        }
        if (activeFeatureRef.current) {
            const geom = activeFeatureRef.current.getGeometry();
            if (geom) {
                const value = geom instanceof LineString ?
                    formatLength(geom, measurementUnits) :
                    formatArea(geom, measurementUnits);
                setMeasurementValue(value);
            }
        }
    }, [measurementUnits, showDrawingLabels, saveWorkspaceCallback]);

    const updateFeatureStatus = useCallback((source) => {
        const features = source.getFeatures();
        setHasDrawings(features.some(f => !f.get('isMeasurement')));

        const validDrawings = features
            .filter(f => !f.get('isMeasurement'))
            .map(f => {
                let id = f.getId();
                if (!id) {
                    id = `drawing-${Math.random().toString(36).substr(2, 9)}`;
                    f.setId(id);
                }
                return {
                    id: id,
                    type: f.getGeometry().getType(),
                    name: f.get('name') || `Drawing (${f.getGeometry().getType()})`,
                    color: f.get('drawingColor') || '#3b82f6'
                };
            });
        setAvailableDrawings(validDrawings);
    }, []);

    const updateBadge = useCallback((feature) => {
        if (!feature) return;
        const geom = feature.getGeometry();
        if (!geom) return;
        const value = geom.getType() === 'Circle' ?
            formatArea(geom, measurementUnitsRef.current) :
            (geom instanceof LineString ?
                formatLength(geom, measurementUnitsRef.current) :
                formatArea(geom, measurementUnitsRef.current));
        setMeasurementValue(value);
    }, []);

    const removeInteractions = useCallback(() => {
        if (!mapInstanceRef.current) return;
        const interactions = mapInstanceRef.current.getInteractions().getArray().slice();
        interactions.forEach((interaction) => {
            if (interaction instanceof Draw || interaction instanceof Modify || interaction instanceof Snap || interaction instanceof DragZoom) {
                mapInstanceRef.current.removeInteraction(interaction);
            }
        });
        drawInteractionRef.current = null;
        setIsMeasuring(false);
        setMeasurementValue('');
        activeFeatureRef.current = null;
    }, [mapInstanceRef]);

    const addDrawInteraction = useCallback((type) => {
        if (!mapInstanceRef.current || !vectorSourceRef.current || !type) return;
        removeInteractions();

        let drawType = type;
        let geometryFunction = undefined;
        let freehand = false;

        switch (type) {
            case 'Circle':
                drawType = 'Circle';
                geometryFunction = createRegularPolygon(64);
                break;
            case 'Triangle':
                drawType = 'Circle';
                geometryFunction = createRegularPolygon(3);
                break;
            case 'Extent':
                drawType = 'Circle';
                geometryFunction = createBox();
                break;
            case 'Ellipse':
                drawType = 'Circle';
                geometryFunction = createRegularPolygon(64);
                break;
            case 'FreehandLine':
                drawType = 'LineString';
                freehand = true;
                break;
            case 'FreehandPolygon':
                drawType = 'Polygon';
                freehand = true;
                break;
            default:
                drawType = type;
                break;
        }

        const draw = new Draw({
            source: vectorSourceRef.current,
            type: drawType,
            geometryFunction: geometryFunction,
            freehand: freehand,
            style: (feature) => styleFunction(feature, false, type, null, animationOffsetRef.current, measurementUnitsRef.current, showDrawingLabelsRef.current),
        });

        draw.on('drawstart', (evt) => {
            setIsMeasuring(true);
            setMeasurementValue('');
            const sketch = evt.feature;
            if (type === 'Circle') sketch.set('isCircle', true);
            activeFeatureRef.current = sketch;
            sketch.getGeometry().on('change', () => updateBadge(sketch));
        });

        draw.on('drawend', (evt) => {
            if (type === 'Circle') evt.feature.set('isCircle', true);
            if (!evt.feature.get('isMeasurement') && !evt.feature.get('drawingColor')) {
                const color = DRAWING_SOLID_COLORS[drawingColorIndexRef.current % DRAWING_SOLID_COLORS.length];
                drawingColorIndexRef.current += 1;
                evt.feature.set('drawingColor', color);
            }
            updateBadge(evt.feature);
            setIsMeasuring(false);
            activeFeatureRef.current = evt.feature;
        });

        drawInteractionRef.current = draw;
        mapInstanceRef.current.addInteraction(draw);

        if (type !== 'Point') {
            const modify = new Modify({ source: vectorSourceRef.current, style: modifyStyle });
            modify.on('modifystart', (evt) => {
                setIsMeasuring(true);
                const feature = evt.features.getArray()[0];
                if (feature) {
                    activeFeatureRef.current = feature;
                    feature.getGeometry().on('change', () => updateBadge(feature));
                }
            });
            modify.on('modifyend', (evt) => {
                setIsMeasuring(false);
                const feature = evt.features.getArray()[0];
                if (feature) updateBadge(feature);
            });
            mapInstanceRef.current.addInteraction(modify);
            mapInstanceRef.current.addInteraction(new Snap({ source: vectorSourceRef.current }));
        }
    }, [mapInstanceRef, removeInteractions, updateBadge]);

    const addZoomBoxInteraction = useCallback(() => {
        if (!mapInstanceRef.current) return;
        removeInteractions();

        const dragZoom = new DragZoom({
            condition: always,
            className: 'ol-dragzoom elite-zoom-box',
        });

        dragZoom.on('boxend', () => {
            setTimeout(() => {
                setActiveTool(null);
                removeInteractions();
            }, 500);
        });

        drawInteractionRef.current = dragZoom;
        mapInstanceRef.current.addInteraction(dragZoom);
    }, [mapInstanceRef, removeInteractions]);

    const handleClearDrawings = useCallback(() => {
        if (vectorSourceRef.current) {
            const features = vectorSourceRef.current.getFeatures();
            features.forEach(f => {
                if (!f.get('isMeasurement')) {
                    vectorSourceRef.current.removeFeature(f);
                }
            });
            setMeasurementValue('');
            setHasDrawings(false);
        }
    }, [vectorSourceRef]);

    const handleToolClick = useCallback((tool) => {
        removeInteractions();
        if (activeTool === tool) {
            setActiveTool(null);
        } else {
            setActiveTool(tool);
            if (tool === 'ZoomBox') {
                addZoomBoxInteraction();
            } else {
                addDrawInteraction(tool);
            }
        }
    }, [activeTool, removeInteractions, addZoomBoxInteraction, addDrawInteraction]);

    const resetTools = useCallback((setIsHighlightAnimating, setActiveHighlightLayerId, setActiveZoomLayerId) => {
        if (isHighlightAnimatingRef.current && activeHighlightLayerIdRef.current) {
            const olLayer = operationalLayersRef.current[activeHighlightLayerIdRef.current];
            const layerData = geoServerLayers.find(l => l.id === activeHighlightLayerIdRef.current);
            if (olLayer && layerData) olLayer.setOpacity(layerData.opacity || 1);
        }
        setActiveTool(null);
        if (setActiveZoomLayerId) setActiveZoomLayerId(null);
        if (setActiveHighlightLayerId) setActiveHighlightLayerId(null);
        if (setIsHighlightAnimating) setIsHighlightAnimating(false);
        removeInteractions();
    }, [geoServerLayers, operationalLayersRef, activeHighlightLayerIdRef, isHighlightAnimatingRef, removeInteractions]);

    // Handle initial map layer setup
    useEffect(() => {
        if (!mapInstanceRef.current || vectorLayerRef.current) return;

        const vectorSource = new VectorSource();
        vectorSourceRef.current = vectorSource;
        updateFeatureStatus(vectorSource);

        vectorSource.on(['addfeature', 'removefeature', 'changefeature'], () => {
            if (saveWorkspaceCallback) saveWorkspaceCallback();
            updateFeatureStatus(vectorSource);
        });

        const vectorLayer = new VectorLayer({
            source: vectorSource,
            style: (feature) => {
                const isMeasure = feature.get('isMeasurement');
                // Use a default show setting for drawing labels if not provided, or better pass it
                return styleFunction(feature, true, null, null, animationOffsetRef.current, measurementUnitsRef.current, showDrawingLabelsRef.current);
            },
            zIndex: 9999
        });
        vectorLayerRef.current = vectorLayer;

        const selectionSource = new VectorSource();
        selectionSourceRef.current = selectionSource;
        const selectionLayer = new VectorLayer({
            source: selectionSource,
            style: (feature) => highlightStyleFunction(feature, animationOffsetRef.current),
            zIndex: 10000
        });
        selectionLayerRef.current = selectionLayer;

        mapInstanceRef.current.addLayer(vectorLayer);
        mapInstanceRef.current.addLayer(selectionLayer);
    }, [mapInstanceRef, saveWorkspaceCallback, updateFeatureStatus]);

    // High performance animation loop
    useEffect(() => {
        const animate = () => {
            try {
                animationOffsetRef.current = (animationOffsetRef.current + 0.6) % 40;
                if (vectorLayerRef.current) vectorLayerRef.current.changed();
                if (selectionLayerRef.current) selectionLayerRef.current.changed();

                if (drawInteractionRef.current && typeof drawInteractionRef.current.getOverlay === 'function') {
                    const overlay = drawInteractionRef.current.getOverlay();
                    if (overlay) {
                        const overlaySource = overlay.getSource();
                        if (overlaySource) overlaySource.getFeatures().forEach(f => f.changed());
                    }
                }

                if (isHighlightAnimatingRef.current && activeHighlightLayerIdRef.current) {
                    const olLayer = operationalLayersRef.current[activeHighlightLayerIdRef.current];
                    if (olLayer) {
                        const time = Date.now() / 1000;
                        const waveOpacity = 0.65 + 0.35 * Math.sin(time * 3);
                        olLayer.setOpacity(waveOpacity);
                    }
                }
            } catch (err) {
                console.warn('Animation loop warning:', err);
            } finally {
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        };
        animationFrameRef.current = requestAnimationFrame(animate);
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [operationalLayersRef, isHighlightAnimatingRef, activeHighlightLayerIdRef]);

    useEffect(() => {
        if (vectorLayerRef.current) {
            vectorLayerRef.current.setVisible(isDrawingVisible);
        }
    }, [isDrawingVisible]);

    return {
        activeTool, setActiveTool,
        isMeasuring, measurementValue,
        hasDrawings,
        showDrawingLabels, setShowDrawingLabels,
        measurementUnits, setMeasurementUnits,
        isDrawingVisible, setIsDrawingVisible,
        availableDrawings,
        handleToolClick,
        handleClearDrawings, removeInteractions, resetTools,
        vectorSourceRef, selectionSourceRef, vectorLayerRef
    };
};


