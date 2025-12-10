import React, { useState, useEffect } from 'react';
import {
    ArrowLeftIcon,
    MagnifyingGlassIcon,
    CloudArrowUpIcon,
    DocumentIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationCircleIcon,
    TrashIcon
} from '@heroicons/react/24/outline';
import { api } from '../../services/api';

const KnowledgeBase = ({ onBack }) => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const response = await api.documents.list();
            if (response.documents) {
                // Map API response to UI model
                const mappedFiles = response.documents.map(doc => ({
                    id: doc.id,
                    name: doc.original_name,
                    size: formatSize(doc.file_size),
                    type: doc.content_type || 'Unknown',
                    status: doc.status === 'ready' ? 'indexed' : doc.status,
                    date: new Date(doc.uploaded_at).toLocaleDateString(),
                    active: true, // Default to active for now
                    raw: doc
                }));
                setFiles(mappedFiles);
            }
        } catch (error) {
            console.error('Failed to fetch documents:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            setUploading(true);
            await api.documents.upload(file);
            await fetchDocuments(); // Refresh list
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload file. Please try again.');
        } finally {
            setUploading(false);
            event.target.value = null; // Reset input
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this document?')) return;

        try {
            await api.documents.delete(id);
            setFiles(files.filter(f => f.id !== id));
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    const toggleFile = (id) => {
        setFiles(files.map(f => f.id === id ? { ...f, active: !f.active } : f));
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const filteredFiles = files.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="h-[60px] px-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-1.5 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h3 className="font-semibold text-sm text-gray-900">Knowledge Base</h3>
                        <p className="text-[10px] text-gray-500">{files.filter(f => f.active).length} of {files.length} sources active</p>
                    </div>
                </div>
                <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                    Manage
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 p-4 bg-white border-b border-gray-200">
                {[
                    { label: 'Total', value: files.length, color: 'text-gray-900' },
                    { label: 'Indexed', value: files.filter(f => f.status === 'indexed').length, color: 'text-green-600' },
                    { label: 'Active', value: files.filter(f => f.active).length, color: 'text-indigo-600' },
                    { label: 'Docs', value: files.length, color: 'text-purple-600' }
                ].map((stat, i) => (
                    <div key={i} className="text-center p-2 bg-gray-50 rounded-xl">
                        <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="p-4 space-y-3">
                <label className={`w-full bg-[#6366F1] text-white py-2.5 rounded-xl font-medium text-sm shadow-sm hover:bg-[#534be0] transition-colors flex items-center justify-center gap-2 cursor-pointer ${uploading ? 'opacity-70 pointer-events-none' : ''}`}>
                    <CloudArrowUpIcon className={`w-5 h-5 ${uploading ? 'animate-bounce' : ''}`} />
                    {uploading ? 'Uploading...' : 'Upload New File'}
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt,.md" />
                </label>

                <div className="relative">
                    <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>

                <div className="flex items-center gap-2 px-1">
                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-xs text-gray-500 font-medium">Select all</span>
                </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : filteredFiles.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        No documents found
                    </div>
                ) : filteredFiles.map((file) => (
                    <div key={file.id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:border-indigo-200 transition-colors group relative">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={file.active}
                                    onChange={() => toggleFile(file.id)}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                                />
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-500`}>
                                    <DocumentIcon className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 line-clamp-1">{file.name}</div>
                                    <div className="text-[10px] text-gray-400 flex items-center gap-1.5">
                                        <span className="uppercase">{file.type.split('/').pop()}</span>
                                        <span>•</span>
                                        <span>{file.size}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => handleDelete(file.id, e)}
                                    className="p-1 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => toggleFile(file.id)}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${file.active ? 'bg-indigo-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform duration-200 ${file.active ? 'left-6' : 'left-1'
                                        }`} />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-2">
                            <div className={`flex items-center gap-1 text-[10px] font-medium ${file.status === 'indexed' ? 'text-green-600' :
                                    file.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                                }`}>
                                {file.status === 'indexed' ? (
                                    <>
                                        <CheckCircleIcon className="w-3 h-3" />
                                        <span>Indexed</span>
                                    </>
                                ) : file.status === 'failed' ? (
                                    <>
                                        <ExclamationCircleIcon className="w-3 h-3" />
                                        <span>Failed</span>
                                    </>
                                ) : (
                                    <>
                                        <ClockIcon className="w-3 h-3 animate-pulse" />
                                        <span>{file.status}</span>
                                    </>
                                )}
                            </div>
                            <div className="text-[10px] text-gray-400">{file.date}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default KnowledgeBase;
