import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Map as MapIcon } from 'lucide-react';

// Import Basemap Images directly for Vite
import osmImg from '../../assets/images/basemaps/osm.png';
import satelliteImg from '../../assets/images/basemaps/satellite.png';
import terrainImg from '../../assets/images/basemaps/terrain.png';
import darkImg from '../../assets/images/basemaps/dark.png';
import lightImg from '../../assets/images/basemaps/light.png';
import navigationImg from '../../assets/images/basemaps/navigation.png';

const BaseMapSelector = ({ baseLayer, setBaseLayer }) => {
    return (
        <div className="panel-section">
            <div className="panel-section-title">Base Map Style</div>
            <div className="layer-grid basemaps-minimal">
                {[
                    { id: 'osm', name: 'Street Map', img: osmImg, tip: 'Default street map' },
                    { id: 'satellite', name: 'Satellite', img: satelliteImg, tip: 'Aerial imagery' },
                    { id: 'terrain', name: 'Topo', img: terrainImg, tip: 'Topographic terrain' },
                    { id: 'dark', name: 'Dark', img: darkImg, tip: 'Night-optimized map' },
                    { id: 'light', name: 'Light', img: lightImg, tip: 'Clean light map' },
                    { id: 'street', name: 'Navigation', img: navigationImg, tip: 'Driving-optimized view' },
                ].map((layer) => (
                    <Tooltip.Root key={layer.id}>
                        <Tooltip.Trigger asChild>
                            <div
                                className={`layer-card minimal-card ${baseLayer === layer.id ? 'active' : ''}`}
                                onClick={() => setBaseLayer(layer.id)}
                            >
                                <div className="card-image-wrapper">
                                    <img src={layer.img} alt={layer.name} />
                                    <div className="card-overlay">
                                        <span className="card-name">{layer.name}</span>
                                        {baseLayer === layer.id && (
                                            <div className="card-status">
                                                <MapIcon size={12} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className="TooltipContent" sideOffset={5}>
                                {layer.tip}
                                <Tooltip.Arrow className="TooltipArrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                ))}
            </div>
        </div>
    );
};

export const useBaseMap = (mapInstanceRef, theme) => {
    const [baseLayer, setBaseLayer] = React.useState('osm');

    React.useEffect(() => {
        setBaseLayer(theme === 'dark' ? 'dark' : 'osm');
    }, [theme]);

    React.useEffect(() => {
        if (!mapInstanceRef.current) return;
        const layers = mapInstanceRef.current.baseLayers;
        if (layers) {
            Object.keys(layers).forEach((key) => layers[key].setVisible(key === baseLayer));
        }
    }, [baseLayer, mapInstanceRef]);

    return { baseLayer, setBaseLayer };
};

export default BaseMapSelector;
