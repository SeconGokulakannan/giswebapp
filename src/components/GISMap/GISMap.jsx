import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import '../../styles/GISMap.css';
import '../../styles/responsive.css';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Draw, Modify, Snap, DragPan, DragZoom } from 'ol/interaction';
import { createRegularPolygon } from 'ol/interaction/Draw';
import { always } from 'ol/events/condition';
import { Stroke, Style, Circle as CircleStyle, Fill } from 'ol/style';
import Feature from 'ol/Feature';
import { fromLonLat, toLonLat } from 'ol/proj';
import { LineString, Point } from 'ol/geom';
import { defaults as defaultControls } from 'ol/control';
import GeoJSON from 'ol/format/GeoJSON';
import Graticule from 'ol/layer/Graticule';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Ruler, Lock, Unlock } from 'lucide-react';

// Sub-components
import MapHeader from './subcomponents/MapHeader';
import MapSidebar from './subcomponents/MapSidebar';
import MapPanel from './subcomponents/MapPanel';
import MapStatusBar from './subcomponents/MapStatusBar';

// Utils
import {
  style,
  modifyStyle,
  styleFunction,
  formatLength,
  formatArea,
  searchLocation,
} from '../../utils/mapUtils';


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
  const [measurementUnits, setMeasurementUnits] = useState(() => {
    return localStorage.getItem('measurementUnits') || 'metric';
  });
  const measurementUnitsRef = useRef(measurementUnits);
  const activeFeatureRef = useRef(null);

  // Persistence: Save Workspace to LocalStorage
  const saveWorkspace = () => {
    if (!vectorSourceRef.current || !mapInstanceRef.current) return;

    // Save Drawings
    const format = new GeoJSON();
    const features = vectorSourceRef.current.getFeatures();
    const json = format.writeFeatures(features);
    localStorage.setItem('gis_drawings', json);

    // Save Settings
    localStorage.setItem('measurementUnits', measurementUnitsRef.current);
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
    saveWorkspace();

    // Refresh map labels instantly
    if (vectorLayerRef.current) {
      vectorLayerRef.current.changed();
    }

    // Refresh active interaction labels
    if (drawInteractionRef.current) {
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
  }, [measurementUnits]);

  // ELITE: Debounced background save
  const saveTimeoutRef = useRef(null);
  const triggerAutoSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(saveWorkspace, 1000);
  };

  // Initialize theme from localStorage
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


  // ELITE ANIMATION: Energy Flow & Sonar
  const animationOffsetRef = useRef(0);
  const animationFrameRef = useRef(null);

  // High-performance animation loop (Non-blocking)
  useEffect(() => {
    const animate = () => {
      animationOffsetRef.current = (animationOffsetRef.current + 0.8) % 30;

      // Trigger map redraw without React re-render
      if (vectorLayerRef.current) {
        vectorLayerRef.current.changed();
      }

      // Also animate interactions if active
      if (drawInteractionRef.current) {
        const overlaySource = drawInteractionRef.current.getOverlay().getSource();
        overlaySource.getFeatures().forEach((f) => f.changed());
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
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

    // Auto-save triggers
    vectorSource.on(['addfeature', 'removefeature', 'changefeature'], triggerAutoSave);

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: (feature) => styleFunction(feature, true, null, null, animationOffsetRef.current, measurementUnitsRef.current),
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
    map.on('click', (evt) => {
      const pixel = map.getPixelFromCoordinate(evt.coordinate);
      const ripple = document.createElement('div');
      ripple.className = 'sonar-ripple';
      ripple.style.left = `${pixel[0]}px`;
      ripple.style.top = `${pixel[1]}px`;
      mapRef.current.appendChild(ripple);
      setTimeout(() => ripple.remove(), 1000);
    });

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

    const draw = new Draw({
      source: vectorSourceRef.current,
      type: type === 'Circle' ? 'Circle' : type,
      geometryFunction: type === 'Circle' ? createRegularPolygon(64) : undefined,
      style: (feature) => styleFunction(feature, false, type, null, animationOffsetRef.current, measurementUnitsRef.current),
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
        return styleFunction(feature, true, drawType, tip, animationOffsetRef.current, measurementUnitsRef.current);
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

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="app">
        <MapHeader
          activePanel={activePanel}
          setActivePanel={(panel) => {
            setActivePanel(panel);
            // Only deactivate tools if explicitly switching to a different non-tool panel region
            if (panel !== null && panel !== 'tools' && panel !== 'utility_tools') {
              setActiveTool(null);
              removeInteractions();
            }
          }}
          setIsPanelMinimized={setIsPanelMinimized}
          toggleTheme={toggleTheme}
          theme={theme}
          handleClearDrawings={handleClearDrawings}
          handleSearch={handleSearch}
          isLocked={isLocked}
          setIsLocked={setIsLocked}
          activeTool={activeTool}
          handleToolClick={handleToolClick}
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
            measurementUnits={measurementUnits}
            setMeasurementUnits={setMeasurementUnits}
          />
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
