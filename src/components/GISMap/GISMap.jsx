import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
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
import { Draw, Modify, Snap, DragPan, DragZoom, DragBox } from 'ol/interaction';
import { createRegularPolygon, createBox } from 'ol/interaction/Draw';
import { always, platformModifierKeyOnly } from 'ol/events/condition';
import { Stroke, Style, Circle as CircleStyle, Fill } from 'ol/style';
import Feature from 'ol/Feature';
import { fromLonLat, toLonLat } from 'ol/proj';
import { LineString, Point } from 'ol/geom';
import { defaults as defaultControls } from 'ol/control';
import GeoJSON from 'ol/format/GeoJSON';
import Graticule from 'ol/layer/Graticule';
import * as Tooltip from '@radix-ui/react-tooltip';
import Overlay from 'ol/Overlay';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Sub-components
import MapHeader from '../subComponents/MapHeader';
import MapSidebar from '../subComponents/MapSidebar';
import MapPanel from '../subComponents/MapPanel';
import MapStatusBar from '../subComponents/MapStatusBar';
import FeatureInfoCard from '../subComponents/FeatureInfoCard';
import AttributeTableCard from '../subComponents/AttributeTableCard';
import QueryBuilderCard from '../subComponents/QueryBuilderCard';
import SwipeControl from '../subComponents/SwipeControl';
import { getRenderPixel } from 'ol/render';


// Utils
import {
  styleFunction,
  highlightStyleFunction,
  formatLength,
  formatArea,
} from '../../utils/mapUtils';

import {
  searchLocation,
  getLayerAttributes,
  getFeaturesForAttributeTable,
  getGeoServerLayers,
  getWMSSourceParams,
  getLayerBBox,
  getLayerStyle,
  updateLayerStyle,
  saveSequence,
  deleteFeature,
  updateFeature
} from '../../services/Server';
import { GEOSERVER_URL, AUTH_HEADER } from '../../services/ServerCredentials';


function GISMap() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawInteractionRef = useRef(null);
  const vectorSourceRef = useRef(null);
  const vectorLayerRef = useRef(null);
  const selectionSourceRef = useRef(null);
  const selectionLayerRef = useRef(null);
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
  const [infoSelectionMode, setInfoSelectionMode] = useState('click'); // 'click' or 'drag'

  const [featureInfoResult, setFeatureInfoResult] = useState(null);
  const [featureInfoCoordinate, setFeatureInfoCoordinate] = useState(null);
  const [mapRenderKey, setMapRenderKey] = useState(0); // Forces card re-render on map move
  const [activeZoomLayerId, setActiveZoomLayerId] = useState(null);
  const [activeHighlightLayerId, setActiveHighlightLayerId] = useState(null);
  const [isHighlightAnimating, setIsHighlightAnimating] = useState(false);
  const [selectedAttributeLayerId, setSelectedAttributeLayerId] = useState(null);
  const [showAttributeTable, setShowAttributeTable] = useState(false);
  const [isAttributeTableMinimized, setIsAttributeTableMinimized] = useState(false);
  const [attributeTableData, setAttributeTableData] = useState([]);
  const [isAttributeTableLoading, setIsAttributeTableLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const featureInfoOverlayRef = useRef(null);
  const popupElementRef = useRef(null);
  const dragBoxRef = useRef(null);
  const activeLayerToolRef = useRef(activeLayerTool);
  const infoSelectionModeRef = useRef(infoSelectionMode);
  const geoServerLayersRef = useRef(geoServerLayers);
  const activeHighlightLayerIdRef = useRef(activeHighlightLayerId);
  const isHighlightAnimatingRef = useRef(isHighlightAnimating);

  // Query Builder State
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [queryingLayer, setQueryingLayer] = useState(null);

  useEffect(() => {
    activeLayerToolRef.current = activeLayerTool;
    infoSelectionModeRef.current = infoSelectionMode;
    geoServerLayersRef.current = geoServerLayers;
    activeHighlightLayerIdRef.current = activeHighlightLayerId;
    isHighlightAnimatingRef.current = isHighlightAnimating;
  }, [activeLayerTool, infoSelectionMode, geoServerLayers, activeHighlightLayerId, isHighlightAnimating]);

  // Manage interaction activation based on current tool/mode
  useEffect(() => {
    if (!mapInstanceRef.current || !dragBoxRef.current || !mapReady) return;

    const isDragMode = activeLayerTool === 'info' && infoSelectionMode === 'drag';

    // Toggle DragBox
    dragBoxRef.current.setActive(isDragMode);

    // Toggle DragPan - Disable panning if we're in DragBox selection mode
    mapInstanceRef.current.getInteractions().forEach((interaction) => {
      if (interaction instanceof DragPan) {
        interaction.setActive(!isDragMode && !isLocked);
      }
    });

    // Update cursor
    const viewport = mapInstanceRef.current.getViewport();
    if (isDragMode) {
      viewport.style.cursor = 'cell';
    } else if (activeLayerTool === 'info') {
      viewport.style.cursor = 'pointer';
    } else {
      viewport.style.cursor = '';
    }
  }, [activeLayerTool, infoSelectionMode, isLocked, mapReady]);
  // ELITE: Swipe Tool State
  const [swipeLayerId, setSwipeLayerId] = useState(null);
  const [swipePosition, setSwipePosition] = useState(50); // Percentage
  const swipeLayerRef = useRef(null);

  // ELITE: Toggle Swipe Mode
  const handleToggleSwipe = (layerId) => {
    if (swipeLayerId === layerId) {
      // Turn off
      setSwipeLayerId(null);
      swipeLayerRef.current = null;
      mapInstanceRef.current.render(); // Re-render to clear clip
    } else {
      // Turn on for this layer
      setSwipeLayerId(layerId);
      // We need to find the OL layer object
      const olLayer = operationalLayersRef.current[layerId];
      if (olLayer) {
        swipeLayerRef.current = olLayer;
        // Ensure it's visible
        if (!olLayer.getVisible()) {
          handleToggleGeoLayer(layerId);
        }
        mapInstanceRef.current.render();
      }
    }
  };

  // ELITE: Swipe Logic (Clipping)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const layer = swipeLayerRef.current;
    if (!layer || !swipeLayerId) return;

    const handlePreRender = (event) => {
      const ctx = event.context;
      const width = ctx.canvas.width * (swipePosition / 100);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, ctx.canvas.height);
      ctx.clip();
    };

    const handlePostRender = (event) => {
      const ctx = event.context;
      ctx.restore();
    };

    // Attach listeners to the SPECIFIC layer
    layer.on('prerender', handlePreRender);
    layer.on('postrender', handlePostRender);

    map.render();

    return () => {
      layer.un('prerender', handlePreRender);
      layer.un('postrender', handlePostRender);
      map.render();
    };
  }, [swipeLayerId, swipePosition]);

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
  // ELITE: Background Layer Loader
  const handleFetchGeoServerLayers = async () => {
    try {
      const layers = await getGeoServerLayers(); // Now returns [{fullName, sequence, initialVisibility}, ...]
      const layerObjects = layers.map((layer) => ({
        id: layer.fullName,
        name: layer.fullName.split(':').pop(),
        fullName: layer.fullName,
        sequence: layer.sequence,
        layerId: layer.layerId, // Store the numeric/database ID
        visible: layer.initialVisibility, // Use API property for initial visibility
        opacity: 1,
        queryable: true,
        cqlFilter: null
      }));
      setGeoServerLayers(layerObjects.sort((a, b) => (a.sequence || 999) - (b.sequence || 999)));
    } catch (err) {
      console.error('Failed to load layers:', err);
    }
  };

  // Load GeoServer Layers on Mount
  useEffect(() => {
    handleFetchGeoServerLayers();
  }, []);

  // Sync GeoServer Layers with Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    geoServerLayers.forEach(layer => {
      const existingLayer = operationalLayersRef.current[layer.id];

      if (layer.visible) {
        if (!existingLayer) {
          // Create and add layer
          const sourceParams = getWMSSourceParams(layer.fullName);
          if (layer.cqlFilter) {
            sourceParams.params['CQL_FILTER'] = layer.cqlFilter;
          }

          const wmsLayer = new TileLayer({
            source: new TileWMS(sourceParams),
            zIndex: 1000 - (layer.sequence || 999), // Higher sequence = lower zIndex (sequence 1 is on top)
            opacity: layer.opacity,
            properties: { id: layer.id }
          });
          mapInstanceRef.current.addLayer(wmsLayer);
          operationalLayersRef.current[layer.id] = wmsLayer;
        } else {
          // Update existing properties if needed (e.g. opacity, sequence/zIndex, cqlFilter)
          existingLayer.setOpacity(layer.opacity);
          existingLayer.setZIndex(1000 - (layer.sequence || 999));

          // Update CQL Filter if changed
          const source = existingLayer.getSource();
          const currentParams = source.getParams();
          if (currentParams['CQL_FILTER'] !== layer.cqlFilter) {
            source.updateParams({ 'CQL_FILTER': layer.cqlFilter });
          }
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

    // Set as the active selected layer
    setActiveZoomLayerId(layerId);
    setActiveHighlightLayerId(null); // Clear other tool's selection

    try {
      const bbox = await getLayerBBox(layer.fullName);
      if (bbox) {
        // [minx, miny, maxx, maxy] - OpenLayers expects [minx, miny, maxx, maxy]
        // Transform coordinates to map projection
        const p1 = fromLonLat([bbox[0], bbox[1]]);
        const p2 = fromLonLat([bbox[2], bbox[3]]);
        const extent = [p1[0], p1[1], p2[0], p2[1]];

        mapInstanceRef.current.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          maxZoom: 16,
          duration: 1000
        });
      } else {
        // setMapIsZooming(false); // This state doesn't exist, removed.
        toast.error('Layer extent not available.');
      }
    } catch (err) {
      console.error('Zoom error:', err);
    }
  };

  const handleHighlightLayer = async (layerId) => {
    if (!mapInstanceRef.current) return;
    const layer = geoServerLayers.find(l => l.id === layerId);
    if (!layer) return;

    // Toggle logic
    if (activeHighlightLayerId === layerId && isHighlightAnimating) {
      // STOP animating
      setIsHighlightAnimating(false);
      // Reset opacity to original
      const olLayer = operationalLayersRef.current[layerId];
      if (olLayer) olLayer.setOpacity(layer.opacity || 1);
      return;
    }

    // START animating (or switch to new layer)
    // If switching, reset previous layer first
    if (activeHighlightLayerId && activeHighlightLayerId !== layerId) {
      const prevLayer = operationalLayersRef.current[activeHighlightLayerId];
      const prevLayerData = geoServerLayers.find(l => l.id === activeHighlightLayerId);
      if (prevLayer && prevLayerData) prevLayer.setOpacity(prevLayerData.opacity || 1);
    }

    setActiveHighlightLayerId(layerId);
    setIsHighlightAnimating(true);
    setActiveZoomLayerId(null);

    try {
      const bbox = await getLayerBBox(layer.fullName);
      if (bbox) {
        // Pan to the layer
        const p1 = fromLonLat([bbox[0], bbox[1]]);
        const p2 = fromLonLat([bbox[2], bbox[3]]);
        const extent = [p1[0], p1[1], p2[0], p2[1]];

        mapInstanceRef.current.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          maxZoom: 14,
          duration: 800
        });
      }
    } catch (err) {
      console.error('Highlight error:', err);
    }
  };

  const handleUpdateLayerStyle = async (layerId, fullLayerName, sldBody) => {
    const success = await updateLayerStyle(fullLayerName, sldBody);
    if (success) {
      // Refresh the layer on the map by updating its source params
      const olLayer = operationalLayersRef.current[layerId];
      if (olLayer) {
        const source = olLayer.getSource();
        const params = source.getParams();
        // Add a timestamp to bypass browser cache
        source.updateParams({ ...params, _t: Date.now() });
      }
      return true;
    }
    return false;
  };

  const handleApplyLayerFilter = (layerId, cqlFilter) => {
    setGeoServerLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, cqlFilter: cqlFilter } : l
    ));

    // Also update the currently querying layer if it matches
    if (queryingLayer && queryingLayer.id === layerId) {
      setQueryingLayer(prev => ({ ...prev, cqlFilter: cqlFilter }));
    }
  };

  const GetLayerAttributesStub = (layerId) => {
    console.log(`Getting attributes for layer: ${layerId}`);
    // This is used by AttributeTableCard, but for Query Builder in LayerOperations 
    // we might call getLayerAttributes directly from the service or via a prop.
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
        animationOffsetRef.current = (animationOffsetRef.current + 0.6) % 40;

        // Trigger map redraw without React re-render
        if (vectorLayerRef.current) {
          vectorLayerRef.current.changed();
        }

        // Trigger selection highlight redraw
        if (selectionLayerRef.current) {
          selectionLayerRef.current.changed();
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

        // ELITE: Wave Animation for Highlighted Layer
        if (isHighlightAnimatingRef.current && activeHighlightLayerIdRef.current) {
          const olLayer = operationalLayersRef.current[activeHighlightLayerIdRef.current];
          if (olLayer) {
            const time = Date.now() / 1000;
            // Wave animation: oscillating opacity between 0.3 and 1.0 at moderate speed (3 rad/s)
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

    // ELITE: Selection Layer for Highlights
    const selectionSource = new VectorSource();
    selectionSourceRef.current = selectionSource;
    const selectionLayer = new VectorLayer({
      source: selectionSource,
      style: (feature) => highlightStyleFunction(feature, animationOffsetRef.current),
      zIndex: 2000 // Always on top
    });
    selectionLayerRef.current = selectionLayer;

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
      layers: [
        osmLayer, satelliteLayer, terrainLayer, darkLayer, lightLayer, streetLayer,
        graticule, vectorLayer, selectionLayer
      ],
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

    // ELITE INTERACTION: Feature Info on Click
    map.on('click', async (evt) => {
      const pixel = map.getPixelFromCoordinate(evt.coordinate);

      if (activeLayerToolRef.current === 'info' && infoSelectionModeRef.current === 'click') {
        const view = map.getView();
        const viewResolution = view.getResolution();
        const projection = view.getProjection();
        const visibleLayers = geoServerLayersRef.current.filter(l => l.visible && l.queryable);

        // Hide previous card immediately
        setFeatureInfoResult(null);
        setFeatureInfoCoordinate(null);
        if (selectionSourceRef.current) selectionSourceRef.current.clear();

        // Simple Approach: Always position the click point at an optimal Y location
        // The card appears ABOVE the click, so we want the click point to be in 
        // the lower portion of the screen (around 70% from top)
        const mapSize = map.getSize();

        if (mapSize) {
          const optimalClickY = mapSize[1] * 0.7; // 70% from top = 30% from bottom
          const currentClickY = pixel[1];
          const yDifference = currentClickY - optimalClickY;

          // Calculate new center that puts click point at optimal position
          const currentCenter = view.getCenter();
          const currentCenterPixel = map.getPixelFromCoordinate(currentCenter);
          const newCenterPixel = [currentCenterPixel[0], currentCenterPixel[1] + yDifference];
          const targetCenter = map.getCoordinateFromPixel(newCenterPixel);

          // Always animate to optimal position
          view.animate({
            center: targetCenter,
            duration: 400
          });
        }

        // Delay showing the card until after animation to prevent jitter
        const clickCoord = evt.coordinate;

        if (visibleLayers.length === 0) {
          setTimeout(() => {
            setFeatureInfoCoordinate(clickCoord);
            setFeatureInfoResult([]);
          }, 450);
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

        // Add features to selection layer for highlighting
        if (selectionSourceRef.current && validResults.length > 0) {
          const format = new GeoJSON();
          validResults.forEach(res => {
            const features = format.readFeatures({
              type: 'FeatureCollection',
              features: res.features
            });
            selectionSourceRef.current.addFeatures(features);
          });
        }

        // Show card after animation completes (400ms) + small buffer
        setTimeout(() => {
          setFeatureInfoCoordinate(clickCoord);
          setFeatureInfoResult(validResults);
        }, 450);

      } else {
        const ripple = document.createElement('div');
        ripple.className = 'sonar-ripple';
        ripple.style.left = `${pixel[0]}px`;
        ripple.style.top = `${pixel[1]}px`;
        mapRef.current.appendChild(ripple);
        setTimeout(() => ripple.remove(), 1000);
      }
    });

    // DRAGBOX INTERACTION for Spatial Query
    const dragBox = new DragBox({
      condition: always,
      active: false // Critical: Don't block panning initially!
    });
    dragBoxRef.current = dragBox;
    map.addInteraction(dragBox);

    dragBox.on('boxend', async () => {
      if (activeLayerToolRef.current === 'info' && infoSelectionModeRef.current === 'drag') {
        const extent = dragBox.getGeometry().getExtent();
        const center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
        const projection = map.getView().getProjection().getCode();
        const visibleLayers = geoServerLayersRef.current.filter(l => l.visible && l.queryable);

        setFeatureInfoResult(null);
        setFeatureInfoCoordinate(null);
        if (selectionSourceRef.current) selectionSourceRef.current.clear();

        if (visibleLayers.length === 0) return;

        const results = await Promise.all(visibleLayers.map(async (layer) => {
          // Construct WFS BBOX query
          const [ws, name] = layer.fullName.split(':');
          const bboxStr = `${extent[0]},${extent[1]},${extent[2]},${extent[3]},${projection}`;
          const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${layer.fullName}&outputFormat=application/json&srsName=${projection}&bbox=${bboxStr}&maxFeatures=100`;

          try {
            const res = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
            if (!res.ok) return null;
            const data = await res.json();
            return {
              layerName: layer.name,
              features: data.features
            };
          } catch (err) {
            console.error(`WFS selection failed for ${layer.name}`, err);
            return null;
          }
        }));

        const validResults = results.filter(r => r && r.features && r.features.length > 0);

        // Add features to selection layer for highlighting
        if (selectionSourceRef.current && validResults.length > 0) {
          const format = new GeoJSON();
          validResults.forEach(res => {
            const features = format.readFeatures({
              type: 'FeatureCollection',
              features: res.features
            });
            selectionSourceRef.current.addFeatures(features);
          });
        }

        setFeatureInfoResult(validResults);
        setFeatureInfoCoordinate(center);

        // Auto-switch to click mode after drag selection is done
        if (validResults.length > 0) {
          setInfoSelectionMode('click');
        }
      }
    });

    dragBox.on('boxstart', () => {
      setFeatureInfoCoordinate(null);
    });

    setMapReady(true);

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

  // Handle Attribute Table data fetching
  useEffect(() => {
    if (showAttributeTable && selectedAttributeLayerId) {
      const fetchAttrData = async () => {
        setIsAttributeTableLoading(true);
        const layer = geoServerLayers.find(l => l.id === selectedAttributeLayerId);
        if (layer) {
          const data = await getFeaturesForAttributeTable(layer.id, layer.fullName);
          setAttributeTableData(data);
        }
        setIsAttributeTableLoading(false);
      };
      fetchAttrData();
    } else {
      setAttributeTableData([]);
    }
  }, [showAttributeTable, selectedAttributeLayerId, geoServerLayers]);

  // Feature Info Card - Update position only on moveend (debounced)
  useEffect(() => {
    if (!mapInstanceRef.current || !featureInfoCoordinate) return;

    let updateTimeout = null;

    const handleMapMove = () => {
      // Debounce updates to prevent jitter
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        setMapRenderKey(prev => prev + 1);
      }, 100);
    };

    mapInstanceRef.current.on('moveend', handleMapMove);

    return () => {
      if (updateTimeout) clearTimeout(updateTimeout);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.un('moveend', handleMapMove);
      }
    };
  }, [featureInfoCoordinate]);

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
    // Reset Higlight opacity if animating
    if (isHighlightAnimating && activeHighlightLayerId) {
      const olLayer = operationalLayersRef.current[activeHighlightLayerId];
      const layerData = geoServerLayers.find(l => l.id === activeHighlightLayerId);
      if (olLayer && layerData) olLayer.setOpacity(layerData.opacity || 1);
    }

    setActiveTool(null);
    setActiveZoomLayerId(null);
    setActiveHighlightLayerId(null);
    setIsHighlightAnimating(false);
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
      toast.error('Please enter valid coordinates');
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast.error('Coordinates out of range (Lat: -90 to 90, Lon: -180 to 180)');
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
          toast.error('Unable to retrieve your location. Please check your browser permissions.');
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser.');
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
        pdf.text('Generated via GIS Workspace', 10, pdfHeight - 10);

        pdf.save(fullFileName);
      } else {
        // Image formats (PNG/JPG)
        const link = document.createElement('a');
        link.download = fullFileName;
        link.href = canvas.toDataURL(`image/${exportFormat === 'jpg' ? 'jpeg' : 'png'}`);
        link.click();
      }

      toast.success('Map exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to generate export. Please try again.');
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
            setActivePanel={(panel) => {
              setActivePanel(panel);
              if (panel !== null && panel !== 'tools' && panel !== 'utility_tools' && panel !== 'print') {
                setActiveTool(null);
                removeInteractions();
              }
              if (panel === null) {
                setActiveLayerTool(null);
              }
            }}
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
            handleHighlightLayer={handleHighlightLayer}
            handleToggleAllLayers={handleToggleAllLayers}
            activeLayerTool={activeLayerTool}
            setActiveLayerTool={setActiveLayerTool}
            handleToggleLayerQuery={handleToggleLayerQuery}
            activeHighlightLayerId={activeHighlightLayerId}
            isHighlightAnimating={isHighlightAnimating}
            handleUpdateLayerStyle={handleUpdateLayerStyle}
            infoSelectionMode={infoSelectionMode}
            setInfoSelectionMode={setInfoSelectionMode}
            saveSequence={saveSequence}
            refreshLayers={handleFetchGeoServerLayers}
            selectedAttributeLayerId={selectedAttributeLayerId}
            setSelectedAttributeLayerId={setSelectedAttributeLayerId}
            showAttributeTable={showAttributeTable}
            setShowAttributeTable={setShowAttributeTable}
            GetLayerAttributes={GetLayerAttributesStub}
            handleApplyLayerFilter={handleApplyLayerFilter}
            setShowQueryBuilder={setShowQueryBuilder}
            setQueryingLayer={setQueryingLayer}
            queryingLayer={queryingLayer}
            handleToggleSwipe={handleToggleSwipe}
            swipeLayerId={swipeLayerId}
          />

          {/* Feature Info Card - Positioned at clicked location */}
          {featureInfoResult && featureInfoResult.length > 0 && featureInfoCoordinate && mapInstanceRef.current && (() => {
            const pixel = mapInstanceRef.current.getPixelFromCoordinate(featureInfoCoordinate);
            if (!pixel) return null;
            return (
              <FeatureInfoCard
                featureInfo={featureInfoResult}
                onClose={() => {
                  setFeatureInfoResult(null);
                  setFeatureInfoCoordinate(null);
                  if (selectionSourceRef.current) selectionSourceRef.current.clear();
                }}
                style={{
                  position: 'absolute',
                  left: pixel[0],
                  top: pixel[1],
                  transform: 'translate(-18px, -100%) translateY(-10px)',
                  zIndex: 1000
                }}
              />
            );
          })()}

          {/* Attribute Table Card */}
          {showAttributeTable && selectedAttributeLayerId && (
            <AttributeTableCard
              isOpen={showAttributeTable}
              onClose={() => {
                // Clear highlights when closing table
                if (selectionSourceRef.current) {
                  selectionSourceRef.current.clear();
                }
                setShowAttributeTable(false);
                setSelectedAttributeLayerId(null);
              }}
              layerName={geoServerLayers.find(l => l.id === selectedAttributeLayerId || l.layerId === selectedAttributeLayerId)?.name || 'Unknown Layer'}
              layerFullName={geoServerLayers.find(l => l.id === selectedAttributeLayerId || l.layerId === selectedAttributeLayerId)?.fullName}
              layerId={selectedAttributeLayerId}
              data={attributeTableData}
              isLoading={isAttributeTableLoading}
              onHighlightFeatures={(features) => {
                if (!features || features.length === 0) return;

                // Clear previous highlights
                if (selectionSourceRef.current) {
                  selectionSourceRef.current.clear();
                }

                // Parse and add features to selection layer
                const geoJsonFormat = new GeoJSON();
                features.forEach(feature => {
                  try {
                    // Parse the GeoJSON feature
                    const olFeature = geoJsonFormat.readFeature(feature, {
                      dataProjection: 'EPSG:4326',
                      featureProjection: 'EPSG:3857'
                    });

                    // Add to selection source for highlighting
                    if (selectionSourceRef.current) {
                      selectionSourceRef.current.addFeature(olFeature);
                    }
                  } catch (error) {
                    console.error('Error parsing feature for highlight:', error, feature);
                  }
                });

                // Zoom to highlighted features
                if (selectionSourceRef.current && selectionSourceRef.current.getFeatures().length > 0) {
                  const extent = selectionSourceRef.current.getExtent();
                  mapInstanceRef.current.getView().fit(extent, {
                    padding: [50, 50, 50, 50],
                    duration: 500,
                    maxZoom: 18
                  });

                  toast.success(`Highlighted ${features.length} feature(s) on map`);
                }
              }}
              onClearHighlights={() => {
                // Clear highlights when Stop button is clicked
                if (selectionSourceRef.current) {
                  selectionSourceRef.current.clear();
                }
                toast.info('Highlights cleared');
              }}
              onDeleteFeature={async (fullLayerName, feature) => {
                const success = await deleteFeature(fullLayerName, feature);
                if (success) {
                  toast.success("Feature deleted successfully");
                  // Refresh the table data using the current layer ID
                  const activeLayer = geoServerLayers.find(l => l.fullName === fullLayerName);
                  if (activeLayer) {
                    const data = await getFeaturesForAttributeTable(activeLayer.layerId || activeLayer.id, fullLayerName);
                    setAttributeTableData(data);
                  }
                } else {
                  toast.error("Failed to delete feature. Ensure WFS-T is enabled on GeoServer.");
                }
              }}
              onUpdateFeatures={async (fullLayerName, changes) => {
                let successCount = 0;
                let failCount = 0;
                const rowIds = Object.keys(changes);

                toast.loading(`Saving changes to ${rowIds.length} row(s)...`, { id: 'save-toast' });

                for (const rowId of rowIds) {
                  const success = await updateFeature(fullLayerName, rowId, changes[rowId]);
                  if (success) successCount++;
                  else failCount++;
                }

                if (successCount > 0) {
                  toast.success(`Successfully updated ${successCount} feature(s)`, { id: 'save-toast' });
                  // Refresh data
                  const activeLayer = geoServerLayers.find(l => l.fullName === fullLayerName);
                  if (activeLayer) {
                    const data = await getFeaturesForAttributeTable(activeLayer.layerId || activeLayer.id, fullLayerName);
                    setAttributeTableData(data);
                    return true;
                  }
                  return true; // Return true even if activeLayer not found but updates succeeded
                }

                if (failCount > 0) {
                  toast.error(`Failed to update ${failCount} feature(s)`, { id: 'save-toast' });
                }
                return false;
              }}
              isMinimized={isAttributeTableMinimized}
              onToggleMinimize={() => setIsAttributeTableMinimized(!isAttributeTableMinimized)}
            />
          )}

          <QueryBuilderCard
            isOpen={showQueryBuilder}
            onClose={() => {
              setShowQueryBuilder(false);
              setQueryingLayer(null);
            }}
            layer={queryingLayer}
            handleApplyLayerFilter={handleApplyLayerFilter}
          />

          {swipeLayerId && (
            <SwipeControl
              position={swipePosition}
              onPositionChange={setSwipePosition}
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
