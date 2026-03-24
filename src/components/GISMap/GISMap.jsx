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
import { DragPan, DragBox } from 'ol/interaction';
import { always } from 'ol/events/condition';
import { Stroke, Style, Circle as CircleStyle, Fill } from 'ol/style';
import Feature from 'ol/Feature';
import { fromLonLat, toLonLat } from 'ol/proj';
import Point from 'ol/geom/Point';
import { defaults as defaultControls } from 'ol/control';
import GeoJSON from 'ol/format/GeoJSON';

// Sub-components
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
import * as Tooltip from '@radix-ui/react-tooltip';

//Map Utils
import { mapGridStyles } from '../../utils/mapUtils';

// Service from Server.js
// Service Utilities (Localised)

const getWMSSourceParams = (layerName) => ({
  url: `${GEOSERVER_URL}/wms`,
  params: { 'LAYERS': layerName, 'TILED': true },
  serverType: 'geoserver',
  transition: 0,
});

import { getGeoServerLayers, saveSequence } from '../../services/Server';
import { getLayerAttributes, getFeaturesForAttributeTable, getLayerStyle, updateLayerStyle, setLayerDefaultStyle, SaveNewAttribute, getLegendUrl, getLegendRuleUrl, fetchLegendRules, uploadIcon } from '../subComponents/LayerOperations';

// Server Credentials
import { GEOSERVER_URL, AUTH_HEADER } from '../../services/ServerCredentials';

// Constants
import { MAP_DEFAULT_ZOOM } from '../../constants/AppConstants';

// Custom Hooks from subComponents
import { useLayerVisibility, useLayerActions } from '../subComponents/LayerOperations';
import { useSwipeTool } from '../subComponents/SwipeControl';
import { useLayerManagement } from '../subComponents/LayerManagementCard';
import { useSpatialJoinLogic } from '../subComponents/SpatialJoinCard';
import { useAnalysisLogic } from '../subComponents/AnalysisCard';
import { useQueryBuilder } from '../subComponents/QueryBuilderCard';
import { useBaseMap } from '../subComponents/BaseMapSelector';
import { useDrawingTools } from '../../hooks/useDrawingTools';
import { useMeasureTools } from '../../hooks/useMeasureTools';
import { useLocationTools } from '../../hooks/useLocationTools';
import { useBookmarkTools } from '../../hooks/useBookmarkTools';
import { usePrintTools } from '../../hooks/usePrintTools';

function GISMap() {


  //map refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const selectionSourceRef = useRef(null);
  const operationalLayersRef = useRef({}); // Track layer instances


  //map states
  const [coordinates, setCoordinates] = useState({ lon: 0, lat: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MAP_DEFAULT_ZOOM);
  const [scale, setScale] = useState('0 km');



  // Theme and BaseMap
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const { baseLayer, setBaseLayer } = useBaseMap(mapInstanceRef, theme);
  const [activePanel, setActivePanel] = useState(null);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);

  // Map Lock 
  const [isLocked, setIsLocked] = useState(false);
  const [layoutMode, setLayoutMode] = useState('sidebar');

  useEffect(() => {
    localStorage.setItem('gis-layout-mode', 'sidebar');
  }, []);

  const toggleLayoutMode = () => {
    const newMode = layoutMode === 'sidebar' ? 'topbar' : 'sidebar';
    setLayoutMode(newMode);
    localStorage.setItem('gis-layout-mode', newMode);

    // Reset panels when switching layouts to avoid positioning jitters
    setActivePanel(null);
  };

  const printTools = usePrintTools(mapRef, theme);

  // ELITE: Base tool states remaining in GISMap for simplicity or shared access
  const [activeLayerTool, setActiveLayerTool] = useState('visibility');
  const [infoSelectionMode, setInfoSelectionMode] = useState('click'); // 'click' or 'drag'
  const activeLayerToolRef = useRef(activeLayerTool);
  const infoSelectionModeRef = useRef(infoSelectionMode);

  // ELITE: Use Custom Hooks for Modular Logic
  const {
    geoServerLayers, setGeoServerLayers,
    localVectorLayers, setLocalVectorLayers,
    handleToggleGeoLayer, handleToggleAllLayers,
    handleLayerOpacityChange, handleToggleLayerQuery,
    handleApplyLayerFilter, handleApplyMultiLayerFilters,
    handleAddLocalVectorLayer
  } = useLayerVisibility([], []);

  // Sync refs for stable access in OL callbacks if needed
  const geoServerLayersRef = useRef(geoServerLayers);
  const localVectorLayersRef = useRef(localVectorLayers);

  const {
    activeZoomLayerId, setActiveZoomLayerId,
    activeHighlightLayerId, setActiveHighlightLayerId,
    isHighlightAnimating, setIsHighlightAnimating,
    handleZoomToLayer, handleHighlightLayer
  } = useLayerActions(mapInstanceRef, operationalLayersRef);

  const activeHighlightLayerIdRef = useRef(activeHighlightLayerId);
  const isHighlightAnimatingRef = useRef(isHighlightAnimating);

  const {
    swipeLayerIds, setSwipeLayerIds,
    swipePosition, setSwipePosition,
    handleToggleSwipe, handleToggleSwipeAll
  } = useSwipeTool(mapInstanceRef, operationalLayersRef, geoServerLayers, localVectorLayers, handleToggleGeoLayer);

  const {
    showLayerManagement, setShowLayerManagement,
    layerManagementData, setLayerManagementData,
    isLayerManagementLoading, handleRefreshLayerManagement,
    handleOpenLayerManagement,
    handleDeleteLayerMetadata, handleUpdateLayerMetadata, handleSaveNewLayerMetadata
  } = useLayerManagement();

  const {
    showSpatialJoin, setShowSpatialJoin,
    activeSpatialJoinLayerId, setActiveSpatialJoinLayerId,
    spatialJoinLayerIds, setSpatialJoinLayerIds,
    handleOpenSpatialJoin, handleToggleSpatialJoinLayer
  } = useSpatialJoinLogic(mapInstanceRef, geoServerLayers, setGeoServerLayers);

  const {
    analysisLayerIds,
    handleToggleAnalysisLayer
  } = useAnalysisLogic();

  const {
    showQueryBuilder, setShowQueryBuilder,
    queryingLayer, setQueryingLayer,
    selectedQueryLayerIds, setSelectedQueryLayerIds,
  } = useQueryBuilder();

  const bookmarkTools = useBookmarkTools(mapInstanceRef);

  const saveWorkspace = () => {
    // Save View State
    const view = mapInstanceRef.current?.getView();
    if (view) {
      localStorage.setItem('gis_view', JSON.stringify({
        center: view.getCenter(),
        zoom: view.getZoom()
      }));
    }
  };

  const drawingTools = useDrawingTools(
    mapInstanceRef,
    geoServerLayers,
    operationalLayersRef,
    isLocked,
    isHighlightAnimatingRef,
    activeHighlightLayerIdRef,
    saveWorkspace
  );

  const measureTools = useMeasureTools(
    mapInstanceRef,
    drawingTools.vectorSourceRef, // Shared vector source
    drawingTools.vectorLayerRef,  // Shared vector layer for redraws
    saveWorkspace
  );

  const locationTools = useLocationTools(mapInstanceRef, drawingTools);

  const [featureInfoResult, setFeatureInfoResult] = useState(null);
  const [featureInfoCoordinate, setFeatureInfoCoordinate] = useState(null);
  const [mapRenderKey, setMapRenderKey] = useState(0); // Forces card re-render on map move
  const [selectedAttributeLayerId, setSelectedAttributeLayerId] = useState(null);
  const [showAttributeTable, setShowAttributeTable] = useState(false);
  const [isAttributeTableMinimized, setIsAttributeTableMinimized] = useState(false);
  const [attributeTableData, setAttributeTableData] = useState([]);
  const [isAttributeTableLoading, setIsAttributeTableLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const featureInfoOverlayRef = useRef(null);
  const popupElementRef = useRef(null);
  const dragBoxRef = useRef(null);
  const [showLoadTempModal, setShowLoadTempModal] = useState(false);

  // Modal and Panel states
  const [showCreateLayerModal, setShowCreateLayerModal] = useState(false);
  const [showDataManipulationModal, setShowDataManipulationModal] = useState(false);
  const [showServerInfoModal, setShowServerInfoModal] = useState(false);


  // Analysis and Style states
  const [showTopLegend, setShowTopLegend] = useState(false);
  const [editingStyleLayer, setEditingStyleLayer] = useState(null);
  const [styleData, setStyleData] = useState(null);
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [layerStyleAttributes, setLayerStyleAttributes] = useState([]);


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




  //#region Zoom / Highlight / 

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


  //#endregion








  // ELITE: Cleanup Heavy Tools when switching between them
  useEffect(() => {
    // Determine which tools are NOT current
    const isQB = activeLayerTool === 'querybuilder';
    const isSJ = activeLayerTool === 'spatialjoin';
    const isAnalysis = activeLayerTool === 'analysis';
    const isStyles = activeLayerTool === 'styles';
    const isSwipe = activeLayerTool === 'swipe';

    // 1. Reset Query Builder if not active
    // ELITE: Also clear CQL filters from all layers
    if (!isQB) {
      if (showQueryBuilder || queryingLayer || selectedQueryLayerIds.length > 0) {
        setShowQueryBuilder(false);
        setQueryingLayer(null);
        setSelectedQueryLayerIds([]);
      }

      // Clear filters if any exist
      const hasFilters = geoServerLayers.some(l => l.cqlFilter);
      if (hasFilters) {
        setGeoServerLayers(prev => prev.map(l => l.cqlFilter ? { ...l, cqlFilter: null } : l));
        toast.success("Query filters cleared.", { id: 'qb-reset-toast' });
      }
    }

    // 2. Reset Spatial Join if not active
    if (!isSJ) {
      if (showSpatialJoin || activeSpatialJoinLayerId || spatialJoinLayerIds.length > 0) {
        setShowSpatialJoin(false);
        setActiveSpatialJoinLayerId(null);
        setSpatialJoinLayerIds([]);
      }
    }



    // 4. Reset Layer Styles if not active
    if (!isStyles && editingStyleLayer) {
      setEditingStyleLayer(null);
      setStyleData(null);
    }

    // 5. Reset Swipe if not active
    if (!isSwipe && swipeLayerIds.length > 0) {
      setSwipeLayerIds([]);
    }
  }, [activeLayerTool]);

  const hexToRgb = (hex) => {
    if (!hex) return { r: 99, g: 102, b: 241 };
    const clean = String(hex).replace('#', '').trim();
    const normalized = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    if (normalized.length !== 6) return { r: 99, g: 102, b: 241 };
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    if ([r, g, b].some(v => Number.isNaN(v))) return { r: 99, g: 102, b: 241 };
    return { r, g, b };
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
    const isPointLayer = String(editingStyleLayer.geometryType || '').toLowerCase().includes('point');
    if (!isPointLayer) {
      toast.error('Symbology upload is only available for point layers.');
      e.target.value = '';
      return;
    }

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
    } finally {
      e.target.value = '';
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
        if (drawingTools.activeTool) {
          drawingTools.setActiveTool(null);
          drawingTools.removeInteractions();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activePanel]);






  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

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
        mapGridStyles
      ],
      view: new View({
        center: savedView ? savedView.center : fromLonLat([0, 20]),
        zoom: savedView ? savedView.zoom : 2,
      }),
      controls: defaultControls({ attribution: false, zoom: false, rotate: false }),
    });

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
      //triggerAutoSave(); // Save view state on movement

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
    const interactions = mapInstanceRef.current.getInteractions();
    interactions.forEach((interaction) => {
      if (interaction instanceof DragPan) {
        interaction.setActive(!isLocked && drawingTools.activeTool !== 'ZoomBox');
      }
    });
  }, [isLocked, drawingTools.activeTool]);

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

  //#endregion

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    setTimeout(saveWorkspace, 0);
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className={`app-shell layout-${layoutMode}`}>
        {layoutMode === 'sidebar' && (
          <PrimarySidebar
            activePanel={activePanel}
            setActivePanel={(panel) => {
              setActivePanel(panel);
              if (panel !== null && panel !== 'tools' && panel !== 'utility_tools' && panel !== 'print') {
                drawingTools.setActiveTool(null);
                drawingTools.removeInteractions();
              }
            }}
            setIsPanelMinimized={setIsPanelMinimized}
            toggleTheme={toggleTheme}
            theme={theme}
            handleClearDrawings={drawingTools.handleClearDrawings}
            handlePrintClick={() => {
              setActivePanel(activePanel === 'print' ? null : 'print');
              setIsPanelMinimized(false);
            }}
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

        <div className={`main-content layout-${layoutMode}`}>
          {layoutMode === 'topbar' && (
            <MapHeader
              onOpenLayerManagement={handleOpenLayerManagement}
              isLayerManagementOpen={showLayerManagement}
              layoutMode={layoutMode}
              onToggleLayout={toggleLayoutMode}
              activePanel={activePanel}
              setActivePanel={(panel) => {
                setActivePanel(panel);
                if (panel !== null && panel !== 'tools' && panel !== 'utility_tools' && panel !== 'print') {
                  drawingTools.setActiveTool(null);
                  drawingTools.removeInteractions();
                }
              }}
              setIsPanelMinimized={setIsPanelMinimized}
              toggleTheme={toggleTheme}
              theme={theme}
              handleClearDrawings={drawingTools.handleClearDrawings}
              handlePrintClick={handlePrintClick}
              isLocked={isLocked}
              setIsLocked={setIsLocked}
              activeTool={drawingTools.activeTool}
              handleToolClick={drawingTools.handleToolClick}
              hasDrawings={drawingTools.hasDrawings}
              hasMeasurements={drawingTools.hasMeasurements}
              onOpenLoadTempModal={() => setShowLoadTempModal(true)}
              showTopLegend={showTopLegend}
              setShowTopLegend={setShowTopLegend}
            />
          )}

          {/* Map Container */}
          <div className="map-container">
            <div ref={mapRef} className="map" />
            {drawingTools.activeTool === 'ZoomBox' && (
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
                getLegendRuleUrl={getLegendRuleUrl}
                fetchLegendRules={fetchLegendRules}
              />
            )}

            <MapPanel
              activePanel={activePanel}
              setActivePanel={(panel) => {
                setActivePanel(panel);
                if (panel !== null && panel !== 'tools' && panel !== 'utility_tools' && panel !== 'print') {
                  drawingTools.setActiveTool(null);
                  drawingTools.removeInteractions();
                  measureTools.setActiveMeasureTool(null);
                  measureTools.removeMeasureInteractions();
                }
                if (panel === null) {
                  setActiveLayerTool(null);
                }
              }}
              isPanelMinimized={isPanelMinimized}
              setIsPanelMinimized={setIsPanelMinimized}
              layoutMode={layoutMode}
              baseLayer={baseLayer}
              setBaseLayer={setBaseLayer}
              isDrawingVisible={drawingTools.isDrawingVisible}
              setIsDrawingVisible={drawingTools.setIsDrawingVisible}

              // Drawing Tools Props
              activeTool={drawingTools.activeTool}
              handleToolClick={(tool) => {
                measureTools.setActiveMeasureTool(null);
                drawingTools.handleToolClick(tool);
              }}
              showDrawingLabels={drawingTools.showDrawingLabels}
              setShowDrawingLabels={drawingTools.setShowDrawingLabels}
              handleClearDrawings={drawingTools.handleClearDrawings}

              // Measurement Tools Props
              activeMeasureTool={measureTools.activeMeasureTool}
              handleMeasureClick={(type) => {
                drawingTools.setActiveTool(null);
                measureTools.handleMeasureClick(type);
              }}
              showMeasureLabels={measureTools.showMeasureLabels}
              setShowMeasureLabels={measureTools.setShowMeasureLabels}
              handleClearMeasurements={measureTools.clearMeasurements}

              measurementUnits={measureTools.measurementUnits}
              setMeasurementUnits={measureTools.setMeasurementUnits}

              // Location Tools Props
              gotoLat={locationTools.gotoLat}
              setGotoLat={locationTools.setGotoLat}
              gotoLon={locationTools.gotoLon}
              setGotoLon={locationTools.setGotoLon}
              handleGoToLocation={locationTools.handleGoToLocation}
              handleSearch={locationTools.handleSearch}
              isSearching={locationTools.isSearching}

              resetTools={() => {
                drawingTools.resetTools();
                measureTools.setActiveMeasureTool(null);
                measureTools.removeMeasureInteractions();
                locationTools.setGotoLat('');
                locationTools.setGotoLon('');
              }}

              // Print Tools Props
              printTitle={printTools.printTitle}
              setPrintTitle={printTools.setPrintTitle}
              printSubtitle={printTools.printSubtitle}
              setPrintSubtitle={printTools.setPrintSubtitle}
              printFileName={printTools.printFileName}
              setPrintFileName={printTools.setPrintFileName}
              exportFormat={printTools.exportFormat}
              setExportFormat={printTools.setExportFormat}
              handleExportMap={printTools.handleExportMap}
              isExporting={printTools.isExporting}

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
              // Bookmark Tools Props
              bookmarks={bookmarkTools.bookmarks}
              handleAddBookmark={bookmarkTools.handleAddBookmark}
              handleDeleteBookmark={bookmarkTools.handleDeleteBookmark}
              handleNavigateToBookmark={bookmarkTools.handleNavigateToBookmark}
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
                          if (drawingTools.selectionSourceRef.current) drawingTools.selectionSourceRef.current.clear();
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
                        if (drawingTools.selectionSourceRef.current) {
                          drawingTools.selectionSourceRef.current.clear();
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
                        if (drawingTools.selectionSourceRef.current) {
                          drawingTools.selectionSourceRef.current.clear();
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
                            if (drawingTools.selectionSourceRef.current) {
                              drawingTools.selectionSourceRef.current.addFeature(olFeature);
                            }
                          } catch (error) {
                            console.error('Error parsing feature for highlight:', error, feature);
                          }
                        });

                        // Zoom to highlighted features
                        if (drawingTools.selectionSourceRef.current && drawingTools.selectionSourceRef.current.getFeatures().length > 0) {
                          const extent = drawingTools.selectionSourceRef.current.getExtent();
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
                        if (drawingTools.selectionSourceRef.current) {
                          drawingTools.selectionSourceRef.current.clear();
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
                      drawings={drawingTools.availableDrawings}
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
              setGeoServerLayers={setGeoServerLayers}
              mapInstance={mapInstanceRef.current}
              mapRef={mapRef}
              theme={theme}
              isParentPanelMinimized={isPanelMinimized}
              layoutMode={layoutMode}
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
              mapRef={mapRef}
              selectionSource={drawingTools.selectionSourceRef.current}
              theme={theme}
              isParentPanelMinimized={isPanelMinimized}
              layoutMode={layoutMode}
            />

            <SpatialJoinCard
              isOpen={showSpatialJoin}
              onClose={() => setShowSpatialJoin(false)}
              allGeoServerLayers={geoServerLayers}
              setGeoServerLayers={setGeoServerLayers}
              selectedLayerIds={spatialJoinLayerIds}
              mapInstance={mapInstanceRef.current}
              targetLayerId={activeSpatialJoinLayerId}
              isParentPanelMinimized={isPanelMinimized}
              layoutMode={layoutMode}
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
              layoutMode={layoutMode}
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


