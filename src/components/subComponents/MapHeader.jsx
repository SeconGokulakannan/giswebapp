import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Globe } from 'lucide-react';
import { getNavSections } from '../../constants/MapControlConfig';

const ToolBtn = ({ item }) => (
    <Tooltip.Root>
        <Tooltip.Trigger asChild>
            <button
                className={`hb-tool-card ${item.isActive ? 'active' : ''} ${item.className || ''}`}
                onClick={item.action}
                aria-label={item.label}
                style={{ '--card-color': item.color }}
            >
                <div className="hb-tool-card-icon">
                    <item.icon
                        size={18}
                        strokeWidth={1.8}
                        color={item.isActive ? '#ffffff' : 'var(--hb-icon-muted)'}
                    />
                </div>
                <span className="hb-tool-card-label">{item.label}</span>
            </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
            <Tooltip.Content className="TooltipContent" sideOffset={8} side="bottom">
                {item.label}
                <Tooltip.Arrow className="TooltipArrow" />
            </Tooltip.Content>
        </Tooltip.Portal>
    </Tooltip.Root>
);

const MapHeader = (props) => {
    const { layoutMode } = props;
    const sections = getNavSections(props);

    if (layoutMode !== 'topbar') {
        return (
            <header className="hb-root minimal">
                <div className="hb-brand">
                    <div className="hb-logo small">
                        <Globe size={14} color="white" strokeWidth={2.5} />
                    </div>
                    <span className="hb-brand-name small">GIS Portal</span>
                </div>
            </header>
        );
    }

    return (
        <header className="hb-root">
            {/* ── Brand Section ── */}
            <div className="hb-brand">
                <div className="hb-logo-container">
                    <div className="hb-logo">
                        <Globe size={16} color="white" strokeWidth={2.5} />
                    </div>
                    <div className="hb-brand-info">
                        <span className="hb-brand-name">SECON GIS</span>
                        <span className="hb-brand-version">v2.0 PRO</span>
                    </div>
                </div>
            </div>

            {/* ── Navigation Sections ── */}
            <nav className="hb-nav-modular">
                <div className="hb-section">
                    <div className="hb-card-group">
                        {sections.flatMap(section => section.items).map(item => (
                            <ToolBtn key={item.id} item={item} />
                        ))}
                    </div>
                </div>
            </nav>
        </header>
    );
};

export default MapHeader;

