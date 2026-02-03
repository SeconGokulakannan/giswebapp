import { useState } from 'react';
import { getLegendUrl, getLayerStyle } from '../../services/Server';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
    Eye, Settings2, List, Info, MapPinned, Zap, Square,
    Palette, Repeat, Table, Plus, RefreshCw, DatabaseZap,
    LayersPlus, FileChartPie, Pencil, CircleDot, Save, Loader2
} from 'lucide-react';

const LayerOperations = ({
    isDrawingVisible, setIsDrawingVisible, geoServerLayers,
    handleToggleGeoLayer, handleLayerOpacityChange, handleZoomToLayer,
    handleToggleAllLayers, activeLayerTool, setActiveLayerTool,
    handleToggleLayerQuery, activeZoomLayerId, handleHighlightLayer,
    activeHighlightLayerId, isHighlightAnimating, handleUpdateLayerStyle
}) => {

    const tools = [
        { icon: Eye, label: 'Visibility', id: 'visibility' },
        { icon: Settings2, label: 'Layer Density', id: 'density' },
        { icon: List, label: 'Layers Legend', id: 'legend' },
        { icon: Info, label: 'Feature Info', id: 'info' },
        { icon: MapPinned, label: 'Zoom To Layer', id: 'zoom' },
        { icon: Zap, label: 'Highlight Layer', id: 'highlight' },
        { icon: Palette, label: 'Layer Styles', id: 'styles' },
        { icon: Repeat, label: 'Reorder Layers', id: 'reorder' },
        { icon: RefreshCw, label: 'Reload Layer', id: 'reload' },
        { icon: DatabaseZap, label: 'Query Builder', id: 'querybuilder' },
        { icon: FileChartPie, label: 'Run Analysis', id: 'analysis' },
        { icon: Table, label: 'Attribute Table', id: 'attribute' },
        { icon: LayersPlus, label: 'Layer Management', id: 'layermanagement' }
    ];

    const [editingStyleLayer, setEditingStyleLayer] = useState(null);
    const [styleData, setStyleData] = useState(null); // { styleName, sldBody, properties, availableProps }
    const [isSavingStyle, setIsSavingStyle] = useState(false);
    const [activeStyleTab, setActiveStyleTab] = useState('symbology'); // symbology, labels

    const PRESET_COLORS = [
        '#3366cc', '#cc0000', '#669933', '#3399cc', '#cc6600', '#993399', '#3399ff', '#ff3333', '#99cc66',
        '#6699ff', '#ff6666', '#aaddff', '#ffaaaa', '#99ff99', '#ffff66', '#ffcc00', '#ff9933', '#663300'
    ];

    const DASH_STYLES = {
        'Solid': '',
        'Dash': '5 2',
        'Dot': '2 2',
        'Dash dot': '5 2 2 2',
        'Dash dot dot': '5 2 2 2 2 2'
    };

    const getDashName = (dashArray) => {
        if (!dashArray) return 'Solid';
        const entry = Object.entries(DASH_STYLES).find(([name, val]) => val === dashArray);
        return entry ? entry[0] : 'Solid';
    };

    const parseSLD = (sldBody) => {
        const props = {
            fill: '#cccccc',
            fillOpacity: 1,
            stroke: '#333333',
            strokeWidth: 1,
            strokeOpacity: 1,
            strokeDasharray: '',
            strokeLinecap: 'butt',
            strokeLinejoin: 'miter',
            size: 10,
            rotation: 0,
            wellKnownName: 'circle',
            fontSize: 12,
            fontColor: '#000000',
            haloRadius: 0,
            haloColor: '#ffffff'
        };
        const availableProps = {
            fill: false,
            fillOpacity: false,
            stroke: false,
            strokeWidth: false,
            strokeOpacity: false,
            strokeDasharray: false,
            strokeLinecap: false,
            strokeLinejoin: false,
            size: false,
            rotation: false,
            wellKnownName: false,
            fontSize: false,
            fontColor: false,
            haloRadius: false,
            haloColor: false
        };

        const check = (name) => {
            const regex = new RegExp(`<[^>]*:(?:Css|Svg)Parameter[^>]*name="${name}"[^>]*>`);
            const fallbackRegex = new RegExp(`<(?:Css|Svg)Parameter[^>]*name="${name}"[^>]*>`);
            return regex.test(sldBody) || fallbackRegex.test(sldBody);
        };

        const extract = (name, defaultValue) => {
            const regex = new RegExp(`<(?:[\\w-]*:)?(?:Css|Svg)Parameter[^>]*name="${name}"[^>]*>([^<]+)</(?:[\\w-]*:)?(?:Css|Svg)Parameter>`);
            const match = sldBody.match(regex);
            if (match) {
                availableProps[name.replace('-width', 'Width').replace('-opacity', 'Opacity')] = true;
                return match[1].trim();
            }
            return defaultValue;
        };

        const extractTag = (tagName, defaultValue) => {
            const regex = new RegExp(`<${tagName}>([^<]+)</${tagName}>`);
            const match = sldBody.match(regex);
            if (match) {
                availableProps[tagName.toLowerCase()] = true;
                return match[1].trim();
            }
            return defaultValue;
        };

        props.fill = extract('fill', props.fill);
        props.fillOpacity = parseFloat(extract('fill-opacity', props.fillOpacity));
        props.stroke = extract('stroke', props.stroke);
        props.strokeWidth = parseFloat(extract('stroke-width', props.strokeWidth));
        props.strokeOpacity = parseFloat(extract('stroke-opacity', props.strokeOpacity));
        props.strokeDasharray = extract('stroke-dasharray', props.strokeDasharray);
        props.strokeLinecap = extract('stroke-linecap', props.strokeLinecap);
        props.strokeLinejoin = extract('stroke-linejoin', props.strokeLinejoin);
        props.size = parseFloat(extractTag('Size', props.size));
        props.rotation = parseFloat(extractTag('Rotation', props.rotation));
        props.wellKnownName = extractTag('WellKnownName', props.wellKnownName);
        props.fontSize = parseFloat(extract('font-size', props.fontSize));
        props.fontColor = extract('fill', props.fontColor); // Simplified, ideally check context
        props.haloRadius = parseFloat(extractTag('Radius', props.haloRadius));
        props.haloColor = extract('fill', props.haloColor); // Simplified

        // Map dash-names back to state keys for availability check
        availableProps.fill = check('fill');
        availableProps.fillOpacity = check('fill-opacity');
        availableProps.stroke = check('stroke');
        availableProps.strokeWidth = check('stroke-width');
        availableProps.strokeOpacity = check('stroke-opacity');
        availableProps.strokeDasharray = check('stroke-dasharray');
        availableProps.strokeLinecap = check('stroke-linecap');
        availableProps.strokeLinejoin = check('stroke-linejoin');
        availableProps.fontSize = check('font-size');
        availableProps.haloRadius = availableProps.radius; // Sync with extractTag naming

        return { props, availableProps };
    };

    const applyStyleChanges = (sldBody, props) => {
        let newSld = sldBody;

        const replace = (name, value, parentTagName) => {
            if (value === undefined || value === null || value === '') return;

            const regex = new RegExp(`(<(?:[\\w-]*:)?(?:Css|Svg)Parameter[^>]*name="${name}"[^>]*>)[^<]+(</(?:[\\w-]*:)?(?:Css|Svg)Parameter>)`, 'i');
            if (newSld.match(regex)) {
                newSld = newSld.replace(regex, `$1${value}$2`);
            } else if (parentTagName) {
                // If not found, try to insert into parent
                const parentRegex = new RegExp(`(<(?:[\\w-]*:)?${parentTagName}[^>]*>)([\\s\\S]*?)(</(?:[\\w-]*:)?${parentTagName}>)`, 'i');
                const match = newSld.match(parentRegex);
                if (match) {
                    const tagType = newSld.includes('SvgParameter') ? 'SvgParameter' : 'CssParameter';
                    const prefixMatch = match[1].match(/<([\w-]*:)/);
                    const prefix = prefixMatch ? prefixMatch[1] : '';
                    const newParam = `\n            <${prefix}${tagType} name="${name}">${value}</${prefix}${tagType}>`;
                    newSld = newSld.replace(parentRegex, `$1$2${newParam}$3`);
                }
            }
        };

        const replaceTag = (tagName, value, parentTagName) => {
            if (value === undefined || value === null) return;
            const regex = new RegExp(`(<(?:[\\w-]*:)?${tagName}[^>]*>)[^<]*(</(?:[\\w-]*:)?${tagName}>)`, 'i');
            if (newSld.match(regex)) {
                newSld = newSld.replace(regex, `$1${value}$2`);
            } else if (parentTagName) {
                const parentRegex = new RegExp(`(<(?:[\\w-]*:)?${parentTagName}[^>]*>)([\\s\\S]*?)(</(?:[\\w-]*:)?${parentTagName}>)`, 'i');
                const match = newSld.match(parentRegex);
                if (match) {
                    const prefixMatch = match[1].match(/<([\w-]*:)/);
                    const prefix = prefixMatch ? prefixMatch[1] : '';
                    const newTag = `\n            <${prefix}${tagName}>${value}</${prefix}${tagName}>`;
                    newSld = newSld.replace(parentRegex, `$1$2${newTag}$3`);
                }
            }
        };

        replace('fill', props.fill, 'Fill');
        replace('fill-opacity', props.fillOpacity, 'Fill');
        replace('stroke', props.stroke, 'Stroke');
        replace('stroke-width', props.strokeWidth, 'Stroke');
        replace('stroke-opacity', props.strokeOpacity, 'Stroke');
        replace('stroke-dasharray', props.strokeDasharray, 'Stroke');
        replace('stroke-linecap', props.strokeLinecap, 'Stroke');
        replace('stroke-linejoin', props.strokeLinejoin, 'Stroke');

        replaceTag('Size', props.size, 'Mark');
        replaceTag('Rotation', props.rotation, 'Mark');
        replaceTag('WellKnownName', props.wellKnownName, 'Mark');

        replace('font-size', props.fontSize, 'Font');
        replaceTag('Radius', props.haloRadius, 'Halo');

        // Special handling for nested colors (Halo/Font)
        const replaceNestedFill = (parentTag, value) => {
            if (!value) return;
            const regex = new RegExp(`(<(?:[\\w-]*:)?${parentTag}>[\\s\\S]*?<[\\w-]*:?Fill>[\\s\\S]*?<[\\w-]*:?(?:Css|Svg)Parameter name="fill">)[^<]+(</[\\w-]*:?(?:Css|Svg)Parameter>)`, 'i');
            if (newSld.match(regex)) {
                newSld = newSld.replace(regex, `$1${value}$2`);
            }
        };

        replaceNestedFill('Halo', props.haloColor);
        replaceNestedFill('TextSymbolizer', props.fontColor);

        return newSld;
    };

    const handleLoadStyle = async (layer) => {
        if (editingStyleLayer === layer.id) {
            setEditingStyleLayer(null);
            setStyleData(null);
            return;
        }

        setEditingStyleLayer(layer.id);
        const data = await getLayerStyle(layer.fullName);
        if (data) {
            const { props, availableProps } = parseSLD(data.sldBody);
            setStyleData({ ...data, properties: props, availableProps });
        }
    };

    const handleSaveStyle = async () => {
        if (!styleData || !editingStyleLayer) return;

        const layer = geoServerLayers.find(l => l.id === editingStyleLayer);
        if (!layer) return;

        setIsSavingStyle(true);
        const updatedSld = applyStyleChanges(styleData.sldBody, styleData.properties);
        const success = await handleUpdateLayerStyle(editingStyleLayer, layer.fullName, updatedSld);

        if (success) {
            setStyleData({ ...styleData, sldBody: updatedSld });
        } else {
            alert('Failed to update style on server.');
        }
        setIsSavingStyle(false);
    };

    const updateStyleProp = (key, value) => {
        setStyleData(prev => ({
            ...prev,
            properties: { ...prev.properties, [key]: value }
        }));
    };

    const allLayersVisible = geoServerLayers.length > 0 && geoServerLayers.every(l => l.visible);

    const renderLayerContent = (layer) => {
        switch (activeLayerTool) {
            case 'visibility':
                return (
                    <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                        <input
                            type="checkbox"
                            checked={layer.visible}
                            onChange={() => handleToggleGeoLayer(layer.id)}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                );
            case 'info':
                return (
                    <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                        <input
                            type="checkbox"
                            checked={layer.queryable}
                            onChange={() => handleToggleLayerQuery(layer.id)}
                        />
                        <span className="toggle-slider" style={{ backgroundColor: layer.queryable ? 'var(--color-primary)' : '' }}></span>
                    </label>
                );
            case 'density':
                return (
                    <div className="density-control" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '10px', opacity: 0.7 }}>{Math.round((layer.opacity || 1) * 100)}%</span>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={layer.opacity !== undefined ? layer.opacity : 1}
                            onChange={(e) => handleLayerOpacityChange(layer.id, parseFloat(e.target.value))}
                            className="layer-opacity-slider"
                            title="Adjust Opacity"
                        />
                    </div>
                );
            case 'zoom':
                return (
                    <button
                        className="icon-toggle"
                        onClick={() => handleZoomToLayer(layer.id)}
                        title="Zoom to Layer"
                    >
                        <MapPinned size={18} />
                    </button>
                );
            case 'legend':
                return (
                    <div className="layer-legend-preview" style={{ marginLeft: 'auto' }}>
                        <img
                            src={getLegendUrl(layer.fullName)}
                            alt={`${layer.name} legend`}
                            style={{ maxHeight: '24px', maxWidth: '100px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                            onError={(e) => e.target.style.display = 'none'}
                        />
                    </div>
                );
            case 'styles':
                return (
                    <button
                        className={`icon-toggle ${editingStyleLayer === layer.id ? 'active' : ''}`}
                        onClick={() => handleLoadStyle(layer)}
                        title="Customize Styles"
                    >
                        <Palette size={18} />
                    </button>
                );
            case 'highlight': {
                const isCurrentAnimating = isHighlightAnimating && activeHighlightLayerId === layer.id;
                return (
                    <button
                        className={`icon-toggle ${isCurrentAnimating ? 'active animating' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleHighlightLayer(layer.id);
                        }}
                        title={isCurrentAnimating ? "Stop Animation" : "Highlight Layer"}
                    >
                        {isCurrentAnimating ? <Square size={16} fill="currentColor" /> : <Zap size={18} />}
                    </button>
                );
            }
            default:
                return null;
        }
    };

    return (
        <div className="layer-panel-container">
            <div className="layer-tools-sidebar">
                {tools.map((tool) => (
                    <Tooltip.Root key={tool.id}>
                        <Tooltip.Trigger asChild>
                            <button
                                className={`layer-tool-sidebar-btn ${activeLayerTool === tool.id ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveLayerTool(activeLayerTool === tool.id ? null : tool.id);
                                    if (activeLayerTool !== 'styles') {
                                        setEditingStyleLayer(null);
                                        setStyleData(null);
                                    }
                                }}
                            >
                                <tool.icon size={22} strokeWidth={1.5} />
                            </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className="TooltipContent" side="left" sideOffset={10}>
                                {tool.label}
                                <Tooltip.Arrow className="TooltipArrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                ))}
            </div>

            <div className="layer-list-content">
                {(activeLayerTool === 'visibility') && (
                    <>
                        <div className="layer-section-header">Operational Overlays</div>
                        <div>
                            <div className="layer-item-redesigned">
                                <div className="layer-info">
                                    <Pencil size={13} style={{ color: "var(--color-primary)" }} />
                                    <span>Workspace Drawings</span>
                                </div>
                                <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                                    <input
                                        type="checkbox"
                                        checked={isDrawingVisible}
                                        onChange={() => setIsDrawingVisible(!isDrawingVisible)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </>
                )}

                <div className="layer-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>GeoServer Layers</span>
                    {(activeLayerTool === 'visibility' || activeLayerTool === 'info') && geoServerLayers.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 500 }}>ALL</span>
                            <label className="toggle-switch" style={{ transform: 'scale(0.7)', marginRight: '-4px' }}>
                                <input
                                    type="checkbox"
                                    checked={allLayersVisible}
                                    onChange={(e) => handleToggleAllLayers(e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    )}
                </div>

                <div className="layer-list-group scrollable">
                    {(() => {
                        const displayedLayers = (activeLayerTool === 'density' || activeLayerTool === 'legend' || activeLayerTool === 'info' || activeLayerTool === 'zoom' || activeLayerTool === 'highlight' || activeLayerTool === 'styles')
                            ? geoServerLayers.filter(l => l.visible)
                            : geoServerLayers;

                        if (displayedLayers.length === 0) {
                            return (
                                <div className="empty-layers-msg">
                                    {(activeLayerTool === 'density' || activeLayerTool === 'legend' || activeLayerTool === 'styles')
                                        ? "No visible layers."
                                        : "No server layers connected."}
                                </div>
                            );
                        }

                        return displayedLayers.map(layer => (
                            <div key={layer.id}>
                                <div
                                    className={`layer-item-redesigned 
                                        ${activeLayerTool === 'zoom' && activeZoomLayerId === layer.id ? 'active' : ''} 
                                        ${activeLayerTool === 'highlight' && activeHighlightLayerId === layer.id ? 'active' : ''}
                                        ${activeLayerTool === 'styles' && editingStyleLayer === layer.id ? 'active' : ''}
                                    `}
                                    onClick={() => {
                                        if (activeLayerTool === 'zoom') {
                                            handleZoomToLayer(layer.id);
                                        } else if (activeLayerTool === 'highlight') {
                                            handleHighlightLayer(layer.id);
                                        } else if (activeLayerTool === 'styles') {
                                            handleLoadStyle(layer);
                                        }
                                    }}
                                    style={{
                                        cursor: (activeLayerTool === 'zoom' || activeLayerTool === 'highlight' || activeLayerTool === 'styles') ? 'pointer' : 'default',
                                        borderLeft: (
                                            (activeLayerTool === 'zoom' && activeZoomLayerId === layer.id) ||
                                            (activeLayerTool === 'highlight' && activeHighlightLayerId === layer.id) ||
                                            (activeLayerTool === 'styles' && editingStyleLayer === layer.id)
                                        ) ? '3px solid var(--color-primary)' : 'none',
                                        backgroundColor: (
                                            (activeLayerTool === 'zoom' && activeZoomLayerId === layer.id) ||
                                            (activeLayerTool === 'highlight' && activeHighlightLayerId === layer.id) ||
                                            (activeLayerTool === 'styles' && editingStyleLayer === layer.id)
                                        ) ? 'rgba(var(--color-primary-rgb), 0.12)' : 'transparent'
                                    }}
                                >
                                    <div className="layer-info" style={{
                                        flex: activeLayerTool === 'density' ? '0 0 auto' : '1',
                                        maxWidth: activeLayerTool === 'density' ? '120px' : 'none'
                                    }}>
                                        <CircleDot size={14} className="layer-icon" />
                                        <span style={{
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            fontSize: '13px',
                                            fontWeight: '500'
                                        }}>
                                            {layer.name}
                                        </span>
                                    </div>
                                    {renderLayerContent(layer)}
                                </div>

                                {/* Style Editor Panel */}
                                {activeLayerTool === 'styles' && editingStyleLayer === layer.id && styleData && (
                                    <div className="style-editor-panel" style={{
                                        padding: '12px',
                                        margin: '4px 8px 12px 34px',
                                        background: 'rgba(var(--color-primary-rgb), 0.03)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(var(--color-primary-rgb), 0.1)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', opacity: 0.6 }}>Custom Style Editor</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleSaveStyle(); }}
                                                disabled={isSavingStyle}
                                                style={{
                                                    fontSize: '11px',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    background: 'var(--color-primary)',
                                                    color: 'white',
                                                    border: 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {isSavingStyle ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                {isSavingStyle ? 'Saving...' : 'Update Style'}
                                            </button>
                                        </div>

                                        {/* Tabs Header */}
                                        <div className="style-tabs">
                                            <button
                                                className={`style-tab-btn ${activeStyleTab === 'symbology' ? 'active' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); setActiveStyleTab('symbology'); }}
                                            >
                                                <Palette size={14} /> Symbology
                                            </button>
                                            <button
                                                className={`style-tab-btn ${activeStyleTab === 'labels' ? 'active' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); setActiveStyleTab('labels'); }}
                                            >
                                                <List size={14} /> Labels
                                            </button>
                                        </div>

                                        <div className="style-tab-content modern-ref">
                                            {activeStyleTab === 'symbology' ? (
                                                <div className="tab-pane ref-layout">
                                                    {/* PREVIEW HEADER */}
                                                    <div className="ref-row preview-header">
                                                        <span className="ref-label">Preview:</span>
                                                        <div className="ref-preview-swatches">
                                                            {[1, 2, 3, 4, 5].map(i => (
                                                                <div key={i} className="ref-preview-dot" style={{ backgroundColor: styleData.properties.fill }} />
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* PRESET GRID */}
                                                    <div className="ref-preset-container">
                                                        <div className="ref-preset-grid">
                                                            {PRESET_COLORS.map(color => (
                                                                <div
                                                                    key={color}
                                                                    className="ref-preset-item"
                                                                    style={{ backgroundColor: color }}
                                                                    onClick={() => {
                                                                        updateStyleProp('fill', color);
                                                                        updateStyleProp('stroke', color);
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* COLOR FIELD */}
                                                    <div className="ref-row">
                                                        <span className="ref-label">Color:</span>
                                                        <div className="ref-active-color-bar" style={{ backgroundColor: styleData.properties.fill }}>
                                                            <input
                                                                type="color"
                                                                value={styleData.properties.fill}
                                                                onChange={(e) => {
                                                                    updateStyleProp('fill', e.target.value);
                                                                    updateStyleProp('stroke', e.target.value);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* STYLE FIELD */}
                                                    <div className="ref-row">
                                                        <span className="ref-label">Style:</span>
                                                        <div className="ref-select-wrapper">
                                                            <select
                                                                value={getDashName(styleData.properties.strokeDasharray)}
                                                                onChange={(e) => updateStyleProp('strokeDasharray', DASH_STYLES[e.target.value])}
                                                            >
                                                                {Object.keys(DASH_STYLES).map(name => (
                                                                    <option key={name} value={name}>{name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* TRANSPARENCY FIELD */}
                                                    <div className="ref-row">
                                                        <span className="ref-label">Transparency:</span>
                                                        <div className="ref-input-group">
                                                            <input
                                                                type="range" min="0" max="1" step="0.1"
                                                                value={styleData.properties.fillOpacity}
                                                                onChange={(e) => updateStyleProp('fillOpacity', parseFloat(e.target.value))}
                                                            />
                                                            <span className="ref-value-text">{Math.round(styleData.properties.fillOpacity * 100)}%</span>
                                                        </div>
                                                    </div>

                                                    {/* WIDTH FIELD */}
                                                    <div className="ref-row">
                                                        <span className="ref-label">Width:</span>
                                                        <div className="ref-input-group">
                                                            <input
                                                                type="range" min="0" max="10" step="0.5"
                                                                value={styleData.properties.strokeWidth}
                                                                onChange={(e) => updateStyleProp('strokeWidth', parseFloat(e.target.value))}
                                                            />
                                                            <span className="ref-value-text">{styleData.properties.strokeWidth}pt</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="tab-pane">
                                                    {/* LABELING SECTION KEEPING MINIMALIST BUT ALIGNED */}
                                                    <div className="symbology-header">
                                                        <Info size={13} /> Labeling Settings
                                                    </div>

                                                    {(styleData.availableProps.fontSize || styleData.availableProps.haloRadius) ? (
                                                        <div className="style-category minimalist">
                                                            <div className="style-grid">
                                                                {styleData.availableProps.fontSize && (
                                                                    <div className="style-field">
                                                                        <label>Font Size</label>
                                                                        <input type="range" min="6" max="72" step="1" value={styleData.properties.fontSize} onChange={(e) => updateStyleProp('fontSize', parseFloat(e.target.value))} />
                                                                    </div>
                                                                )}
                                                                {styleData.availableProps.haloRadius && (
                                                                    <div className="style-field">
                                                                        <label>Halo Radius</label>
                                                                        <input type="range" min="0" max="10" step="0.5" value={styleData.properties.haloRadius} onChange={(e) => updateStyleProp('haloRadius', parseFloat(e.target.value))} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="no-props-hint">No labeling data found.</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ));
                    })()}
                </div>
            </div>
        </div>
    );
};

export default LayerOperations;
