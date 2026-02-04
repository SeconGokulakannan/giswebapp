import { useState, useEffect, useRef } from 'react';
import { getLegendUrl, getLayerStyle, uploadIcon, getLayerAttributes } from '../../services/Server';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
    Eye, Settings2, List, Info, MapPinned, Zap, Square, Play,
    Palette, Repeat, Table, Plus, RefreshCw, DatabaseZap, Goal,
    LayersPlus, FileChartPie, Pencil, CircleDot, Save, Loader2, Upload,
    MousePointer2, BoxSelect, GripVertical,
    Brush
} from 'lucide-react';

const LayerOperations = ({
    isDrawingVisible, setIsDrawingVisible, geoServerLayers,
    handleToggleGeoLayer, handleLayerOpacityChange, handleZoomToLayer,
    handleToggleAllLayers, activeLayerTool, setActiveLayerTool,
    handleToggleLayerQuery, activeZoomLayerId, handleHighlightLayer,
    activeHighlightLayerId, isHighlightAnimating, handleUpdateLayerStyle,
    infoSelectionMode, setInfoSelectionMode, saveSequence
}) => {

    const tools = [
        { icon: Eye, label: 'Visibility', id: 'visibility' },
        { icon: Settings2, label: 'Layer Density', id: 'density' },
        { icon: List, label: ' Legend', id: 'legend' },
        { icon: Info, label: 'Feature Info', id: 'info' },
        { icon: MapPinned, label: 'Zoom To Layer', id: 'zoom' },
        { icon: Zap, label: 'Highlight Layer', id: 'highlight' },
        { icon: Palette, label: 'Layer Styles', id: 'styles' },
        { icon: Repeat, label: 'Reorder Layers', id: 'reorder' },
        { icon: DatabaseZap, label: 'Query Builder', id: 'querybuilder' },
        { icon: FileChartPie, label: 'Run Analysis', id: 'analysis' },
        { icon: Table, label: 'Attribute Table', id: 'attribute' },
        { icon: LayersPlus, label: 'Layer Management', id: 'layermanagement' }
    ];

    const [editingStyleLayer, setEditingStyleLayer] = useState(null);
    const [styleData, setStyleData] = useState(null); // { styleName, sldBody, properties, availableProps }
    const [isSavingStyle, setIsSavingStyle] = useState(false);
    const [activeStyleTab, setActiveStyleTab] = useState('symbology'); // symbology, labels
    const [layerAttributes, setLayerAttributes] = useState([]);
    const [draggedLayerId, setDraggedLayerId] = useState(null);
    const [isSavingSequences, setIsSavingSequences] = useState(false);
    const [localLayers, setLocalLayers] = useState([]);

    // Initialize localLayers from geoServerLayers
    useEffect(() => {
        if (geoServerLayers && geoServerLayers.length > 0) {
            setLocalLayers([...geoServerLayers]);
        }
    }, [geoServerLayers]);

    const handleSaveAllSequences = async () => {
        setIsSavingSequences(true);
        try {
            // Prepare Key-Value list: layerId, SequenceNumber
            // We use the pool of sequence numbers coming from the server
            // and assign them based on the new local order.
            const availableSequences = geoServerLayers
                .map(l => l.sequence)
                .sort((a, b) => a - b);

            const sequenceList = localLayers.map((layer, index) => ({
                layerId: layer.layerId,
                sequenceNumber: availableSequences[index] !== undefined ? availableSequences[index] : 999
            }));

            await saveSequence(sequenceList);
            alert('Sequences saved successfully!');
        } catch (error) {
            console.error("Failed to save sequences", error);
            alert('Failed to save sequences.');
        } finally {
            setIsSavingSequences(false);
        }
    };

    const handleDragStart = (e, layerId) => {
        setDraggedLayerId(layerId);
        e.dataTransfer.effectAllowed = 'move';
        // Add a class for styling
        e.currentTarget.classList.add('dragging');
    };

    const handleDragOver = (e, targetLayerId) => {
        e.preventDefault();
        if (draggedLayerId === targetLayerId) return;

        const draggedIdx = localLayers.findIndex(l => l.id === draggedLayerId);
        const targetIdx = localLayers.findIndex(l => l.id === targetLayerId);

        if (draggedIdx === -1 || targetIdx === -1) return;

        const updatedLayers = [...localLayers];
        const [removed] = updatedLayers.splice(draggedIdx, 1);
        updatedLayers.splice(targetIdx, 0, removed);
        setLocalLayers(updatedLayers);
    };

    const handleDragEnd = (e) => {
        setDraggedLayerId(null);
        e.currentTarget.classList.remove('dragging');
    };


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

    const HATCH_PATTERNS = {
        'None': '',
        'Horizontal': 'shape://horizline',
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
            externalGraphicUrl: '',
            hatchPattern: '', // e.g., 'shape://horizline', 'shape://vertline', 'shape://slash', 'shape://backslash', 'shape://dot', 'shape://plus', 'shape://times'
            fontSize: 12,
            fontColor: '#000000',
            fontFamily: 'Arial',
            fontWeight: 'normal',
            fontStyle: 'normal',
            haloRadius: 0,
            haloColor: '#ffffff'
        };
        const availableProps = {
            fill: false, fillOpacity: false, stroke: false, strokeWidth: false,
            strokeOpacity: false, strokeDasharray: false, strokeLinecap: false, strokeLinejoin: false,
            size: false, rotation: false, wellKnownName: false, externalGraphicUrl: false,
            hatchPattern: false, fontSize: false, fontColor: false, fontFamily: false,
            fontWeight: false, fontStyle: false, haloRadius: false, haloColor: false
        };

        const extract = (name, defaultValue) => {
            const regex = new RegExp(`<(?:[\\w-]*:)?(?:Css|Svg)Parameter[^>]*name="${name}"[^>]*>([^<]+)</(?:[\\w-]*:)?(?:Css|Svg)Parameter>`, 'i');
            const match = sldBody.match(regex);
            if (match) {
                const propKey = name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                availableProps[propKey] = true;
                return match[1].trim();
            }
            return defaultValue;
        };

        const extractTag = (tagName, defaultValue, parentContext = null) => {
            let regex;
            if (parentContext) {
                regex = new RegExp(`<${parentContext}[\\s\\S]*?<${tagName}>([^<]+)</${tagName}>`, 'i');
            } else {
                regex = new RegExp(`<${tagName}>([^<]+)</${tagName}>`, 'i');
            }
            const match = sldBody.match(regex);
            if (match) {
                availableProps[tagName.toLowerCase()] = true;
                return match[1].trim();
            }
            return defaultValue;
        };

        const extractExternalGraphic = () => {
            const regex = /<ExternalGraphic>[\s\S]*?<OnlineResource[\s\S]*?href="([^"]+)"[\s\S]*?\/>/i;
            const match = sldBody.match(regex);
            if (match) {
                availableProps.externalGraphicUrl = true;
                return match[1].trim();
            }
            return '';
        };

        const extractLabelProp = () => {
            const regex = /<(?:[\w-]*:)?Label>\s*<(?:[\w-]*:)?PropertyName>([\s\S]*?)<\/(?:[\w-]*:)?PropertyName>\s*<\/(?:[\w-]*:)?Label>/i;
            const match = sldBody.match(regex);
            if (match) {
                availableProps.labelAttribute = true;
                return match[1].trim();
            }
            return '';
        };

        const extractHatch = () => {
            const regex = /<Fill>[\s\S]*?<GraphicFill>[\s\S]*?<WellKnownName>([^<]+)<\/WellKnownName>/i;
            const match = sldBody.match(regex);
            if (match) {
                availableProps.hatchPattern = true;
                return match[1].trim();
            }
            return '';
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
        props.externalGraphicUrl = extractExternalGraphic();
        props.hatchPattern = extractHatch();

        props.fontSize = parseFloat(extract('font-size', props.fontSize));
        props.fontFamily = extract('font-family', props.fontFamily);
        props.fontWeight = extract('font-weight', props.fontWeight);
        props.fontStyle = extract('font-style', props.fontStyle);

        props.fontColor = extract('fill', props.fontColor); // Simplified
        props.haloRadius = parseFloat(extractTag('Radius', props.haloRadius));
        props.haloColor = extract('fill', props.haloColor); // Simplified
        props.labelAttribute = extractLabelProp();

        const hasPoint = sldBody.includes('PointSymbolizer');
        const hasLine = sldBody.includes('LineSymbolizer');
        const hasPolygon = sldBody.includes('PolygonSymbolizer');
        const hasText = sldBody.includes('TextSymbolizer');

        if (hasPolygon || (!hasPoint && !hasLine)) {
            availableProps.fill = true; availableProps.fillOpacity = true;
            availableProps.stroke = true; availableProps.strokeWidth = true;
            availableProps.strokeDasharray = true; availableProps.hatchPattern = true;
        }
        if (hasPoint) {
            availableProps.size = true; availableProps.wellknownname = true;
            availableProps.stroke = true; availableProps.fill = true;
            availableProps.externalGraphicUrl = true;
        }
        if (hasLine) {
            availableProps.stroke = true; availableProps.strokeWidth = true;
            availableProps.strokeDasharray = true; availableProps.strokeLinecap = true;
            availableProps.strokeLinejoin = true;
        }
        if (hasText) {
            availableProps.fontSize = true; availableProps.haloRadius = true;
            availableProps.fontColor = true; availableProps.fontFamily = true;
            availableProps.fontWeight = true; availableProps.fontStyle = true;
        }

        return { props, availableProps };
    };

    const applyStyleChanges = (sldBody, props) => {
        let newSld = sldBody;

        const ensureParent = (parentTag, containerTag) => {
            const tagRegex = new RegExp(`<${parentTag}[^>]*>`, 'i');
            if (!newSld.match(tagRegex)) {
                const containerRegex = new RegExp(`(<(?:[\\w-]*:)?${containerTag}[^>]*>)([\\s\\S]*?)(</(?:[\\w-]*:)?${containerTag}>)`, 'i');
                const match = newSld.match(containerRegex);
                if (match) {
                    const prefixMatch = match[1].match(/<([\w-]*:)/);
                    const prefix = prefixMatch ? prefixMatch[1] : '';
                    const newParent = `\n            <${prefix}${parentTag}></${prefix}${parentTag}>`;
                    newSld = newSld.replace(containerRegex, `$1$2${newParent}$3`);
                }
            }
        };

        const replace = (name, value, parentTagName) => {
            if (value === undefined || value === null) return;
            const regex = new RegExp(`(<(?:[\\w-]*:)?(?:Css|Svg)Parameter[^>]*name="${name}"[^>]*>)[^<]*(</(?:[\\w-]*:)?(?:Css|Svg)Parameter>)`, 'i');
            if (newSld.match(regex)) {
                newSld = newSld.replace(regex, `$1${value}$2`);
            } else if (parentTagName && value !== '') {
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

        // Handle SVG Icons
        if (props.externalGraphicUrl) {
            const pointSymbolizerRegex = /<PointSymbolizer>[\s\S]*?<Graphic>([\s\S]*?)<\/Graphic><\/PointSymbolizer>/i;
            const match = newSld.match(pointSymbolizerRegex);
            if (match) {
                const svgTag = `<ExternalGraphic><OnlineResource xlink:type="simple" xlink:href="${props.externalGraphicUrl}" /><Format>image/svg+xml</Format></ExternalGraphic>`;
                const cleanGraphic = match[1].replace(/<(?:Mark|ExternalGraphic)>[\s\S]*?<\/(?:Mark|ExternalGraphic)>/i, svgTag);
                newSld = newSld.replace(pointSymbolizerRegex, `<PointSymbolizer><Graphic>${cleanGraphic}</Graphic></PointSymbolizer>`);
            }
        } else if (props.wellKnownName) {
            const pointSymbolizerRegex = /<PointSymbolizer>[\s\S]*?<Graphic>([\s\S]*?)<\/Graphic><\/PointSymbolizer>/i;
            const match = newSld.match(pointSymbolizerRegex);
            if (match && match[1].includes('ExternalGraphic')) {
                const markTag = `<Mark><WellKnownName>${props.wellKnownName}</WellKnownName><Fill/><Stroke/></Mark>`;
                const cleanGraphic = match[1].replace(/<ExternalGraphic>[\s\S]*?<\/ExternalGraphic>/i, markTag);
                newSld = newSld.replace(pointSymbolizerRegex, `<PointSymbolizer><Graphic>${cleanGraphic}</Graphic></PointSymbolizer>`);
            }
        }

        // Handle Hatch Patterns
        const fillRegex = /<Fill>([\s\S]*?)<\/Fill>/i;
        const fillMatch = newSld.match(fillRegex);

        if (props.hatchPattern) {
            if (fillMatch) {
                const graphicFill = `<GraphicFill><Graphic><Mark><WellKnownName>${props.hatchPattern}</WellKnownName><Stroke><SvgParameter name="stroke">${props.stroke || '#000000'}</SvgParameter></Stroke></Mark></Graphic></GraphicFill>`;
                newSld = newSld.replace(fillRegex, `<Fill>${graphicFill}</Fill>`);
            }
        } else if (fillMatch && fillMatch[1].includes('GraphicFill')) {
            // Remove GraphicFill if pattern is cleared
            newSld = newSld.replace(fillRegex, `<Fill></Fill>`);
        }

        ensureParent('Fill', 'PolygonSymbolizer');
        ensureParent('Stroke', 'PolygonSymbolizer');
        ensureParent('Stroke', 'LineSymbolizer');
        ensureParent('Fill', 'Mark');
        ensureParent('Stroke', 'Mark');
        ensureParent('Halo', 'TextSymbolizer');
        ensureParent('Font', 'TextSymbolizer');
        ensureParent('Fill', 'TextSymbolizer');

        // Handle Label Attribute (TextSymbolizer Life cycle)
        if (props.labelAttribute) {
            const textSymRegex = /<(?:[\w-]*:)?TextSymbolizer>[\s\S]*?<\/(?:[\w-]*:)?TextSymbolizer>/i;
            if (!newSld.match(textSymRegex)) {
                // Create Basic TextSymbolizer
                const newSym = `\n            <TextSymbolizer>\n                <Label>\n                    <PropertyName>${props.labelAttribute}</PropertyName>\n                </Label>\n                <Font>\n                    <CssParameter name="font-family">Arial</CssParameter>\n                    <CssParameter name="font-size">12</CssParameter>\n                    <CssParameter name="font-style">normal</CssParameter>\n                    <CssParameter name="font-weight">normal</CssParameter>\n                </Font>\n                <LabelPlacement>\n                    <PointPlacement>\n                        <AnchorPoint>\n                            <AnchorPointX>0.5</AnchorPointX>\n                            <AnchorPointY>0.5</AnchorPointY>\n                        </AnchorPoint>\n                    </PointPlacement>\n                </LabelPlacement>\n                <Halo>\n                    <Radius>1</Radius>\n                    <Fill>\n                        <CssParameter name="fill">#FFFFFF</CssParameter>\n                    </Fill>\n                </Halo>\n                <Fill>\n                   <CssParameter name="fill">#000000</CssParameter>\n                </Fill>\n            </TextSymbolizer>`;
                const ruleClose = /<\/Rule>/i;
                if (newSld.match(ruleClose)) {
                    newSld = newSld.replace(ruleClose, `${newSym}</Rule>`);
                }
            } else {
                ensureParent('Label', 'TextSymbolizer');
                ensureParent('PropertyName', 'Label');
                replaceTag('PropertyName', props.labelAttribute, 'Label');
            }
        } else {
            // Remove TextSymbolizer if no label attribute, handling namespaces
            newSld = newSld.replace(/<(?:[\w-]*:)?TextSymbolizer>[\s\S]*?<\/(?:[\w-]*:)?TextSymbolizer>/i, '');
        }

        replace('fill', props.fill, 'Fill');
        replace('fill-opacity', props.fillOpacity, 'Fill');
        replace('stroke', props.stroke, 'Stroke');
        replace('stroke-width', props.strokeWidth, 'Stroke');
        replace('stroke-opacity', props.strokeOpacity, 'Stroke');
        replace('stroke-dasharray', props.strokeDasharray, 'Stroke');
        replace('stroke-linecap', props.strokeLinecap, 'Stroke');
        replace('stroke-linejoin', props.strokeLinejoin, 'Stroke');

        replaceTag('Size', props.size, 'Graphic');
        replaceTag('Rotation', props.rotation, 'Graphic');
        replaceTag('WellKnownName', props.wellKnownName, 'Mark');

        replace('font-size', props.fontSize, 'Font');
        replace('font-family', props.fontFamily, 'Font');
        replace('font-weight', props.fontWeight, 'Font');
        replace('font-style', props.fontStyle, 'Font');
        replaceTag('Radius', props.haloRadius, 'Halo');

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
            // Fetch attributes
            const attrs = await getLayerAttributes(layer.fullName);
            setLayerAttributes(attrs || []);

            const { props, availableProps } = parseSLD(data.sldBody);
            setStyleData({ ...data, properties: props, availableProps });
        }
    };

    const handleSaveStyle = async (overrideProps = null) => {
        const propsToUse = overrideProps || (styleData && styleData.properties);
        if (!styleData || !editingStyleLayer || !propsToUse) return;

        const layer = geoServerLayers.find(l => l.id === editingStyleLayer);
        if (!layer) return;

        setIsSavingStyle(true);
        const updatedSld = applyStyleChanges(styleData.sldBody, propsToUse);
        const success = await handleUpdateLayerStyle(editingStyleLayer, layer.fullName, updatedSld);

        if (success) {
            // Re-fetch the latest style from server to ensure synchronization
            const newData = await getLayerStyle(layer.fullName);
            if (newData) {
                const { props, availableProps } = parseSLD(newData.sldBody);
                setStyleData({ ...newData, properties: props, availableProps });
            }
        } else {
            alert('Failed to update style on server.');
        }
        setIsSavingStyle(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const layer = geoServerLayers.find(l => l.id === editingStyleLayer);
        if (!layer) return;

        const [workspace] = layer.fullName.split(':');
        setIsSavingStyle(true);
        const filename = await uploadIcon(file, workspace);
        setIsSavingStyle(false);

        if (filename) {
            updateStyleProp('externalGraphicUrl', filename, true);
        } else {
            alert('Failed to upload icon to server.');
        }
    };

    // Debounce for autoSave
    const saveTimeoutRef = useRef(null);

    const updateStyleProp = (key, value, autoSave = true) => {
        setStyleData(prev => {
            if (!prev) return prev;
            const nextProps = { ...prev.properties, [key]: value };

            if (autoSave) {
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = setTimeout(() => {
                    handleSaveStyle(nextProps);
                }, 800); // 800ms debounce
            }

            return {
                ...prev,
                properties: nextProps
            };
        });
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
                        <Goal size={18} />
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
                        <Brush size={18} />
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
                        {isCurrentAnimating ? <Square size={16} fill="currentColor" /> : <Play size={18} />}
                    </button>
                );
            }

            case 'reorder': {
                const availableSequences = [...geoServerLayers].map(l => l.sequence).sort((a, b) => a - b);
                const currentIndex = localLayers.findIndex(l => l.id === layer.id);
                const projectedSeq = availableSequences[currentIndex] !== undefined ? availableSequences[currentIndex] : (layer.sequence || '??');

                return (
                    <div className="sequence-indicator" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 600 }}>
                        <span style={{ fontSize: '12px' }}>#{projectedSeq}</span>
                        <GripVertical size={16} style={{ cursor: 'grab', opacity: 0.6 }} />
                    </div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <span>GeoServer Layers</span>
                        {activeLayerTool === 'info' && (
                            <div className="selection-mode-toggle" style={{
                                display: 'flex',
                                backgroundColor: 'rgba(var(--color-primary-rgb), 0.08)',
                                borderRadius: '6px',
                                padding: '2px',
                                marginLeft: '8px'
                            }}>
                                <button
                                    className={`mode-btn ${infoSelectionMode === 'click' ? 'active' : ''}`}
                                    onClick={() => setInfoSelectionMode('click')}
                                    title="Click Mode"
                                    style={{
                                        border: 'none',
                                        background: infoSelectionMode === 'click' ? 'var(--color-primary)' : 'transparent',
                                        color: infoSelectionMode === 'click' ? 'white' : 'inherit',
                                        borderRadius: '4px',
                                        padding: '4px 8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <MousePointer2 size={14} />
                                </button>
                                <button
                                    className={`mode-btn ${infoSelectionMode === 'drag' ? 'active' : ''}`}
                                    onClick={() => setInfoSelectionMode('drag')}
                                    title="Drag Mode"
                                    style={{
                                        border: 'none',
                                        background: infoSelectionMode === 'drag' ? 'var(--color-primary)' : 'transparent',
                                        color: infoSelectionMode === 'drag' ? 'white' : 'inherit',
                                        borderRadius: '4px',
                                        padding: '4px 8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <BoxSelect size={14} />
                                </button>
                            </div>
                        )}

                        {activeLayerTool === 'reorder' && (
                            <button
                                className="save-sequence-btn"
                                onClick={handleSaveAllSequences}
                                disabled={isSavingSequences}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 10px',
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: isSavingSequences ? 'wait' : 'pointer',
                                    marginLeft: 'auto',
                                    transition: 'all 0.2s',
                                    opacity: isSavingSequences ? 0.7 : 1
                                }}
                            >
                                {isSavingSequences ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
                                Save Sequence
                            </button>
                        )}
                    </div>
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
                        const sourceLayers = activeLayerTool === 'reorder' ? localLayers : geoServerLayers;

                        const displayedLayers = (activeLayerTool === 'density' || activeLayerTool === 'legend' || activeLayerTool === 'info' || activeLayerTool === 'zoom' || activeLayerTool === 'highlight' || activeLayerTool === 'styles')
                            ? sourceLayers.filter(l => l.visible)
                            : sourceLayers;

                        if (displayedLayers.length === 0) {
                            return (
                                <div className="empty-layers-msg">
                                    {(activeLayerTool === 'density' || activeLayerTool === 'legend' || activeLayerTool === 'styles')
                                        ? "No visible layers."
                                        : "No server layers connected."}
                                </div>
                            );
                        }

                        return displayedLayers.map((layer, index) => (
                            <div
                                key={layer.id}
                                draggable={activeLayerTool === 'reorder'}
                                onDragStart={(e) => handleDragStart(e, layer.id)}
                                onDragOver={(e) => handleDragOver(e, layer.id)}
                                onDragEnd={handleDragEnd}
                                className={activeLayerTool === 'reorder' ? 'draggable-layer-item' : ''}
                            >
                                <div
                                    className={`layer-item-redesigned 
                                        ${activeLayerTool === 'zoom' && activeZoomLayerId === layer.id ? 'active' : ''} 
                                        ${activeLayerTool === 'highlight' && activeHighlightLayerId === layer.id ? 'active' : ''}
                                        ${activeLayerTool === 'styles' && editingStyleLayer === layer.id ? 'active' : ''}
                                        ${draggedLayerId === layer.id ? 'dragging-active' : ''}
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

                                {/* Style Editor Panel - Toggleable Card */}
                                {activeLayerTool === 'styles' && editingStyleLayer === layer.id && styleData && (
                                    <div className="style-editor-panel">
                                        <div className="style-editor-header">
                                            <span className="style-editor-title">Style Editor</span>
                                            <div className="style-editor-actions">
                                                <button
                                                    className="style-save-btn"
                                                    onClick={(e) => { e.stopPropagation(); handleSaveStyle(); }}
                                                    disabled={isSavingStyle}
                                                >
                                                    {isSavingStyle ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                    {isSavingStyle ? 'Saving...' : 'Save'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="style-editor-body">
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
                                                            <span className="ref-label">Style Preview</span>
                                                            <div className="ref-preview-swatches">
                                                                {[1, 2, 3].map(i => (
                                                                    <div key={i} className="ref-preview-dot" style={{ backgroundColor: styleData.properties.fill }} />
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* PRESET GRID */}
                                                        <div className="ref-row">
                                                            <span className="ref-label">Quick Presets</span>
                                                            <div className="ref-preset-container">
                                                                <div className="ref-preset-grid">
                                                                    {PRESET_COLORS.map(color => (
                                                                        <div
                                                                            key={color}
                                                                            className="ref-preset-item"
                                                                            style={{ backgroundColor: color }}
                                                                            onClick={async () => {
                                                                                const updatedProps = { ...styleData.properties, fill: color, stroke: color };
                                                                                const updatedSld = applyStyleChanges(styleData.sldBody, updatedProps);
                                                                                const layer = geoServerLayers.find(l => l.id === editingStyleLayer);
                                                                                if (layer) {
                                                                                    setIsSavingStyle(true);
                                                                                    const success = await handleUpdateLayerStyle(editingStyleLayer, layer.fullName, updatedSld);
                                                                                    if (success) {
                                                                                        setStyleData({ ...styleData, properties: updatedProps, sldBody: updatedSld });
                                                                                    }
                                                                                    setIsSavingStyle(false);
                                                                                }
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* MARKER SELECTOR (POINT ONLY) */}
                                                        {styleData.availableProps.wellknownname && (
                                                            <div className="ref-row">
                                                                <span className="ref-label">Marker Shape</span>
                                                                <div className="ref-select-wrapper">
                                                                    <select
                                                                        value={styleData.properties.wellKnownName}
                                                                        onChange={(e) => updateStyleProp('wellKnownName', e.target.value)}
                                                                    >
                                                                        {MARKER_SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* SVG ICON (POINT ONLY) */}
                                                        {styleData.availableProps.externalGraphicUrl && (
                                                            <div className="ref-row">
                                                                <span className="ref-label">Dynamic Symbology</span>
                                                                <div className="ref-input-group" style={{ flexDirection: 'column', gap: '8px' }}>
                                                                    <div className="ref-flex-row">
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Icon URL or filename"
                                                                            className="ref-text-input"
                                                                            value={styleData.properties.externalGraphicUrl}
                                                                            onChange={(e) => updateStyleProp('externalGraphicUrl', e.target.value)}
                                                                        />
                                                                        <label className="style-save-btn" style={{ cursor: 'pointer', whiteSpace: 'nowrap', marginTop: 0 }}>
                                                                            <Upload size={14} /> Upload
                                                                            <input
                                                                                type="file"
                                                                                accept=".svg,.png,.jpg,.jpeg,.gif"
                                                                                style={{ display: 'none' }}
                                                                                onChange={handleFileUpload}
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                                                        Supports SVG, PNG based on server capability.
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* HATCH PATTERN (POLYGON ONLY) */}
                                                        {styleData.availableProps.hatchPattern && (
                                                            <div className="ref-row">
                                                                <span className="ref-label">Fill Pattern</span>
                                                                <div className="ref-select-wrapper">
                                                                    <select
                                                                        value={styleData.properties.hatchPattern}
                                                                        onChange={(e) => updateStyleProp('hatchPattern', e.target.value, true)}
                                                                    >
                                                                        {Object.entries(HATCH_PATTERNS).map(([name, val]) => (
                                                                            <option key={name} value={val}>{name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="ref-color-grid">
                                                            {/* FILL COLOR FIELD */}
                                                            {styleData.availableProps.fill && (
                                                                <div className="ref-row">
                                                                    <span className="ref-label">Fill Color</span>
                                                                    <div className="ref-active-color-bar" style={{ backgroundColor: styleData.properties.fill }}>
                                                                        <input
                                                                            type="color"
                                                                            value={styleData.properties.fill || '#cccccc'}
                                                                            onChange={(e) => updateStyleProp('fill', e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* STROKE COLOR FIELD */}
                                                            {styleData.availableProps.stroke && (
                                                                <div className="ref-row">
                                                                    <span className="ref-label">Stroke Color</span>
                                                                    <div className="ref-active-color-bar" style={{ backgroundColor: styleData.properties.stroke }}>
                                                                        <input
                                                                            type="color"
                                                                            value={styleData.properties.stroke || '#333333'}
                                                                            onChange={(e) => updateStyleProp('stroke', e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* STYLE FIELD */}
                                                            <div className="ref-row">
                                                                <span className="ref-label">Line Style</span>
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
                                                        </div>

                                                        {/* LINE JOINS (LINE/POLYGON) */}
                                                        {(styleData.availableProps.strokeLinecap || styleData.availableProps.strokeLinejoin) && (
                                                            <div className="ref-row">
                                                                <span className="ref-label">Line Join & Cap</span>
                                                                <div className="ref-flex-row">
                                                                    <select
                                                                        className="ref-mini-select"
                                                                        value={styleData.properties.strokeLinejoin}
                                                                        onChange={(e) => updateStyleProp('strokeLinejoin', e.target.value)}
                                                                    >
                                                                        <option value="miter">Miter (Join)</option>
                                                                        <option value="round">Round (Join)</option>
                                                                        <option value="bevel">Bevel (Join)</option>
                                                                    </select>
                                                                    <select
                                                                        className="ref-mini-select"
                                                                        value={styleData.properties.strokeLinecap}
                                                                        onChange={(e) => updateStyleProp('strokeLinecap', e.target.value)}
                                                                    >
                                                                        <option value="butt">Butt (Cap)</option>
                                                                        <option value="round">Round (Cap)</option>
                                                                        <option value="square">Square (Cap)</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* TRANSPARENCY FIELD */}
                                                        <div className="ref-row">
                                                            <span className="ref-label">Fill Opacity ({Math.round((styleData.properties.fillOpacity || 1) * 100)}%)</span>
                                                            <div className="ref-input-group">
                                                                <input
                                                                    type="range" min="0" max="1" step="0.1"
                                                                    className="layer-opacity-slider"
                                                                    value={styleData.properties.fillOpacity || 1}
                                                                    onChange={(e) => updateStyleProp('fillOpacity', parseFloat(e.target.value))}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* STROKE WIDTH FIELD */}
                                                        {styleData.availableProps.strokeWidth && (
                                                            <div className="ref-row">
                                                                <span className="ref-label">Stroke Width ({styleData.properties.strokeWidth || 1}px)</span>
                                                                <div className="ref-input-group">
                                                                    <input
                                                                        type="range" min="0.5" max="20" step="0.5"
                                                                        className="layer-opacity-slider"
                                                                        value={styleData.properties.strokeWidth || 1}
                                                                        onChange={(e) => updateStyleProp('strokeWidth', parseFloat(e.target.value))}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* MARKER SIZE FIELD (POINT ONLY) */}
                                                        {styleData.availableProps.size && (
                                                            <div className="ref-row">
                                                                <span className="ref-label">Marker Size ({styleData.properties.size || 10}px)</span>
                                                                <div className="ref-input-group">
                                                                    <input
                                                                        type="range" min="4" max="100" step="1"
                                                                        className="layer-opacity-slider"
                                                                        value={styleData.properties.size || 10}
                                                                        onChange={(e) => updateStyleProp('size', parseFloat(e.target.value))}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="tab-pane ref-layout">
                                                        <div className="symbology-header">
                                                            <Info size={13} /> Labeling Settings
                                                        </div>

                                                        {/* LABEL ATTRIBUTE */}
                                                        <div className="ref-row">
                                                            <span className="ref-label">Label Field</span>
                                                            <div className="ref-select-wrapper">
                                                                <select
                                                                    value={styleData.properties.labelAttribute || ''}
                                                                    onChange={(e) => updateStyleProp('labelAttribute', e.target.value)}
                                                                >
                                                                    <option value="">None (No Label)</option>
                                                                    {layerAttributes.map(attr => (
                                                                        <option key={attr} value={attr}>{attr}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {(styleData.properties.labelAttribute) && (
                                                            <div className="ref-layout">
                                                                {/* FONT FAMILY */}
                                                                <div className="ref-row">
                                                                    <span className="ref-label">Font Family</span>
                                                                    <div className="ref-select-wrapper">
                                                                        <select
                                                                            value={styleData.properties.fontFamily || 'Arial'}
                                                                            onChange={(e) => updateStyleProp('fontFamily', e.target.value)}
                                                                        >
                                                                            {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                {/* FONT SIZE */}
                                                                <div className="ref-row">
                                                                    <span className="ref-label">Font Size ({styleData.properties.fontSize || 12}pt)</span>
                                                                    <div className="ref-input-group">
                                                                        <input
                                                                            type="range" min="6" max="72" step="1"
                                                                            className="layer-opacity-slider"
                                                                            value={styleData.properties.fontSize || 12}
                                                                            onChange={(e) => updateStyleProp('fontSize', parseFloat(e.target.value))}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* FONT WEIGHT/STYLE */}
                                                                <div className="ref-row">
                                                                    <span className="ref-label">Text Style</span>
                                                                    <div className="ref-flex-row">
                                                                        <select
                                                                            className="ref-mini-select"
                                                                            value={styleData.properties.fontWeight || 'normal'}
                                                                            onChange={(e) => updateStyleProp('fontWeight', e.target.value)}
                                                                        >
                                                                            <option value="normal">Normal</option>
                                                                            <option value="bold">Bold</option>
                                                                        </select>
                                                                        <select
                                                                            className="ref-mini-select"
                                                                            value={styleData.properties.fontStyle || 'normal'}
                                                                            onChange={(e) => updateStyleProp('fontStyle', e.target.value)}
                                                                        >
                                                                            <option value="normal">Regular</option>
                                                                            <option value="italic">Italic</option>
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                {/* HALO RADIUS */}
                                                                <div className="ref-row">
                                                                    <span className="ref-label">Halo Intensity ({styleData.properties.haloRadius || 0}px)</span>
                                                                    <div className="ref-input-group">
                                                                        <input
                                                                            type="range" min="0" max="10" step="0.5"
                                                                            className="layer-opacity-slider"
                                                                            value={styleData.properties.haloRadius || 0}
                                                                            onChange={(e) => updateStyleProp('haloRadius', parseFloat(e.target.value))}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {!styleData.properties.labelAttribute && (
                                                            <div className="no-props-hint">
                                                                Select a field to enable labeling.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
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
