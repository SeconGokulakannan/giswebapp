import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
    Map as MapIcon,
    Layers,
    PenTool,
    MapPin,
    Moon,
    Sun,
    Trash,
    Printer,
    Bookmark,
    DraftingCompass,
    Cog,
    Menu,
    Settings2,
    Eraser,
    Lock,
    Unlock,
    Navigation
} from 'lucide-react';

const PrimarySidebar = ({
    activePanel,
    setActivePanel,
    setIsPanelMinimized,
    toggleTheme,
    theme,
    handleClearDrawings,
    onOpenLayerManagement,
    onToggleLayout,
    isLocked,
    setIsLocked,
    handlePrintClick
}) => {

    // Grouped Navigation for a more professional hierarchy
    const navSections = [
        {
            title: 'Core',
            items: [
                { id: 'basemaps', label: 'Base Map', icon: MapIcon, color: '#347deb' },
                { id: 'layers', label: 'Layers', icon: Layers, color: '#10b981' },
            ]
        },
        {
            title: 'Analysis',
            items: [
                { id: 'tools', label: 'Drawing', icon: PenTool, color: '#f59e0b' },
                { id: 'utility_tools', label: 'Analysis', icon: DraftingCompass, color: '#8b5cf6' },
                { id: 'location', label: 'Location', icon: MapPin, color: '#ef4444' },
                { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark, color: '#ec4899' },
            ]
        }
    ];

    return (
        <div className="primary-sidebar">

            <nav className="sidebar-nav">

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button
                            className={`sidebar-nav-item`}>
                            <div className="active-pillar" />
                            <div className="item-icon-wrapper">
                                <Navigation size={22} />
                            </div>
                            <span className="item-label">GIS</span>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={16}>
                            GIS
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button
                            className={`sidebar-nav-item ${activePanel === 'layermanagement' ? 'active' : ''}`}
                            onClick={onOpenLayerManagement}
                        >
                            <div className="active-pillar" />
                            <div className="item-icon-wrapper">
                                <Cog size={22} />
                            </div>
                            <span className="item-label">Server</span>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={16}>
                            Layer Management
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                {navSections.map((section, sIdx) => (
                    <div key={section.title} className="nav-section">
                        {sIdx > 0 && <div className="section-divider" />}
                        <div className="nav-items-group">
                            {section.items.map((item) => (
                                <Tooltip.Root key={item.id}>
                                    <Tooltip.Trigger asChild>
                                        <button
                                            className={`sidebar-nav-item ${activePanel === item.id ? 'active' : ''}`}
                                            onClick={() => {
                                                setActivePanel(activePanel === item.id ? null : item.id);
                                                setIsPanelMinimized(false);
                                            }}
                                        >
                                            <div className="active-pillar" />
                                            <div className="item-icon-wrapper">
                                                <item.icon size={22} strokeWidth={1.5} />
                                            </div>
                                            <span className="item-label">{item.label}</span>
                                        </button>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal>
                                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={16}>
                                            <div className="tooltip-inner">
                                                <span className="tooltip-text">{item.label}</span>
                                            </div>
                                            <Tooltip.Arrow className="TooltipArrow" />
                                        </Tooltip.Content>
                                    </Tooltip.Portal>
                                </Tooltip.Root>
                            ))}
                        </div>
                    </div>
                ))}



                <div className="section-divider" />

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button
                            className={`sidebar-nav-item ${isLocked ? 'active' : ''}`}
                            onClick={() => setIsLocked(!isLocked)}
                        >
                            <div className="active-pillar" />
                            <div className="item-icon-wrapper">
                                {isLocked ? <Lock size={22} strokeWidth={1.5} /> : <Unlock size={22} strokeWidth={1.5} />}
                            </div>
                            <span className="item-label">{isLocked ? "Unlock" : "Lock"}</span>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={16}>
                            {isLocked ? "Unlock Map" : "Lock Map"}
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button className="sidebar-nav-item" onClick={handlePrintClick}>
                            <div className="active-pillar" />
                            <div className="item-icon-wrapper">
                                <Printer size={22} strokeWidth={1.5} />
                            </div>
                            <span className="item-label">Print</span>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={16}>
                            Export Map
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button className="sidebar-nav-item" onClick={handleClearDrawings}>
                            <div className="active-pillar" />
                            <div className="item-icon-wrapper">
                                <Eraser size={22} strokeWidth={1.5} />
                            </div>
                            <span className="item-label">Clear</span>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={16}>
                            Clear Map
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <div className="section-divider" />

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button className="sidebar-nav-item" onClick={onToggleLayout}>
                            <Settings2 size={20} />
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={16}>
                            Top Bar Mode
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button className="sidebar-nav-item" onClick={toggleTheme}>
                            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={16}>
                            {theme === 'light' ? 'Dark' : 'Light'} Mode
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>



            </nav>
        </div>
    );
};

export default PrimarySidebar;
