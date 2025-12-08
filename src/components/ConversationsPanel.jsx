import React from 'react';
import { PlayIcon, DocumentTextIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';

export function ConversationsPanel({
    allConversationData,
    selectedScenario,
    setSelectedScenario,
    interactionMode,
    setInteractionMode,
    isInboxOpen,
    setIsInboxOpen
}) {
    const [activeTab, setActiveTab] = React.useState('all');

    const filteredConversations = allConversationData.filter(item => {
        if (activeTab === 'unread') return item.unreadCount > 0;
        return true;
    });

    return (
        <div className="w-[340px] bg-white border-r border-slate-200 flex flex-col">
            <div className="p-5 border-b border-slate-200">
                <div className="relative mb-4">
                    <input
                        type="text"
                        className="w-full py-2.5 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors"
                        placeholder="Search conversations..."
                    />
                    <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                <div className="flex gap-2">
                    <button
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        onClick={() => setActiveTab('all')}
                    >
                        All
                    </button>
                    <button
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'unread' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        onClick={() => setActiveTab('unread')}
                    >
                        Unread (6)
                    </button>
                    <button
                        className="px-4 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filters
                    </button>
                    <button
                        className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        onClick={() => setIsInboxOpen(false)}
                        title="Collapse Inbox"
                    >
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {filteredConversations.map((item, index) => (
                    <div
                        key={item.id}
                        className={`p-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${selectedScenario === index ? 'bg-blue-50/50' : ''}`}
                        onClick={() => setSelectedScenario(index)}
                    >
                        <div className="flex gap-3">
                            <div className="relative shrink-0">
                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm text-white"
                                    style={{ background: item.avatar.bg }}
                                >
                                    {item.avatar.initials}
                                </div>
                                {item.unreadCount > 0 && (
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white border-2 border-white">
                                        {item.unreadCount}
                                    </div>
                                )}
                                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${item.status === 'open' || item.status === 'active' ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-0.5">
                                    <h3 className={`text-sm truncate pr-2 ${item.unreadCount > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                                        {item.name}
                                    </h3>
                                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{item.timeAgo}</span>
                                </div>

                                <p className={`text-[13px] truncate mb-2 ${item.unreadCount > 0 ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                                    {item.preview}
                                </p>

                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium capitalize tracking-wide
                                        ${item.status === 'open' || item.status === 'active' ? 'bg-blue-50 text-blue-600' :
                                            item.status === 'resolved' ? 'bg-green-50 text-green-600' :
                                                item.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}`}>
                                        {item.status || 'open'}
                                    </span>
                                    <span className="text-[12px] text-slate-400 capitalize flex items-center gap-1">
                                        {item.channel || 'Messenger'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Hidden controls for interaction mode to maintain logic */}
            <div className="hidden">
                <button onClick={() => setInteractionMode('interactive')}>Interactive</button>
                <button onClick={() => setInteractionMode('static')}>Static</button>
            </div>
        </div>
    );
}
