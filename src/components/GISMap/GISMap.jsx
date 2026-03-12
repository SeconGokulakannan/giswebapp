import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useMap } from '../../context/MapContext';
import {
  initMap,
  handleGetFeatureInfo,
  addWMSLayerToMap,
  addVectorLayerToMap
} from '../../utils/mapUtils';
import { GEOSERVER_URL, AUTH_HEADER, MAP_DEFAULT_ZOOM } from '../../constants/AppConstants';
import { getNavSections } from '../../constants/MapControlConfig';

// Sub Components
import MapHeader from '../subComponents/MapHeader';
import PrimarySidebar from '../subComponents/PrimarySideBar';
import MapActionItems from '../subComponents/MapActionItems';
import MapSidebar from '../subComponents/MapSidebar';
import MapStatusBar from '../subComponents/MapStatusBar';
import MapPanel from '../subComponents/MapPanel';
import AttributeTable from '../subComponents/AttributeTableCard';
import QueryBuilderCard from '../subComponents/QueryBuilderCard';
import SpatialJoinCard from '../subComponents/SpatialJoinCard';
import StyleEditorCard from '../subComponents/StyleEditorCard';

// Hooks
import { useBaseMap } from '../subComponents/BaseMapSelector';

// Style
import '../../styles/GISMap.css';

const GISMap = () => {
  // Context
  const {
    mapRef,
    mapInstanceRef,
    operationalLayersRef,
    geoServerLayers, setGeoServerLayers,
    isLocked, setIsLocked,
    layoutMode,
    theme, setTheme,
    saveWorkspace
  } = useMap();

  // UI State
  const [activePanel, setActivePanel] = useState(null);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [activeLayerTool, setActiveLayerTool] = useState(null);
  const [infoSelectionMode, setInfoSelectionMode] = useState(false);
  const [saveSequence, setSaveSequence] = useState(0);

  // Layer Interaction States
  const [activeHighlightLayerId, setActiveHighlightLayerId] = useState(null);
  const [isHighlightAnimating, setIsHighlightAnimating] = useState(false);

  // Feature & Attribute States
  const [showAttributeTable, setShowAttributeTable] = useState(false);
  const [selectedAttributeLayerId, setSelectedAttributeLayerId] = useState(null);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [queryingLayer, setQueryingLayer] = useState(null);
  const [selectedQueryLayerIds, setSelectedQueryLayerIds] = useState([]);
  const [showSpatialJoin, setShowSpatialJoin] = useState(false);
  const [showStyleEditor, setShowStyleEditor] = useState(false);
  const [styleEditingLayer, setStyleEditingLayer] = useState(null);

  // Tools Hook
  const { baseLayer, setBaseLayer } = useBaseMap();

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    const savedView = localStorage.getItem('gis_view');
    const viewConfig = savedView ? JSON.parse(savedView) : {
      center: [8638063.15, 1450280.08],
      zoom: MAP_DEFAULT_ZOOM
    };

    const map = initMap(mapRef.current, viewConfig);
    mapInstanceRef.current = map;

    // Info popup interaction
    map.on('singleclick', (evt) => {
      if (!infoSelectionMode || isLocked) return;
      handleGetFeatureInfo(evt, map, geoServerLayers);
    });

    // Auto-save on move
    map.on('moveend', saveWorkspace);

    // Load Initial Layers (Example from previous implementation)
    const initialLayers = [
      { id: 'tn_districts', name: 'Districts', visible: true, type: 'wms' },
      { id: 'tn_state_boundary', name: 'State Boundary', visible: true, type: 'wms' }
    ];

    initialLayers.forEach(layer => {
      const olLayer = addWMSLayerToMap(map, GEOSERVER_URL, `cite:${layer.id}`, layer.id, layer.visible);
      operationalLayersRef.current[layer.id] = olLayer;
    });

    setGeoServerLayers(initialLayers);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
      }
    };
  }, []);

  // Tool Actions
  const resetTools = useCallback(() => {
    // Implement global reset logic if needed
  }, []);

  const handleToggleGeoLayer = (id) => {
    const layer = operationalLayersRef.current[id];
    if (layer) {
      const newVisibility = !layer.getVisible();
      layer.setVisible(newVisibility);
      setGeoServerLayers(prev => prev.map(l => l.id === id ? { ...l, visible: newVisibility } : l));
    }
  };

  const handleLayerOpacityChange = (id, opacity) => {
    const layer = operationalLayersRef.current[id];
    if (layer) {
      layer.setOpacity(opacity);
      setGeoServerLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l));
    }
  };

  const handleZoomToLayer = (id) => {
    const layer = operationalLayersRef.current[id];
    if (layer && mapInstanceRef.current) {
      const source = layer.getSource();
      // Complex WMS extent logic or fixed zoom
      mapInstanceRef.current.getView().animate({ zoom: 8, duration: 1000 });
    }
  };

  const handleHighlightLayer = (id) => {
    setActiveHighlightLayerId(id === activeHighlightLayerId ? null : id);
    setIsHighlightAnimating(true);
    setTimeout(() => setIsHighlightAnimating(false), 2000);
  };

  const handleToggleAllLayers = (visible) => {
    geoServerLayers.forEach(l => {
      const layer = operationalLayersRef.current[l.id];
      if (layer) layer.setVisible(visible);
    });
    setGeoServerLayers(prev => prev.map(l => ({ ...l, visible })));
  };

  const GetLayerAttributes = async (layerId) => {
    // Mocking attribute fetch for now
    return [{ id: 1, name: 'Feature 1' }];
  };

  const handleApplyLayerFilter = (layerId, filter) => {
    // Implement CQL Filter logic
    setSaveSequence(prev => prev + 1);
  };

  const onOpenStyleEditor = (layer) => {
    setStyleEditingLayer(layer);
    setShowStyleEditor(true);
  };

  return (
    <Tooltip.Provider delayDuration={400}>
      <div className={`gis-app-container ${theme}-theme layout-${layoutMode} ${isLocked ? 'map-locked' : ''}`}>
        <Toaster position="top-right" toastOptions={{
          style: {
            background: theme === 'dark' ? '#1a1a1a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#333',
            border: `1px solid ${theme === 'dark' ? '#333' : '#e5e7eb'}`,
          }
        }} />

        {/* Layout Shell */}
        <div className={`map-workspace ${layoutMode}`}>
          <MapHeader
            layoutMode={layoutMode}
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            resetTools={resetTools}
          />

          <div className="main-content-area">
            <PrimarySidebar
              activePanel={activePanel}
              setActivePanel={setActivePanel}
              isPanelMinimized={isPanelMinimized}
              setIsPanelMinimized={setIsPanelMinimized}
              resetTools={resetTools}
            />

            <div className="map-view-container">
              <div ref={mapRef} className="ol-map-container" />

              {/* Map Navigation & Controls */}
              <MapSidebar
                handleZoomIn={() => mapInstanceRef.current?.getView().animate({ zoom: (mapInstanceRef.current?.getView().getZoom() || 0) + 1, duration: 250 })}
                handleZoomOut={() => mapInstanceRef.current?.getView().animate({ zoom: (mapInstanceRef.current?.getView().getZoom() || 0) - 1, duration: 250 })}
                layoutMode={layoutMode}
              />

              {/* Floating Action Buttons */}
              <div className="floating-actions-container">
                <MapActionItems
                  sections={getNavSections({
                    activePanel,
                    setActivePanel,
                    setIsPanelMinimized,
                    isLocked,
                    setIsLocked,
                    theme,
                    toggleTheme: () => setTheme(theme === 'light' ? 'dark' : 'light'),
                    handleClearDrawings: resetTools
                  })}
                  variant="icon-only"
                />
              </div>

              <MapStatusBar />

              {/* Overlay Cards/Panels */}
              <MapPanel
                activePanel={activePanel}
                setActivePanel={setActivePanel}
                isPanelMinimized={isPanelMinimized}
                setIsPanelMinimized={setIsPanelMinimized}
                baseLayer={baseLayer}
                setBaseLayer={setBaseLayer}
                resetTools={resetTools}
                geoServerLayers={geoServerLayers}
                handleToggleGeoLayer={handleToggleGeoLayer}
                handleLayerOpacityChange={handleLayerOpacityChange}
                handleZoomToLayer={handleZoomToLayer}
                handleHighlightLayer={handleHighlightLayer}
                handleToggleAllLayers={handleToggleAllLayers}
                activeLayerTool={activeLayerTool}
                setActiveLayerTool={setActiveLayerTool}
                activeHighlightLayerId={activeHighlightLayerId}
                isHighlightAnimating={isHighlightAnimating}
                onOpenStyleEditor={onOpenStyleEditor}
                infoSelectionMode={infoSelectionMode}
                setInfoSelectionMode={setInfoSelectionMode}
                saveSequence={saveSequence}
                selectedAttributeLayerId={selectedAttributeLayerId}
                setSelectedAttributeLayerId={setSelectedAttributeLayerId}
                showAttributeTable={showAttributeTable}
                setShowAttributeTable={setShowAttributeTable}
                GetLayerAttributes={GetLayerAttributes}
                handleApplyLayerFilter={handleApplyLayerFilter}
                setShowQueryBuilder={setShowQueryBuilder}
                setQueryingLayer={setQueryingLayer}
                queryingLayer={queryingLayer}
                selectedQueryLayerIds={selectedQueryLayerIds}
                setSelectedQueryLayerIds={setSelectedQueryLayerIds}
                setShowSpatialJoin={setShowSpatialJoin}
              />

              {/* Full Overlay Modals/Cards */}
              {showQueryBuilder && (
                <QueryBuilderCard
                  layer={queryingLayer}
                  onClose={() => setShowQueryBuilder(false)}
                />
              )}

              {showSpatialJoin && (
                <SpatialJoinCard
                  onClose={() => setShowSpatialJoin(false)}
                />
              )}

              {showStyleEditor && (
                <StyleEditorCard
                  layer={styleEditingLayer}
                  onClose={() => setShowStyleEditor(false)}
                  onUpdateStyle={(id, s) => {
                    setSaveSequence(prev => prev + 1);
                    setShowStyleEditor(false);
                  }}
                />
              )}

              {showAttributeTable && (
                <AttributeTable
                  layerId={selectedAttributeLayerId}
                  features={selectedFeatures}
                  onClose={() => setShowAttributeTable(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
};

export default GISMap;
