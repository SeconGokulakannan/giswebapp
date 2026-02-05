import React from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { X, Table } from 'lucide-react';

// AG Grid Styles
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

const AttributeTableCard = ({ isOpen, onClose, layerName, data, isLoading }) => {
    if (!isOpen) return null;

    // Use features properties for columns and rows
    let columnDefs = [];
    let rowData = [];

    if (data && data.length > 0) {
        // Extract properties from the first feature to define columns
        // We look for the first feature that actually has properties
        const firstWithProps = data.find(f => f.properties && Object.keys(f.properties).length > 0);

        if (firstWithProps) {
            const firstFeatureProps = firstWithProps.properties;
            columnDefs = Object.keys(firstFeatureProps).map(key => ({
                headerName: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
                field: key,
                sortable: true,
                filter: true,
                resizable: true,
                flex: 1,
                minWidth: 100
            }));

            // Map all features to row data
            rowData = data.map(feature => ({
                id: feature.id,
                ...feature.properties
            }));
        }
    }

    return (
        <div className="attribute-table-card">
            <div className="attribute-table-header">
                <div className="header-title">
                    <Table size={14} strokeWidth={1.5} />
                    <span>ATTRIBUTE TABLE: {layerName.toUpperCase()}</span>
                </div>
                <button className="close-btn" onClick={onClose} title="Close Table">
                    <X size={14} strokeWidth={1.5} />
                </button>
            </div>
            <div className="attribute-table-content ag-theme-quartz">
                <AgGridReact
                    rowData={rowData}
                    columnDefs={columnDefs}
                    animateRows={true}
                    headerHeight={26}
                    rowHeight={24}
                    loading={isLoading}
                    pagination={true}
                    paginationPageSize={10}
                    suppressMovableColumns={false}
                    overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Fetching Attribute Data...</span>'}
                    overlayNoRowsTemplate={isLoading ? ' ' : '<span>No Data Available</span>'}
                />
            </div>
        </div>
    );
};

export default AttributeTableCard;
