import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Brush, Info, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const DASH_STYLES = {
    'Solid': null,
    'Dash': '5 5',
    'Dot': '1 5',
    'Dash-Dot': '5 5 1 5'
};

const HATCH_PATTERNS = {
    'Solid': '',
    'Outline': 'outline',
    'Vertical': 'shape://vertline',
    'Diagonal': 'shape://slash',
    'Back Slash': 'shape://backslash',
    'Dots': 'shape://dot',
    'Plus': 'shape://plus',
    'Times': 'shape://times'
};

const MARKER_SHAPES = [
    'circle', 'square', 'triangle', 'star', 'cross', 'x'
];

const FONT_FAMILIES = [
    'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Serif', 'Sans-Serif'
];

const StyleEditorCard = ({
    isOpen,
    onClose,
    editingLayer,
    styleData,
    layerAttributes,
    isSaving,
    onSave,
    onUpdateProp,
    onFileUpload
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeTab, setActiveTab] = useState('symbology'); // symbology, labels
    const [localProperties, setLocalProperties] = useState({});

    // Sync local properties when style data or layer changes
    useEffect(() => {
        if (styleData?.properties) {
            setLocalProperties(styleData.properties);
        }
    }, [styleData?.properties, editingLayer?.id]);

    if (!isOpen || !editingLayer || !styleData) return null;

    const getDashName = (dashArray) => {
        if (!dashArray) return 'Solid';
        const entry = Object.entries(DASH_STYLES).find(([name, val]) => val === dashArray);
        return entry ? entry[0] : 'Solid';
    };

    const handleLocalPropUpdate = (key, value) => {
        setLocalProperties(prev => ({
            ...prev,
            [key]: value
        }));
        // Trigger live preview in GISMap
        if (onUpdateProp) {
            onUpdateProp(key, value);
        }
    };

    const handleSave = () => {
        onSave(localProperties);
    };

    return (
        <div className={`se-panel-wrapper ${isMinimized ? 'se-panel-minimized' : ''}`}>
            {/* Collapse Toggle Handle */}
            <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="se-collapse-handle"
                title={isMinimized ? 'Expand Style Editor' : 'Minimize Style Editor'}
            >
                {isMinimized ? <ChevronRight size={18} strokeWidth={2.5} /> : <ChevronLeft size={18} strokeWidth={2.5} />}
            </button>

            {/* Main Card */}
            <div className="se-card">
                {/* Header */}
                <div className="se-header">
                    <div className="se-header-left">
                        <div className="se-header-icon">
                            <Brush size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="se-title">Style Editor</h3>
                            <p className="se-subtitle">{editingLayer.name}</p>
                        </div>
                    </div>

                    <div className="se-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            className="qb-apply-btn"
                            style={{
                                height: '36px',
                                padding: '0 16px',
                                background: 'linear-gradient(135deg, #22c55e, #10b981)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '13px',
                                fontWeight: '700'
                            }}
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {isSaving ? 'SAVING...' : 'SAVE'}
                        </button>
                        <button onClick={onClose} className="se-close-btn" title="Close">
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="se-body" style={{ maxHeight: 'calc(90vh - 80px)', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* SYMBOLOGY SECTION */}
                        <div className="qb-conditions-list">
                            <div className="symbology-header" style={{ margin: '0 0 4px 4px', fontSize: '12px', fontWeight: '800', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Brush size={14} /> SYMBOLOGY
                            </div>

                            {/* Fill Pattern & Color */}
                            <div className="qb-condition-card-clean">
                                <div className="qb-field-row">
                                    {styleData.availableProps.hatchPattern && (
                                        <div className="qb-field-group" style={{ flex: 1 }}>
                                            <label className="qb-field-label">Fill Pattern</label>
                                            <select
                                                className="qb-select"
                                                value={localProperties.hatchPattern || ''}
                                                onChange={(e) => handleLocalPropUpdate('hatchPattern', e.target.value)}
                                            >
                                                {Object.entries(HATCH_PATTERNS).map(([name, val]) => (
                                                    <option key={name} value={val}>{name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {styleData.availableProps.fill && (
                                        <div className="qb-field-group" style={{ flex: 1 }}>
                                            <label className="qb-field-label">Fill Color</label>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: '8px',
                                                    background: localProperties.fill || '#cccccc', position: 'relative', overflow: 'hidden',
                                                    border: '2px solid var(--color-border)', flexShrink: 0
                                                }}>
                                                    <input
                                                        type="color"
                                                        value={localProperties.fill || '#cccccc'}
                                                        onChange={(e) => handleLocalPropUpdate('fill', e.target.value)}
                                                        style={{ position: 'absolute', top: '-5px', left: '-5px', width: '50px', height: '50px', border: 'none', cursor: 'pointer', background: 'none' }}
                                                    />
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>
                                                    {localProperties.fill?.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Fill Opacity */}
                                <div className="qb-field-group" style={{ marginTop: '4px' }}>
                                    <label className="qb-field-label">Fill Opacity</label>
                                    <div className="ref-input-group">
                                        <input
                                            type="range" min="0" max="1" step="0.1"
                                            value={localProperties.fillOpacity !== undefined ? localProperties.fillOpacity : 1}
                                            onChange={(e) => handleLocalPropUpdate('fillOpacity', parseFloat(e.target.value))}
                                        />
                                        <span className="ref-value-text">
                                            {Math.round((localProperties.fillOpacity !== undefined ? localProperties.fillOpacity : 1) * 100)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Stroke Pattern & Color */}
                            <div className="qb-condition-card-clean">
                                <div className="qb-field-row">
                                    <div className="qb-field-group" style={{ flex: 1 }}>
                                        <label className="qb-field-label">Stroke Pattern</label>
                                        <select
                                            className="qb-select"
                                            value={getDashName(localProperties.strokeDasharray)}
                                            onChange={(e) => handleLocalPropUpdate('strokeDasharray', DASH_STYLES[e.target.value])}
                                        >
                                            {Object.keys(DASH_STYLES).map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {styleData.availableProps.stroke && (
                                        <div className="qb-field-group" style={{ flex: 1 }}>
                                            <label className="qb-field-label">Stroke Color</label>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: '8px',
                                                    background: localProperties.stroke || '#333333', position: 'relative', overflow: 'hidden',
                                                    border: '2px solid var(--color-border)', flexShrink: 0
                                                }}>
                                                    <input
                                                        type="color"
                                                        value={localProperties.stroke || '#333333'}
                                                        onChange={(e) => handleLocalPropUpdate('stroke', e.target.value)}
                                                        style={{ position: 'absolute', top: '-5px', left: '-5px', width: '50px', height: '50px', border: 'none', cursor: 'pointer', background: 'none' }}
                                                    />
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>
                                                    {localProperties.stroke?.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Stroke Width */}
                                {styleData.availableProps.strokeWidth && (
                                    <div className="qb-field-group" style={{ marginTop: '4px' }}>
                                        <label className="qb-field-label">Stroke Width</label>
                                        <div className="ref-input-group">
                                            <input
                                                type="range" min="0.5" max="20" step="0.5"
                                                value={localProperties.strokeWidth || 1}
                                                onChange={(e) => handleLocalPropUpdate('strokeWidth', parseFloat(e.target.value))}
                                            />
                                            <span className="ref-value-text">
                                                {localProperties.strokeWidth || 1}px
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {styleData.availableProps.wellKnownName && (
                                <div className="qb-condition-card-clean">
                                    <div className="qb-field-group">
                                        <label className="qb-field-label">Marker Shape</label>
                                        <select
                                            className="qb-select"
                                            value={localProperties.wellKnownName || 'circle'}
                                            onChange={(e) => handleLocalPropUpdate('wellKnownName', e.target.value)}
                                        >
                                            {MARKER_SHAPES.map(shape => (
                                                <option key={shape} value={shape}>{shape.charAt(0).toUpperCase() + shape.slice(1)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="qb-field-row" style={{ marginTop: '12px' }}>
                                        <div className="qb-field-group" style={{ flex: 1 }}>
                                            <label className="qb-field-label">Marker Size</label>
                                            <div className="ref-input-group">
                                                <input
                                                    type="range" min="1" max="50" step="1"
                                                    value={localProperties.size || 10}
                                                    onChange={(e) => handleLocalPropUpdate('size', parseFloat(e.target.value))}
                                                />
                                                <span className="ref-value-text">{localProperties.size || 10}px</span>
                                            </div>
                                        </div>
                                        <div className="qb-field-group" style={{ flex: 1 }}>
                                            <label className="qb-field-label">Rotation</label>
                                            <div className="ref-input-group">
                                                <input
                                                    type="range" min="0" max="360" step="1"
                                                    value={localProperties.rotation || 0}
                                                    onChange={(e) => handleLocalPropUpdate('rotation', parseFloat(e.target.value))}
                                                />
                                                <span className="ref-value-text">{localProperties.rotation || 0}°</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Dynamic Symbology (SVG/Markers) */}
                            {styleData.availableProps.externalGraphicUrl && (
                                <div className="qb-condition-card-clean">
                                    <label className="qb-field-label">Dynamic Symbology</label>
                                    <div className="qb-field-row" style={{ marginTop: '8px' }}>
                                        <input
                                            type="text"
                                            placeholder="Icon URL or filename"
                                            className="qb-input"
                                            style={{ flex: 1 }}
                                            value={localProperties.externalGraphicUrl || ''}
                                            onChange={(e) => handleLocalPropUpdate('externalGraphicUrl', e.target.value)}
                                        />
                                        <label className="qb-apply-btn" style={{ width: 'auto', padding: '0 12px', cursor: 'pointer', height: '36px' }}>
                                            <Upload size={14} />
                                            <input
                                                type="file"
                                                accept=".svg,.png,.jpg,.jpeg,.gif"
                                                style={{ display: 'none' }}
                                                onChange={onFileUpload}
                                            />
                                        </label>
                                    </div>
                                    <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>
                                        Supports SVG, PNG based on server capability.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* LABELS SECTION */}
                        <div className="qb-conditions-list" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                            <div className="symbology-header" style={{ margin: '0 0 4px 4px', fontSize: '12px', fontWeight: '800', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Info size={14} /> LABELS
                            </div>

                            <div className="qb-condition-card-clean">
                                <div className="qb-field-group">
                                    <label className="qb-field-label">Label Field</label>
                                    <select
                                        className="qb-select"
                                        value={localProperties.labelAttribute || ''}
                                        onChange={(e) => handleLocalPropUpdate('labelAttribute', e.target.value)}
                                    >
                                        <option value="">None (No Label)</option>
                                        {layerAttributes.map(attr => (
                                            <option key={attr} value={attr}>{attr}</option>
                                        ))}
                                    </select>
                                </div>

                                {localProperties.labelAttribute && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                                        <div className="qb-field-row">
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Font Family</label>
                                                <select
                                                    className="qb-select"
                                                    value={localProperties.fontFamily || 'Arial'}
                                                    onChange={(e) => handleLocalPropUpdate('fontFamily', e.target.value)}
                                                >
                                                    {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                                                </select>
                                            </div>
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Font Size</label>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <input
                                                        type="number"
                                                        className="qb-input"
                                                        value={localProperties.fontSize || 12}
                                                        onChange={(e) => handleLocalPropUpdate('fontSize', parseFloat(e.target.value))}
                                                    />
                                                    <span style={{ fontSize: '11px', color: '#64748b' }}>pt</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="qb-field-row">
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Text Weight</label>
                                                <select
                                                    className="qb-select"
                                                    value={localProperties.fontWeight || 'normal'}
                                                    onChange={(e) => handleLocalPropUpdate('fontWeight', e.target.value)}
                                                >
                                                    <option value="normal">Normal</option>
                                                    <option value="bold">Bold</option>
                                                </select>
                                            </div>
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Text Style</label>
                                                <select
                                                    className="qb-select"
                                                    value={localProperties.fontStyle || 'normal'}
                                                    onChange={(e) => handleLocalPropUpdate('fontStyle', e.target.value)}
                                                >
                                                    <option value="normal">Regular</option>
                                                    <option value="italic">Italic</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="qb-field-row">
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Font Color</label>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '8px',
                                                        background: localProperties.fontColor || '#000000', position: 'relative', overflow: 'hidden',
                                                        border: '2px solid var(--color-border)', flexShrink: 0
                                                    }}>
                                                        <input
                                                            type="color"
                                                            value={localProperties.fontColor || '#000000'}
                                                            onChange={(e) => handleLocalPropUpdate('fontColor', e.target.value)}
                                                            style={{ position: 'absolute', top: '-5px', left: '-5px', width: '50px', height: '50px', border: 'none', cursor: 'pointer', background: 'none' }}
                                                        />
                                                    </div>
                                                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>
                                                        {localProperties.fontColor?.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Halo Color</label>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '8px',
                                                        background: localProperties.haloColor || '#FFFFFF', position: 'relative', overflow: 'hidden',
                                                        border: '2px solid var(--color-border)', flexShrink: 0
                                                    }}>
                                                        <input
                                                            type="color"
                                                            value={localProperties.haloColor || '#FFFFFF'}
                                                            onChange={(e) => handleLocalPropUpdate('haloColor', e.target.value)}
                                                            style={{ position: 'absolute', top: '-5px', left: '-5px', width: '50px', height: '50px', border: 'none', cursor: 'pointer', background: 'none' }}
                                                        />
                                                    </div>
                                                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>
                                                        {localProperties.haloColor?.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Halo Radius</label>
                                                <div className="ref-input-group">
                                                    <input
                                                        type="range" min="0" max="10" step="0.5"
                                                        value={localProperties.haloRadius || 1}
                                                        onChange={(e) => handleLocalPropUpdate('haloRadius', parseFloat(e.target.value))}
                                                    />
                                                    <span className="ref-value-text">{localProperties.haloRadius || 1}px</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="qb-field-row" style={{ alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Info size={14} color="var(--color-primary)" />
                                                <label className="qb-field-label" style={{ margin: 0 }}>Static Label</label>
                                            </div>
                                            <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={localProperties.staticLabel || false}
                                                    onChange={(e) => handleLocalPropUpdate('staticLabel', e.target.checked)}
                                                />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StyleEditorCard;
