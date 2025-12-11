import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import {
    XMarkIcon,
    Cog6ToothIcon,
    BookOpenIcon,
    SparklesIcon,
    DocumentTextIcon,
    CodeBracketIcon,
    GlobeAltIcon,
    ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { CopyIcon, CheckIcon, RefreshCwIcon, SquareIcon, MicIcon, PaperclipIcon, SendIcon } from 'lucide-react';
import KnowledgeBase from './KnowledgeBase';

// AI Elements
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse, MessageActions, MessageAction } from '@/components/ai-elements/message';
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputTools, PromptInputButton, PromptInputSubmit } from '@/components/ai-elements/prompt-input';
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';
import { Loader } from '@/components/ai-elements/loader';

// API URL configuration
const API_BASE_URL = import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? 'https://kira.keyreply.com/v1'
        : 'http://localhost:8787');

// Knowledge source options
type KnowledgeSource = 'user' | 'self' | 'all';

const KNOWLEDGE_SOURCES: Array<{
    id: KnowledgeSource;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        id: 'user',
        label: 'My Documents',
        description: 'Search your uploaded files',
        icon: DocumentTextIcon
    },
    {
        id: 'self',
        label: 'Kira Docs',
        description: "Search Kira's documentation",
        icon: CodeBracketIcon
    },
    {
        id: 'all',
        label: 'All Sources',
        description: 'Search everything',
        icon: GlobeAltIcon
    }
];

interface AgentPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentView: 'chat' | 'knowledge';
    setCurrentView: (view: 'chat' | 'knowledge') => void;
    context: {
        page: string;
        url?: string;
        timestamp?: string;
    };
}

const AgentPanel: React.FC<AgentPanelProps> = ({
    isOpen,
    onClose,
    currentView,
    setCurrentView,
    context
}) => {
    const [knowledgeSource, setKnowledgeSource] = useState<KnowledgeSource>('all');
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState('');
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const sourcePickerRef = useRef<HTMLDivElement>(null);

    // AI SDK useChat hook for streaming chat
    const {
        messages,
        input,
        setInput,
        handleInputChange,
        handleSubmit,
        isLoading,
        stop,
        reload,
        error,
        setMessages
    } = useChat({
        api: `${API_BASE_URL}/chat/stream`,
        body: {
            context: context.page,
            knowledgeSource
        },
        initialMessages: [
            {
                id: 'welcome',
                role: 'assistant',
                content: "Hello! I'm Kira, your AI Copilot. I can help you with customer queries, analyze documents, and automate tasks. How can I assist you today?"
            }
        ],
        onError: (error) => {
            console.error('Chat error:', error);
        }
    });

    // Conversation component handles auto-scroll

    // Initialize Speech Recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognitionAPI();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'zh-CN';

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
                    setInput(prev => prev + final + ' ');
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
                    alert('Microphone permission denied. Please allow microphone access in browser settings.');
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
    }, [setInput]);

    // Close source picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sourcePickerRef.current && !sourcePickerRef.current.contains(event.target as Node)) {
                setShowSourcePicker(false);
            }
        };

        if (showSourcePicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showSourcePicker]);

    const handleVoiceInput = () => {
        if (!recognitionRef.current) {
            alert('Speech recognition not supported. Please use Chrome, Edge, or Safari.');
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

    const handleSuggestionClick = (text: string, source: KnowledgeSource) => {
        if (source !== knowledgeSource) {
            setKnowledgeSource(source);
        }
        setInput(text);
        // Submit after a short delay to allow state update
        setTimeout(() => {
            const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
            handleSubmit(fakeEvent);
        }, 100);
    };

    const handleCopyMessage = async (content: string, messageId: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Get chat status for PromptInput
    const chatStatus = isLoading ? 'streaming' : error ? 'error' : 'ready';

    return (
        <div
            className={`fixed top-5 bottom-5 right-5 w-1/2 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 z-50 ${
                isOpen ? 'translate-x-0' : 'translate-x-[120%]'
            }`}
        >
            {/* Header */}
            <div className="h-[60px] px-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white">
                        <SparklesIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm text-slate-800">Kira</h3>
                        <div className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></span>
                            <span className="text-[10px] text-slate-500">
                                {isLoading ? 'Thinking...' : 'Online · Ready to help'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCurrentView(currentView === 'chat' ? 'knowledge' : 'chat')}
                        className={`p-2 rounded-lg transition-colors ${
                            currentView === 'knowledge'
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                        }`}
                        title="Knowledge Base"
                    >
                        <BookOpenIcon className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-lg transition-colors">
                        <Cog6ToothIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-lg transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {/* Chat View */}
                <div
                    className={`absolute inset-0 flex flex-col transition-transform duration-300 ${
                        currentView === 'chat' ? 'translate-x-0' : '-translate-x-full'
                    }`}
                >
                    {/* Context Banner with Knowledge Source Selector */}
                    <div className="bg-indigo-50/50 px-4 py-2 text-xs text-indigo-600 flex items-center justify-between border-b border-indigo-100/50">
                        <div className="flex items-center gap-2">
                            <SparklesIcon className="w-3 h-3" />
                            <span>Viewing: <strong>{context.page}</strong></span>
                        </div>

                        {/* Knowledge Source Selector */}
                        <div className="relative" ref={sourcePickerRef}>
                            <button
                                onClick={() => setShowSourcePicker(!showSourcePicker)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 transition-colors"
                            >
                                {(() => {
                                    const source = KNOWLEDGE_SOURCES.find(s => s.id === knowledgeSource);
                                    const Icon = source?.icon || GlobeAltIcon;
                                    return (
                                        <>
                                            <Icon className="w-3 h-3 text-indigo-500" />
                                            <span className="text-slate-600 font-medium">{source?.label}</span>
                                            <ChevronDownIcon className={`w-3 h-3 text-slate-400 transition-transform ${showSourcePicker ? 'rotate-180' : ''}`} />
                                        </>
                                    );
                                })()}
                            </button>

                            {/* Source Picker Dropdown */}
                            {showSourcePicker && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-2 w-56 z-50">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide px-2 mb-1">Knowledge Source</p>
                                    {KNOWLEDGE_SOURCES.map((source) => {
                                        const Icon = source.icon;
                                        const isSelected = knowledgeSource === source.id;
                                        return (
                                            <button
                                                key={source.id}
                                                onClick={() => {
                                                    setKnowledgeSource(source.id);
                                                    setShowSourcePicker(false);
                                                }}
                                                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                                                    isSelected
                                                        ? 'bg-indigo-50 text-indigo-600'
                                                        : 'hover:bg-slate-50 text-slate-600'
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                    isSelected ? 'bg-indigo-100' : 'bg-slate-100'
                                                }`}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium">{source.label}</div>
                                                    <div className="text-[10px] text-slate-400">{source.description}</div>
                                                </div>
                                                {isSelected && (
                                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Messages */}
                    <Conversation className="flex-1 bg-slate-50/30">
                        <ConversationContent className="p-4 gap-4">
                            {messages.map((msg, index) => (
                                <Message key={msg.id} from={msg.role}>
                                    {msg.role === 'assistant' && (
                                        <div className="flex gap-2">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center shrink-0 text-[10px] font-bold">
                                                K
                                            </div>
                                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                                                <MessageContent>
                                                    <MessageResponse>{msg.content}</MessageResponse>
                                                </MessageContent>
                                                {msg.id !== 'welcome' && (
                                                    <MessageActions>
                                                        <MessageAction
                                                            tooltip="Copy"
                                                            onClick={() => handleCopyMessage(msg.content, msg.id)}
                                                        >
                                                            {copiedMessageId === msg.id ? (
                                                                <CheckIcon className="w-3.5 h-3.5 text-green-500" />
                                                            ) : (
                                                                <CopyIcon className="w-3.5 h-3.5" />
                                                            )}
                                                        </MessageAction>
                                                        {index === messages.length - 1 && !isLoading && (
                                                            <MessageAction
                                                                tooltip="Regenerate"
                                                                onClick={() => reload()}
                                                            >
                                                                <RefreshCwIcon className="w-3.5 h-3.5" />
                                                            </MessageAction>
                                                        )}
                                                    </MessageActions>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {msg.role === 'user' && (
                                        <MessageContent className="bg-indigo-500 text-white rounded-2xl rounded-tr-sm px-4 py-3">
                                            {msg.content}
                                        </MessageContent>
                                    )}
                                </Message>
                            ))}

                            {/* Suggested Actions (show when only welcome message) */}
                            {messages.length === 1 && (
                                <div className="space-y-3 mt-2">
                                    <p className="text-xs font-medium text-slate-500">Suggested Actions</p>
                                    <Suggestions className="flex-wrap gap-2">
                                        <Suggestion
                                            suggestion="Analyze Document"
                                            onClick={() => handleSuggestionClick('Analyze Document', 'user')}
                                        />
                                        <Suggestion
                                            suggestion="Summarize Page"
                                            onClick={() => handleSuggestionClick('Summarize Page', 'user')}
                                        />
                                        <Suggestion
                                            suggestion="How does RAG work in Kira?"
                                            onClick={() => handleSuggestionClick('How does RAG work in Kira?', 'self')}
                                            className="bg-indigo-50 border-indigo-200 text-indigo-600"
                                        />
                                        <Suggestion
                                            suggestion="What are Durable Objects?"
                                            onClick={() => handleSuggestionClick('What are Durable Objects?', 'self')}
                                            className="bg-indigo-50 border-indigo-200 text-indigo-600"
                                        />
                                    </Suggestions>
                                </div>
                            )}

                            {/* Loading indicator */}
                            {isLoading && (
                                <Message from="assistant">
                                    <div className="flex gap-2 items-center">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center shrink-0 text-[10px] font-bold">
                                            K
                                        </div>
                                        <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                                            <Loader size={16} className="text-indigo-500" />
                                        </div>
                                    </div>
                                </Message>
                            )}

                            {/* Error display */}
                            {error && (
                                <div className="flex justify-center">
                                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
                                        Error: {error.message}
                                        <button
                                            onClick={() => reload()}
                                            className="ml-2 underline hover:no-underline"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                </div>
                            )}
                        </ConversationContent>
                        <ConversationScrollButton />
                    </Conversation>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-slate-100">
                        {isRecording && interimTranscript && (
                            <div className="mb-2 p-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                    <span className="text-xs font-medium text-indigo-700">Listening...</span>
                                </div>
                                <p className="text-sm text-indigo-600 italic">{interimTranscript}</p>
                            </div>
                        )}

                        <PromptInput
                            onSubmit={({ text }) => {
                                if (!text.trim()) return;
                                setInput(text);
                                // Submit after state update
                                setTimeout(() => {
                                    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                                    handleSubmit(fakeEvent);
                                }, 0);
                            }}
                            className="rounded-xl"
                        >
                            <PromptInputTextarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask AI anything..."
                                disabled={isLoading}
                                className="min-h-[44px]"
                            />
                            <PromptInputFooter>
                                <PromptInputTools>
                                    <PromptInputButton title="Attach files (coming soon)">
                                        <PaperclipIcon className="w-4 h-4" />
                                    </PromptInputButton>
                                    <PromptInputButton
                                        onClick={handleVoiceInput}
                                        title={isRecording ? 'Recording... Click to stop' : 'Voice input'}
                                        className={isRecording ? 'text-red-600 bg-red-50 animate-pulse' : ''}
                                    >
                                        <MicIcon className="w-4 h-4" />
                                    </PromptInputButton>
                                </PromptInputTools>
                                <PromptInputTools>
                                    {isLoading && (
                                        <PromptInputButton onClick={stop} title="Stop generating">
                                            <SquareIcon className="w-4 h-4" />
                                        </PromptInputButton>
                                    )}
                                    <PromptInputSubmit
                                        status={chatStatus as 'ready' | 'streaming' | 'error'}
                                        disabled={!input.trim() || isLoading}
                                        className={input.trim() && !isLoading ? 'bg-indigo-500 text-white hover:bg-indigo-600' : ''}
                                    >
                                        <SendIcon className="w-4 h-4" />
                                    </PromptInputSubmit>
                                </PromptInputTools>
                            </PromptInputFooter>
                        </PromptInput>
                    </div>
                </div>

                {/* Knowledge Base View */}
                <div
                    className={`absolute inset-0 bg-white transition-transform duration-300 ${
                        currentView === 'knowledge' ? 'translate-x-0' : 'translate-x-full'
                    }`}
                >
                    <KnowledgeBase onBack={() => setCurrentView('chat')} />
                </div>
            </div>
        </div>
    );
};

export default AgentPanel;
