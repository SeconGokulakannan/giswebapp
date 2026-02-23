/**
 * Utility functions for SLD (Styled Layer Descriptor) parsing and manipulation
 * Uses DOMParser for both parsing and applying style changes to ensure correctness.
 */

// ─────────────────────────────────────────────────────────────────────────────
// DOM HELPERS (namespace-aware)
// ─────────────────────────────────────────────────────────────────────────────

/** Get the first child element with the given local name (any namespace). */
const getEl = (root, localName) => {
    if (!root) return null;
    return root.getElementsByTagNameNS('*', localName)[0] ?? null;
};

/** Get ALL child elements with the given local name (any namespace). */
const getEls = (root, localName) => {
    if (!root) return [];
    return Array.from(root.getElementsByTagNameNS('*', localName));
};

/** Get a CssParameter/SvgParameter value by name within a DIRECT parent only. */
const getParam = (parentEl, paramName) => {
    if (!parentEl) return null;
    const candidates = [
        ...Array.from(parentEl.getElementsByTagNameNS('*', 'CssParameter')),
        ...Array.from(parentEl.getElementsByTagNameNS('*', 'SvgParameter')),
    ].filter(el => el.parentNode === parentEl); // DIRECT children only
    for (const el of candidates) {
        if (el.getAttribute('name') === paramName) return el.textContent?.trim() ?? null;
    }
    return null;
};

/** Get text content of the first tag with the given local name. */
const getTagText = (root, localName) => {
    const el = getEl(root, localName);
    return el ? el.textContent?.trim() ?? null : null;
};

/** Set a CssParameter/SvgParameter value within a direct parent. Creates if missing. */
const setDomParam = (doc, parentEl, paramName, value, paramTagName) => {
    if (!parentEl) return;
    const allParams = [
        ...Array.from(parentEl.getElementsByTagNameNS('*', 'CssParameter')),
        ...Array.from(parentEl.getElementsByTagNameNS('*', 'SvgParameter')),
    ].filter(el => el.parentNode === parentEl);

    let found = null;
    for (const el of allParams) {
        if (el.getAttribute('name') === paramName) { found = el; break; }
    }

    if (found) {
        found.textContent = String(value);
    } else {
        const ns = parentEl.namespaceURI;
        const prefix = parentEl.prefix ? `${parentEl.prefix}:` : '';
        const newEl = doc.createElementNS(ns, `${prefix}${paramTagName || 'CssParameter'}`);
        newEl.setAttribute('name', paramName);
        newEl.textContent = String(value);
        parentEl.appendChild(newEl);
    }
};

/** Remove a CssParameter/SvgParameter from a direct parent. */
const removeDomParam = (parentEl, paramName) => {
    if (!parentEl) return;
    const allParams = [
        ...Array.from(parentEl.getElementsByTagNameNS('*', 'CssParameter')),
        ...Array.from(parentEl.getElementsByTagNameNS('*', 'SvgParameter')),
    ].filter(el => el.parentNode === parentEl && el.getAttribute('name') === paramName);
    allParams.forEach(el => el.parentNode.removeChild(el));
};

/** Set text content of a tag. */
const setDomTagText = (el, value) => { if (el) el.textContent = String(value); };

/** Create a new element in the same namespace as the parent. */
const createEl = (doc, parentEl, localName) => {
    const ns = parentEl?.namespaceURI ?? '';
    const prefix = parentEl?.prefix ? `${parentEl.prefix}:` : '';
    return doc.createElementNS(ns, `${prefix}${localName}`);
};

/** Serialize an XML Document back to string. */
const serializeDoc = (doc) => {
    const s = new XMLSerializer();
    return s.serializeToString(doc);
};

/** Detect whether the SLD uses SvgParameter or CssParameter. */
const detectParamTag = (sldBody) => sldBody.includes('SvgParameter') ? 'SvgParameter' : 'CssParameter';


// ─────────────────────────────────────────────────────────────────────────────
// PARSE SLD
// ─────────────────────────────────────────────────────────────────────────────

export const parseSLD = (sldBody) => {
    const props = {
        fill: '#cccccc', fillOpacity: 1, stroke: '#333333', strokeWidth: 1, strokeOpacity: 1,
        strokeDasharray: null, strokeLinecap: 'butt', strokeLinejoin: 'miter',
        size: 10, rotation: 0, wellKnownName: 'circle', externalGraphicUrl: '', hatchPattern: '',
        fontSize: 12, fontColor: '#000000', fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal',
        haloRadius: 1, haloColor: '#ffffff', staticLabel: true, minZoom: 14,
        preventDuplicates: true, labelRepeat: 0, labelAttribute: ''
    };
    const availableProps = {
        fill: false, fillOpacity: false, stroke: false, strokeWidth: false,
        strokeOpacity: false, strokeDasharray: false, strokeLinecap: false, strokeLinejoin: false,
        size: false, rotation: false, wellKnownName: false, externalGraphicUrl: false,
        hatchPattern: false, fontSize: false, fontColor: false, fontFamily: false,
        fontWeight: false, fontStyle: false, haloRadius: false, haloColor: false
    };

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(sldBody, 'text/xml');

        if (doc.querySelector('parsererror')) {
            console.error('[SLD Parse] XML invalid, trying regex fallback');
            return parseSLDFallback(sldBody);
        }

        const hasPolygon = doc.getElementsByTagNameNS('*', 'PolygonSymbolizer').length > 0;
        const hasLine = doc.getElementsByTagNameNS('*', 'LineSymbolizer').length > 0;
        const hasPoint = doc.getElementsByTagNameNS('*', 'PointSymbolizer').length > 0;
        const hasText = doc.getElementsByTagNameNS('*', 'TextSymbolizer').length > 0;

        // ══ Polygon ══════════════════════════════════════════════════
        if (hasPolygon) {
            const polyEl = doc.getElementsByTagNameNS('*', 'PolygonSymbolizer')[0];

            // Fill — check for hatch (GraphicFill) first
            const fillEl = getEl(polyEl, 'Fill');
            const graphicFillEl = fillEl ? getEl(fillEl, 'GraphicFill') : null;

            if (graphicFillEl) {
                // Hatch pattern
                const markEl = getEl(graphicFillEl, 'Mark');
                const wkn = getTagText(markEl, 'WellKnownName');
                if (wkn) { props.hatchPattern = wkn; availableProps.hatchPattern = true; }

                // Color = stroke of the inner Mark
                const markStrokeEl = getEl(markEl, 'Stroke');
                const col = getParam(markStrokeEl, 'stroke');
                if (col) { props.fill = col; availableProps.fill = true; }

                // Opacity = stroke-opacity of the inner Mark's Stroke
                const op = getParam(markStrokeEl, 'stroke-opacity');
                if (op !== null) { props.fillOpacity = parseFloat(op); availableProps.fillOpacity = true; }
            } else if (fillEl) {
                // Solid fill
                const col = getParam(fillEl, 'fill');
                if (col) { props.fill = col; availableProps.fill = true; }
                const op = getParam(fillEl, 'fill-opacity');
                if (op !== null) { props.fillOpacity = parseFloat(op); availableProps.fillOpacity = true; }
            }

            // Polygon outline Stroke (direct child of PolygonSymbolizer)
            const strokeEl = getEls(polyEl, 'Stroke').find(s => s.parentNode === polyEl);
            if (strokeEl) {
                const col = getParam(strokeEl, 'stroke');
                if (col) { props.stroke = col; availableProps.stroke = true; }
                const sw = getParam(strokeEl, 'stroke-width');
                if (sw !== null) { props.strokeWidth = parseFloat(sw); availableProps.strokeWidth = true; }
                const so = getParam(strokeEl, 'stroke-opacity');
                if (so !== null) { props.strokeOpacity = parseFloat(so); }
                const da = getParam(strokeEl, 'stroke-dasharray');
                if (da) {
                    props.strokeDasharray = da.toString().split(/[,\s]+/)
                        .map(n => parseFloat(n).toString())
                        .filter(n => n !== 'NaN' && n !== '')
                        .join(' ');
                    availableProps.strokeDasharray = true;
                }
                const lc = getParam(strokeEl, 'stroke-linecap');
                if (lc) { props.strokeLinecap = lc; }
                const lj = getParam(strokeEl, 'stroke-linejoin');
                if (lj) { props.strokeLinejoin = lj; }
            }
        }

        // ══ Point ═════════════════════════════════════════════════════
        if (hasPoint && !hasPolygon) {
            const pointEl = doc.getElementsByTagNameNS('*', 'PointSymbolizer')[0];
            const markEl = getEl(pointEl, 'Mark');
            if (markEl) {
                const fillEl = getEl(markEl, 'Fill');
                const col = getParam(fillEl, 'fill');
                if (col) { props.fill = col; availableProps.fill = true; }
                const op = getParam(fillEl, 'fill-opacity');
                if (op !== null) { props.fillOpacity = parseFloat(op); availableProps.fillOpacity = true; }
                const strokeEl = getEl(markEl, 'Stroke');
                const sc = getParam(strokeEl, 'stroke');
                if (sc) { props.stroke = sc; availableProps.stroke = true; }
                const sw = getParam(strokeEl, 'stroke-width');
                if (sw !== null) { props.strokeWidth = parseFloat(sw); availableProps.strokeWidth = true; }
            }
            const wkn = getTagText(pointEl, 'WellKnownName');
            if (wkn) { props.wellKnownName = wkn; availableProps.wellKnownName = true; }
            const size = getTagText(pointEl, 'Size');
            if (size) { props.size = parseFloat(size); availableProps.size = true; }
            const rot = getTagText(pointEl, 'Rotation');
            if (rot) { props.rotation = parseFloat(rot); availableProps.rotation = true; }
            const ogcRes = getEl(pointEl, 'OnlineResource');
            if (ogcRes) {
                const href = ogcRes.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ogcRes.getAttribute('xlink:href');
                if (href) { props.externalGraphicUrl = href; availableProps.externalGraphicUrl = true; }
            }
        }

        // ══ Line ══════════════════════════════════════════════════════
        if (hasLine && !hasPolygon) {
            const lineEl = doc.getElementsByTagNameNS('*', 'LineSymbolizer')[0];
            const strokeEl = getEl(lineEl, 'Stroke');
            if (strokeEl) {
                const col = getParam(strokeEl, 'stroke');
                if (col) { props.stroke = col; availableProps.stroke = true; }
                const sw = getParam(strokeEl, 'stroke-width');
                if (sw !== null) { props.strokeWidth = parseFloat(sw); availableProps.strokeWidth = true; }
                const da = getParam(strokeEl, 'stroke-dasharray');
                if (da) {
                    props.strokeDasharray = da.toString().split(/[,\s]+/)
                        .map(n => parseFloat(n).toString())
                        .filter(n => n !== 'NaN' && n !== '')
                        .join(' ');
                    availableProps.strokeDasharray = true;
                }
            }
        }

        // ══ Text (Label) ══════════════════════════════════════════════
        if (hasText) {
            // Only parse from our generated GeneratedLabelRule
            const allRules = getEls(doc, 'Rule');
            const labelRule = allRules.find(r => {
                const titleEl = getEl(r, 'Title');
                return titleEl?.textContent?.trim() === 'GeneratedLabelRule';
            });
            const textEl = labelRule ? getEl(labelRule, 'TextSymbolizer') : doc.getElementsByTagNameNS('*', 'TextSymbolizer')[0];

            const labelEl = getEl(textEl, 'Label');
            if (labelEl) {
                const propName = getEl(labelEl, 'PropertyName');
                if (propName) {
                    props.labelAttribute = propName.textContent.trim();
                    availableProps.labelAttribute = true;
                }
            }
            const fontEl = getEl(textEl, 'Font');
            if (fontEl) {
                const ff = getParam(fontEl, 'font-family');
                if (ff) { props.fontFamily = ff; availableProps.fontFamily = true; }
                const fs = getParam(fontEl, 'font-size');
                if (fs) { props.fontSize = parseFloat(fs); availableProps.fontSize = true; }
                const fw = getParam(fontEl, 'font-weight');
                if (fw) { props.fontWeight = fw; availableProps.fontWeight = true; }
                const fst = getParam(fontEl, 'font-style');
                if (fst) { props.fontStyle = fst; availableProps.fontStyle = true; }
            }
            // Font color — Fill directly under TextSymbolizer
            const textFills = getEls(textEl, 'Fill').filter(f => f.parentNode === textEl);
            if (textFills.length > 0) {
                const fc = getParam(textFills[0], 'fill');
                if (fc) { props.fontColor = fc; availableProps.fontColor = true; }
            }

            // Scale-based label
            if (labelRule) {
                const maxScaleEl = getEl(labelRule, 'MaxScaleDenominator');
                if (maxScaleEl) {
                    const scale = parseFloat(maxScaleEl.textContent);
                    if (scale > 0) {
                        props.minZoom = Math.round(Math.log2(559082264 / scale));
                        props.staticLabel = false;
                    }
                } else {
                    props.staticLabel = true;
                }
            } else {
                props.staticLabel = true;
            }
        }

        // ══ VendorOptions ════════════════════════════════════════════════
        for (const vo of getEls(doc, 'VendorOption')) {
            const name = vo.getAttribute('name');
            if (name === 'group') props.preventDuplicates = vo.textContent.trim() === 'yes';
            if (name === 'repeat') props.labelRepeat = parseInt(vo.textContent.trim()) || 0;
        }

        // ══ availableProps gates based on symbolizer type ════════════════
        if (hasPolygon || (!hasPoint && !hasLine)) {
            availableProps.fill = true; availableProps.fillOpacity = true;
            availableProps.stroke = true; availableProps.strokeWidth = true;
            availableProps.strokeDasharray = true; availableProps.hatchPattern = true;
        }
        if (hasLine && !hasPolygon) {
            availableProps.stroke = true; availableProps.strokeWidth = true;
            availableProps.strokeDasharray = true; availableProps.strokeLinecap = true;
            availableProps.strokeLinejoin = true;
        }
        if (hasPoint) {
            availableProps.size = true; availableProps.wellKnownName = true;
            availableProps.stroke = true; availableProps.fill = true;
            availableProps.externalGraphicUrl = true; availableProps.rotation = true;
        }
        if (hasText) {
            availableProps.fontSize = true; availableProps.haloRadius = true;
            availableProps.fontColor = true; availableProps.fontFamily = true;
            availableProps.fontWeight = true; availableProps.fontStyle = true;
        }

    } catch (err) {
        console.error('[SLD Parse] Error:', err);
        return parseSLDFallback(sldBody);
    }

    return { props, availableProps };
};


// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE REGEX FALLBACK (last resort)
// ─────────────────────────────────────────────────────────────────────────────

const parseSLDFallback = (sldBody) => {
    const props = {
        fill: '#cccccc', fillOpacity: 1, stroke: '#333333', strokeWidth: 1, strokeOpacity: 1,
        strokeDasharray: null, strokeLinecap: 'butt', strokeLinejoin: 'miter',
        size: 10, rotation: 0, wellKnownName: 'circle', externalGraphicUrl: '', hatchPattern: '',
        fontSize: 12, fontColor: '#000000', fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal',
        haloRadius: 1, haloColor: '#ffffff', staticLabel: true, minZoom: 14, preventDuplicates: true, labelRepeat: 0, labelAttribute: ''
    };
    const availableProps = {
        fill: true, fillOpacity: true, stroke: true, strokeWidth: true,
        strokeOpacity: false, strokeDasharray: true, strokeLinecap: false, strokeLinejoin: false,
        size: false, rotation: false, wellKnownName: false, externalGraphicUrl: false,
        hatchPattern: true, fontSize: false, fontColor: false, fontFamily: false,
        fontWeight: false, fontStyle: false, haloRadius: false, haloColor: false
    };
    const get = (n) => {
        const m = sldBody.match(new RegExp(`<(?:[\\w-]*:)?(?:Css|Svg)Parameter[^>]*name=["']${n}["'][^>]*>([\\s\\S]*?)</`, 'i'));
        return m ? m[1].trim() : null;
    };
    const v = get('fill'); if (v) props.fill = v;
    const fo = get('fill-opacity'); if (fo) props.fillOpacity = parseFloat(fo);
    const s = get('stroke'); if (s) props.stroke = s;
    const sw = get('stroke-width'); if (sw) props.strokeWidth = parseFloat(sw);
    const da = get('stroke-dasharray');
    if (da) {
        props.strokeDasharray = da.toString().split(/[,\s]+/)
            .map(n => parseFloat(n).toString())
            .filter(n => n !== 'NaN' && n !== '')
            .join(' ');
    }
    return { props, availableProps };
};


// ─────────────────────────────────────────────────────────────────────────────
// APPLY STYLE CHANGES — DOM-based so Fill/Stroke targets are precise
// ─────────────────────────────────────────────────────────────────────────────

export const applyStyleChanges = (sldBody, props) => {
    console.log('[StyleUtils] Applying changes:', props);

    const paramTag = detectParamTag(sldBody);

    // Parse into DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(sldBody, 'text/xml');

    if (doc.querySelector('parsererror')) {
        console.error('[ApplySLD] Failed to parse SLD XML');
        return sldBody; // Return original if we can't parse
    }

    const hasPolygon = doc.getElementsByTagNameNS('*', 'PolygonSymbolizer').length > 0;
    const hasLine = doc.getElementsByTagNameNS('*', 'LineSymbolizer').length > 0;
    const hasPoint = doc.getElementsByTagNameNS('*', 'PointSymbolizer').length > 0;

    // ── Strip scale denominators ──────────────────────────────────────────────
    for (const el of [...getEls(doc, 'MinScaleDenominator'), ...getEls(doc, 'MaxScaleDenominator')]) {
        el.parentNode?.removeChild(el);
    }

    const isPattern = props.hatchPattern && props.hatchPattern !== '' && props.hatchPattern !== 'outline';
    const isOutline = props.hatchPattern === 'outline';

    // ── Polygon ───────────────────────────────────────────────────────────────
    if (hasPolygon) {
        const polyEl = doc.getElementsByTagNameNS('*', 'PolygonSymbolizer')[0];

        // ── Fill (inside PolygonSymbolizer) ───────────────────────────────
        let fillEl = getEls(polyEl, 'Fill').find(f => f.parentNode === polyEl);

        if (isOutline) {
            // Remove fill entirely
            if (fillEl) fillEl.parentNode.removeChild(fillEl);
        } else if (isPattern) {
            // Build a GraphicFill structure
            const pTag = paramTag;
            const ns = polyEl.namespaceURI ?? '';
            const prefix = polyEl.prefix ? `${polyEl.prefix}:` : '';

            const newFillXml = `<${prefix}Fill xmlns="${ns}"><${prefix}GraphicFill><${prefix}Graphic><${prefix}Mark><${prefix}WellKnownName>${props.hatchPattern}</${prefix}WellKnownName><${prefix}Stroke><${prefix}${pTag} name="stroke">${props.fill || '#000000'}</${prefix}${pTag}><${prefix}${pTag} name="stroke-width">1</${prefix}${pTag}><${prefix}${pTag} name="stroke-opacity">${props.fillOpacity !== undefined ? props.fillOpacity : 1}</${prefix}${pTag}></${prefix}Stroke></${prefix}Mark><${prefix}Size>8</${prefix}Size></${prefix}Graphic></${prefix}GraphicFill></${prefix}Fill>`;

            const tempDoc = parser.parseFromString(newFillXml, 'text/xml');
            const newFillEl = doc.importNode(tempDoc.documentElement, true);

            if (fillEl) {
                polyEl.replaceChild(newFillEl, fillEl);
            } else {
                // Insert before Stroke (schema compliance)
                const strokeEl = getEls(polyEl, 'Stroke').find(s => s.parentNode === polyEl);
                if (strokeEl) polyEl.insertBefore(newFillEl, strokeEl);
                else polyEl.appendChild(newFillEl);
            }
            fillEl = newFillEl;
        } else {
            // Solid Fill
            const gfEl = fillEl ? getEl(fillEl, 'GraphicFill') : null;

            if (gfEl) {
                // Transitioning from pattern to solid — rebuild fill element
                const ns = polyEl.namespaceURI ?? '';
                const prefix = polyEl.prefix ? `${polyEl.prefix}:` : '';
                const pTag = paramTag;
                const op = props.fillOpacity !== undefined ? props.fillOpacity : 1;

                const newFillXml = `<${prefix}Fill xmlns="${ns}"><${prefix}${pTag} name="fill">${props.fill || '#cccccc'}</${prefix}${pTag}><${prefix}${pTag} name="fill-opacity">${op}</${prefix}${pTag}></${prefix}Fill>`;
                const tempDoc = parser.parseFromString(newFillXml, 'text/xml');
                const newFillEl = doc.importNode(tempDoc.documentElement, true);

                if (fillEl) polyEl.replaceChild(newFillEl, fillEl);
                else polyEl.appendChild(newFillEl);
                fillEl = newFillEl;
            } else {
                // Update existing solid fill params or create fill element
                if (!fillEl) {
                    const ns = polyEl.namespaceURI ?? '';
                    const prefix = polyEl.prefix ? `${polyEl.prefix}:` : '';
                    fillEl = doc.createElementNS(ns, `${prefix}Fill`);
                    const strokeEl = getEls(polyEl, 'Stroke').find(s => s.parentNode === polyEl);
                    if (strokeEl) polyEl.insertBefore(fillEl, strokeEl);
                    else polyEl.appendChild(fillEl);
                }
                if (props.fill !== undefined) setDomParam(doc, fillEl, 'fill', props.fill, paramTag);
                if (props.fillOpacity !== undefined) setDomParam(doc, fillEl, 'fill-opacity', props.fillOpacity, paramTag);
            }
        }

        // ── Stroke (DIRECT child of PolygonSymbolizer only) ───────────────
        let strokeEl = getEls(polyEl, 'Stroke').find(s => s.parentNode === polyEl);
        if (!strokeEl) {
            const ns = polyEl.namespaceURI ?? '';
            const prefix = polyEl.prefix ? `${polyEl.prefix}:` : '';
            strokeEl = doc.createElementNS(ns, `${prefix}Stroke`);
            polyEl.appendChild(strokeEl);
        }
        if (props.stroke !== undefined) setDomParam(doc, strokeEl, 'stroke', props.stroke, paramTag);
        if (props.strokeWidth !== undefined) setDomParam(doc, strokeEl, 'stroke-width', props.strokeWidth, paramTag);
        if (props.strokeOpacity !== undefined) setDomParam(doc, strokeEl, 'stroke-opacity', props.strokeOpacity, paramTag);
        if (props.strokeDasharray === null || props.strokeDasharray === '') {
            removeDomParam(strokeEl, 'stroke-dasharray');
        } else if (props.strokeDasharray) {
            setDomParam(doc, strokeEl, 'stroke-dasharray', props.strokeDasharray, paramTag);
        }
        if (props.strokeLinecap) setDomParam(doc, strokeEl, 'stroke-linecap', props.strokeLinecap, paramTag);
        if (props.strokeLinejoin) setDomParam(doc, strokeEl, 'stroke-linejoin', props.strokeLinejoin, paramTag);
    }

    // ── Line ──────────────────────────────────────────────────────────────────
    if (hasLine) {
        const lineEl = doc.getElementsByTagNameNS('*', 'LineSymbolizer')[0];
        const strokeEl = getEl(lineEl, 'Stroke');
        if (strokeEl) {
            if (props.stroke !== undefined) setDomParam(doc, strokeEl, 'stroke', props.stroke, paramTag);
            if (props.strokeWidth !== undefined) setDomParam(doc, strokeEl, 'stroke-width', props.strokeWidth, paramTag);
            if (props.strokeDasharray === null || props.strokeDasharray === '') {
                removeDomParam(strokeEl, 'stroke-dasharray');
            } else if (props.strokeDasharray) {
                setDomParam(doc, strokeEl, 'stroke-dasharray', props.strokeDasharray, paramTag);
            }
        }
    }

    // ── Point ─────────────────────────────────────────────────────────────────
    if (hasPoint) {
        const pointEl = doc.getElementsByTagNameNS('*', 'PointSymbolizer')[0];
        setDomTagText(getEl(pointEl, 'WellKnownName'), props.wellKnownName);
        setDomTagText(getEl(pointEl, 'Size'), props.size);
        setDomTagText(getEl(pointEl, 'Rotation'), props.rotation);
        const markEl = getEl(pointEl, 'Mark');
        const fillEl = getEl(markEl, 'Fill');
        if (fillEl && props.fill !== undefined) setDomParam(doc, fillEl, 'fill', props.fill, paramTag);
        const strokeEl = getEl(markEl, 'Stroke');
        if (strokeEl && props.stroke !== undefined) setDomParam(doc, strokeEl, 'stroke', props.stroke, paramTag);
    }

    // ── Labels ────────────────────────────────────────────────────────────────
    // Safely remove managed label rule (snapshot array first to avoid live-collection mutation)
    const allRulesForRemoval = Array.from(doc.getElementsByTagNameNS('*', 'Rule'));
    for (const rule of allRulesForRemoval) {
        const titleEl = getEl(rule, 'Title');
        if (titleEl?.textContent?.trim() === 'GeneratedLabelRule') {
            rule.parentNode?.removeChild(rule);
        }
    }

    if (props.labelAttribute) {
        const ftsEl = doc.getElementsByTagNameNS('*', 'FeatureTypeStyle')[0];
        if (ftsEl) {
            // Detect namespace info from existing SLD elements to ensure consistency
            const sldNs = ftsEl.namespaceURI || 'http://www.opengis.net/sld';
            const ogcNs = 'http://www.opengis.net/ogc';

            // Build using DOM API directly — avoids ALL namespace/prefix parsing issues
            const createSldEl = (localName) => doc.createElementNS(sldNs, localName);
            const createOgcEl = (localName) => doc.createElementNS(ogcNs, localName);
            const createParam = (name, value) => {
                const el = createSldEl(paramTag);
                el.setAttribute('name', name);
                el.textContent = String(value);
                return el;
            };

            // <Rule>
            const ruleEl = createSldEl('Rule');

            // <Title>GeneratedLabelRule</Title>
            const titleEl = createSldEl('Title');
            titleEl.textContent = 'GeneratedLabelRule';
            ruleEl.appendChild(titleEl);

            // <TextSymbolizer>
            const textEl = createSldEl('TextSymbolizer');

            // <Label><ogc:PropertyName>attr</ogc:PropertyName></Label>
            const labelEl = createSldEl('Label');
            const propNameEl = createOgcEl('PropertyName');
            propNameEl.textContent = props.labelAttribute;
            labelEl.appendChild(propNameEl);
            textEl.appendChild(labelEl);

            // <Font>
            const fontEl = createSldEl('Font');
            fontEl.appendChild(createParam('font-family', 'Arial'));
            fontEl.appendChild(createParam('font-size', props.fontSize || 12));
            fontEl.appendChild(createParam('font-style', props.fontStyle || 'normal'));
            fontEl.appendChild(createParam('font-weight', props.fontWeight || 'normal'));
            textEl.appendChild(fontEl);

            // <LabelPlacement><PointPlacement><AnchorPoint>
            const placementEl = createSldEl('LabelPlacement');
            const pointPlaceEl = createSldEl('PointPlacement');
            const anchorEl = createSldEl('AnchorPoint');
            const axEl = createSldEl('AnchorPointX'); axEl.textContent = '0.5'; anchorEl.appendChild(axEl);
            const ayEl = createSldEl('AnchorPointY'); ayEl.textContent = '0.5'; anchorEl.appendChild(ayEl);
            pointPlaceEl.appendChild(anchorEl);
            placementEl.appendChild(pointPlaceEl);
            textEl.appendChild(placementEl);

            // <Fill><CssParameter name="fill">#000000</CssParameter></Fill>
            const fillEl = createSldEl('Fill');
            fillEl.appendChild(createParam('fill', props.fontColor || '#000000'));
            textEl.appendChild(fillEl);

            // VendorOptions
            const addVendor = (name, value) => {
                const vo = createSldEl('VendorOption');
                vo.setAttribute('name', name);
                vo.textContent = String(value);
                textEl.appendChild(vo);
            };
            addVendor('group', 'yes');
            addVendor('spaceAround', '10');

            ruleEl.appendChild(textEl);
            ftsEl.appendChild(ruleEl);
        }
    }

    // Serialize back to string
    let result = serializeDoc(doc);

    // Clean up the xmlns="" that XMLSerializer may add
    result = result.replace(/\s*xmlns=""/g, '');
    // Ensure xml declaration is present
    if (!result.startsWith('<?xml')) {
        result = '<?xml version="1.0" encoding="UTF-8"?>\n' + result;
    }

    return result;
};
