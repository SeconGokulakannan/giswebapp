import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

const MapActionItems = ({ sections, variant = 'list' }) => {
    if (variant === 'icon-only') {
        // Flat list of items for Header toolbar
        const allItems = sections.flatMap(s => s.items);
        return (
            <div className="toolbar-group">
                {allItems.map((item) => (
                    <Tooltip.Root key={item.id}>
                        <Tooltip.Trigger asChild>
                            <button
                                className={`toolbar-button ${item.isActive ? 'active' : ''} ${item.className || ''}`}
                                onClick={item.action}
                            >
                                <item.icon size={20} />
                            </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className="TooltipContent" sideOffset={8}>
                                {item.label}
                                <Tooltip.Arrow className="TooltipArrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                ))}
            </div>
        );
    }

    // Default sidebar variant with sections and labels
    return (
        <div className="sidebar-nav-redesign">
            {sections.map((section) => (
                <div key={section.title} className="sidebar-section-group">
                    <div className="section-header-btn">
                        <span className="section-title">{section.title}</span>
                    </div>
                    <div className="section-items">
                        {section.items.map((item) => (
                            <button
                                key={item.id}
                                className={`sidebar-item-row ${item.isActive ? 'active' : ''} ${item.className || ''}`}
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
                </div>
            ))}
        </div>
    );
};

export default MapActionItems;
