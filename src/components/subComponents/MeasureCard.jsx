import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
    DraftingCompass,
    SquareDashed,
    ChevronDown,
    Trash2
} from 'lucide-react';

const MeasureCard = ({
    activePanel,
    activeMeasureTool,
    handleMeasureClick,
    showMeasureLabels,
    setShowMeasureLabels,
    measurementUnits,
    setMeasurementUnits,
    handleClearMeasurements
}) => {
    if (activePanel !== 'utility_tools') return null;

    return (
        <div className="panel-section">
            <div className="panel-section-title" style={{ marginTop: '24px' }}>Measurement Tools</div>
            <div className="tool-grid">
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <div
                            className={`tool-item ${activeMeasureTool === 'distance' ? 'active' : ''}`}
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
                            className={`tool-item ${activeMeasureTool === 'area' ? 'active' : ''}`}
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

            {['distance', 'area'].includes(activeMeasureTool) && (
                <div className="fade-in">
                    <div className="panel-divider" />
                    <div className="panel-section-title">Label Settings</div>
                    <div className="label-toggle-container">
                        <label className="toggle-label">
                            <span>Show Labels</span>
                            <div className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={showMeasureLabels}
                                    onChange={(e) => setShowMeasureLabels(e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                            </div>
                        </label>
                    </div>

                    {showMeasureLabels && (
                        <div className="dropdown-container">
                            <div className="panel-section-title" style={{ marginTop: '12px', fontSize: '11px', opacity: 0.7 }}>Measurement Units</div>
                            <div className="select-wrapper">
                                <select
                                    className="elite-select"
                                    value={measurementUnits}
                                    onChange={(e) => setMeasurementUnits(e.target.value)}
                                >
                                    {activeMeasureTool === 'distance' ? (
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
                    onClick={handleClearMeasurements}
                >
                    <Trash2 size={16} />
                    <span>Clear Measurements</span>
                </button>
            </div>
        </div>
    );
};

export default MeasureCard;
