import React from 'react';
import toast from 'react-hot-toast';
import { Bookmark, Trash2, MapPin } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useBookmarkTools } from '../../hooks/useBookmarkTools';

const BookmarksCard = ({
    activePanel,
}) => {
    const {
        bookmarks,
        handleAddBookmark,
        handleDeleteBookmark,
        handleNavigateToBookmark
    } = useBookmarkTools();

    if (activePanel !== 'bookmarks') return null;

    const onAddSubmit = (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            handleAddBookmark(e.target.value);
            e.target.value = '';
        }
    };

    const sortedBookmarks = [...bookmarks].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return (
        <div className="panel-section fade-in">
            <div className="panel-section-title">Add New Bookmark</div>
            <div className="location-tool" style={{ marginBottom: '24px' }}>
                <div className="input-group">
                    <label>Bookmark Name</label>
                    <input
                        type="text"
                        className="coordinate-input"
                        placeholder="e.g. Project Area A"
                        id="bookmark-name-input"
                        onKeyDown={onAddSubmit}
                    />
                </div>
                <button
                    className="goto-btn"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={() => {
                        const input = document.getElementById('bookmark-name-input');
                        if (input && input.value.trim()) {
                            handleAddBookmark(input.value);
                            input.value = '';
                        } else {
                            toast.error('Please enter a name');
                        }
                    }}
                >
                    <Bookmark size={16} /> Save Current View
                </button>
            </div>

            <div className="panel-divider" />
            <div className="panel-section-title">Saved Bookmarks ({bookmarks.length})</div>

            {bookmarks.length === 0 ? (
                <div className="no-props-hint" style={{ marginTop: '20px' }}>
                    No bookmarks saved yet.
                </div>
            ) : (
                <div className="layer-list compact-list" style={{ marginTop: '12px' }}>
                    {sortedBookmarks.map((bookmark) => (
                        <div key={bookmark.id} className="bookmark-item-elite">
                            <div className="bookmark-content">
                                <div className="bookmark-info">
                                    <span className="bookmark-name">{bookmark.name}</span>
                                    <span className="bookmark-meta">
                                        Zoom {Math.round(bookmark.zoom * 10) / 10} • {new Date(bookmark.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="bookmark-actions-elite">
                                    <Tooltip.Provider delayDuration={400}>
                                        <Tooltip.Root>
                                            <Tooltip.Trigger asChild>
                                                <button
                                                    className="bookmark-btn navigate"
                                                    onClick={() => handleNavigateToBookmark(bookmark)}
                                                >
                                                    <MapPin size={14} />
                                                </button>
                                            </Tooltip.Trigger>
                                            <Tooltip.Portal>
                                                <Tooltip.Content className="tooltip-content" side="top">
                                                    Go to Bookmark
                                                    <Tooltip.Arrow className="tooltip-arrow" />
                                                </Tooltip.Content>
                                            </Tooltip.Portal>
                                        </Tooltip.Root>

                                        <Tooltip.Root>
                                            <Tooltip.Trigger asChild>
                                                <button
                                                    className="bookmark-btn delete"
                                                    onClick={() => handleDeleteBookmark(bookmark.id)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </Tooltip.Trigger>
                                            <Tooltip.Portal>
                                                <Tooltip.Content className="tooltip-content" side="top">
                                                    Delete Bookmark
                                                    <Tooltip.Arrow className="tooltip-arrow" />
                                                </Tooltip.Content>
                                            </Tooltip.Portal>
                                        </Tooltip.Root>
                                    </Tooltip.Provider>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BookmarksCard;
