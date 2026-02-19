/**
 * Utility functions for SLD (Styled Layer Descriptor) parsing and manipulation
 */

export const parseSLD = (sldBody) => {
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
            const contextRegex = new RegExp(`<([\\w-]*:)?${parentContext}[\\s\\S]*?>([\\s\\S]*?)</(?:[\\w-]*:)?${parentContext}>`, 'i');
            const contextMatch = sldBody.match(contextRegex);
            if (contextMatch) {
                searchTarget = contextMatch[2];
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
            regex = new RegExp(`<([\\w-]*:)?${parentContext}[\\s\\S]*?<([\\w-]*:)?${tagName}>([^<]+)</(?:[\\w-]*:)?${tagName}>`, 'i');
            const match = sldBody.match(regex);
            if (match) {
                const propKey = tagName.charAt(0).toLowerCase() + tagName.slice(1);
                availableProps[propKey] = true;
                return match[3].trim();
            }
        } else {
            regex = new RegExp(`<([\\w-]*:)?${tagName}>([^<]+)</(?:[\\w-]*:)?${tagName}>`, 'i');
            const match = sldBody.match(regex);
            if (match) {
                const propKey = tagName.charAt(0).toLowerCase() + tagName.slice(1);
                availableProps[propKey] = true;
                return match[2].trim();
            }
        }
        return defaultValue;
    };

    const extractExternalGraphic = () => {
        const regex = /<([\\w-]*:)?ExternalGraphic>[\s\S]*?<([\\w-]*:)?OnlineResource[\s\S]*?href="([^"]+)"[\s\S]*?\/>/i;
        const match = sldBody.match(regex);
        if (match) {
            availableProps.externalGraphicUrl = true;
            return match[3].trim();
        }
        return '';
    };

    const extractLabelProp = () => {
        const regex = /<([\\w-]*:)?Label>\s*<([\\w-]*:)?PropertyName>([\s\S]*?)<\/(?:[\\w-]*:)?PropertyName>\s*<\/(?:[\\w-]*:)?Label>/i;
        const match = sldBody.match(regex);
        if (match) {
            availableProps.labelAttribute = true;
            return match[3].trim();
        }
        return '';
    };

    const extractHatch = () => {
        const regex = /<([\\w-]*:)?Fill>[\s\S]*?<([\\w-]*:)?GraphicFill>[\s\S]*?<([\\w-]*:)?WellKnownName>([^<]+)<\/(?:[\\w-]*:)?WellKnownName>/i;
        const match = sldBody.match(regex);
        if (match) {
            availableProps.hatchPattern = true;
            return match[4].trim();
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
    const labelRuleRegex = /<([\\w-]*:)?Rule>[\s\S]*?<([\\w-]*:)?Title>GeneratedLabelRule<\/([\\w-]*:)?Title>([\s\S]*?)<\/([\\w-]*:)?Rule>/i;
    const labelRuleMatch = sldBody.match(labelRuleRegex);
    if (labelRuleMatch) {
        const ruleBody = labelRuleMatch[4];
        const maxScaleRegex = /<([\\w-]*:)?MaxScaleDenominator>([\d.]+)<\/([\\w-]*:)?MaxScaleDenominator>/i;
        const maxScaleMatch = ruleBody.match(maxScaleRegex);
        if (maxScaleMatch) {
            const scale = parseFloat(maxScaleMatch[2]);
            // Approximate conversion: Scale = 559082264 / (2 ^ Zoom)
            if (scale > 0) {
                const zoom = Math.log2(559082264 / scale);
                props.minZoom = Math.round(zoom);
                props.staticLabel = false;
            }
        } else {
            props.staticLabel = true;
        }
    } else {
        props.staticLabel = true;
    }

    // Parse VendorOptions for Duplicates and Repeat
    const groupOptionRegex = /<([\\w-]*:)?VendorOption name="group">([^<]+)<\/(?:[\\w-]*:)?VendorOption>/i;
    const repeatOptionRegex = /<([\\w-]*:)?VendorOption name="repeat">([^<]+)<\/(?:[\\w-]*:)?VendorOption>/i;

    const groupMatch = sldBody.match(groupOptionRegex);
    props.preventDuplicates = groupMatch ? (groupMatch[2] === 'yes') : false;

    const repeatMatch = sldBody.match(repeatOptionRegex);
    props.labelRepeat = repeatMatch ? parseInt(repeatMatch[2]) : 0;


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
        availableProps.size = true; availableProps.wellKnownName = true;
        availableProps.stroke = true; availableProps.fill = true;
        availableProps.externalGraphicUrl = true; availableProps.rotation = true;
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

export const applyStyleChanges = (sldBody, props) => {
    let newSld = sldBody;
    let pendingLabelRule = null;

    const ensureParent = (parentTag, containerTag) => {
        const tagRegex = new RegExp(`<([\\w-]*:)?${parentTag}[^>]*>`, 'i');
        if (!newSld.match(tagRegex)) {
            const containerRegex = new RegExp(`(<([\\w-]*:)?${containerTag}[^>]*>)([\\s\\S]*?)(</(?:[\\w-]*:)?${containerTag}>)`, 'i');
            const match = newSld.match(containerRegex);
            if (match) {
                const prefix = match[2] || '';
                const newParent = `\n            <${prefix}${parentTag}></${prefix}${parentTag}>`;
                newSld = newSld.replace(containerRegex, `$1$3${newParent}$4`);
            }
        }
    };

    const replace = (name, value, parentTagName) => {
        if (value === undefined) return;

        if (parentTagName) {
            const parentRegex = new RegExp(`(<([\\w-]*:)?${parentTagName}[^>]*>)([\\s\\S]*?)(</(?:[\\w-]*:)?${parentTagName}>)`, 'gi');

            newSld = newSld.replace(parentRegex, (match, startTag, prefix, content, endTag) => {
                const paramRegex = new RegExp(`(<([\\w-]*:)?(Css|Svg)Parameter[^>]*name="${name}"[^>]*>)([^<]*)(</(?:[\\w-]*:)?(?:Css|Svg)Parameter>)`, 'i');

                if (value === null) {
                    return `${startTag}${content.replace(paramRegex, '')}${endTag}`;
                } else {
                    if (paramRegex.test(content)) {
                        return `${startTag}${content.replace(paramRegex, `$1${value}$5`)}${endTag}`;
                    } else {
                        const tagType = newSld.includes('SvgParameter') ? 'SvgParameter' : 'CssParameter';
                        const internalPrefix = prefix || '';
                        const newParam = `\n            <${internalPrefix}${tagType} name="${name}">${value}</${internalPrefix}${tagType}>`;
                        return `${startTag}${content}${newParam}${endTag}`;
                    }
                }
            });
        } else {
            const regex = new RegExp(`(<([\\w-]*:)?(Css|Svg)Parameter[^>]*name="${name}"[^>]*>)[^<]*(</(?:[\\w-]*:)?(?:Css|Svg)Parameter>)`, 'gi');
            if (value === null) {
                if (newSld.match(regex)) newSld = newSld.replace(regex, '');
            } else {
                if (newSld.match(regex)) newSld = newSld.replace(regex, `$1${value}$4`);
            }
        }
    };

    const replaceTag = (tagName, value, parentTagName) => {
        if (value === undefined || value === null) return;
        const regex = new RegExp(`(<([\\w-]*:)?${tagName}[^>]*>)[^<]*(</(?:[\\w-]*:)?${tagName}>)`, 'i');
        if (newSld.match(regex)) {
            newSld = newSld.replace(regex, `$1${value}$3`);
        } else if (parentTagName) {
            const parentRegex = new RegExp(`(<([\\w-]*:)?${parentTagName}[^>]*>)([\\s\\S]*?)(</(?:[\\w-]*:)?${parentTagName}>)`, 'i');
            const match = newSld.match(parentRegex);
            if (match) {
                const prefix = match[2] || '';
                const newTag = `\n            <${prefix}${tagName}>${value}</${prefix}${tagName}>`;
                newSld = newSld.replace(parentRegex, `$1$3${newTag}$4`);
            }
        }
    };

    // -------------------------------------------------------------------------
    // 1. Structural Robustness
    // -------------------------------------------------------------------------
    ensureParent('Fill', 'PolygonSymbolizer');
    ensureParent('Stroke', 'PolygonSymbolizer');
    ensureParent('Stroke', 'LineSymbolizer');
    ensureParent('Fill', 'Mark');
    ensureParent('Stroke', 'Mark');
    ensureParent('Halo', 'TextSymbolizer');
    ensureParent('Font', 'TextSymbolizer');
    ensureParent('Fill', 'TextSymbolizer');

    // -------------------------------------------------------------------------
    // 2. Generic Property Replacements (First pass)
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // 2. Specialized Replacements (Second pass - can overwrite generic tags)
    // -------------------------------------------------------------------------

    // Handle SVG Icons
    if (props.externalGraphicUrl) {
        const pointSymbolizerRegex = /(<([\\w-]*:)?PointSymbolizer[^>]*>[\s\S]*?<([\\w-]*:)?Graphic[^>]*>)([\s\S]*?)(<\/([\\w-]*:)?Graphic>[\s\S]*?<\/([\\w-]*:)?PointSymbolizer>)/i;
        const match = newSld.match(pointSymbolizerRegex);
        if (match) {
            const prefix = match[2] || '';
            const svgTag = `<${prefix}ExternalGraphic><${prefix}OnlineResource xlink:type="simple" xlink:href="${props.externalGraphicUrl}" /><${prefix}Format>image/svg+xml</${prefix}Format></${prefix}ExternalGraphic>`;
            const cleanGraphic = match[4].replace(/<([\\w-]*:)?(Mark|ExternalGraphic)>[\s\S]*?<\/(?:[\\w-]*:)?(?:\2)>/i, svgTag);
            newSld = newSld.replace(pointSymbolizerRegex, `$1${cleanGraphic}$5`);
        }
    } else if (props.wellKnownName) {
        const pointSymbolizerRegex = /(<([\\w-]*:)?PointSymbolizer[^>]*>[\s\S]*?<([\\w-]*:)?Graphic[^>]*>)([\s\S]*?)(<\/([\\w-]*:)?Graphic>[\s\S]*?<\/([\\w-]*:)?PointSymbolizer>)/i;
        const match = newSld.match(pointSymbolizerRegex);
        if (match && match[4].includes('ExternalGraphic')) {
            const prefix = match[2] || '';
            const markTag = `<${prefix}Mark><${prefix}WellKnownName>${props.wellKnownName}</${prefix}WellKnownName><${prefix}Fill/><${prefix}Stroke/></${prefix}Mark>`;
            const cleanGraphic = match[4].replace(/<([\\w-]*:)?ExternalGraphic>[\s\S]*?<\/(?:[\\w-]*:)?ExternalGraphic>/i, markTag);
            newSld = newSld.replace(pointSymbolizerRegex, `$1${cleanGraphic}$5`);
        }
    }

    // Handle Hatch Patterns for Polygons
    const polyFillRegex = /(<([\\w-]*:)?PolygonSymbolizer[\s\S]*?)<([\\w-]*:)?Fill>([\s\S]*?)<\/([\\w-]*:)?Fill>/i;
    const polyFillMatch = newSld.match(polyFillRegex);
    const isGraphicPattern = props.hatchPattern && props.hatchPattern !== '' && props.hatchPattern !== 'outline';

    if (isGraphicPattern) {
        const prefix = polyFillMatch ? (polyFillMatch[3] || '') : '';
        const tagType = newSld.includes('SvgParameter') ? 'SvgParameter' : 'CssParameter';
        const graphicFill = `<${prefix}Fill>
          <${prefix}GraphicFill>
            <${prefix}Graphic>
              <${prefix}Mark>
                <${prefix}WellKnownName>${props.hatchPattern}</${prefix}WellKnownName>
                <${prefix}Stroke>
                  <${prefix}${tagType} name="stroke">${props.stroke || '#000000'}</${prefix}${tagType}>
                  <${prefix}${tagType} name="stroke-width">1</${prefix}${tagType}>
                </${prefix}Stroke>
              </${prefix}Mark>
              <${prefix}Size>12</${prefix}Size>
            </${prefix}Graphic>
          </${prefix}GraphicFill>
        </${prefix}Fill>`;
        if (polyFillMatch) {
            newSld = newSld.replace(polyFillRegex, `$1${graphicFill}`);
        }
    } else if (props.hatchPattern === 'outline') {
        const prefix = polyFillMatch ? (polyFillMatch[3] || '') : '';
        const tagType = newSld.includes('SvgParameter') ? 'SvgParameter' : 'CssParameter';
        const outlineFill = `<${prefix}Fill><${prefix}${tagType} name="fill-opacity">0</${prefix}${tagType}></${prefix}Fill>`;
        if (polyFillMatch) {
            newSld = newSld.replace(polyFillRegex, `$1${outlineFill}`);
        }
    } else if (polyFillMatch && polyFillMatch[4].includes('GraphicFill')) {
        const prefix = polyFillMatch[3] || '';
        const tagType = newSld.includes('SvgParameter') ? 'SvgParameter' : 'CssParameter';
        const solidFill = `<${prefix}Fill>
          <${prefix}${tagType} name="fill">${props.fill || '#cccccc'}</${prefix}${tagType}>
          <${prefix}${tagType} name="fill-opacity">${props.fillOpacity || 1}</${prefix}${tagType}>
        </${prefix}Fill>`;
        newSld = newSld.replace(polyFillRegex, `$1${solidFill}`);
    }

    // Handle Labels
    newSld = newSld.replace(/<([\\w-]*:)?TextSymbolizer>[\s\S]*?<\/(?:[\\w-]*:)?TextSymbolizer>/gi, '');
    newSld = newSld.replace(/<([\\w-]*:)?Rule>[\s\S]*?<([\\w-]*:)?Title>GeneratedLabelRule<\/([\\w-]*:)?Title>[\s\S]*?<\/([\\w-]*:)?Rule>/gi, '');

    if (props.labelAttribute) {
        const featureTypeStyleRegex = /(<([\\w-]*:)?FeatureTypeStyle[^>]*>)([\\s\\S]*?)(<\/([\\w-]*:)?FeatureTypeStyle>)/i;
        const ftMatch = newSld.match(featureTypeStyleRegex);
        if (ftMatch) {
            const prefix = ftMatch[2] || '';
            const tagType = newSld.includes('SvgParameter') ? 'SvgParameter' : 'CssParameter';

            let scaleFilter = '';
            if (!props.staticLabel) {
                const scale = 559082264 / Math.pow(2, props.minZoom);
                scaleFilter = `\n            <${prefix}MaxScaleDenominator>${scale}</${prefix}MaxScaleDenominator>`;
            }

            const newLabelRule = `
    <${prefix}Rule>
        <${prefix}Title>GeneratedLabelRule</${prefix}Title>${scaleFilter}
        <${prefix}TextSymbolizer>
            <${prefix}Label>
                <ogc:PropertyName>${props.labelAttribute}</ogc:PropertyName>
            </${prefix}Label>
            <${prefix}Font>
                <${prefix}${tagType} name="font-family">${props.fontFamily || 'Arial'}</${prefix}${tagType}>
                <${prefix}${tagType} name="font-size">${props.fontSize || 12}</${prefix}${tagType}>
                <${prefix}${tagType} name="font-style">${props.fontStyle || 'normal'}</${prefix}${tagType}>
                <${prefix}${tagType} name="font-weight">${props.fontWeight || 'normal'}</${prefix}${tagType}>
            </${prefix}Font>
            <${prefix}LabelPlacement>
                <${prefix}PointPlacement>
                    <${prefix}AnchorPoint>
                        <${prefix}AnchorPointX>0.5</${prefix}AnchorPointX>
                        <${prefix}AnchorPointY>0.5</${prefix}AnchorPointY>
                    </${prefix}AnchorPoint>
                </${prefix}PointPlacement>
            </${prefix}LabelPlacement>
            <${prefix}Halo>
                <${prefix}Radius>${props.haloRadius || 1}</${prefix}Radius>
                <${prefix}Fill>
                    <${prefix}${tagType} name="fill">${props.haloColor || '#FFFFFF'}</${prefix}${tagType}>
                </${prefix}Fill>
            </${prefix}Halo>
            <${prefix}Fill>
               <${prefix}${tagType} name="fill">${props.fontColor || '#000000'}</${prefix}${tagType}>
            </${prefix}Fill>
            <${prefix}VendorOption name="group">${props.staticLabel ? 'yes' : 'no'}</${prefix}VendorOption>
            <${prefix}VendorOption name="labelAllGroup">false</${prefix}VendorOption>
            <${prefix}VendorOption name="partials">true</${prefix}VendorOption>
            <${prefix}VendorOption name="repeat">${props.staticLabel ? '0' : (props.labelRepeat || '0')}</${prefix}VendorOption>
            <${prefix}VendorOption name="spaceAround">10</${prefix}VendorOption>
            <${prefix}VendorOption name="conflictResolution">true</${prefix}VendorOption>
            <${prefix}VendorOption name="goodnessOfFit">0</${prefix}VendorOption>
            <${prefix}VendorOption name="maxDisplacement">40</${prefix}VendorOption>
            <${prefix}VendorOption name="autoWrap">100</${prefix}VendorOption>
        </${prefix}TextSymbolizer>
    </${prefix}Rule>`;

            newSld = newSld.replace(featureTypeStyleRegex, `$1$3${newLabelRule}$4`);
        }
    }

    return newSld;
};
