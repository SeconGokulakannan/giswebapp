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

        // Expanded regex to handle namespaces better and ensuring value capture
        const regex = new RegExp(`<(?:[\\w-]*:)?(?:Css|Svg)Parameter[^>]*name=["']${name}["'][^>]*>([\\s\\S]*?)</(?:[\\w-]*:)?(?:Css|Svg)Parameter>`, 'i');
        const match = searchTarget.match(regex);
        if (match) {
            const propKey = name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            availableProps[propKey] = true;
            let val = match[1].trim();
            // Normalize dash-array
            if (name === 'stroke-dasharray') val = val.replace(/,/g, ' ').replace(/\s+/g, ' ');
            return val;
        }
        return defaultValue;
    };

    const extractTag = (tagName, defaultValue, parentContext = null) => {
        let regex;
        if (parentContext) {
            regex = new RegExp(`<([\\w-]*:)?${parentContext}[\\s\\S]*?<([\\w-]*:)?${tagName}>([\\s\\S]*?)</(?:[\\w-]*:)?${tagName}>`, 'i');
            const match = sldBody.match(regex);
            if (match) {
                const propKey = tagName.charAt(0).toLowerCase() + tagName.slice(1);
                availableProps[propKey] = true;
                return match[3].trim();
            }
        } else {
            regex = new RegExp(`<([\\w-]*:)?${tagName}>([\\s\\S]*?)</(?:[\\w-]*:)?${tagName}>`, 'i');
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
        // More specific regex to ensure we are inside a GraphicFill/Graphic/Mark structure
        // Relaxed whitespace handling and tag attributes
        const regex = /<([\\w-]*:)?Fill>[\s\S]*?<([\\w-]*:)?GraphicFill>[\s\S]*?<([\\w-]*:)?Graphic>[\s\S]*?<([\\w-]*:)?Mark>[\s\S]*?<([\\w-]*:)?WellKnownName>([^<]+)<\/(?:[\\w-]*:)?WellKnownName>/i;
        const match = sldBody.match(regex);
        if (match) {
            availableProps.hatchPattern = true;
            return match[6].trim();
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

    // Hatch Pattern Detection
    const hatch = extractHatch();
    if (hatch) {
        props.hatchPattern = hatch;
    } else if (props.fillOpacity === 0 && availableProps.fillOpacity) {
        // Detect Outline from 0 opacity
        props.hatchPattern = 'outline';
        availableProps.hatchPattern = true;
    }

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
    const groupOptionRegex = /<([\\w-]*:)?VendorOption name=["']group["']>([^<]+)<\/(?:[\\w-]*:)?VendorOption>/i;
    const repeatOptionRegex = /<([\\w-]*:)?VendorOption name=["']repeat["']>([^<]+)<\/(?:[\\w-]*:)?VendorOption>/i;

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
    console.log("StyleUtils: Applying Changes. Props:", props);
    let newSld = sldBody;
    let pendingLabelRule = null;

    const ensureParent = (parentTag, containerTag, beforeTag = null) => {
        const tagRegex = new RegExp(`<([\\w-]*:)?${parentTag}[^>]*>`, 'i');
        if (!newSld.match(tagRegex)) {
            const containerRegex = new RegExp(`(<([\\w-]*:)?${containerTag}[^>]*>)([\\s\\S]*?)(</(?:[\\w-]*:)?${containerTag}>)`, 'i');
            const match = newSld.match(containerRegex);
            if (match) {
                const prefix = match[2] || '';
                const content = match[3];
                const newParent = `\n            <${prefix}${parentTag}></${prefix}${parentTag}>`;

                if (beforeTag) {
                    const beforeRegex = new RegExp(`<([\\w-]*:)?${beforeTag}[^>]*>`, 'i');
                    if (content.match(beforeRegex)) {
                        const updatedContent = content.replace(beforeRegex, `${newParent}\n            $&`);
                        newSld = newSld.replace(containerRegex, `$1${updatedContent}$4`);
                        return;
                    }
                }
                newSld = newSld.replace(containerRegex, `$1$3${newParent}$4`);
            }
        }
    };

    const replace = (name, value, parentTagName) => {
        if (value === undefined) return;

        if (parentTagName) {
            const parentRegex = new RegExp(`(<([\\w-]*:)?${parentTagName}[^>]*>)([\\s\\S]*?)(</(?:[\\w-]*:)?${parentTagName}>)`, 'gi');

            newSld = newSld.replace(parentRegex, (match, startTag, prefix, content, endTag) => {
                const paramRegex = new RegExp(`(<([\\w-]*:)?(Css|Svg)Parameter[^>]*name=["']${name}["'][^>]*>)([^<]*)(</(?:[\\w-]*:)?(?:Css|Svg)Parameter>)`, 'i');

                if (value === null) {
                    return `${startTag}${content.replace(paramRegex, '')}${endTag}`;
                } else {
                    if (paramRegex.test(content)) {
                        return `${startTag}${content.replace(paramRegex, `$1${value}$5`)}${endTag}`;
                    } else {
                        const tagType = newSld.includes('SvgParameter') ? 'SvgParameter' : 'CssParameter';
                        const internalPrefix = prefix || '';
                        const newParam = `<${internalPrefix}${tagType} name="${name}">${value}</${internalPrefix}${tagType}>`;
                        return `${startTag}${content}${newParam}${endTag}`;
                    }
                }
            });
        } else {
            const regex = new RegExp(`(<([\\w-]*:)?(Css|Svg)Parameter[^>]*name=["']${name}["'][^>]*>)[^<]*(</(?:[\\w-]*:)?(?:Css|Svg)Parameter>)`, 'gi');
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
    // -------------------------------------------------------------------------
    // 1. Structural Robustness (Order Matters for Schema Compliance)
    // -------------------------------------------------------------------------
    ensureParent('Fill', 'PolygonSymbolizer', 'Stroke'); // Fill before Stroke
    ensureParent('Stroke', 'PolygonSymbolizer');

    ensureParent('Stroke', 'LineSymbolizer');

    ensureParent('Fill', 'Mark', 'Stroke');
    ensureParent('Stroke', 'Mark');

    ensureParent('Halo', 'TextSymbolizer', 'Fill');
    ensureParent('Font', 'TextSymbolizer', 'Halo');
    ensureParent('Fill', 'TextSymbolizer');

    // -------------------------------------------------------------------------
    // 2. Generic Property Replacements (First pass)
    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // 2. Generic Property Replacements (First pass - excluded from GraphicFill)
    // -------------------------------------------------------------------------
    // We delay 'fill' and 'stroke' for Polygon if a pattern is active
    // We delay 'fill' and 'stroke' for Polygon if a pattern is active
    const isGraphicPattern = props.hatchPattern && props.hatchPattern !== '' && props.hatchPattern !== 'outline';
    const isOutline = props.hatchPattern === 'outline';
    console.log("StyleUtils: isGraphicPattern:", isGraphicPattern, "isOutline:", isOutline, "hatchPattern:", props.hatchPattern);

    if (!isGraphicPattern && !isOutline) {
        console.log("StyleUtils: Applying generic fill (no pattern)");
        replace('fill', props.fill, 'Fill');
        replace('fill-opacity', props.fillOpacity, 'Fill');
    } else {
        console.log("StyleUtils: Skipping generic fill for pattern or outline");
    }

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

    // Handle Dash Array (Remove if null/Solid)
    if (props.strokeDasharray === null || props.strokeDasharray === '') {
        const strokeRegex = /(<([\w-]*:)?Stroke[^>]*>)([\s\S]*?)(<\/([\w-]*:)?Stroke>)/gi;
        newSld = newSld.replace(strokeRegex, (match, start, prefix, content, end) => {
            const dashRegex = /<([\w-]*:)?(Css|Svg)Parameter[^>]*name=["']stroke-dasharray["'][^>]*>([\s\S]*?)<\/([\w-]*:)?\2Parameter>/i;
            return `${start}${content.replace(dashRegex, '')}${end}`;
        });
    }

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

    // 2. Handle Hatch Patterns for Polygons
    // -------------------------------------------------------------------------
    // Improved Regex to find existing Fill within PolygonSymbolizer
    const polyFillRegex = /(<([\w-]*:)?PolygonSymbolizer[^>]*>)([\s\S]*?)(<([\w-]*:)?Fill>[\s\S]*?<\/(?:[\w-]*:)?Fill>)([\s\S]*?)(<\/(?:[\w-]*:)?PolygonSymbolizer>)/i;
    const polyFillMatch = newSld.match(polyFillRegex);

    // We also need a regex to just find ANY Fill inside PolygonSymbolizer for removal if the specific match above fails but we want to insert
    const simplePolyFillRegex = /<([\w-]*:)?Fill>[\s\S]*?<\/(?:[\w-]*:)?Fill>/i;

    // isGraphicPattern is already declared above

    if (isGraphicPattern) {
        console.log("StyleUtils: Entering pattern replacement block");

        // Determine prefix safely
        let prefix = '';
        if (polyFillMatch && polyFillMatch[3]) {
            prefix = polyFillMatch[3];
        } else {
            const polySymMatch = newSld.match(/(<([\w-]*:)?PolygonSymbolizer[^>]*>)/i);
            if (polySymMatch && polySymMatch[2]) {
                prefix = polySymMatch[2];
            }
        }
        prefix = (prefix || '').trim();
        console.log("StyleUtils: Using prefix:", `'${prefix}'`);

        // Create the new Fill Tag
        const tagType = newSld.includes('SvgParameter') ? 'SvgParameter' : 'CssParameter';
        const graphicFill = `<${prefix}Fill>
          <${prefix}GraphicFill>
            <${prefix}Graphic>
              <${prefix}Mark>
                <${prefix}WellKnownName>${props.hatchPattern}</${prefix}WellKnownName>
                <${prefix}Stroke>
                  <${prefix}${tagType} name="stroke">${props.fill || '#000000'}</${prefix}${tagType}>
                  <${prefix}${tagType} name="stroke-width">1</${prefix}${tagType}>
                </${prefix}Stroke>
              </${prefix}Mark>
              <${prefix}Size>8</${prefix}Size>
            </${prefix}Graphic>
          </${prefix}GraphicFill>
        </${prefix}Fill>`;

        // Robust Replacement Strategy:
        // 1. Find the PolygonSymbolizer block
        const polySymRegex = /(<([\w-]*:)?PolygonSymbolizer[^>]*>)([\s\S]*?)(<\/([\w-]*:)?PolygonSymbolizer>)/i;
        const symMatch = newSld.match(polySymRegex);

        if (symMatch) {
            const startTag = symMatch[1];
            let content = symMatch[3];
            const endTag = symMatch[4];

            // 2. Remove ANY existing Fill tag from the content
            // Matches <sld:Fill>...</sld:Fill> or <sld:Fill />
            const fillRegex = /<([\w-]*:)?Fill([\s\S]*?)(<\/(?:[\w-]*:)?Fill>|\/>)/gi;
            // Also check for simple self-closing if the above is too strict
            const simpleFillRegex = /<([\w-]*:)?Fill[^>]*>[\s\S]*?<\/(?:[\w-]*:)?Fill>/gi;

            let cleanedContent = content;
            if (fillRegex.test(content)) {
                console.log("StyleUtils: Removing existing Fill from content");
                cleanedContent = content.replace(fillRegex, '');
            } else if (simpleFillRegex.test(content)) {
                console.log("StyleUtils: Removing existing Fill (simple regex)");
                cleanedContent = content.replace(simpleFillRegex, '');
            }

            // 3. Prepend the new GraphicFill to the cleaned content (Fill usually comes first)
            // Ensure we don't duplicate newlines excessively
            const newContent = `\n${graphicFill}\n${cleanedContent.trim()}`;

            console.log("StyleUtils: Reassembling PolygonSymbolizer with new Pattern");
            newSld = newSld.replace(polySymRegex, `${startTag}${newContent}\n${endTag}`);
        } else {
            console.warn("StyleUtils: No PolygonSymbolizer found to apply pattern!");
        }
    } else if (isOutline) {
        console.log("StyleUtils: Applying Outline (Removing Fill)");
        if (polyFillMatch) {
            newSld = newSld.replace(polyFillRegex, `$1$3$6$7`);
        } else {
            newSld = newSld.replace(simplePolyFillRegex, '');
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

    // Final Pass: Ensure Tag Order (Schema Compliance)
    const reorderTags = (symbolizerName, tagsOrder) => {
        const symRegex = new RegExp(`(<([\\w-]*:)?${symbolizerName}[^>]*>)([\\s\\S]*?)(</(?:[\\w-]*:)?${symbolizerName}>)`, 'gi');
        newSld = newSld.replace(symRegex, (match, start, prefix, content, end) => {
            const tags = [];
            tagsOrder.forEach(tagName => {
                const tagRegex = new RegExp(`[\\s]*<([\\w-]*:)?${tagName}[\\s\\S]*?\\/?>`, 'i');
                const tagFullRegex = new RegExp(`[\\s]*<([\\w-]*:)?${tagName}[\\s\\S]*?</(?:[\\w-]*:)?${tagName}>`, 'i');

                let tagMatch = content.match(tagFullRegex);
                if (!tagMatch) tagMatch = content.match(tagRegex); // Try self-closing

                if (tagMatch) {
                    tags.push(tagMatch[0]);
                    content = content.replace(tagMatch[0], ''); // Remove found tag
                }
            });
            // Append remaining content (like VendorOptions) and return reordered
            return `${start}${tags.join('')}${content}${end}`;
        });
    };

    reorderTags('PolygonSymbolizer', ['Geometry', 'Fill', 'Stroke']);
    reorderTags('PointSymbolizer', ['Geometry', 'Graphic']);
    reorderTags('LineSymbolizer', ['Geometry', 'Stroke']);
    reorderTags('TextSymbolizer', ['Label', 'Font', 'LabelPlacement', 'Halo', 'Fill']);

    return newSld;
};
