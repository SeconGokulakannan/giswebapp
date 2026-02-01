import * as Tooltip from '@radix-ui/react-tooltip';
import {
    Map as MapIcon,
    Satellite,
    Mountain,
    PenTool,
    MapPinned,
    Waypoints,
    Pentagon,
    Orbit,
    DraftingCompass,
    Focus,
    ChevronLeft,
    ChevronRight,
    SquareDashed,
} from 'lucide-react';

const MapPanel = ({
    activePanel,
    setActivePanel,
    isPanelMinimized,
    setIsPanelMinimized,
    baseLayer,
    setBaseLayer,
    isDrawingVisible,
    setIsDrawingVisible,
    activeTool,
    handleToolClick,
    handleMeasureClick,
    gotoLat,
    setGotoLat,
    gotoLon,
    setGotoLon,
    handleGoToLocation,
    measurementUnits,
    setMeasurementUnits,
}) => {
    if (!activePanel) return null;

    return (
        <div className={`panel ${isPanelMinimized ? 'minimized' : ''}`}>
            <div className="panel-header">
                <div className="panel-header-text">
                    <h3>
                        {activePanel === 'basemaps' && 'Base Maps'}
                        {activePanel === 'layers' && 'GIS Layers'}
                        {activePanel === 'tools' && 'Drawing Tools'}
                        {activePanel === 'utility_tools' && 'Tools'}
                        {activePanel === 'location' && 'Go to Location'}
                    </h3>
                    <p>
                        {activePanel === 'basemaps' && 'Choose your map background'}
                        {activePanel === 'layers' && 'Manage operational data layers'}
                        {activePanel === 'tools' && 'Create features on the map'}
                        {activePanel === 'utility_tools' && 'Measure and Analyze Map Data'}
                        {activePanel === 'location' && 'Enter precise coordinates'}
                    </p>
                </div>
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button
                            className="minimize-btn"
                            onClick={() => {
                                setIsPanelMinimized(!isPanelMinimized);
                                if (!isPanelMinimized) {
                                    setTimeout(() => setActivePanel(null), 300);
                                }
                            }}
                        >
                            {isPanelMinimized ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" sideOffset={5}>
                            {isPanelMinimized ? 'Expand' : 'Minimize'} panel
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>
            </div>

            <div className="panel-content">
                {activePanel === 'basemaps' && (
                    <div className="panel-section">
                        <div className="panel-section-title">Base Map Style</div>
                        <div className="layer-grid basemaps-minimal">
                            {[
                                { id: 'osm', name: 'Street Map', img: '/assets/basemaps/osm.png', tip: 'Default street map' },
                                { id: 'satellite', name: 'Satellite', img: '/assets/basemaps/satellite.png', tip: 'Aerial imagery' },
                                { id: 'terrain', name: 'Topo', img: '/assets/basemaps/terrain.png', tip: 'Topographic terrain' },
                                { id: 'dark', name: 'Dark', img: '/assets/basemaps/dark.png', tip: 'Night-optimized map' },
                                { id: 'light', name: 'Light', img: '/assets/basemaps/light.png', tip: 'Clean light map' },
                                { id: 'street', name: 'Navigation', img: '/assets/basemaps/navigation.png', tip: 'Driving-optimized view' },
                            ].map((layer) => (
                                <Tooltip.Root key={layer.id}>
                                    <Tooltip.Trigger asChild>
                                        <div
                                            className={`layer-card minimal-card ${baseLayer === layer.id ? 'active' : ''}`}
                                            onClick={() => setBaseLayer(layer.id)}
                                        >
                                            <div className="card-image-wrapper">
                                                <img src={layer.img} alt={layer.name} />
                                                <div className="card-overlay">
                                                    <span className="card-name">{layer.name}</span>
                                                    {baseLayer === layer.id && (
                                                        <div className="card-status">
                                                            <MapIcon size={12} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal>
                                        <Tooltip.Content className="TooltipContent" sideOffset={5}>
                                            {layer.tip}
                                            <Tooltip.Arrow className="TooltipArrow" />
                                        </Tooltip.Content>
                                    </Tooltip.Portal>
                                </Tooltip.Root>
                            ))}
                        </div>
                    </div>
                )}

                {activePanel === 'layers' && (
                    <div className="panel-section">
                        <div className="panel-section-title">Operational Overlays</div>
                        <div className="layer-list">
                            <div className="layer-item">
                                <div className="layer-item-info">
                                    <PenTool size={16} />
                                    <span>Drawing Layer</span>
                                </div>
                                <button
                                    className={`visibility-toggle ${isDrawingVisible ? 'visible' : ''}`}
                                    onClick={() => setIsDrawingVisible(!isDrawingVisible)}
                                >
                                    {isDrawingVisible ? 'Visible' : 'Hidden'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activePanel === 'tools' && (
                    <div className="panel-section">
                        <div className="panel-section-title">Editor Tools</div>
                        <div className="tool-grid">
                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <div
                                        className={`tool-item ${activeTool === 'Point' ? 'active' : ''}`}
                                        onClick={() => handleToolClick('Point')}
                                    >
                                        <MapPinned size={26} strokeWidth={1.5} className="tool-icon point-icon" />
                                        <span className="tool-name">Point</span>
                                    </div>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={5}>
                                        Draw point markers
                                        <Tooltip.Arrow className="TooltipArrow" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>

                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <div
                                        className={`tool-item ${activeTool === 'LineString' ? 'active' : ''}`}
                                        onClick={() => handleToolClick('LineString')}
                                    >
                                        <Waypoints size={26} strokeWidth={1.5} className="tool-icon line-icon" />
                                        <span className="tool-name">Line</span>
                                    </div>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={5}>
                                        Draw lines and paths
                                        <Tooltip.Arrow className="TooltipArrow" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>

                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <div
                                        className={`tool-item ${activeTool === 'Polygon' ? 'active' : ''}`}
                                        onClick={() => handleToolClick('Polygon')}
                                    >
                                        <Pentagon size={26} strokeWidth={1.5} className="tool-icon polygon-icon" />
                                        <span className="tool-name">Polygon</span>
                                    </div>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={5}>
                                        Draw polygons and areas
                                        <Tooltip.Arrow className="TooltipArrow" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>

                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <div
                                        className={`tool-item ${activeTool === 'Circle' ? 'active' : ''}`}
                                        onClick={() => handleToolClick('Circle')}
                                    >
                                        <Orbit size={26} strokeWidth={1.5} className="tool-icon circle-icon" />
                                        <span className="tool-name">Circle</span>
                                    </div>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={5}>
                                        Draw circular areas
                                        <Tooltip.Arrow className="TooltipArrow" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>


                        </div>
                    </div>
                )}

                {activePanel === 'utility_tools' && (
                    <div className="panel-section">
                        <div className="panel-section-title">Analysis Tools</div>
                        <div className="tool-grid">
                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <div
                                        className={`tool-item ${activeTool === 'ZoomBox' ? 'active' : ''}`}
                                        onClick={() => handleToolClick('ZoomBox')}
                                    >
                                        <Focus size={26} strokeWidth={1.5} className="tool-icon zoom-icon" />
                                        <span className="tool-name">Zoom Region</span>
                                    </div>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={5}>
                                        Zoom to a selected region
                                        <Tooltip.Arrow className="TooltipArrow" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>

                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <div
                                        className={`tool-item ${activeTool === 'distance' ? 'active' : ''}`}
                                        onClick={() => handleMeasureClick('distance')}
                                    >
                                        <DraftingCompass size={26} strokeWidth={1.5} className="tool-icon distance-icon" />
                                        <span className="tool-name">Distance</span>
                                    </div>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={5}>
                                        Measure distance between points
                                        <Tooltip.Arrow className="TooltipArrow" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>

                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <div
                                        className={`tool-item ${activeTool === 'area' ? 'active' : ''}`}
                                        onClick={() => handleMeasureClick('area')}
                                    >
                                        <SquareDashed size={26} strokeWidth={1.5} className="tool-icon area-icon" />
                                        <span className="tool-name">Area</span>
                                    </div>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={5}>
                                        Measure area of polygons
                                        <Tooltip.Arrow className="TooltipArrow" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>
                        </div>

                        <div className="panel-section-title" style={{ marginTop: '20px' }}>Measurement Configuration</div>
                        <div className="dropdown-container">
                            <div className="select-wrapper">
                                <select
                                    className="elite-select"
                                    value={measurementUnits}
                                    onChange={(e) => setMeasurementUnits(e.target.value)}
                                >
                                    <optgroup label="Auto-Scaling Systems">
                                        <option value="metric">Metric (Auto m / km)</option>
                                        <option value="imperial">Imperial (Auto ft / mi)</option>
                                    </optgroup>
                                    <optgroup label="Precision GIS Units">
                                        <option value="kilometers">Kilometers (km)</option>
                                        <option value="meters">Meters (m)</option>
                                        <option value="miles">Miles (mi)</option>
                                        <option value="nautical">Nautical Miles (nmi)</option>
                                        <option value="yards">Yards (yd)</option>
                                        <option value="feet">Feet (ft)</option>
                                        <option value="feet_us">Feet (US Survey)</option>
                                    </optgroup>
                                </select>
                                <ChevronRight className="select-chevron" size={16} />
                            </div>
                        </div>
                    </div>
                )}

                {activePanel === 'location' && (
                    <div className="panel-section fade-in">
                        <div className="panel-section-title">Coordinate Input</div>
                        <div className="location-tool">
                            <div className="input-group">
                                <label>Latitude (-90 to 90)</label>
                                <input
                                    type="number"
                                    className="coordinate-input"
                                    placeholder="e.g. 51.5074"
                                    value={gotoLat}
                                    onChange={(e) => setGotoLat(e.target.value)}
                                />
                            </div>
                            <div className="input-group">
                                <label>Longitude (-180 to 180)</label>
                                <input
                                    type="number"
                                    className="coordinate-input"
                                    placeholder="e.g. -0.1278"
                                    value={gotoLon}
                                    onChange={(e) => setGotoLon(e.target.value)}
                                />
                            </div>
                            <button className="goto-btn" onClick={handleGoToLocation}>
                                Navigate to Location
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapPanel;
