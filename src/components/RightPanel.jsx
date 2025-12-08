import React from 'react';
import {
    ChartBarIcon,
    ChatBubbleLeftIcon,
    FaceFrownIcon,
    FireIcon,
    ArrowPathIcon,
    NoSymbolIcon,
    XCircleIcon,
    MicrophoneIcon,
    SparklesIcon,
    PhoneIcon,
    InformationCircleIcon,
    ChevronRightIcon
} from '@heroicons/react/24/outline';

// Map emoji icons to Hero Icons
const iconMap = {
    '📊': ChartBarIcon,
    '💬': ChatBubbleLeftIcon,
    '😴': FaceFrownIcon,
    '🔥': FireIcon,
    '🔄': ArrowPathIcon,
    '🚫': NoSymbolIcon,
    '❌': XCircleIcon,
    '🎤': MicrophoneIcon,
    '💎': SparklesIcon,
    '📞': PhoneIcon,
};

export function RightPanel({
    activePanel,
    setActivePanel,
    interactionMode,
    scenario,
    messagesToShow,
    currentStep,
    conversationLogs,
    setIsRightPanelOpen
}) {
    const getIconComponent = (iconEmoji) => {
        const IconComponent = iconMap[iconEmoji] || InformationCircleIcon;
        return IconComponent;
    };

    return (
        <div className="w-[380px] bg-white border-l border-slate-200 flex flex-col">
            <div className="flex border-b border-slate-200 relative">
                <button
                    onClick={() => setIsRightPanelOpen(false)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
                    title="Collapse Panel"
                >
                    <ChevronRightIcon className="w-4 h-4" />
                </button>
                <div
                    className={`flex-1 p-3.5 text-center text-[13px] font-medium text-slate-500 cursor-pointer border-b-2 border-transparent transition-all duration-150 pl-8 ${activePanel === 'profile' ? 'text-blue-500 border-b-blue-500 bg-slate-50' : ''}`}
                    onClick={() => setActivePanel('profile')}
                >
                    Tags & Status
                </div>
                <div
                    className={`flex-1 p-3.5 text-center text-[13px] font-medium text-slate-500 cursor-pointer border-b-2 border-transparent transition-all duration-150 ${activePanel === 'logs' ? 'text-blue-500 border-b-blue-500 bg-slate-50' : ''}`}
                    onClick={() => setActivePanel('logs')}
                >
                    {interactionMode === 'interactive' ? 'Activity Logs' : 'Backend Logs'}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
                {activePanel === 'profile' ? (
                    <>
                        {interactionMode === 'interactive' && (
                            <div className="mb-6">
                                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-3">Conversation Progress</div>
                                <div className="bg-slate-50 rounded-lg p-4 mb-3">
                                    <div className="flex justify-between items-center mb-2.5">
                                        <span className="text-xs text-slate-500">Messages Exchanged</span>
                                        <span className="text-[13px] font-semibold">{messagesToShow.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-500">Current Mode</span>
                                        <span className="text-[13px] font-semibold">
                                            {currentStep < (scenario.steps?.length || 0) - 1 ? 'Guided' : 'Free-form'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {interactionMode === 'static' && scenario.currentStatus && (
                            <div className="mb-6">
                                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-3">Current Status</div>
                                <div className="bg-slate-50 rounded-lg p-4 mb-3">
                                    <div className="flex justify-between items-center mb-2.5">
                                        <span className="text-xs text-slate-500">User Intent</span>
                                        <span className="text-[13px] font-semibold">{scenario.currentStatus.intent}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-2.5">
                                        <span className="text-xs text-slate-500">Next Action</span>
                                        <span className="text-[13px] font-semibold">{scenario.currentStatus.nextAction}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-500">Queue Status</span>
                                        <span className="text-[13px] font-semibold">{scenario.currentStatus.queue}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {scenario.tags && scenario.tags.length > 0 && (
                            <div className="mb-6">
                                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-3">Active Tags ({scenario.tags.length})</div>
                                <div className="flex flex-col gap-2.5">
                                    {scenario.tags.map((tag, index) => {
                                        const IconComponent = getIconComponent(tag.icon);
                                        return (
                                            <div key={index} className="bg-slate-50 rounded-lg p-3 flex justify-between items-center">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-md flex items-center justify-center
                          ${tag.type === 'status' ? 'bg-blue-100 text-blue-600' :
                                                            tag.type === 'intent' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                                                        <IconComponent className="w-4 h-4" />
                                                    </div>
                                                    <div className="text-[13px] font-semibold">{tag.name}</div>
                                                </div>
                                                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 cursor-pointer relative group">
                                                    ?
                                                    <div className="hidden group-hover:block absolute bottom-full right-0 w-[300px] bg-slate-800 text-white p-3 rounded-lg text-xs leading-relaxed mb-2 z-[1000] shadow-lg after:content-[''] after:absolute after:top-full after:right-1.5 after:border-[6px] after:border-transparent after:border-t-slate-800">
                                                        <div className="font-semibold text-blue-400 mb-1.5">{tag.tooltip.title}</div>
                                                        <div>{tag.tooltip.description}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="mb-6">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-3">
                            {interactionMode === 'interactive' ? 'Real-time Activity' : 'Processing Logs'}
                        </div>
                        <div className="flex flex-col gap-3">
                            {conversationLogs.map((log, index) => (
                                <div key={index} className="bg-slate-50 rounded-lg p-3.5 border-l-[3px] border-l-amber-500 animate-[slideIn_0.3s_ease]">
                                    <div className="text-[11px] text-slate-400 mb-1.5">{log.time}</div>
                                    <div className="text-[13px] font-semibold mb-1.5">{log.title}</div>
                                    <div className="text-xs text-slate-500 leading-relaxed">{log.detail}</div>
                                    {log.code && (
                                        <div className="bg-slate-800 text-slate-200 p-2.5 rounded-md font-mono text-[11px] whitespace-pre overflow-x-auto mt-2">
                                            {log.code}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {conversationLogs.length === 0 && (
                                <div className="text-[13px] text-slate-500 text-center p-5">
                                    {interactionMode === 'interactive' ? 'Activity logs will appear as you interact' : 'No logs available for this case'}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
