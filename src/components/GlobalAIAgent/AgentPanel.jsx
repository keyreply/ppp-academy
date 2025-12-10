import React, { useState, useRef, useEffect } from 'react';
import {
    XMarkIcon,
    Cog6ToothIcon,
    BookOpenIcon,
    PaperClipIcon,
    MicrophoneIcon,
    FaceSmileIcon,
    ArrowUpIcon,
    SparklesIcon,
    DocumentTextIcon
} from '@heroicons/react/24/outline';
import KnowledgeBase from './KnowledgeBase';

import { generateGeminiResponse } from '../../services/gemini';
import { api } from '../../services/api';

const AgentPanel = ({ isOpen, onClose, currentView, setCurrentView, context }) => {
    const [messages, setMessages] = useState([
        {
            id: 1,
            type: 'ai',
            content: "Hello! I'm Kira, your AI Copilot. I can help you with customer queries, analyze documents, and automate tasks. How can I assist you today?",
            timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
            id: 2,
            type: 'user',
            content: "Analyze the Q3 Financial Report",
            timestamp: new Date(Date.now() - 3500000).toISOString()
        },
        {
            id: 3,
            type: 'ai',
            content: (
                <div className="space-y-3">
                    <p className="font-semibold text-gray-900">Document Analysis Complete</p>
                    <p>Based on the Q3 financial report:</p>
                    <ul className="list-disc pl-4 space-y-1 text-gray-700">
                        <li><strong>Revenue:</strong> $2.4M (+18% YoY)</li>
                        <li><strong>Customer Growth:</strong> 340 new customers</li>
                        <li><strong>Churn Rate:</strong> Reduced to 3.2%</li>
                        <li><strong>Customer Satisfaction:</strong> 4.7/5.0</li>
                    </ul>
                    <p className="text-gray-600 text-xs mt-2">The report shows strong performance across all key metrics. Revenue growth is primarily driven by enterprise customers.</p>

                    <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 mt-3 hover:border-indigo-300 transition-colors cursor-pointer group">
                        <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center group-hover:bg-red-100 transition-colors">
                            <DocumentTextIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">Q3_Financial_Report.pdf</div>
                            <div className="text-xs text-gray-500">PDF Document • 2.4 MB</div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    alert("Downloading Q3_Financial_Report.pdf...");
                                }}
                                className="text-xs bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded text-gray-600 border border-gray-200 whitespace-nowrap"
                            >
                                Download
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    alert("Opening Q3_Financial_Report.pdf...");
                                }}
                                className="text-xs bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded text-gray-600 border border-gray-200 whitespace-nowrap"
                            >
                                Open
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-500 mb-2">Suggested Next Steps</p>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => handleSendMessage("Draft email to team")} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors">Draft email to team</button>
                            <button onClick={() => handleSendMessage("Create Q4 projection")} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors">Create Q4 projection</button>
                        </div>
                    </div>
                </div>
            ),
            timestamp: new Date(Date.now() - 3400000).toISOString()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const emojiPickerRef = useRef(null);

    // Common emojis organized by category
    const emojis = {
        'Smileys': ['😊', '😂', '🤣', '😍', '😘', '😎', '🤗', '🤔', '😴', '😇', '🥰', '😋'],
        'Gestures': ['👍', '👎', '👏', '🙌', '👋', '🤝', '💪', '🙏', '✌️', '🤞', '👌', '🤙'],
        'Hearts': ['❤️', '💕', '💖', '💗', '💓', '💝', '💞', '💟', '🧡', '💛', '💚', '💙'],
        'Objects': ['💼', '📱', '💻', '📧', '📅', '📊', '📈', '🎯', '🔥', '⭐', '✨', '🎉']
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, currentView]);

    // Initialize Speech Recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'zh-CN'; // Default to Chinese, can be made configurable

            recognitionRef.current.onstart = () => {
                setIsRecording(true);
                setInterimTranscript('');
            };

            recognitionRef.current.onresult = (event) => {
                let interim = '';
                let final = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        final += transcript;
                    } else {
                        interim += transcript;
                    }
                }

                if (final) {
                    setInputValue(prev => prev + final + ' ');
                    setInterimTranscript('');
                } else {
                    setInterimTranscript(interim);
                }
            };

            recognitionRef.current.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                setIsRecording(false);
                setInterimTranscript('');

                if (event.error === 'not-allowed') {
                    alert('麦克风权限被拒绝。请在浏览器设置中允许麦克风访问。');
                }
            };

            recognitionRef.current.onend = () => {
                setIsRecording(false);
                setInterimTranscript('');
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const handleVoiceInput = () => {
        if (!recognitionRef.current) {
            alert('您的浏览器不支持语音识别。请使用 Chrome、Edge 或 Safari。');
            return;
        }

        if (isRecording) {
            recognitionRef.current.stop();
        } else {
            try {
                recognitionRef.current.start();
            } catch (error) {
                console.error('Failed to start speech recognition:', error);
            }
        }
    };

    const handleEmojiSelect = (emoji) => {
        setInputValue(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
                setShowEmojiPicker(false);
            }
        };

        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEmojiPicker]);

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files).map(file => ({
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                type: file.type
            }));
            setAttachedFiles(prev => [...prev, ...newFiles]);
        }
    };

    const handleSendMessage = async (text = inputValue) => {
        if (!text.trim() && attachedFiles.length === 0) return;

        const newUserMsg = {
            id: Date.now(),
            type: 'user',
            content: text,
            files: attachedFiles,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, newUserMsg]);
        setInputValue('');
        setAttachedFiles([]);
        setIsTyping(true);

        try {
            // Use RAG API for all queries
            const response = await api.chat.send(text, context.page);

            const aiResponse = {
                id: Date.now() + 1,
                type: 'ai',
                content: response.response || "I'm sorry, I couldn't process that request.",
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, aiResponse]);
        } catch (error) {
            console.error('AI Error:', error);
            const errorResponse = {
                id: Date.now() + 1,
                type: 'ai',
                content: "Sorry, I encountered an error connecting to the AI service.",
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorResponse]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div
            className={`fixed top-5 bottom-5 right-5 w-1/2 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 z-50 ${isOpen ? 'translate-x-0' : 'translate-x-[120%]'
                }`}
        >
            {/* Header */}
            <div className="h-[60px] px-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white">
                        <SparklesIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm text-gray-900">Kira</h3>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            <span className="text-[10px] text-gray-500">Online · Ready to help</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCurrentView(currentView === 'chat' ? 'knowledge' : 'chat')}
                        className={`p-2 rounded-lg transition-colors ${currentView === 'knowledge' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                        title="Knowledge Base"
                    >
                        <BookOpenIcon className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-lg transition-colors">
                        <Cog6ToothIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-lg transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {/* Chat View */}
                <div
                    className={`absolute inset-0 flex flex-col transition-transform duration-300 ${currentView === 'chat' ? 'translate-x-0' : '-translate-x-full'
                        }`}
                >
                    {/* Context Banner */}
                    <div className="bg-indigo-50/50 px-4 py-2 text-xs text-indigo-600 flex items-center gap-2 border-b border-indigo-50">
                        <SparklesIcon className="w-3 h-3" />
                        <span>Viewing: <strong>{context.page}</strong></span>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.type === 'ai' && (
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mr-2 mt-1 shrink-0 text-xs font-bold">
                                        AI
                                    </div>
                                )}
                                <div
                                    className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${msg.type === 'user'
                                        ? 'bg-[#6366F1] text-white rounded-tr-sm'
                                        : 'bg-white border border-gray-100 text-gray-700 rounded-tl-sm shadow-sm'
                                        }`}
                                >
                                    {msg.content}
                                    {msg.files && msg.files.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {msg.files.map((file, idx) => (
                                                <div key={idx} className="bg-white/20 p-2 rounded flex items-center gap-2 text-xs">
                                                    <PaperClipIcon className="w-3 h-3" />
                                                    <span>{file.name}</span>
                                                    <span className="opacity-70">({file.size})</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Suggested Actions */}
                        {messages.length === 1 && (
                            <div className="space-y-2 mt-4 animate-fade-in">
                                <p className="text-xs font-medium text-gray-400 ml-1">Suggested Actions</p>
                                {[
                                    { icon: DocumentTextIcon, text: "Analyze Document", sub: "Extract insights from files" },
                                    { icon: SparklesIcon, text: "Summarize Page", sub: "Get key takeaways" }
                                ].map((action, idx) => (
                                    <button
                                        key={idx}
                                        className="w-full bg-white border border-gray-200 p-3 rounded-xl flex items-center gap-3 hover:border-indigo-300 hover:shadow-sm transition-all text-left group"
                                        onClick={() => handleSendMessage(action.text)}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                            <action.icon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{action.text}</div>
                                            <div className="text-xs text-gray-500">{action.sub}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mr-2 mt-1">
                                    AI
                                </div>
                                <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-sm shadow-sm flex gap-1 items-center">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-gray-100">
                        {isRecording && interimTranscript && (
                            <div className="mb-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                    <span className="text-xs font-medium text-indigo-700">正在识别...</span>
                                </div>
                                <p className="text-sm text-indigo-600 italic">{interimTranscript}</p>
                            </div>
                        )}
                        {attachedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {attachedFiles.map((file, idx) => (
                                    <div key={idx} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg text-xs flex items-center gap-1 border border-indigo-100">
                                        <PaperClipIcon className="w-3 h-3" />
                                        <span className="max-w-[150px] truncate">{file.name}</span>
                                        <button
                                            onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                                            className="hover:text-indigo-900 ml-1"
                                        >
                                            <XMarkIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="relative">
                            <textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask AI or drag files here..."
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none min-h-[44px] max-h-[120px]"
                                rows={1}
                                style={{ height: 'auto' }}
                            />
                            <div className="flex items-center justify-between mt-2 px-1">
                                <div className="flex items-center gap-1 relative">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        multiple
                                        onChange={handleFileSelect}
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        title="Attach files"
                                    >
                                        <PaperClipIcon className="w-4 h-4" />
                                    </button>
                                    <div className="relative" ref={emojiPickerRef}>
                                        <button
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className={`p-1.5 rounded-lg transition-colors ${showEmojiPicker
                                                ? 'text-indigo-600 bg-indigo-50'
                                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                                }`}
                                            title="选择表情"
                                        >
                                            <FaceSmileIcon className="w-4 h-4" />
                                        </button>

                                        {/* Emoji Picker Popup */}
                                        {showEmojiPicker && (
                                            <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-72 z-50">
                                                <div className="max-h-64 overflow-y-auto">
                                                    {Object.entries(emojis).map(([category, emojiList]) => (
                                                        <div key={category} className="mb-3">
                                                            <h4 className="text-xs font-medium text-gray-500 mb-2">{category}</h4>
                                                            <div className="grid grid-cols-8 gap-1">
                                                                {emojiList.map((emoji, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => handleEmojiSelect(emoji)}
                                                                        className="text-2xl p-1 hover:bg-indigo-50 rounded transition-colors"
                                                                        title={emoji}
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleVoiceInput}
                                        className={`p-1.5 rounded-lg transition-all ${isRecording
                                            ? 'text-red-600 bg-red-50 hover:bg-red-100 animate-pulse'
                                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                            }`}
                                        title={isRecording ? '正在录音... 点击停止' : '点击开始语音输入'}
                                    >
                                        <MicrophoneIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleSendMessage()}
                                    disabled={!inputValue.trim() && attachedFiles.length === 0}
                                    className={`p-2 rounded-lg transition-all ${inputValue.trim() || attachedFiles.length > 0
                                        ? 'bg-[#6366F1] text-white shadow-md hover:bg-[#534be0]'
                                        : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                        }`}
                                >
                                    <ArrowUpIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Knowledge Base View */}
                <div
                    className={`absolute inset-0 bg-gray-50 transition-transform duration-300 ${currentView === 'knowledge' ? 'translate-x-0' : 'translate-x-full'
                        }`}
                >
                    <KnowledgeBase onBack={() => setCurrentView('chat')} />
                </div>
            </div>
        </div>
    );
};

export default AgentPanel;
