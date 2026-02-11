import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
    Map as MapIcon,
    Satellite,
    Mountain,
    PenTool,
    Repeat,
    FileChartPie,
    DatabaseZap,
    Settings2,
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
    Bookmark,
    ScanSearch,
    Navigation,
} from 'lucide-react';
import LayerOperations from './LayerOperations';

// Import Basemap Images directly for Vite (Ensures paths work after builds/moves)
import osmImg from '../../assets/images/basemaps/osm.png';
import satelliteImg from '../../assets/images/basemaps/satellite.png';
import terrainImg from '../../assets/images/basemaps/terrain.png';
import darkImg from '../../assets/images/basemaps/dark.png';
import lightImg from '../../assets/images/basemaps/light.png';
import navigationImg from '../../assets/images/basemaps/navigation.png';

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

    handleToggleAllLayers,
    activeLayerTool,
    setActiveLayerTool,
    handleToggleLayerQuery,
    activeZoomLayerId,
    handleHighlightLayer,
    activeHighlightLayerId,
    isHighlightAnimating,
    handleUpdateLayerStyle,
    infoSelectionMode,
    setInfoSelectionMode,
    saveSequence,
    refreshLayers,
    selectedAttributeLayerId,
    setSelectedAttributeLayerId,
    showAttributeTable,
    setShowAttributeTable,
    GetLayerAttributes,
    handleApplyLayerFilter, setShowQueryBuilder, setQueryingLayer, queryingLayer,
    handleToggleSwipe, handleToggleSwipeAll, swipeLayerIds, swipePosition, setSwipePosition,
    analysisLayerIds, handleToggleAnalysisLayer,
    bookmarks, handleAddBookmark, handleDeleteBookmark, handleNavigateToBookmark,
    selectedQueryLayerIds, setSelectedQueryLayerIds,
    setShowSpatialJoin,
    onOpenSpatialJoin,
    allAvailableLayers
}) => {
    const [locationTab, setLocationTab] = useState('coordinates'); // 'coordinates' or 'search'
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);



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
                toast.error('Location not found. Please try a different query.');
            }
        }
    };

    if (!activePanel) return null;

    return (
        <div className={`panel ${isPanelMinimized ? 'minimized' : ''} panel-${activePanel}`}>
            <div className="panel-header">
                <div className="panel-header-text">
                    <h3>
                        {activePanel === 'layers' && 'GIS Layers'}
                        {activePanel === 'layermanagement' && 'Layer Management'}
                        {activePanel === 'tools' && 'Drawing Tools'}
                        {activePanel === 'utility_tools' && 'Tools'}
                        {activePanel === 'location' && 'Go to Location'}
                        {activePanel === 'print' && 'Export Map'}
                        {activePanel === 'bookmarks' && 'Map Bookmarks'}
                    </h3>
                    <p>
                        {activePanel === 'layers' && 'Manage data layers'}
                        {activePanel === 'layermanagement' && 'Manage and swipe layers'}
                        {activePanel === 'tools' && 'Create features on the map'}
                        {activePanel === 'utility_tools' && 'Measure and Analyze Map Data'}
                        {activePanel === 'location' && 'Enter precise coordinates'}
                        {activePanel === 'print' && 'Configure Map Export settings'}
                        {activePanel === 'bookmarks' && 'Save and navigate to favorite views'}
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
                                { id: 'osm', name: 'Street Map', img: osmImg, tip: 'Default street map' },
                                { id: 'satellite', name: 'Satellite', img: satelliteImg, tip: 'Aerial imagery' },
                                { id: 'terrain', name: 'Topo', img: terrainImg, tip: 'Topographic terrain' },
                                { id: 'dark', name: 'Dark', img: darkImg, tip: 'Night-optimized map' },
                                { id: 'light', name: 'Light', img: lightImg, tip: 'Clean light map' },
                                { id: 'street', name: 'Navigation', img: navigationImg, tip: 'Driving-optimized view' },
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

                {(activePanel === 'layers' || activePanel === 'layermanagement') && (
                    <LayerOperations
                        isDrawingVisible={isDrawingVisible}
                        setIsDrawingVisible={setIsDrawingVisible}
                        geoServerLayers={allAvailableLayers || geoServerLayers}
                        handleToggleGeoLayer={handleToggleGeoLayer}
                        handleLayerOpacityChange={handleLayerOpacityChange}
                        handleZoomToLayer={handleZoomToLayer}
                        handleToggleAllLayers={handleToggleAllLayers}
                        activeLayerTool={activeLayerTool}
                        setActiveLayerTool={setActiveLayerTool}
                        handleToggleLayerQuery={handleToggleLayerQuery}
                        activeZoomLayerId={activeZoomLayerId}
                        handleHighlightLayer={handleHighlightLayer}
                        activeHighlightLayerId={activeHighlightLayerId}
                        isHighlightAnimating={isHighlightAnimating}
                        handleUpdateLayerStyle={handleUpdateLayerStyle}
                        infoSelectionMode={infoSelectionMode}
                        setInfoSelectionMode={setInfoSelectionMode}
                        saveSequence={saveSequence}
                        refreshLayers={refreshLayers}
                        selectedAttributeLayerId={selectedAttributeLayerId}
                        setSelectedAttributeLayerId={setSelectedAttributeLayerId}
                        showAttributeTable={showAttributeTable}
                        setShowAttributeTable={setShowAttributeTable}
                        GetLayerAttributes={GetLayerAttributes}
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
                        selectedQueryLayerIds={selectedQueryLayerIds}
                        setSelectedQueryLayerIds={setSelectedQueryLayerIds}
                        setShowSpatialJoin={setShowSpatialJoin}
                        onOpenSpatialJoin={onOpenSpatialJoin}
                    />
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
                {activePanel === 'bookmarks' && (
                    <div className="panel-section fade-in">
                        <div className="panel-section-title">Add New Bookmark</div>
                        <div className="location-tool" style={{ marginBottom: '24px' }}>
                            <div className="input-group">
                                <label>Bookmark Name</label>
                                <input
                                    type="text"
                                    className="coordinate-input"
                                    placeholder="e.g. Project Area A"
                                    id="bookmark-name-input"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.target.value.trim()) {
                                            handleAddBookmark(e.target.value);
                                            e.target.value = '';
                                        }
                                    }}
                                />
                            </div>
                            <button
                                className="goto-btn"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                onClick={() => {
                                    const input = document.getElementById('bookmark-name-input');
                                    if (input && input.value.trim()) {
                                        handleAddBookmark(input.value);
                                        input.value = '';
                                    } else {
                                        toast.error('Please enter a name');
                                    }
                                }}
                            >
                                <Bookmark size={16} /> Save Current View
                            </button>
                        </div>

                        <div className="panel-divider" />
                        <div className="panel-section-title">Saved Bookmarks ({bookmarks.length})</div>

                        {bookmarks.length === 0 ? (
                            <div className="no-props-hint" style={{ marginTop: '20px' }}>
                                No bookmarks saved yet.
                            </div>
                        ) : (
                            <div className="layer-list compact-list" style={{ marginTop: '12px' }}>
                                {[...bookmarks].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((bookmark) => (
                                    <div key={bookmark.id} className="bookmark-item-elite">
                                        <div className="bookmark-content">
                                            <div className="bookmark-info">
                                                <span className="bookmark-name">{bookmark.name}</span>
                                                <span className="bookmark-meta">
                                                    Zoom {Math.round(bookmark.zoom * 10) / 10} • {new Date(bookmark.timestamp).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="bookmark-actions-elite">
                                                <Tooltip.Root>
                                                    <Tooltip.Trigger asChild>
                                                        <button
                                                            className="bookmark-btn navigate"
                                                            onClick={() => handleNavigateToBookmark(bookmark)}
                                                        >
                                                            <Navigation size={16} />
                                                            <span>Go</span>
                                                        </button>
                                                    </Tooltip.Trigger>
                                                    <Tooltip.Portal>
                                                        <Tooltip.Content className="TooltipContent" sideOffset={5}>
                                                            Navigate to View
                                                            <Tooltip.Arrow className="TooltipArrow" />
                                                        </Tooltip.Content>
                                                    </Tooltip.Portal>
                                                </Tooltip.Root>

                                                <Tooltip.Root>
                                                    <Tooltip.Trigger asChild>
                                                        <button
                                                            className="bookmark-btn delete"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteBookmark(bookmark.id);
                                                            }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </Tooltip.Trigger>
                                                    <Tooltip.Portal>
                                                        <Tooltip.Content className="TooltipContent" sideOffset={5}>
                                                            Delete Bookmark
                                                            <Tooltip.Arrow className="TooltipArrow" />
                                                        </Tooltip.Content>
                                                    </Tooltip.Portal>
                                                </Tooltip.Root>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapPanel;
