import React from 'react';
import { Globe } from 'lucide-react';
import MapActionItems from './MapActionItems';
import { getNavSections } from '../../constants/MapControlConfig';

const PrimarySidebar = (props) => {
    const sections = getNavSections(props);

    return (
        <div className="primary-sidebar-redesign">
            {/* Brand / Logo Area */}
            <div className="sidebar-header-redesign">
                <div className="brand-logo-small">
                    <Globe size={18} color="white" />
                </div>
                <span className="brand-name">GIS Portal</span>
            </div>

            <MapActionItems sections={sections} variant="list" />

            <div className="sidebar-footer-redesign">
                <span className="footer-version">All rights reserved by SECON</span>
            </div>
        </div>
    );
};

export default PrimarySidebar;
