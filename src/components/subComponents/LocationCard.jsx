import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Search } from 'lucide-react';

const LocationCard = ({
    activePanel,
    gotoLat,
    setGotoLat,
    gotoLon,
    setGotoLon,
    handleGoToLocation,
    handleSearch,
    isSearching
}) => {
    const [locationTab, setLocationTab] = useState('coordinates'); // 'coordinates' or 'search'
    const [searchQuery, setSearchQuery] = useState('');

    // Reset location values when card is closed or switched
    useEffect(() => {
        if (activePanel !== 'location') {
            setSearchQuery('');
            setGotoLat('');
            setGotoLon('');
        }
    }, [activePanel, setGotoLat, setGotoLon]);

    const onSearchSubmit = async (e) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            const success = await handleSearch(searchQuery);
            if (!success) {
                toast.error('Location not found. Please try a different query.');
            }
        }
    };

    if (activePanel !== 'location') return null;

    return (
        <div className="panel-section fade-in">
            <div className="tabs-container">
                <button
                    className={`tab-btn ${locationTab === 'coordinates' ? 'active' : ''}`}
                    onClick={() => setLocationTab('coordinates')}
                >
                    Coordinates
                </button>
                <button
                    className={`tab-btn ${locationTab === 'search' ? 'active' : ''}`}
                    onClick={() => setLocationTab('search')}
                >
                    Find By Place
                </button>
            </div>

            {locationTab === 'coordinates' ? (
                <div className="location-tool">
                    <div className="input-group">
                        <label>Latitude (-90 to 90)</label>
                        <input
                            type="number"
                            className="coordinate-input"
                            placeholder="e.g. 51.5074"
                            value={gotoLat}
                            onChange={(e) => setGotoLat(e.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label>Longitude (-180 to 180)</label>
                        <input
                            type="number"
                            className="coordinate-input"
                            placeholder="e.g. -0.1278"
                            value={gotoLon}
                            onChange={(e) => setGotoLon(e.target.value)}
                        />
                    </div>
                    <button className="goto-btn" onClick={handleGoToLocation}>
                        Navigate to Location
                    </button>
                </div>
            ) : (
                <div className="search-tool-container">
                    <div className={`search-wrapper ${isSearching ? 'loading' : ''}`}>
                        {isSearching ? (
                            <Loader2 className="search-icon animate-spin" size={18} />
                        ) : (
                            <Search className="search-icon" size={18} />
                        )}
                        <input
                            type="text"
                            placeholder="Find a city, address or coordinate..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={onSearchSubmit}
                            className="elite-search-input"
                        />
                    </div>
                    <p className="search-hint">Press Enter to search</p>
                </div>
            )}
        </div>
    );
};

export default LocationCard;
