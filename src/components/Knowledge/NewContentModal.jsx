import React, { useState, useRef } from 'react';
import { XMarkIcon, DocumentArrowUpIcon, LinkIcon } from '@heroicons/react/24/outline';
import { api } from '../../services/api';

export default function NewContentModal({ onClose, onCreateArticle }) {
    const [activeTab, setActiveTab] = useState('upload'); // upload, import
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        try {
            const response = await api.documents.upload(file);
            console.log("Upload response:", response);

            if (onCreateArticle) {
                onCreateArticle({
                    id: response.id,
                    title: response.filename,
                    type: 'Document',
                    status: 'processing',
                    source: 'Upload',
                    created: new Date().toISOString()
                });
            }
            onClose();
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Failed to upload file. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">Add New Content</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-6">
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`py-3 mr-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'upload'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <DocumentArrowUpIcon className="w-4 h-4" />
                            Upload File
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('import')}
                        className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'import'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <LinkIcon className="w-4 h-4" />
                            Import Link
                        </div>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {activeTab === 'upload' ? (
                        <div className="space-y-4">
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${file ? 'border-blue-200 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                    }`}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept=".pdf,.docx,.txt,.md"
                                />
                                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                                    <DocumentArrowUpIcon className="w-6 h-6" />
                                </div>
                                {file ? (
                                    <div>
                                        <p className="font-medium text-gray-900">{file.name}</p>
                                        <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                        <p className="text-xs text-blue-600 mt-2">Click to replace</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-medium text-gray-900">Click to upload or drag & drop</p>
                                        <p className="text-sm text-gray-500 mt-1">PDF, DOCX, TXT up to 10MB</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Web Page URL
                                </label>
                                <input
                                    type="url"
                                    value={importUrl}
                                    onChange={(e) => setImportUrl(e.target.value)}
                                    placeholder="https://example.com/article"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    We'll extract text from this page to add to your knowledge base.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={uploading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={activeTab === 'upload' ? handleUpload : onClose}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${uploading || (activeTab === 'upload' && !file)
                                ? 'bg-blue-300 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-sm'
                            }`}
                        disabled={uploading || (activeTab === 'upload' && !file)}
                    >
                        {uploading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            activeTab === 'upload' ? 'Upload Content' : 'Import Link'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
