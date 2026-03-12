import { useState } from 'react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useMap } from '../context/MapContext';

export const usePrintTools = (mapContainerRef) => {
    const { theme } = useMap();
    const [printTitle, setPrintTitle] = useState('');
    const [printSubtitle, setPrintSubtitle] = useState('');
    const [printFileName, setPrintFileName] = useState('Map');
    const [exportFormat, setExportFormat] = useState('pdf');
    const [isExporting, setIsExporting] = useState(false);

    const handleExportMap = async () => {
        if (!mapContainerRef.current) return;

        setIsExporting(true);
        try {
            // Capture the map container
            const canvas = await html2canvas(mapContainerRef.current, {
                useCORS: true,
                backgroundColor: theme === 'dark' ? '#111' : '#fff'
            });

            const fileName = printFileName || 'Map';
            const fullFileName = fileName.toLowerCase().endsWith(`.${exportFormat}`) ? fileName : `${fileName}.${exportFormat}`;

            if (exportFormat === 'pdf') {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('l', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                // Calculate image dimensions to fit page (maintaining aspect ratio)
                const imgProps = pdf.getImageProperties(imgData);
                const imgWidth = pdfWidth - 20; // 10mm margin on each side
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

                // Header Section
                pdf.setFillColor(theme === 'dark' ? 20 : 245);
                pdf.rect(0, 0, pdfWidth, 40, 'F');

                // Title
                pdf.setTextColor(theme === 'dark' ? 255 : 33);
                pdf.setFontSize(22);
                pdf.text(printTitle || 'GIS Map Export', 10, 20);

                // Subtitle
                pdf.setFontSize(12);
                pdf.setTextColor(theme === 'dark' ? 180 : 100);
                pdf.text(printSubtitle || `Generated on ${new Date().toLocaleString()}`, 10, 30);

                // The Map Image
                pdf.addImage(imgData, 'PNG', 10, 45, imgWidth, imgHeight);

                // Footer
                pdf.setFontSize(10);
                pdf.setTextColor(150);
                pdf.text('Generated via GIS Workspace', 10, pdfHeight - 10);

                pdf.save(fullFileName);
            } else {
                // Image formats (PNG/JPG)
                const link = document.createElement('a');
                link.download = fullFileName;
                link.href = canvas.toDataURL(`image/${exportFormat === 'jpg' ? 'jpeg' : 'png'}`);
                link.click();
            }

            toast.success('Map exported successfully!');
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to generate export. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    return {
        printTitle,
        setPrintTitle,
        printSubtitle,
        setPrintSubtitle,
        printFileName,
        setPrintFileName,
        exportFormat,
        setExportFormat,
        isExporting,
        handleExportMap
    };
};
