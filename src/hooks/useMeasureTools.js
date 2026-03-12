import { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { useMap } from '../context/MapContext';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import { LineString } from 'ol/geom';
import { styleFunction, modifyStyle, formatArea, formatLength } from '../utils/mapUtils';

export const useMeasureTools = (saveWorkspaceCallback) => {
    const {
        mapInstanceRef,
        vectorSourceRef,
        vectorLayerRef
    } = useMap();

    const [activeMeasureTool, setActiveMeasureTool] = useState(null);
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [measurementValue, setMeasurementValue] = useState('');
    const [hasMeasurements, setHasMeasurements] = useState(false);

    const [showMeasureLabels, setShowMeasureLabels] = useState(() => {
        const saved = localStorage.getItem('showAnalysisLabels'); // Keeping key for compatibility or renamed
        return saved === null ? false : saved === 'true';
    });

    const [measurementUnits, setMeasurementUnits] = useState(() => {
        return localStorage.getItem('measurementUnits') || 'kilometers';
    });

    const measurementUnitsRef = useRef(measurementUnits);
    const showMeasureLabelsRef = useRef(showMeasureLabels);
    const drawInteractionRef = useRef(null);
    const activeFeatureRef = useRef(null);

    // Sync refs and trigger redraws
    useEffect(() => {
        measurementUnitsRef.current = measurementUnits;
        showMeasureLabelsRef.current = showMeasureLabels;
        localStorage.setItem('showAnalysisLabels', showMeasureLabels);
        localStorage.setItem('measurementUnits', measurementUnits);

        if (saveWorkspaceCallback) saveWorkspaceCallback();

        if (vectorLayerRef && vectorLayerRef.current) {
            vectorLayerRef.current.changed();
        }
    }, [measurementUnits, showMeasureLabels, saveWorkspaceCallback, vectorLayerRef]);

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

    const removeMeasureInteractions = useCallback(() => {
        if (!mapInstanceRef.current) return;
        const interactions = mapInstanceRef.current.getInteractions().getArray().slice();
        interactions.forEach((interaction) => {
            if (interaction instanceof Draw || interaction instanceof Modify || interaction instanceof Snap) {
                mapInstanceRef.current.removeInteraction(interaction);
            }
        });
        drawInteractionRef.current = null;
        setIsMeasuring(false);
        setMeasurementValue('');
        activeFeatureRef.current = null;
    }, [mapInstanceRef]);

    const addMeasureInteraction = useCallback((type) => {
        if (!mapInstanceRef.current || !vectorSourceRef.current || !type) return;
        removeMeasureInteractions();

        const drawType = type === 'distance' ? 'LineString' : 'Polygon';
        const activeTip = 'Click to continue drawing';
        const idleTip = 'Click to start measuring';
        let tip = idleTip;

        const draw = new Draw({
            source: vectorSourceRef.current,
            type: drawType,
            style: (feature) => styleFunction(feature, true, drawType, tip, 0, measurementUnitsRef.current, showMeasureLabelsRef.current),
        });

        drawInteractionRef.current = draw;
        mapInstanceRef.current.addInteraction(draw);

        const modify = new Modify({ source: vectorSourceRef.current, style: modifyStyle });
        mapInstanceRef.current.addInteraction(modify);
        const snap = new Snap({ source: vectorSourceRef.current });
        mapInstanceRef.current.addInteraction(snap);

        draw.on('drawstart', (evt) => {
            setIsMeasuring(true);
            setMeasurementValue('');
            modify.setActive(false);
            tip = activeTip;

            const sketch = evt.feature;
            activeFeatureRef.current = sketch;
            sketch.getGeometry().on('change', () => updateBadge(sketch));
        });

        draw.on('drawend', (evt) => {
            evt.feature.set('isMeasurement', true);
            modify.setActive(true);
            updateBadge(evt.feature);

            mapInstanceRef.current?.once('pointermove', () => modifyStyle.setGeometry(undefined));
            setIsMeasuring(false);
            tip = idleTip;
            activeFeatureRef.current = evt.feature;
            setHasMeasurements(true);
        });

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
    }, [mapInstanceRef, vectorSourceRef, removeMeasureInteractions, updateBadge]);

    const handleMeasureClick = useCallback((type) => {
        removeMeasureInteractions();
        if (activeMeasureTool === type) {
            setActiveMeasureTool(null);
        } else {
            setActiveMeasureTool(type);
            addMeasureInteraction(type);
        }
    }, [activeMeasureTool, removeMeasureInteractions, addMeasureInteraction]);

    const clearMeasurements = useCallback(() => {
        if (vectorSourceRef.current) {
            const features = vectorSourceRef.current.getFeatures();
            features.forEach(f => {
                if (f.get('isMeasurement')) {
                    vectorSourceRef.current.removeFeature(f);
                }
            });
            setMeasurementValue('');
            setHasMeasurements(false);
        }
    }, [vectorSourceRef]);

    return {
        activeMeasureTool, setActiveMeasureTool,
        isMeasuring, measurementValue,
        hasMeasurements,
        showMeasureLabels, setShowMeasureLabels,
        measurementUnits, setMeasurementUnits,
        handleMeasureClick,
        clearMeasurements,
        removeMeasureInteractions
    };
};
