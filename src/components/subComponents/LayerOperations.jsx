import { useState, useEffect, useRef } from 'react';
import { getLegendUrl, getLayerStyle, uploadIcon, getLayerAttributes } from '../../services/Server';
import toast from 'react-hot-toast';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
    Eye, Settings2, List, Info, MapPinned, Zap, Square, Play,
    Palette, Repeat, Table, Plus, RefreshCw, DatabaseZap, Goal, X,
    LayersPlus, FileChartPie, Pencil, CircleDot, Save, Loader2, Upload,
    MousePointer2, BoxSelect, GripVertical, MousePointerClick,
    Brush,
    LayoutGrid,
    MessageSquareCode
} from 'lucide-react';

const LayerOperations = ({
    isDrawingVisible, setIsDrawingVisible, geoServerLayers,
    handleToggleGeoLayer, handleLayerOpacityChange, handleZoomToLayer,
    handleToggleAllLayers, activeLayerTool, setActiveLayerTool,
    handleToggleLayerQuery, activeZoomLayerId, handleHighlightLayer,
    activeHighlightLayerId, isHighlightAnimating, handleUpdateLayerStyle,
    infoSelectionMode, setInfoSelectionMode, saveSequence, refreshLayers,
    selectedAttributeLayerId, setSelectedAttributeLayerId,
    showAttributeTable, setShowAttributeTable, GetLayerAttributes,
    handleApplyLayerFilter, setShowQueryBuilder, setQueryingLayer,
    queryingLayer, handleToggleSwipe, handleToggleSwipeAll, swipeLayerIds,
    swipePosition, setSwipePosition, analysisLayerIds, handleToggleAnalysisLayer,
    selectedQueryLayerIds, setSelectedQueryLayerIds
}) => {

    const tools = [
        { icon: Eye, label: 'Visibility', id: 'visibility' },
        { icon: Settings2, label: 'Layer Density', id: 'density' },
        { icon: List, label: ' Legend', id: 'legend' },
        { icon: MousePointerClick, label: 'Layer Action', id: 'action' },
        { icon: Info, label: 'Feature Info', id: 'info' },
        { icon: Palette, label: 'Layer Styles', id: 'styles' },
        { icon: Repeat, label: 'Reorder Layers', id: 'reorder' },
        { icon: GripVertical, label: 'Swipe Tool', id: 'swipe' },
        { icon: DatabaseZap, label: 'Query Builder', id: 'querybuilder' },
        { icon: LayoutGrid, label: 'Attribute Table', id: 'attribute' },
        { icon: FileChartPie, label: 'Run Analysis', id: 'analysis' },
    ];

    const [editingStyleLayer, setEditingStyleLayer] = useState(null);
    const [styleData, setStyleData] = useState(null); // { styleName, sldBody, properties, availableProps }
    const [isSavingStyle, setIsSavingStyle] = useState(false);
    const [activeStyleTab, setActiveStyleTab] = useState('symbology'); // symbology, labels
    const [layerAttributes, setLayerAttributes] = useState([]);
    const [draggedLayerId, setDraggedLayerId] = useState(null);
    const [isSavingSequences, setIsSavingSequences] = useState(false);
    const [localLayers, setLocalLayers] = useState([]);

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

            // Re-fetch sorted layers from server after a small delay to ensure persistence
            await new Promise(r => setTimeout(r, 500));

            if (refreshLayers) {
                await refreshLayers();
            }

            toast.success('Sequences saved successfully!');
        } catch (error) {
            console.error("Failed to save sequences", error);
            toast.error('Failed to save sequences.');
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


    const toggleSelectAllQuery = () => {
        if (selectedQueryLayerIds.length === geoServerLayers.length) {
            setSelectedQueryLayerIds([]);
        } else {
            setSelectedQueryLayerIds(geoServerLayers.map(l => l.id));
        }
    };

    const toggleLayerQuery = (layerId) => {
        setSelectedQueryLayerIds(prev => {
            if (prev.includes(layerId)) {
                return prev.filter(id => id !== layerId);
            } else {
                return [...prev, layerId];
            }
        });
    };

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
            haloRadius: 1, // Default to 1 if not present, but UI removed
            haloColor: '#ffffff',
            staticLabel: true,
            minZoom: 14, // Default min zoom
            preventDuplicates: true, // VendorOption group
            labelRepeat: 0 // VendorOption repeat
        };
        const availableProps = {
            fill: false, fillOpacity: false, stroke: false, strokeWidth: false,
            strokeOpacity: false, strokeDasharray: false, strokeLinecap: false, strokeLinejoin: false,
            size: false, rotation: false, wellKnownName: false, externalGraphicUrl: false,
            hatchPattern: false, fontSize: false, fontColor: false, fontFamily: false,
            fontWeight: false, fontStyle: false, haloRadius: false, haloColor: false
        };

        const extract = (name, defaultValue, parentContext = null) => {
            let searchTarget = sldBody;
            if (parentContext) {
                const contextRegex = new RegExp(`<${parentContext}[\\s\\S]*?>([\\s\\S]*?)</${parentContext}>`, 'i');
                const contextMatch = sldBody.match(contextRegex);
                if (contextMatch) {
                    searchTarget = contextMatch[1];
                } else {
                    return defaultValue;
                }
            }

            const regex = new RegExp(`<(?:[\\w-]*:)?(?:Css|Svg)Parameter[^>]*name="${name}"[^>]*>([^<]+)</(?:[\\w-]*:)?(?:Css|Svg)Parameter>`, 'i');
            const match = searchTarget.match(regex);
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

        props.fontSize = parseFloat(extract('font-size', props.fontSize, 'TextSymbolizer'));
        props.fontFamily = extract('font-family', props.fontFamily, 'TextSymbolizer');
        props.fontWeight = extract('font-weight', props.fontWeight, 'TextSymbolizer');
        props.fontStyle = extract('font-style', props.fontStyle, 'TextSymbolizer');

        props.fontColor = extract('fill', props.fontColor, 'TextSymbolizer'); // Now context-aware
        props.haloRadius = parseFloat(extractTag('Radius', props.haloRadius));
        props.haloColor = extract('fill', props.haloColor, 'Halo'); // Specific to Halo
        props.labelAttribute = extractLabelProp();

        // Parse GeneratedLabelRule for Scale
        const labelRuleRegex = /<Rule>[\s\S]*?<Title>GeneratedLabelRule<\/Title>([\s\S]*?)<\/Rule>/i;
        const labelRuleMatch = sldBody.match(labelRuleRegex);
        if (labelRuleMatch) {
            const ruleBody = labelRuleMatch[1];
            const maxScaleRegex = /<MaxScaleDenominator>([\d.]+)<\/MaxScaleDenominator>/i;
            const maxScaleMatch = ruleBody.match(maxScaleRegex);
            if (maxScaleMatch) {
                const scale = parseFloat(maxScaleMatch[1]);
                // Approximate conversion: Scale = 559082264 / (2 ^ Zoom)
                // Zoom = log2(559082264 / Scale)
                if (scale > 0) {
                    const zoom = Math.log2(559082264 / scale);
                    props.minZoom = Math.round(zoom);
                    props.staticLabel = false;
                }
            } else {
                props.staticLabel = true;
            }
        } else {
            // Check for previous standard TextSymbolizer without specific rule
            // Assuming static if checks pass and no GeneratedLabelRule found
            props.staticLabel = true;
        }

        // Parse VendorOptions for Duplicates and Repeat
        const groupOptionRegex = /<VendorOption name="group">([^<]+)<\/VendorOption>/i;
        const repeatOptionRegex = /<VendorOption name="repeat">([^<]+)<\/VendorOption>/i;

        const groupMatch = sldBody.match(groupOptionRegex);
        props.preventDuplicates = groupMatch ? (groupMatch[1] === 'yes') : false;

        const repeatMatch = sldBody.match(repeatOptionRegex);
        props.labelRepeat = repeatMatch ? parseInt(repeatMatch[1]) : 0;


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
        let pendingLabelRule = null;

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
            if (value === undefined) return;

            if (parentTagName) {
                const parentRegex = new RegExp(`(<(?:[\\w-]*:)?${parentTagName}[^>]*>)([\\s\\S]*?)(</(?:[\\w-]*:)?${parentTagName}>)`, 'gi');

                newSld = newSld.replace(parentRegex, (match, startTag, content, endTag) => {
                    const paramRegex = new RegExp(`(<(?:[\\w-]*:)?(?:Css|Svg)Parameter[^>]*name="${name}"[^>]*>)([^<]*)(</(?:[\\w-]*:)?(?:Css|Svg)Parameter>)`, 'i');

                    if (value === null) {
                        return `${startTag}${content.replace(paramRegex, '')}${endTag}`;
                    } else {
                        if (paramRegex.test(content)) {
                            return `${startTag}${content.replace(paramRegex, `$1${value}$3`)}${endTag}`;
                        } else {
                            const tagType = newSld.includes('SvgParameter') ? 'SvgParameter' : 'CssParameter';
                            const prefixMatch = startTag.match(/<([\w-]*:)/);
                            const prefix = prefixMatch ? prefixMatch[1] : '';
                            const newParam = `\n            <${prefix}${tagType} name="${name}">${value}</${prefix}${tagType}>`;
                            return `${startTag}${content}${newParam}${endTag}`;
                        }
                    }
                });
            } else {
                const regex = new RegExp(`(<(?:[\\w-]*:)?(?:Css|Svg)Parameter[^>]*name="${name}"[^>]*>)[^<]*(</(?:[\\w-]*:)?(?:Css|Svg)Parameter>)`, 'gi');
                if (value === null) {
                    if (newSld.match(regex)) newSld = newSld.replace(regex, '');
                } else {
                    if (newSld.match(regex)) newSld = newSld.replace(regex, `$1${value}$2`);
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

        // Handle Hatch Patterns for Polygons
        // Target specifically PolygonSymbolizer Fill to avoid affecting Mark Fill or TextSymbolizer Fill
        const polyFillRegex = /(<PolygonSymbolizer[\s\S]*?)<Fill>([\s\S]*?)<\/Fill>/i;
        const polyFillMatch = newSld.match(polyFillRegex);

        // 'outline' is special: renders as solid fill structure but with 0 opacity
        const isGraphicPattern = props.hatchPattern && props.hatchPattern !== '' && props.hatchPattern !== 'outline';

        if (isGraphicPattern) {
            // Create proper GraphicFill with Size for spacing control
            const graphicFill = `<Fill>
              <GraphicFill>
                <Graphic>
                  <Mark>
                    <WellKnownName>${props.hatchPattern}</WellKnownName>
                    <Stroke>
                      <CssParameter name="stroke">${props.stroke || '#000000'}</CssParameter>
                      <CssParameter name="stroke-width">1</CssParameter>
                    </Stroke>
                  </Mark>
                  <Size>8</Size>
                </Graphic>
              </GraphicFill>
            </Fill>`;

            if (polyFillMatch) {
                newSld = newSld.replace(polyFillRegex, `$1${graphicFill}`);
            }
        } else if (polyFillMatch && polyFillMatch[2].includes('GraphicFill')) {
            // Remove GraphicFill if pattern is cleared, restore solid fill
            const solidFill = `<Fill>
              <CssParameter name="fill">${props.fill || '#cccccc'}</CssParameter>
              <CssParameter name="fill-opacity">${props.fillOpacity || 1}</CssParameter>
            </Fill>`;
            newSld = newSld.replace(polyFillRegex, `$1${solidFill}`);
        }

        // Force opacity to 0 for Outline
        if (props.hatchPattern === 'outline') {
            props.fillOpacity = 0.0;
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
        // REMOVE any existing TextSymbolizer (Global cleanup)
        newSld = newSld.replace(/<(?:[\w-]*:)?TextSymbolizer>[\s\S]*?<\/(?:[\w-]*:)?TextSymbolizer>/gi, '');

        // REMOVE any existing GeneratedLabelRule
        newSld = newSld.replace(/<Rule>[\s\S]*?<Title>GeneratedLabelRule<\/Title>[\s\S]*?<\/Rule>/gi, '');

        // Add New Label Rule if Attribute Selected
        if (props.labelAttribute) {
            let scaleFilter = '';
            if (!props.staticLabel) {
                // Convert Zoom to Scale
                // Scale = 559082264 / (2 ^ Zoom)
                // Use MaxScaleDenominator (Show when scale is LESS than this, i.e. Zoom is MORE than this)
                const scale = 559082264 / Math.pow(2, props.minZoom);
                scaleFilter = `\n            <MaxScaleDenominator>${scale}</MaxScaleDenominator>`;
            }

            const newLabelRule = `
        <Rule>
            <Title>GeneratedLabelRule</Title>${scaleFilter}
            <TextSymbolizer>
                <Label>
                    <PropertyName>${props.labelAttribute}</PropertyName>
                </Label>
                <Font>
                    <CssParameter name="font-family">${props.fontFamily || 'Arial'}</CssParameter>
                    <CssParameter name="font-size">${props.fontSize || 12}</CssParameter>
                    <CssParameter name="font-style">${props.fontStyle || 'normal'}</CssParameter>
                    <CssParameter name="font-weight">${props.fontWeight || 'normal'}</CssParameter>
                </Font>
                <LabelPlacement>
                    <PointPlacement>
                        <AnchorPoint>
                            <AnchorPointX>0.5</AnchorPointX>
                            <AnchorPointY>0.5</AnchorPointY>
                        </AnchorPoint>
                    </PointPlacement>
                </LabelPlacement>
                <Halo>
                    <Radius>${props.haloRadius || 1}</Radius>
                    <Fill>
                        <CssParameter name="fill">${props.haloColor || '#FFFFFF'}</CssParameter>
                    </Fill>
                </Halo>
                <Fill>
                   <CssParameter name="fill">${props.fontColor || '#000000'}</CssParameter>
                </Fill>
                <VendorOption name="group">${props.staticLabel ? 'yes' : 'no'}</VendorOption>
                <VendorOption name="labelAllGroup">false</VendorOption>
                <VendorOption name="partials">true</VendorOption>
                <VendorOption name="repeat">${props.staticLabel ? '0' : (props.labelRepeat || '0')}</VendorOption>
                <VendorOption name="spaceAround">10</VendorOption>
                <VendorOption name="conflictResolution">true</VendorOption>
                <VendorOption name="goodnessOfFit">0</VendorOption>
                <VendorOption name="maxDisplacement">40</VendorOption>
                <VendorOption name="autoWrap">100</VendorOption>
            </TextSymbolizer>
        </Rule>`;

            // NOTE: We used to insert here, but moved it to the very end to avoid interference
            // from broad 'Fill'/'Stroke' replacements intended for other symbolizers.
            // newSld = newSld.replace(/(<\/FeatureTypeStyle>)/i, `${newLabelRule}$1`);

            // We store it for later insertion
            pendingLabelRule = newLabelRule;
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

        // Redundant calls for labels removed as they are now embedded in the template
        // and carefully avoided by moving the label rule insertion to the final step.

        // Finalize: Insert Label Rule if pending
        if (pendingLabelRule) {
            newSld = newSld.replace(/(<\/FeatureTypeStyle>)/i, `${pendingLabelRule}$1`);
        }

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
        let styleDataToUse = data;

        if (!styleDataToUse) {
            // Create default SLD if none exists
            const defaultSld = `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" 
    xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd" 
    xmlns="http://www.opengis.net/sld" 
    xmlns:ogc="http://www.opengis.net/ogc" 
    xmlns:xlink="http://www.w3.org/1999/xlink" 
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>${layer.name}</Name>
    <UserStyle>
      <Title>Default Style</Title>
      <FeatureTypeStyle>
        <Rule>
          <Title>Default Rule</Title>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#cccccc</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#333333</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>10</Size>
            </Graphic>
          </PointSymbolizer>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#333333</CssParameter>
              <CssParameter name="stroke-width">1</CssParameter>
            </Stroke>
          </LineSymbolizer>
          <PolygonSymbolizer>
            <Fill>
              <CssParameter name="fill">#cccccc</CssParameter>
              <CssParameter name="fill-opacity">1.0</CssParameter>
            </Fill>
            <Stroke>
              <CssParameter name="stroke">#333333</CssParameter>
              <CssParameter name="stroke-width">1</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;

            styleDataToUse = {
                styleName: 'default_style',
                sldBody: defaultSld
            };

            // Save default SLD to GeoServer so it persists across reloads
            const saveSuccess = await handleUpdateLayerStyle(layer.id, layer.fullName, defaultSld);
            if (saveSuccess) {
                // Re-fetch to get the server-assigned style name
                const savedData = await getLayerStyle(layer.fullName);
                if (savedData) {
                    styleDataToUse = savedData;
                }
            }
        }

        if (styleDataToUse) {
            // Fetch attributes
            const attrs = await getLayerAttributes(layer.fullName);
            setLayerAttributes(attrs || []);

            const { props, availableProps } = parseSLD(styleDataToUse.sldBody);
            setStyleData({ ...styleDataToUse, properties: props, availableProps });
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
            toast.success('Style updated successfully!');
        } else {
            toast.error('Failed to update style on server.');
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
            toast.success('Icon uploaded successfully!');
        } else {
            toast.error('Failed to upload icon to server.');
        }
    };

    // Debounce for autoSave
    const saveTimeoutRef = useRef(null);

    const updateStyleProp = (key, value, autoSave = true) => {
        setStyleData(prev => {
            if (!prev) return prev;
            const nextProps = { ...prev.properties, [key]: value };


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
            case 'action': {
                const isHighlighting = isHighlightAnimating && activeHighlightLayerId === layer.id;
                const isZoomed = activeZoomLayerId === layer.id;

                return (
                    <div className="layer-action-buttons" onClick={(e) => e.stopPropagation()}>
                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <button
                                    className={`action-btn ${isZoomed ? 'active' : ''}`}
                                    onClick={() => handleZoomToLayer(layer.id)}
                                >
                                    <Goal size={16} />
                                </button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content className="TooltipContent" side="top" sideOffset={5}>
                                    Zoom to Layer
                                    <Tooltip.Arrow className="TooltipArrow" />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>

                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <button
                                    className={`action-btn ${isHighlighting ? 'active animating' : ''}`}
                                    onClick={() => handleHighlightLayer(layer.id)}
                                >
                                    {isHighlighting ? <Square size={14} fill="currentColor" /> : <Play size={16} />}
                                </button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content className="TooltipContent" side="top" sideOffset={5}>
                                    {isHighlighting ? 'Stop Highlight' : 'Highlight Layer'}
                                    <Tooltip.Arrow className="TooltipArrow" />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>
                    </div>
                );
            }
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

            case 'swipe': {
                const isSwipeSelected = swipeLayerIds?.includes(layer.id);
                return (
                    <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                        <input
                            type="checkbox"
                            checked={isSwipeSelected}
                            onChange={() => handleToggleSwipe(layer.id)}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                );
            }

            case 'attribute': {
                const isSelected = selectedAttributeLayerId === layer.id;
                return (
                    <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                                const checked = e.target.checked;
                                if (checked) {
                                    setSelectedAttributeLayerId(layer.id);
                                    setShowAttributeTable(true);
                                    GetLayerAttributes(layer.id);
                                } else {
                                    setSelectedAttributeLayerId(null);
                                    setShowAttributeTable(false);
                                }
                            }}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                );
            }

            case 'querybuilder': {
                const isSelected = selectedQueryLayerIds.includes(layer.id);
                const hasFilter = !!layer.cqlFilter;

                return (
                    <div className="query-builder-toggle-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {hasFilter && (
                            <button
                                className="clear-filter-btn-mini"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleApplyLayerFilter(layer.id, null);
                                }}
                                title="Clear Filter"
                                style={{
                                    border: 'none',
                                    background: 'rgba(var(--color-danger-rgb), 0.1)',
                                    color: 'var(--color-danger)',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <RefreshCw size={12} />
                            </button>
                        )}
                        <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                    toggleLayerQuery(layer.id);
                                    if (e.target.checked && !queryingLayer) {
                                        setQueryingLayer(layer);
                                        setShowQueryBuilder(true);
                                    }
                                }}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                );
            }

            case 'analysis': {
                const isSelected = analysisLayerIds?.includes(layer.id);
                return (
                    <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleAnalysisLayer(layer.id)}
                        />
                        <span className="toggle-slider"></span>
                    </label>
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
                {/* Horizontal Swipe Slider - Shows at top when swipe tool is active */}
                {activeLayerTool === 'swipe' && swipeLayerIds?.length > 0 && (
                    <div className="swipe-slider-container" style={{
                        padding: '12px',
                        marginBottom: '8px',
                        background: 'rgba(var(--color-primary-rgb), 0.08)',
                        borderRadius: '8px',
                        border: '1px solid rgba(var(--color-primary-rgb), 0.15)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Swipe Position
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                                {Math.round(swipePosition)}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={swipePosition}
                            onChange={(e) => setSwipePosition(parseFloat(e.target.value))}
                            className="layer-opacity-slider"
                            style={{ width: '100%', margin: 0 }}
                            title="Drag to adjust swipe position"
                        />
                    </div>
                )}

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

                <div className="layer-section-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: activeLayerTool === 'querybuilder' ? '12px 0 8px' : '8px 0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, opacity: 0.8 }}>GEOSERVER LAYERS</span>
                        {activeLayerTool === 'querybuilder' && (
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', marginRight: '4px' }}>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)' }}>ALL</span>
                                <label className="toggle-switch" style={{ transform: 'scale(0.7)' }}>
                                    <input
                                        type="checkbox"
                                        checked={geoServerLayers.length > 0 && selectedQueryLayerIds.length === geoServerLayers.length}
                                        onChange={toggleSelectAllQuery}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        )}
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
                    {activeLayerTool === 'swipe' && geoServerLayers.filter(l => l.visible).length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 500 }}>ALL</span>
                            <label className="toggle-switch" style={{ transform: 'scale(0.7)', marginRight: '-4px' }}>
                                <input
                                    type="checkbox"
                                    checked={swipeLayerIds?.length === geoServerLayers.filter(l => l.visible).length && swipeLayerIds?.length > 0}
                                    onChange={(e) => handleToggleSwipeAll(e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    )}
                </div>

                <div className="layer-list-group scrollable">
                    {(() => {
                        const sourceLayers = activeLayerTool === 'reorder' ? localLayers : geoServerLayers;

                        const displayedLayers = (activeLayerTool === 'density' || activeLayerTool === 'legend' || activeLayerTool === 'info' || activeLayerTool === 'action' || activeLayerTool === 'styles' || activeLayerTool === 'attribute' || activeLayerTool === 'swipe')
                            ? sourceLayers.filter(l => l.visible)
                            : sourceLayers;

                        if (displayedLayers.length === 0) {
                            return (
                                <div className="empty-layers-msg">
                                    {(activeLayerTool === 'density' || activeLayerTool === 'legend' || activeLayerTool === 'styles' || activeLayerTool === 'swipe')
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
                                        if (activeLayerTool === 'action') {
                                            // Optional: Pick a default action or just let individual buttons handle it
                                            // For now, doing nothing on row click for 'action' tool to avoid ambiguity
                                        } else if (activeLayerTool === 'styles') {
                                            handleLoadStyle(layer);
                                        }
                                    }}
                                    style={{
                                        cursor: (activeLayerTool === 'styles') ? 'pointer' : 'default',
                                        borderLeft: (
                                            (activeLayerTool === 'action' && (activeZoomLayerId === layer.id || activeHighlightLayerId === layer.id)) ||
                                            (activeLayerTool === 'styles' && editingStyleLayer === layer.id)
                                        ) ? '3px solid var(--color-primary)' : 'none',
                                        backgroundColor: (
                                            (activeLayerTool === 'action' && (activeZoomLayerId === layer.id || activeHighlightLayerId === layer.id)) ||
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
                                            <div className="style-tab-content modern-ref">

                                                {/* SYMBOLOGY SECTION */}
                                                <div className="tab-pane ref-layout" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', marginBottom: '16px' }}>

                                                    {/* ROW 1: Fill Pattern + Fill Color */}
                                                    <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', marginBottom: '12px' }}>
                                                        {styleData.availableProps.hatchPattern && (
                                                            <div style={{ flex: 1 }}>
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
                                                        {styleData.availableProps.fill && (
                                                            <div style={{ flex: 1 }}>
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
                                                    </div>

                                                    {/* ROW 2: Fill Opacity */}
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

                                                    {/* ROW 3: Stroke Pattern + Stroke Color */}
                                                    <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', marginBottom: '12px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <span className="ref-label">Stroke Pattern</span>
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
                                                        {styleData.availableProps.stroke && (
                                                            <div style={{ flex: 1 }}>
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
                                                    </div>

                                                    {/* ROW 4: Stroke Width */}
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

                                                    {/* SVG ICON / DYNAMIC SYMBOLOGY (POINT ONLY) - At End */}
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
                                                </div>

                                                {/* LABELS SECTION */}
                                                <div className="tab-pane ref-layout">
                                                    <div className="symbology-header" style={{ marginTop: '0', marginBottom: '12px' }}>
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

                                                            {/* FONT & HALO COLOR */}
                                                            <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', marginBottom: '12px' }}>
                                                                <div style={{ flex: 1 }}>
                                                                    <span className="ref-label">Font Color</span>
                                                                    <div className="ref-active-color-bar" style={{ backgroundColor: styleData.properties.fontColor || '#000000' }}>
                                                                        <input
                                                                            type="color"
                                                                            value={styleData.properties.fontColor || '#000000'}
                                                                            onChange={(e) => updateStyleProp('fontColor', e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div style={{ flex: 1 }}>
                                                                    <span className="ref-label">Halo Color</span>
                                                                    <div className="ref-active-color-bar" style={{ backgroundColor: styleData.properties.haloColor || '#FFFFFF' }}>
                                                                        <input
                                                                            type="color"
                                                                            value={styleData.properties.haloColor || '#FFFFFF'}
                                                                            onChange={(e) => updateStyleProp('haloColor', e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* STATIC LABEL TOGGLE */}
                                                            <div className="ref-row">
                                                                <span className="ref-label">Static Label</span>
                                                                <label className="toggle-switch" style={{ transform: 'scale(0.8)', marginRight: '-4px' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={styleData.properties.staticLabel}
                                                                        onChange={(e) => updateStyleProp('staticLabel', e.target.checked)}
                                                                    />
                                                                    <span className="toggle-slider"></span>
                                                                </label>
                                                            </div>

                                                            {/* MIN ZOOM LEVEL */}
                                                            {!styleData.properties.staticLabel && (
                                                                <div className="ref-row">
                                                                    <span className="ref-label">Show at Zoom Level &gt; {styleData.properties.minZoom || 14}</span>
                                                                    <div className="ref-input-group">
                                                                        <input
                                                                            type="range" min="0" max="22" step="1"
                                                                            className="layer-opacity-slider"
                                                                            value={styleData.properties.minZoom || 14}
                                                                            onChange={(e) => updateStyleProp('minZoom', parseInt(e.target.value))}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {!styleData.properties.labelAttribute && (
                                                        <div className="no-props-hint">
                                                            Select a field to enable labeling.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Query Builder UI removed from here, now in QueryBuilderCard */}
                            </div>
                        ));
                    })()}
                </div>
            </div>
        </div >
    );
};

export default LayerOperations;
