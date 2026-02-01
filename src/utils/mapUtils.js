import { Circle as CircleStyle, Fill, RegularShape, Stroke, Style, Text } from 'ol/style';
import { getArea, getLength } from 'ol/sphere';
import { LineString, Point } from 'ol/geom';

/* Elite Color System */
const COLORS = {
    primary: '#3b82f6',     // Electric Blue
    primaryGlow: 'rgba(59, 130, 246, 0.4)',
    accent: '#10b981',      // Emerald Green
    accentGlow: 'rgba(16, 185, 129, 0.3)',
    danger: '#ef4444',      // Laser Red
    vertex: '#ffffff',
    whiteGlow: 'rgba(255, 255, 255, 0.8)',
    distance: '#f59e0b',    // Amber for Distance
    area: '#8b5cf6',        // Violet for Area
};

/* Base Style for drawing and measurements */
export const style = new Style({
    fill: new Fill({ color: 'rgba(59, 130, 246, 0.08)' }),
    stroke: new Stroke({ color: COLORS.primary, width: 2.5 }),
    image: new CircleStyle({
        radius: 6,
        stroke: new Stroke({ color: COLORS.vertex, width: 2 }),
        fill: new Fill({ color: COLORS.primary }),
    }),
});

/* Energy Flow Styles (Layered) */
export const flowGlowStyle = new Style({
    stroke: new Stroke({
        color: COLORS.primaryGlow,
        width: 10,
    }),
});

export const flowPulseStyle = new Style({
    stroke: new Stroke({
        color: COLORS.whiteGlow,
        width: 2,
        lineDash: [10, 20],
    }),
});

/* Elite Label Style */
export const labelStyle = new Style({
    text: new Text({
        font: 'bold 12px "Inter", sans-serif',
        fill: new Fill({ color: '#ffffff' }),
        backgroundFill: new Fill({ color: 'rgba(17, 24, 39, 0.85)' }),
        padding: [5, 10, 5, 10],
        textBaseline: 'bottom',
        offsetY: -15,
        borderRadius: 6,
        stroke: new Stroke({ color: COLORS.primary, width: 1 }),
    }),
    image: new RegularShape({
        radius: 8,
        points: 3,
        angle: Math.PI,
        displacement: [0, 10],
        fill: new Fill({ color: COLORS.primary }),
    }),
});

/* Base segment style (blueprint) */
export const segmentStyle = new Style({
    text: new Text({
        font: '600 10px "Inter", sans-serif',
        fill: new Fill({ color: '#ffffff' }),
        backgroundFill: new Fill({ color: 'rgba(59, 130, 246, 0.9)' }),
        padding: [3, 6, 3, 6],
        textBaseline: 'bottom',
        offsetY: -12,
        borderRadius: 4,
    }),
});

/* PRECISION GIS UNIT CONVERSIONS */
const UNIT_FACTORS = {
    metric: { length: 1, area: 1, label: 'm', sub: 'km' },
    imperial: { length: 3.28084, area: 10.7639, label: 'ft', sub: 'mi' },
    miles: { length: 0.000621371, area: 0.000000386102, label: 'mi' },
    kilometers: { length: 0.001, area: 0.000001, label: 'km' },
    feet: { length: 3.28084, area: 10.7639, label: 'ft' },
    feet_us: { length: 3.2808333333333, area: 10.763867361111, label: 'ft (US)' },
    meters: { length: 1, area: 1, label: 'm' },
    yards: { length: 1.09361, area: 1.19599, label: 'yd' },
    nautical: { length: 0.000539957, area: 0.000000291553, label: 'nmi' },
};

export const formatLength = function (line, unitKey = 'metric') {
    const lengthMeters = getLength(line);
    const config = UNIT_FACTORS[unitKey] || UNIT_FACTORS.metric;

    let value, unit;

    // Auto-scaling for generic metric/imperial
    if (unitKey === 'metric') {
        if (lengthMeters >= 1000) {
            value = lengthMeters / 1000;
            unit = 'km';
        } else {
            value = lengthMeters;
            unit = 'm';
        }
    } else if (unitKey === 'imperial') {
        const feet = lengthMeters * 3.28084;
        if (feet >= 5280) {
            value = feet / 5280;
            unit = 'mi';
        } else {
            value = feet;
            unit = 'ft';
        }
    } else {
        // Precise requested unit
        value = lengthMeters * config.length;
        unit = config.label;
    }

    return Math.round(value * 100) / 100 + ' ' + unit;
};

export const formatArea = function (geometry, unitKey = 'metric') {
    let areaMeters;
    if (geometry.getType() === 'Circle') {
        areaMeters = Math.PI * Math.pow(geometry.getRadius(), 2);
    } else {
        areaMeters = getArea(geometry);
    }
    const config = UNIT_FACTORS[unitKey] || UNIT_FACTORS.metric;

    let value, unit;

    // Auto-scaling for generic metric/imperial
    if (unitKey === 'metric') {
        if (areaMeters >= 1000000) {
            value = areaMeters / 1000000;
            unit = 'km\xB2';
        } else {
            value = areaMeters;
            unit = 'm\xB2';
        }
    } else if (unitKey === 'imperial') {
        const sqFeet = areaMeters * 10.7639;
        if (sqFeet >= 27878400) {
            value = sqFeet / 27878400;
            unit = 'mi\xB2';
        } else {
            value = sqFeet;
            unit = 'ft\xB2';
        }
    } else {
        // Precise requested unit
        value = areaMeters * config.area;
        unit = config.label + '\xB2';
    }

    return Math.round(value * 100) / 100 + ' ' + unit;
};

/**
 * Elite Style Function with Animation Support
 * @param {Feature} feature Map feature
 * @param {boolean} segments Show segment lengths
 * @param {string} drawType Current interaction type
 * @param {string} tip Interaction hint
 * @param {number} offset Animation dash offset
 * @param {string} units Measurement units (standard key)
 */
export const styleFunction = (feature, segments, drawType, tip, offset = 0, units = 'metric') => {
    const styles = [];
    const geometry = feature.getGeometry();
    if (!geometry) return styles;

    const type = geometry.getType();
    let point, label, line;

    // ELITE RENDERING: Layered Flow
    if (type === 'LineString' || type === 'Polygon' || type === 'Circle') {
        const isArea = type === 'Polygon' || type === 'Circle';
        const color = isArea ? COLORS.area : COLORS.distance;

        // Base Glow
        styles.push(flowGlowStyle);

        // Primary Line
        const mainStyle = style.clone();
        mainStyle.getStroke().setColor(color);
        mainStyle.getFill().setColor(isArea ? 'rgba(139, 92, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)');
        styles.push(mainStyle);

        // Energy Flow Pulse (Animated)
        const pulseStyle = flowPulseStyle.clone();
        pulseStyle.getStroke().setLineDashOffset(offset);
        styles.push(pulseStyle);

        if (type === 'Polygon') {
            point = geometry.getInteriorPoint();
            label = formatArea(geometry, units);
            line = new LineString(geometry.getCoordinates()[0]);
        } else if (type === 'Circle') {
            point = new Point(geometry.getCenter());
            label = formatArea(geometry, units);
            line = null;
        } else {
            point = new Point(geometry.getLastCoordinate());
            label = formatLength(geometry, units);
            line = geometry;
        }
    } else if (type === 'Point') {
        styles.push(style);
    }

    // Check if feature is a Circle (either geometry type or tagged)
    const isCircle = type === 'Circle' || feature.get('isCircle');

    // Dynamic Segment Labels - Hide for Circles
    if (segments && line && !isCircle) {
        line.forEachSegment(function (a, b) {
            const segment = new LineString([a, b]);
            const labelValue = formatLength(segment, units);
            const segmentPoint = new Point(segment.getCoordinateAt(0.5));

            const localSegmentStyle = segmentStyle.clone();
            localSegmentStyle.setGeometry(segmentPoint);
            localSegmentStyle.getText().setText(labelValue);
            styles.push(localSegmentStyle);
        });
    }

    // High-Contrast Labels - Hide for Circles
    if (label && point && !isCircle) {
        const activeLabel = labelStyle.clone();
        activeLabel.setGeometry(point);
        activeLabel.getText().setText(label);
        styles.push(activeLabel);
    }

    // Interactive Tips
    if (tip && type === 'Point') {
        const activeTip = tipStyle.clone();
        activeTip.getText().setText(tip);
        styles.push(activeTip);
    }

    return styles;
};

export const tipStyle = new Style({
    text: new Text({
        font: '12px "Inter", sans-serif',
        fill: new Fill({ color: '#ffffff' }),
        backgroundFill: new Fill({ color: 'rgba(59, 130, 246, 0.7)' }),
        padding: [4, 8, 4, 8],
        textAlign: 'left',
        offsetX: 15,
        borderRadius: 4,
    }),
});

export const modifyStyle = new Style({
    image: new CircleStyle({
        radius: 8,
        stroke: new Stroke({ color: '#fff', width: 2 }),
        fill: new Fill({ color: COLORS.accent }),
    }),
});

/* GEOPROCESSING: Global Search */
export const searchLocation = async (query) => {
    if (!query) return null;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'EliteGIS/1.0' }
        });
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                lon: parseFloat(data[0].lon),
                lat: parseFloat(data[0].lat),
                display_name: data[0].display_name
            };
        }
    } catch (err) {
        console.error('Geocoding error:', err);
    }
    return null;
};
