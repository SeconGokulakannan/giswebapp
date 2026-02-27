import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const TopLegendPanel = ({ layers, onClose, getLegendUrl, getLegendRuleUrl, fetchLegendRules }) => {
    const [layerRules, setLayerRules] = useState({});

    useEffect(() => {
        if (!layers || layers.length === 0) return;

        const loadRules = async () => {
            const rulesMap = {};
            await Promise.all(
                layers.map(async (layer) => {
                    const fullName = layer.fullName;
                    if (!layerRules[fullName]) {
                        try {
                            const rules = await fetchLegendRules(fullName);
                            rulesMap[fullName] = rules;
                        } catch {
                            rulesMap[fullName] = null;
                        }
                    }
                })
            );
            if (Object.keys(rulesMap).length > 0) {
                setLayerRules(prev => ({ ...prev, ...rulesMap }));
            }
        };

        loadRules();
    }, [layers]);

    if (!layers || layers.length === 0) return null;

    return (
        <aside className="tl2-panel" aria-label="Map Legend">
            <button className="tl2-dismiss" onClick={onClose} title="Close Legend">
                <X size={12} />
            </button>
            <div className="tl2-scroll">
                {layers.map((layer) => {
                    const full = String(layer.fullName || layer.name || 'Layer');
                    const layerOnly = full.includes(':') ? full.split(':').slice(1).join(':') : full;
                    const displayName = String(layer.name || layerOnly || full);
                    const rules = layerRules[layer.fullName];

                    return (
                        <div key={layer.id} className="tl2-group">
                            <div className="tl2-layer-name">{displayName}</div>
                            {rules && rules.length > 0 ? (
                                <div className="tl2-entries">
                                    {rules.map((rule, idx) => (
                                        <div key={idx} className="tl2-entry">
                                            <img
                                                className="tl2-swatch"
                                                src={getLegendRuleUrl(layer.fullName, rule.name)}
                                                alt=""
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                            <span className="tl2-label">{rule.title}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="tl2-entries">
                                    <img
                                        src={getLegendUrl(layer.fullName)}
                                        alt={`${displayName} legend`}
                                        className="tl2-fallback"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
};

export default TopLegendPanel;
