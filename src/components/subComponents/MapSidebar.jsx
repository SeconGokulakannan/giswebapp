import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Plus, Minus, LayoutGrid, Maximize, LocateFixed, Navigation } from 'lucide-react';

const MapSidebar = ({
    handleZoomIn,
    handleZoomOut,
    showGrid,
    setShowGrid,
    handleFullscreen,
    handleLocateMe
}) => {
    return (
        <div className="elite-sidebar">
            <div className="sidebar-section">
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button className="elite-sidebar-btn zoom-in" onClick={handleZoomIn}>
                            <Plus size={14} strokeWidth={1.5} />
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={12}>
                            Zoom In
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button className="elite-sidebar-btn zoom-out" onClick={handleZoomOut}>
                            <Minus size={14} strokeWidth={1.5} />
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={12}>
                            Zoom Out
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>
            </div>

            <div className="sidebar-divider"></div>

            <div className="sidebar-section">
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button
                            className={`elite-sidebar-btn ${showGrid ? 'active' : ''}`}
                            onClick={() => setShowGrid(!showGrid)}
                        >
                            <LayoutGrid size={14} strokeWidth={1.5} />
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={12}>
                            {showGrid ? 'Hide' : 'Show'} Grid
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button className="elite-sidebar-btn locate" onClick={handleLocateMe}>
                            <Navigation size={14} strokeWidth={1.5} />
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={12}>
                            My Location
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button className="elite-sidebar-btn fullscreen" onClick={handleFullscreen}>
                            <Maximize size={14} strokeWidth={1.5} />
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={12}>
                            Fullscreen
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>
            </div>
        </div>
    );
};

export default MapSidebar;
