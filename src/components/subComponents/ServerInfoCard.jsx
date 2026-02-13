import React, { useState, useEffect } from 'react';
import { X, Server, Trash2, Globe, List, BookOpen, Save, Loader2, Search, Database, ShieldAlert, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { GetGeoServerAllLayerDetails, UpdateLayerProjection, DeleteLayerInGeoServer } from '../../services/Server';

const ServerInfoCard = ({ isOpen, onClose }) => {

    const [layers, setLayers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLayer, setSelectedLayer] = useState(null);
    const [editingSrs, setEditingSrs] = useState({ name: '', value: '' });

    useEffect(() => {
        if (isOpen) {
            GetLayerDetails();
        }
    }, [isOpen]);

    const GetLayerDetails = async () => {
        setIsLoading(true);
        try {
            const data = await GetGeoServerAllLayerDetails();
            setLayers(data);
        } catch (err) {
            toast.error("Failed to fetch GeoServer details");
        } finally {
            setIsLoading(false);
        }
    };

    const UpdateProjection = async (layerName) => {
        if (!editingSrs.value) return;
        setIsLoading(true);
        try {
            const success = await UpdateLayerProjection(layerName, editingSrs.value);
            if (success) {
                toast.success(`SRS updated for ${layerName}`);
                setEditingSrs({ name: '', value: '' });
                GetLayerDetails();
            } else {
                toast.error("Update failed");
            }
        } catch (err) {
            toast.error("Error updating SRS");
        } finally {
            setIsLoading(false);
        }
    };

    const DeleteLayer = async (layerName) => {
        if (!window.confirm(`Are you absolutely sure you want to delete "${layerName}" from GeoServer? This cannot be undone.`)) return;

        setIsLoading(true);
        try {
            const success = await DeleteLayerInGeoServer(layerName);
            if (success) {
                toast.success(`${layerName} removed from server`);
                GetLayerDetails();
            } else {
                toast.error("Delete failed");
            }
        } catch (err) {
            toast.error("Error during deletion");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const filteredLayers = layers.filter(l =>
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.store.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="elite-modal-overlay" onClick={onClose} style={{ zIndex: 10005 }}>
            <div className="elite-modal" onClick={e => e.stopPropagation()} style={{
                width: '1000px',
                maxWidth: '95vw',
                height: '85vh',
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Header */}
                <div className="elite-modal-header" style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(30, 41, 59, 0.2))',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '20px 24px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #3b82f6, #1e293b)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
                        }}>
                            <Server size={20} color="white" />
                        </div>
                        <div>
                            <div className="elite-modal-title" style={{ fontSize: '1.1rem' }}>GeoServer Inventory</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                Manage workspace resources and native projections
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, justifyContent: 'flex-end', marginRight: '20px' }}>
                        <div style={{ position: 'relative', width: '250px' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                            <input
                                type="text"
                                className="elite-input"
                                placeholder="Search layers or stores..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', paddingLeft: '32px', height: '36px', fontSize: '0.8rem' }}
                            />
                        </div>
                        <button className="elite-modal-close" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="elite-modal-content" style={{ flex: 1, padding: '24px', overflowY: 'auto', background: 'var(--color-bg-primary)' }}>
                    {isLoading && layers.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
                            <Loader2 className="animate-spin" size={32} color="var(--color-primary)" />
                            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Querying GeoServer REST API...</span>
                        </div>
                    ) : (
                        <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                                        <th style={{ padding: '14px 20px', fontWeight: 600 }}>Layer Name</th>
                                        <th style={{ padding: '14px 20px', fontWeight: 600 }}>Data Store</th>
                                        <th style={{ padding: '14px 20px', fontWeight: 600 }}>Projection (SRS)</th>
                                        <th style={{ padding: '14px 20px', fontWeight: 600 }}>Geometry</th>
                                        <th style={{ padding: '14px 20px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLayers.map((layer) => (
                                        <tr key={layer.name} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '14px 20px' }}>
                                                <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{layer.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{layer.fullPath}</div>
                                            </td>
                                            <td style={{ padding: '14px 20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Database size={12} color="#10b981" />
                                                    {layer.store}
                                                </div>
                                            </td>
                                            <td style={{ padding: '14px 20px' }}>
                                                {editingSrs.name === layer.name ? (
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <input
                                                            type="text"
                                                            className="elite-input"
                                                            value={editingSrs.value}
                                                            placeholder="EPSG:XXXX"
                                                            onChange={(e) => setEditingSrs({ ...editingSrs, value: e.target.value })}
                                                            style={{ width: '80px', height: '28px', fontSize: '0.75rem' }}
                                                        />
                                                        <button onClick={() => UpdateProjection(layer.name)} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', padding: '0 8px', cursor: 'pointer' }}><Save size={14} /></button>
                                                        <button onClick={() => setEditingSrs({ name: '', value: '' })} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '0 8px', cursor: 'pointer' }}><X size={14} /></button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Globe size={12} color="#3b82f6" />
                                                        <span>{layer.srs}</span>
                                                        <button
                                                            onClick={() => setEditingSrs({ name: layer.name, value: layer.srs.replace('EPSG:', '') })}
                                                            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}
                                                        >
                                                            Edit
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 20px' }}>
                                                <span style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 8px', borderRadius: '12px' }}>
                                                    {layer.geometryType}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        title="View Attributes"
                                                        onClick={() => setSelectedLayer(layer)}
                                                        className="action-icon-btn"
                                                        style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.05)' }}
                                                    >
                                                        <List size={16} />
                                                    </button>
                                                    <button
                                                        title="Delete from Server"
                                                        onClick={() => DeleteLayer(layer.name)}
                                                        className="action-icon-btn"
                                                        style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)' }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredLayers.length === 0 && (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    No layers found in this workspace.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Attribute Popup */}
                {selectedLayer && (
                    <div className="elite-modal-overlay" style={{ zIndex: 10010, background: 'rgba(0,0,0,0.4)' }} onClick={() => setSelectedLayer(null)}>
                        <div className="elite-modal" onClick={e => e.stopPropagation()} style={{ width: '500px', maxHeight: '70vh' }}>
                            <div className="elite-modal-header" style={{ padding: '14px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <BookOpen size={16} color="var(--color-primary)" />
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedLayer.name} Attributes</span>
                                </div>
                                <button className="elite-modal-close" onClick={() => setSelectedLayer(null)}><X size={18} /></button>
                            </div>
                            <div className="elite-modal-content" style={{ padding: '16px', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {selectedLayer.attributes.map((attr, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '6px', fontSize: '0.8rem' }}>
                                            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{attr.name}</span>
                                            <span style={{ color: 'var(--color-text-muted)' }}>{attr.binding.split('.').pop()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer / Stats */}
                <div className="elite-modal-footer" style={{ padding: '12px 24px', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', gap: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            <Layers size={14} color="#3b82f6" />
                            <strong>{layers.length}</strong> Layers Tracked
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            <Database size={14} color="#10b981" />
                            <strong>{[...new Set(layers.map(l => l.store))].length}</strong> Active Stores
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#ef4444', opacity: 0.8 }}>
                        <ShieldAlert size={14} />
                        CAUTION: Management actions here directly affect GeoServer configuration.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServerInfoCard;
