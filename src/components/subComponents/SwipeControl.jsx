import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GripVertical } from 'lucide-react';
import VectorLayer from 'ol/layer/Vector';

const SwipeControl = ({ position, onPositionChange }) => {
    return (
        <div
            className="swipe-control-container"
            style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${position}%`,
                width: '4px',
                background: 'rgba(255, 255, 255, 0.8)',
                boxShadow: '0 0 10px rgba(0,0,0,0.3)',
                zIndex: 100, // Above map, below panels
                cursor: 'ew-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'none' // Smooth dragging
            }}
            onMouseDown={(e) => {
                const handleMouseMove = (moveEvent) => {
                    const mapRect = e.target.parentElement.getBoundingClientRect();
                    const newX = moveEvent.clientX - mapRect.left;
                    const newPercentage = Math.min(Math.max((newX / mapRect.width) * 100, 0), 100);
                    onPositionChange(newPercentage);
                };

                const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            }}
        >
            <div
                style={{
                    width: '32px',
                    height: '32px',
                    background: 'var(--color-primary)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    transform: 'translateY(-50%)',
                    position: 'absolute',
                    top: '50%'
                }}
            >
                <GripVertical size={18} />
            </div>
        </div>
    );
};

/**
 * Hook to manage Swipe tool logic (clipping).
 */
export const useSwipeTool = (mapInstanceRef, operationalLayersRef, geoServerLayers, localVectorLayers, handleToggleGeoLayer) => {
    const [swipeLayerIds, setSwipeLayerIds] = useState([]);
    const [swipePosition, setSwipePosition] = useState(50);
    const swipeLayersRef = useRef(new Map());

    const handleToggleSwipe = useCallback((layerId) => {
        setSwipeLayerIds(prev => {
            const isSelected = prev.includes(layerId);
            if (isSelected) {
                return prev.filter(id => id !== layerId);
            } else {
                const layerData = [...geoServerLayers, ...localVectorLayers].find(l => l.id === layerId);
                if (layerData && !layerData.visible && handleToggleGeoLayer) {
                    handleToggleGeoLayer(layerId);
                }
                return [...prev, layerId];
            }
        });
    }, [geoServerLayers, localVectorLayers, handleToggleGeoLayer]);

    const handleToggleSwipeAll = useCallback((turnOn) => {
        if (turnOn) {
            const visibleLayers = geoServerLayers.filter(l => l.visible);
            setSwipeLayerIds(visibleLayers.map(l => l.id));
        } else {
            setSwipeLayerIds([]);
        }
    }, [geoServerLayers]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        const activeIds = Array.isArray(swipeLayerIds) ? swipeLayerIds : [];
        const layersToClip = [];

        activeIds.forEach(id => {
            const olLayer = operationalLayersRef.current[id];
            if (olLayer) {
                layersToClip.push(olLayer);
            }
        });

        const newMap = new Map();
        layersToClip.forEach(layer => {
            const id = Object.keys(operationalLayersRef.current).find(key => operationalLayersRef.current[key] === layer);
            if (id) newMap.set(id, layer);
        });
        swipeLayersRef.current = newMap;

        if (layersToClip.length === 0) {
            map.render();
            return;
        }

        const handlePreRender = (event) => {
            const ctx = event.context;
            const width = ctx.canvas.width * (swipePosition / 100);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, width, ctx.canvas.height);
            ctx.clip();
        };

        const handlePostRender = (event) => {
            const ctx = event.context;
            ctx.restore();
        };

        layersToClip.forEach((layer) => {
            layer.on('prerender', handlePreRender);
            layer.on('postrender', handlePostRender);
            if (layer instanceof VectorLayer) {
                layer.changed();
            } else {
                layer.getSource().changed();
            }
        });

        map.render();

        return () => {
            layersToClip.forEach((layer) => {
                layer.un('prerender', handlePreRender);
                layer.un('postrender', handlePostRender);
                if (layer instanceof VectorLayer) {
                    layer.changed();
                } else {
                    layer.getSource().changed();
                }
            });
            map.render();
        };
    }, [swipeLayerIds, swipePosition, geoServerLayers, localVectorLayers, mapInstanceRef, operationalLayersRef]);

    return {
        swipeLayerIds,
        setSwipeLayerIds,
        swipePosition,
        setSwipePosition,
        handleToggleSwipe,
        handleToggleSwipeAll
    };
};

export default SwipeControl;
