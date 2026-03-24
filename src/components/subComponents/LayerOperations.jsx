import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as Tooltip from '@radix-ui/react-tooltip';
import { isEmpty } from 'ol/extent';
import { GEOSERVER_URL, AUTH_HEADER } from '../../constants/AppConstants';
import {
    Eye, Settings2, Info, Square, Play,
    Palette, Repeat, RefreshCw, DatabaseZap, Loader2,
    Pencil, CircleDot, Save,
    MousePointer2, BoxSelect, GripVertical, MousePointerClick,
    Brush,
    LayoutGrid,
    Combine,
    ZoomIn
} from 'lucide-react';

const LayerOperations = ({
    isDrawingVisible, setIsDrawingVisible, geoServerLayers,
    handleToggleGeoLayer, handleLayerOpacityChange, handleZoomToLayer,
    handleToggleAllLayers, activeLayerTool, setActiveLayerTool,
    handleToggleLayerQuery, activeZoomLayerId, handleHighlightLayer,
    activeHighlightLayerId, isHighlightAnimating, onOpenStyleEditor,
    infoSelectionMode, setInfoSelectionMode, saveSequence, refreshLayers,
    selectedAttributeLayerId, setSelectedAttributeLayerId,
    showAttributeTable, setShowAttributeTable, GetLayerAttributes,
    handleApplyLayerFilter, setShowQueryBuilder, setQueryingLayer,
    queryingLayer, handleToggleSwipe, handleToggleSwipeAll, swipeLayerIds,
    swipePosition, setSwipePosition, analysisLayerIds, handleToggleAnalysisLayer,
    spatialJoinLayerIds, handleToggleSpatialJoinLayer,
    selectedQueryLayerIds, setSelectedQueryLayerIds,
    setShowSpatialJoin,
    onOpenSpatialJoin,
    showTopLegend,
    setShowTopLegend
}) => {

    const tools = [
        { icon: Eye, label: 'Visibility', id: 'visibility' },
        { icon: Settings2, label: 'Layer Density', id: 'density' },
        { icon: MousePointerClick, label: 'Layer Action', id: 'action' },
        { icon: Info, label: 'Feature Info', id: 'info' },
        { icon: Palette, label: 'Layer Styles', id: 'styles' },
        { icon: Repeat, label: 'Reorder Layers', id: 'reorder' },
        { icon: GripVertical, label: 'Swipe Tool', id: 'swipe' },
        { icon: DatabaseZap, label: 'Query Builder', id: 'querybuilder' },
        { icon: LayoutGrid, label: 'Attribute Table', id: 'attribute' },
        { icon: FileChartPie, label: 'Run Analysis', id: 'analysis' },
    ];

    const [draggedLayerId, setDraggedLayerId] = useState(null);
    const [isSavingSequences, setIsSavingSequences] = useState(false);
    const [localLayers, setLocalLayers] = useState([]);

    useEffect(() => {
        if (geoServerLayers && geoServerLayers.length > 0) {
            // Filter out temporary/local layers for the reorder list
            setLocalLayers(geoServerLayers.filter(l => !l.isLocal));
        }
    }, [geoServerLayers]);

    const handleSaveAllSequences = async () => {
        setIsSavingSequences(true);
        try {
            // Prepare Key-Value list: layerId, SequenceNumber
            // We use the pool of sequence numbers coming from the server (EXCLUDING local layers)
            // and assign them based on the new local order (which only contains persistent layers).

            // 1. Get pool of valid sequence numbers from server layers only
            const availableSequences = geoServerLayers
                .filter(l => !l.isLocal && l.sequence !== undefined && l.sequence !== null)
                .map(l => l.sequence)
                .sort((a, b) => a - b);

            console.log('Available Sequences Pool:', availableSequences);

            const sequenceList = localLayers
                .filter(l => l.layerId) // Only save persistent layers
                .map((layer, index) => ({
                    layerId: layer.layerId,
                    fid: layer.fid, // Pass Feature ID for robust WFS-T update
                    // Assign from the sorted pool. If we run out (shouldn't happen if lists match), fallback to 999 or current.
                    sequenceNumber: availableSequences[index] !== undefined ? availableSequences[index] : (layer.sequence ?? 999)
                }));

            console.log('Saving Sequence List:', sequenceList);

            await saveSequence(sequenceList);

            // Re-fetch sorted layers from server after a small delay to ensure persistence
            await new Promise(r => setTimeout(r, 500));

            if (refreshLayers) {
                await refreshLayers();
            }

            toast.success('Sequences saved successfully!');
        } catch (error) {
            console.error("Failed to save sequences", error);
            toast.error('Failed to save sequences.');
        } finally {
            setIsSavingSequences(false);
        }
    };

    const handleDragStart = (e, layerId) => {
        setDraggedLayerId(layerId);
        e.dataTransfer.effectAllowed = 'move';
        // Add a class for styling
        e.currentTarget.classList.add('dragging');
    };

    const handleDragOver = (e, targetLayerId) => {
        e.preventDefault();
        if (draggedLayerId === targetLayerId) return;

        const draggedIdx = localLayers.findIndex(l => l.id === draggedLayerId);
        const targetIdx = localLayers.findIndex(l => l.id === targetLayerId);

        if (draggedIdx === -1 || targetIdx === -1) return;

        const updatedLayers = [...localLayers];
        const [removed] = updatedLayers.splice(draggedIdx, 1);
        updatedLayers.splice(targetIdx, 0, removed);
        setLocalLayers(updatedLayers);
    };

    const handleDragEnd = (e) => {
        setDraggedLayerId(null);
        e.currentTarget.classList.remove('dragging');
    };


    const toggleSelectAllQuery = () => {
        if (selectedQueryLayerIds.length === geoServerLayers.length) {
            setSelectedQueryLayerIds([]);
        } else {
            setSelectedQueryLayerIds(geoServerLayers.map(l => l.id));
        }
    };

    const toggleLayerQuery = (layerId) => {
        setSelectedQueryLayerIds(prev => {
            if (prev.includes(layerId)) {
                return prev.filter(id => id !== layerId);
            } else {
                return [...prev, layerId];
            }
        });
    };



    /* parseSLD, applyStyleChanges, handleLoadStyle, handleSaveStyle, handleFileUpload,
       updateStyleProp â€” all removed. Now in StyleUtils.js / GISMap.jsx. */

    const allLayersVisible = geoServerLayers.length > 0 && geoServerLayers.every(l => l.visible);


    // Split layers into Server and Temporary
    const serverLayers = geoServerLayers.filter(l => !l.isLocal);
    const tempLayers = geoServerLayers.filter(l => l.isLocal);

    const renderLayerContent = (layer) => {
        switch (activeLayerTool) {
            case 'visibility':
                return (
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            checked={layer.visible}
                            onChange={() => handleToggleGeoLayer(layer.id)}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                );
            case 'info':
                return (
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            checked={layer.queryable}
                            onChange={() => handleToggleLayerQuery(layer.id)}
                        />
                        <span className="toggle-slider" style={{ backgroundColor: layer.queryable ? 'var(--color-primary)' : '' }}></span>
                    </label>
                );
            case 'density':
                return (
                    <div className="density-control" style={{ width: '100%', justifyContent: 'space-between', paddingLeft: '4px' }}>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={layer.opacity !== undefined ? layer.opacity : 1}
                            onChange={(e) => handleLayerOpacityChange(layer.id, parseFloat(e.target.value))}
                            className="layer-opacity-slider"
                            title="Adjust Opacity"
                            style={{ flex: 1 }}
                        />
                        <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '32px', textAlign: 'right' }}>{Math.round((layer.opacity || 1) * 100)}%</span>
                    </div>
                );
            case 'action': {
                const isHighlighting = isHighlightAnimating && activeHighlightLayerId === layer.id;
                const isZoomed = activeZoomLayerId === layer.id;

                return (
                    <div className="layer-action-buttons" onClick={(e) => e.stopPropagation()}>
                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <button
                                    className={`action-btn ${isZoomed ? 'active' : ''}`}
                                    onClick={() => handleZoomToLayer(layer.id)}
                                >
                                    <ZoomIn size={16} />
                                </button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content className="TooltipContent" side="top" sideOffset={5}>
                                    Zoom to Layer
                                    <Tooltip.Arrow className="TooltipArrow" />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>

                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <button
                                    className={`action-btn ${isHighlighting ? 'active animating' : ''}`}
                                    onClick={() => handleHighlightLayer(layer.id)}
                                >
                                    {isHighlighting ? <Square size={14} fill="currentColor" /> : <Play size={16} />}
                                </button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content className="TooltipContent" side="top" sideOffset={5}>
                                    {isHighlighting ? 'Stop Highlight' : 'Highlight Layer'}
                                    <Tooltip.Arrow className="TooltipArrow" />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>
                    </div>
                );
            }

            case 'styles':
                return (
                    <button
                        className="icon-toggle"
                        onClick={() => !layer.isLocal && onOpenStyleEditor(layer)}
                        title={layer.isLocal ? "Styles cannot be edited for local layers" : "Customize Styles"}
                        disabled={layer.isLocal}
                        style={{ opacity: layer.isLocal ? 0.3 : 1 }}
                    >
                        <Brush size={18} />
                    </button>
                );


            case 'reorder': {
                // Same logic: Filter out local layers to get the true pool of sequences
                const availableSequences = [...geoServerLayers]
                    .filter(l => !l.isLocal && l.sequence !== undefined && l.sequence !== null)
                    .map(l => l.sequence)
                    .sort((a, b) => a - b);

                const currentIndex = localLayers.findIndex(l => l.id === layer.id);
                const projectedSeq = availableSequences[currentIndex] !== undefined ? availableSequences[currentIndex] : (layer.sequence ?? '??');

                return (
                    <div className="sequence-indicator" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 600 }}>
                        <span style={{ fontSize: '12px' }}>#{projectedSeq}</span>
                        <GripVertical size={16} style={{ cursor: 'grab', opacity: 0.6 }} />
                    </div>
                );
            }

            case 'swipe': {
                const isSwipeSelected = swipeLayerIds?.includes(layer.id);
                return (
                    <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                        <input
                            type="checkbox"
                            checked={isSwipeSelected}
                            onChange={() => handleToggleSwipe(layer.id)}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                );
            }

            case 'attribute': {
                const isSelected = selectedAttributeLayerId === layer.id;
                return (
                    <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                                const checked = e.target.checked;
                                if (checked) {
                                    setSelectedAttributeLayerId(layer.id);
                                    setShowAttributeTable(true);
                                    GetLayerAttributes(layer.id);
                                } else {
                                    setSelectedAttributeLayerId(null);
                                    setShowAttributeTable(false);
                                }
                            }}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                );
            }

            case 'querybuilder': {
                const isSelected = selectedQueryLayerIds.includes(layer.id);
                const hasFilter = !!layer.cqlFilter;

                return (
                    <div className="query-builder-toggle-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {hasFilter && (
                            <button
                                className="clear-filter-btn-mini"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleApplyLayerFilter(layer.id, null);
                                }}
                                title="Clear Filter"
                                style={{
                                    border: 'none',
                                    background: 'rgba(var(--color-danger-rgb), 0.1)',
                                    color: 'var(--color-danger)',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <RefreshCw size={12} />
                            </button>
                        )}
                        <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                    toggleLayerQuery(layer.id);
                                    if (e.target.checked && !queryingLayer) {
                                        setQueryingLayer(layer);
                                    }
                                }}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                );
            }

            case 'analysis': {
                const isSelected = analysisLayerIds?.includes(layer.id);
                return (
                    <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleAnalysisLayer(layer.id)}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                );
            }

            case 'spatialjoin':
                return (
                    <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                        <input
                            type="checkbox"
                            checked={spatialJoinLayerIds.includes(layer.id)}
                            onChange={() => handleToggleSpatialJoinLayer(layer.id)}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                );

            default:
                return null;
        }
    };

    return (
        <div className="layer-panel-container">
            <div className="layer-tools-sidebar">
                {tools.map((tool) => (
                    <Tooltip.Root key={tool.id}>
                        <Tooltip.Trigger asChild>
                            <button
                                className={`layer-tool-sidebar-btn ${activeLayerTool === tool.id ? 'active' : ''}`}
                                onClick={() => {
                                    // Clicking the active tool falls back to 'visibility' (never null)
                                    // so layer toggles are always visible as the default state.
                                    setActiveLayerTool(
                                        activeLayerTool === tool.id && tool.id !== 'visibility'
                                            ? 'visibility'
                                            : tool.id
                                    );
                                }}
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
                {/* Horizontal Swipe Slider - Shows at top when swipe tool is active */}
                {activeLayerTool === 'swipe' && swipeLayerIds?.length > 0 && (
                    <div className="swipe-slider-container" style={{
                        padding: '12px',
                        marginBottom: '8px',
                        background: 'rgba(var(--color-primary-rgb), 0.08)',
                        borderRadius: '8px',
                        border: '1px solid rgba(var(--color-primary-rgb), 0.15)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Swipe Position
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                                {Math.round(swipePosition)}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={swipePosition}
                            onChange={(e) => setSwipePosition(parseFloat(e.target.value))}
                            className="layer-opacity-slider"
                            style={{ width: '100%', margin: 0 }}
                            title="Drag to adjust swipe position"
                        />
                    </div>
                )}

                {(activeLayerTool === 'visibility') && (
                    <>
                        <div className="layer-section-header">Operational Overlays</div>
                        <div>
                            <div className="layer-item-redesigned">
                                <div className="layer-info">
                                    <Pencil size={13} style={{ color: "var(--color-primary)" }} />
                                    <span>Workspace Drawings</span>
                                </div>
                                <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                                    <input
                                        type="checkbox"
                                        checked={isDrawingVisible}
                                        onChange={() => setIsDrawingVisible(!isDrawingVisible)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </>
                )}



                <div className="layer-section-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: activeLayerTool === 'querybuilder' ? '12px 0 8px' : '8px 0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#5f6368' }}>Server Layers</span>
                        {activeLayerTool === 'querybuilder' && (
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', marginRight: '4px' }}>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)' }}>ALL</span>
                                <label className="toggle-switch" style={{ transform: 'scale(0.7)' }}>
                                    <input
                                        type="checkbox"
                                        checked={geoServerLayers.length > 0 && selectedQueryLayerIds.length === geoServerLayers.length}
                                        onChange={toggleSelectAllQuery}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        )}
                        {activeLayerTool === 'info' && (
                            <div className="selection-mode-toggle" style={{
                                display: 'flex',
                                backgroundColor: 'rgba(var(--color-primary-rgb), 0.08)',
                                borderRadius: '6px',
                                padding: '2px',
                                marginLeft: '8px'
                            }}>
                                <button
                                    className={`mode-btn ${infoSelectionMode === 'click' ? 'active' : ''}`}
                                    onClick={() => setInfoSelectionMode('click')}
                                    title="Click Mode"
                                    style={{
                                        border: 'none',
                                        background: infoSelectionMode === 'click' ? 'var(--color-primary)' : 'transparent',
                                        color: infoSelectionMode === 'click' ? 'white' : 'inherit',
                                        borderRadius: '4px',
                                        padding: '4px 8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <MousePointer2 size={14} />
                                </button>
                                <button
                                    className={`mode-btn ${infoSelectionMode === 'drag' ? 'active' : ''}`}
                                    onClick={() => setInfoSelectionMode('drag')}
                                    title="Drag Mode"
                                    style={{
                                        border: 'none',
                                        background: infoSelectionMode === 'drag' ? 'var(--color-primary)' : 'transparent',
                                        color: infoSelectionMode === 'drag' ? 'white' : 'inherit',
                                        borderRadius: '4px',
                                        padding: '4px 8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <BoxSelect size={14} />
                                </button>
                            </div>
                        )}

                        {activeLayerTool === 'reorder' && (
                            <button
                                className="save-sequence-btn"
                                onClick={handleSaveAllSequences}
                                disabled={isSavingSequences}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 10px',
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: isSavingSequences ? 'wait' : 'pointer',
                                    marginLeft: 'auto',
                                    transition: 'all 0.2s',
                                    opacity: isSavingSequences ? 0.7 : 1
                                }}
                            >
                                {isSavingSequences ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
                                Save Sequence
                            </button>
                        )}
                    </div>
                    {(activeLayerTool === 'visibility' || activeLayerTool === 'info' || activeLayerTool === 'spatialjoin') && serverLayers.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 500 }}>ALL</span>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={serverLayers.every(l => l.visible)}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        serverLayers.forEach(l => {
                                            if (l.visible !== checked) handleToggleGeoLayer(l.id);
                                        });
                                    }}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    )}
                    {activeLayerTool === 'swipe' && geoServerLayers.filter(l => l.visible).length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 500 }}>ALL</span>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={swipeLayerIds?.length === geoServerLayers.filter(l => l.visible).length && swipeLayerIds?.length > 0}
                                    onChange={(e) => handleToggleSwipeAll(e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    )}
                </div>

                <div className="layer-list-group scrollable">
                    {(() => {
                        const sourceLayers = activeLayerTool === 'reorder' ? localLayers : serverLayers;

                        const displayedLayers = (
                            activeLayerTool === 'density' ||
                            activeLayerTool === 'info' ||
                            activeLayerTool === 'action' ||
                            activeLayerTool === 'styles' ||
                            activeLayerTool === 'attribute' ||
                            activeLayerTool === 'swipe' ||
                            activeLayerTool === 'querybuilder' ||
                            activeLayerTool === 'spatialjoin' ||
                            activeLayerTool === 'analysis'
                        )
                            ? sourceLayers.filter(l => l.visible)
                            : sourceLayers;

                        const displayedTempLayers = (() => {
                            if (!tempLayers.length) return [];
                            return tempLayers.filter(layer => {
                                const isToolSupported =
                                    !activeLayerTool ||
                                    activeLayerTool === 'visibility' ||
                                    activeLayerTool === 'density' ||
                                    activeLayerTool === 'info' ||
                                    activeLayerTool === 'action' ||
                                    activeLayerTool === 'swipe' ||
                                    activeLayerTool === 'attribute';
                                if (!isToolSupported) return false;
                                if (activeLayerTool && activeLayerTool !== 'visibility' && activeLayerTool !== 'swipe' && !layer.visible) return false;
                                return true;
                            });
                        })();

                        if (displayedLayers.length === 0 && displayedTempLayers.length === 0) {
                            return (
                                <div className="empty-layers-msg">
                                    {(activeLayerTool === 'density' || activeLayerTool === 'legend' || activeLayerTool === 'styles' || activeLayerTool === 'swipe')
                                        ? "No visible layers."
                                        : "No layers connected."}
                                </div>
                            );
                        }

                        return (
                            <>
                                {displayedLayers.map((layer, index) => (
                                    <div
                                        key={layer.id}
                                        draggable={activeLayerTool === 'reorder'}
                                        onDragStart={(e) => handleDragStart(e, layer.id)}
                                        onDragOver={(e) => handleDragOver(e, layer.id)}
                                        onDragEnd={handleDragEnd}
                                        className={activeLayerTool === 'reorder' ? 'draggable-layer-item' : ''}
                                    >
                                        <div
                                            className={`layer-item-redesigned 
                                                ${activeLayerTool === 'zoom' && activeZoomLayerId === layer.id ? 'active' : ''} 
                                                ${activeLayerTool === 'highlight' && activeHighlightLayerId === layer.id ? 'active' : ''}
                                                ${false}
                                                ${draggedLayerId === layer.id ? 'dragging-active' : ''}
                                                ${activeLayerTool === 'density' ? 'density-layout' : ''}
                                            `}
                                            onClick={() => {
                                                if (activeLayerTool === 'action') {
                                                } else if (activeLayerTool === 'styles') {
                                                    onOpenStyleEditor(layer);
                                                }
                                            }}
                                            style={{
                                                cursor: (activeLayerTool === 'styles') ? 'pointer' : 'default'
                                            }}
                                        >
                                            <div className="layer-info">
                                                <CircleDot size={14} className="layer-icon" />
                                                <span style={{
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    fontWeight: '450'
                                                }}>
                                                    {layer.name}
                                                </span>
                                            </div>
                                            {renderLayerContent(layer)}
                                        </div>


                                        {/* Query Builder UI removed from here, now in QueryBuilderCard */}
                                    </div>
                                ))}


                                {/* Spatial Join Run Button */}
                                {activeLayerTool === 'spatialjoin' && (
                                    <div style={{ padding: '12px 4px' }}>
                                        <button
                                            className="elite-button premium-join-btn"
                                            onClick={() => onOpenSpatialJoin(null)}
                                            style={{
                                                width: '100%',
                                                gap: '10px',
                                                padding: '12px',
                                                background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '10px',
                                                fontWeight: '600',
                                                fontSize: '13px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 4px 12px -2px rgba(var(--color-primary-rgb), 0.3)',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Combine size={18} />
                                            Run Spatial Join
                                        </button>
                                    </div>
                                )}

                                {/* Query Builder Run Button */}
                                {activeLayerTool === 'querybuilder' && (
                                    <div style={{ padding: '12px 4px' }}>
                                        <button
                                            className="elite-button premium-query-btn"
                                            onClick={() => setShowQueryBuilder(true)}
                                            style={{
                                                width: 'auto',
                                                gap: '10px',
                                                padding: '12px',
                                                background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '10px',
                                                fontWeight: '600',
                                                fontSize: '13px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 4px 12px -2px rgba(6, 182, 212, 0.3)',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <DatabaseZap size={18} strokeWidth={2.5} />
                                            Run Query Builder
                                        </button>
                                    </div>
                                )}

                                {/* Temp Layers unified list continuation */}
                                {displayedTempLayers.length > 0 && (
                                    <>
                                        <div className="layer-section-header" style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            marginTop: displayedLayers.length > 0 ? '8px' : '0',
                                            padding: '4px 8px'
                                        }}>
                                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b' }}>Temporary</span>
                                            {(activeLayerTool === 'visibility' || activeLayerTool === 'info') && (
                                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 500 }}>ALL</span>
                                                    <label className="toggle-switch">
                                                        <input
                                                            type="checkbox"
                                                            checked={tempLayers.every(l => l.visible)}
                                                            onChange={(e) => {
                                                                const checked = e.target.checked;
                                                                tempLayers.forEach(l => {
                                                                    if (l.visible !== checked) handleToggleGeoLayer(l.id);
                                                                });
                                                            }}
                                                        />
                                                        <span className="toggle-slider"></span>
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                        {displayedTempLayers.map((layer) => (
                                            <div key={layer.id} className={`layer-item-redesigned ${activeLayerTool === 'density' ? 'density-layout' : ''}`} style={{
                                                borderLeft: (
                                                    (activeLayerTool === 'action' && (activeZoomLayerId === layer.id || activeHighlightLayerId === layer.id))
                                                ) ? '3px solid #f59e0b' : 'none',
                                            }}>
                                                <div className="layer-info" style={{
                                                    flex: activeLayerTool === 'density' ? '0 0 auto' : '1',
                                                    maxWidth: activeLayerTool === 'density' ? '120px' : 'none'
                                                }}>
                                                    <FileJson size={14} className="layer-icon" style={{ color: '#f59e0b' }} />
                                                    <span style={{
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        fontSize: '13px',
                                                        fontWeight: '450'
                                                    }}>
                                                        {layer.name}
                                                    </span>
                                                </div>
                                                {renderLayerContent(layer)}
                                            </div>
                                        ))}
                                        {activeLayerTool && !['visibility', 'density', 'info', 'action', 'swipe', 'attribute'].includes(activeLayerTool) && (
                                            <div style={{ padding: '8px 12px', fontSize: '12px', opacity: 0.5, fontStyle: 'italic' }}>
                                                This tool is not available for temporary layers.
                                            </div>
                                        )}

                                        {activeLayerTool === 'legend' && (
                                            <div style={{ padding: '16px 4px 8px' }}>
                                                <button
                                                    className={`elite-button show-legend-bar-btn ${showTopLegend ? 'active' : ''}`}
                                                    onClick={() => setShowTopLegend(!showTopLegend)}
                                                    style={{
                                                        width: '100%',
                                                        gap: '10px',
                                                        padding: '12px',
                                                        background: showTopLegend
                                                            ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                                                            : 'rgba(255, 255, 255, 0.6)',
                                                        color: showTopLegend ? 'white' : 'var(--color-text)',
                                                        border: showTopLegend ? 'none' : '1px solid rgba(226, 232, 240, 0.8)',
                                                        borderRadius: '12px',
                                                        fontWeight: '600',
                                                        fontSize: '13px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        boxShadow: showTopLegend
                                                            ? '0 4px 12px rgba(59, 130, 246, 0.3)'
                                                            : '0 2px 4px rgba(0, 0, 0, 0.05)',
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <List size={18} />
                                                    {showTopLegend ? 'Hide Legend Bar' : 'Show Legend Bar'}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};


/**
 * Hook to manage layer visibility, opacity, and CQL filters.
 */
export const useLayerVisibility = (initialGeoLayers = [], initialLocalLayers = []) => {
    const [geoServerLayers, setGeoServerLayers] = useState(initialGeoLayers);
    const [localVectorLayers, setLocalVectorLayers] = useState(initialLocalLayers);

    const handleToggleGeoLayer = useCallback((layerId) => {
        setGeoServerLayers(prev => prev.map(l =>
            l.id === layerId ? { ...l, visible: !l.visible } : l
        ));
        setLocalVectorLayers(prev => prev.map(l =>
            l.id === layerId ? { ...l, visible: !l.visible } : l
        ));
    }, []);

    const handleToggleAllLayers = useCallback((turnOn) => {
        setGeoServerLayers(prev => prev.map(l => ({ ...l, visible: turnOn })));
        setLocalVectorLayers(prev => prev.map(l => ({ ...l, visible: turnOn })));
    }, []);

    const handleLayerOpacityChange = useCallback((layerId, newOpacity) => {
        setGeoServerLayers(prev => prev.map(l =>
            l.id === layerId ? { ...l, opacity: parseFloat(newOpacity) } : l
        ));
        setLocalVectorLayers(prev => prev.map(l =>
            l.id === layerId ? { ...l, opacity: parseFloat(newOpacity) } : l
        ));
    }, []);

    const handleToggleLayerQuery = useCallback((layerId) => {
        setGeoServerLayers(prev => prev.map(l =>
            l.id === layerId ? { ...l, queryable: !l.queryable } : l
        ));
        setLocalVectorLayers(prev => prev.map(l =>
            l.id === layerId ? { ...l, queryable: !l.queryable } : l
        ));
    }, []);

    const handleApplyLayerFilter = useCallback((layerId, cqlFilter, queryingLayer, setQueryingLayer) => {
        setGeoServerLayers(prev => prev.map(l =>
            l.id === layerId ? { ...l, cqlFilter: cqlFilter } : l
        ));

        // Also update the currently querying layer if it matches
        if (queryingLayer && queryingLayer.id === layerId && setQueryingLayer) {
            setQueryingLayer(prev => ({ ...prev, cqlFilter: cqlFilter }));
        }
    }, []);

    const handleApplyMultiLayerFilters = useCallback((filterMap, queryingLayer, setQueryingLayer) => {
        // filterMap: { layerId: cqlFilter }
        setGeoServerLayers(prev => prev.map(l => {
            if (filterMap.hasOwnProperty(l.id)) {
                return { ...l, cqlFilter: filterMap[l.id] };
            }
            return l;
        }));

        // Update queryingLayer if its ID is in the map
        if (queryingLayer && filterMap.hasOwnProperty(queryingLayer.id) && setQueryingLayer) {
            setQueryingLayer(prev => ({ ...prev, cqlFilter: filterMap[queryingLayer.id] }));
        }
    }, []);

    const handleAddLocalVectorLayer = useCallback((newLayer) => {
        setLocalVectorLayers(prev => [...prev, newLayer]);
    }, []);

    return {
        geoServerLayers,
        setGeoServerLayers,
        localVectorLayers,
        setLocalVectorLayers,
        handleToggleGeoLayer,
        handleToggleAllLayers,
        handleLayerOpacityChange,
        handleToggleLayerQuery,
        handleApplyLayerFilter,
        handleApplyMultiLayerFilters,
        handleAddLocalVectorLayer
    };
};

/**
 * Hook to manage layer actions like Zoom and Highlight.
 */
export const useLayerActions = (mapInstanceRef, operationalLayersRef) => {
    const [activeZoomLayerId, setActiveZoomLayerId] = useState(null);
    const [activeHighlightLayerId, setActiveHighlightLayerId] = useState(null);
    const [isHighlightAnimating, setIsHighlightAnimating] = useState(false);

    const handleZoomToLayer = useCallback(async (layerId, allLayers) => {
        if (!mapInstanceRef.current) return;
        const layer = allLayers.find(l => l.id === layerId);
        if (!layer) return;

        setActiveZoomLayerId(layerId);
        setActiveHighlightLayerId(null); 

        try {
            if (layer.isLocal) {
                const olLayer = operationalLayersRef.current[layer.id];
                if (olLayer) {
                    const source = olLayer.getSource();
                    const extent = source.getExtent();

                    if (extent && !isEmpty(extent) && !extent.some(val => !isFinite(val)) && extent[0] !== Infinity) {
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
                const p1 = fromLonLat([bbox[0], bbox[1]]);
                const p2 = fromLonLat([bbox[2], bbox[3]]);
                const extent = [p1[0], p1[1], p2[0], p2[1]];

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
    }, [mapInstanceRef, operationalLayersRef]);

    const handleHighlightLayer = useCallback(async (layerId, allLayers) => {
        if (!mapInstanceRef.current) return;
        const layer = allLayers.find(l => l.id === layerId);
        if (!layer) return;

        if (activeHighlightLayerId === layerId && isHighlightAnimating) {
            setIsHighlightAnimating(false);
            const olLayer = operationalLayersRef.current[layerId];
            if (olLayer) olLayer.setOpacity(layer.opacity || 1);
            return;
        }

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
    }, [activeHighlightLayerId, isHighlightAnimating, mapInstanceRef, operationalLayersRef]);

    return {
        activeZoomLayerId,
        setActiveZoomLayerId,
        activeHighlightLayerId,
        setActiveHighlightLayerId,
        isHighlightAnimating,
        setIsHighlightAnimating,
        handleZoomToLayer,
        handleHighlightLayer
    };
};

/**
 * Layer Management and Monitoring Utilities (Localised)
 */

export const getLayerAttributes = async (fullLayerName, includeDetails = false) => {
    try {
        const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=DescribeFeatureType&typeName=${fullLayerName}&outputFormat=application/json`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data.featureTypes?.[0]?.properties) {
                const props = data.featureTypes[0].properties;
                if (includeDetails) {
                    return props.map(p => {
                        const isGeom = p.type.startsWith('gml:') || p.type.includes('PropertyType') || ['geom', 'the_geom', 'geometry'].includes(p.name.toLowerCase());
                        let geomType = 'Unknown';
                        if (isGeom && p.type.includes('PropertyType')) geomType = p.type.split(':')[1].replace('PropertyType', '');
                        return { name: p.name, type: p.type, isGeometry: isGeom, geometryType: geomType };
                    });
                }
                return props.map(p => p.name);
            }
        }
    } catch (err) { console.error('Failed to fetch layer attributes:', err); }
    return [];
};

export const getLayerBBox = async (fullLayerName) => {
    try {
        const [ws, name] = fullLayerName.split(':');
        const lRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/layers/${name}.json`, { headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' } });
        if (!lRes.ok) return null;
        const lData = await lRes.json();
        const type = lData.layer.type.toLowerCase();
        const endpoint = type === 'raster' ? 'coverages' : 'featuretypes';
        const rRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/${endpoint}/${name}.json`, { headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' } });
        if (!rRes.ok) return null;
        const rData = await rRes.json();
        const info = rData.featureType || rData.coverage;
        if (info?.latLonBoundingBox) {
            const b = info.latLonBoundingBox;
            return [parseFloat(b.minx), parseFloat(b.miny), parseFloat(b.maxx), parseFloat(b.maxy)];
        }
    } catch (err) { console.error('Failed to fetch layer extent:', err); }
    return null;
};

const fetchSLD = async (styleName, workspace) => {
    try {
        const cleanName = styleName.includes(':') ? styleName.split(':')[1] : styleName;
        let res = null;
        if (workspace) {
            res = await fetch(`${GEOSERVER_URL}/rest/workspaces/${workspace}/styles/${cleanName}.sld?t=${Date.now()}`, { headers: { 'Authorization': AUTH_HEADER } });
            if (!res.ok) res = await fetch(`${GEOSERVER_URL}/rest/workspaces/${workspace}/styles/${cleanName}?t=${Date.now()}`, { headers: { 'Authorization': AUTH_HEADER } });
        }
        if (!res || !res.ok) {
            res = await fetch(`${GEOSERVER_URL}/rest/styles/${styleName}.sld?t=${Date.now()}`, { headers: { 'Authorization': AUTH_HEADER } });
            if (!res.ok) res = await fetch(`${GEOSERVER_URL}/rest/styles/${styleName}?t=${Date.now()}`, { headers: { 'Authorization': AUTH_HEADER } });
        }
        if (res?.ok) return { styleName, sldBody: await res.text() };
    } catch (err) { console.error(`Error fetching SLD for ${styleName}:`, err); }
    return null;
};

export const getLayerStyle = async (fullLayerName) => {
    try {
        const [ws, name] = fullLayerName.split(':');
        const sStyle = `${name}_Style`;
        const sCheck = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/styles/${sStyle}.json?t=${Date.now()}`, { headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' } });
        if (sCheck.ok) {
            const result = await fetchSLD(sStyle, ws);
            if (result?.sldBody) return { ...result, isLayerSpecificStyle: true };
        }
        const lRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/layers/${name}.json?t=${Date.now()}`, { headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' } });
        if (!lRes.ok) return null;
        const lData = await lRes.json();
        const defStyle = lData.layer.defaultStyle;
        const isWsStyle = defStyle.href.includes('/workspaces/');
        const result = await fetchSLD(defStyle.name, isWsStyle ? ws : null);
        return result ? { ...result, isLayerSpecificStyle: false } : { styleName: defStyle.name, sldBody: null, isLayerSpecificStyle: false };
    } catch (err) { console.error('Failed to fetch layer style:', err); return null; }
};

export const updateLayerStyle = async (fullLayerName, styleName, sldBody) => {
    try {
        const [ws] = fullLayerName.split(':');
        let styleWs = ws, cleanName = styleName;
        if (styleName?.includes(':')) {
            const parts = styleName.split(':');
            styleWs = parts[0]; cleanName = parts[1];
        }
        const wsRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${styleWs}/styles/${cleanName}.json`, { headers: { 'Authorization': AUTH_HEADER } });
        const glRes = await fetch(`${GEOSERVER_URL}/rest/styles/${cleanName}.json`, { headers: { 'Authorization': AUTH_HEADER } });
        let putUrl = wsRes.ok ? `${GEOSERVER_URL}/rest/workspaces/${styleWs}/styles/${cleanName}` : glRes.ok ? `${GEOSERVER_URL}/rest/styles/${cleanName}` : null;
        if (!putUrl) {
            const cRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${styleWs}/styles`, {
                method: 'POST', headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
                body: JSON.stringify({ style: { name: cleanName, filename: `${cleanName}.sld` } })
            });
            if (!cRes.ok) return false;
            putUrl = `${GEOSERVER_URL}/rest/workspaces/${styleWs}/styles/${cleanName}`;
        }
        const pRes = await fetch(putUrl, { method: 'PUT', headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/vnd.ogc.sld+xml' }, body: sldBody });
        return pRes.ok;
    } catch (err) { console.error('Failed to update layer style:', err); return false; }
};

export const setLayerDefaultStyle = async (fullLayerName, styleName) => {
    try {
        const [ws, name] = fullLayerName.split(':');
        const cleanName = styleName.includes(':') ? styleName.split(':')[1] : styleName;
        const res = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/layers/${name}.json`, {
            method: 'PUT', headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
            body: JSON.stringify({ layer: { defaultStyle: { name: cleanName, workspace: { name: ws } } } })
        });
        return res.ok;
    } catch (err) { console.error('Failed to set default style:', err); return false; }
};

export const getLegendUrl = (layerName) => `${GEOSERVER_URL}/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&WIDTH=20&HEIGHT=20&LAYER=${layerName}`;
export const getLegendRuleUrl = (layerName, ruleName) => `${GEOSERVER_URL}/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&WIDTH=20&HEIGHT=20&LAYER=${layerName}&RULE=${encodeURIComponent(ruleName)}`;

export const fetchLegendRules = async (layerName) => {
    try {
        const url = `${GEOSERVER_URL}/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=application/json&LAYER=${layerName}`;
        const res = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
        if (!res.ok) return null;
        const data = await res.json();
        if (data?.Legend?.[0]?.rules) {
            return data.Legend[0].rules.map(r => ({ name: r.name || r.title || 'Default', title: (r.title || r.name || 'Default').toLowerCase() === 'rule1' ? 'default' : (r.title || r.name || 'Default') }));
        }
    } catch (err) { console.warn('[Legend] Fetch failed for', layerName, err); }
    return null;
};

export const uploadIcon = async (file, workspace) => {
    try {
        const ext = file.name.split('.').pop().toLowerCase();
        const mime = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }[ext] || 'application/octet-stream';
        const res = await fetch(`${GEOSERVER_URL}/rest/resource/workspaces/${workspace}/styles/${file.name}`, {
            method: 'PUT', headers: { 'Authorization': AUTH_HEADER, 'Content-Type': mime }, body: file
        });
        return res.ok ? file.name : null;
    } catch (err) { console.error('Icon upload failed:', err); return null; }
};

export const recalculateLayerBBox = async (fullLayerName) => {
    try {
        const [ws, name] = fullLayerName.split(':');
        const layerRes = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/layers/${name}.json`, { headers: { 'Authorization': AUTH_HEADER, 'Accept': 'application/json' } });
        if (!layerRes.ok) throw new Error(`Layer lookup failed: ${layerRes.status}`);
        const layerData = await layerRes.json();
        const dsMatch = layerData.layer.resource.href.match(/\/datastores\/([^/]+)\//);
        const dsName = dsMatch ? dsMatch[1] : null;
        if (!dsName) throw new Error('Could not determine datastore');
        const res = await fetch(`${GEOSERVER_URL}/rest/workspaces/${ws}/datastores/${dsName}/featuretypes/${name}?recalculate=nativebbox,latlonbbox`, {
            method: 'PUT', headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' }, body: JSON.stringify({ featureType: { name } })
        });
        return res.ok;
    } catch (err) { console.error('[BBox] Error recalculating extent', err); return false; }
};

export const deleteFeature = async (fullLayerName, feature) => {
    try {
        const fid = feature.id || feature.properties?.id || feature.properties?.fid;
        if (!fid) return false;
        const xml = `<wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc"><wfs:Delete typeName="${fullLayerName}"><ogc:Filter><ogc:FeatureId fid="${fid}"/></ogc:Filter></wfs:Delete></wfs:Transaction>`;
        const res = await fetch(`${GEOSERVER_URL}/wfs`, { method: 'POST', headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'text/xml' }, body: xml });
        if (res.ok) {
            const text = await res.text();
            return text.includes('TransactionSummary') && (text.includes('totalDeleted="1"') || text.includes('>1</wfs:totalDeleted>'));
        }
        return false;
    } catch (err) { console.error('Delete feature failed:', err); return false; }
};

export const updateFeature = async (fullLayerName, featureId, properties) => {
    try {
        if (!featureId) return false;
        let propsXml = '';
        Object.entries(properties).forEach(([k, v]) => {
            if (['id', 'ogc_fid', 'geometry', '_feature', 'isDirty', 'objectid', 'fid', 'featid'].includes(k)) return;
            propsXml += `<wfs:Property><wfs:Name>${k}</wfs:Name><wfs:Value>${v}</wfs:Value></wfs:Property>`;
        });
        const xml = `<wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc"><wfs:Update typeName="${fullLayerName}">${propsXml}<ogc:Filter><ogc:FeatureId fid="${featureId}"/></ogc:Filter></wfs:Update></wfs:Transaction>`;
        const res = await fetch(`${GEOSERVER_URL}/wfs`, { method: 'POST', headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'text/xml' }, body: xml });
        if (res.ok) {
            const text = await res.text();
            return text.includes('TransactionSummary') && (text.includes('totalUpdated="1"') || text.includes('>1</wfs:totalUpdated>'));
        }
        return false;
    } catch (err) { console.error('Update feature failed:', err); return false; }
};

export const SaveNewAttribute = async (fullLayerName, properties, geometryFeature, geometryName = 'geom', srid = '3857', targetGeometryType = 'Unknown') => {
    try {
        if (!geometryFeature) return false;
        const geom = geometryFeature.getGeometry().clone();
        if (srid && srid !== '3857') geom.transform('EPSG:3857', `EPSG:${srid}`);
        const coords = geom.getCoordinates();
        const type = geom.getType();
        const fmt = (arr) => arr.map(c => `${c[0]} ${c[1]}`).join(' ');
        let gml = '';
        if (type === 'Point') gml = `<gml:Point srsName="EPSG:${srid}"><gml:pos>${coords[0]} ${coords[1]}</gml:pos></gml:Point>`;
        else if (type === 'LineString') gml = `<gml:LineString srsName="EPSG:${srid}"><gml:posList>${fmt(coords)}</gml:posList></gml:LineString>`;
        else if (type === 'Polygon') {
            const poly = `<gml:Polygon srsName="EPSG:${srid}"><gml:exterior><gml:LinearRing><gml:posList>${fmt(coords[0])}</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon>`;
            gml = targetGeometryType.toLowerCase().includes('multi') ? `<gml:MultiPolygon srsName="EPSG:${srid}"><gml:polygonMember>${poly}</gml:polygonMember></gml:MultiPolygon>` : poly;
        }
        const prefix = fullLayerName.split(':')[0];
        let propsXml = '';
        Object.entries(properties).forEach(([k, v]) => {
            if (!k || ['id', 'layerid', 'gid', 'objectid', 'fid', 'ogc_fid', 'geom', 'the_geom', 'geometry'].includes(k.toLowerCase()) || k.startsWith('_') || v === null || v === undefined || v === '') return;
            propsXml += `<${prefix}:${k}>${String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</${prefix}:${k}>`;
        });
        propsXml += `<${prefix}:${geometryName}>${gml}</${prefix}:${geometryName}>`;
        const xml = `<wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:${prefix}="${prefix}"><wfs:Insert><${fullLayerName}>${propsXml}</${fullLayerName}></wfs:Insert></wfs:Transaction>`;
        const res = await fetch(`${GEOSERVER_URL}/wfs`, { method: 'POST', headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'text/xml' }, body: xml });
        if (res.ok) {
            const text = await res.text();
            return text.includes('TransactionSummary') && (text.includes('totalInserted="1"') || text.includes('>1</wfs:totalInserted>'));
        }
        return false;
    } catch (err) { console.error('Save new attribute failed:', err); return false; }
};

export const getFeaturesForAttributeTable = async (layerId, fullLayerName) => {
    try {
        const url = `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${fullLayerName}&outputFormat=application/json&maxFeatures=100000`;
        const res = await fetch(url, { headers: { 'Authorization': AUTH_HEADER } });
        if (res.ok) {
            const data = await res.json();
            return data.features || [];
        }
    } catch (err) { console.error('Fetch features failed:', err); }
    return [];
};

export default LayerOperations;

