import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
    ChevronLeft,
    ChevronRight,
    X,
} from 'lucide-react';
import LayerOperations from './LayerOperations';
import BaseMapSelector from './BaseMapSelector';
import DrawingToolsCard from './DrawingToolsCard';
import MeasureCard from './MeasureCard';
import LocationCard from './LocationCard';
import BookmarksCard from './BookmarksCard';
import PrintCard from './PrintCard';

const MapPanel = ({
    activePanel,
    setActivePanel,
    isPanelMinimized,
    setIsPanelMinimized,
    layoutMode = 'sidebar',
    baseLayer,
    setBaseLayer,
    isDrawingVisible,
    setIsDrawingVisible,
    activeTool,
    handleToolClick,
    showDrawingLabels,
    setShowDrawingLabels,
    handleClearDrawings,
    activeMeasureTool,
    handleMeasureClick,
    showMeasureLabels,
    setShowMeasureLabels,
    handleClearMeasurements,
    measurementUnits,
    setMeasurementUnits,
    gotoLat,
    setGotoLat,
    gotoLon,
    setGotoLon,
    handleGoToLocation,
    handleSearch,
    isSearching,
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
    isExporting,
    geoServerLayers,
    handleToggleGeoLayer,
    handleLayerOpacityChange,
    handleZoomToLayer,
    handleHighlightLayer,
    handleToggleAllLayers,
    activeLayerTool,
    setActiveLayerTool,
    handleToggleLayerQuery,
    activeHighlightLayerId,
    isHighlightAnimating,
    onOpenStyleEditor,
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
    handleApplyLayerFilter,
    setShowQueryBuilder,
    setQueryingLayer,
    queryingLayer,
    handleToggleSwipe,
    handleToggleSwipeAll,
    swipeLayerIds,
    swipePosition,
    setSwipePosition,
    analysisLayerIds,
    handleToggleAnalysisLayer,
    spatialJoinLayerIds,
    handleToggleSpatialJoinLayer,
    bookmarks,
    handleAddBookmark,
    handleDeleteBookmark,
    handleNavigateToBookmark,
    selectedQueryLayerIds,
    setSelectedQueryLayerIds,
    setShowSpatialJoin,
    onOpenSpatialJoin,
    allAvailableLayers,
    showTopLegend,
    setShowTopLegend
}) => {
    if (!activePanel) return null;

    return (
        <div className={`panel ${isPanelMinimized ? 'minimized' : ''} panel-${activePanel} layout-${layoutMode}`}>
            <div className="panel-header">
                <div className="panel-header-text">
                    <h3>
                        {activePanel === 'layers' && 'GIS Layers'}
                        {activePanel === 'layermanagement' && 'Layer Management'}
                        {activePanel === 'tools' && 'Drawing Tools'}
                        {activePanel === 'utility_tools' && 'Tools'}
                        {activePanel === 'location' && 'Go to Location'}
                        {activePanel === 'print' && 'Export Map'}
                        {activePanel === 'basemaps' && 'Base Maps'}
                        {activePanel === 'bookmarks' && 'Map Bookmarks'}
                    </h3>
                    <p>
                        {activePanel === 'layers' && 'Manage data layers'}
                        {activePanel === 'layermanagement' && 'Manage and swipe layers'}
                        {activePanel === 'tools' && 'Create features on the map'}
                        {activePanel === 'utility_tools' && 'Measure and Analyze Map Data'}
                        {activePanel === 'location' && 'Enter precise coordinates'}
                        {activePanel === 'print' && 'Configure Map Export settings'}
                        {activePanel === 'basemaps' && 'Change the underlying map style'}
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
                                {layoutMode === 'sidebar'
                                    ? (isPanelMinimized ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)
                                    : (isPanelMinimized ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)
                                }
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
                    <BaseMapSelector baseLayer={baseLayer} setBaseLayer={setBaseLayer} />
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
                        handleHighlightLayer={handleHighlightLayer}
                        activeHighlightLayerId={activeHighlightLayerId}
                        isHighlightAnimating={isHighlightAnimating}
                        onOpenStyleEditor={onOpenStyleEditor}
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
                        spatialJoinLayerIds={spatialJoinLayerIds}
                        handleToggleSpatialJoinLayer={handleToggleSpatialJoinLayer}
                        selectedQueryLayerIds={selectedQueryLayerIds}
                        setSelectedQueryLayerIds={setSelectedQueryLayerIds}
                        setShowSpatialJoin={setShowSpatialJoin}
                        onOpenSpatialJoin={onOpenSpatialJoin}
                        showTopLegend={showTopLegend}
                        setShowTopLegend={setShowTopLegend}
                    />
                )}

                {activePanel === 'tools' && (
                    <DrawingToolsCard
                        activePanel={activePanel}
                        activeTool={activeTool}
                        handleToolClick={handleToolClick}
                        showDrawingLabels={showDrawingLabels}
                        setShowDrawingLabels={setShowDrawingLabels}
                        measurementUnits={measurementUnits}
                        setMeasurementUnits={setMeasurementUnits}
                        handleClearDrawings={handleClearDrawings}
                    />
                )}

                {activePanel === 'utility_tools' && (
                    <MeasureCard
                        activePanel={activePanel}
                        activeMeasureTool={activeMeasureTool}
                        handleMeasureClick={handleMeasureClick}
                        showMeasureLabels={showMeasureLabels}
                        setShowMeasureLabels={setShowMeasureLabels}
                        measurementUnits={measurementUnits}
                        setMeasurementUnits={setMeasurementUnits}
                        handleClearMeasurements={handleClearMeasurements}
                    />
                )}

                {activePanel === 'location' && (
                    <LocationCard
                        activePanel={activePanel}
                        gotoLat={gotoLat}
                        setGotoLat={setGotoLat}
                        gotoLon={gotoLon}
                        setGotoLon={setGotoLon}
                        handleGoToLocation={handleGoToLocation}
                        handleSearch={handleSearch}
                        isSearching={isSearching}
                    />
                )}

                {activePanel === 'print' && (
                    <PrintCard
                        activePanel={activePanel}
                        printTitle={printTitle}
                        setPrintTitle={setPrintTitle}
                        printSubtitle={printSubtitle}
                        setPrintSubtitle={setPrintSubtitle}
                        printFileName={printFileName}
                        setPrintFileName={setPrintFileName}
                        exportFormat={exportFormat}
                        setExportFormat={setExportFormat}
                        handleExportMap={handleExportMap}
                        isExporting={isExporting}
                    />
                )}

                {activePanel === 'bookmarks' && (
                    <BookmarksCard
                        activePanel={activePanel}
                        bookmarks={bookmarks}
                        handleAddBookmark={handleAddBookmark}
                        handleDeleteBookmark={handleDeleteBookmark}
                        handleNavigateToBookmark={handleNavigateToBookmark}
                    />
                )}
            </div>
        </div>
    );
};

export default MapPanel;
