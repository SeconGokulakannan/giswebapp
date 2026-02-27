import React from 'react';
import { X, Map as MapIcon, Layers3 } from 'lucide-react';

const TopLegendPanel = ({ layers, onClose, getLegendUrl }) => {
    if (!layers || layers.length === 0) return null;

    return (
        <div className="top-legend-panel-container">
            <div className="top-legend-panel-glass">
                <div className="top-legend-header">
                    <div className="top-legend-title-wrap">
                        <div className="top-legend-title-icon">
                            <Layers3 size={12} />
                        </div>
                        <div className="top-legend-title-copy">
                            <h4>Legend</h4>
                            <span>{layers.length} layer{layers.length > 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </div>

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
                                        e.currentTarget.closest('.top-legend-item')?.classList.add('legend-missing');
                                    }}
                                />
                                <span className="no-legend-text">No legend</span>
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
