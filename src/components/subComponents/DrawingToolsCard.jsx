import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
    MapPinned,
    Waypoints,
    Pentagon,
    Orbit,
    Triangle,
    Maximize,
    Circle as CircleIcon,
    Spline,
    Pencil,
    ChevronDown,
    Trash2
} from 'lucide-react';

const DrawingToolsCard = ({
    activePanel,
    activeTool,
    handleToolClick,
    handleMeasureClick,
    showDrawingLabels,
    setShowDrawingLabels,
    showAnalysisLabels,
    setShowAnalysisLabels,
    measurementUnits,
    setMeasurementUnits,
    handleClearDrawings
}) => {
    if (activePanel === 'tools') {
        return (
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
        );
    }

    return null;
};

export default DrawingToolsCard;

