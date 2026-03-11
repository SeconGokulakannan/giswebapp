import { useState, useCallback } from 'react';
import { fromLonLat } from 'ol/proj';
import toast from 'react-hot-toast';

const searchLocation = async (query) => {
  if (!query) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'EliteGIS/1.0' } });
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lon: parseFloat(data[0].lon),
        lat: parseFloat(data[0].lat),
      };
    }
  } catch (error) {
    console.error('Location search failed:', error);
    toast.error('Location search failed. Please try again.');
  }
  return null;
};

export const useLocationTools = (mapInstanceRef, drawingTools) => {
    const [gotoLat, setGotoLat] = useState('');
    const [gotoLon, setGotoLon] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleGoToLocation = useCallback(() => {
        if (!mapInstanceRef.current) return;
        const lat = parseFloat(gotoLat);
        const lon = parseFloat(gotoLon);

        if (isNaN(lat) || isNaN(lon)) {
            toast.error('Please enter valid coordinates');
            return;
        }

        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            toast.error('Coordinates out of range (Lat: -90 to 90, Lon: -180 to 180)');
            return;
        }

        mapInstanceRef.current.getView().animate({
            center: fromLonLat([lon, lat]),
            zoom: 12,
            duration: 1000,
        });

        if (drawingTools) {
            drawingTools.setActiveTool(null);
            drawingTools.removeInteractions();
        }
    }, [mapInstanceRef, gotoLat, gotoLon, drawingTools]);

    const handleSearch = useCallback(async (query) => {
        if (!mapInstanceRef.current || !query) return false;
        setIsSearching(true);
        try {
            const result = await searchLocation(query);
            if (result) {
                const view = mapInstanceRef.current.getView();

                // Elite fly-to animation
                view.animate({
                    center: fromLonLat([result.lon, result.lat]),
                    duration: 2000,
                    zoom: 14,
                });

                if (drawingTools) {
                    drawingTools.setActiveTool(null);
                    drawingTools.removeInteractions();
                }

                return true;
            }
            return false;
        } finally {
            setIsSearching(false);
        }
    }, [mapInstanceRef, drawingTools]);

    return {
        gotoLat, setGotoLat,
        gotoLon, setGotoLon,
        isSearching,
        handleGoToLocation,
        handleSearch
    };
};
