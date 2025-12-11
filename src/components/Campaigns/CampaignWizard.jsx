import React, { useState } from 'react';
import { api } from '../../services/api';
import { XMarkIcon, ChevronRightIcon, CheckIcon } from '@heroicons/react/24/outline';

const STEPS = [
    { id: 1, name: 'Campaign Info' },
    { id: 2, name: 'Audience' },
    { id: 3, name: 'Review' }
];

export default function CampaignWizard({ onClose }) {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        type: 'email',
        schedule: 'immediate',
        audience: 'all' // Mock audience selection
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

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Campaign Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="e.g. Q4 Product Update"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Channel</label>
                            <select
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                <option value="email">Email</option>
                                <option value="voice">Voice Call</option>
                                <option value="whatsapp">WhatsApp</option>
                            </select>
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Target Audience</label>
                            <select
                                value={formData.audience}
                                onChange={e => setFormData({ ...formData, audience: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                <option value="all">All Customers</option>
                                <option value="new">New Signups (Last 30 days)</option>
                                <option value="vip">VIP Customers</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-2">
                                Estimated reach: {formData.audience === 'all' ? '1,240' : '350'} customers
                            </p>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Name:</span>
                                <span className="font-medium text-slate-900">{formData.name}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Channel:</span>
                                <span className="font-medium text-slate-900 capitalize">{formData.type}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Audience:</span>
                                <span className="font-medium text-slate-900 capitalize">{formData.audience}</span>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 text-center">
                            Ready to launch? This will create a draft campaign.
                        </p>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-900">Create Campaign</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Steps */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        {STEPS.map((step, idx) => (
                            <div key={step.id} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 
                                    ${currentStep >= step.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-500'}`}>
                                    {currentStep > step.id ? <CheckIcon className="w-4 h-4" /> : step.id}
                                </div>
                                <span className={`ml-2 text-sm font-medium ${currentStep >= step.id ? 'text-blue-900' : 'text-slate-500'}`}>
                                    {step.name}
                                </span>
                                {idx < STEPS.length - 1 && (
                                    <div className={`w-12 h-0.5 mx-2 ${currentStep > step.id ? 'bg-blue-600' : 'bg-slate-200'}`} />
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
                <div className="px-6 py-4 border-t border-slate-100 flex justify-between">
                    <button
                        onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                        className={`px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50
                            ${currentStep === 1 ? 'invisible' : ''}`}
                    >
                        Back
                    </button>

                    {currentStep < 3 ? (
                        <button
                            onClick={() => setCurrentStep(currentStep + 1)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                            disabled={!formData.name} // Simple validation
                        >
                            Next
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleCreate}
                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Campaign'}
                            {!loading && <CheckIcon className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
