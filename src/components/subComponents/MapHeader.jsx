import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Globe, ArrowLeft } from 'lucide-react';
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
                        color={item.isActive ? 'white' : item.color}
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
                {sections.map((section, si) => (
                    <React.Fragment key={section.title}>
                        <div className="hb-section">
                            <div className="hb-card-group">
                                {section.items.map(item => (
                                    <ToolBtn key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                        {si < sections.length - 1 && <div className="hb-divider-vertical" />}
                    </React.Fragment>
                ))}
            </nav>

            {/* ── Right Action Cluster ── */}
            <div className="hb-actions">
                <div className="hb-meta">
                    <div className="hb-meta-item">
                        <span className="hb-meta-dot" />
                        <span className="hb-meta-label">LIVE</span>
                    </div>
                </div>

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button className="hb-exit-btn" onClick={() => window.location.reload()}>
                            <ArrowLeft size={14} strokeWidth={2.5} />
                            <span>EXIT</span>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="TooltipContent" sideOffset={10}>
                            Return to Selection
                            <Tooltip.Arrow className="TooltipArrow" />
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>
            </div>
        </header>
    );
};

export default MapHeader;
