import React, { useState } from 'react';
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
    Navigation,
    ChevronDown,
    ChevronRight,
    LayoutGrid,
    Database,
    Globe
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
    // State for expanded sections
    const [expandedSections, setExpandedSections] = useState({
        'General': true,
        'Analysis': true,
        'Utilities': true,
        'Server': true
    });

    const toggleSection = (sectionTitle) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionTitle]: !prev[sectionTitle]
        }));
    };

    // Navigation Data Structure
    const navSections = [
        {
            title: 'General',
            items: [
                {
                    id: 'gis-home',
                    label: 'GIS Home',
                    icon: Navigation,
                    action: () => { }, // Placeholder or view reset
                    isActive: false,
                    color: '#3b82f6' // Blue
                },
                {
                    id: 'basemaps',
                    label: 'Base Map',
                    icon: MapIcon,
                    action: () => {
                        setActivePanel(activePanel === 'basemaps' ? null : 'basemaps');
                        setIsPanelMinimized(false);
                    },
                    isActive: activePanel === 'basemaps',
                    color: '#10b981' // Emerald
                }
            ]
        },
        {
            title: 'Server',
            items: [
                {
                    id: 'layermanagement',
                    label: 'Server',
                    icon: Database,
                    action: onOpenLayerManagement,
                    isActive: activePanel === 'layermanagement',
                    color: '#6366f1' // Indigo
                }
            ]
        },
        {
            title: 'Analysis',
            items: [
                {
                    id: 'layers',
                    label: 'Layers',
                    icon: Layers,
                    action: () => {
                        setActivePanel(activePanel === 'layers' ? null : 'layers');
                        setIsPanelMinimized(false);
                    },
                    isActive: activePanel === 'layers',
                    color: '#8b5cf6' // Violet
                },
                {
                    id: 'tools',
                    label: 'Drawing',
                    icon: PenTool,
                    action: () => {
                        setActivePanel(activePanel === 'tools' ? null : 'tools');
                        setIsPanelMinimized(false);
                    },
                    isActive: activePanel === 'tools',
                    color: '#f59e0b' // Amber
                },
                {
                    id: 'utility_tools',
                    label: 'Analysis Tools',
                    icon: DraftingCompass,
                    action: () => {
                        setActivePanel(activePanel === 'utility_tools' ? null : 'utility_tools');
                        setIsPanelMinimized(false);
                    },
                    isActive: activePanel === 'utility_tools',
                    color: '#ec4899' // Pink
                },
                {
                    id: 'location',
                    label: 'Location',
                    icon: MapPin,
                    action: () => {
                        setActivePanel(activePanel === 'location' ? null : 'location');
                        setIsPanelMinimized(false);
                    },
                    isActive: activePanel === 'location',
                    color: '#ef4444' // Red
                },
                {
                    id: 'bookmarks',
                    label: 'Bookmarks',
                    icon: Bookmark,
                    action: () => {
                        setActivePanel(activePanel === 'bookmarks' ? null : 'bookmarks');
                        setIsPanelMinimized(false);
                    },
                    isActive: activePanel === 'bookmarks',
                    color: '#14b8a6' // Teal
                }
            ]
        },

        {
            title: 'Utilities',
            items: [
                {
                    id: 'lock-map',
                    label: isLocked ? 'Unlock Map' : 'Lock Map',
                    icon: isLocked ? Lock : Unlock,
                    action: () => setIsLocked(!isLocked),
                    isActive: isLocked,
                    color: isLocked ? '#ef4444' : '#22c55e'
                },
                {
                    id: 'print-map',
                    label: 'Print Map',
                    icon: Printer,
                    action: handlePrintClick,
                    isActive: false,
                    color: '#64748b'
                },
                {
                    id: 'clear-map',
                    label: 'Clear All',
                    icon: Eraser,
                    action: handleClearDrawings,
                    isActive: false,
                    color: '#f43f5e'
                },
                {
                    id: 'settings',
                    label: 'Layout Nav',
                    icon: Settings2,
                    action: onToggleLayout,
                    isActive: false,
                    color: '#8b5cf6'
                },
                {
                    id: 'theme',
                    label: theme === 'light' ? 'Dark Mode' : 'Light Mode',
                    icon: theme === 'light' ? Moon : Sun,
                    action: toggleTheme,
                    isActive: false,
                    color: '#eab308'
                }
            ]
        }
    ];

    return (
        <div className="primary-sidebar-redesign">
            {/* Brand / Logo Area */}
            <div className="sidebar-header-redesign">
                <div className="brand-logo-small">
                    <Globe size={18} color="white" />
                </div>
                <span className="brand-name">GIS Portal</span>
            </div>

            <nav className="sidebar-nav-redesign">
                {navSections.map((section) => (
                    <div key={section.title} className="sidebar-section-group">
                        <button
                            className="section-header-btn"
                            onClick={() => toggleSection(section.title)}
                        >
                            <span className="section-title">{section.title}</span>
                            {expandedSections[section.title] ?
                                <ChevronDown size={14} className="section-arrow" /> :
                                <ChevronRight size={14} className="section-arrow" />
                            }
                        </button>

                        {expandedSections[section.title] && (
                            <div className="section-items">
                                {section.items.map((item) => (
                                    <button
                                        key={item.id}
                                        className={`sidebar-item-row ${item.isActive ? 'active' : ''}`}
                                        onClick={item.action}
                                        title={item.label}
                                        style={{ '--item-color': item.color }}
                                    >
                                        <div className="item-icon-box">
                                            <item.icon size={18} strokeWidth={1.8} />
                                        </div>
                                        <span className="item-label-text">{item.label}</span>
                                        {item.isActive && <div className="active-indicator" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer-redesign">
                <span className="footer-version">All rights reserved by SECON</span>
            </div>
        </div>
    );
};

export default PrimarySidebar;
