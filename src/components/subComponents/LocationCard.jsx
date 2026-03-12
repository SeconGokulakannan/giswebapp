import React from 'react';
import {
    MapPin,
    Search,
    Loader2
} from 'lucide-react';
import { useLocationTools } from '../../hooks/useLocationTools';

const LocationCard = ({
    activePanel,
}) => {
    const {
        gotoLat, setGotoLat,
        gotoLon, setGotoLon,
        isSearching,
        handleGoToLocation,
        handleSearch
    } = useLocationTools();

    if (activePanel !== 'location') return null;

    return (
        <div className="panel-section">
            <div className="panel-section-title" style={{ marginTop: '24px' }}>Coordinates</div>
            <div className="form-group-elite">
                <div className="elite-input-wrapper">
                    <label className="elite-label">Latitude</label>
                    <input
                        type="number"
                        className="elite-input"
                        placeholder="e.g., 12.9716"
                        value={gotoLat}
                        onChange={(e) => setGotoLat(e.target.value)}
                    />
                </div>
                <div className="elite-input-wrapper">
                    <label className="elite-label">Longitude</label>
                    <input
                        type="number"
                        className="elite-input"
                        placeholder="e.g., 77.5946"
                        value={gotoLon}
                        onChange={(e) => setGotoLon(e.target.value)}
                    />
                </div>
            </div>

            <button
                className="elite-primary-button"
                style={{ width: '100%', marginTop: '16px' }}
                onClick={handleGoToLocation}
            >
                <MapPin size={16} />
                <span>Go to Location</span>
            </button>

            <div className="panel-divider" style={{ margin: '24px 0' }} />

            <div className="panel-section-title">Search Address</div>
            <div className="search-bar-elite">
                <input
                    type="text"
                    className="elite-input search-input"
                    placeholder="Search for places..."
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearch(e.target.value);
                    }}
                />
                <button
                    className="search-submit-btn"
                    onClick={(e) => {
                        const input = e.currentTarget.previousSibling;
                        handleSearch(input.value);
                    }}
                    disabled={isSearching}
                >
                    {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
            </div>
            <p className="search-hint">Enter a city, landmark, or address</p>
        </div>
    );
};

export default LocationCard;
