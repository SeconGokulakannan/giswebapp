import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import '../../styles/GISMap.css';
import '../../styles/responsive.css';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Draw, Modify, Snap, DragPan, DragZoom } from 'ol/interaction';
import { createRegularPolygon, createBox } from 'ol/interaction/Draw';
import { always } from 'ol/events/condition';
import { Stroke, Style, Circle as CircleStyle, Fill } from 'ol/style';
import Feature from 'ol/Feature';
import { fromLonLat, toLonLat } from 'ol/proj';
import { LineString, Point } from 'ol/geom';
import { defaults as defaultControls } from 'ol/control';
import GeoJSON from 'ol/format/GeoJSON';
import Graticule from 'ol/layer/Graticule';
import * as Tooltip from '@radix-ui/react-tooltip';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Sub-components
import MapHeader from '../subComponents/MapHeader';
import MapSidebar from '../subComponents/MapSidebar';
import MapPanel from '../subComponents/MapPanel';
import MapStatusBar from '../subComponents/MapStatusBar';

// Utils
import {
  style,
  modifyStyle,
  styleFunction,
  formatLength,
  formatArea,
} from '../../utils/mapUtils';

import {
  searchLocation,
  getGeoServerLayers,
  getWMSSourceParams
} from '../../services/Server';
import { GEOSERVER_URL, AUTH_HEADER } from '../../services/ServerCredentials';
import FeatureInfoCard from '../subcomponents/FeatureInfoCard';


function GISMap() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawInteractionRef = useRef(null);
  const vectorSourceRef = useRef(null);
  const vectorLayerRef = useRef(null);
  const graticuleRef = useRef(null);

  const [coordinates, setCoordinates] = useState({ lon: 0, lat: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(2);
  const [activeTool, setActiveTool] = useState(null);
  const [baseLayer, setBaseLayer] = useState('osm');
  const [measurementValue, setMeasurementValue] = useState('');
  const [activePanel, setActivePanel] = useState(null);
  const [theme, setTheme] = useState('light');
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [scale, setScale] = useState('0 km');
  const [gotoLat, setGotoLat] = useState('');
  const [gotoLon, setGotoLon] = useState('');
  const [isDrawingVisible, setIsDrawingVisible] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [hasDrawings, setHasDrawings] = useState(false);
  const [hasMeasurements, setHasMeasurements] = useState(false);
  const [showDrawingLabels, setShowDrawingLabels] = useState(() => {
    const saved = localStorage.getItem('showDrawingLabels');
    return saved === null ? false : saved === 'true'; // Default to false
  });
  const [showAnalysisLabels, setShowAnalysisLabels] = useState(() => {
    const saved = localStorage.getItem('showAnalysisLabels');
    return saved === null ? false : saved === 'true'; // Default to false
  });
  const [measurementUnits, setMeasurementUnits] = useState(() => {
    return localStorage.getItem('measurementUnits') || 'kilometers'; // Default to kilometers
  });
  const measurementUnitsRef = useRef(measurementUnits);
  const showDrawingLabelsRef = useRef(showDrawingLabels);
  const showAnalysisLabelsRef = useRef(showAnalysisLabels);
  const [printTitle, setPrintTitle] = useState('');
  const [printSubtitle, setPrintSubtitle] = useState('');
  const [printFileName, setPrintFileName] = useState('Map');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [geoServerLayers, setGeoServerLayers] = useState([]);
  const activeFeatureRef = useRef(null);
  const operationalLayersRef = useRef({}); // Track layer instances
  const [activeLayerTool, setActiveLayerTool] = useState(null);

  const [featureInfoResult, setFeatureInfoResult] = useState(null);
  const [featureInfoPosition, setFeatureInfoPosition] = useState(null);
  const activeLayerToolRef = useRef(activeLayerTool);
  const geoServerLayersRef = useRef(geoServerLayers);

  useEffect(() => {
    activeLayerToolRef.current = activeLayerTool;
    geoServerLayersRef.current = geoServerLayers;
  }, [activeLayerTool, geoServerLayers]);
  const saveWorkspace = () => {
    if (!vectorSourceRef.current || !mapInstanceRef.current) return;

    // Save Drawings
    const format = new GeoJSON();
    const features = vectorSourceRef.current.getFeatures();
    const json = format.writeFeatures(features);
    localStorage.setItem('gis_drawings', json);

    // Save Settings
    localStorage.setItem('measurementUnits', measurementUnitsRef.current);
    localStorage.setItem('showDrawingLabels', showDrawingLabelsRef.current);
    localStorage.setItem('showAnalysisLabels', showAnalysisLabelsRef.current);
    localStorage.setItem('theme', theme);

    // Save View State
    const view = mapInstanceRef.current.getView();
    localStorage.setItem('gis_view', JSON.stringify({
      center: view.getCenter(),
      zoom: view.getZoom()
    }));
  };

  // Sync unit ref and trigger redraw when state changes
  useEffect(() => {
    measurementUnitsRef.current = measurementUnits;
    showDrawingLabelsRef.current = showDrawingLabels;
    showAnalysisLabelsRef.current = showAnalysisLabels;
    saveWorkspace();

    // Refresh map labels instantly
    if (vectorLayerRef.current) {
      vectorLayerRef.current.changed();
    }

    // Refresh active interaction labels
    if (drawInteractionRef.current && drawInteractionRef.current.getOverlay) {
      drawInteractionRef.current.getOverlay().getSource().getFeatures().forEach(f => f.changed());
    }
    // Update dashboard badge value if measuring
    if (activeFeatureRef.current) {
      const geom = activeFeatureRef.current.getGeometry();
      const value = geom instanceof LineString ?
        formatLength(geom, measurementUnits) :
        formatArea(geom, measurementUnits);
      setMeasurementValue(value);
    }
  }, [measurementUnits, showDrawingLabels, showAnalysisLabels]);

  // ELITE: Debounced background save
  const saveTimeoutRef = useRef(null);
  const triggerAutoSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(saveWorkspace, 1000);
  };

  // Initialize theme from localStorage
  // Load GeoServer Layers on Mount
  useEffect(() => {
    const loadLayers = async () => {
      const layers = await getGeoServerLayers();
      // Take top 2 default layers as requested or any first 2
      const layerObjects = layers.map((name, index) => ({
        id: name,
        name: name.split(':').pop(), // Human readable name
        fullName: name,
        visible: index < 2, // Default first 2 to visible as requested
        opacity: 1, // Default opacity
        queryable: true // Default queryable
      }));
      setGeoServerLayers(layerObjects);
    };
    loadLayers();
  }, []);

  // Sync GeoServer Layers with Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    geoServerLayers.forEach(layer => {
      const existingLayer = operationalLayersRef.current[layer.id];

      if (layer.visible) {
        if (!existingLayer) {
          // Create and add layer
          const wmsLayer = new TileLayer({
            source: new TileWMS(getWMSSourceParams(layer.fullName)),
            zIndex: 5, // Above base maps, below vector
            opacity: layer.opacity,
            properties: { id: layer.id }
          });
          mapInstanceRef.current.addLayer(wmsLayer);
          operationalLayersRef.current[layer.id] = wmsLayer;
        } else {
          // Update existing properties if needed (e.g. opacity)
          existingLayer.setOpacity(layer.opacity);
        }
      } else if (!layer.visible && existingLayer) {
        // Remove layer
        mapInstanceRef.current.removeLayer(existingLayer);
        delete operationalLayersRef.current[layer.id];
      }
    });

    // Handle deletions if state array shrinks (not expected here but good practice)
    Object.keys(operationalLayersRef.current).forEach(id => {
      if (!geoServerLayers.find(l => l.id === id)) {
        mapInstanceRef.current.removeLayer(operationalLayersRef.current[id]);
        delete operationalLayersRef.current[id];
      }
    });
  }, [geoServerLayers]);

  const handleToggleGeoLayer = (layerId) => {
    setGeoServerLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    ));
  };

  const handleToggleLayerQuery = (layerId) => {
    setGeoServerLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, queryable: !l.queryable } : l
    ));
  };

  const handleToggleAllLayers = (turnOn) => {
    setGeoServerLayers(prev => prev.map(l => ({ ...l, visible: turnOn })));
  };

  const handleLayerOpacityChange = (layerId, newOpacity) => {
    setGeoServerLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, opacity: parseFloat(newOpacity) } : l
    ));
  };

  const handleZoomToLayer = async (layerId) => {
    if (!mapInstanceRef.current) return;
    const layer = geoServerLayers.find(l => l.id === layerId);
    if (!layer) return;

    try {
      const bbox = await getLayerBBox(layer.fullName);
      if (bbox) {
        // [minx, miny, maxx, maxy] - OpenLayers expects [minx, miny, maxx, maxy]
        // We need to transform from EPSG:4326 to View Projection (EPSG:3857)
        const extent = [
          ...fromLonLat([bbox[0], bbox[1]]),
          ...fromLonLat([bbox[2], bbox[3]])
        ];
        mapInstanceRef.current.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          maxZoom: 16,
          duration: 1000
        });
      } else {
        alert('Layer extent not available.');
      }
    } catch (err) {
      console.error('Zoom error:', err);
    }
  };

  // Elite: Automatic Tool Deactivation
  useEffect(() => {
    // If we move away from 'tools' or 'utility_tools' (analysis),
    // or close the panel entirely, we should deactivate the tools.
    if (activePanel !== 'tools' && activePanel !== 'utility_tools') {
      // Small delay to prevent race conditions during state transitions
      const timer = setTimeout(() => {
        if (activeTool) {
          setActiveTool(null);
          removeInteractions();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activePanel]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    setTimeout(saveWorkspace, 0); // Fast save preference
  };

  // Update feature status based on vector source
  const updateFeatureStatus = (source) => {
    if (!source) return;
    const features = source.getFeatures();
    const drawings = features.some(f => !f.get('isMeasurement'));
    const measurements = features.some(f => f.get('isMeasurement'));
    setHasDrawings(drawings);
    setHasMeasurements(measurements);
  };



  // ELITE ANIMATION: Energy Flow & Sonar
  const animationOffsetRef = useRef(0);
  const animationFrameRef = useRef(null);

  // High-performance animation loop (Non-blocking)
  useEffect(() => {
    const animate = () => {
      try {
        animationOffsetRef.current = (animationOffsetRef.current + 0.8) % 30;

        // Trigger map redraw without React re-render
        if (vectorLayerRef.current) {
          vectorLayerRef.current.changed();
        }

        // Also animate interactions if active and supported
        if (drawInteractionRef.current && typeof drawInteractionRef.current.getOverlay === 'function') {
          const overlay = drawInteractionRef.current.getOverlay();
          if (overlay) {
            const overlaySource = overlay.getSource();
            if (overlaySource) {
              overlaySource.getFeatures().forEach((f) => f.changed());
            }
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
  }, []);

  // Sync Drawing Layer Visibility
  useEffect(() => {
    if (vectorLayerRef.current) {
      vectorLayerRef.current.setVisible(isDrawingVisible);
    }
  }, [isDrawingVisible]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;

    // Load saved drawings
    const savedDrawings = localStorage.getItem('gis_drawings');
    if (savedDrawings) {
      try {
        const format = new GeoJSON();
        const features = format.readFeatures(savedDrawings);
        vectorSource.addFeatures(features);
      } catch (err) {
        console.error('Error loading drawings:', err);
      }
    }

    // Initial status update
    updateFeatureStatus(vectorSource);

    // Auto-save triggers
    vectorSource.on(['addfeature', 'removefeature', 'changefeature'], () => {
      triggerAutoSave();
      updateFeatureStatus(vectorSource);
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: (feature) => {
        const isMeasurement = feature.get('isMeasurement');
        const show = isMeasurement ? showAnalysisLabelsRef.current : showDrawingLabelsRef.current;
        return styleFunction(feature, true, null, null, animationOffsetRef.current, measurementUnitsRef.current, show);
      },
    });
    vectorLayerRef.current = vectorLayer;

    const osmLayer = new TileLayer({
      source: new OSM(),
      visible: true,
    });

    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 19,
      }),
      visible: false,
    });

    const terrainLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 19,
      }),
      visible: false,
    });

    const darkLayer = new TileLayer({
      source: new XYZ({
        url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        maxZoom: 20,
      }),
      visible: false,
    });

    const lightLayer = new TileLayer({
      source: new XYZ({
        url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        maxZoom: 20,
      }),
      visible: false,
    });

    const streetLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 19,
      }),
      visible: false,
    });

    const graticule = new Graticule({
      strokeStyle: new Stroke({
        color: 'rgba(52, 125, 235, 0.4)',
        width: 1,
        lineDash: [0.5, 4],
      }),
      showLabels: true,
      wrapX: true,
      visible: false,
    });
    graticuleRef.current = graticule;

    // Load saved view state
    const savedView = JSON.parse(localStorage.getItem('gis_view') || 'null');

    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer, satelliteLayer, terrainLayer, darkLayer, lightLayer, streetLayer, graticule, vectorLayer],
      view: new View({
        center: savedView ? savedView.center : fromLonLat([0, 20]),
        zoom: savedView ? savedView.zoom : 2,
      }),
      controls: defaultControls({ attribution: false, zoom: false, rotate: false }),
    });

    vectorLayerRef.current = vectorLayer;
    mapInstanceRef.current = map;
    map.baseLayers = {
      osm: osmLayer,
      satellite: satelliteLayer,
      terrain: terrainLayer,
      dark: darkLayer,
      light: lightLayer,
      street: streetLayer,
    };

    // ELITE INTERACTION: Sonar Ripple on Click
    map.on('click', async (evt) => {
      const pixel = map.getPixelFromCoordinate(evt.coordinate);

      if (activeLayerToolRef.current === 'info') {
        const view = map.getView();
        const viewResolution = view.getResolution();
        const projection = view.getProjection();
        const visibleLayers = geoServerLayersRef.current.filter(l => l.visible && l.queryable);

        if (visibleLayers.length === 0) {
          setFeatureInfoResult([]);
          setFeatureInfoPosition({ x: pixel[0], y: pixel[1] });
          return;
        }

        const fetchPromises = visibleLayers.map(async (layer) => {
          const existingLayer = operationalLayersRef.current[layer.id];
          if (!existingLayer) return null;

          const source = existingLayer.getSource();
          const url = source.getFeatureInfoUrl(
            evt.coordinate,
            viewResolution,
            projection,
            { 'INFO_FORMAT': 'application/json' }
          );

          if (url) {
            try {
              const res = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
              const data = await res.json();
              return {
                layerName: layer.name,
                features: data.features
              };
            } catch (err) {
              console.error("Error fetching feature info", err);
              return { layerName: layer.name, features: [] };
            }
          }
          return null;
        });

        const results = await Promise.all(fetchPromises);
        const validResults = results.filter(r => r && r.features && r.features.length > 0);
        setFeatureInfoResult(validResults);
        setFeatureInfoPosition({ x: pixel[0], y: pixel[1] });

      } else {
        const ripple = document.createElement('div');
        ripple.className = 'sonar-ripple';
        ripple.style.left = `${pixel[0]}px`;
        ripple.style.top = `${pixel[1]}px`;
        mapRef.current.appendChild(ripple);
        setTimeout(() => ripple.remove(), 1000);
      }
    });

    // We will attach the click listener separately or use a consistent ref pattern.
    // Let's use a separate useEffect for the click listener that depends on activeLayerTool to avoid stale closures,
    // OR use refs. Given the size of GISMap, refs are safer for existing structure.

    // Changing approach: Use a separate useEffect for click handling to keep closure fresh.

    /* 
       Existing click listener was:
       map.on('click', (evt) => {
         const pixel = map.getPixelFromCoordinate(evt.coordinate);
         const ripple = document.createElement('div');
         ...
       });
    */


    map.on('pointermove', (evt) => {
      const lonLat = toLonLat(evt.coordinate);
      setCoordinates({
        lon: parseFloat(lonLat[0].toFixed(6)),
        lat: parseFloat(lonLat[1].toFixed(6)),
      });
      setMousePosition({ x: evt.pixel[0], y: evt.pixel[1] });
    });

    map.getView().on(['change:resolution', 'change:center'], () => {
      const currentZoom = map.getView().getZoom() || 0;
      setZoom(parseFloat(currentZoom.toFixed(2)));
      triggerAutoSave(); // Save view state on movement

      // Calculate scale
      const resolution = map.getView().getResolution() || 0;
      const units = map.getView().getProjection().getUnits();
      const dpi = 25.4 / 0.28;
      const mpu = units === 'degrees' ? 111320 : 1;
      const scaleValue = resolution * mpu * 39.37 * dpi;

      if (scaleValue > 1000) {
        setScale(`${(scaleValue / 1000).toFixed(1)} km`);
      } else {
        setScale(`${scaleValue.toFixed(0)} m`);
      }
    });

    return () => map.setTarget(undefined);
  }, []); // Fixed: No measurementUnits dependency

  // Sync Graticule Visibility
  useEffect(() => {
    if (graticuleRef.current) {
      graticuleRef.current.setVisible(showGrid);
    }
  }, [showGrid]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const layers = mapInstanceRef.current.baseLayers;
    Object.keys(layers).forEach((key) => layers[key].setVisible(key === baseLayer));
  }, [baseLayer]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const interactions = mapInstanceRef.current.getInteractions();
    interactions.forEach((interaction) => {
      if (interaction instanceof DragPan) {
        interaction.setActive(!isLocked && activeTool !== 'ZoomBox');
      }
    });
  }, [isLocked, activeTool]);

  const updateBadge = (feature) => {
    if (!feature) return;
    const geom = feature.getGeometry();
    if (!geom) return;
    const value = geom.getType() === 'Circle' ?
      formatArea(geom, measurementUnitsRef.current) :
      (geom instanceof LineString ?
        formatLength(geom, measurementUnitsRef.current) :
        formatArea(geom, measurementUnitsRef.current));
    setMeasurementValue(value);
  };

  const addDrawInteraction = (type) => {
    if (!mapInstanceRef.current || !vectorSourceRef.current || !type) return;
    removeInteractions();

    // Determine the OpenLayers draw type and geometry function
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
        // Ellipse is simulated with a 64-sided polygon (same as circle for now)
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
      if (type === 'Circle') {
        sketch.set('isCircle', true);
      }
      activeFeatureRef.current = sketch;
      sketch.getGeometry().on('change', () => updateBadge(sketch));
    });

    draw.on('drawend', (evt) => {
      if (type === 'Circle') {
        evt.feature.set('isCircle', true);
      }
      updateBadge(evt.feature);
      setIsMeasuring(false);
      activeFeatureRef.current = evt.feature;
    });

    drawInteractionRef.current = draw;
    mapInstanceRef.current.addInteraction(draw);

    // Only add modify and snap if not just a point
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
        if (feature) {
          updateBadge(feature);
        }
      });

      mapInstanceRef.current.addInteraction(modify);
      mapInstanceRef.current.addInteraction(new Snap({ source: vectorSourceRef.current }));
    }
  };

  const addZoomBoxInteraction = () => {
    if (!mapInstanceRef.current) return;
    removeInteractions();

    const dragZoom = new DragZoom({
      condition: always,
      className: 'ol-dragzoom elite-zoom-box',
    });

    // Elite touch: Revert to pan mode after zooming
    dragZoom.on('boxend', () => {
      setTimeout(() => {
        setActiveTool(null);
        removeInteractions();
      }, 500);
    });

    drawInteractionRef.current = dragZoom;
    mapInstanceRef.current.addInteraction(dragZoom);
  };

  const addMeasureInteraction = (type) => {
    if (!mapInstanceRef.current || !vectorSourceRef.current || !type) return;
    removeInteractions();

    const drawType = type === 'distance' ? 'LineString' : 'Polygon';
    const activeTip = 'Click to continue drawing';
    const idleTip = 'Click to start measuring';
    let tip = idleTip;

    const draw = new Draw({
      source: vectorSourceRef.current,
      type: drawType,
      style: (feature) => {
        return styleFunction(feature, true, drawType, tip, animationOffsetRef.current, measurementUnitsRef.current, showAnalysisLabelsRef.current);
      },
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

      mapInstanceRef.current?.once('pointermove', function () {
        modifyStyle.setGeometry(undefined);
      });
      setIsMeasuring(false);
      tip = idleTip;
      activeFeatureRef.current = evt.feature;
    });

    // Elite: Real-time update during modification
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
      if (feature) {
        updateBadge(feature);
      }
    });
  };

  const removeInteractions = () => {
    if (!mapInstanceRef.current) return;
    const interactions = mapInstanceRef.current.getInteractions().getArray().slice();
    interactions.forEach((interaction) => {
      if (interaction instanceof Draw || interaction instanceof Modify || interaction instanceof Snap || interaction instanceof DragZoom) {
        mapInstanceRef.current.removeInteraction(interaction);
      }
    });
    drawInteractionRef.current = null;

    // Reset measurement states
    setIsMeasuring(false);
    setMeasurementValue('');
    activeFeatureRef.current = null;
  };

  const resetTools = () => {
    setActiveTool(null);
    removeInteractions();
  };

  const handleToolClick = (tool) => {
    removeInteractions(); // Reset current operations
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
  };

  const handleGoToLocation = () => {
    if (!mapInstanceRef.current) return;
    const lat = parseFloat(gotoLat);
    const lon = parseFloat(gotoLon);

    if (isNaN(lat) || isNaN(lon)) {
      alert('Please enter valid coordinates');
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      alert('Coordinates out of range (Lat: -90 to 90, Lon: -180 to 180)');
      return;
    }

    mapInstanceRef.current.getView().animate({
      center: fromLonLat([lon, lat]),
      zoom: 12,
      duration: 1000,
    });

    setActiveTool(null);
    removeInteractions();
  };

  const handleMeasureClick = (type) => {
    removeInteractions(); // Reset current operations
    if (activeTool === type) {
      setActiveTool(null);
    } else {
      setActiveTool(type);
      addMeasureInteraction(type);
    }
  };

  const handleClearDrawings = () => {
    if (vectorSourceRef.current) {
      vectorSourceRef.current.clear();
      setMeasurementValue('');
      setHasDrawings(false);
      setHasMeasurements(false);
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      const view = mapInstanceRef.current.getView();
      view.animate({ zoom: view.getZoom() + 1, duration: 250 });
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      const view = mapInstanceRef.current.getView();
      view.animate({ zoom: view.getZoom() - 1, duration: 250 });
    }
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleSearch = async (query) => {
    if (!mapInstanceRef.current || !query) return;

    const result = await searchLocation(query);
    if (result) {
      const view = mapInstanceRef.current.getView();

      // Elite fly-to animation
      view.animate({
        center: fromLonLat([result.lon, result.lat]),
        duration: 2000,
        zoom: 14,
      });

      setActiveTool(null);
      removeInteractions();

      return true;
    }
    return false;
  };

  const handleLocateMe = () => {
    if (!mapInstanceRef.current) return;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const view = mapInstanceRef.current.getView();

          // Animate to user's location
          view.animate({
            center: fromLonLat([longitude, latitude]),
            zoom: 16,
            duration: 1500,
          });

          // Add a temporary marker at user's location
          const userLocationFeature = new Feature({
            geometry: new Point(fromLonLat([longitude, latitude])),
            name: 'My Location',
          });

          // Style for location marker
          const locationStyle = new Style({
            image: new CircleStyle({
              radius: 8,
              fill: new Fill({ color: '#10b981' }),
              stroke: new Stroke({ color: 'white', width: 3 }),
            }),
          });

          userLocationFeature.setStyle(locationStyle);
          vectorSourceRef.current.addFeature(userLocationFeature);

          // Remove the marker after 3 seconds
          setTimeout(() => {
            vectorSourceRef.current.removeFeature(userLocationFeature);
          }, 3000);
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Unable to retrieve your location. Please check your browser permissions.');
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  const handlePrintClick = () => {
    setActivePanel(activePanel === 'print' ? null : 'print');
    setIsPanelMinimized(false);
  };

  const handleExportMap = async () => {
    if (!mapRef.current) return;

    try {
      // Capture the map container
      const canvas = await html2canvas(mapRef.current, {
        useCORS: true,
        backgroundColor: theme === 'dark' ? '#111' : '#fff'
      });

      const fileName = printFileName || 'Map';
      const fullFileName = fileName.toLowerCase().endsWith(`.${exportFormat}`) ? fileName : `${fileName}.${exportFormat}`;

      if (exportFormat === 'pdf') {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // Calculate image dimensions to fit page (maintaining aspect ratio)
        const imgProps = pdf.getImageProperties(imgData);
        const imgWidth = pdfWidth - 20; // 10mm margin on each side
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

        // Header Section
        pdf.setFillColor(theme === 'dark' ? 20 : 245);
        pdf.rect(0, 0, pdfWidth, 40, 'F');

        // Title
        pdf.setTextColor(theme === 'dark' ? 255 : 33);
        pdf.setFontSize(22);
        pdf.text(printTitle || 'GIS Map Export', 10, 20);

        // Subtitle
        pdf.setFontSize(12);
        pdf.setTextColor(theme === 'dark' ? 180 : 100);
        pdf.text(printSubtitle || `Generated on ${new Date().toLocaleString()}`, 10, 30);

        // The Map Image
        pdf.addImage(imgData, 'PNG', 10, 45, imgWidth, imgHeight);

        // Footer
        pdf.setFontSize(10);
        pdf.setTextColor(150);
        pdf.text('Generated via CAMS GIS Workspace', 10, pdfHeight - 10);

        pdf.save(fullFileName);
      } else {
        // Image formats (PNG/JPG)
        const link = document.createElement('a');
        link.download = fullFileName;
        link.href = canvas.toDataURL(`image/${exportFormat === 'jpg' ? 'jpeg' : 'png'}`);
        link.click();
      }

      alert('Map exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to generate export. Please try again.');
    }
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="app">
        <MapHeader
          activePanel={activePanel}
          setActivePanel={(panel) => {
            setActivePanel(panel);
            // Only deactivate tools if explicitly switching to a different non-tool panel region
            if (panel !== null && panel !== 'tools' && panel !== 'utility_tools' && panel !== 'print') {
              setActiveTool(null);
              removeInteractions();
            }
          }}
          setIsPanelMinimized={setIsPanelMinimized}
          toggleTheme={toggleTheme}
          theme={theme}
          handleClearDrawings={handleClearDrawings}
          handlePrintClick={handlePrintClick}
          isLocked={isLocked}
          setIsLocked={setIsLocked}
          activeTool={activeTool}
          handleToolClick={handleToolClick}
          hasDrawings={hasDrawings}
          hasMeasurements={hasMeasurements}
        />

        {/* Map Container */}
        <div className="map-container">
          <div ref={mapRef} className="map" />
          {activeTool === 'ZoomBox' && (
            <div
              style={{
                position: 'absolute',
                left: mousePosition.x + 15,
                top: mousePosition.y + 15,
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                pointerEvents: 'none',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                zIndex: 1000,
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}
            >
              Drag to zoom
            </div>
          )}

          <MapSidebar
            handleZoomIn={handleZoomIn}
            handleZoomOut={handleZoomOut}
            showGrid={showGrid}
            setShowGrid={setShowGrid}
            handleFullscreen={handleFullscreen}
            handleLocateMe={handleLocateMe}
          />

          <MapPanel
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            isPanelMinimized={isPanelMinimized}
            setIsPanelMinimized={setIsPanelMinimized}
            baseLayer={baseLayer}
            setBaseLayer={setBaseLayer}
            isDrawingVisible={isDrawingVisible}
            setIsDrawingVisible={setIsDrawingVisible}
            activeTool={activeTool}
            handleToolClick={handleToolClick}
            handleMeasureClick={handleMeasureClick}
            gotoLat={gotoLat}
            setGotoLat={setGotoLat}
            gotoLon={gotoLon}
            setGotoLon={setGotoLon}
            handleGoToLocation={handleGoToLocation}
            handleSearch={handleSearch}
            measurementUnits={measurementUnits}
            setMeasurementUnits={setMeasurementUnits}
            showDrawingLabels={showDrawingLabels}
            setShowDrawingLabels={setShowDrawingLabels}
            showAnalysisLabels={showAnalysisLabels}
            setShowAnalysisLabels={setShowAnalysisLabels}
            handleClearDrawings={handleClearDrawings}
            resetTools={resetTools}
            printTitle={printTitle}
            setPrintTitle={setPrintTitle}
            printSubtitle={printSubtitle}
            setPrintSubtitle={setPrintSubtitle}
            printFileName={printFileName}
            setPrintFileName={setPrintFileName}
            exportFormat={exportFormat}
            setExportFormat={setExportFormat}
            handleExportMap={handleExportMap}
            geoServerLayers={geoServerLayers}
            handleToggleGeoLayer={handleToggleGeoLayer}
            handleLayerOpacityChange={handleLayerOpacityChange}
            handleZoomToLayer={handleZoomToLayer}
            handleToggleAllLayers={handleToggleAllLayers}
            activeLayerTool={activeLayerTool}
            setActiveLayerTool={setActiveLayerTool}
            handleToggleLayerQuery={handleToggleLayerQuery}
          />

          {featureInfoResult && featureInfoPosition && (
            <FeatureInfoCard
              featureInfo={featureInfoResult}
              position={featureInfoPosition}
              onClose={() => setFeatureInfoResult(null)}
            />
          )}
        </div>

        {/* Measurement Badge - Hidden per user request */}
        {/* {measurementValue && (
          <div className={`measurement-badge ${isMeasuring ? 'measuring' : 'complete'}`}>
            <Ruler size={16} />
            <span>{measurementValue}</span>
          </div>
        )} */}

        <MapStatusBar coordinates={coordinates} zoom={zoom} scale={scale} />
      </div>
    </Tooltip.Provider>
  );
}

export default GISMap;
