import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
    Map as MapIcon,
    Layers,
    PenTool,
    MapPin,
    Moon,
    Sun,
    Trash2,
    Printer,
    Bookmark,
    DraftingCompass,
    Cog,
    Menu,
    Settings2
} from 'lucide-react';

const PrimarySidebar = ({
    activePanel,
    setActivePanel,
    setIsPanelMinimized,
    toggleTheme,
    theme,
    handleClearDrawings,
    onOpenLayerManagement,
    onToggleLayout
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
            <div className="sidebar-header">
                <div className="brand-icon-wrapper">
                    <div className="brand-accent-glow" />
                    <Settings2 size={24} className="brand-icon" />
                </div>
            </div>

            <nav className="sidebar-nav">
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
                            className={`sidebar-nav-item ${activePanel === 'layermanagement' ? 'active' : ''}`}
                            onClick={onOpenLayerManagement}
                        >
                            <div className="active-pillar" />
                            <div className="item-icon-wrapper">
                                <Cog size={22} strokeWidth={1.5} />
                            </div>
                            <span className="item-label">Settings</span>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" side="right" sideOffset={16}>
                            Layer Management
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>
            </nav>

            <div className="sidebar-footer">
                <div className="footer-actions">
                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <button className="sidebar-footer-btn" onClick={onToggleLayout}>
                                <Menu size={20} />
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
                            <button className="sidebar-footer-btn" onClick={toggleTheme}>
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

                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <button className="sidebar-footer-btn danger" onClick={handleClearDrawings}>
                                <Trash2 size={20} />
                            </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className="TooltipContent" side="right" sideOffset={16}>
                                Clear Map
                                <Tooltip.Arrow className="TooltipArrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                </div>
            </div>
        </div>
    );
};

export default PrimarySidebar;
