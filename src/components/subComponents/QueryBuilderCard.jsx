import React, { useState, useEffect } from 'react';
import { X, Plus, DatabaseZap, RefreshCw, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLayerAttributes, QueryBuilderFilter } from '../../services/Server';

const QB_OPERATORS = [
    { value: '=', label: 'Equals (=)' },
    { value: '<>', label: 'Not Equals (<>)' },
    { value: '>', label: 'Greater Than (>)' },
    { value: '<', label: 'Less Than (<)' },
    { value: '>=', label: 'Greater or Equal (>=)' },
    { value: '<=', label: 'Less or Equal (<=)' },
    { value: 'LIKE', label: 'Contains (LIKE)' },
    { value: 'ILIKE', label: 'Contains Case-Insensitive (ILIKE)' },
];

const QueryBuilderCard = ({
    isOpen,
    onClose,
    layer,
    handleApplyLayerFilter
}) => {
    const [qbConditions, setQbConditions] = useState([{ field: '', operator: '=', value: '', logic: 'AND' }]);
    const [qbAttributes, setQbAttributes] = useState([]);
    const [isFetchingAttributes, setIsFetchingAttributes] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    useEffect(() => {
        if (isOpen && layer) {
            fetchAttributes();
        }
    }, [isOpen, layer?.id]);

    const fetchAttributes = async () => {
        if (!layer) return;
        setIsFetchingAttributes(true);
        try {
            const attrs = await getLayerAttributes(layer.fullName);
            setQbAttributes(attrs || []);
            if (attrs && attrs.length > 0) {
                setQbConditions([{ field: attrs[0], operator: '=', value: '', logic: 'AND' }]);
            }
        } catch (error) {
            console.error("Error fetching attributes:", error);
            toast.error("Failed to fetch layer attributes.");
        } finally {
            setIsFetchingAttributes(false);
        }
    };

    const handleApplyFilter = () => {
        if (!layer) return;

        const cql = QueryBuilderFilter(qbConditions);

        if (cql) {
            handleApplyLayerFilter(layer.id, cql);
            toast.success("Filter applied!");
        } else {
            toast.error("Please ensure all conditions have valid fields and values.");
        }
    };

    const handleResetAll = () => {
        if (!layer) return;
        setQbConditions([{ field: qbAttributes[0] || '', operator: '=', value: '', logic: 'AND' }]);
        handleApplyLayerFilter(layer.id, null);
        toast.success("Filters cleared and reset!");
    };

    const addCondition = () => {
        setQbConditions([...qbConditions, { field: qbAttributes[0] || '', operator: '=', value: '', logic: 'AND' }]);
    };

    const removeCondition = (index) => {
        if (qbConditions.length > 1) {
            setQbConditions(qbConditions.filter((_, i) => i !== index));
        } else {
            setQbConditions([{ field: qbAttributes[0] || '', operator: '=', value: '', logic: 'AND' }]);
        }
    };

    const updateCondition = (index, updates) => {
        setQbConditions(qbConditions.map((c, i) => i === index ? { ...c, ...updates } : c));
    };

    if (!isOpen || !layer) return null;

    return (
        <div className={`query-builder-card ${isMinimized ? 'minimized' : ''}`} style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            zIndex: 1000,
            width: '320px',
            background: 'rgba(var(--color-bg-primary-rgb), 0.90)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-xl)',
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            {/* Header */}
            <div style={{
                padding: '10px 14px',
                background: 'rgba(var(--color-bg-secondary-rgb), 0.3)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        padding: '5px',
                        background: 'rgba(var(--color-primary-rgb), 0.15)',
                        borderRadius: '6px',
                        color: 'var(--color-primary)'
                    }}>
                        <DatabaseZap size={14} />
                    </div>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '0.02em', color: 'var(--color-text-primary)' }}>QUERY BUILDER</div>
                        <div style={{ fontSize: '11px', opacity: 0.7, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>{layer.name}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px' }}
                    >
                        {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px' }}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {!isMinimized && (
                <div style={{ padding: '14px', maxHeight: '450px', overflowY: 'auto' }}>
                    {isFetchingAttributes ? (
                        <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Loading attributes...</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {qbConditions.map((cond, index) => (
                                <div key={index} style={{
                                    position: 'relative',
                                    background: 'rgba(var(--color-bg-secondary-rgb), 0.3)',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--color-border)'
                                }}>
                                    {/* Logic Operator Toggle */}
                                    {index > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '-10px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            background: 'var(--color-bg-secondary)',
                                            padding: '2px',
                                            borderRadius: '6px',
                                            border: '1px solid var(--color-border)',
                                            display: 'flex',
                                            gap: '2px',
                                            zIndex: 2
                                        }}>
                                            {['AND', 'OR'].map(l => (
                                                <button
                                                    key={l}
                                                    onClick={() => updateCondition(index, { logic: l })}
                                                    style={{
                                                        padding: '2px 8px',
                                                        fontSize: '9px',
                                                        fontWeight: '700',
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        background: cond.logic === l ? 'var(--color-primary)' : 'transparent',
                                                        color: cond.logic === l ? '#fff' : 'var(--color-text-muted)',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {l}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                        <div>
                                            <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '3px', textTransform: 'uppercase', fontWeight: '500' }}>Field</label>
                                            <select
                                                value={cond.field}
                                                onChange={(e) => updateCondition(index, { field: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    height: '32px',
                                                    background: 'rgba(var(--color-bg-primary-rgb), 0.2)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '6px',
                                                    color: 'var(--color-text-primary)',
                                                    fontSize: '12px',
                                                    padding: '0 6px',
                                                    outline: 'none'
                                                }}
                                            >
                                                {qbAttributes.map(attr => (
                                                    <option key={attr} value={attr} style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>{attr}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '3px', textTransform: 'uppercase', fontWeight: '500' }}>Operator</label>
                                            <select
                                                value={cond.operator}
                                                onChange={(e) => updateCondition(index, { operator: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    height: '32px',
                                                    background: 'rgba(var(--color-bg-primary-rgb), 0.2)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '6px',
                                                    color: 'var(--color-text-primary)',
                                                    fontSize: '12px',
                                                    padding: '0 6px',
                                                    outline: 'none'
                                                }}
                                            >
                                                {QB_OPERATORS.map(op => (
                                                    <option key={op.value} value={op.value} style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>{op.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '3px', textTransform: 'uppercase', fontWeight: '500' }}>Value</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                value={cond.value}
                                                onChange={(e) => updateCondition(index, { value: e.target.value })}
                                                placeholder="Enter value..."
                                                style={{
                                                    flex: 1,
                                                    height: '32px',
                                                    background: 'rgba(var(--color-bg-primary-rgb), 0.2)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '6px',
                                                    color: 'var(--color-text-primary)',
                                                    fontSize: '12px',
                                                    padding: '0 10px',
                                                    outline: 'none'
                                                }}
                                                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
                                            />
                                            {qbConditions.length > 1 && (
                                                <button
                                                    onClick={() => removeCondition(index)}
                                                    style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        background: 'rgba(var(--color-danger-rgb), 0.1)',
                                                        border: '1px solid var(--color-danger)',
                                                        borderRadius: '6px',
                                                        color: 'var(--color-danger)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={addCondition}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    background: 'rgba(var(--color-primary-rgb), 0.05)',
                                    border: '1px dashed var(--color-primary)',
                                    borderRadius: '8px',
                                    color: 'var(--color-primary)',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                <Plus size={12} /> Add Condition
                            </button>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={handleResetAll}
                                    style={{
                                        width: 'auto',
                                        padding: '8px 12px',
                                        background: 'var(--color-bg-secondary)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '8px',
                                        color: 'var(--color-text-secondary)',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <RefreshCw size={12} /> Reset
                                </button>
                                <button
                                    onClick={handleApplyFilter}
                                    style={{
                                        width: 'auto',
                                        padding: '8px 16px',
                                        background: 'var(--color-primary)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#fff',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        boxShadow: 'var(--shadow-md)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Apply Filter
                                </button>
                            </div>
                        </div>
                    )}

                    {layer.cqlFilter && (
                        <div style={{
                            marginTop: '16px',
                            padding: '10px',
                            background: 'rgba(var(--color-primary-rgb), 0.1)',
                            borderRadius: '8px',
                            border: '1px solid var(--color-primary)'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <DatabaseZap size={12} /> ACTIVE FILTER
                            </div>
                            <div style={{ fontSize: '11px', fontFamily: 'monospace', opacity: 0.8, wordBreak: 'break-all', background: 'rgba(0,0,0,0.1)', padding: '6px', borderRadius: '4px', color: 'var(--color-text-primary)' }}>
                                {layer.cqlFilter}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default QueryBuilderCard;
