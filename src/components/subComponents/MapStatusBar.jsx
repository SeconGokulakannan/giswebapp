import React from 'react';

const MapStatusBar = ({ coordinates, zoom, scale }) => {
    return (
        <footer className="status-bar">
            <div className="status-bar-content">
                <div className="status-group">
                    <div className="status-item">
                        <span className="status-label">LON:</span>
                        <span className="status-value">{coordinates?.lon?.toFixed?.(6) || '0.000000'}</span>
                    </div>
                    <div className="status-item">
                        <span className="status-label">LAT:</span>
                        <span className="status-value">{coordinates?.lat?.toFixed?.(6) || '0.000000'}</span>
                    </div>
                </div>
                <div className="status-group">
                    <div className="status-item">
                        <span className="status-label">ZOOM:</span>
                        <span className="status-value">{zoom.toFixed(1)}</span>
                    </div>
                    <div className="status-item">
                        <span className="status-label">SCALE:</span>
                        <span className="status-value">{scale}</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default MapStatusBar;
