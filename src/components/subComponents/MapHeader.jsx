import * as Tooltip from '@radix-ui/react-tooltip';
import {
    ArrowLeft,
    Map as MapIcon,
    Layers,
    PenTool,
    MapPin,
    Bookmark,
    Cog,
    Moon,
    Sun,
    Printer,
    Trash2,
    Lock,
    Unlock,
    DraftingCompass,
    Settings2
} from 'lucide-react';

const MapHeader = ({
    activePanel,
    setActivePanel,
    setIsPanelMinimized,
    toggleTheme,
    theme,
    handleClearDrawings,
    handlePrintClick,
    isLocked,
    setIsLocked,
    activeTool,
    handleToolClick,
    hasDrawings,
    hasMeasurements,
    onOpenLayerManagement,
    layoutMode,
    onToggleLayout
}) => {
    return (
        <header className={`header ${layoutMode === 'topbar' ? 'layout-topbar' : ''}`}>
            <div className="header-content">
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button
                            className="home-button"
                            onClick={() => window.location.reload()}
                            aria-label="Go Back"
                        >
                            <ArrowLeft size={18} />
                            <span>Main Menu</span>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" sideOffset={8}>
                            Back to Main Menu
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <div className="header-right-group">
                    <div className="logo">
                        <div className="logo-text">
                            <h1 className="logo-title">
                                <span className="logo-title-full">Geographical Information System</span>
                                <span className="logo-title-short">GIS</span>
                            </h1>
                        </div>
                    </div>

                    {layoutMode === 'topbar' && (
                        <>
                            <div className="vertical-divider" />
                            <nav className="toolbar">
                                <div className="toolbar-group">
                                    <Tooltip.Root>
                                        <Tooltip.Trigger asChild>
                                            <button
                                                className={`toolbar-button ${activePanel === 'layermanagement' ? 'active' : ''}`}
                                                onClick={onOpenLayerManagement}
                                            >
                                                <Cog size={20} />
                                            </button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                                Layer Management
                                                <Tooltip.Arrow className="TooltipArrow" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>

                                    <Tooltip.Root>
                                        <Tooltip.Trigger asChild>
                                            <button
                                                className={`toolbar-button ${activePanel === 'basemaps' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setActivePanel(activePanel === 'basemaps' ? null : 'basemaps');
                                                    setIsPanelMinimized(false);
                                                }}
                                            >
                                                <MapIcon size={20} />
                                            </button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                                Base Maps
                                                <Tooltip.Arrow className="TooltipArrow" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>

                                    <Tooltip.Root>
                                        <Tooltip.Trigger asChild>
                                            <button
                                                className={`toolbar-button ${activePanel === 'layers' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setActivePanel(activePanel === 'layers' ? null : 'layers');
                                                    setIsPanelMinimized(false);
                                                }}
                                            >
                                                <Layers size={20} />
                                            </button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                                Layers
                                                <Tooltip.Arrow className="TooltipArrow" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>

                                    <div className="toolbar-divider" />

                                    <Tooltip.Root>
                                        <Tooltip.Trigger asChild>
                                            <button
                                                className={`toolbar-button ${activePanel === 'tools' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setActivePanel(activePanel === 'tools' ? null : 'tools');
                                                    setIsPanelMinimized(false);
                                                }}
                                            >
                                                <PenTool size={20} />
                                            </button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                                Drawing Tools
                                                <Tooltip.Arrow className="TooltipArrow" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>

                                    <Tooltip.Root>
                                        <Tooltip.Trigger asChild>
                                            <button
                                                className={`toolbar-button ${activePanel === 'utility_tools' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setActivePanel(activePanel === 'utility_tools' ? null : 'utility_tools');
                                                    setIsPanelMinimized(false);
                                                }}
                                            >
                                                <DraftingCompass size={20} />
                                            </button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                                Utility Tools
                                                <Tooltip.Arrow className="TooltipArrow" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>

                                    <Tooltip.Root>
                                        <Tooltip.Trigger asChild>
                                            <button
                                                className={`toolbar-button ${activePanel === 'location' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setActivePanel(activePanel === 'location' ? null : 'location');
                                                    setIsPanelMinimized(false);
                                                }}
                                            >
                                                <MapPin size={20} />
                                            </button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                                Go to Location
                                                <Tooltip.Arrow className="TooltipArrow" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>

                                    <Tooltip.Root>
                                        <Tooltip.Trigger asChild>
                                            <button
                                                className={`toolbar-button ${activePanel === 'bookmarks' ? 'active' : ''}`}
                                                onClick={() => {
                                                    setActivePanel(activePanel === 'bookmarks' ? null : 'bookmarks');
                                                    setIsPanelMinimized(false);
                                                }}
                                            >
                                                <Bookmark size={20} />
                                            </button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                                Bookmarks
                                                <Tooltip.Arrow className="TooltipArrow" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>

                                    <div className="toolbar-divider" />

                                    <Tooltip.Root>
                                        <Tooltip.Trigger asChild>
                                            <button
                                                className={`toolbar-button ${isLocked ? 'active warning' : ''}`}
                                                onClick={() => setIsLocked(!isLocked)}
                                            >
                                                {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
                                            </button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                                {isLocked ? "Unlock Map" : "Lock Map"}
                                                <Tooltip.Arrow className="TooltipArrow" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>
                                </div>

                                <div className="toolbar-divider" />

                                <div className="toolbar-group">
                                    <Tooltip.Root>
                                        <Tooltip.Trigger asChild>
                                            <button className="toolbar-button" onClick={onToggleLayout}>
                                                <Settings2 size={20} />
                                            </button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                                Switch to Sidebar
                                                <Tooltip.Arrow className="TooltipArrow" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>

                                    <Tooltip.Root>
                                        <Tooltip.Trigger asChild>
                                            <button className="toolbar-button" onClick={toggleTheme}>
                                                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                                            </button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                                Theme Toggle
                                                <Tooltip.Arrow className="TooltipArrow" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>

                                    <Tooltip.Root>
                                        <Tooltip.Trigger asChild>
                                            <button className="toolbar-button success" onClick={handlePrintClick}>
                                                <Printer size={20} />
                                            </button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                                Download Map
                                                <Tooltip.Arrow className="TooltipArrow" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>

                                    <Tooltip.Root>
                                        <Tooltip.Trigger asChild>
                                            <button className="toolbar-button danger" onClick={handleClearDrawings}>
                                                <Trash2 size={20} />
                                            </button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                                Clear Map
                                                <Tooltip.Arrow className="TooltipArrow" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>
                                </div>
                            </nav>
                        </>
                    )}
                </div>
            </div >
        </header >
    );
};

export default MapHeader;
