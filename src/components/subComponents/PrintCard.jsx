import React from 'react';
import { Printer, Loader2, ChevronDown } from 'lucide-react';

const PrintCard = ({
    activePanel,
    printTitle,
    setPrintTitle,
    printSubtitle,
    setPrintSubtitle,
    printFileName,
    setPrintFileName,
    exportFormat,
    setExportFormat,
    handleExportMap,
    isExporting
}) => {
    if (activePanel !== 'print') return null;

    return (
        <div className="panel-section fade-in">
            <div className="panel-section-title">Page Settings</div>
            <div className="location-tool">
                <div className="input-group">
                    <label>Main Title</label>
                    <input
                        type="text"
                        className="coordinate-input"
                        placeholder="e.g. Site Survey Plan"
                        value={printTitle}
                        onChange={(e) => setPrintTitle(e.target.value)}
                    />
                </div>
                <div className="input-group">
                    <label>Subtitle / Description</label>
                    <input
                        type="text"
                        className="coordinate-input"
                        placeholder="e.g. Section A-1 Analysis"
                        value={printSubtitle}
                        onChange={(e) => setPrintSubtitle(e.target.value)}
                    />
                </div>

                <div className="panel-divider" />
                <div className="panel-section-title">Export Settings</div>

                <div className="input-group">
                    <label>File Name</label>
                    <input
                        type="text"
                        className="coordinate-input"
                        placeholder="Map Export"
                        value={printFileName}
                        onChange={(e) => setPrintFileName(e.target.value)}
                    />
                </div>
                <div className="input-group">
                    <label>Format</label>
                    <div className="select-wrapper">
                        <select
                            className="elite-select"
                            value={exportFormat}
                            onChange={(e) => setExportFormat(e.target.value)}
                        >
                            <option value="pdf">PDF (Document)</option>
                            <option value="png">PNG (Image)</option>
                            <option value="jpg">JPG (Image)</option>
                        </select>
                        <ChevronDown className="select-chevron" size={16} />
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                    <button
                        className={`home-button ${isExporting ? 'loading' : ''}`}
                        onClick={handleExportMap}
                        disabled={isExporting}
                        style={{ width: '100%', maxWidth: '220px' }}
                    >
                        {isExporting ? (
                            <Loader2 className="animate-spin" size={18} style={{ marginRight: '8px' }} />
                        ) : (
                            <Printer size={18} style={{ marginRight: '8px' }} />
                        )}
                        <span>{isExporting ? 'Exporting...' : 'Export Map'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrintCard;
