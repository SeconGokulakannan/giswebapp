import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Brush, Info, Plus, Trash2, Filter, Minimize2, Upload } from 'lucide-react';

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
    onFileUpload,
    isParentPanelMinimized = false
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [localProperties, setLocalProperties] = useState({});
    const [conditions, setConditions] = useState([]); // [{attribute, operator, value, fillColor, strokeColor}]
    const isPointGeometry = String(editingLayer?.geometryType || '').toLowerCase().includes('point');
    const hasPointCustomSymbology = isPointGeometry && !!String(localProperties.externalGraphicUrl || '').trim();

    // Sync local properties when style data or layer changes.
    useEffect(() => {
        if (isOpen && styleData?.properties) {
            setLocalProperties({ ...styleData.properties });
            setConditions(styleData.properties?.conditions || []);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, styleData?.properties, editingLayer?.id]);

    if (!isOpen || !editingLayer || !styleData) return null;

    const addCondition = () => {
        setConditions(prev => [...prev, {
            attribute: layerAttributes[0] || '',
            operator: '=',
            value: '',
            fillColor: '#ef4444',
            strokeColor: ''
        }]);
    };

    const removeCondition = (idx) => {
        setConditions(prev => prev.filter((_, i) => i !== idx));
    };

    const updateCondition = (idx, field, value) => {
        setConditions(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const getDashName = (dashArray) => {
        if (!dashArray) return 'Solid';
        const str = dashArray.toString().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        if (str === '' || str === 'null') return 'Solid';

        // Normalize: "5.0, 5" -> ["5", "5"] -> "5 5"
        const normalize = (val) => {
            if (!val) return '';
            return val.toString().split(/[,\s]+/)
                .map(n => parseFloat(n).toString())
                .filter(n => n !== 'NaN')
                .join(' ');
        };

        const inputNorm = normalize(str);
        const entry = Object.entries(DASH_STYLES).find(([name, val]) => {
            if (!val) return false;
            return normalize(val) === inputNorm;
        });
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
        onSave({ ...localProperties, conditions });
    };

    return (
        <div className={`se-panel-wrapper ${isMinimized ? 'se-panel-minimized' : ''} ${isParentPanelMinimized ? 'se-parent-panel-minimized' : ''}`}>
            {/* Floating Expand Button (shown only when minimized) */}
            {isMinimized && (
                <button
                    onClick={() => setIsMinimized(false)}
                    className="card-expand-float-btn card-expand-float-btn-style"
                    title="Expand Style Editor"
                >
                    <Brush size={24} strokeWidth={2.5} />
                </button>
            )}

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
                            onClick={() => setIsMinimized(true)}
                            className="card-minimize-btn"
                            title="Minimize"
                        >
                            <Minimize2 size={16} strokeWidth={2.5} />
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

                            {isPointGeometry ? (
                                <>
                                    <div className="qb-condition-card-clean">
                                        <div className="qb-field-group">
                                            <label className="qb-field-label">Upload Symbology</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <label
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            padding: '8px 10px',
                                                            borderRadius: '8px',
                                                            border: '1px solid var(--color-border)',
                                                            background: 'var(--color-bg-secondary)',
                                                            cursor: 'pointer',
                                                            width: 'fit-content',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        <Upload size={14} />
                                                        Upload Symbology
                                                        <input
                                                            type="file"
                                                            accept=".png,.jpg,.jpeg,.gif,.svg,image/*"
                                                            style={{ display: 'none' }}
                                                            onChange={onFileUpload}
                                                        />
                                                    </label>

                                                    {localProperties.externalGraphicUrl && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleLocalPropUpdate('externalGraphicUrl', '')}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                padding: '8px 10px',
                                                                borderRadius: '8px',
                                                                border: '1px solid var(--color-danger)',
                                                                background: 'rgba(239, 68, 68, 0.08)',
                                                                color: 'var(--color-danger)',
                                                                cursor: 'pointer',
                                                                fontSize: '0.78rem',
                                                                fontWeight: 700
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                            Remove Symbology
                                                        </button>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', wordBreak: 'break-all' }}>
                                                    {localProperties.externalGraphicUrl
                                                        ? `Current: ${localProperties.externalGraphicUrl}`
                                                        : 'No uploaded icon selected.'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="qb-condition-card-clean">
                                        <div className="qb-field-row">
                                            {!hasPointCustomSymbology && styleData.availableProps.fill && (
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

                                            {styleData.availableProps.size && (
                                                <div className="qb-field-group" style={{ flex: 1 }}>
                                                    <label className="qb-field-label">Symbology Size</label>
                                                    <div className="density-control" style={{ width: '100%', justifyContent: 'space-between', paddingLeft: '4px' }}>
                                                        <input
                                                            type="range"
                                                            min="1"
                                                            max="64"
                                                            step="1"
                                                            value={localProperties.size || 10}
                                                            onChange={(e) => handleLocalPropUpdate('size', parseFloat(e.target.value))}
                                                            className="layer-opacity-slider"
                                                            style={{ flex: 1 }}
                                                        />
                                                        <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '42px', textAlign: 'right' }}>
                                                            {localProperties.size || 10}px
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
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
                                            <div className="density-control" style={{ width: '100%', justifyContent: 'space-between', paddingLeft: '4px' }}>
                                                <input
                                                    type="range" min="0" max="1" step="0.1"
                                                    value={localProperties.fillOpacity !== undefined ? localProperties.fillOpacity : 1}
                                                    onChange={(e) => handleLocalPropUpdate('fillOpacity', parseFloat(e.target.value))}
                                                    className="layer-opacity-slider"
                                                    style={{ flex: 1 }}
                                                />
                                                <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '32px', textAlign: 'right' }}>
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
                                                <div className="density-control" style={{ width: '100%', justifyContent: 'space-between', paddingLeft: '4px' }}>
                                                    <input
                                                        type="range" min="0.5" max="20" step="0.5"
                                                        value={localProperties.strokeWidth || 1}
                                                        onChange={(e) => handleLocalPropUpdate('strokeWidth', parseFloat(e.target.value))}
                                                        className="layer-opacity-slider"
                                                        style={{ flex: 1 }}
                                                    />
                                                    <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '32px', textAlign: 'right' }}>
                                                        {localProperties.strokeWidth || 1}px
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                                        {/* Font Properties Row 1 */}
                                        <div className="qb-field-row">
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Size</label>
                                                <input
                                                    type="number"
                                                    className="qb-input"
                                                    value={localProperties.fontSize || 12}
                                                    onChange={(e) => handleLocalPropUpdate('fontSize', parseFloat(e.target.value))}
                                                />
                                            </div>
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Weight</label>
                                                <select
                                                    className="qb-select"
                                                    value={localProperties.fontWeight || 'normal'}
                                                    onChange={(e) => handleLocalPropUpdate('fontWeight', e.target.value)}
                                                >
                                                    <option value="normal">Normal</option>
                                                    <option value="bold">Bold</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Font Properties Row 2 */}
                                        <div className="qb-field-row">
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Style</label>
                                                <select
                                                    className="qb-select"
                                                    value={localProperties.fontStyle || 'normal'}
                                                    onChange={(e) => handleLocalPropUpdate('fontStyle', e.target.value)}
                                                >
                                                    <option value="normal">Normal</option>
                                                    <option value="italic">Italic</option>
                                                </select>
                                            </div>
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Color</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                                </div>
                                            </div>
                                        </div>

                                        <div className="qb-field-row" style={{ alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', marginTop: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Info size={14} color="var(--color-primary)" />
                                                <label className="qb-field-label" style={{ margin: 0 }}>Static Label</label>
                                            </div>
                                            <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={localProperties.staticLabel !== false}
                                                    onChange={(e) => handleLocalPropUpdate('staticLabel', e.target.checked)}
                                                />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>

                                        {localProperties.staticLabel === false && (
                                            <div className="qb-field-group" style={{ marginTop: '4px', padding: '0 4px' }}>
                                                <label className="qb-field-label">Visibility Zoom (Level {localProperties.minZoom || 14}+)</label>
                                                <div className="density-control" style={{ width: '100%', justifyContent: 'space-between' }}>
                                                    <input
                                                        type="range" min="0" max="20" step="1"
                                                        value={localProperties.minZoom || 14}
                                                        onChange={(e) => handleLocalPropUpdate('minZoom', parseInt(e.target.value))}
                                                        className="layer-opacity-slider"
                                                        style={{ flex: 1 }}
                                                    />
                                                    <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '32px', textAlign: 'right' }}>
                                                        {localProperties.minZoom || 14}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* CONDITIONS SECTION */}
                        {!hasPointCustomSymbology && (
                            <div className="qb-conditions-list" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                            <div style={{ margin: '0 0 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Filter size={14} /> CONDITIONAL STYLING
                                </div>
                                <button
                                    onClick={addCondition}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700, border: '1px solid var(--color-primary)', borderRadius: '8px', background: 'rgba(var(--color-primary-rgb, 99,102,241),0.08)', color: 'var(--color-primary)', cursor: 'pointer' }}
                                >
                                    <Plus size={12} /> Add Rule
                                </button>
                            </div>

                            {conditions.length === 0 && (
                                <div style={{ padding: '16px', background: 'var(--color-bg-secondary)', borderRadius: '10px', border: '1px dashed var(--color-border)', textAlign: 'center', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                    No conditional rules. Click <strong>+ Add Rule</strong> to highlight specific features.
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {conditions.map((cond, idx) => (
                                    <div key={idx} className="qb-condition-card-clean" style={{ position: 'relative', paddingRight: '40px' }}>
                                        {/* Delete */}
                                        <button
                                            onClick={() => removeCondition(idx)}
                                            style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '2px' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>

                                        {/* Row 1: Attribute + Operator */}
                                        <div className="qb-field-row" style={{ marginBottom: '10px' }}>
                                            <div className="qb-field-group" style={{ flex: 1.5 }}>
                                                <label className="qb-field-label">Attribute</label>
                                                <select
                                                    className="qb-select"
                                                    value={cond.attribute}
                                                    onChange={e => updateCondition(idx, 'attribute', e.target.value)}
                                                >
                                                    {layerAttributes.map(attr => <option key={attr} value={attr}>{attr}</option>)}
                                                </select>
                                            </div>
                                            <div className="qb-field-group" style={{ flex: 0.9 }}>
                                                <label className="qb-field-label">Operator</label>
                                                <select
                                                    className="qb-select"
                                                    value={cond.operator}
                                                    onChange={e => updateCondition(idx, 'operator', e.target.value)}
                                                >
                                                    <option value="=">=</option>
                                                    <option value="!=">!=</option>
                                                    <option value=">">&gt;</option>
                                                    <option value=">=">&gt;=</option>
                                                    <option value="<">&lt;</option>
                                                    <option value="<=">&lt;=</option>
                                                    <option value="LIKE">LIKE</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Row 2: Value + Fill Color */}
                                        <div className="qb-field-row">
                                            <div className="qb-field-group" style={{ flex: 1 }}>
                                                <label className="qb-field-label">Match Value</label>
                                                <input
                                                    type="text"
                                                    className="qb-input"
                                                    placeholder="e.g. Maharashtra"
                                                    value={cond.value}
                                                    onChange={e => updateCondition(idx, 'value', e.target.value)}
                                                />
                                            </div>
                                            <div className="qb-field-group" style={{ flex: 0 }}>
                                                <label className="qb-field-label">Color</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: cond.fillColor, border: '2px solid var(--color-border)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                                                        <input
                                                            type="color"
                                                            value={cond.fillColor}
                                                            onChange={e => updateCondition(idx, 'fillColor', e.target.value)}
                                                            style={{ position: 'absolute', top: '-5px', left: '-5px', width: '50px', height: '50px', border: 'none', cursor: 'pointer', background: 'none' }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Preview badge */}
                                        {cond.attribute && cond.value && (
                                            <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: cond.fillColor, flexShrink: 0 }} />
                                                <strong style={{ margin: '0 3px' }}>{cond.attribute}</strong> {cond.operator} <strong style={{ margin: '0 3px' }}>{cond.value}</strong>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {conditions.length > 0 && (
                                <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: '8px', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                    ℹ️ Features not matching any rule will use the default symbology above.
                                </div>
                            )}
                            </div>
                        )}

                    </div>
                </div>

                {/* Save Footer */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        className="qb-apply-btn"
                        style={{ width: "auto", height: '36px', padding: '0 20px', background: 'linear-gradient(135deg, #22c55e, #10b981)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isSaving ? 'SAVING...' : 'SAVE STYLE'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StyleEditorCard;
