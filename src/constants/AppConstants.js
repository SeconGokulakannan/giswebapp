import { GEOSERVER_URL, AUTH_HEADER, WORKSPACE } from '../services/ServerCredentials';

/**
 * AppConstants.js
 * Central location for application-wide constants and enumerations.
 * Keeps the code clean and easy to maintain.
 */

export { GEOSERVER_URL, AUTH_HEADER, WORKSPACE };

// Standard preset colors used across various tools (Styles, Analysis, Spatial Join)
export const PRESET_COLORS = [
    '#22c55e', // Green
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#64748b'  // Slate
];

// Solid colors for drawing tools
export const DRAWING_SOLID_COLORS = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
    '#ec4899', '#14b8a6', '#84cc16', '#f97316', '#06b6d4'
];

// Map Defaults
export const MAP_DEFAULT_CENTER = [0, 20];
export const MAP_DEFAULT_ZOOM = 2;

// Common Query Builder Operators
export const QB_OPERATORS = [
    { value: '=', label: 'Equals (=)' },
    { value: '<>', label: 'Not Equals (<>)' },
    { value: '>', label: 'Greater Than (>)' },
    { value: '<', label: 'Less Than (<)' },
    { value: '>=', label: 'Greater or Equal (>=)' },
    { value: '<=', label: 'Less or Equal (<=)' },
    { value: 'LIKE', label: 'Contains (LIKE)' },
    { value: 'ILIKE', label: 'Case-Insensitive (ILIKE)' },
];

// Analysis Comparison Operators
export const ANALYSIS_OPERATORS = [
    { value: '=', label: 'Equals' },
    { value: '!=', label: 'Not Equals' },
    { value: '>', label: 'Greater Than' },
    { value: '<', label: 'Less Than' },
    { value: '>=', label: 'Greater or Equal' },
    { value: '<=', label: 'Less or Equal' },
    { value: 'LIKE', label: 'Contains' }
];

// Layout Modes
export const LAYOUT_MODES = {
    SIDEBAR: 'sidebar',
    TOPBAR: 'topbar'
};
