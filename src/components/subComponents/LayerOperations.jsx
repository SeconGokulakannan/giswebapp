import { useState } from 'react';
import { getLegendUrl } from '../../services/Server';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Eye, Settings2, List, Info, MapPinned, Zap, Palette, Repeat, Table, Plus, RefreshCw, DatabaseZap, FileChartPie, Pencil, CircleDot } from 'lucide-react';

const LayerOperations = ({ isDrawingVisible, setIsDrawingVisible, geoServerLayers, handleToggleGeoLayer, handleLayerOpacityChange, handleZoomToLayer, handleToggleAllLayers, activeLayerTool, setActiveLayerTool, handleToggleLayerQuery }) => {

    const tools = [
        { icon: Eye, label: 'Visibility', id: 'visibility' },
        { icon: Settings2, label: 'Layer Density', id: 'density' },
        { icon: List, label: 'Layers Legend', id: 'legend' },
        { icon: Info, label: 'Feature Info', id: 'info' },
        { icon: MapPinned, label: 'Zoom To Layer', id: 'zoom' },
        { icon: Zap, label: 'Highlight Layer', id: 'highlight' },
        { icon: Palette, label: 'Layer Styles', id: 'styles' },
        { icon: Repeat, label: 'Reorder Layers', id: 'reorder' },
        { icon: Table, label: 'Attribute Table', id: 'attribute' },
        { icon: Plus, label: 'New Layer', id: 'new' },
        { icon: RefreshCw, label: 'Reload Layer', id: 'reload' },
        { icon: DatabaseZap, label: 'Query Builder', id: 'querybuilder' },
        { icon: FileChartPie, label: 'Run Analysis', id: 'analysis' }
    ];

    const allLayersVisible = geoServerLayers.length > 0 && geoServerLayers.every(l => l.visible);

    const renderLayerContent = (layer) => {
        switch (activeLayerTool) {
            case 'visibility':
                return (
                    <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
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
                    <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
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
                    <div className="density-control" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '10px', opacity: 0.7 }}>{Math.round((layer.opacity || 1) * 100)}%</span>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={layer.opacity !== undefined ? layer.opacity : 1}
                            onChange={(e) => handleLayerOpacityChange(layer.id, parseFloat(e.target.value))}
                            className="layer-opacity-slider"
                            title="Adjust Opacity"
                        />
                    </div>
                );
            case 'zoom':
                return (
                    <button
                        className="icon-toggle"
                        onClick={() => handleZoomToLayer(layer.id)}
                        title="Zoom to Layer"
                    >
                        <MapPinned size={18} />
                    </button>
                );
            case 'legend':
                return (
                    <div className="layer-legend-preview" style={{ marginLeft: 'auto' }}>
                        <img
                            src={getLegendUrl(layer.fullName)}
                            alt={`${layer.name} legend`}
                            style={{ maxHeight: '24px', maxWidth: '100px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                            onError={(e) => e.target.style.display = 'none'}
                        />
                    </div>
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

                {(activeLayerTool === 'visibility' || activeLayerTool === 'info') && (
                    <>
                        <div className="layer-section-header">Operational Overlays</div>
                        <div>
                            <div className="layer-item-redesigned">
                                <div className="layer-info">
                                    <Pencil size={13} style={{ color: "var(--color-primary)" }} />
                                    <span>Workspace Drawings</span>
                                </div>
                                <label
                                    className="toggle-switch"
                                    style={{ transform: 'scale(0.8)', marginRight: '-4px' }}
                                >
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

                <div className="layer-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>GeoServer Layers</span>
                    {(activeLayerTool === 'visibility' || activeLayerTool === 'info') && geoServerLayers.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 500 }}>ALL</span>
                            <label className="toggle-switch" style={{ transform: 'scale(0.7)', marginRight: '-4px' }}>
                                <input
                                    type="checkbox"
                                    checked={allLayersVisible}
                                    onChange={(e) => handleToggleAllLayers(e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    )}
                </div>
                <div className="layer-list-group scrollable">
                    {(() => {
                        const displayedLayers = (activeLayerTool === 'density' || activeLayerTool === 'legend' || activeLayerTool === 'info')
                            ? geoServerLayers.filter(l => l.visible)
                            : geoServerLayers;

                        if (displayedLayers.length === 0) {
                            return (
                                <div className="empty-layers-msg">
                                    {(activeLayerTool === 'density' || activeLayerTool === 'legend')
                                        ? "No visible layers."
                                        : "No server layers connected."}
                                </div>
                            );
                        }

                        return displayedLayers.map(layer => (
                            <div className="layer-item-redesigned" key={layer.id}>
                                <div className="layer-info" style={{ flex: activeLayerTool === 'density' ? '0 0 auto' : '1', maxWidth: activeLayerTool === 'density' ? '120px' : 'none' }}>
                                    <CircleDot size={14} className="layer-icon" />
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px', fontWeight: '500' }}>{layer.name}</span>
                                </div>
                                {renderLayerContent(layer)}
                            </div>
                        ));
                    })()}
                </div>
            </div>
        </div>
    );
};

export default LayerOperations;
