import { useState } from 'react';
import { api } from '../../services/api.ts';
import {
    XMarkIcon,
    ChevronRightIcon,
    CheckIcon,
    EnvelopeIcon,
    PhoneIcon,
    ChatBubbleLeftIcon,
    UsersIcon,
    UserGroupIcon,
    StarIcon
} from '@heroicons/react/24/outline';

interface CampaignWizardProps {
    onClose: () => void;
}

interface FormData {
    name: string;
    type: 'email' | 'voice' | 'whatsapp';
    schedule: string;
    audience: string;
}

const STEPS = [
    { id: 1, name: 'Campaign Info' },
    { id: 2, name: 'Audience' },
    { id: 3, name: 'Review' }
];

const CHANNEL_OPTIONS = [
    { value: 'email', label: 'Email', icon: EnvelopeIcon, color: 'from-blue-500 to-cyan-500' },
    { value: 'voice', label: 'Voice Call', icon: PhoneIcon, color: 'from-[#37CFFF] to-purple-500' },
    { value: 'whatsapp', label: 'WhatsApp', icon: ChatBubbleLeftIcon, color: 'from-emerald-500 to-green-500' }
];

const AUDIENCE_OPTIONS = [
    { value: 'all', label: 'All Customers', icon: UsersIcon, count: '1,240', description: 'Target your entire customer base' },
    { value: 'new', label: 'New Signups', icon: UserGroupIcon, count: '350', description: 'Customers from the last 30 days' },
    { value: 'vip', label: 'VIP Customers', icon: StarIcon, count: '128', description: 'High-value repeat customers' }
];

export default function CampaignWizard({ onClose }: CampaignWizardProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<FormData>({
        name: '',
        type: 'email',
        schedule: 'immediate',
        audience: 'all'
    });

    const handleCreate = async () => {
        setLoading(true);
        try {
            await api.campaigns.create(formData);
            onClose();
        } catch (error) {
            console.error("Failed to create campaign:", error);
            alert("Failed to create campaign");
        } finally {
            setLoading(false);
        }
    };

    const selectedChannel = CHANNEL_OPTIONS.find(c => c.value === formData.type);
    const selectedAudience = AUDIENCE_OPTIONS.find(a => a.value === formData.audience);

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-500 mb-2">Campaign Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1D57D8] focus:ring-2 focus:ring-[#1D57D8]/10 transition-all"
                                placeholder="e.g. Q4 Product Update"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 mb-3">Select Channel</label>
                            <div className="grid grid-cols-3 gap-3">
                                {CHANNEL_OPTIONS.map((channel) => (
                                    <button
                                        key={channel.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: channel.value as FormData['type'] })}
                                        className={`relative p-4 rounded-xl border-2 transition-all ${
                                            formData.type === channel.value
                                                ? 'border-[#1D57D8] bg-blue-50'
                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${channel.color} flex items-center justify-center mx-auto mb-2 shadow-lg`}>
                                            <channel.icon className="w-5 h-5 text-white" />
                                        </div>
                                        <span className={`text-sm font-medium ${formData.type === channel.value ? 'text-[#1D57D8]' : 'text-slate-600'}`}>
                                            {channel.label}
                                        </span>
                                        {formData.type === channel.value && (
                                            <div className="absolute top-2 right-2 w-5 h-5 bg-[#1D57D8] rounded-full flex items-center justify-center">
                                                <CheckIcon className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-slate-500 mb-3">Target Audience</label>
                        <div className="space-y-3">
                            {AUDIENCE_OPTIONS.map((audience) => (
                                <button
                                    key={audience.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, audience: audience.value })}
                                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                                        formData.audience === audience.value
                                            ? 'border-[#1D57D8] bg-blue-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                            formData.audience === audience.value
                                                ? 'bg-[#1D57D8]/10'
                                                : 'bg-slate-100'
                                        }`}>
                                            <audience.icon className={`w-6 h-6 ${
                                                formData.audience === audience.value ? 'text-[#1D57D8]' : 'text-slate-500'
                                            }`} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`font-medium ${formData.audience === audience.value ? 'text-[#1D57D8]' : 'text-slate-900'}`}>
                                                    {audience.label}
                                                </span>
                                                <span className={`text-sm font-semibold ${
                                                    formData.audience === audience.value ? 'text-[#1D57D8]' : 'text-slate-600'
                                                }`}>
                                                    {audience.count}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">{audience.description}</p>
                                        </div>
                                        {formData.audience === audience.value && (
                                            <div className="w-5 h-5 bg-[#1D57D8] rounded-full flex items-center justify-center">
                                                <CheckIcon className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                <span className="text-sm text-slate-500">Campaign Name</span>
                                <span className="font-medium text-slate-900">{formData.name || 'Untitled'}</span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                <span className="text-sm text-slate-500">Channel</span>
                                <div className="flex items-center gap-2">
                                    {selectedChannel && (
                                        <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${selectedChannel.color} flex items-center justify-center`}>
                                            <selectedChannel.icon className="w-3.5 h-3.5 text-white" />
                                        </div>
                                    )}
                                    <span className="font-medium text-slate-900 capitalize">{formData.type}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">Target Audience</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-900">{selectedAudience?.label}</span>
                                    <span className="text-xs text-[#1D57D8] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                        {selectedAudience?.count}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-100">
                            <p className="text-sm text-slate-600 text-center">
                                Ready to launch? This will create a draft campaign ready for review.
                            </p>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-900">Create Campaign</h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Steps */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                        {STEPS.map((step, idx) => (
                            <div key={step.id} className="flex items-center">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-medium transition-all ${
                                    currentStep >= step.id
                                        ? 'bg-gradient-to-br from-[#1D57D8] to-[#37CFFF] text-white shadow-lg shadow-[#37CFFF]/25'
                                        : 'bg-slate-200 text-slate-500'
                                }`}>
                                    {currentStep > step.id ? <CheckIcon className="w-4 h-4" /> : step.id}
                                </div>
                                <span className={`ml-2 text-sm font-medium hidden sm:inline ${
                                    currentStep >= step.id ? 'text-slate-900' : 'text-slate-500'
                                }`}>
                                    {step.name}
                                </span>
                                {idx < STEPS.length - 1 && (
                                    <div className={`w-8 sm:w-12 h-0.5 mx-2 rounded-full transition-colors ${
                                        currentStep > step.id ? 'bg-[#1D57D8]' : 'bg-slate-200'
                                    }`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {renderStepContent()}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 flex justify-between bg-slate-50">
                    <button
                        onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                        className={`px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all ${
                            currentStep === 1 ? 'invisible' : ''
                        }`}
                    >
                        Back
                    </button>

                    {currentStep < 3 ? (
                        <button
                            onClick={() => setCurrentStep(currentStep + 1)}
                            className="px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#1D57D8] to-[#37CFFF] rounded-xl hover:from-[#37CFFF] hover:to-[#37CFFF] transition-all shadow-lg shadow-[#37CFFF]/25 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={currentStep === 1 && !formData.name}
                        >
                            Next
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleCreate}
                            className="px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    Create Campaign
                                    <CheckIcon className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
