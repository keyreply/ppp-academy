import React, { useState, useRef, useEffect } from 'react';
import { PlusIcon, CheckCircleIcon, ArrowPathIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { knowledgeData, copilotIntegrations } from '../../data/knowledgeData';
import IntegrationModal from './IntegrationModal';
import NewContentModal from './NewContentModal';

export default function Sources({ activeView, setActiveView, onArticleCreate }) {
    const [showModal, setShowModal] = useState(false);
    const [selectedIntegration, setSelectedIntegration] = useState(null);
    const [showNewContentModal, setShowNewContentModal] = useState(false);
    const [showLearnDropdown, setShowLearnDropdown] = useState(false);
    const [showTestDropdown, setShowTestDropdown] = useState(false);
    const learnRef = useRef(null);
    const testRef = useRef(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (learnRef.current && !learnRef.current.contains(event.target)) {
                setShowLearnDropdown(false);
            }
            if (testRef.current && !testRef.current.contains(event.target)) {
                setShowTestDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSyncImport = (integration) => {
        setSelectedIntegration(integration);
        setShowModal(true);
    };

    const renderIntegrationCard = (item, isPublic = true) => {
        return (
            <div key={item.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                    {item.status === 'connected' && (
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    )}
                    {item.status === 'syncing' && (
                        <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                            <div className="font-medium text-slate-900">
                                {item.name}
                                {item.subtitle && <span className="text-sm text-slate-500 ml-1">{item.subtitle}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {item.status === 'connected' && item.articleCount > 0 && (
                        <span className="text-sm text-slate-600">{item.articleCount} article{item.articleCount !== 1 ? 's' : ''}</span>
                    )}
                    {item.status === 'connected' ? (
                        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                            Add article
                        </button>
                    ) : item.status === 'syncing' ? (
                        <span className="text-sm text-slate-500">Syncing...</span>
                    ) : (
                        <button
                            onClick={() => handleSyncImport(item)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Sync or Import
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderAllSources = () => (
        <div className="w-full">
            {/* Public Articles */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <DocumentTextIcon className="w-6 h-6 text-slate-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">Public articles</h3>
                        <p className="text-sm text-slate-600">
                            Let Kira AI Agent and Copilot use public articles from your Help Center.
                        </p>
                    </div>
                </div>
                <div className="space-y-1">
                    {knowledgeData.sources.publicArticles.map(item => renderIntegrationCard(item, true))}
                </div>
            </div>

            {/* Internal Articles */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <FolderIcon className="w-6 h-6 text-slate-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">Internal articles</h3>
                        <p className="text-sm text-slate-600">
                            Give Copilot internal knowledge only available to you and your team.
                        </p>
                    </div>
                </div>
                <div className="space-y-1">
                    {knowledgeData.sources.internalArticles.map(item => renderIntegrationCard(item, false))}
                </div>
            </div>
        </div>
    );

    const renderCopilotView = () => (
        <div className="w-full">
            {/* Internal Articles for Copilot */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center">
                        <span className="text-white text-lg">🤖</span>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">Internal articles</h3>
                        <p className="text-sm text-slate-600">
                            Give AI Copilot internal knowledge that's only available to you and your team.
                        </p>
                    </div>
                </div>
                <div className="space-y-1">
                    {copilotIntegrations.filter(i => i.type === 'Internal articles' || !i.type).slice(0, 4).map(item => renderIntegrationCard(item))}
                </div>
            </div>

            {/* Conversations */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center">
                        <span className="text-white text-lg">💬</span>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">Conversations</h3>
                        <p className="text-sm text-slate-600">
                            Let AI Copilot learn from past conversations and customer tickets from the last 4 months.
                        </p>
                    </div>
                </div>
                <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                        <span className="text-2xl">💬</span>
                        <span className="font-medium">Intercom</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-600">All teammates' conversations</span>
                        <button className="text-sm text-slate-600 hover:text-slate-700 font-medium">
                            Manage
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-4">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <DocumentTextIcon className="w-6 h-6" />
                        Sources
                    </h1>
                    <div className="flex items-center gap-3">
                        {/* Learn Dropdown */}
                        <div className="relative" ref={learnRef}>
                            <button
                                onClick={() => setShowLearnDropdown(!showLearnDropdown)}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                            >
                                Learn
                                <ChevronDownIcon className="w-4 h-4" />
                            </button>
                            {showLearnDropdown && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                                    <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Documentation</a>
                                    <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Video tutorials</a>
                                    <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Best practices</a>
                                </div>
                            )}
                        </div>

                        {/* Test Kira Dropdown */}
                        <div className="relative" ref={testRef}>
                            <button
                                onClick={() => setShowTestDropdown(!showTestDropdown)}
                                className="text-sm text-slate-600 hover:text-slate-700 font-medium flex items-center gap-1"
                            >
                                Test Kira
                                <ChevronDownIcon className="w-4 h-4" />
                            </button>
                            {showTestDropdown && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                                    <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Test in sandbox</a>
                                    <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Run test queries</a>
                                </div>
                            )}
                        </div>

                        {/* New Content Button */}
                        <button
                            onClick={() => setShowNewContentModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                            <PlusIcon className="w-4 h-4" />
                            New content
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-6 border-b border-slate-200 -mb-4">
                    <button
                        onClick={() => setActiveView('all')}
                        className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${activeView === 'all'
                            ? 'text-blue-600 border-blue-600'
                            : 'text-slate-600 border-transparent hover:text-slate-900'
                            }`}
                    >
                        All sources
                    </button>
                    <button
                        onClick={() => setActiveView('ai-agent')}
                        className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${activeView === 'ai-agent'
                            ? 'text-blue-600 border-blue-600'
                            : 'text-slate-600 border-transparent hover:text-slate-900'
                            }`}
                    >
                        AI Agent
                    </button>
                    <button
                        onClick={() => setActiveView('copilot')}
                        className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${activeView === 'copilot'
                            ? 'text-blue-600 border-blue-600'
                            : 'text-slate-600 border-transparent hover:text-slate-900'
                            }`}
                    >
                        AI Copilot
                    </button>
                    <button
                        onClick={() => setActiveView('help-center')}
                        className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${activeView === 'help-center'
                            ? 'text-blue-600 border-blue-600'
                            : 'text-slate-600 border-transparent hover:text-slate-900'
                            }`}
                    >
                        Help Center
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                {activeView === 'all' && renderAllSources()}
                {activeView === 'copilot' && renderCopilotView()}
                {activeView === 'ai-agent' && renderAllSources()}
                {activeView === 'help-center' && (
                    <div className="text-center py-12">
                        <p className="text-slate-500">Help Center configuration coming soon...</p>
                    </div>
                )}
            </div>

            {/* Integration Modal */}
            {showModal && (
                <IntegrationModal
                    integration={selectedIntegration}
                    onClose={() => {
                        setShowModal(false);
                        setSelectedIntegration(null);
                    }}
                />
            )}

            {/* New Content Modal */}
            {showNewContentModal && (
                <NewContentModal
                    onClose={() => setShowNewContentModal(false)}
                    onCreateArticle={(article) => {
                        if (onArticleCreate) {
                            onArticleCreate(article);
                        }
                    }}
                />
            )}
        </>
    );
}

import { DocumentTextIcon, FolderIcon } from '@heroicons/react/24/outline';
