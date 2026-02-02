import { useState, useEffect } from 'react';
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
    ChevronDown,
    SquareDashed,
    X,
    Search,
    Loader2,
    Triangle,
    Square,
    Circle as CircleIcon,
    Spline,
    Pencil,
    Trash2,
    Maximize,
    Printer,
    Database,
    Eye,
    EyeOff,
    Zap,
    Palette,
    ArrowUpDown,
    Table,
    List,
    Plus,
    RefreshCw,
    Info,
    CircleDot,
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
    handleSearch,
    measurementUnits,
    setMeasurementUnits,
    showDrawingLabels,
    setShowDrawingLabels,
    showAnalysisLabels,
    setShowAnalysisLabels,
    handleClearDrawings,
    resetTools,
    printTitle,
    setPrintTitle,
    printSubtitle,
    setPrintSubtitle,
    printFileName,
    setPrintFileName,
    exportFormat,
    setExportFormat,
    handleExportMap,
    geoServerLayers,
    handleToggleGeoLayer,
    handleLayerOpacityChange,
    handleZoomToLayer,
}) => {
    const [locationTab, setLocationTab] = useState('coordinates'); // 'coordinates' or 'search'
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const [activeLayerTool, setActiveLayerTool] = useState(null);

    // ... rest of component
    const [isExporting, setIsExporting] = useState(false);

    // Reset location values when card is closed or switched
    useEffect(() => {
        if (activePanel !== 'location') {
            setSearchQuery('');
            setGotoLat('');
            setGotoLon('');
        }
    }, [activePanel, setGotoLat, setGotoLon]);

    const onSearchSubmit = async (e) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            setIsSearching(true);
            const success = await handleSearch(searchQuery);
            setIsSearching(false);
            if (!success) {
                alert('Location not found. Please try a different query.');
            }
        }
    };

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
                        {activePanel === 'print' && 'Export Map'}
                    </h3>
                    <p>
                        {activePanel === 'basemaps' && 'Choose your map background'}
                        {activePanel === 'layers' && 'Manage operational data layers'}
                        {activePanel === 'tools' && 'Create features on the map'}
                        {activePanel === 'utility_tools' && 'Measure and Analyze Map Data'}
                        {activePanel === 'location' && 'Enter precise coordinates'}
                        {activePanel === 'print' && 'Configure Map Export settings'}
                    </p>
                </div>
                <div className="panel-header-actions">
                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <button
                                className="minimize-btn"
                                onClick={() => setIsPanelMinimized(!isPanelMinimized)}
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

                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <button
                                className="close-btn"
                                onClick={() => {
                                    setActivePanel(null);
                                    setIsPanelMinimized(false);
                                    resetTools();
                                    setActiveLayerTool(null);
                                }}
                            >
                                <X size={16} />
                            </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className="TooltipContent" sideOffset={5}>
                                Close panel
                                <Tooltip.Arrow className="TooltipArrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                </div>
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
                    <div className="layer-panel-container">
                        <div className="layer-tools-sidebar">
                            {[
                                { icon: Eye, label: 'Visibility', id: 'visibility' },
                                { icon: MapPinned, label: 'Zoom To Layer', id: 'zoom' },
                                { icon: Zap, label: 'Highlight Layer', id: 'highlight' },
                                { icon: Palette, label: 'Layer Styles', id: 'styles' },
                                { icon: ArrowUpDown, label: 'Reorder Layers', id: 'reorder' },
                                { icon: Table, label: 'Attribute Table', id: 'attribute' },
                                { icon: List, label: 'Layers Legend', id: 'legend' },
                                { icon: Plus, label: 'New Layer', id: 'new' },
                                { icon: RefreshCw, label: 'Reload Layer', id: 'reload' },
                                { icon: Info, label: 'Info Tool', id: 'info' },
                            ].map((tool) => (
                                <Tooltip.Root key={tool.id}>
                                    <Tooltip.Trigger asChild>
                                        <button
                                            className={`layer-tool-sidebar-btn ${activeLayerTool === tool.id ? 'active' : ''}`}
                                            onClick={() => setActiveLayerTool(activeLayerTool === tool.id ? null : tool.id)}
                                        >
                                            <tool.icon size={22} strokeWidth={1.5} />
                                        </button>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal>
                                        <Tooltip.Content className="TooltipContent" side="left" sideOffset={10}>
                                            {tool.label}
                                            <Tooltip.Arrow className="TooltipArrow" />
                                        </Tooltip.Content>
                                    </Tooltip.Portal>
                                </Tooltip.Root>
                            ))}
                        </div>

                        <div className="layer-list-content">
                            <div className="layer-section-header">Operational Overlays</div>
                            <div className="layer-list-group">
                                <div className="layer-item-redesigned">
                                    <div className="layer-info">
                                        <Pencil size={14} className="layer-icon" />
                                        <span>Workspace Drawings</span>
                                    </div>
                                    <button
                                        className={`layer-visibility-badge ${isDrawingVisible ? 'visible' : ''}`}
                                        onClick={() => setIsDrawingVisible(!isDrawingVisible)}
                                    >
                                        {isDrawingVisible ? 'VISIBLE' : 'HIDDEN'}
                                    </button>
                                </div>
                            </div>

                            <div className="layer-section-header">GeoServer Layers</div>
                            <div className="layer-list-group scrollable">
                                {geoServerLayers.length === 0 ? (
                                    <div className="empty-layers-msg">
                                        No server layers connected.
                                    </div>
                                ) : (
                                    geoServerLayers.map(layer => (
                                        <div className="layer-item-redesigned" key={layer.id}>
                                            <div className="layer-info">
                                                <CircleDot size={14} className="layer-icon" />
                                                <span>{layer.name}</span>
                                            </div>
                                            <button
                                                className={`icon-toggle ${layer.visible ? 'visible' : ''}`}
                                                onClick={() => handleToggleGeoLayer(layer.id)}
                                                title={layer.visible ? "Hide" : "Show"}
                                            >
                                                {layer.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activePanel === 'tools' && (
                    <div className="panel-section">
                        <div className="panel-section-title" style={{ marginTop: '20px' }}>Editor Tools</div>
                        <div className="tool-grid">
                            {[
                                { id: 'Point', icon: MapPinned, name: 'Point', tip: 'Draw point markers' },
                                { id: 'LineString', icon: Waypoints, name: 'Line', tip: 'Draw lines and paths' },
                                { id: 'Polygon', icon: Pentagon, name: 'Polygon', tip: 'Draw polygons and areas' },
                                { id: 'Circle', icon: Orbit, name: 'Circle', tip: 'Draw perfect circles' },
                                { id: 'Triangle', icon: Triangle, name: 'Triangle', tip: 'Draw equilateral triangles' },
                                { id: 'Extent', icon: Maximize, name: 'Extent', tip: 'Draw rectangular extents' },
                                { id: 'Ellipse', icon: CircleIcon, name: 'Ellipse', tip: 'Draw elliptical areas' },
                                { id: 'FreehandLine', icon: Spline, name: 'Freehand Line', tip: 'Draw freehand lines' },
                                { id: 'FreehandPolygon', icon: Pencil, name: 'Freehand Polygon', tip: 'Draw freehand polygons' },
                            ].map((tool) => (
                                <Tooltip.Root key={tool.id}>
                                    <Tooltip.Trigger asChild>
                                        <div
                                            className={`tool-item ${activeTool === tool.id ? 'active' : ''}`}
                                            onClick={() => handleToolClick(tool.id)}
                                        >
                                            <tool.icon size={26} strokeWidth={1.5} className={`tool-icon ${tool.id.toLowerCase()}-icon`} />
                                            <span className="tool-name">{tool.name}</span>
                                        </div>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal>
                                        <Tooltip.Content className="TooltipContent" sideOffset={5}>
                                            {tool.tip}
                                            <Tooltip.Arrow className="TooltipArrow" />
                                        </Tooltip.Content>
                                    </Tooltip.Portal>
                                </Tooltip.Root>
                            ))}
                        </div>

                        {activeTool && (
                            <div className="fade-in">
                                <div className="panel-divider" />
                                <div className="panel-section-title">Label Settings</div>
                                <div className="label-toggle-container">
                                    <label className="toggle-label">
                                        <span>Show Labels</span>
                                        <div className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={showDrawingLabels}
                                                onChange={(e) => setShowDrawingLabels(e.target.checked)}
                                            />
                                            <span className="toggle-slider"></span>
                                        </div>
                                    </label>
                                </div>
                                {showDrawingLabels && (
                                    <div className="dropdown-container" style={{ marginTop: '12px' }}>
                                        <div className="select-wrapper">
                                            <select
                                                className="elite-select"
                                                value={measurementUnits}
                                                onChange={(e) => setMeasurementUnits(e.target.value)}
                                            >
                                                {['LineString', 'FreehandLine'].includes(activeTool) ? (
                                                    <>
                                                        <optgroup label="Standard Lengths">
                                                            <option value="metric">Metric (Auto m/km)</option>
                                                            <option value="imperial">Imperial (Auto ft/mi)</option>
                                                            <option value="kilometers">Kilometers (km)</option>
                                                            <option value="meters">Meters (m)</option>
                                                        </optgroup>
                                                        <optgroup label="GIS Precision">
                                                            <option value="miles">Miles (mi)</option>
                                                            <option value="feet">Feet (ft)</option>
                                                            <option value="yards">Yards (yd)</option>
                                                            <option value="nautical">Nautical Miles (nmi)</option>
                                                        </optgroup>
                                                    </>
                                                ) : activeTool === 'Point' ? (
                                                    <option value="metric">Default Style</option>
                                                ) : (
                                                    <>
                                                        <optgroup label="Standard Areas">
                                                            <option value="metric">Metric (Auto m²/km²)</option>
                                                            <option value="imperial">Imperial (Auto ft²/mi²)</option>
                                                            <option value="kilometers">Square Kilometers (km²)</option>
                                                            <option value="meters">Square Meters (m²)</option>
                                                        </optgroup>
                                                        <optgroup label="Land Measurement">
                                                            <option value="acres">Acres (ac)</option>
                                                            <option value="hectares">Hectares (ha)</option>
                                                            <option value="miles">Square Miles (mi²)</option>
                                                            <option value="feet">Square Feet (ft²)</option>
                                                        </optgroup>
                                                    </>
                                                )}
                                            </select>
                                            <ChevronDown className="select-chevron" size={16} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="panel-divider" />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button
                                className="elite-reset-button"
                                onClick={handleClearDrawings}
                            >
                                <Trash2 size={16} />
                                <span>Reset / Clear</span>
                            </button>
                        </div>
                    </div>
                )}

                {activePanel === 'utility_tools' && (
                    <div className="panel-section">


                        <div className="panel-section-title" style={{ marginTop: '24px' }}>Analysis Tools</div>
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

                        {['distance', 'area'].includes(activeTool) && (
                            <div className="fade-in">
                                <div className="panel-divider" />
                                <div className="panel-section-title">Label Settings</div>
                                <div className="label-toggle-container">
                                    <label className="toggle-label">
                                        <span>Show Labels</span>
                                        <div className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={showAnalysisLabels}
                                                onChange={(e) => setShowAnalysisLabels(e.target.checked)}
                                            />
                                            <span className="toggle-slider"></span>
                                        </div>
                                    </label>
                                </div>

                                {showAnalysisLabels && (
                                    <div className="dropdown-container">
                                        <div className="panel-section-title" style={{ marginTop: '12px', fontSize: '11px', opacity: 0.7 }}>Measurement Units</div>
                                        <div className="select-wrapper">
                                            <select
                                                className="elite-select"
                                                value={measurementUnits}
                                                onChange={(e) => setMeasurementUnits(e.target.value)}
                                            >
                                                {activeTool === 'distance' ? (
                                                    <>
                                                        <optgroup label="Standard Lengths">
                                                            <option value="metric">Metric (Auto m/km)</option>
                                                            <option value="imperial">Imperial (Auto ft/mi)</option>
                                                            <option value="kilometers">Kilometers (km)</option>
                                                            <option value="meters">Meters (m)</option>
                                                        </optgroup>
                                                        <optgroup label="GIS Precision">
                                                            <option value="miles">Miles (mi)</option>
                                                            <option value="feet">Feet (ft)</option>
                                                            <option value="yards">Yards (yd)</option>
                                                            <option value="nautical">Nautical Miles (nmi)</option>
                                                        </optgroup>
                                                    </>
                                                ) : (
                                                    <>
                                                        <optgroup label="Standard Areas">
                                                            <option value="metric">Metric (Auto m²/km²)</option>
                                                            <option value="imperial">Imperial (Auto ft²/mi²)</option>
                                                            <option value="kilometers">Square Kilometers (km²)</option>
                                                            <option value="meters">Square Meters (m²)</option>
                                                        </optgroup>
                                                        <optgroup label="Land Measurement">
                                                            <option value="acres">Acres (ac)</option>
                                                            <option value="hectares">Hectares (ha)</option>
                                                            <option value="miles">Square Miles (mi²)</option>
                                                            <option value="feet">Square Feet (ft²)</option>
                                                        </optgroup>
                                                    </>
                                                )}
                                            </select>
                                            <ChevronDown className="select-chevron" size={16} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="panel-divider" />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button
                                className="elite-reset-button"
                                onClick={handleClearDrawings}
                            >
                                <Trash2 size={16} />
                                <span>Reset / Clear</span>
                            </button>
                        </div>
                    </div>
                )}

                {activePanel === 'location' && (
                    <div className="panel-section fade-in">
                        <div className="tabs-container">
                            <button
                                className={`tab-btn ${locationTab === 'coordinates' ? 'active' : ''}`}
                                onClick={() => setLocationTab('coordinates')}
                            >
                                Coordinates
                            </button>
                            <button
                                className={`tab-btn ${locationTab === 'search' ? 'active' : ''}`}
                                onClick={() => setLocationTab('search')}
                            >
                                Find By Place
                            </button>
                        </div>

                        {locationTab === 'coordinates' ? (
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
                        ) : (
                            <div className="search-tool-container">
                                <div className={`search-wrapper ${isSearching ? 'loading' : ''}`}>
                                    {isSearching ? (
                                        <Loader2 className="search-icon animate-spin" size={18} />
                                    ) : (
                                        <Search className="search-icon" size={18} />
                                    )}
                                    <input
                                        type="text"
                                        placeholder="Find a city, address or coordinate..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={onSearchSubmit}
                                        className="elite-search-input"
                                    />
                                </div>
                                <p className="search-hint">Press Enter to search</p>
                            </div>
                        )}
                    </div>
                )}

                {activePanel === 'print' && (
                    <div className="panel-section fade-in">
                        <div className="panel-section-title">Export Details</div>
                        <div className="location-tool">
                            <div className="input-group">
                                <label>Title</label>
                                <input
                                    type="text"
                                    className="coordinate-input"
                                    placeholder="Enter map title..."
                                    value={printTitle}
                                    onChange={(e) => setPrintTitle(e.target.value)}
                                />
                            </div>
                            <div className="input-group">
                                <label>Subtitle</label>
                                <input
                                    type="text"
                                    className="coordinate-input"
                                    placeholder="Enter subtitle (optional)..."
                                    value={printSubtitle}
                                    onChange={(e) => setPrintSubtitle(e.target.value)}
                                />
                            </div>
                            <div className="input-group">
                                <label>File Name</label>
                                <input
                                    type="text"
                                    className="coordinate-input"
                                    placeholder="e.g. Map.pdf"
                                    value={printFileName}
                                    onChange={(e) => setPrintFileName(e.target.value)}
                                />
                            </div>
                            <div className="input-group">
                                <label>Format</label>
                                <div className="select-wrapper">
                                    <select
                                        className="elite-select"
                                        value={exportFormat}
                                        onChange={(e) => setExportFormat(e.target.value)}
                                    >
                                        <option value="pdf">PDF (Document)</option>
                                        <option value="png">PNG (Image)</option>
                                        <option value="jpg">JPG (Image)</option>
                                    </select>
                                    <ChevronDown className="select-chevron" size={16} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                                <button
                                    className={`home-button ${isExporting ? 'loading' : ''}`}
                                    onClick={async () => {
                                        setIsExporting(true);
                                        await handleExportMap();
                                        setIsExporting(false);
                                    }}
                                    disabled={isExporting}
                                    style={{ width: '100%', maxWidth: '220px' }}
                                >
                                    {isExporting ? (
                                        <Loader2 className="animate-spin" size={18} style={{ marginRight: '8px' }} />
                                    ) : (
                                        <Printer size={18} style={{ marginRight: '8px' }} />
                                    )}
                                    <span>{isExporting ? 'Exporting...' : 'Export Map'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapPanel;
