import React from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { X, Table } from 'lucide-react';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

const AttributeTableCard = ({ isOpen, onClose, layerName, data }) => {
    if (!isOpen) return null;

    // Define column definitions (stub for now)
    const columnDefs = [
        { headerName: "Property", field: "property", flex: 1 },
        { headerName: "Value", field: "value", flex: 2 }
    ];

    // Define row data (stub for now)
    const rowData = [
        { property: "Layer Name", value: layerName },
        { property: "Status", value: "Loading attributes..." }
    ];

    return (
        <div className="attribute-table-card fade-in">
            <div className="attribute-table-header">
                <div className="header-title">
                    <Table size={18} />
                    <span>Attribute Table: {layerName}</span>
                </div>
                <button className="close-btn" onClick={onClose}>
                    <X size={18} />
                </button>
            </div>
            <div className="attribute-table-content ag-theme-quartz">
                <AgGridReact
                    rowData={rowData}
                    columnDefs={columnDefs}
                    domLayout='autoHeight'
                    animateRows={true}
                />
                <div className="stub-notice">
                    <p>Note: GetLayerAttributes({layerName}) called. Data will be fetched from server in the next step.</p>
                </div>
            </div>
        </div>
    );
};

export default AttributeTableCard;
