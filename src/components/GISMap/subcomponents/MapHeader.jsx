import * as Tooltip from '@radix-ui/react-tooltip';
import {
    Map as MapIcon,
    Layers,
    PenTool,
    Ruler,
    MapPin,
    Moon,
    Sun,
    Trash2,
    ArrowLeft,
    Search,
    Loader2,
    Lock,
    Unlock,
    Wrench,
} from 'lucide-react';
import { useState } from 'react';

const MapHeader = ({
    activePanel,
    setActivePanel,
    setIsPanelMinimized,
    toggleTheme,
    theme,
    handleClearDrawings,
    handleSearch,
    isLocked,
    setIsLocked,
    activeTool,
    handleToolClick,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

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
    return (
        <header className="header">
            <div className="header-content">
                {/* Left Side: Back Button */}
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

                {/* Center: Elite Search Bar */}
                <div className="search-container">
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
                </div>

                {/* Right Side: Title and Tools */}
                <div className="header-right-group">
                    <div className="logo">
                        <div className="logo-text">
                            <h1 className="logo-title">
                                <span className="logo-title-full">Geographic information system - Workspace</span>
                                <span className="logo-title-short">GIS-WorkSpace</span>
                            </h1>
                        </div>
                    </div>

                    <div className="vertical-divider" />

                    <nav className="toolbar">
                        <div className="toolbar-group">
                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <button
                                        className={`toolbar-button ${activePanel === 'basemaps' ? 'active' : ''}`}
                                        onClick={() => {
                                            setActivePanel(activePanel === 'basemaps' ? null : 'basemaps');
                                            setIsPanelMinimized(false);
                                        }}
                                        aria-label="Base Maps"
                                    >
                                        <MapIcon size={20} />
                                    </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                        Base Map Selection
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
                                        aria-label="GIS Layers"
                                    >
                                        <Layers size={20} />
                                    </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                        GIS Layers & Overlays
                                        <Tooltip.Arrow className="TooltipArrow" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>

                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <button
                                        className={`toolbar-button ${activePanel === 'tools' ? 'active' : ''}`}
                                        onClick={() => {
                                            setActivePanel(activePanel === 'tools' ? null : 'tools');
                                            setIsPanelMinimized(false);
                                        }}
                                        aria-label="Draw Tools"
                                    >
                                        <PenTool size={20} />
                                    </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                        Drawing & Digitizing Tools
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
                                        aria-label="Tools"
                                    >
                                        <Wrench size={20} />
                                    </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                        Tools
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
                                        aria-label="Go to Location"
                                    >
                                        <MapPin size={20} />
                                    </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                        Go to Coordinates
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
                                        aria-label={isLocked ? "Unlock Map" : "Lock Map"}
                                    >
                                        {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
                                    </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                        {isLocked ? "Unlock Map Navigation" : "Lock Map Navigation"}
                                        <Tooltip.Arrow className="TooltipArrow" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>
                        </div>

                        <div className="toolbar-divider" />

                        <div className="toolbar-group">
                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <button
                                        className="toolbar-button"
                                        onClick={toggleTheme}
                                        aria-label="Toggle Theme"
                                    >
                                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                                    </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                        {theme === 'light' ? 'Dark' : 'Light'} Mode
                                        <Tooltip.Arrow className="TooltipArrow" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>

                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <button
                                        className="toolbar-button danger"
                                        onClick={handleClearDrawings}
                                        aria-label="Clear Map"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                        Clear All Map Features
                                        <Tooltip.Arrow className="TooltipArrow" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>
                        </div>
                    </nav>
                </div>
            </div>
        </header>
    );
};

export default MapHeader;
