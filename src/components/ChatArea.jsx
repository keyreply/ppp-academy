import React, { useEffect, useRef } from 'react';
import {
    ArrowPathIcon,
    PaperAirplaneIcon,
    MicrophoneIcon,
    PlayIcon,
    Cog6ToothIcon,
    SparklesIcon,
    ListBulletIcon,
    ViewColumnsIcon
} from '@heroicons/react/24/outline';
import { ZoomLink } from './ZoomLink';
import VoiceMessage from './VoiceMessage';

export function ChatArea({
    scenario,
    interactionMode,
    handleReset,
    messagesToShow,
    isTyping,
    handleOptionClick,
    showInputBox,
    userInput,
    setUserInput,
    handleSendMessage,
    isInboxOpen,
    setIsInboxOpen,
    isRightPanelOpen,
    setIsRightPanelOpen
}) {
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messagesToShow, isTyping]);



    const renderMessageContent = (content) => {
        // Check if content contains [Link]
        if (content.includes('[Link]')) {
            const parts = content.split('[Link]');
            return (
                <>
                    {parts[0]}
                    <ZoomLink eventTitle={scenario.title.includes('Momentum Clinic') ? 'Final Sprint Momentum Clinic' :
                        scenario.title.includes('Downsell') ? 'Clarity Call' :
                            'Strategy Session'} />
                    {parts[1]}
                </>
            );
        }

        // Check if content contains [Agenda Link]
        if (content.includes('[Agenda Link]')) {
            const parts = content.split('[Agenda Link]');
            return (
                <>
                    {parts[0]}
                    <a
                        href="https://docs.google.com/document/d/example-agenda"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 underline font-medium"
                    >
                        Event Agenda
                    </a>
                    {parts[1]}
                </>
            );
        }

        return content;
    };

    return (
        <div className="flex-1 flex flex-col bg-white">
            {/* Header */}
            <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-white to-slate-50">
                <div className="flex items-center gap-3">
                    {!isInboxOpen && (
                        <button
                            className="py-2 px-3 rounded-md border border-slate-200 bg-white text-slate-500 cursor-pointer transition-all duration-150 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2"
                            onClick={() => setIsInboxOpen(true)}
                            title="Expand Inbox"
                        >
                            <ListBulletIcon className="w-4 h-4" />
                            <span className="text-[13px] font-medium">Inbox</span>
                        </button>
                    )}
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white shadow-md"
                            style={{ background: scenario.avatar.bg }}
                        >
                            {scenario.avatar.initials}
                        </div>
                        <div>
                            <h3 className="text-[15px] font-semibold mb-0.5">{scenario.name}</h3>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                Active conversation
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {interactionMode === 'interactive' && (
                        <button
                            className="py-2 px-4 rounded-md border border-slate-200 bg-white text-[13px] font-medium cursor-pointer transition-all duration-150 hover:bg-slate-50 flex items-center gap-2"
                            onClick={handleReset}
                        >
                            <ArrowPathIcon className="w-4 h-4" />
                            Reset
                        </button>
                    )}
                    {!isRightPanelOpen && (
                        <button
                            className="py-2 px-3 rounded-md border border-slate-200 bg-white text-slate-500 cursor-pointer transition-all duration-150 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2"
                            onClick={() => setIsRightPanelOpen(true)}
                            title="Show Details"
                        >
                            <ViewColumnsIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 relative" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}>
                <div className="relative z-10">
                    {messagesToShow && messagesToShow.map((message, index) => (
                        <div key={index} className={`flex gap-3 mb-4 animate-[slideIn_0.3s_ease] ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-semibold text-[13px] shadow-sm
                ${message.type === 'kira' ? 'bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white' :
                                    message.type === 'user' ? 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-800' :
                                        'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800'}`}
                            >
                                {message.type === 'kira' ? 'K' : message.type === 'system' ? <Cog6ToothIcon className="w-4 h-4" /> : scenario.avatar.initials}
                            </div>
                            <div className={`max-w-[60%] ${message.type === 'user' ? 'flex flex-col items-end' : ''}`}>
                                <div className={`p-2.5 px-3.5 rounded-xl text-sm leading-relaxed mb-1 shadow-sm
                  ${message.type === 'kira' ? 'bg-white text-slate-800 border border-blue-100' :
                                        message.type === 'user' ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' :
                                            'bg-amber-50 border border-amber-200 text-amber-800 text-[13px]'}`}
                                >
                                    {renderMessageContent(message.content)}
                                    {message.hasVoice && <VoiceMessage {...message.voiceContent} />}
                                </div>
                                <div className="text-[11px] text-slate-400 px-1">
                                    {message.timestamp || message.time}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-semibold text-[13px] bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white shadow-sm">K</div>
                            <div className="max-w-[60%]">
                                <div className="flex gap-1 p-3 px-4 bg-white border border-slate-200 rounded-xl w-fit shadow-sm">
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-[typing_1.4s_infinite]"></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-[typing_1.4s_infinite_0.2s]"></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-[typing_1.4s_infinite_0.4s]"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {interactionMode === 'interactive' &&
                        messagesToShow.length > 0 &&
                        !isTyping &&
                        messagesToShow[messagesToShow.length - 1].options && (
                            <div className="mt-4 p-4 bg-white border border-slate-200 rounded-xl animate-[slideIn_0.3s_ease] shadow-sm">
                                <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                                    <SparklesIcon className="w-4 h-4" />
                                    <span>Choose your response:</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {messagesToShow[messagesToShow.length - 1].options.map((option, idx) => (
                                        <button
                                            key={idx}
                                            className={`p-3 px-4 bg-slate-50 border-2 rounded-lg text-left text-[13px] cursor-pointer transition-all duration-200 font-medium hover:bg-slate-100 hover:translate-x-1
                      ${option.type === 'positive' ? 'border-green-200 bg-green-50 hover:border-green-500 hover:bg-green-100' :
                                                    option.type === 'negative' ? 'border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100' :
                                                        'border-slate-200'}`}
                                            onClick={() => handleOptionClick(option.text)}
                                        >
                                            {option.text}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {showInputBox && (
                <div className="p-4 px-6 bg-white border-t border-slate-200">
                    <div className="flex gap-3 items-end">
                        <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                        </button>
                        <div className="flex-1 relative">
                            <textarea
                                className="w-full p-3 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-inherit resize-none outline-none min-h-[44px] max-h-[120px] focus:border-blue-500 focus:bg-white transition-colors duration-150"
                                placeholder="Message..."
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                            />
                        </div>
                        <button
                            className="w-11 h-11 bg-blue-600 border-none rounded-full text-white cursor-pointer transition-all duration-150 shrink-0 hover:bg-blue-700 hover:scale-105 disabled:bg-slate-200 disabled:cursor-not-allowed disabled:scale-100 shadow-md hover:shadow-lg flex items-center justify-center"
                            onClick={handleSendMessage}
                            disabled={!userInput.trim()}
                        >
                            <PaperAirplaneIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
