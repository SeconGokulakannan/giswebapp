import React from 'react';
import { Copyright } from 'lucide-react';
const MapStatusBar = ({ coordinates, zoom, scale }) => {
    return (
        <div className="status-bar">
            <div className="status-bar-content">
                <span className="status-link"><Copyright size={12} style={{ verticalAlign: 'middle' }} /> 2026 SECON Private Limited</span>
                <span className="status-link">
                    Lat - {coordinates?.lat?.toFixed?.(6) || '0.000000'} ° N
                </span>
                <span className="status-link">
                    Long - {coordinates?.lon?.toFixed?.(6) || '0.000000'} ° E
                </span>
                <span className="status-link">Zoom - {zoom}</span>
                <span className="status-link">Scale - {scale}</span>
            </div>
        </div>
    );
};

export default MapStatusBar;
