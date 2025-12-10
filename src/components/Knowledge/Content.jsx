import React, { useState, useEffect } from 'react';
import { FolderIcon, ChevronRightIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { api } from '../../services/api';

export default function Content({ onArticleSelect }) {
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDocs = async () => {
            try {
                setLoading(true);
                const response = await api.documents.list();
                if (response.documents) {
                    setDocuments(response.documents);
                }
            } catch (error) {
                console.error('Failed to fetch documents:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDocs();
    }, []);

    // Group documents by type for now, as we don't have folders in DB yet
    const folders = [
        { id: 'all', name: 'All Documents', type: 'all' },
        { id: 'pdf', name: 'PDFs', type: 'application/pdf' },
        { id: 'text', name: 'Text Files', type: 'text/plain' }
    ];

    const getFilteredDocuments = (folder) => {
        if (!folder || folder.id === 'all') return documents;
        return documents.filter(doc => doc.content_type?.includes(folder.type));
    };

    const handleArticleClick = (doc) => {
        // Adapt doc to article format expected by parent
        onArticleSelect({
            id: doc.id,
            title: doc.original_name,
            content: doc.text_content || 'No content preview available.', // You might need a separate fetch for full content
            type: doc.content_type,
            lastUpdated: new Date(doc.updated_at).toLocaleDateString()
        });
    };

    const handleFolderSelect = (folder) => {
        setSelectedFolder(folder);
    };

    return (
        <>
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-4">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <FolderIcon className="w-6 h-6" />
                    Content
                </h1>
            </div>

            {/* Content Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Folder List */}
                <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto">
                    <div className="p-4 space-y-1">
                        {folders.map(folder => (
                            <button
                                key={folder.id}
                                onClick={() => handleFolderSelect(folder)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${selectedFolder?.id === folder.id
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'text-slate-700 hover:bg-slate-100'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <FolderIcon className="w-4 h-4" />
                                    <span className="truncate">{folder.name}</span>
                                </div>
                                <span className="text-xs text-slate-500">
                                    {getFilteredDocuments(folder).length}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Article List */}
                <div className="flex-1 overflow-y-auto p-8">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : selectedFolder ? (
                        getFilteredDocuments(selectedFolder).length > 0 ? (
                            <div className="max-w-3xl">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">{selectedFolder.name}</h2>
                                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-200">
                                    {getFilteredDocuments(selectedFolder).map(doc => (
                                        <button
                                            key={doc.id}
                                            onClick={() => handleArticleClick(doc)}
                                            className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
                                        >
                                            <DocumentTextIcon className="w-5 h-5 text-slate-400" />
                                            <div className="flex-1">
                                                <div className="font-medium text-slate-900">{doc.original_name}</div>
                                                <div className="text-sm text-slate-500">
                                                    {doc.content_type || 'Unknown'} · Updated {new Date(doc.updated_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <ChevronRightIcon className="w-5 h-5 text-slate-400" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <FolderIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-600">This folder is empty</p>
                            </div>
                        )
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-slate-500">Select a folder to view its contents</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
