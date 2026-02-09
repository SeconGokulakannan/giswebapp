import React, { useState, useRef } from 'react';
import { X, Upload, FileJson, Loader2, Info } from 'lucide-react';
import shp, { parseShp, parseDbf, combine } from 'shpjs';
import proj4 from 'proj4';
import toast from 'react-hot-toast';

const LoadTempLayerModal = ({ isOpen, onClose, onLayerLoaded, existingNames = [] }) => {
    const [layerName, setLayerName] = useState('');
    const [files, setFiles] = useState({
        shp: null,
        dbf: null,
        shx: null,
        prj: null
    });
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const uploadedFiles = Array.from(e.target.files);
        const newFiles = { ...files };

        uploadedFiles.forEach(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            if (['shp', 'dbf', 'shx', 'prj'].includes(ext)) {
                newFiles[ext] = file;
            }
        });

        setFiles(newFiles);
    };

    const readFileAsArrayBuffer = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    const readFileAsText = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    };

    const handleProcess = async () => {
        if (!files.shp) {
            toast.error('Please upload at least the .shp file.');
            return;
        }
        if (!layerName.trim()) {
            toast.error('Please enter a layer name.');
            return;
        }

        if (existingNames.some(name => name.toLowerCase() === layerName.trim().toLowerCase())) {
            toast.error('A layer with this name already exists. Please choose a different name.');
            return;
        }

        setIsLoading(true);
        try {
            console.log('Starting shapefile processing...', { shp: !!files.shp, dbf: !!files.dbf });
            const shpBuffer = await readFileAsArrayBuffer(files.shp);
            const dbfBuffer = files.dbf ? await readFileAsArrayBuffer(files.dbf) : null;

            const prjText = files.prj ? await readFileAsText(files.prj) : null;

            console.log('Buffers loaded:', { shp: shpBuffer?.byteLength, dbf: dbfBuffer?.byteLength, prj: !!prjText });

            // Parse using shpjs named exports
            let geojson;
            try {
                // parseShp can take (buffer, optional prj string/function)
                const parsedShp = parseShp(shpBuffer, prjText);
                const parsedDbf = dbfBuffer ? parseDbf(dbfBuffer) : null;
                console.log('Parsed components successfully');

                geojson = combine([parsedShp, parsedDbf]);
                console.log('GeoJSON generation successful');
            } catch (shpErr) {
                console.error('Core shpjs parsing failed:', shpErr);
                throw shpErr;
            }

            // Handle Projection if PRJ exists
            if (files.prj) {
                const prjText = await readFileAsText(files.prj);
                // Note: OpenLayers usually handles WGS84 (EPSG:4326) or Web Mercator (EPSG:3857)
                // If the shapefile is in a different projection, we might need to reproject features
                // However, shpjs usually assumes WGS84 for GeoJSON. 
                // If it's not WGS84, we'd need to use proj4 to transform.
                console.log('PRJ Info:', prjText);
            }

            const layerId = `temp-${Date.now()}`;
            const newLayer = {
                id: layerId,
                name: layerName,
                fullName: `temp:${layerName}`,
                type: 'vector',
                data: geojson,
                visible: true,
                opacity: 0.8,
                sequence: 1, // Add to top
                queryable: true,
                isLocal: true
            };

            onLayerLoaded(newLayer);
            toast.success(`Layer "${layerName}" loaded successfully!`);
            onClose();
            // Reset state
            setLayerName('');
            setFiles({ shp: null, dbf: null, shx: null, prj: null });
        } catch (err) {
            console.error('Error processing shapefile:', err);
            toast.error('Failed to process shapefile. Ensure data is valid.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="layer-management-overlay">
            <div className="layer-management-card" style={{ maxWidth: '500px', height: 'auto', paddingBottom: '24px' }}>
                <div className="attribute-table-header">
                    <div className="header-title">
                        <Upload size={14} strokeWidth={1.5} />
                        <span>LOAD TEMPORARY LAYERS (Shapefile)</span>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                <div className="panel-content" style={{ padding: '20px' }}>
                    <div className="input-group" style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500' }}>Layer Name</label>
                        <input
                            type="text"
                            className="coordinate-input"
                            placeholder="e.g. Temporary Observations"
                            value={layerName}
                            onChange={(e) => setLayerName(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div className="upload-zone"
                        onClick={() => fileInputRef.current.click()}
                        style={{
                            border: '2px dashed rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            padding: '30px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            backgroundColor: 'rgba(255,255,255,0.02)',
                            transition: 'all 0.2s ease',
                            marginBottom: '20px'
                        }}>
                        <Upload size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                        <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>Click to upload Shapefile components</p>
                        <p style={{ fontSize: '11px', opacity: 0.5, margin: 0 }}>Required: .shp | Optional: .dbf, .shx, .prj</p>
                        <input
                            type="file"
                            multiple
                            accept=".shp,.dbf,.shx,.prj"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                    </div>

                    {Object.values(files).some(f => f) && (
                        <div className="file-list" style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.5, marginBottom: '8px', letterSpacing: '0.05em' }}>Selected Files</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {Object.entries(files).map(([ext, file]) => file && (
                                    <div key={ext} style={{
                                        backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)',
                                        border: '1px solid rgba(var(--color-primary-rgb), 0.2)',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <FileJson size={14} style={{ opacity: 0.7 }} />
                                        <span>{file.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="alert-box" style={{
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        borderLeft: '4px solid #3498db',
                        padding: '12px',
                        borderRadius: '0 8px 8px 0',
                        marginBottom: '24px',
                        display: 'flex',
                        gap: '12px'
                    }}>
                        <Info size={18} style={{ color: '#3498db', flexShrink: 0 }} />
                        <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.5', opacity: 0.8 }}>
                            Temporary layers persist only during this session. To make them permanent, they must be uploaded to GeoServer by an administrator.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="action-btn btn-discard" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
                            Cancel
                        </button>
                        <button
                            className="action-btn btn-save"
                            onClick={handleProcess}
                            disabled={isLoading}
                            style={{ flex: 2, justifyContent: 'center' }}
                        >
                            {isLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Upload size={16} />
                            )}
                            <span>{isLoading ? 'Processing...' : 'Process & Load Layer'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoadTempLayerModal;
