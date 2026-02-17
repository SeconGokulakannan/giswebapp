import React from 'react';
import { X, Map as MapIcon } from 'lucide-react';

const TopLegendPanel = ({ layers, onClose, getLegendUrl }) => {
    if (!layers || layers.length === 0) return null;

    return (
        <div className="top-legend-panel-container">
            <div className="top-legend-panel-glass">
                <div className="top-legend-scroll-area">
                    {layers.map((layer) => (
                        <div key={layer.id} className="top-legend-item">
                            <div className="top-legend-layer-name">
                                <MapIcon size={12} className="legend-layer-icon" />
                                <span>{layer.name}</span>
                            </div>
                            <div className="top-legend-image-wrapper">
                                <img
                                    src={getLegendUrl(layer.fullName)}
                                    alt={`${layer.name} legend`}
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.parentElement.innerHTML = '<span class="no-legend-text">No Legend</span>';
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <button className="top-legend-close-btn" onClick={onClose} title="Close Legend Bar">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default TopLegendPanel;
