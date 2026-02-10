import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { X, Table, Edit, Trash2, MapPin, Grid2x2, Plus, ChevronsUpDownIcon, Play, Pause, Eraser, Square, Activity, Circle, HelpCircle, LayoutGrid } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

const AttributeTableCard = ({ isOpen, onClose, layerName, layerFullName, layerId, data, isLoading, onHighlightFeatures, isMinimized, onToggleMinimize, onClearHighlights, onDeleteFeature, onUpdateFeatures, drawings, onSaveNewAttribute, isReadOnly = false, geometryName = 'geom' }) => {
    const [selectedRows, setSelectedRows] = useState([]);
    const [gridApi, setGridApi] = useState(null);
    const [isHighlighting, setIsHighlighting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [pendingChanges, setPendingChanges] = useState({}); // { rowId: { colId: newValue } }

    // Add Feature State (Inline)
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [newRows, setNewRows] = useState({}); // { rowId: { drawingId, ...data } }

    if (!isOpen) return null;

    // Extract consistent ID from a feature
    const getFeatureId = (feature) => {
        if (!feature) return null;
        const id = feature.id || (feature.properties && (feature.properties.id || feature.properties.fid));
        return id !== undefined && id !== null ? String(id) : null;
    };

    const onCellValueChanged = React.useCallback((params) => {
        const rowId = params.data.id;
        const colId = params.column.getId();
        const newValue = params.newValue;
        const oldValue = params.oldValue;

        if (newValue === oldValue) return;


        // Check if it's a new row or existing row update
        if (rowId.toString().startsWith('new-')) {
            setNewRows(prev => ({
                ...prev,
                [rowId]: {
                    ...prev[rowId],
                    [colId]: newValue
                }
            }));
        } else {
            setPendingChanges(prev => {
                const newChanges = {
                    ...prev,
                    [rowId]: {
                        ...(prev[rowId] || {}),
                        [colId]: newValue
                    }
                };
                return newChanges;
            });
        }
    }, []);

    // Use features properties for columns and rows
    const { columnDefs, rowData } = React.useMemo(() => {
        let cols = [];
        let rows = [];

        // 1. Determine Columns (from existing data or fallback if empty but have new rows?)
        // If data is empty, we might need a default schema or wait for data.
        // Assuming data exists for now.
        const referenceData = (data && data.length > 0) ? data[0] : null;

        if (referenceData || (Object.keys(newRows).length > 0)) {
            // If no data but we have new rows, we might need a way to get columns. 
            // For now, rely on referenceData. 
            // If data is empty, we can't easily guess columns without DescribeFeatureType (server side).
            // Fallback: If no data, we can't render columns easily unless we track schema separately.

            const firstFeature = referenceData || Object.values(newRows)[0];
            const firstFeatureProps = firstFeature?.properties || firstFeature || {};

            cols = [
                {
                    headerName: '',
                    checkboxSelection: (params) => !isEditMode,
                    headerCheckboxSelection: !isEditMode,
                    width: 50,
                    pinned: 'left',
                    lockPosition: true,
                    suppressMovable: true,
                    filter: false,
                    resizable: true,
                    suppressMenu: true,
                },
                ...Object.keys(firstFeatureProps).map(key => ({
                    headerName: key,
                    field: key,
                    sortable: true,
                    filter: true,
                    resizable: true,
                    // Editable if Edit Mode OR if it's a new row, AND not Read Only
                    editable: (params) => !isReadOnly && (isEditMode || (params.data.id && String(params.data.id).startsWith('new-'))),
                    // Ensure value setter updates correctly
                    valueSetter: (params) => {
                        const isNew = String(params.data.id).startsWith('new-');
                        if (!isEditMode && !isNew) return false;
                        params.data[params.colDef.field] = params.newValue;
                        return true;
                    },
                    cellClass: (params) => {
                        const rowId = params.data.id;
                        if (rowId && String(rowId).startsWith('new-')) return 'cell-dirty'; // Mark all new row cells as dirty/editable visual
                        if (pendingChanges[rowId] && pendingChanges[rowId].hasOwnProperty(params.colDef.field)) {
                            return 'cell-dirty';
                        }
                        return '';
                    }
                }))
            ];

            // 2. Build Row Data (Existing + New)

            // Existing Features
            rows = data ? data.map((feature, idx) => {
                const rowId = getFeatureId(feature) || `fallback-${idx}`;
                const row = {
                    ...(feature.properties || {}),
                    id: rowId,
                    _feature: feature
                };
                if (pendingChanges[rowId]) {
                    Object.assign(row, pendingChanges[rowId]);
                }
                return row;
            }) : [];

            // Append New Rows
            Object.keys(newRows).forEach(newId => {
                const newRowData = newRows[newId];
                rows.unshift({ // Add to top
                    ...(newRowData?.properties || newRowData || {}),
                    id: newId,
                    _isNew: true
                });
            });
        }
        return { columnDefs: cols, rowData: rows };
    }, [data, isEditMode, pendingChanges, newRows]);

    const handleSave = async () => {
        // 1. Handle New Rows (Inserts)
        const newRowIds = Object.keys(newRows);
        if (newRowIds.length > 0) {
            let insertSuccessCount = 0;
            for (const id of newRowIds) {
                const row = newRows[id];
                const drawingId = row.drawingId;
                const attributes = { ...row };
                delete attributes.drawingId; // Clean up internal keys if any other exist

                // Call server add — clean internal keys before sending
                if (onSaveNewAttribute) {
                    // Remove all internal/UI-only keys that shouldn't be sent as WFS properties
                    delete attributes._isNew;
                    delete attributes._feature;
                    delete attributes.id;
                    const success = await onSaveNewAttribute(layerFullName, attributes, drawingId, geometryName);
                    if (success) insertSuccessCount++;
                }
            }

            if (insertSuccessCount > 0) {
                toast.success(`Saved ${insertSuccessCount} new feature(s).`);
                setNewRows({}); // Clear new rows on success
            }
        }

        // 2. Handle Updates
        if (Object.keys(pendingChanges).length > 0 && onUpdateFeatures) {
            const count = Object.keys(pendingChanges).length;
            // Only confirm if we didn't just add rows, or just always confirm updates
            if (window.confirm(`Are you sure you want to save changes for ${count} existing row(s)?`)) {
                const success = await onUpdateFeatures(layerFullName, pendingChanges);
                if (success) {
                    setPendingChanges({});
                }
            }
        }

        // Refresh grid
        if (gridApi) {
            setTimeout(() => {
                gridApi.refreshCells({ force: true });
            }, 100);
        }
    };

    const handleAddFeature = (drawing) => {
        // Reset Modes to Default
        setIsEditMode(false);
        if (isHighlighting) {
            setIsHighlighting(false);
            if (onClearHighlights) {
                try { onClearHighlights(); } catch (e) { console.error(e); }
            }
        }
        if (gridApi) {
            gridApi.deselectAll();
        }

        // Create a new blank row with all columns pre-populated
        const newId = `new-${Date.now()}`;
        // Initialize all columns from existing data so cells are visible and editable
        const initialData = { drawingId: drawing.id };
        if (data && data.length > 0 && data[0].properties) {
            Object.keys(data[0].properties).forEach(key => {
                // Skip geometry columns — they come from the drawing
                const lowKey = key.toLowerCase();
                if (lowKey === 'geom' || lowKey === 'the_geom' || lowKey === 'geometry') return;

                // Initialize all fields as empty strings
                // Empty strings will be skipped in Server.js, letting the database handle defaults
                initialData[key] = '';
            });
        }
        setNewRows(prev => ({
            ...prev,
            [newId]: initialData
        }));
        setIsAddMenuOpen(false);
        toast.success(`Added new row for ${drawing.name}. Please enter attributes.`);
    };

    const handleClearAll = () => {
        if (Object.keys(pendingChanges).length > 0 || Object.keys(newRows).length > 0) {
            if (window.confirm("Are you sure you want to discard all unsaved changes and new rows?")) {
                setPendingChanges({});
                setNewRows({});
                if (gridApi) {
                    gridApi.refreshCells({ force: true });
                }
                toast.success("Changes discarded");
            }
        }
    };

    // Clear selection and highlighting when switching mode
    React.useEffect(() => {
        if (gridApi) {
            gridApi.deselectAll();
        }
        setSelectedRows([]);
        setIsHighlighting(false);
        if (onClearHighlights) {
            try {
                onClearHighlights();
            } catch (error) {
                console.error('Error clearing highlights on mode change:', error);
            }
        }
    }, [isEditMode]);

    React.useEffect(() => {
        if (gridApi) {
            gridApi.refreshCells({ force: true });
        }
    }, [pendingChanges, gridApi]);

    const onSelectionChanged = (event) => {
        const selected = event.api.getSelectedRows();
        setSelectedRows(selected);
        // Reset highlighting state when selection changes
        if (isHighlighting) {
            setIsHighlighting(false);
            if (onClearHighlights) {
                try {
                    onClearHighlights();
                } catch (error) {
                    console.error('Error clearing highlights on selection change:', error);
                }
            }
        }
    };

    const onGridReady = (params) => {
        setGridApi(params.api);
    };

    const handleHighlight = () => {
        if (isHighlighting) {
            // Stop highlighting
            setIsHighlighting(false);
            if (onClearHighlights) {
                try {
                    onClearHighlights();
                } catch (error) {
                    console.error('Error clearing highlights:', error);
                }
            }
        } else {
            // Start highlighting
            if (selectedRows.length > 0 && onHighlightFeatures) {
                const features = selectedRows.map(row => row._feature).filter(f => f);
                onHighlightFeatures(features);
                setIsHighlighting(true);
            }
        }
    };

    const handleDelete = async () => {
        if (selectedRows.length > 0) {
            const confirmed = window.confirm(`Are you sure you want to delete ${selectedRows.length} selected feature(s)? This action cannot be undone.`);

            if (confirmed && onDeleteFeature) {
                // Extract original features
                const features = selectedRows.map(row => row._feature).filter(f => f);

                for (const feature of features) {
                    await onDeleteFeature(layerFullName, feature);
                }

                // Clear selection after deletion
                setSelectedRows([]);
            }
        }
    };

    const hasSelection = selectedRows.length > 0;
    const hasChanges = Object.keys(pendingChanges).length > 0 || Object.keys(newRows).length > 0;

    const getShapeIcon = (type) => {
        if (!type) return <HelpCircle size={14} style={{ marginRight: '8px' }} />;
        const lowerType = type.toLowerCase();
        if (lowerType.includes('polygon') || lowerType.includes('rectangle') || lowerType.includes('box')) {
            return <Square size={14} style={{ marginRight: '8px' }} />;
        } else if (lowerType.includes('line')) {
            return <Activity size={14} style={{ marginRight: '8px' }} />;
        } else if (lowerType.includes('point') || lowerType.includes('circle')) {
            return <Circle size={14} style={{ marginRight: '8px' }} />;
        }
        return <HelpCircle size={14} style={{ marginRight: '8px' }} />;
    };

    return (
        <div className={`attribute-table-card ${isMinimized ? 'minimized' : ''}`}>
            <div className="attribute-table-header">
                <div className="header-title">
                    <LayoutGrid size={14} strokeWidth={1.5} />
                    <span>ATTRIBUTE TABLE: {layerName.toUpperCase()}</span>
                </div>
                {!isMinimized && (
                    <div className="attribute-table-actions">
                        {/* New Add Button - Only show if not read-only */}
                        {!isReadOnly && (
                            <div className="actions-group" style={{ position: 'relative' }}>
                                <button
                                    className="action-btn btn-add"
                                    onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                                    title="Add new attribute"
                                >
                                    <Plus size={12} strokeWidth={1.5} />
                                    <span>Add</span>
                                </button>
                                {isAddMenuOpen && (
                                    <div className="elite-dropdown-menu">
                                        <div className="elite-dropdown-header">
                                            <span>Select Drawing</span>
                                            <button className="dropdown-close-btn" onClick={() => setIsAddMenuOpen(false)}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                        {drawings && drawings.length > 0 ? (
                                            drawings.map(d => (
                                                <button
                                                    key={d.id}
                                                    className="elite-dropdown-item"
                                                    onClick={() => handleAddFeature(d)}
                                                >
                                                    {getShapeIcon(d.type)}
                                                    {d.name}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="elite-dropdown-empty">No drawings found</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {!isReadOnly && (
                            <div className="edit-switch-container">
                                <span style={{ fontSize: '11px', fontWeight: 600 }}>Edit</span>
                                <label className="toggle-switch" style={{ transform: 'scale(0.7)' }}>
                                    <input
                                        type="checkbox"
                                        checked={isEditMode}
                                        onChange={(e) => setIsEditMode(e.target.checked)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        )}

                        {hasChanges && !isReadOnly && (
                            <>
                                <div className="actions-group">
                                    <button
                                        className="action-btn btn-discard"
                                        onClick={handleClearAll}
                                        title="Discard all pending changes"
                                    >
                                        <Eraser size={12} strokeWidth={1.5} />
                                        <span>Discard</span>
                                    </button>
                                </div>
                                <div className="actions-group">
                                    <button
                                        className="action-btn btn-save"
                                        onClick={handleSave}
                                        title="Save all pending changes"
                                    >
                                        <Play size={12} strokeWidth={1.5} fill="currentColor" style={{ transform: 'rotate(90deg)' }} />
                                        <span>Save</span>
                                    </button>
                                </div>
                            </>
                        )}

                        {!isReadOnly && (
                            <div className="actions-group">
                                <button
                                    className="action-btn btn-delete"
                                    onClick={handleDelete}
                                    disabled={!hasSelection}
                                    title="Delete selected features"
                                >
                                    <Trash2 size={12} strokeWidth={1.5} />
                                    <span>Delete</span>
                                </button>
                            </div>
                        )}

                        <div className="actions-group">
                            <button
                                className={`action-btn btn-highlight ${isHighlighting ? 'active' : ''}`}
                                onClick={handleHighlight}
                                disabled={!hasSelection && !isHighlighting}
                                title={isHighlighting ? "Stop highlighting" : "Highlight selected features on map"}
                            >
                                {isHighlighting ? <Pause size={12} strokeWidth={1.5} /> : <Play size={12} strokeWidth={1.5} />}

                                <span>{isHighlighting ? 'Stop' : 'Highlight'}</span>
                            </button>
                        </div>
                    </div>
                )}
                <button
                    className="minimize-btn" style={{ marginLeft: '10px' }}
                    onClick={onToggleMinimize}
                    title={isMinimized ? "Expand Table" : "Minimize Table"}
                >
                    <ChevronsUpDownIcon size={14} strokeWidth={1.5} />
                </button>
                <button className="close-btn" onClick={onClose} title="Close Table">
                    <X size={14} strokeWidth={1.5} />
                </button>
            </div>
            {
                !isMinimized && (
                    <div className="attribute-table-content ag-theme-alpine">
                        <AgGridReact
                            rowData={rowData}
                            columnDefs={columnDefs}
                            animateRows={true}
                            headerHeight={26}
                            rowHeight={24}
                            loading={isLoading}
                            pagination={true}
                            paginationPageSize={10}
                            paginationPageSizeSelector={[10, 20, 50, 100]}
                            suppressMovableColumns={false}
                            rowSelection="multiple"
                            suppressRowClickSelection={true}
                            stopEditingWhenCellsLoseFocus={true}
                            suppressScrollOnNewData={true}
                            onSelectionChanged={onSelectionChanged}
                            onCellValueChanged={onCellValueChanged}
                            onGridReady={onGridReady}
                            getRowId={(params) => params.data.id || `row-${params.node.rowIndex}`}
                            getRowClass={(params) => {
                                if (pendingChanges[params.data.id]) {
                                    return 'row-dirty';
                                }
                                return '';
                            }}
                            defaultColDef={{
                                sortable: true,
                                filter: true,
                                resizable: true,
                                floatingFilter: true,
                                cellStyle: { textAlign: 'center' }
                            }}
                            autoSizeStrategy={{
                                type: 'fitCellContents'
                            }}
                            onFirstDataRendered={(params) => {
                                params.api.autoSizeAllColumns();
                            }}
                            overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Fetching Attribute Data...</span>'}
                            overlayNoRowsTemplate={isLoading ? ' ' : '<span>No Data Available</span>'}
                        />
                    </div>
                )
            }


        </div >
    );
};

export default AttributeTableCard;
