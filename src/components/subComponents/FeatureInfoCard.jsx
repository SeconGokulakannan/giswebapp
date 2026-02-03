import React, { useState } from 'react';
import { X, ChevronDown, ChevronRight, Layers } from 'lucide-react';

const FeatureInfoCard = ({ featureInfo, onClose, style }) => {
    const [expandedLayer, setExpandedLayer] = useState(null);

    if (!featureInfo || featureInfo.length === 0) return null;

    const toggleLayer = (layerName) => {
        setExpandedLayer(prev => prev === layerName ? null : layerName);
    };

    // Initialize default expansion state - always collapsed by default
    React.useEffect(() => {
        setExpandedLayer(null);
    }, [featureInfo]);


    return (
        <div className="feature-info-card fade-in" style={style}>
            <div style={{ borderRadius: 'inherit', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                <div className="feature-info-header">
                    <h4>
                        <Layers size={14} />
                        Feature Details
                    </h4>
                    <button onClick={onClose} className="close-btn">
                        <X size={16} />
                    </button>
                </div>

                <div className="feature-info-content">
                    {featureInfo.map((layerData, idx) => (
                        <div key={`${layerData.layerName}-${idx}`} className="layer-group">
                            <div
                                className="layer-group-header"
                                onClick={() => toggleLayer(layerData.layerName)}
                            >
                                <span style={{ color: 'var(--color-primary)' }}>{layerData.layerName}</span>
                                {expandedLayer === layerData.layerName ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>

                            {expandedLayer === layerData.layerName && (
                                <div className="layer-features">
                                    {(layerData.features && layerData.features.length > 0) ? (
                                        layerData.features.map((feature, fIdx) => (
                                            <div key={fIdx} className="feature-item">
                                                <table className="feature-table">
                                                    <tbody>
                                                        {Object.entries(feature.properties || {}).map(([key, value]) => (
                                                            <tr key={key}>
                                                                <td className="attr-key">{key}</td>
                                                                <td className="attr-value">{String(value)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="no-features">
                                            No features found.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FeatureInfoCard;
