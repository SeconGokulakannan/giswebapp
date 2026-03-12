import React, { createContext, useContext, useRef, useState, useEffect } from 'react';

const MapContext = createContext(null);

export const MapProvider = ({ children }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const operationalLayersRef = useRef({});
    const vectorSourceRef = useRef(null);
    const selectionSourceRef = useRef(null);

    const [geoServerLayers, setGeoServerLayers] = useState([]);
    const [localVectorLayers, setLocalVectorLayers] = useState([]);
    const [isDrawingVisible, setIsDrawingVisible] = useState(true);
    const [isLocked, setIsLocked] = useState(false);
    const [layoutMode, setLayoutMode] = useState(() => {
        return localStorage.getItem('gis-layout-mode') || 'sidebar';
    });
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('gis-theme') || 'dark';
    });

    useEffect(() => {
        localStorage.setItem('gis-layout-mode', layoutMode);
    }, [layoutMode]);

    useEffect(() => {
        localStorage.setItem('gis-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const saveWorkspace = () => {
        const view = mapInstanceRef.current?.getView();
        if (view) {
            localStorage.setItem('gis_view', JSON.stringify({
                center: view.getCenter(),
                zoom: view.getZoom()
            }));
        }
    };

    const value = {
        mapRef,
        mapInstanceRef,
        operationalLayersRef,
        geoServerLayers,
        setGeoServerLayers,
        localVectorLayers,
        setLocalVectorLayers,
        isLocked,
        setIsLocked,
        layoutMode,
        setLayoutMode,
        theme,
        setTheme,
        vectorSourceRef,
        selectionSourceRef,
        isDrawingVisible,
        setIsDrawingVisible,
        saveWorkspace
    };

    return (
        <MapContext.Provider value={value}>
            {children}
        </MapContext.Provider>
    );
};

export const useMap = () => {
    const context = useContext(MapContext);
    if (!context) {
        throw new Error('useMap must be used within a MapProvider');
    }
    return context;
};
