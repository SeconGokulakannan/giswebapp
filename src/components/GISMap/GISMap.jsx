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
import { isEmpty } from 'ol/extent';
import * as Tooltip from '@radix-ui/react-tooltip';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Sub-components
import MapHeader from '../subComponents/MapHeader';
import PrimarySidebar from '../subComponents/PrimarySidebar';
import MapSidebar from '../subComponents/MapSidebar';
import MapPanel from '../subComponents/MapPanel';
import MapStatusBar from '../subComponents/MapStatusBar';
import FeatureInfoCard from '../subComponents/FeatureInfoCard';
import AttributeTableCard from '../subComponents/AttributeTableCard';
import QueryBuilderCard from '../subComponents/QueryBuilderCard';
import AnalysisCard from '../subComponents/AnalysisCard';
import LayerManagementCard from '../subComponents/LayerManagementCard';
import LoadTempLayerModal from '../subComponents/LoadTempLayerModal';
import StyleEditorCard from '../subComponents/StyleEditorCard';
import SpatialJoinCard from '../subComponents/SpatialJoinCard';
import CreateLayerCard from '../subComponents/CreateLayerCard';
import DataManipulationCard from '../subComponents/DataManipulationCard';
import ServerInfoCard from '../subComponents/ServerInfoCard';
import { parseSLD, applyStyleChanges } from '../../utils/StyleUtils';
import TopLegendPanel from '../subComponents/TopLegendPanel';
import { getRenderPixel } from 'ol/render';

//Map Utils
import { styleFunction, highlightStyleFunction, modifyStyle, formatLength, formatArea, generateAnalysisSLD, mergeAnalysisRules, mapGridStyles } from '../../utils/mapUtils';

// Service from Server.js
import {
  searchLocation, getLayerAttributes, getFeaturesForAttributeTable, getGeoServerLayers, getWMSSourceParams, getLayerBBox,
  getLayerStyle, updateLayerStyle, setLayerDefaultStyle, saveSequence, deleteFeature, updateFeature, SaveNewAttribute, addNewLayerConfig, publishNewLayer,
  batchInsertFeatures, batchUpdateFeaturesByProperty, WORKSPACE, getLegendUrl, uploadIcon
} from '../../services/Server';

// Server Credentials
import { GEOSERVER_URL, AUTH_HEADER } from '../../services/ServerCredentials';
// Cookie Helpers
import { getCookie, setCookie, getUniqueCookieKey } from '../../utils/cookieHelpers';


function GISMap() {


  //map refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawInteractionRef = useRef(null);
  const vectorSourceRef = useRef(null);
  const vectorLayerRef = useRef(null);
  const selectionSourceRef = useRef(null);
  const selectionLayerRef = useRef(null);


  //map states
  const [coordinates, setCoordinates] = useState({ lon: 0, lat: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(2);
  const [scale, setScale] = useState('0 km');



  //map tools
  const [activeTool, setActiveTool] = useState(null);
  const [baseLayer, setBaseLayer] = useState('osm');
  const [measurementValue, setMeasurementValue] = useState('');
  const [activePanel, setActivePanel] = useState(null);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);


  const [isDrawingVisible, setIsDrawingVisible] = useState(true);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [hasDrawings, setHasDrawings] = useState(false);
  const [hasMeasurements, setHasMeasurements] = useState(false);


  //Map Directions
  const [gotoLat, setGotoLat] = useState('');
  const [gotoLon, setGotoLon] = useState('');

  // Map Lock 
  const [isLocked, setIsLocked] = useState(false);
  const [layoutMode, setLayoutMode] = useState(() => {
    return localStorage.getItem('gis-layout-mode') || 'sidebar';
  });

  const toggleLayoutMode = () => {
    const newMode = layoutMode === 'sidebar' ? 'topbar' : 'sidebar';
    setLayoutMode(newMode);
    localStorage.setItem('gis-layout-mode', newMode);

    // Reset panels when switching layouts to avoid positioning jitters
    setActivePanel(null);
  };


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
  const [availableDrawings, setAvailableDrawings] = useState([]); // ELITE: For adding attributes

  const [localVectorLayers, setLocalVectorLayers] = useState([]);
  const localVectorLayersRef = useRef(localVectorLayers);
  const [showLoadTempModal, setShowLoadTempModal] = useState(false);

  // Query Builder State
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [queryingLayer, setQueryingLayer] = useState(null);
  const [selectedQueryLayerIds, setSelectedQueryLayerIds] = useState([]);

  // Spatial Join State
  const [showSpatialJoin, setShowSpatialJoin] = useState(false);
  const [activeSpatialJoinLayerId, setActiveSpatialJoinLayerId] = useState(null);
  const [spatialJoinLayerIds, setSpatialJoinLayerIds] = useState([]);
  const [showCreateLayerModal, setShowCreateLayerModal] = useState(false);
  const [showDataManipulationModal, setShowDataManipulationModal] = useState(false);
  const [showServerInfoModal, setShowServerInfoModal] = useState(false);
  const spatialJoinVectorLayersRef = useRef({});
  const spatialJoinWMSVisibilitiesRef = useRef({});

  const handleOpenSpatialJoin = (layerId) => {
    setActiveSpatialJoinLayerId(layerId);
    setShowSpatialJoin(true);
  };

  const handleToggleSpatialJoinLayer = (layerId) => {
    setSpatialJoinLayerIds(prev =>
      prev.includes(layerId) ? prev.filter(id => id !== layerId) : [...prev, layerId]
    );
  };

  // Analysis State
  const [analysisConfig, setAnalysisConfig] = useState(null);
  const [isAnalysisPlaying, setIsAnalysisPlaying] = useState(false);
  const [analysisFrameIndex, setAnalysisFrameIndex] = useState(0);
  const [analysisLayerIds, setAnalysisLayerIds] = useState([]);
  const [analysisSLDMap, setAnalysisSLDMap] = useState({}); // layerId -> sldBody
  const analysisVectorLayersRef = useRef({}); // layerId -> olVectorLayer
  const analysisWMSVisibilitiesRef = useRef({}); // layerId -> originalVisibility (for restore)
  const [showTopLegend, setShowTopLegend] = useState(false);
  const [editingStyleLayer, setEditingStyleLayer] = useState(null);
  const [styleData, setStyleData] = useState(null);
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [layerStyleAttributes, setLayerStyleAttributes] = useState([]);
  const [bookmarks, setBookmarks] = useState(() => {
    const key = getUniqueCookieKey('gis_bookmarks');
    const saved = getCookie(key);
    return saved || [];
  });

  useEffect(() => {
    activeLayerToolRef.current = activeLayerTool;
    infoSelectionModeRef.current = infoSelectionMode;
    geoServerLayersRef.current = geoServerLayers;
    localVectorLayersRef.current = localVectorLayers;
    activeHighlightLayerIdRef.current = activeHighlightLayerId;
    isHighlightAnimatingRef.current = isHighlightAnimating;
  }, [activeLayerTool, infoSelectionMode, geoServerLayers, localVectorLayers, activeHighlightLayerId, isHighlightAnimating]);

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
  // ELITE: Swipe Tool State - Multi-layer support
  const [swipeLayerIds, setSwipeLayerIds] = useState([]); // Array of layer IDs
  const [swipePosition, setSwipePosition] = useState(50); // Percentage
  const swipeLayersRef = useRef(new Map()); // Map of layerId -> olLayer

  // ELITE: Toggle Swipe Mode - Multi-layer support
  const handleToggleSwipe = (layerId) => {
    setSwipeLayerIds(prev => {
      const isSelected = prev.includes(layerId);
      if (isSelected) {
        return prev.filter(id => id !== layerId);
      } else {
        // Auto-enable visibility if the layer is currently hidden
        const layerData = [...geoServerLayers, ...localVectorLayers].find(l => l.id === layerId);
        if (layerData && !layerData.visible) {
          handleToggleGeoLayer(layerId);
        }
        return [...prev, layerId];
      }
    });
  };

  // ELITE: Toggle All Visible Layers for Swipe
  const handleToggleSwipeAll = (turnOn) => {
    const visibleLayers = geoServerLayers.filter(l => l.visible);
    if (turnOn) {
      setSwipeLayerIds(visibleLayers.map(l => l.id));
    } else {
      setSwipeLayerIds([]);
    }
  };

  const handleToggleAnalysisLayer = (layerId) => {
    setAnalysisLayerIds(prev => {
      // If already selected, deselect it
      if (prev.includes(layerId)) {
        return [];
      }
      // Otherwise, select ONLY this layer
      return [layerId];
    });
  };


  // ELITE: Cleanup Swipe when tool is changed
  useEffect(() => {
    if (activeLayerTool !== 'swipe' && swipeLayerIds.length > 0) {
      setSwipeLayerIds([]);
    }
  }, [activeLayerTool]);

  // ELITE: Swipe Logic (Clipping) - Multi-layer support
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Safety check for ids
    const activeIds = Array.isArray(swipeLayerIds) ? swipeLayerIds : [];

    // Always rebuild the LIST of layers from source of truth (IDs)
    // using an Array is safer than Map for iteration in some environments
    const layersToClip = [];
    activeIds.forEach(id => {
      const olLayer = operationalLayersRef.current[id];
      if (olLayer) {
        layersToClip.push(olLayer);
      }
    });

    // Update global ref for external access (e.g. debugging) - keep as Map for consistency elsewhere if needed, 
    // or better yet, just store the array to match the local usage.
    // For now, let's keep the ref as a Map to avoid breaking other potential usages, 
    // but populate it from our safe array.
    const newMap = new Map();
    layersToClip.forEach(layer => {
      // We need the ID to set it in the map, but we only have the layer here.
      // Actually, let's just update the ref to be a Map for compatibility with existing code that might expect it,
      // but we won't use the ref validation logic anymore.
      const id = Object.keys(operationalLayersRef.current).find(key => operationalLayersRef.current[key] === layer);
      if (id) newMap.set(id, layer);
    });
    swipeLayersRef.current = newMap;

    if (layersToClip.length === 0) {
      map.render();
      return;
    }

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

    // Attach listeners to active swipe layers
    layersToClip.forEach((layer) => {
      layer.on('prerender', handlePreRender);
      layer.on('postrender', handlePostRender);
      if (layer instanceof VectorLayer) {
        layer.changed(); // Force vector layers to re-render for clipping
      } else {
        layer.getSource().changed(); // Tile layers also need refresh
      }
    });

    map.render();

    // Cleanup: Remove listeners from the SAME layers we attached to
    return () => {
      layersToClip.forEach((layer) => {
        layer.un('prerender', handlePreRender);
        layer.un('postrender', handlePostRender);
        if (layer instanceof VectorLayer) {
          layer.changed();
        } else {
          layer.getSource().changed();
        }
      });
      map.render();
    };
  }, [swipeLayerIds, swipePosition, geoServerLayers, localVectorLayers]);

  const saveWorkspace = () => {
    if (!vectorSourceRef.current || !mapInstanceRef.current) return;

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

    // Save Bookmarks
    const key = getUniqueCookieKey('gis_bookmarks');
    setCookie(key, bookmarks, 7);
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

  // ELITE: Auto-save when bookmarks change
  useEffect(() => {
    triggerAutoSave();
  }, [bookmarks]);

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
        initialVisibility: layer.initialVisibility, // Keep metadata copy
        visible: layer.initialVisibility, // Used by the map logic
        opacity: 1,
        queryable: true,
        cqlFilter: null,
        geometryFieldName: layer.geometryFieldName,
        geometryType: layer.geometryType,
        srid: layer.srid,
        extent: layer.extent
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

  // Sync Combined Layers with Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const allLayers = [...geoServerLayers, ...localVectorLayers];
    allLayers.forEach(layer => {
      const existingLayer = operationalLayersRef.current[layer.id];

      if (layer.visible) {
        if (!existingLayer) {
          // Create and add layer
          let mapLayer;

          if (layer.type === 'vector' || layer.isLocal) {
            // Local Vector Layer (GeoJSON)
            mapLayer = new VectorLayer({
              source: new VectorSource({
                features: new GeoJSON().readFeatures(layer.data, {
                  featureProjection: 'EPSG:3857'
                })
              }),
              zIndex: 1000 - (layer.sequence || 999),
              opacity: layer.opacity,
              properties: { id: layer.id }
            });
          } else {
            // WMS Layer
            const sourceParams = getWMSSourceParams(layer.fullName);
            if (layer.cqlFilter) {
              sourceParams.params['CQL_FILTER'] = layer.cqlFilter;
            }

            mapLayer = new TileLayer({
              source: new TileWMS({
                ...sourceParams,
                params: sourceParams.params,
                tileLoadFunction: (tile, src) => {
                  const url = src.split('?')[0];
                  const search = src.split('?')[1];
                  const params = new URLSearchParams(search);

                  // If using SLD_BODY and it's large, use POST
                  if (params.get('SLD_BODY')) {
                    fetch(url, {
                      method: 'POST',
                      headers: {
                        'Authorization': AUTH_HEADER,
                        'Content-Type': 'application/x-www-form-urlencoded'
                      },
                      body: search
                    })
                      .then(response => response.blob())
                      .then(blob => {
                        const objectUrl = URL.createObjectURL(blob);
                        tile.getImage().src = objectUrl;
                        tile.getImage().onload = () => URL.revokeObjectURL(objectUrl);
                      })
                      .catch(err => console.error('Tile load error:', err));
                  } else {
                    // Standard GET with Auth header (must use XHR or Fetch for headers)
                    fetch(src, { headers: { 'Authorization': AUTH_HEADER } })
                      .then(response => response.blob())
                      .then(blob => {
                        const objectUrl = URL.createObjectURL(blob);
                        tile.getImage().src = objectUrl;
                        tile.getImage().onload = () => URL.revokeObjectURL(objectUrl);
                      });
                  }
                }
              }),
              zIndex: 1000 - (layer.sequence || 999),
              opacity: layer.opacity,
              properties: { id: layer.id }
            });
          }

          mapInstanceRef.current.addLayer(mapLayer);
          operationalLayersRef.current[layer.id] = mapLayer;
        } else {
          // Update existing properties
          existingLayer.setOpacity(layer.opacity);
          existingLayer.setZIndex(1000 - (layer.sequence || 999));

          if (layer.type !== 'vector') {
            const source = existingLayer.getSource();
            const currentParams = source.getParams();
            const newParams = { ...currentParams };

            if (currentParams['CQL_FILTER'] !== layer.cqlFilter) {
              newParams['CQL_FILTER'] = layer.cqlFilter;
            }

            source.updateParams(newParams);
          }
        }
      } else if (!layer.visible && existingLayer) {
        // Remove layer
        mapInstanceRef.current.removeLayer(existingLayer);
        delete operationalLayersRef.current[layer.id];
      }
    });

    // Handle deletions if state array shrinks
    Object.keys(operationalLayersRef.current).forEach(id => {
      if (!allLayers.find(l => l.id === id)) {
        mapInstanceRef.current.removeLayer(operationalLayersRef.current[id]);
        delete operationalLayersRef.current[id];
      }
    });
  }, [geoServerLayers, localVectorLayers]);

  const handleToggleGeoLayer = (layerId) => {
    setGeoServerLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    ));
    setLocalVectorLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    ));
  };

  const handleToggleLayerQuery = (layerId) => {
    setGeoServerLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, queryable: !l.queryable } : l
    ));
    setLocalVectorLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, queryable: !l.queryable } : l
    ));
  };

  const handleToggleAllLayers = (turnOn) => {
    setGeoServerLayers(prev => prev.map(l => ({ ...l, visible: turnOn })));
    setLocalVectorLayers(prev => prev.map(l => ({ ...l, visible: turnOn })));
  };

  const handleLayerOpacityChange = (layerId, newOpacity) => {
    setGeoServerLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, opacity: parseFloat(newOpacity) } : l
    ));
    setLocalVectorLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, opacity: parseFloat(newOpacity) } : l
    ));
  };



  //#region Zoom / Highlight / 
  const handleZoomToLayer = async (layerId) => {
    if (!mapInstanceRef.current) return;
    const layer = [...geoServerLayers, ...localVectorLayers].find(l => l.id === layerId);
    if (!layer) return;

    // Set as the active selected layer
    setActiveZoomLayerId(layerId);
    setActiveHighlightLayerId(null); // Clear other tool's selection

    try {
      if (layer.isLocal) {
        const olLayer = operationalLayersRef.current[layer.id];
        if (olLayer) {
          const source = olLayer.getSource();
          const extent = source.getExtent();

          // Check if extent is valid (not infinite and not empty)
          if (extent && !isEmpty(extent) && !extent.some(val => !isFinite(val)) && extent[0] !== Infinity) {
            // Check for empty extent
            mapInstanceRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
              maxZoom: 16
            });
          } else {
            toast.error('Cannot zoom: Layer is empty or has invalid extent.');
          }
        }
        return;
      }

      // Check for saved extent first
      if (layer.extent) {
        const extentPart = layer.extent.split(',').map(Number);
        if (extentPart.length === 4 && extentPart.every(val => isFinite(val)) && !isEmpty(extentPart)) {
          mapInstanceRef.current.getView().fit(extentPart, {
            padding: [50, 50, 50, 50],
            maxZoom: 16,
            duration: 1000
          });
          return;
        }
      }

      const bbox = await getLayerBBox(layer.fullName);
      if (bbox && bbox.every(val => isFinite(val))) {
        // [minx, miny, maxx, maxy]
        const p1 = fromLonLat([bbox[0], bbox[1]]);
        const p2 = fromLonLat([bbox[2], bbox[3]]);
        const extent = [p1[0], p1[1], p2[0], p2[1]];

        // Double check transformed extent
        if (!isEmpty(extent) && !extent.some(val => !isFinite(val))) {
          mapInstanceRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: 16,
            duration: 1000
          });
        } else {
          toast.error('Invalid layer extent (empty or infinite).');
        }
      } else {
        toast.error('Layer extent not available.');
      }
    } catch (err) {
      console.error('Zoom error:', err);
      toast.error(`Zoom failed: ${err.message}`);
    }
  };


  const handleHighlightLayer = async (layerId) => {
    if (!mapInstanceRef.current) return;
    const allLayers = [...geoServerLayers, ...localVectorLayers];
    const layer = allLayers.find(l => l.id === layerId);
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
      const prevLayerData = allLayers.find(l => l.id === activeHighlightLayerId);
      if (prevLayer && prevLayerData) prevLayer.setOpacity(prevLayerData.opacity || 1);
    }

    setActiveHighlightLayerId(layerId);
    setIsHighlightAnimating(true);
    setActiveZoomLayerId(null);

    try {
      if (layer.isLocal) {
        // Local vector layer: read extent from OL source directly
        const olLayer = operationalLayersRef.current[layerId];
        if (olLayer) {
          const source = olLayer.getSource();
          const extent = source.getExtent();

          if (extent && !isEmpty(extent) && !extent.some(val => !isFinite(val)) && extent[0] !== Infinity) {
            mapInstanceRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              maxZoom: 14,
              duration: 800
            });
          }
        }
      } else {
        // Check for saved extent first
        if (layer.extent) {
          const extentPart = layer.extent.split(',').map(Number);
          if (extentPart.length === 4 && extentPart.every(val => isFinite(val))) {
            mapInstanceRef.current.getView().fit(extentPart, {
              padding: [50, 50, 50, 50],
              maxZoom: 14,
              duration: 800
            });
            return;
          }
        }

        const bbox = await getLayerBBox(layer.fullName);
        if (bbox && bbox.every(val => isFinite(val))) {
          // Pan to the layer
          const p1 = fromLonLat([bbox[0], bbox[1]]);
          const p2 = fromLonLat([bbox[2], bbox[3]]);
          const extent = [p1[0], p1[1], p2[0], p2[1]];

          if (!isEmpty(extent) && !extent.some(val => !isFinite(val))) {
            mapInstanceRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              maxZoom: 14,
              duration: 800
            });
          }
        }
      }
    } catch (err) {
      console.error('Highlight error:', err);
    }
  };

  //#endregion

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

  const handleApplyMultiLayerFilters = (filterMap) => {
    // filterMap: { layerId: cqlFilter }
    setGeoServerLayers(prev => prev.map(l => {
      if (filterMap.hasOwnProperty(l.id)) {
        return { ...l, cqlFilter: filterMap[l.id] };
      }
      return l;
    }));

    // Update queryingLayer if its ID is in the map
    if (queryingLayer && filterMap.hasOwnProperty(queryingLayer.id)) {
      setQueryingLayer(prev => ({ ...prev, cqlFilter: filterMap[queryingLayer.id] }));
    }
  };

  // ELITE: Save New Attribute (WFS-T Insert)
  const handleSaveNewAttribute = async (fullLayerName, attributes, geometryFeatureId, geometryName, srid, targetGeometryType) => {
    // specific feature from ID
    if (!vectorSourceRef.current) return false;
    const feature = vectorSourceRef.current.getFeatureById(geometryFeatureId);

    // If not found by ID (maybe it's a temp ID or different logic), try finding by property
    const targetFeature = feature || vectorSourceRef.current.getFeatures().find(f => {
      const id = f.getId() || (f.getProperties() && f.getProperties().id);
      return String(id) === String(geometryFeatureId);
    });

    if (!targetFeature) {
      toast.error("Selected drawing not found on map");
      return false;
    }

    const success = await SaveNewAttribute(fullLayerName, attributes, targetFeature, geometryName, srid, targetGeometryType);

    if (success) {
      toast.success("Feature created successfully!");
      // Refresh layer data
      const activeLayer = geoServerLayers.find(l => l.fullName === fullLayerName);
      if (activeLayer) {
        // update attribute table data
        const data = await getFeaturesForAttributeTable(activeLayer.layerId || activeLayer.id, fullLayerName);
        setAttributeTableData(data);

        // refresh map layer
        const olLayer = operationalLayersRef.current[activeLayer.id];
        if (olLayer) {
          olLayer.getSource().updateParams({ '_t': Date.now() });
        }
      }
      return true;
    } else {
      toast.error("Failed to create feature. Check console.");
      return false;
    }
  };

  //#region Layer Management
  const [showLayerManagement, setShowLayerManagement] = useState(false);
  const [layerManagementData, setLayerManagementData] = useState([]);
  const [isLayerManagementLoading, setIsLayerManagementLoading] = useState(false);


  const handleOpenLayerManagement = async () => {
    setShowLayerManagement(true);
    handleRefreshLayerManagement();
  };

  const handleRefreshLayerManagement = async () => {
    setIsLayerManagementLoading(true);
    try {
      const data = await getFeaturesForAttributeTable('Layer', 'gisweb:Layer');
      setLayerManagementData(data);
    } catch (err) {
      console.error("Failed to refresh layer management data:", err);
    } finally {
      setIsLayerManagementLoading(false);
    }
  };

  //#endregion



  const handleAddLocalVectorLayer = (newLayer) => {
    setLocalVectorLayers(prev => [...prev, newLayer]);
  };

  const handleUpdateLayerMetadata = async (fullLayerName, changes) => {
    let successCount = 0;
    for (const [rowId, props] of Object.entries(changes)) {
      // Resolve the true GeoServer FID using either the LayerId or the original feature ID
      const feature = layerManagementData.find(f =>
        (f.properties?.LayerId?.toString() === rowId.toString()) ||
        (f.id === rowId) ||
        (f.properties?.id?.toString() === rowId.toString())
      );

      const targetId = feature ? feature.id : rowId;
      const ok = await updateFeature(fullLayerName, targetId, props);
      if (ok) successCount++;
    }
    if (successCount > 0) handleRefreshLayerManagement();
    return successCount > 0;
  };

  const handleSaveNewLayerMetadata = async (fullLayerName, props) => {
    // Specialized service for Layer configuration
    const success = await addNewLayerConfig(props);
    if (success) handleRefreshLayerManagement();
    return success;
  };

  const handleDeleteLayerMetadata = async (fullLayerName, feature) => {
    const success = await deleteFeature(fullLayerName, feature);
    if (success) handleRefreshLayerManagement();
    return success;
  };

  const handleRunAnalysis = async (config) => {
    const { layerId, property, mappings, isPeriodic, dateProperty, startDate, endDate } = config;
    const layer = geoServerLayers.find(l => l.id === layerId);
    if (!layer || !mapInstanceRef.current) return;

    toast.loading("Fetching data for analysis...", { id: 'analysis-toast' });

    try {
      // 1. Fetch data via WFS (GeoJSON)
      // If periodic, we might want to fetch all or filter by date range
      let wfsUrl = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${layer.fullName}&outputFormat=application/json&srsName=EPSG:3857`;

      if (isPeriodic && dateProperty && startDate && endDate) {
        const cql = `${dateProperty} BETWEEN '${startDate}' AND '${endDate}'`;
        wfsUrl += `&cql_filter=${encodeURIComponent(cql)}`;
      }

      const response = await fetch(wfsUrl, { headers: { 'Authorization': AUTH_HEADER } });
      if (!response.ok) throw new Error("Failed to fetch features from GeoServer");

      const geojson = await response.json();
      if (!geojson.features || geojson.features.length === 0) {
        toast.error("No features found for analysis", { id: 'analysis-toast' });
        return;
      }

      // 2. Hide existing WMS Layer
      analysisWMSVisibilitiesRef.current[layerId] = layer.visible;
      setGeoServerLayers(prev => prev.map(l =>
        l.id === layerId ? { ...l, visible: false } : l
      ));

      // 3. Create Vector Layer for Analysis
      const vectorSource = new VectorSource({
        features: new GeoJSON().readFeatures(geojson)
      });

      // JS Style Function implementing mappings and operators
      const analysisStyleFunction = (feature) => {
        const val = feature.get(property);
        if (val === undefined || val === null) return null;

        // Find matching mapping
        const match = mappings.find(m => {
          if (!m.value) return false;
          const op = m.operator || '=';
          const mappingVal = m.value;

          // Operator Logic
          switch (op) {
            case '=': return String(val) === String(mappingVal);
            case '!=': return String(val) !== String(mappingVal);
            case '>': return Number(val) > Number(mappingVal);
            case '<': return Number(val) < Number(mappingVal);
            case '>=': return Number(val) >= Number(mappingVal);
            case '<=': return Number(val) <= Number(mappingVal);
            case 'LIKE': return String(val).toLowerCase().includes(String(mappingVal).toLowerCase());
            default: return String(val) === String(mappingVal);
          }
        });

        if (match) {
          const color = match.color;
          return [
            new Style({
              fill: new Fill({ color: color + 'b3' }), // ~0.7 opacity
              stroke: new Stroke({ color: '#fff', width: 1 }),
              image: new CircleStyle({
                radius: 6,
                fill: new Fill({ color: color }),
                stroke: new Stroke({ color: '#fff', width: 1 })
              })
            })
          ];
        }

        // Else (default) style
        return [
          new Style({
            fill: new Fill({ color: 'rgba(204, 204, 204, 0.2)' }),
            stroke: new Stroke({ color: 'rgba(153, 153, 153, 0.5)', width: 0.5 })
          })
        ];
      };

      const analysisLayer = new VectorLayer({
        source: vectorSource,
        style: analysisStyleFunction,
        zIndex: 1001, // Above WMS layers
        properties: { id: `analysis-${layerId}`, isAnalysis: true }
      });

      // Cleanup existing analysis layer for this ID if it exists
      if (analysisVectorLayersRef.current[layerId]) {
        mapInstanceRef.current.removeLayer(analysisVectorLayersRef.current[layerId]);
      }

      mapInstanceRef.current.addLayer(analysisLayer);
      analysisVectorLayersRef.current[layerId] = analysisLayer;

      toast.success(`Analysis applied!`, { id: 'analysis-toast' });

      // Handle Periodic Playback
      if (isPeriodic && dateProperty && startDate && endDate) {
        setAnalysisConfig(config);
        setAnalysisFrameIndex(0);
      } else {
        setAnalysisConfig(null);
        setIsAnalysisPlaying(false);
      }

    } catch (err) {
      console.error("Analysis failed:", err);
      toast.error(`Analysis failed: ${err.message}`, { id: 'analysis-toast' });
    }
  };

  const handleResetAnalysis = () => {
    // 1. Remove all client-side analysis vector layers
    if (mapInstanceRef.current) {
      Object.keys(analysisVectorLayersRef.current).forEach(layerId => {
        const vectorLayer = analysisVectorLayersRef.current[layerId];
        if (vectorLayer) {
          mapInstanceRef.current.removeLayer(vectorLayer);
        }

        // 2. Restore original WMS Layer visibility
        const originalVisible = analysisWMSVisibilitiesRef.current[layerId];
        if (originalVisible !== undefined) {
          setGeoServerLayers(prev => prev.map(l =>
            l.id === layerId ? { ...l, visible: originalVisible } : l
          ));
        }
      });
    }

    // 3. Reset Refs and State
    analysisVectorLayersRef.current = {};
    analysisWMSVisibilitiesRef.current = {};
    setAnalysisSLDMap({});
    setAnalysisConfig(null);
    setIsAnalysisPlaying(false);

    toast.success("Analysis reset. Client-side layers removed.");
  };

  //#region Spatial Join Handlers
  const handlePerformSpatialJoin = async (config) => {
    const { layerA: layerAId, attrA, layerB: layerBId, attrB, colorA, colorB, joinType, matchColor } = config;
    const layerAObj = geoServerLayers.find(l => l.id === layerAId);
    const layerBObj = geoServerLayers.find(l => l.id === layerBId);
    if (!layerAObj || !layerBObj || !mapInstanceRef.current) return;

    toast.loading('Fetching data for spatial join...', { id: 'spatialjoin-toast' });

    try {
      // 1. Fetch WFS GeoJSON for both layers
      const fetchWFS = async (layer) => {
        const wfsUrl = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${layer.fullName}&outputFormat=application/json&srsName=EPSG:3857`;
        const res = await fetch(wfsUrl, { headers: { 'Authorization': AUTH_HEADER } });
        if (!res.ok) throw new Error(`Failed to fetch ${layer.name}`);
        return res.json();
      };

      const [geojsonA, geojsonB] = await Promise.all([fetchWFS(layerAObj), fetchWFS(layerBObj)]);

      if (!geojsonA.features?.length || !geojsonB.features?.length) {
        toast.error('One or both layers returned no features', { id: 'spatialjoin-toast' });
        return;
      }

      // 2. Build lookup sets
      const valuesA = new Set(geojsonA.features.map(f => String(f.properties?.[attrA] ?? '')));
      const valuesB = new Set(geojsonB.features.map(f => String(f.properties?.[attrB] ?? '')));

      // 3. Hide original WMS layers
      [layerAId, layerBId].forEach(lid => {
        const layer = geoServerLayers.find(l => l.id === lid);
        if (layer) {
          spatialJoinWMSVisibilitiesRef.current[lid] = layer.visible;
          setGeoServerLayers(prev => prev.map(l =>
            l.id === lid ? { ...l, visible: false } : l
          ));
        }
      });

      // 4. Style function factory
      const createStyleFn = (attrName, matchSet, matchColor, unmatchColor = null, showAll = false) => (feature) => {
        const val = String(feature.get(attrName) ?? '');
        const isMatch = matchSet.has(val);

        if (!isMatch && !showAll) return [];

        const color = isMatch ? matchColor : unmatchColor;
        if (!color) return [];

        return [
          new Style({
            fill: new Fill({ color: color + 'b3' }),
            stroke: new Stroke({ color: '#fff', width: 1.5 }),
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: color }),
              stroke: new Stroke({ color: '#fff', width: 1 })
            })
          })
        ];
      };

      // 5. Create vector layers
      const addJoinLayer = (geojson, layerId, attrName, matchSet, matchColor, unmatchColor, showAll) => {
        const source = new VectorSource({ features: new GeoJSON().readFeatures(geojson) });
        const vectorLayer = new VectorLayer({
          source,
          style: createStyleFn(attrName, matchSet, matchColor, unmatchColor, showAll),
          zIndex: 1001,
          properties: { id: `spatialjoin-${layerId}`, isSpatialJoin: true }
        });

        // Cleanup existing
        if (spatialJoinVectorLayersRef.current[layerId]) {
          mapInstanceRef.current.removeLayer(spatialJoinVectorLayersRef.current[layerId]);
        }
        mapInstanceRef.current.addLayer(vectorLayer);
        spatialJoinVectorLayersRef.current[layerId] = vectorLayer;
      };

      // Cleanup previous spatial join vector layers first
      Object.keys(spatialJoinVectorLayersRef.current).forEach(lid => {
        const olLayer = spatialJoinVectorLayersRef.current[lid];
        if (olLayer) mapInstanceRef.current.removeLayer(olLayer);
      });
      spatialJoinVectorLayersRef.current = {};

      if (joinType === 'union') {
        // Union: Show only Target matching features in matchColor
        addJoinLayer(geojsonA, layerAId, attrA, valuesB, matchColor, null, false);
      } else if (joinType === 'left') {
        // Left Join: All Target features. Matches = Source color, Unmatches = Target color
        addJoinLayer(geojsonA, layerAId, attrA, valuesB, colorB, colorA, true);
      } else if (joinType === 'right') {
        // Right Join: All Source features. Matches = Target color, Unmatches = Source color
        addJoinLayer(geojsonB, layerBId, attrB, valuesA, colorA, colorB, true);
      }

      const matchCount = [...valuesA].filter(v => valuesB.has(v)).length;
      toast.success(`Spatial join complete! ${matchCount} matching value(s) found.`, { id: 'spatialjoin-toast' });

    } catch (err) {
      console.error('Spatial join failed:', err);
      toast.error(`Spatial join failed: ${err.message}`, { id: 'spatialjoin-toast' });
    }
  };

  const handleResetSpatialJoin = () => {
    if (mapInstanceRef.current) {
      // 1. Remove Join Layers
      Object.keys(spatialJoinVectorLayersRef.current).forEach(layerId => {
        const vectorLayer = spatialJoinVectorLayersRef.current[layerId];
        if (vectorLayer) {
          mapInstanceRef.current.removeLayer(vectorLayer);
        }

        // 2. Restore Original Visibilities
        const originalVisible = spatialJoinWMSVisibilitiesRef.current[layerId];
        if (originalVisible !== undefined) {
          setGeoServerLayers(prev => prev.map(l =>
            l.id === layerId ? { ...l, visible: originalVisible } : l
          ));
        }
      });

      // 3. Reset Map View to Defaults
      const view = mapInstanceRef.current.getView();
      view.animate({
        center: fromLonLat([0, 20]),
        zoom: 2,
        duration: 1000
      });
    }

    spatialJoinVectorLayersRef.current = {};
    spatialJoinWMSVisibilitiesRef.current = {};
    toast.success('Spatial join reset. View restored to default.');
  };

  const createDefaultSldForLayer = (fullLayerName, geometryType = '') => {
    const layerName = fullLayerName.includes(':') ? fullLayerName.split(':')[1] : fullLayerName;
    const gt = String(geometryType || '').toLowerCase();

    const isPoint = gt.includes('point');
    const isLine = gt.includes('line');

    let symbolizer = `
      <PolygonSymbolizer>
        <Fill>
          <CssParameter name="fill">#4f86f7</CssParameter>
          <CssParameter name="fill-opacity">0.35</CssParameter>
        </Fill>
        <Stroke>
          <CssParameter name="stroke">#1e40af</CssParameter>
          <CssParameter name="stroke-width">1.5</CssParameter>
        </Stroke>
      </PolygonSymbolizer>`;

    if (isLine) {
      symbolizer = `
      <LineSymbolizer>
        <Stroke>
          <CssParameter name="stroke">#2563eb</CssParameter>
          <CssParameter name="stroke-width">2</CssParameter>
        </Stroke>
      </LineSymbolizer>`;
    } else if (isPoint) {
      symbolizer = `
      <PointSymbolizer>
        <Graphic>
          <Mark>
            <WellKnownName>circle</WellKnownName>
            <Fill>
              <CssParameter name="fill">#2563eb</CssParameter>
            </Fill>
            <Stroke>
              <CssParameter name="stroke">#ffffff</CssParameter>
              <CssParameter name="stroke-width">1</CssParameter>
            </Stroke>
          </Mark>
          <Size>10</Size>
        </Graphic>
      </PointSymbolizer>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>${layerName}</Name>
    <UserStyle>
      <Title>Default ${layerName} Style</Title>
      <FeatureTypeStyle>
        <Rule>
          <Title>DefaultRule</Title>
          ${symbolizer}
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;
  };

  const getLayerScopedStyleName = (fullLayerName) => {
    const raw = fullLayerName.includes(':') ? fullLayerName.split(':')[1] : fullLayerName;
    const safe = raw.replace(/[^a-zA-Z0-9_]/g, '_');
    return `${safe}_Style`;
  };

  const handleLoadStyle = async (layer) => {
    setActiveLayerTool('styles');
    setEditingStyleLayer(layer);
    toast.loading('Loading current styles...', { id: 'style-load' });
    try {
      const result = await getLayerStyle(layer.fullName);

      if (result && result.sldBody && result.isLayerSpecificStyle === true) {
        // ── Fast path: layer already has its own dedicated style ─────────────────
        const { styleName, sldBody } = result;
        const parsed = parseSLD(sldBody);
        setStyleData({
          styleName,
          sldBody,
          properties: parsed.props,
          availableProps: parsed.availableProps
        });

        const attrs = await getLayerAttributes(layer.fullName);
        setLayerStyleAttributes(attrs || []);
        toast.success(`Styles loaded for ${layer.name}`, { id: 'style-load' });
      } else {
        // Bootstrap: create a layer-specific style, seed from existing default SLD body
        const baseSld = result?.sldBody
          ? result.sldBody
          : createDefaultSldForLayer(layer.fullName, layer.geometryType);

        const scopedStyleName = getLayerScopedStyleName(layer.fullName);
        toast.loading(`Creating dedicated style '${scopedStyleName}'...`, { id: 'style-load' });

        const created = await updateLayerStyle(layer.fullName, scopedStyleName, baseSld);
        if (!created) throw new Error('Failed to create/upload layer-specific SLD');

        await setLayerDefaultStyle(layer.fullName, scopedStyleName);

        // Small delay for GeoServer to finalize the write
        await new Promise(r => setTimeout(r, 800));

        const fresh = await getLayerStyle(layer.fullName);
        if (!fresh?.sldBody) throw new Error('Layer-specific style created but re-fetch failed');

        const parsed = parseSLD(fresh.sldBody);
        setStyleData({
          styleName: fresh.styleName,
          sldBody: fresh.sldBody,
          properties: parsed.props,
          availableProps: parsed.availableProps
        });

        const attrs = await getLayerAttributes(layer.fullName);
        setLayerStyleAttributes(attrs || []);
        toast.success(`Layer style '${scopedStyleName}' created and applied!`, { id: 'style-load' });
      }
    } catch (error) {
      console.error("Failed to load style:", error);
      toast.error('Could not load styles. Please try again.', { id: 'style-load' });
    }
  };

  const handleSaveStyle = async (overrideProps = null) => {
    if (!editingStyleLayer || !styleData) return;

    setIsSavingStyle(true);
    const saveId = toast.loading('Saving style to server...');

    try {
      const propsToUse = { ...(overrideProps || styleData.properties) };

      // Force opacity for Outline
      if (propsToUse.hatchPattern === 'outline') {
        propsToUse.fillOpacity = 0.0;
      }

      const newSld = applyStyleChanges(styleData.sldBody, propsToUse);
      console.log("GISMap: Generated SLD for Save:", newSld);
      // Pass the correct style name to the update function
      const success = await updateLayerStyle(editingStyleLayer.fullName, styleData.styleName, newSld);

      if (success) {
        // Authoritative re-fetch to ensure sync with server
        // WAIT for GeoServer to finalize the write (REST API can be slightly async with disk IO)
        await new Promise(r => setTimeout(r, 1500));

        const newData = await getLayerStyle(editingStyleLayer.fullName);
        if (newData) {
          const parsed = parseSLD(newData.sldBody);
          setStyleData({
            ...newData,
            properties: parsed.props,
            availableProps: parsed.availableProps
          });
        }

        // Re-trigger WMS refresh
        const olLayer = operationalLayersRef.current[editingStyleLayer.id];
        if (olLayer) {
          const source = olLayer.getSource();
          source.updateParams({
            ...source.getParams(),
            _t: Date.now(),
            SLD_BODY: undefined // Explicitly clear the temporary SLD
          });
        }

        toast.success('Style saved successfully!', { id: saveId });
      } else {
        toast.error('Failed to save style to server.', { id: saveId });
      }
    } catch (error) {
      console.error("Failed to save style:", error);
      toast.error('Error saving style to server.', { id: saveId });
    } finally {
      setIsSavingStyle(false);
    }
  };

  // Debounce for style previews
  const previewTimeoutRef = useRef(null);
  // Keep a ref to the latest styleData so closures in updateStyleProp never go stale
  const styleDataRef = useRef(null);
  useEffect(() => { styleDataRef.current = styleData; }, [styleData]);

  const updateStyleProp = (key, value, autoSave = false) => {
    if (!styleData) return;

    const newProps = { ...styleData.properties, [key]: value };

    // Update state first (this will also update styleDataRef via the useEffect above)
    setStyleData(prev => ({
      ...prev,
      properties: newProps
    }));

    // REAL-TIME PREVIEW — reads sldBody from ref so it's never stale
    if (editingStyleLayer) {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);

      previewTimeoutRef.current = setTimeout(() => {
        const currentSldBody = styleDataRef.current?.sldBody;
        if (!currentSldBody) return;
        const olLayer = operationalLayersRef.current[editingStyleLayer.id];
        if (olLayer) {
          try {
            const newSld = applyStyleChanges(currentSldBody, newProps);
            olLayer.getSource().updateParams({
              ...olLayer.getSource().getParams(),
              SLD_BODY: newSld,
              _t: Date.now()
            });
          } catch (err) {
            console.error('[PreApply] Error generating SLD for preview:', err);
          }
        }
      }, 80); // 80ms debounce for responsive but not too jumpy feel
    }

    if (autoSave) {
      handleSaveStyle(newProps);
    }
  };

  const handleStyleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !editingStyleLayer) return;

    const toastId = toast.loading('Uploading icon...');
    try {
      const workspace = editingStyleLayer.fullName.split(':')[0];
      const filename = await uploadIcon(file, workspace);
      if (filename) {
        updateStyleProp('externalGraphicUrl', filename, true);
        toast.success('Icon uploaded and applied!', { id: toastId });
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error('Icon upload failed.', { id: toastId });
    }
  };


  // Analysis Playback Loop
  useEffect(() => {
    let interval;
    if (isAnalysisPlaying && analysisConfig?.filteredDates?.length > 0) {
      interval = setInterval(() => {
        setAnalysisFrameIndex(prev => (prev + 1) % analysisConfig.filteredDates.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isAnalysisPlaying, analysisConfig]);

  // Sync Analysis Frame with Map Filter/Visibility
  useEffect(() => {
    if (analysisConfig && analysisConfig.filteredDates && analysisConfig.filteredDates[analysisFrameIndex]) {
      const { layerId, property, mappings, dateProperty, filteredDates } = analysisConfig;
      const date = filteredDates[analysisFrameIndex];

      const vectorLayer = analysisVectorLayersRef.current[layerId];
      if (vectorLayer) {
        // Apply a style function that filters by date AND applies the color mapping
        vectorLayer.setStyle((feature) => {
          const featureDate = feature.get(dateProperty);

          // Filter by date
          if (String(featureDate) !== String(date)) {
            return new Style({}); // Invisible
          }

          // Apply Color Mapping (same logic as handleRunAnalysis)
          const val = feature.get(property);
          const match = mappings.find(m => {
            if (!m.value) return false;
            const op = m.operator || '=';
            const mappingVal = m.value;

            switch (op) {
              case '=': return String(val) === String(mappingVal);
              case '!=': return String(val) !== String(mappingVal);
              case '>': return Number(val) > Number(mappingVal);
              case '<': return Number(val) < Number(mappingVal);
              case '>=': return Number(val) >= Number(mappingVal);
              case '<=': return Number(val) <= Number(mappingVal);
              case 'LIKE': return String(val).toLowerCase().includes(String(mappingVal).toLowerCase());
              default: return String(val) === String(mappingVal);
            }
          });

          if (match) {
            const color = match.color;
            return [
              new Style({
                fill: new Fill({ color: color + 'b3' }),
                stroke: new Stroke({ color: '#fff', width: 1 }),
                image: new CircleStyle({
                  radius: 6,
                  fill: new Fill({ color: color }),
                  stroke: new Stroke({ color: '#fff', width: 1 })
                })
              })
            ];
          }

          return [
            new Style({
              fill: new Fill({ color: 'rgba(204, 204, 204, 0.2)' }),
              stroke: new Stroke({ color: 'rgba(153, 153, 153, 0.5)', width: 0.5 })
            })
          ];
        });
      }
    }
  }, [analysisFrameIndex, analysisConfig]);

  const GetLayerAttributesStub = (layerId) => {
    console.log(`Getting attributes for layer: ${layerId}`);
    // This is used by AttributeTableCard, but for Query Builder in LayerOperations 
    // we might call getLayerAttributes directly from the service or via a prop.
  };

  const handleAddBookmark = (name) => {
    if (!mapInstanceRef.current) return;
    const view = mapInstanceRef.current.getView();
    const newBookmark = {
      id: Date.now().toString(),
      name: name,
      center: view.getCenter(),
      zoom: view.getZoom(),
      timestamp: new Date().toISOString()
    };
    setBookmarks(prev => [...prev, newBookmark]);
    toast.success('Bookmark added successfully');
  };

  const handleDeleteBookmark = (id) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
    toast.success('Bookmark deleted');
  };

  const handleNavigateToBookmark = (bookmark) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.getView().animate({
      center: bookmark.center,
      zoom: bookmark.zoom,
      duration: 1200
    });
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




  // Update feature status based on vector source
  const updateFeatureStatus = (source) => {
    if (!source) return;
    const features = source.getFeatures();
    const drawings = features.some(f => !f.get('isMeasurement'));
    const measurements = features.some(f => f.get('isMeasurement'));
    setHasDrawings(drawings);
    setHasMeasurements(measurements);

    // ELITE: Update available drawings list for Attribute Table
    const validDrawings = features
      .filter(f => !f.get('isMeasurement'))
      .map(f => {
        // Ensure it has an ID
        let id = f.getId();
        if (!id) {
          id = `drawing-${Math.random().toString(36).substr(2, 9)}`;
          f.setId(id);
        }
        return {
          id: id,
          type: f.getGeometry().getType(),
          name: f.get('name') || `Drawing (${f.getGeometry().getType()})`
        };
      });
    setAvailableDrawings(validDrawings);
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
      zIndex: 9999 // User requested "top layer of all layers"
    });
    vectorLayerRef.current = vectorLayer;

    // ELITE: Selection Layer for Highlights
    const selectionSource = new VectorSource();
    selectionSourceRef.current = selectionSource;
    const selectionLayer = new VectorLayer({
      source: selectionSource,
      style: (feature) => highlightStyleFunction(feature, animationOffsetRef.current),
      zIndex: 10000 // Always on top of everything, including drawings
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



    // Load saved view state
    const savedView = JSON.parse(localStorage.getItem('gis_view') || 'null');

    const map = new Map({
      target: mapRef.current,
      layers: [
        osmLayer, satelliteLayer, terrainLayer, darkLayer, lightLayer, streetLayer,
        mapGridStyles, vectorLayer, selectionLayer
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
        const visibleLayers = [
          ...geoServerLayersRef.current,
          ...localVectorLayersRef.current
        ].filter(l => l.visible && l.queryable);

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

        // 1. Fetch WMS/GeoServer results
        const fetchPromises = visibleLayers.filter(l => !l.isLocal).map(async (layer) => {
          const existingLayer = operationalLayersRef.current[layer.id];
          if (!existingLayer) return null;

          const source = existingLayer.getSource();
          if (typeof source.getFeatureInfoUrl !== 'function') return null;

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
        let validResults = results.filter(r => r && r.features && r.features.length > 0);

        // 2. Query Local Vector Layers
        const localActiveLayers = visibleLayers.filter(l => l.isLocal);
        localActiveLayers.forEach(layer => {
          const features = [];
          map.forEachFeatureAtPixel(pixel, (feature, olLayer) => {
            // Check if this feature belongs to the current local layer
            const layerInstance = operationalLayersRef.current[layer.id];
            if (olLayer === layerInstance) {
              const props = feature.getProperties();
              // Remove geometry from properties
              const { geometry, ...others } = props;
              features.push({
                type: 'Feature',
                id: feature.getId() || others.id || `local-${Math.random()}`,
                properties: others,
                geometry: null
              });
            }
          });

          if (features.length > 0) {
            validResults.push({
              layerName: layer.name,
              features: features
            });
          }
        });
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
        const allVisibleLayers = [
          ...geoServerLayersRef.current,
          ...localVectorLayersRef.current
        ].filter(l => l.visible && l.queryable);

        setFeatureInfoResult(null);
        setFeatureInfoCoordinate(null);
        if (selectionSourceRef.current) selectionSourceRef.current.clear();

        if (allVisibleLayers.length === 0) return;

        // 1. Query WMS/GeoServer layers via WFS
        const serverLayers = allVisibleLayers.filter(l => !l.isLocal);
        const results = await Promise.all(serverLayers.map(async (layer) => {
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

        let validResults = results.filter(r => r && r.features && r.features.length > 0);

        // 2. Query Local Vector Layers by extent intersection
        const localActiveLayers = allVisibleLayers.filter(l => l.isLocal);
        localActiveLayers.forEach(layer => {
          const layerInstance = operationalLayersRef.current[layer.id];
          if (!layerInstance) return;
          const source = layerInstance.getSource();
          const features = [];
          source.forEachFeatureIntersectingExtent(extent, (feature) => {
            const props = feature.getProperties();
            const { geometry, ...others } = props;
            features.push({
              type: 'Feature',
              id: feature.getId() || others.id || `local-${Math.random()}`,
              properties: others,
              geometry: null
            });
          });
          if (features.length > 0) {
            validResults.push({
              layerName: layer.name,
              features: features
            });
          }
        });

        // Add features to selection layer for highlighting
        if (selectionSourceRef.current && validResults.length > 0) {
          const format = new GeoJSON();
          validResults.forEach(res => {
            const filteredFeatures = res.features.filter(f => f.geometry);
            if (filteredFeatures.length > 0) {
              const olFeatures = format.readFeatures({
                type: 'FeatureCollection',
                features: filteredFeatures
              });
              selectionSourceRef.current.addFeatures(olFeatures);
            }
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

        // Search across all possible layer types
        const allLayers = [...geoServerLayers, ...localVectorLayers];
        const layer = allLayers.find(l => l.id === selectedAttributeLayerId);

        if (layer) {
          if (layer.isLocal && layer.data) {
            // For local layers, attributes are already in the GeoJSON
            const tableData = layer.data.features.map((f, idx) => ({
              ...f,
              id: f.id || f.properties?.id || f.properties?.fid || `local-${idx}`
            }));
            setAttributeTableData(tableData);
            console.log(`Loaded ${tableData.length} attributes for local layer: ${layer.name}`);
          } else {
            // For GeoServer/Session layers, fetch via API
            const data = await getFeaturesForAttributeTable(layer.layerId || layer.id, layer.fullName);
            setAttributeTableData(data);
          }
        }

        setIsAttributeTableLoading(false);
      };
      fetchAttrData();
    } else {
      setAttributeTableData([]);
    }
  }, [showAttributeTable, selectedAttributeLayerId, geoServerLayers, localVectorLayers]);

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

  async function handleSearch(query) {
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

  const handleMeasureClick = (type) => {
    removeInteractions(); // Reset current operations
    if (activeTool === type) {
      setActiveTool(null);
    } else {
      setActiveTool(type);
      addMeasureInteraction(type);
    }
  };


  //#region  Side Panel Actions

  const mapGridRef = useRef(null);
  const [showGrid, setShowGrid] = useState(false);

  function handleZoomIn() {
    if (mapInstanceRef.current) {
      const view = mapInstanceRef.current.getView();
      view.animate({ zoom: view.getZoom() + 1, duration: 250 });
    }
  };

  function handleZoomOut() {
    if (mapInstanceRef.current) {
      const view = mapInstanceRef.current.getView();
      view.animate({ zoom: view.getZoom() - 1, duration: 250 });
    }
  };



  useEffect(() => {

    mapGridRef.current = mapGridStyles;
    if (mapGridRef.current) {
      mapGridRef.current.setVisible(showGrid);
    }
  }, [showGrid]);

  function handleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    }
    else {
      document.exitFullscreen();
    }
  };

  function handleLocateMe() {
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

  //#endregion

  //#region Clear Map
  const handleClearDrawings = () => {
    if (vectorSourceRef.current) {
      vectorSourceRef.current.clear();
      setMeasurementValue('');
      setHasDrawings(false);
      setHasMeasurements(false);
    }
  };
  //#endregion

  //#region Print Map
  function handlePrintClick() {
    setActivePanel(activePanel === 'print' ? null : 'print');
    setIsPanelMinimized(false);
  };

  async function handleExportMap() {
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
  //#endregion

  //#region Theme Changes

  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  useEffect(() => {
    setBaseLayer(theme === 'dark' ? 'dark' : 'osm');
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    setTimeout(saveWorkspace, 0);
  };

  //#endregion

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className={`app-shell layout-${layoutMode}`}>
        {layoutMode === 'sidebar' && (
          <PrimarySidebar
            activePanel={activePanel}
            setActivePanel={(panel) => {
              setActivePanel(panel);
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
            onOpenLayerManagement={handleOpenLayerManagement}
            isLayerManagementOpen={showLayerManagement}
            layoutMode={layoutMode}
            onToggleLayout={toggleLayoutMode}
            isLocked={isLocked}
            setIsLocked={setIsLocked}
            showTopLegend={showTopLegend}
            setShowTopLegend={setShowTopLegend}
          />
        )}

        <div className="main-content">
          {layoutMode === 'topbar' && (
            <MapHeader
              onOpenLayerManagement={handleOpenLayerManagement}
              layoutMode={layoutMode}
              onToggleLayout={toggleLayoutMode}
              activePanel={activePanel}
              setActivePanel={(panel) => {
                setActivePanel(panel);
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
              onOpenLoadTempModal={() => setShowLoadTempModal(true)}
            />
          )}

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

            {/* Map Sidebar (Map Controls) */}
            <MapSidebar
              handleZoomIn={handleZoomIn}
              handleZoomOut={handleZoomOut}
              showGrid={showGrid}
              setShowGrid={setShowGrid}
              handleFullscreen={handleFullscreen}
              handleLocateMe={handleLocateMe}
              layoutMode={layoutMode}
            />

            {showTopLegend && (
              <TopLegendPanel
                layers={geoServerLayers.filter(l => l.visible)}
                onClose={() => setShowTopLegend(false)}
                getLegendUrl={getLegendUrl}
              />
            )}

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
              onOpenStyleEditor={handleLoadStyle}
              handleUpdateLayerStyle={handleUpdateLayerStyle}
              infoSelectionMode={infoSelectionMode}
              setInfoSelectionMode={setInfoSelectionMode}
              saveSequence={saveSequence}
              refreshLayers={handleFetchGeoServerLayers}
              selectedAttributeLayerId={selectedAttributeLayerId}
              setSelectedAttributeLayerId={setSelectedAttributeLayerId}
              showAttributeTable={showAttributeTable}
              setShowAttributeTable={setShowAttributeTable}
              GetLayerAttributes={getLayerAttributes}
              handleApplyLayerFilter={handleApplyLayerFilter}
              setShowQueryBuilder={setShowQueryBuilder}
              setQueryingLayer={setQueryingLayer}
              queryingLayer={queryingLayer}
              handleToggleSwipe={handleToggleSwipe}
              handleToggleSwipeAll={handleToggleSwipeAll}
              swipeLayerIds={swipeLayerIds}
              swipePosition={swipePosition}
              setSwipePosition={setSwipePosition}
              analysisLayerIds={analysisLayerIds}
              handleToggleAnalysisLayer={handleToggleAnalysisLayer}
              spatialJoinLayerIds={spatialJoinLayerIds}
              handleToggleSpatialJoinLayer={handleToggleSpatialJoinLayer}
              bookmarks={bookmarks}
              handleAddBookmark={handleAddBookmark}
              handleDeleteBookmark={handleDeleteBookmark}
              handleNavigateToBookmark={handleNavigateToBookmark}
              selectedQueryLayerIds={selectedQueryLayerIds}
              setSelectedQueryLayerIds={setSelectedQueryLayerIds}
              setShowSpatialJoin={setShowSpatialJoin}
              onOpenSpatialJoin={handleOpenSpatialJoin}
              allAvailableLayers={[...geoServerLayers, ...localVectorLayers]}
              showTopLegend={showTopLegend}
              setShowTopLegend={setShowTopLegend}
            />

            {/* Define allLayers for easy lookup */}
            {(() => {
              const allLayers = [...geoServerLayers, ...localVectorLayers];
              const activeAttributeLayer = allLayers.find(l => l.id === selectedAttributeLayerId || l.layerId === selectedAttributeLayerId);

              return (
                <>
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

                  <LoadTempLayerModal
                    isOpen={showLoadTempModal}
                    onClose={() => setShowLoadTempModal(false)}
                    onLayerLoaded={handleAddLocalVectorLayer}
                    existingNames={allLayers.map(l => l.name)}
                  />

                  {/* Attribute Table Card */}
                  {showAttributeTable && selectedAttributeLayerId && activeAttributeLayer && (
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
                      layerName={activeAttributeLayer.name || 'Unknown Layer'}
                      layerFullName={activeAttributeLayer.fullName}
                      layerId={selectedAttributeLayerId}
                      data={attributeTableData}
                      isLoading={isAttributeTableLoading}
                      isReadOnly={activeAttributeLayer.isLocal}
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
                          return true;
                        }

                        if (failCount > 0) {
                          toast.error(`Failed to update ${failCount} feature(s)`, { id: 'save-toast' });
                        }
                        return false;
                      }}
                      isMinimized={isAttributeTableMinimized}
                      onToggleMinimize={() => setIsAttributeTableMinimized(!isAttributeTableMinimized)}
                      drawings={availableDrawings}
                      onSaveNewAttribute={handleSaveNewAttribute}
                      geometryName={activeAttributeLayer.geometryFieldName}
                      geometryType={activeAttributeLayer.geometryType}
                      srid={activeAttributeLayer.srid}
                    />
                  )}
                </>
              );
            })()}

            <AnalysisCard
              isOpen={activeLayerTool === 'analysis' && analysisLayerIds.length > 0}
              onClose={() => setActiveLayerTool(null)}
              visibleLayers={geoServerLayers.filter(l => analysisLayerIds.includes(l.id))}
              onRunAnalysis={handleRunAnalysis}
              onUpdateStyle={handleUpdateLayerStyle}
              onReset={handleResetAnalysis}
              isPlaying={isAnalysisPlaying}
              currentFrameIndex={analysisFrameIndex}
              onPlaybackToggle={() => setIsAnalysisPlaying(!isAnalysisPlaying)}
              onFrameChange={(index) => setAnalysisFrameIndex(index)}
              isParentPanelMinimized={isPanelMinimized}
            />


            <QueryBuilderCard
              isOpen={showQueryBuilder}
              onClose={() => {
                setShowQueryBuilder(false);
                setQueryingLayer(null);
              }}
              activeLayer={queryingLayer}
              availableLayers={geoServerLayers}
              handleApplyLayerFilter={handleApplyLayerFilter}
              selectedLayerIds={selectedQueryLayerIds}
              setSelectedLayerIds={setSelectedQueryLayerIds}
              isParentPanelMinimized={isPanelMinimized}
            />

            <SpatialJoinCard
              isOpen={showSpatialJoin}
              onClose={() => setShowSpatialJoin(false)}
              allGeoServerLayers={geoServerLayers}
              selectedLayerIds={spatialJoinLayerIds}
              onPerformSpatialJoin={handlePerformSpatialJoin}
              onResetSpatialJoin={handleResetSpatialJoin}
              targetLayerId={activeSpatialJoinLayerId}
              isParentPanelMinimized={isPanelMinimized}
            />

            <StyleEditorCard
              isOpen={activeLayerTool === 'styles' && !!editingStyleLayer}
              onClose={() => {
                setEditingStyleLayer(null);
                setActiveLayerTool(null);
              }}
              editingLayer={editingStyleLayer}
              styleData={styleData}
              layerAttributes={layerStyleAttributes}
              isSaving={isSavingStyle}
              onSave={handleSaveStyle}
              onUpdateProp={updateStyleProp}
              onFileUpload={handleStyleFileUpload}
              isParentPanelMinimized={isPanelMinimized}
            />

            <CreateLayerCard
              isOpen={showCreateLayerModal}
              onClose={() => setShowCreateLayerModal(false)}
              handleLayerRefresh={handleFetchGeoServerLayers}
            />

            <LayerManagementCard
              isOpen={showLayerManagement}
              onClose={() => setShowLayerManagement(false)}
              data={layerManagementData}
              isLoading={isLayerManagementLoading}
              onDeleteFeature={handleDeleteLayerMetadata}
              onUpdateFeatures={handleUpdateLayerMetadata}
              onSaveNewFeature={handleSaveNewLayerMetadata}
              onRefresh={handleRefreshLayerManagement}
              onOpenLoadTempModal={() => {
                setShowLayerManagement(false);
                setShowLoadTempModal(true);
              }}
              onOpenCreateLayer={() => {
                setShowLayerManagement(false);
                setShowCreateLayerModal(true);
              }}
              onOpenDataManipulation={() => {
                setShowLayerManagement(false);
                setShowDataManipulationModal(true);
              }}
              onOpenServerInfo={() => {
                setShowLayerManagement(false);
                setShowServerInfoModal(true);
              }}
            />

            <DataManipulationCard
              isOpen={showDataManipulationModal}
              onClose={() => setShowDataManipulationModal(false)}
              geoServerLayers={geoServerLayers}
            />

            <ServerInfoCard
              isOpen={showServerInfoModal}
              onClose={() => setShowServerInfoModal(false)}
            />

            <MapStatusBar coordinates={coordinates} zoom={zoom} scale={scale} />
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
}

export default GISMap;
