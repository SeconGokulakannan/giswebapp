import {
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
    Settings2,
    Navigation,
    List,
    Eraser,
    Database
} from 'lucide-react';

export const getNavSections = ({
    activePanel,
    isLayerManagementOpen,
    showTopLegend,
    isLocked,
    theme,
    onOpenLayerManagement,
    setActivePanel,
    setIsPanelMinimized,
    setShowTopLegend,
    setIsLocked,
    handlePrintClick,
    handleClearDrawings,
    onToggleLayout,
    toggleTheme
}) => [
        {
            title: 'General',
            items: [
                {
                    id: 'gis-home',
                    label: 'GIS Home',
                    icon: Navigation,
                    action: () => window.location.reload(),
                    isActive: false,
                    color: '#3b82f6'
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
                    color: '#10b981'
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
                    isActive: isLayerManagementOpen,
                    color: '#6366f1'
                },
                {
                    id: 'layers',
                    label: 'Layers',
                    icon: Layers,
                    action: () => {
                        setActivePanel(activePanel === 'layers' ? null : 'layers');
                        setIsPanelMinimized(false);
                    },
                    isActive: activePanel === 'layers',
                    color: '#8b5cf6'
                },
            ]
        },
        {
            title: 'Analysis',
            items: [
                {
                    id: 'tools',
                    label: 'Drawing',
                    icon: PenTool,
                    action: () => {
                        setActivePanel(activePanel === 'tools' ? null : 'tools');
                        setIsPanelMinimized(false);
                    },
                    isActive: activePanel === 'tools',
                    color: '#f59e0b'
                },
                {
                    id: 'utility_tools',
                    label: 'Measure Tools',
                    icon: DraftingCompass,
                    action: () => {
                        setActivePanel(activePanel === 'utility_tools' ? null : 'utility_tools');
                        setIsPanelMinimized(false);
                    },
                    isActive: activePanel === 'utility_tools',
                    color: '#ec4899'
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
                    color: '#ef4444'
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
                    color: '#14b8a6'
                },
                {
                    id: 'legend-bar',
                    label: 'Legend Bar',
                    icon: List,
                    action: () => setShowTopLegend(!showTopLegend),
                    isActive: showTopLegend,
                    color: '#d946ef'
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
                    color: isLocked ? '#ef4444' : '#22c55e',
                    className: isLocked ? 'active warning' : ''
                },
                {
                    id: 'print-map',
                    label: 'Print Map',
                    icon: Printer,
                    action: handlePrintClick,
                    isActive: activePanel === 'print',
                    color: '#64748b',
                    className: 'success'
                },
                {
                    id: 'clear-map',
                    label: 'Clear All',
                    icon: Eraser,
                    action: handleClearDrawings,
                    isActive: false,
                    color: '#f43f5e',
                    className: 'danger'
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
