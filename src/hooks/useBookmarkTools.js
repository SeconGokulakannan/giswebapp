import { useState, useCallback, useEffect, useContext } from 'react';
import toast from 'react-hot-toast';
import { getCookie, setCookie, getUniqueCookieKey } from '../utils/cookieHelpers';
import { useMap } from '../context/MapContext';

export const useBookmarkTools = () => {
    const { mapInstanceRef } = useMap();
    const [bookmarks, setBookmarks] = useState(() => {
        const key = getUniqueCookieKey('gis_bookmarks');
        const saved = getCookie(key);
        return saved || [];
    });

    // Persistent sync with cookies whenever bookmarks change
    useEffect(() => {
        const key = getUniqueCookieKey('gis_bookmarks');
        setCookie(key, bookmarks, 7);
    }, [bookmarks]);

    const handleAddBookmark = useCallback((name) => {
        if (!mapInstanceRef.current) return;
        const view = mapInstanceRef.current.getView();
        const newBookmark = {
            id: Date.now().toString(),
            name: name,
            center: view.getCenter(),
            zoom: view.getZoom(),
            timestamp: new Date().toISOString()
        };
        setBookmarks(prev => [...prev, newBookmark]);
        toast.success('Bookmark added successfully');
    }, [mapInstanceRef]);

    const handleDeleteBookmark = useCallback((id) => {
        setBookmarks(prev => prev.filter(b => b.id !== id));
        toast.success('Bookmark deleted');
    }, []);

    const handleNavigateToBookmark = useCallback((bookmark) => {
        if (!mapInstanceRef.current) return;
        mapInstanceRef.current.getView().animate({
            center: bookmark.center,
            zoom: bookmark.zoom,
            duration: 1200
        });
    }, [mapInstanceRef]);

    return {
        bookmarks,
        handleAddBookmark,
        handleDeleteBookmark,
        handleNavigateToBookmark
    };
};
