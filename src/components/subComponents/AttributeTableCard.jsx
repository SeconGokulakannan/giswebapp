import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { X, Table, Edit, Trash2, MapPin, Grid2x2, ChevronsUpDownIcon, Play, Pause } from 'lucide-react';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

const AttributeTableCard = ({ isOpen, onClose, layerName, layerFullName, layerId, data, isLoading, onHighlightFeatures, isMinimized, onToggleMinimize, onClearHighlights, onDeleteFeature, onUpdateFeatures }) => {
    const [selectedRows, setSelectedRows] = useState([]);
    const [gridApi, setGridApi] = useState(null);
    const [isHighlighting, setIsHighlighting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [pendingChanges, setPendingChanges] = useState({}); // { rowId: { colId: newValue } }

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
    }, []);

    // Use features properties for columns and rows
    const { columnDefs, rowData } = React.useMemo(() => {


        let cols = [];
        let rows = [];

        if (data && data.length > 0) {
            const firstWithProps = data.find(f => f.properties && Object.keys(f.properties).length > 0);

            if (firstWithProps) {
                const firstFeatureProps = firstWithProps.properties;

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
                        editable: () => isEditMode,
                        valueSetter: (params) => {
                            if (!isEditMode) return false;
                            params.data[params.colDef.field] = params.newValue;
                            return true;
                        },
                        cellClass: (params) => {
                            const rowId = params.data.id;
                            if (pendingChanges[rowId] && pendingChanges[rowId].hasOwnProperty(params.colDef.field)) {
                                return 'cell-dirty';
                            }
                            return '';
                        }
                    }))
                ];

                rows = data.map((feature, idx) => {
                    const rowId = getFeatureId(feature) || `fallback-${idx}`;
                    // Important: Spread properties FIRST, then set stable id/metadata
                    const row = {
                        ...feature.properties,
                        id: rowId,
                        _feature: feature
                    };

                    // Apply pending changes
                    if (pendingChanges[rowId]) {
                        Object.assign(row, pendingChanges[rowId]);
                    }

                    return row;
                });
            }
        }
        return { columnDefs: cols, rowData: rows };
    }, [data, isEditMode, pendingChanges]);

    const handleSave = async () => {
        if (Object.keys(pendingChanges).length > 0 && onUpdateFeatures) {
            const count = Object.keys(pendingChanges).length;
            if (window.confirm(`Are you sure you want to save changes for ${count} row(s)?`)) {
                const success = await onUpdateFeatures(layerFullName, pendingChanges);
                if (success) {
                    setPendingChanges({});
                    // Explicitly refresh after clearing to be absolutely sure
                    if (gridApi) {
                        setTimeout(() => {
                            gridApi.refreshCells({ force: true });
                        }, 100);
                    }
                }
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
    const hasChanges = Object.keys(pendingChanges).length > 0;

    return (
        <div className={`attribute-table-card ${isMinimized ? 'minimized' : ''}`}>
            <div className="attribute-table-header">
                <div className="header-title">
                    <Table size={14} strokeWidth={1.5} />
                    <span>ATTRIBUTE TABLE: {layerName.toUpperCase()}</span>
                </div>
                {!isMinimized && (
                    <div className="attribute-table-actions">
                        <div className="edit-switch-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-primary)' }}>EDIT</span>
                            <label className="toggle-switch" style={{ transform: 'scale(0.7)' }}>
                                <input
                                    type="checkbox"
                                    checked={isEditMode}
                                    onChange={(e) => setIsEditMode(e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {hasChanges && (
                            <button
                                className="action-btn save-btn"
                                onClick={handleSave}
                                style={{ backgroundColor: 'var(--color-success)', color: 'white', borderColor: 'var(--color-success)' }}
                                title="Save all pending changes"
                            >
                                <Play size={12} strokeWidth={1.5} fill="currentColor" style={{ transform: 'rotate(90deg)' }} />
                                <span>Save</span>
                            </button>
                        )}

                        <button
                            className="action-btn"
                            onClick={handleDelete}
                            disabled={!hasSelection}
                            title="Delete selected features"
                        >
                            <Trash2 size={12} strokeWidth={1.5} />
                            <span>Delete</span>
                        </button>
                        <button
                            className={`action-btn ${isHighlighting ? 'highlight-btn active' : 'highlight-btn'}`}
                            onClick={handleHighlight}
                            disabled={!hasSelection && !isHighlighting}
                            title={isHighlighting ? "Stop highlighting" : "Highlight selected features on map"}
                        >
                            {isHighlighting ? <Pause size={12} strokeWidth={1.5} /> : <Play size={12} strokeWidth={1.5} />}

                            <span>{isHighlighting ? 'Stop' : 'Highlight'}</span>
                        </button>
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
            {!isMinimized && (
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
            )}
        </div>
    );
};

export default AttributeTableCard;
