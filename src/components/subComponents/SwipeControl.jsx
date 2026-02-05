import React from 'react';
import { GripVertical } from 'lucide-react';

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

export default SwipeControl;
