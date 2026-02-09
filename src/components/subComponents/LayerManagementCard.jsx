import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { X, LayoutGrid, Plus, Eraser, Play, Trash2, Save, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

const LayerManagementCard = ({
    isOpen,
    onClose,
    data,
    isLoading,
    onDeleteFeature,
    onUpdateFeatures,
    onSaveNewFeature,
    onRefresh
}) => {
    const [gridApi, setGridApi] = useState(null);
    const [pendingChanges, setPendingChanges] = useState({});
    const [newRows, setNewRows] = useState({});
    const [selectedRows, setSelectedRows] = useState([]);

    const onCellValueChanged = useCallback((params) => {
        const rowId = params.data.id;
        const colId = params.column.getId();
        const newValue = params.newValue;
        const oldValue = params.oldValue;

        if (newValue === oldValue) return;

        if (String(rowId).startsWith('new-')) {
            setNewRows(prev => ({
                ...prev,
                [rowId]: {
                    ...prev[rowId],
                    [colId]: newValue
                }
            }));
        } else {
            setPendingChanges(prev => ({
                ...prev,
                [rowId]: {
                    ...(prev[rowId] || {}),
                    [colId]: newValue
                }
            }));
        }
    }, []);

    const getFeatureId = (feature) => {
        if (!feature) return null;
        const id = feature.id || (feature.properties && (feature.properties.id || feature.properties.fid));
        return id !== undefined && id !== null ? String(id) : null;
    };

    const { columnDefs, rowData } = useMemo(() => {
        if (!data || data.length === 0) {
            // Default columns if no data is available yet
            const defaultKeys = ['LayerName', 'LayerSequenceNo', 'IsShowLayer', 'LayerVisibilityOnLoad', 'GeometryType', 'GeometryFieldName', 'AttributeTableName', 'AttributeTableSchema', 'SRId'];
            return {
                columnDefs: [
                    { headerName: '', checkboxSelection: true, headerCheckboxSelection: true, width: 50, pinned: 'left' },
                    ...defaultKeys.map(key => ({
                        headerName: key,
                        field: key,
                        editable: true,
                        cellClass: (params) => String(params.data.id).startsWith('new-') ? 'cell-dirty' : ''
                    }))
                ],
                rowData: Object.keys(newRows).map(id => ({ ...newRows[id], id, _isNew: true }))
            };
        }

        const firstFeatureProps = data[0].properties;
        const cols = [
            {
                headerName: '',
                checkboxSelection: true,
                headerCheckboxSelection: true,
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
                editable: true,
                cellClass: (params) => {
                    const rowId = params.data.id;
                    if (rowId && String(rowId).startsWith('new-')) return 'cell-dirty';
                    if (pendingChanges[rowId] && pendingChanges[rowId].hasOwnProperty(params.colDef.field)) {
                        return 'cell-dirty';
                    }
                    return '';
                }
            }))
        ];

        let rows = data.map((feature, idx) => {
            const rowId = getFeatureId(feature) || `fallback-${idx}`;
            const row = {
                ...feature.properties,
                id: rowId,
                _feature: feature
            };
            if (pendingChanges[rowId]) {
                Object.assign(row, pendingChanges[rowId]);
            }
            return row;
        });

        Object.keys(newRows).forEach(newId => {
            rows.unshift({
                ...newRows[newId],
                id: newId,
                _isNew: true
            });
        });

        return { columnDefs: cols, rowData: rows };
    }, [data, pendingChanges, newRows]);

    if (!isOpen) return null;

    const layerFullName = 'gisweb:Layer';

    const handleSave = async () => {
        let successCount = 0;

        // 1. Handle New Rows
        const newRowIds = Object.keys(newRows);
        if (newRowIds.length > 0) {
            for (const id of newRowIds) {
                const row = { ...newRows[id] };
                delete row.id;
                delete row._isSession;

                const success = await onSaveNewFeature(layerFullName, row);
                if (success) successCount++;
            }

            if (successCount > 0) {
                toast.success(`Created ${successCount} new persistent configuration(s).`);
                setNewRows({});
            }
        }

        // 2. Handle Updates
        const updateIds = Object.keys(pendingChanges);
        if (updateIds.length > 0) {
            if (window.confirm(`Save changes for ${updateIds.length} row(s)?`)) {
                const success = await onUpdateFeatures(layerFullName, pendingChanges);
                if (success) {
                    toast.success("Updated existing configurations.");
                    setPendingChanges({});
                }
            }
        }

        if (onRefresh) onRefresh();
    };

    const handleAddRow = () => {
        const newId = `new-${Date.now()}`;
        setNewRows(prev => ({
            ...prev,
            [newId]: {
                LayerName: '',
                LayerSequenceNo: 999,
                IsShowLayer: true,
                LayerVisibilityOnLoad: false
            }
        }));
    };

    const handleDelete = async () => {
        if (selectedRows.length === 0) return;
        if (window.confirm(`Delete ${selectedRows.length} configuration(s)?`)) {
            for (const row of selectedRows) {
                if (row._feature) {
                    await onDeleteFeature(layerFullName, row._feature);
                }
            }
            setSelectedRows([]);
            if (onRefresh) onRefresh();
        }
    };

    const onSelectionChanged = (event) => {
        setSelectedRows(event.api.getSelectedRows());
    };

    const onGridReady = (params) => {
        setGridApi(params.api);
    };

    return (
        <div className="layer-management-overlay">
            <div className="attribute-table-card layer-management-card">
                <div className="attribute-table-header">
                    <div className="header-title">
                        <LayoutGrid size={14} strokeWidth={1.5} />
                        <span>LAYER MANAGEMENT (gisweb:Layer)</span>
                    </div>
                    <div className="attribute-table-actions">
                        <button className="action-btn btn-add" onClick={() => handleAddRow()}>
                            <Plus size={12} strokeWidth={1.5} />
                            <span>Add Row</span>
                        </button>
                        {(Object.keys(pendingChanges).length > 0 || Object.keys(newRows).length > 0) && (
                            <>
                                <button className="action-btn btn-discard" onClick={() => { setPendingChanges({}); setNewRows({}); }}>
                                    <Eraser size={12} strokeWidth={1.5} />
                                    <span>Discard</span>
                                </button>
                                <button className="action-btn btn-save" onClick={handleSave}>
                                    <Save size={12} strokeWidth={1.5} />
                                    <span>Save</span>
                                </button>
                            </>
                        )}
                        {selectedRows.length > 0 && (
                            <button className="action-btn btn-delete" onClick={handleDelete}>
                                <Trash2 size={12} strokeWidth={1.5} />
                                <span>Delete</span>
                            </button>
                        )}
                        <button className="action-btn" onClick={onRefresh} title="Refresh data">
                            <RefreshCw size={12} strokeWidth={1.5} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={14} strokeWidth={1.5} />
                    </button>
                </div>
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
                        suppressRowClickSelection={true}
                        rowSelection="multiple"
                        onSelectionChanged={onSelectionChanged}
                        onCellValueChanged={onCellValueChanged}
                        onGridReady={onGridReady}
                        getRowId={(params) => params.data.id}
                        defaultColDef={{
                            sortable: true,
                            filter: true,
                            resizable: true,
                            cellStyle: { textAlign: 'center' }
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default LayerManagementCard;
