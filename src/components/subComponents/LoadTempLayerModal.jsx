import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, FileJson, Loader2, Info, Plus, Trash2, CheckCircle2, AlertCircle, Layers, File } from 'lucide-react';
import { parseShp, parseDbf, combine } from 'shpjs';
import toast from 'react-hot-toast';

const LoadTempLayerModal = ({ isOpen, onClose, onLayerLoaded, existingNames = [] }) => {
    const [entries, setEntries] = useState([createEntry()]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [dragOverEntry, setDragOverEntry] = useState(null);
    const fileInputRefs = useRef({});

    function createEntry() {
        return {
            id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            layerName: '',
            files: { shp: null, dbf: null, shx: null, prj: null },
            status: 'pending',
            error: null
        };
    }

    if (!isOpen) return null;

    const addEntry = () => setEntries(prev => [...prev, createEntry()]);

    const removeEntry = (id) => {
        if (entries.length <= 1) return;
        setEntries(prev => prev.filter(e => e.id !== id));
    };

    const updateEntry = (id, changes) => {
        setEntries(prev => prev.map(e => e.id === id ? { ...e, ...changes } : e));
    };

    const removeFile = (entryId, ext, e) => {
        if (e) e.stopPropagation();
        const entry = entries.find(en => en.id === entryId);
        if (!entry) return;
        const newFiles = { ...entry.files };
        newFiles[ext] = null;
        updateEntry(entryId, { files: newFiles });
    };

    const handleFileChange = (entryId, e) => {
        const uploadedFiles = Array.from(e.target.files);
        processFiles(entryId, uploadedFiles);
    };

    const processFiles = (entryId, uploadedFiles) => {
        const entry = entries.find(en => en.id === entryId);
        if (!entry) return;

        const newFiles = { ...entry.files };
        uploadedFiles.forEach(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            if (['shp', 'dbf', 'shx', 'prj'].includes(ext)) {
                newFiles[ext] = file;
            }
        });

        const autoName = entry.layerName || (newFiles.shp ? newFiles.shp.name.replace(/\.shp$/i, '') : '');
        updateEntry(entryId, { files: newFiles, layerName: autoName });
    };

    const handleDrop = (entryId, e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverEntry(null);
        const droppedFiles = Array.from(e.dataTransfer.files);
        processFiles(entryId, droppedFiles);
    };

    const handleDragOver = (entryId, e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverEntry(entryId);
    };

    const handleDragLeave = (entryId, e) => {
        e.preventDefault();
        setDragOverEntry(null);
    };

    const readFileAsArrayBuffer = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });

    const readFileAsText = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });

    const processEntry = async (entry, loadedNames) => {
        if (!entry.files.shp) return { success: false, error: 'Missing .shp file' };
        if (!entry.files.prj) return { success: false, error: 'Missing .prj file' };
        if (!entry.layerName.trim()) return { success: false, error: 'Layer name required' };

        const nameLC = entry.layerName.trim().toLowerCase();
        if ([...existingNames, ...loadedNames].some(n => n.toLowerCase() === nameLC)) {
            return { success: false, error: 'Duplicate name' };
        }

        try {
            const shpBuffer = await readFileAsArrayBuffer(entry.files.shp);
            const dbfBuffer = entry.files.dbf ? await readFileAsArrayBuffer(entry.files.dbf) : null;
            const prjText = entry.files.prj ? await readFileAsText(entry.files.prj) : null;

            const parsedShp = parseShp(shpBuffer, prjText);
            const parsedDbf = dbfBuffer ? parseDbf(dbfBuffer) : null;
            const geojson = combine([parsedShp, parsedDbf]);

            return {
                success: true,
                layer: {
                    id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    name: entry.layerName.trim(),
                    fullName: `temp:${entry.layerName.trim()}`,
                    type: 'vector',
                    data: geojson,
                    visible: true,
                    opacity: 0.8,
                    sequence: 1,
                    queryable: true,
                    isLocal: true
                }
            };
        } catch (err) {
            console.error('Shapefile processing error:', err);
            return { success: false, error: 'Failed to parse shapefile' };
        }
    };

    const handleProcessAll = async () => {
        const pendingEntries = entries.filter(e => e.status !== 'done');
        if (pendingEntries.length === 0) { onClose(); return; }

        for (const entry of pendingEntries) {
            if (!entry.files.shp) {
                toast.error(`"${entry.layerName || 'Unnamed'}" is missing a .shp file`);
                return;
            }
            if (!entry.files.prj) {
                toast.error(`"${entry.layerName || 'Unnamed'}" is missing a .prj file`);
                return;
            }
            if (!entry.layerName.trim()) {
                toast.error('All layers must have a name.');
                return;
            }
        }

        const names = pendingEntries.map(e => e.layerName.trim().toLowerCase());
        if (new Set(names).size !== names.length) {
            toast.error('Duplicate layer names found.');
            return;
        }

        setIsProcessing(true);
        const loadedNames = [];
        let successCount = 0;

        for (const entry of pendingEntries) {
            updateEntry(entry.id, { status: 'processing', error: null });
            const result = await processEntry(entry, loadedNames);

            if (result.success) {
                onLayerLoaded(result.layer);
                loadedNames.push(result.layer.name);
                updateEntry(entry.id, { status: 'done' });
                successCount++;
            } else {
                updateEntry(entry.id, { status: 'error', error: result.error });
            }
        }

        setIsProcessing(false);

        if (successCount > 0) {
            toast.success(`${successCount} layer${successCount > 1 ? 's' : ''} loaded successfully!`);
        }

        if (successCount === pendingEntries.length) {
            setTimeout(() => {
                onClose();
                setEntries([createEntry()]);
            }, 500);
        }
    };

    const pendingCount = entries.filter(e => e.status !== 'done').length;
    const hasAnyFiles = entries.some(e => e.files.shp);
    const totalFiles = entries.reduce((sum, e) => sum + Object.values(e.files).filter(Boolean).length, 0);

    const fileExtColors = {
        shp: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' },
        dbf: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
        shx: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', text: '#f59e0b' },
        prj: { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)', text: '#a855f7' }
    };

    return (
        <div className="elite-modal-overlay" onClick={onClose}>
            <div className="elite-modal" onClick={e => e.stopPropagation()} style={{
                width: '520px',
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
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                        }}>
                            <Layers size={16} color="white" />
                        </div>
                        <div>
                            <div className="elite-modal-title" style={{ fontSize: '0.95rem' }}>Load Temporary Layers</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                                Upload shapefiles to add as session layers
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

                    {/* Layer Entry Cards */}
                    {entries.map((entry, index) => {
                        const isDone = entry.status === 'done';
                        const isError = entry.status === 'error';
                        const isActive = entry.status === 'processing';
                        const isDragTarget = dragOverEntry === entry.id;
                        const fileCount = Object.values(entry.files).filter(Boolean).length;

                        return (
                            <div key={entry.id} style={{
                                border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.25)' :
                                    isError ? 'rgba(239, 68, 68, 0.25)' :
                                        isDragTarget ? 'var(--color-primary)' :
                                            'var(--color-border)'}`,
                                borderRadius: '10px',
                                padding: '0',
                                marginBottom: '12px',
                                background: isDone ? 'rgba(16, 185, 129, 0.04)' :
                                    isError ? 'rgba(239, 68, 68, 0.04)' :
                                        isDragTarget ? 'rgba(var(--color-primary-rgb), 0.04)' :
                                            'var(--color-bg-secondary)',
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                opacity: isDone ? 0.55 : 1,
                                overflow: 'hidden',
                                transform: isDragTarget ? 'scale(1.01)' : 'scale(1)',
                                boxShadow: isDragTarget ? '0 0 0 2px rgba(var(--color-primary-rgb), 0.1)' : 'none'
                            }}>
                                {/* Card Header */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 14px 0 14px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {isDone && <CheckCircle2 size={14} style={{ color: '#10b981' }} />}
                                        {isError && <AlertCircle size={14} style={{ color: '#ef4444' }} />}
                                        {isActive && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-primary)' }} />}
                                        {!isDone && !isError && !isActive && (
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%',
                                                border: '2px solid var(--color-border)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)'
                                            }}>{index + 1}</div>
                                        )}
                                        <span style={{
                                            fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                                            letterSpacing: '0.06em', color: 'var(--color-text-muted)'
                                        }}>
                                            {isDone ? 'Loaded' : isError ? 'Error' : isActive ? 'Processing' : 'Ready'}
                                        </span>
                                    </div>
                                    {entries.length > 1 && !isDone && !isActive && (
                                        <button onClick={() => removeEntry(entry.id)} style={{
                                            border: 'none', background: 'transparent', color: 'var(--color-text-muted)',
                                            padding: '4px', borderRadius: '4px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                            onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                                            onMouseOut={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>

                                {/* Name + Upload */}
                                <div style={{ padding: '8px 14px 12px 14px' }}>
                                    {/* Layer Name */}
                                    <input
                                        type="text"
                                        className="elite-input"
                                        placeholder="Enter layer name..."
                                        value={entry.layerName}
                                        onChange={e => updateEntry(entry.id, { layerName: e.target.value })}
                                        disabled={isDone || isActive}
                                        style={{
                                            width: '100%', padding: '8px 12px', fontSize: '0.85rem',
                                            marginBottom: '8px', boxSizing: 'border-box',
                                            background: isDone ? 'transparent' : undefined
                                        }}
                                    />

                                    {/* Upload / File Display Zone */}
                                    <div
                                        onClick={() => !isDone && !isActive && fileInputRefs.current[entry.id]?.click()}
                                        onDrop={e => !isDone && !isActive && handleDrop(entry.id, e)}
                                        onDragOver={e => !isDone && !isActive && handleDragOver(entry.id, e)}
                                        onDragLeave={e => handleDragLeave(entry.id, e)}
                                        style={{
                                            border: `1.5px dashed ${isDragTarget ? 'var(--color-primary)' :
                                                fileCount > 0 ? 'rgba(var(--color-primary-rgb), 0.2)' :
                                                    'var(--color-border)'}`,
                                            borderRadius: '8px',
                                            padding: fileCount > 0 ? '8px 10px' : '16px',
                                            textAlign: 'center',
                                            cursor: isDone || isActive ? 'default' : 'pointer',
                                            background: isDragTarget ? 'rgba(var(--color-primary-rgb), 0.06)' :
                                                fileCount > 0 ? 'rgba(var(--color-primary-rgb), 0.02)' : 'transparent',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {fileCount > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                                                {Object.entries(entry.files).map(([ext, file]) => file && (
                                                    <div key={ext} style={{
                                                        backgroundColor: fileExtColors[ext].bg,
                                                        border: `1px solid ${fileExtColors[ext].border}`,
                                                        padding: '3px 8px 3px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 600,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        color: fileExtColors[ext].text,
                                                        transition: 'all 0.2s'
                                                    }}>
                                                        <File size={11} />
                                                        <span>.{ext}</span>
                                                        {(!isDone && !isActive) && (
                                                            <button
                                                                onClick={(e) => removeFile(entry.id, ext, e)}
                                                                style={{
                                                                    border: 'none',
                                                                    background: 'transparent',
                                                                    color: fileExtColors[ext].text,
                                                                    padding: '2px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                    borderRadius: '4px',
                                                                    marginLeft: '2px',
                                                                    opacity: 0.6,
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseOver={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
                                                                onMouseOut={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'transparent'; }}
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div>
                                                <Upload size={22} style={{ opacity: 0.3, marginBottom: '6px' }} />
                                                <p style={{ fontSize: '0.78rem', margin: '0 0 2px', opacity: 0.7 }}>
                                                    Click or drag & drop shapefile components
                                                </p>
                                                <p style={{ fontSize: '0.65rem', opacity: 0.4, margin: 0 }}>
                                                    .shp, .prj  (required) &bull; .dbf, .shx(optional)
                                                </p>
                                            </div>
                                        )}
                                        <input
                                            type="file" multiple accept=".shp,.dbf,.shx,.prj"
                                            ref={el => fileInputRefs.current[entry.id] = el}
                                            onChange={e => handleFileChange(entry.id, e)}
                                            style={{ display: 'none' }}
                                        />
                                    </div>

                                    {/* Error */}
                                    {isError && entry.error && (
                                        <div style={{
                                            marginTop: '8px', padding: '6px 10px',
                                            background: 'rgba(239, 68, 68, 0.08)',
                                            borderRadius: '6px', fontSize: '0.72rem', color: '#ef4444',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}>
                                            <AlertCircle size={12} />
                                            {entry.error}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Add Another */}
                    {!isProcessing && (
                        <button onClick={addEntry} style={{
                            width: '100%',
                            border: '1.5px dashed var(--color-border)',
                            background: 'transparent',
                            color: 'var(--color-text-muted)',
                            padding: '10px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            transition: 'all 0.2s ease',
                            marginBottom: '14px'
                        }}
                            onMouseOver={e => {
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                                e.currentTarget.style.color = 'var(--color-primary)';
                                e.currentTarget.style.background = 'rgba(var(--color-primary-rgb), 0.04)';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                e.currentTarget.style.color = 'var(--color-text-muted)';
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            <Plus size={15} />
                            Add Another Layer
                        </button>
                    )}

                    {/* Info */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(168, 85, 247, 0.04))',
                        border: '1px solid rgba(59, 130, 246, 0.12)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'flex-start'
                    }}>
                        <Info size={15} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '1px' }} />
                        <p style={{
                            margin: 0, fontSize: '0.72rem', lineHeight: 1.5,
                            color: 'var(--color-text-muted)'
                        }}>
                            Temporary layers are session-only. They will be lost when you refresh the page.
                            Upload multiple layers at once for efficiency.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="elite-modal-footer" style={{
                    padding: '12px 20px', gap: '10px',
                    borderTop: '1px solid var(--color-border)'
                }}>
                    <button className="elite-btn secondary" onClick={onClose} style={{ padding: '8px 20px' }}>
                        Cancel
                    </button>
                    <button
                        className="elite-btn primary"
                        onClick={handleProcessAll}
                        disabled={isProcessing || !hasAnyFiles}
                        style={{
                            padding: '8px 24px',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: hasAnyFiles ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : undefined,
                            opacity: (!hasAnyFiles && !isProcessing) ? 0.5 : 1,
                            boxShadow: hasAnyFiles ? '0 2px 12px rgba(59, 130, 246, 0.3)' : 'none'
                        }}
                    >
                        {isProcessing ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            <Upload size={15} />
                        )}
                        {isProcessing ? 'Processing...' : `Load ${pendingCount} Layer${pendingCount !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoadTempLayerModal;
