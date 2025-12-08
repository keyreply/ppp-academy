import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function NewContentModal({ onClose, onCreateArticle }) {
    const [contentType, setContentType] = useState('internal');
    const [title, setTitle] = useState('');
    const [folder, setFolder] = useState('');

    const handleCreate = () => {
        if (title.trim()) {
            onCreateArticle({
                id: `article-new-${Date.now()}`,
                title: title,
                type: contentType === 'internal' ? 'Internal article' : 'Public article',
                language: 'English',
                created: 'Just now',
                createdBy: 'You',
                lastUpdated: 'Just now',
                lastUpdatedBy: 'You',
                finEnabled: false,
                copilotEnabled: contentType === 'internal',
                audience: 'Everyone',
                tags: [],
                folder: folder || 'Your first folder',
                content: ''
            });
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                    <h2 className="text-lg font-semibold">Add content from Notion</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Step Indicators */}
                <div className="px-6 pb-6 flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.544-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        </svg>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-6">
                    {/* Choose your Notion */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Choose your Notion
                        </label>
                        <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                            <option value="">Select workspace...</option>
                        </select>
                    </div>

                    {/* Select a Notion */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Select a Notion
                        </label>
                        <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                            <option value="">Select database...</option>
                        </select>
                    </div>

                    {/* Select folders */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Select folders:
                        </label>
                        <select
                            value={folder}
                            onChange={(e) => setFolder(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                            <option value="">Your first folder</option>
                            <option value="Processes">Processes</option>
                            <option value="Pricing">Pricing</option>
                            <option value="Products Areas">Products Areas</option>
                            <option value="Security">Security</option>
                        </select>
                    </div>

                    {/* Choose how to connect your data */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">
                            Choose how to connect your data
                        </label>
                        <div className="space-y-3">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    value="sync"
                                    checked={contentType === 'internal'}
                                    onChange={(e) => setContentType('internal')}
                                    className="mt-0.5"
                                />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-slate-900">Sync content</div>
                                    <div className="text-xs text-slate-500">
                                        Sync a continuously updated view-only version of your content
                                    </div>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    value="import"
                                    checked={contentType === 'public'}
                                    onChange={(e) => setContentType('public')}
                                    className="mt-0.5"
                                />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-slate-900">Import content</div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 pb-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        className="px-4 py-2 text-sm font-medium bg-slate-200 text-slate-400 rounded-lg cursor-not-allowed"
                        disabled
                    >
                        Sync
                    </button>
                </div>
            </div>
        </div>
    );
}
