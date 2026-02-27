import React from 'react';
import { X } from 'lucide-react';

const TopLegendPanel = ({ layers, onClose, getLegendUrl }) => {
    if (!layers || layers.length === 0) return null;

    return (
        <aside className="tl2-container" aria-label="Legend Sidebar">
            <div className="tl2-shell">
                <div className="tl2-list">
                    {layers.map((layer) => {
                        const full = String(layer.fullName || layer.name || 'Layer');
                        const layerOnly = full.includes(':') ? full.split(':').slice(1).join(':') : full;
                        const displayName = String(layer.name || layerOnly || full);
                        return (
                            <article key={layer.id} className="tl2-item">
                            <div className="tl2-item-head">
                                <span className="tl2-item-title">{displayName}</span>
                            </div>
                            <div className="tl2-item-body">
                                <img
                                    src={getLegendUrl(layer.fullName)}
                                    alt={`${layer.name} legend`}
                                    onError={(e) => {
                                        e.currentTarget.closest('.tl2-item')?.classList.add('no-image');
                                    }}
                                />
                                <span className="tl2-empty">Legend not available</span>
                            </div>
                            </article>
                        );
                    })}
                </div>

                <button className="tl2-close" onClick={onClose} title="Close Legend">
                    <X size={16} />
                </button>
            </div>
        </aside>
    );
};

export default TopLegendPanel;
