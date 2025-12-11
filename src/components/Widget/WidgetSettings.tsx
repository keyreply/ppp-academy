import { useState, useEffect } from 'react';
import {
    ChatBubbleOvalLeftEllipsisIcon,
    CodeBracketIcon,
    PaintBrushIcon,
    SwatchIcon,
    Cog6ToothIcon,
    ClipboardDocumentIcon,
    CheckIcon,
    EyeIcon,
    DevicePhoneMobileIcon,
    ComputerDesktopIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

interface WidgetSettings {
    brandColor: string;
    position: 'bottom-right' | 'bottom-left';
    welcomeMessage: string;
    autoDetectTheme: boolean;
    autoOpenOnFirstVisit: boolean;
    soundNotifications: boolean;
    showTypingIndicator: boolean;
}

const DEFAULT_SETTINGS: WidgetSettings = {
    brandColor: '#1D57D8',
    position: 'bottom-right',
    welcomeMessage: 'Hi! How can I help you today?',
    autoDetectTheme: true,
    autoOpenOnFirstVisit: false,
    soundNotifications: true,
    showTypingIndicator: true,
};

// Storage key for persisting settings
const STORAGE_KEY = 'kira_widget_settings';

export default function WidgetSettings() {
    const [settings, setSettings] = useState<WidgetSettings>(DEFAULT_SETTINGS);
    const [copied, setCopied] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [initialSettings, setInitialSettings] = useState<WidgetSettings>(DEFAULT_SETTINGS);

    // Load settings from localStorage on mount
    useEffect(() => {
        const savedSettings = localStorage.getItem(STORAGE_KEY);
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                setSettings(parsed);
                setInitialSettings(parsed);
            } catch (e) {
                console.error('Failed to parse saved widget settings:', e);
            }
        }
    }, []);

    // Track changes
    useEffect(() => {
        const changed = JSON.stringify(settings) !== JSON.stringify(initialSettings);
        setHasChanges(changed);
    }, [settings, initialSettings]);

    const updateSetting = <K extends keyof WidgetSettings>(key: K, value: WidgetSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const installCode = `<script>
  window.KiraWidget = {
    appId: "app_123456789",
    color: "${settings.brandColor}",
    position: "${settings.position}",
    welcomeMessage: "${settings.welcomeMessage}",
    autoOpen: ${settings.autoOpenOnFirstVisit},
    sounds: ${settings.soundNotifications},
    typingIndicator: ${settings.showTypingIndicator},
    autoTheme: ${settings.autoDetectTheme}
  };
</script>
<script src="https://cdn.keyreply.com/widget.js" async></script>`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(installCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save to localStorage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            setInitialSettings(settings);
            setSaved(true);
            setHasChanges(false);

            // In a real app, you would also save to the API here
            // await api.widget.updateSettings(settings);

            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Failed to save settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setSettings(DEFAULT_SETTINGS);
    };

    // Toggle component for cleaner code
    const Toggle = ({
        enabled,
        onChange
    }: {
        enabled: boolean;
        onChange: (value: boolean) => void;
    }) => (
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onChange(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1D57D8]/20 focus:ring-offset-2 ${
                enabled ? 'bg-[#1D57D8]' : 'bg-slate-300'
            }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
        </button>
    );

    return (
        <div className="flex-1 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-gradient-to-br from-[#1D57D8] to-[#37CFFF] rounded-xl shadow-lg shadow-[#1D57D8]/20">
                                <ChatBubbleOvalLeftEllipsisIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Chat Widget</h1>
                                <p className="text-sm text-slate-500 mt-0.5">Customize and install your website chat widget</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {hasChanges && (
                                <button
                                    onClick={handleReset}
                                    className="px-4 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all font-medium text-sm"
                                >
                                    Reset
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving || !hasChanges}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-medium ${
                                    saved
                                        ? 'bg-emerald-500 text-white'
                                        : hasChanges
                                            ? 'bg-[#1D57D8] text-white hover:bg-[#1D57D8]/90 shadow-lg shadow-[#1D57D8]/25'
                                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                {saving ? (
                                    <>
                                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : saved ? (
                                    <>
                                        <CheckIcon className="w-4 h-4" />
                                        Saved!
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="grid grid-cols-3 gap-8">
                    {/* Settings Column */}
                    <div className="col-span-2 space-y-6">
                        {/* Appearance */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#1D57D8]/10 rounded-lg">
                                        <PaintBrushIcon className="w-5 h-5 text-[#1D57D8]" />
                                    </div>
                                    <h3 className="font-semibold text-slate-900">Appearance</h3>
                                </div>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Brand Color</label>
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <input
                                                    type="color"
                                                    value={settings.brandColor}
                                                    onChange={(e) => updateSetting('brandColor', e.target.value)}
                                                    className="w-12 h-12 p-1 rounded-xl cursor-pointer border border-slate-200"
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                value={settings.brandColor}
                                                onChange={(e) => updateSetting('brandColor', e.target.value)}
                                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1D57D8]/20 focus:border-[#1D57D8] uppercase"
                                                placeholder="#1D57D8"
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1.5">Used for widget header, buttons, and accents</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Position</label>
                                        <div className="flex gap-2">
                                            {[
                                                { id: 'bottom-right', label: 'Bottom Right' },
                                                { id: 'bottom-left', label: 'Bottom Left' }
                                            ].map(pos => (
                                                <button
                                                    key={pos.id}
                                                    type="button"
                                                    onClick={() => updateSetting('position', pos.id as 'bottom-right' | 'bottom-left')}
                                                    className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
                                                        settings.position === pos.id
                                                            ? 'bg-[#1D57D8] text-white shadow-md'
                                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {pos.label}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1.5">Where the widget appears on screen</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Welcome Message</label>
                                    <input
                                        type="text"
                                        value={settings.welcomeMessage}
                                        onChange={(e) => updateSetting('welcomeMessage', e.target.value)}
                                        placeholder="Hi! How can I help you today?"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D57D8]/20 focus:border-[#1D57D8]"
                                    />
                                    <p className="text-xs text-slate-500 mt-1.5">First message shown when chat opens</p>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <SwatchIcon className="w-5 h-5 text-slate-500" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">Auto-detect theme</p>
                                            <p className="text-xs text-slate-500">Match user's system preferences (light/dark)</p>
                                        </div>
                                    </div>
                                    <Toggle
                                        enabled={settings.autoDetectTheme}
                                        onChange={(value) => updateSetting('autoDetectTheme', value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Behavior */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 rounded-lg">
                                        <Cog6ToothIcon className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <h3 className="font-semibold text-slate-900">Behavior</h3>
                                </div>
                            </div>
                            <div className="p-6 space-y-1">
                                <div className="flex items-center justify-between py-4 border-b border-slate-100">
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">Auto-open on first visit</p>
                                        <p className="text-xs text-slate-500">Show chat window after 5 seconds for new visitors</p>
                                    </div>
                                    <Toggle
                                        enabled={settings.autoOpenOnFirstVisit}
                                        onChange={(value) => updateSetting('autoOpenOnFirstVisit', value)}
                                    />
                                </div>
                                <div className="flex items-center justify-between py-4 border-b border-slate-100">
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">Sound notifications</p>
                                        <p className="text-xs text-slate-500">Play sound when new message arrives</p>
                                    </div>
                                    <Toggle
                                        enabled={settings.soundNotifications}
                                        onChange={(value) => updateSetting('soundNotifications', value)}
                                    />
                                </div>
                                <div className="flex items-center justify-between py-4">
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">Show typing indicator</p>
                                        <p className="text-xs text-slate-500">Display animation when agent is typing</p>
                                    </div>
                                    <Toggle
                                        enabled={settings.showTypingIndicator}
                                        onChange={(value) => updateSetting('showTypingIndicator', value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Installation */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 rounded-lg">
                                        <CodeBracketIcon className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <h3 className="font-semibold text-slate-900">Installation</h3>
                                </div>
                            </div>
                            <div className="p-6">
                                <p className="text-sm text-slate-600 mb-4">
                                    Copy and paste this code before the closing <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">&lt;/body&gt;</code> tag of your website.
                                </p>
                                <div className="relative group">
                                    <pre className="bg-slate-900 text-slate-300 p-5 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                                        {installCode}
                                    </pre>
                                    <button
                                        onClick={handleCopy}
                                        className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-all"
                                    >
                                        {copied ? (
                                            <>
                                                <CheckIcon className="w-4 h-4 text-emerald-400" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <ClipboardDocumentIcon className="w-4 h-4" />
                                                Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                                {hasChanges && (
                                    <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                        Save changes to update the installation code
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Preview Column */}
                    <div className="col-span-1">
                        <div className="sticky top-24">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-semibold text-slate-700">Live Preview</span>
                                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setPreviewMode('desktop')}
                                        className={`p-2 rounded-md transition-colors ${
                                            previewMode === 'desktop'
                                                ? 'bg-white text-[#1D57D8] shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                        title="Desktop preview"
                                    >
                                        <ComputerDesktopIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setPreviewMode('mobile')}
                                        className={`p-2 rounded-md transition-colors ${
                                            previewMode === 'mobile'
                                                ? 'bg-white text-[#1D57D8] shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                        title="Mobile preview"
                                    >
                                        <DevicePhoneMobileIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className={`bg-slate-200 rounded-2xl border border-slate-300 relative overflow-hidden transition-all ${
                                previewMode === 'mobile' ? 'h-[650px] max-w-[320px] mx-auto' : 'h-[600px]'
                            }`}>
                                {/* Mock Website Background */}
                                <div className="absolute inset-0 bg-white">
                                    <div className="h-12 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2">
                                        <div className="flex gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-red-400" />
                                            <div className="w-3 h-3 rounded-full bg-amber-400" />
                                            <div className="w-3 h-3 rounded-full bg-emerald-400" />
                                        </div>
                                        <div className="flex-1 mx-4">
                                            <div className="h-6 bg-slate-200 rounded-full max-w-xs" />
                                        </div>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div className="h-4 bg-slate-100 rounded w-3/4" />
                                        <div className="h-4 bg-slate-100 rounded w-1/2" />
                                        <div className="h-4 bg-slate-100 rounded w-2/3" />
                                        <div className="h-32 bg-slate-50 rounded-xl border border-slate-200 mt-6" />
                                        <div className="h-4 bg-slate-100 rounded w-4/5" />
                                        <div className="h-4 bg-slate-100 rounded w-1/2" />
                                    </div>
                                </div>

                                {/* Chat Widget Preview */}
                                <div className={`absolute bottom-4 ${settings.position === 'bottom-right' ? 'right-4' : 'left-4'} transition-all`}>
                                    {previewOpen ? (
                                        <div
                                            className={`bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden ${
                                                previewMode === 'mobile' ? 'w-[280px]' : 'w-72'
                                            }`}
                                            style={{ animation: 'slideUp 0.2s ease-out' }}
                                        >
                                            {/* Widget Header */}
                                            <div
                                                className="p-4 relative overflow-hidden"
                                                style={{ backgroundColor: settings.brandColor }}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                                                <div className="relative flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                                            <ChatBubbleOvalLeftEllipsisIcon className="w-5 h-5 text-white" />
                                                        </div>
                                                        <div>
                                                            <p className="text-white font-semibold text-sm">Kira Assistant</p>
                                                            <p className="text-white/70 text-xs">Online</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setPreviewOpen(false)}
                                                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                                    >
                                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Widget Body */}
                                            <div className="p-4 h-40 bg-slate-50">
                                                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 max-w-[85%]">
                                                    <p className="text-sm text-slate-700">{settings.welcomeMessage}</p>
                                                </div>
                                                {settings.showTypingIndicator && (
                                                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                                                        <div className="flex gap-1">
                                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                        </div>
                                                        <span>Kira is typing...</span>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Widget Input */}
                                            <div className="p-3 border-t border-slate-200 bg-white">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Type a message..."
                                                        className="flex-1 px-4 py-2 bg-slate-100 rounded-full text-sm focus:outline-none"
                                                        readOnly
                                                    />
                                                    <button
                                                        className="p-2 rounded-full text-white transition-transform hover:scale-105"
                                                        style={{ backgroundColor: settings.brandColor }}
                                                    >
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setPreviewOpen(true)}
                                            className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-110 transition-transform"
                                            style={{ backgroundColor: settings.brandColor }}
                                        >
                                            <ChatBubbleOvalLeftEllipsisIcon className="w-7 h-7" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-3 text-center">
                                Click the widget button to preview the chat window
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
