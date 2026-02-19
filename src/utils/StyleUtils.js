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
            const propKey = tagName.charAt(0).toLowerCase() + tagName.slice(1);
            availableProps[propKey] = true;
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
    const polyFillRegex = /(<PolygonSymbolizer[\s\S]*?)<Fill>([\s\S]*?)<\/Fill>/i;
    const polyFillMatch = newSld.match(polyFillRegex);
    const isGraphicPattern = props.hatchPattern && props.hatchPattern !== '' && props.hatchPattern !== 'outline';

    if (isGraphicPattern) {
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
    } else if (props.hatchPattern === 'outline') {
        // Force opacity to 0 for Outline mode
        const outlineFill = `<Fill><CssParameter name="fill-opacity">0</CssParameter></Fill>`;
        if (polyFillMatch) {
            newSld = newSld.replace(polyFillRegex, `$1${outlineFill}`);
        }
    } else if (polyFillMatch && polyFillMatch[2].includes('GraphicFill')) {
        // Restore solid fill if pattern was present before
        const solidFill = `<Fill>
          <CssParameter name="fill">${props.fill || '#cccccc'}</CssParameter>
          <CssParameter name="fill-opacity">${props.fillOpacity || 1}</CssParameter>
        </Fill>`;
        newSld = newSld.replace(polyFillRegex, `$1${solidFill}`);
    }

    // Handle Labels
    newSld = newSld.replace(/<(?:[\w-]*:)?TextSymbolizer>[\s\S]*?<\/(?:[\w-]*:)?TextSymbolizer>/gi, '');
    newSld = newSld.replace(/<Rule>[\s\S]*?<Title>GeneratedLabelRule<\/Title>[\s\S]*?<\/Rule>/gi, '');

    if (props.labelAttribute) {
        let scaleFilter = '';
        if (!props.staticLabel) {
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
        pendingLabelRule = newLabelRule;
    }

    if (pendingLabelRule) {
        newSld = newSld.replace(/(<\/FeatureTypeStyle>)/i, `${pendingLabelRule}$1`);
    }

    return newSld;
};
