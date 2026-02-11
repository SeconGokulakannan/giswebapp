import React, { useState } from 'react';
import { X, Plus, Trash2, Database, Layers, Loader2, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const CreateLayerCard = ({ isOpen, onClose, onPublish }) => {
    const [layerName, setLayerName] = useState('');
    const [geometryType, setGeometryType] = useState('Point');
    const [isPublishing, setIsPublishing] = useState(false);
    const [attributes, setAttributes] = useState([
        { name: 'name', type: 'String' },
        { name: 'description', type: 'String' }
    ]);

    const handleAddAttribute = () => {
        setAttributes([...attributes, { name: '', type: 'String' }]);
    };

    const handleRemoveAttribute = (index) => {
        setAttributes(attributes.filter((_, i) => i !== index));
    };

    const handleAttributeChange = (index, field, value) => {
        const newAttrs = [...attributes];
        newAttrs[index][field] = value;
        setAttributes(newAttrs);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        if (!layerName.trim()) {
            toast.error("Please provide a layer name.");
            return;
        }

        // Validate layer name (no spaces, special chars for DB safety)
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(layerName)) {
            toast.error("Layer name must start with a letter and contain only letters, numbers, or underscores.");
            return;
        }

        const emptyAttrs = attributes.some(attr => !attr.name.trim());
        if (emptyAttrs) {
            toast.error("Please provide names for all attributes.");
            return;
        }

        setIsPublishing(true);
        try {
            await onPublish({
                layerName,
                geometryType,
                attributes
            });
            toast.success("Layer created and published successfully!");
            onClose();
        } catch (err) {
            toast.error(`Failed to publish layer: ${err.message}`);
        } finally {
            setIsPublishing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="elite-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            <div className="elite-modal" onClick={e => e.stopPropagation()} style={{
                width: '480px',
                maxHeight: '85vh',
                animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Header */}
                <div className="elite-modal-header" style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(168, 85, 247, 0.05))',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '14px 20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                        }}>
                            <Database size={16} color="white" />
                        </div>
                        <div>
                            <div className="elite-modal-title" style={{ fontSize: '0.95rem' }}>Create New Layer</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                                Define table name, type, and attributes
                            </div>
                        </div>
                    </div>
                    <button className="elite-modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="elite-modal-content" style={{
                    padding: '16px 20px',
                    overflowY: 'auto',
                    maxHeight: 'calc(85vh - 140px)'
                }}>
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        {/* Layer Settings Card */}
                        <div style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: '10px',
                            background: 'var(--color-bg-secondary)',
                            padding: '14px',
                            marginBottom: '16px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <Database size={14} style={{ color: 'var(--color-primary)' }} />
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Layer Configuration</span>
                            </div>

                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Layer Name (System Name)</label>
                                <input
                                    type="text"
                                    className="elite-input"
                                    value={layerName}
                                    onChange={(e) => setLayerName(e.target.value)}
                                    placeholder="e.g. city_parks"
                                    disabled={isPublishing}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '0.65rem', color: 'var(--color-text-muted)', opacity: 0.8 }}>
                                    <Info size={10} />
                                    <span>This will be the table name in PostGIS (letters and underscores only)</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: '5px' }}>Geometry Type</label>
                                <select
                                    className="elite-input"
                                    value={geometryType}
                                    onChange={(e) => setGeometryType(e.target.value)}
                                    disabled={isPublishing}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                >
                                    <option value="Point">Point</option>
                                    <option value="LineString">LineString</option>
                                    <option value="Polygon">Polygon</option>
                                    <option value="MultiPolygon">MultiPolygon</option>
                                </select>
                            </div>
                        </div>

                        {/* Attributes Section */}
                        <div style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: '10px',
                            background: 'var(--color-bg-secondary)',
                            padding: '14px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Layers size={14} style={{ color: 'var(--color-primary)' }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Layer Attributes</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddAttribute}
                                    disabled={isPublishing}
                                    style={{
                                        border: '1px solid var(--color-border)',
                                        background: 'transparent',
                                        color: 'var(--color-text-muted)',
                                        fontSize: '0.7rem',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                    onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                                >
                                    <Plus size={12} /> Add Field
                                </button>
                            </div>

                            <div className="attributes-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {attributes.map((attr, index) => (
                                    <div key={index} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            className="elite-input"
                                            placeholder="Field Name"
                                            value={attr.name}
                                            onChange={(e) => handleAttributeChange(index, 'name', e.target.value)}
                                            disabled={isPublishing}
                                            style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem' }}
                                        />
                                        <select
                                            className="elite-input"
                                            value={attr.type}
                                            onChange={(e) => handleAttributeChange(index, 'type', e.target.value)}
                                            disabled={isPublishing}
                                            style={{ width: '100px', padding: '6px 10px', fontSize: '0.8rem' }}
                                        >
                                            <option value="String">String</option>
                                            <option value="Double">Double</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAttribute(index)}
                                            disabled={isPublishing}
                                            style={{
                                                border: 'none', background: 'transparent', color: 'var(--color-text-muted)',
                                                padding: '4px', borderRadius: '4px', cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                                            onMouseOut={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Info Note */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(168, 85, 247, 0.04))',
                            border: '1px solid rgba(59, 130, 246, 0.12)',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start',
                            marginTop: '4px'
                        }}>
                            <Info size={15} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '1px' }} />
                            <p style={{ margin: 0, fontSize: '0.68rem', lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
                                Publishing a layer will create a physical table in the database and register it in GeoServer. This process is permanent.
                            </p>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="elite-modal-footer" style={{
                    padding: '12px 20px', gap: '10px',
                    borderTop: '1px solid var(--color-border)'
                }}>
                    <button className="elite-btn secondary" onClick={onClose} style={{ padding: '8px 20px' }} disabled={isPublishing}>
                        Cancel
                    </button>
                    <button
                        className="elite-btn primary"
                        onClick={handleFormSubmit}
                        disabled={isPublishing}
                        style={{
                            padding: '8px 24px',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
                            boxShadow: '0 2px 12px rgba(59, 130, 246, 0.3)'
                        }}
                    >
                        {isPublishing ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            <Database size={15} />
                        )}
                        {isPublishing ? 'Publishing...' : 'Create & Publish'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateLayerCard;
