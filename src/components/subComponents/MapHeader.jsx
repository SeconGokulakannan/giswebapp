import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ArrowLeft } from 'lucide-react';
import MapActionItems from './MapActionItems';
import { getNavSections } from '../../constants/MapControlConfig';

const MapHeader = (props) => {
    const { layoutMode } = props;
    const sections = getNavSections(props);

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
                                <MapActionItems sections={sections} variant="icon-only" />
                            </nav>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default MapHeader;
