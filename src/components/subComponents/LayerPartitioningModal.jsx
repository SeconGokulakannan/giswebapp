import React, { useState, useEffect } from 'react';
import { X, Loader2, Database, Table, Plus, Zap, RefreshCw, ChevronRight, LayoutGrid, Info, Trash2, ArrowRightLeft, CheckCircle2, Settings2, Edit3, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getAvailableStoreTables,
    GetGeoServerAllLayerDetails,
    publishSQLView,
    getTableSchema
} from '../../services/Server';

const LayerPartitioningModal = ({ isOpen, onClose, refreshLayers }) => {
    const [activeStep, setActiveStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [allLayers, setAllLayers] = useState([]);

    // Step 1: Base Spatial Layer
    const [baseLayer, setBaseLayer] = useState(null);
    const [availableTables, setAvailableTables] = useState([]);

    // Step 2: Joins Configuration
    const [joins, setJoins] = useState([]); // Array of { table, baseKey, joinKey, operator, customExpression, useCustom }
    const [tableSchemas, setTableSchemas] = useState({}); // { [tableName]: [attributes] }

    // Step 3: Column Selection & Aliasing
    const [columnMappings, setColumnMappings] = useState([]); // Array of { table, original, alias, enabled }

    // Step 4: Output config
    const [outputLayerName, setOutputLayerName] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            resetState();
        }
    }, [isOpen]);

    const resetState = () => {
        setActiveStep(1);
        setBaseLayer(null);
        setJoins([]);
        setTableSchemas({});
        setColumnMappings([]);
        setOutputLayerName('');
    };

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const layers = await GetGeoServerAllLayerDetails();
            setAllLayers(layers);
        } catch (err) {
            toast.error("Failed to load layers");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectBaseLayer = async (layerId) => {
        const layer = allLayers.find(l => l.id === layerId);
        setBaseLayer(layer);
        setIsLoading(true);
        try {
            const tables = await getAvailableStoreTables(layer.store);
            setAvailableTables(tables);

            // Auto-populate base layer schema
            setTableSchemas({ [layer.name]: layer.attributes });

            setActiveStep(2);
        } catch (err) {
            toast.error("Failed to fetch tables from data store");
        } finally {
            setIsLoading(false);
        }
    };

    const addJoin = () => {
        setJoins([...joins, {
            table: '', baseKey: '', joinKey: '', operator: '=',
            customExpression: '', useCustom: false
        }]);
    };

    const [schemaLoading, setSchemaLoading] = useState({}); // { [tableName]: bool }

    const removeJoin = (index) => {
        setJoins(joins.filter((_, i) => i !== index));
    };

    const updateJoin = async (index, field, value) => {
        const newJoins = [...joins];
        newJoins[index][field] = value;
        setJoins(newJoins);

        // If table changed, fetch its schema
        if (field === 'table' && value && !tableSchemas[value]) {
            setSchemaLoading(prev => ({ ...prev, [value]: true }));
            try {
                // Try as a published layer first, then via datastore endpoint
                const schema = await getTableSchema(baseLayer.store, value);
                setTableSchemas(prev => ({ ...prev, [value]: schema }));
                if (schema.length === 0) {
                    console.warn(`Schema for "${value}" is empty — it may be unpublished or inaccessible.`);
                }
            } catch (err) {
                console.error("Failed to fetch schema for join table:", value);
                setTableSchemas(prev => ({ ...prev, [value]: [] }));
            } finally {
                setSchemaLoading(prev => ({ ...prev, [value]: false }));
            }
        }

        setJoins(newJoins);
    };

    const [missingSchemaJoins, setMissingSchemaJoins] = useState([]); // join indices that have no schema

    const prepareColumnMapping = () => {
        const mappings = [];
        const missing = [];

        // Add base layer columns
        if (baseLayer?.attributes) {
            baseLayer.attributes.forEach(attr => {
                mappings.push({
                    table: 'base',
                    tableName: baseLayer.name,
                    original: attr.name,
                    alias: attr.name,
                    enabled: true,
                    type: attr.binding?.split('.')?.pop() || 'String',
                    isManual: false
                });
            });
        }

        // Add join table columns (from schema or empty)
        joins.forEach((join, jIdx) => {
            if (!join.table) return;
            const schema = tableSchemas[join.table] || [];

            if (schema.length === 0) {
                // can't auto-discover; mark as missing so UI can offer manual entry
                missing.push(jIdx);
                // Add a placeholder row so the user can see this table needs manual columns
                mappings.push({
                    table: `b${jIdx}`,
                    tableName: join.table,
                    original: '',
                    alias: '',
                    enabled: false,
                    type: 'Unknown',
                    isManual: true,
                    isPlaceholder: true
                });
            } else {
                schema.forEach(attr => {
                    const isDuplicate = mappings.some(m => m.alias === attr.name);
                    mappings.push({
                        table: `b${jIdx}`,
                        tableName: join.table,
                        original: attr.name,
                        alias: isDuplicate ? `${join.table}_${attr.name}` : attr.name,
                        enabled: true,
                        type: attr.binding?.split('.')?.pop() || 'String',
                        isManual: false
                    });
                });
            }
        });

        setMissingSchemaJoins(missing);
        setColumnMappings(mappings);
        setActiveStep(3);
    };

    const addManualColumn = (tableAlias, tableName) => {
        setColumnMappings(prev => [
            ...prev.filter(m => !(m.table === tableAlias && m.isPlaceholder)),
            {
                table: tableAlias, tableName, original: '', alias: '',
                enabled: true, type: 'String', isManual: true
            }
        ]);
    };

    const removeMapping = (index) => {
        setColumnMappings(prev => prev.filter((_, i) => i !== index));
    };

    const updateMapping = (index, field, value) => {
        const newMappings = [...columnMappings];
        newMappings[index][field] = value;
        setColumnMappings(newMappings);
    };

    const toggleColumn = (index) => {
        const newMappings = [...columnMappings];
        newMappings[index].enabled = !newMappings[index].enabled;
        setColumnMappings(newMappings);
    };

    const handlePublish = async () => {
        if (!outputLayerName) {
            toast.error("Please enter an output layer name");
            return;
        }

        const selectedCols = columnMappings.filter(m => m.enabled);
        if (selectedCols.length === 0) {
            toast.error("Please select at least one column");
            return;
        }

        setIsLoading(true);
        try {
            // Build SELECT clause
            const colParts = selectedCols.map(m => {
                const tableAlias = m.table === 'base' ? 'a' : m.table;
                return `${tableAlias}.${m.original} AS ${m.alias}`;
            });

            let sql = `SELECT ${colParts.join(', ')} FROM ${baseLayer.name} a`;

            // Build JOINs
            joins.forEach((j, i) => {
                const tableAlias = `b${i}`;
                let condition = '';
                if (j.useCustom) {
                    condition = j.customExpression;
                } else {
                    condition = `a.${j.baseKey} ${j.operator} ${tableAlias}.${j.joinKey}`;
                }
                sql += ` INNER JOIN ${j.table} ${tableAlias} ON ${condition}`;
            });

            const geomCol = columnMappings.find(m => m.tableName === baseLayer.name && m.type.includes('Geometry')) || baseLayer.attributes.find(a => a.binding.includes('Geometry'));

            await publishSQLView({
                layerName: outputLayerName,
                sql: sql,
                storeName: baseLayer.store,
                geometryName: geomCol?.original || 'geom',
                geometryType: baseLayer.geometryType,
                srid: baseLayer.srs.split(':')[1] || '4326'
            });

            toast.success("Layer Partitioning successful! New layer published.");
            if (refreshLayers) refreshLayers();
            onClose();
        } catch (err) {
            toast.error("Partitioning failed: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="elite-modal-overlay" onClick={onClose} style={{ zIndex: 10001 }}>
            <div className="elite-modal" onClick={e => e.stopPropagation()} style={{
                width: activeStep === 3 ? '850px' : '650px',
                maxHeight: '90vh',
                animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Header */}
                <div className="elite-modal-header" style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.05))',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '14px 20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)'
                        }}>
                            <LayoutGrid size={16} color="white" />
                        </div>
                        <div>
                            <div className="elite-modal-title" style={{ fontSize: '0.95rem' }}>Layer Partitioning</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                                join spatial layers with non-spatial tables and map attributes
                            </div>
                        </div>
                    </div>
                    <button className="elite-modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                    {[1, 2, 3, 4].map(step => (
                        <div key={step} style={{
                            flex: 1,
                            padding: '10px 0',
                            textAlign: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: activeStep >= step ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            borderBottom: `2px solid ${activeStep === step ? 'var(--color-primary)' : 'transparent'}`,
                            opacity: activeStep >= step ? 1 : 0.5,
                            transition: 'all 0.3s'
                        }}>
                            {step === 1 ? '1. Select Base' : step === 2 ? '2. Join Config' : step === 3 ? '3. Mapping' : '4. Finalize'}
                        </div>
                    ))}
                </div>

                {/* Body */}
                <div className="elite-modal-content" style={{ padding: '20px', overflowY: 'auto' }}>

                    {activeStep === 1 && (
                        <div className="fade-in">
                            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Database size={14} style={{ color: '#6366f1' }} />
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target Spatial Layer</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                                {allLayers.map(layer => (
                                    <button
                                        key={layer.id}
                                        onClick={() => handleSelectBaseLayer(layer.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '12px 16px', background: 'var(--color-bg-secondary)',
                                            border: '1px solid var(--color-border)', borderRadius: '12px',
                                            cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
                                            width: '100%'
                                        }}
                                        className="btn-hover-effect"
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Database size={16} color="#6366f1" />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{layer.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Store: {layer.store}</div>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} color="var(--color-text-muted)" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeStep === 2 && (
                        <div className="fade-in">
                            <div style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: '12px', background: 'var(--color-bg-secondary)', padding: '16px', marginBottom: '20px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <Info size={14} style={{ color: '#6366f1' }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>Selected Base</span>
                                </div>
                                <p style={{ fontSize: '0.8rem', margin: 0 }}>
                                    Base Layer: <strong>{baseLayer?.name}</strong> <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', marginLeft: '4px' }}>({baseLayer?.store})</span>
                                </p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                <ArrowRightLeft size={14} style={{ color: '#a855f7' }} />
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>Join Configurations (Inner Join)</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {joins.map((join, index) => (
                                    <div key={index} style={{
                                        padding: '16px', background: 'var(--color-bg-primary)',
                                        borderRadius: '12px', border: '1px solid var(--color-border)',
                                        position: 'relative', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}>
                                        <button
                                            onClick={() => removeJoin(index)}
                                            style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>

                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>TABLE TO JOIN</label>
                                            <select
                                                className="elite-input"
                                                style={{ width: '100%' }}
                                                value={join.table}
                                                onChange={(e) => updateJoin(index, 'table', e.target.value)}
                                            >
                                                <option value="">Select table from store...</option>
                                                {availableTables.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>JOIN CONDITION</div>
                                            <button
                                                onClick={() => updateJoin(index, 'useCustom', !join.useCustom)}
                                                style={{ padding: '4px 8px', fontSize: '0.65rem', border: '1px solid var(--color-border)', borderRadius: '4px', background: join.useCustom ? 'rgba(99, 102, 241, 0.1)' : 'transparent', color: join.useCustom ? '#6366f1' : 'var(--color-text-muted)', cursor: 'pointer' }}
                                            >
                                                {join.useCustom ? 'Switch to Simple' : 'Custom Expression'}
                                            </button>
                                        </div>

                                        {!join.useCustom ? (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <div style={{ flex: 1.5 }}>
                                                    <select
                                                        className="elite-input"
                                                        style={{ width: '100%', fontSize: '0.75rem' }}
                                                        value={join.baseKey}
                                                        onChange={(e) => updateJoin(index, 'baseKey', e.target.value)}
                                                    >
                                                        <option value="">Base: Select Column...</option>
                                                        {baseLayer?.attributes?.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                                                    </select>
                                                </div>
                                                <div style={{ flex: 0.8 }}>
                                                    <select
                                                        className="elite-input"
                                                        style={{ width: '100%', textAlign: 'center', fontSize: '1rem', fontWeight: 700 }}
                                                        value={join.operator}
                                                        onChange={(e) => updateJoin(index, 'operator', e.target.value)}
                                                    >
                                                        <option value="=">=</option>
                                                        <option value="<>">!=</option>
                                                        <option value=">">&gt;</option>
                                                        <option value="<">&lt;</option>
                                                        <option value=">=">&gt;=</option>
                                                        <option value="<=">&lt;=</option>
                                                        <option value="LIKE">LIKE</option>
                                                    </select>
                                                </div>
                                                <div style={{ flex: 1.5 }}>
                                                    {
                                                        // If schema is loading, show spinner
                                                        schemaLoading[join.table] ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                                                <Loader2 size={14} className="animate-spin" /> Loading columns...
                                                            </div>
                                                        ) : tableSchemas[join.table]?.length > 0 ? (
                                                            // If schema loaded, show DDL
                                                            <select
                                                                className="elite-input"
                                                                style={{ width: '100%', fontSize: '0.75rem' }}
                                                                value={join.joinKey}
                                                                onChange={(e) => updateJoin(index, 'joinKey', e.target.value)}
                                                            >
                                                                <option value="">Join: Select Column...</option>
                                                                {tableSchemas[join.table].map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                                                            </select>
                                                        ) : (
                                                            // Fallback: text input for unpublished tables
                                                            <div>
                                                                <input
                                                                    type="text"
                                                                    className="elite-input"
                                                                    style={{ width: '100%', fontSize: '0.75rem' }}
                                                                    placeholder="Type column name..."
                                                                    value={join.joinKey}
                                                                    onChange={(e) => updateJoin(index, 'joinKey', e.target.value)}
                                                                    disabled={!join.table}
                                                                />
                                                                {join.table && (
                                                                    <div style={{ fontSize: '0.65rem', color: '#f59e0b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <Info size={11} />
                                                                        Schema not auto-detected. Type the column name manually.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    }
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <textarea
                                                    className="elite-input"
                                                    style={{ width: '100%', height: '60px', padding: '10px', fontSize: '0.75rem', fontFamily: 'monospace' }}
                                                    placeholder="e.g. a.id = b0.user_id + 100"
                                                    value={join.customExpression}
                                                    onChange={(e) => updateJoin(index, 'customExpression', e.target.value)}
                                                />
                                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                                    Aliases: Base = <strong>a</strong>, Join 1 = <strong>b0</strong>, Join 2 = <strong>b1</strong>...
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <button
                                    onClick={addJoin}
                                    className="btn btn-secondary"
                                    style={{ width: '100%', borderStyle: 'dashed', background: 'rgba(var(--color-bg-primary-rgb), 0.5)', color: 'var(--color-primary)', fontWeight: 600, padding: '12px' }}
                                >
                                    <Plus size={16} /> Add Another Join Table
                                </button>
                            </div>
                        </div>
                    )}

                    {activeStep === 3 && (
                        <div className="fade-in">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Settings2 size={14} style={{ color: '#6366f1' }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>Attribute Mapping & Selection</span>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                    {columnMappings.filter(m => m.enabled && !m.isPlaceholder).length} of {columnMappings.filter(m => !m.isPlaceholder).length} selected
                                </div>
                            </div>

                            {missingSchemaJoins.length > 0 && (
                                <div style={{ padding: '10px 14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '10px', marginBottom: '16px', fontSize: '0.75rem', color: '#92400e', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <Info size={14} style={{ flexShrink: 0, marginTop: '1px', color: '#f59e0b' }} />
                                    <span>Some join tables have unknown schemas. Use the <strong>"+ Add Column"</strong> buttons below to manually map fields from those tables.</span>
                                </div>
                            )}

                            <div style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: '12px', overflow: 'auto', background: 'var(--color-bg-primary)',
                                maxHeight: '420px'
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <thead style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0 }}>
                                        <tr>
                                            <th style={{ padding: '12px 10px', textAlign: 'left', width: '40px' }}><Eye size={12} /></th>
                                            <th style={{ padding: '12px 10px', textAlign: 'left' }}>Source Table / Field</th>
                                            <th style={{ padding: '12px 10px', textAlign: 'left', width: '90px' }}>Type</th>
                                            <th style={{ padding: '12px 10px', textAlign: 'left' }}>Output Alias</th>
                                            <th style={{ padding: '12px 10px', width: '36px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {columnMappings.map((map, index) => {
                                            // Placeholder row: schema was unavailable
                                            if (map.isPlaceholder) {
                                                return (
                                                    <tr key={index} style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(245, 158, 11, 0.03)' }}>
                                                        <td colSpan={5} style={{ padding: '12px 16px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <div style={{ fontSize: '0.75rem', color: '#d97706' }}>
                                                                    <span style={{ fontWeight: 600 }}>{map.tableName}</span> — columns not auto-detected
                                                                </div>
                                                                <button
                                                                    onClick={() => addManualColumn(map.table, map.tableName)}
                                                                    style={{ fontSize: '0.7rem', padding: '4px 10px', border: '1px dashed #f59e0b', borderRadius: '6px', background: 'transparent', color: '#d97706', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                >
                                                                    <Plus size={12} /> Add Column
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            // Manual row: user-added column
                                            if (map.isManual) {
                                                return (
                                                    <tr key={index} style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(99, 102, 241, 0.02)' }}>
                                                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                            <button
                                                                onClick={() => toggleColumn(index)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: map.enabled ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                                                            >
                                                                {map.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                                                            </button>
                                                        </td>
                                                        <td style={{ padding: '8px 10px' }}>
                                                            <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>{map.tableName} (manual)</div>
                                                            <input
                                                                className="elite-input"
                                                                style={{ width: '100%', height: '28px', fontSize: '0.73rem' }}
                                                                placeholder="DB column name..."
                                                                value={map.original}
                                                                onChange={e => updateMapping(index, 'original', e.target.value)}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '8px 10px' }}>
                                                            <select className="elite-input" style={{ width: '86px', fontSize: '0.7rem', height: '28px' }} value={map.type} onChange={e => updateMapping(index, 'type', e.target.value)}>
                                                                <option>String</option>
                                                                <option>Integer</option>
                                                                <option>Double</option>
                                                            </select>
                                                        </td>
                                                        <td style={{ padding: '8px 10px' }}>
                                                            <input
                                                                className="elite-input"
                                                                style={{ width: '100%', height: '28px', fontSize: '0.73rem' }}
                                                                placeholder="Alias name..."
                                                                value={map.alias}
                                                                onChange={e => updateMapping(index, 'alias', e.target.value)}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '8px 10px' }}>
                                                            <button onClick={() => removeMapping(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '2px' }}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            // Normal auto-discovered row
                                            return (
                                                <tr key={index} style={{
                                                    borderBottom: '1px solid var(--color-border)',
                                                    opacity: map.enabled ? 1 : 0.5,
                                                    background: map.enabled ? 'transparent' : 'rgba(0,0,0,0.01)'
                                                }}>
                                                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                        <button
                                                            onClick={() => toggleColumn(index)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: map.enabled ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                                                        >
                                                            {map.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                                                        </button>
                                                    </td>
                                                    <td style={{ padding: '8px 10px' }}>
                                                        <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{map.tableName}</div>
                                                        <div style={{ fontWeight: 600 }}>{map.original}</div>
                                                    </td>
                                                    <td style={{ padding: '8px 10px' }}>
                                                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--color-bg-secondary)', borderRadius: '4px', color: 'var(--color-text-muted)' }}>{map.type}</span>
                                                    </td>
                                                    <td style={{ padding: '8px 10px' }}>
                                                        <input
                                                            className="elite-input"
                                                            style={{ width: '100%', height: '32px', fontSize: '0.75rem', borderStyle: map.enabled ? 'solid' : 'dashed' }}
                                                            value={map.alias}
                                                            onChange={(e) => updateMapping(index, 'alias', e.target.value)}
                                                            disabled={!map.enabled}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '8px 10px' }}></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeStep === 4 && (
                        <div className="fade-in" style={{ textAlign: 'center', padding: '10px 0' }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
                            }}>
                                <CheckCircle2 size={32} style={{ color: '#6366f1' }} />
                            </div>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>Ready to Create Partition</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto 24px' }}>
                                We will create a new virtual SQL view layer joining <strong>{baseLayer?.name}</strong> with {joins.length} tables.
                            </p>

                            <div style={{ textAlign: 'left', background: 'var(--color-bg-secondary)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '8px', fontWeight: 600 }}>NEW LAYER NAME</label>
                                    <input
                                        type="text"
                                        className="elite-input"
                                        placeholder="e.g. partition_result_01"
                                        style={{ width: '100%', fontWeight: 700, fontSize: '1rem' }}
                                        value={outputLayerName}
                                        onChange={(e) => setOutputLayerName(e.target.value)}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'var(--color-bg-primary)', padding: '14px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                                    <Info size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                                        <strong>Virtual Join:</strong> No physical table will be created. This layer remains dynamic and will reflect updates to the original tables.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="elite-modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)', gap: '12px' }}>
                    {activeStep > 1 && (
                        <button
                            className="elite-btn secondary"
                            onClick={() => setActiveStep(activeStep - 1)}
                            disabled={isLoading}
                        >
                            Back
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    <button className="elite-btn secondary" onClick={onClose} disabled={isLoading}>Cancel</button>

                    {activeStep === 1 && (
                        <button className="elite-btn primary" disabled={!baseLayer} onClick={() => setActiveStep(2)}>
                            Next: Configure Joins
                        </button>
                    )}

                    {activeStep === 2 && (
                        <button
                            className="elite-btn primary"
                            disabled={joins.length === 0 || joins.some(j => !j.table || (!j.useCustom && (!j.baseKey || !j.joinKey)))}
                            onClick={prepareColumnMapping}
                        >
                            Next: Column Mapping
                        </button>
                    )}

                    {activeStep === 3 && (
                        <button
                            className="elite-btn primary"
                            onClick={() => setActiveStep(4)}
                        >
                            Next: Finalize
                        </button>
                    )}

                    {activeStep === 4 && (
                        <button
                            className="elite-btn primary"
                            onClick={handlePublish}
                            disabled={isLoading || !outputLayerName}
                            style={{
                                padding: '8px 28px',
                                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                            }}
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                            <span style={{ marginLeft: '8px' }}>{isLoading ? 'Creating Layer...' : 'Publish Partition'}</span>
                        </button>
                    )}
                </div>

                <style>{`
                    .btn-hover-effect:hover {
                        border-color: var(--color-primary) !important;
                        background: var(--color-bg-primary) !important;
                        box-shadow: var(--shadow-md);
                    }
                    @keyframes slideUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .elite-input:focus {
                        border-color: #6366f1 !important;
                        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
                    }
                `}</style>
            </div>
        </div>
    );
};

export default LayerPartitioningModal;
