import React, { useState } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { templatesData, userTagsData } from '../../data/tasksData';

export default function CreateTask({ onClose, onSave }) {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        // Step 1: Basic Info
        taskName: '',
        voiceTemplate: '',
        targetUsers: 'database',
        selectedTags: [],

        // Step 2: Scheduling
        concurrencyLimit: '',
        taskValidityPeriod: '',
        workdayRestrictions: {
            monday: false,
            tuesday: false,
            wednesday: false,
            thursday: false,
            friday: false,
            saturday: false,
            sunday: false
        },
        latestTriggerTime: '24',
        latestTriggerUnit: 'Hours',
        startMethod: 'scheduled',
        startTime: '',

        // Step 3: Compliance
        antiHarassment: true,
        crossChannelLimit: '',
        coolingPeriod: '',
        retryCount: '3',
        retryInterval: '',
        retryIntervalUnit: 'Hours',
        forceExitScript: true,
        sensitiveWordFilter: true,
        multiLanguageCompliance: true,
        auditorName: '',
        auditorEmail: '',
        maxConsecutiveFailures: '',
        fallbackChannel: '',
        remarks: ''
    });

    const updateFormData = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const updateWorkday = (day, value) => {
        setFormData(prev => ({
            ...prev,
            workdayRestrictions: {
                ...prev.workdayRestrictions,
                [day]: value
            }
        }));
    };

    const handleNext = () => {
        if (currentStep < 3) setCurrentStep(currentStep + 1);
    };

    const handlePrevious = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const handleSubmit = () => {
        onSave(formData);
        onClose();
    };

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center gap-3 mb-8">
            <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${currentStep === 1 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400'} font-medium`}>
                01
            </div>
            <span className={`text-sm font-medium ${currentStep === 1 ? 'text-slate-900' : 'text-slate-400'}`}>
                Basic Info
            </span>

            <div className="w-8 h-px bg-slate-300 mx-2"></div>

            <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${currentStep === 2 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400'} font-medium`}>
                02
            </div>
            <span className={`text-sm font-medium ${currentStep === 2 ? 'text-slate-900' : 'text-slate-400'}`}>
                Scheduling
            </span>

            <div className="w-8 h-px bg-slate-300 mx-2"></div>

            <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${currentStep === 3 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400'} font-medium`}>
                03
            </div>
            <span className={`text-sm font-medium ${currentStep === 3 ? 'text-slate-900' : 'text-slate-400'}`}>
                Compliance
            </span>
        </div>
    );

    const renderStep1 = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">01 Task Basic Information</h2>
                <p className="text-sm text-slate-600">Configure task name, template, and target users</p>
            </div>

            {/* Task Name */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Task Name <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={formData.taskName}
                    onChange={(e) => updateFormData('taskName', e.target.value)}
                    placeholder="Enter task name"
                    maxLength={100}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex justify-between mt-1">
                    <p className="text-xs text-slate-500">Recommended to reflect activity purpose and scenario</p>
                    <p className="text-xs text-slate-400">{formData.taskName.length}/100</p>
                </div>
            </div>

            {/* Voice Template */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Voice Template <span className="text-red-500">*</span>
                </label>
                <select
                    value={formData.voiceTemplate}
                    onChange={(e) => updateFormData('voiceTemplate', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Select a template</option>
                    {templatesData.map(template => (
                        <option key={template.id} value={template.id}>
                            {template.name} ({template.disc} type)
                        </option>
                    ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                    Only published templates can be selected. System will recommend templates based on user's DISC type
                </p>
            </div>

            {/* Target Users */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Target Users <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 mb-3">
                    <button
                        onClick={() => updateFormData('targetUsers', 'database')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${formData.targetUsers === 'database'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        • Database Selection
                    </button>
                    <button
                        onClick={() => updateFormData('targetUsers', 'file')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${formData.targetUsers === 'file'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        File Upload
                    </button>
                </div>

                {formData.targetUsers === 'database' && (
                    <div>
                        <div className="mb-3">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Select Data Fields
                            </label>
                            <p className="text-xs text-slate-500 mb-2">
                                Select from user database by tag (e.g., visit_type=gastroscopy)
                            </p>
                        </div>

                        <div className="border border-slate-300 rounded-lg p-4 bg-slate-50">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-slate-900">Add User By Label Tree</h4>
                                <div className="flex gap-2">
                                    <button className="px-3 py-1 text-sm text-slate-600 hover:text-slate-900">Reset</button>
                                    <button className="px-3 py-1 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800">Confirm</button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-3">
                                <span className="px-3 py-1 bg-white border border-slate-300 rounded-full text-sm">Active User</span>
                                <span className="px-3 py-1 bg-white border border-slate-300 rounded-full text-sm">Hyperglycemia</span>
                                <span className="px-3 py-1 bg-white border border-slate-300 rounded-full text-sm">Long time no exam</span>
                                <button className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 text-xl">+</button>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-start gap-2 text-sm">
                                    <span className="text-slate-600">•</span>
                                    <div className="flex-1">
                                        <span className="text-slate-900 font-medium">Hypertension</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 text-sm ml-4">
                                    <span className="text-slate-600">•</span>
                                    <div className="flex-1">
                                        <span className="text-slate-900">Hyperuricemia</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm font-medium text-blue-900 mb-1">Auto Processing:</p>
                                <ul className="text-xs text-blue-800 space-y-1">
                                    <li>• Deduplication</li>
                                    <li>• Format validation (E.164)</li>
                                    <li>• Blacklist Filtering</li>
                                    <li>• Tag Distribution Preview</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">02 Concurrency & Performance</h2>
                <p className="text-sm text-slate-600">Configure concurrency limits and performance settings</p>
            </div>

            {/* Concurrency Limit */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Concurrency Limit
                </label>
                <input
                    type="number"
                    value={formData.concurrencyLimit}
                    onChange={(e) => updateFormData('concurrencyLimit', e.target.value)}
                    placeholder="Enter concurrency limit (e.g., 20)"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Time Restrictions */}
            <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Time Restrictions</h3>

                {/* Task Validity Period */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Task Validity Period
                    </label>
                    <input
                        type="text"
                        value={formData.taskValidityPeriod}
                        onChange={(e) => updateFormData('taskValidityPeriod', e.target.value)}
                        placeholder="年/月/日 --:--"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Maximum waiting time, auto-cancel after timeout</p>
                </div>

                {/* Workday Restrictions */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Workday Restrictions
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                            <label key={day} className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.workdayRestrictions[day]}
                                    onChange={(e) => updateWorkday(day, e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700 capitalize">{day}</span>
                            </label>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Select allowed days for outbound calls to avoid weekend disturbance</p>
                </div>

                {/* Latest Trigger Time */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Latest Trigger Time
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={formData.latestTriggerTime}
                            onChange={(e) => updateFormData('latestTriggerTime', e.target.value)}
                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={formData.latestTriggerUnit}
                            onChange={(e) => updateFormData('latestTriggerUnit', e.target.value)}
                            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option>Hours</option>
                            <option>Days</option>
                        </select>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Time offset relative to event to ensure timely information</p>
                </div>
            </div>

            {/* Start Configuration */}
            <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Start Configuration</h3>

                {/* Start Method */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Start Method <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2">
                            <input
                                type="radio"
                                value="immediate"
                                checked={formData.startMethod === 'immediate'}
                                onChange={(e) => updateFormData('startMethod', e.target.value)}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700">Immediate</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="radio"
                                value="scheduled"
                                checked={formData.startMethod === 'scheduled'}
                                onChange={(e) => updateFormData('startMethod', e.target.value)}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700">Scheduled</span>
                        </label>
                    </div>
                </div>

                {/* Start Time */}
                {formData.startMethod === 'scheduled' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Start Time <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.startTime}
                            onChange={(e) => updateFormData('startTime', e.target.value)}
                            placeholder="年/月/日 --:--"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">Must be later than current time and within allowed time window (avoid 21:00-8:00)</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">03 Anti-Harassment Rules</h2>
                <p className="text-sm text-slate-600">Set up anti-harassment and compliance policies</p>
            </div>

            {/* Anti-harassment with Toggle */}
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <label className="text-sm font-medium text-slate-900">
                        Anti-harassment <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-slate-500 mt-1">
                        Mandatory compliance: Same user can only be called once within 24 hours
                    </p>
                </div>
                <button
                    onClick={() => updateFormData('antiHarassment', !formData.antiHarassment)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.antiHarassment ? 'bg-slate-900' : 'bg-slate-300'
                        }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.antiHarassment ? 'translate-x-6' : 'translate-x-1'
                            }`}
                    />
                </button>
            </div>

            {/* Cross-channel Frequency Limit */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cross-channel Frequency Limit
                </label>
                <input
                    type="number"
                    value={formData.crossChannelLimit}
                    onChange={(e) => updateFormData('crossChannelLimit', e.target.value)}
                    placeholder="3"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                    Total of phone + SMS + email ≤ X times/24h
                </p>
            </div>

            {/* Cooling Period */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cooling Period
                </label>
                <input
                    type="number"
                    value={formData.coolingPeriod}
                    onChange={(e) => updateFormData('coolingPeriod', e.target.value)}
                    placeholder="7"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                    After user explicitly refuses, do not contact again for X days
                </p>
            </div>

            {/* Max Consecutive Failures */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Max Consecutive Failures
                </label>
                <input
                    type="number"
                    value={formData.maxConsecutiveFailures}
                    onChange={(e) => updateFormData('maxConsecutiveFailures', e.target.value)}
                    placeholder="3"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                    After X consecutive failures → auto transfer to human or pause
                </p>
            </div>

            {/* Fallback Channel */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Fallback Channel
                </label>
                <select
                    value={formData.fallbackChannel}
                    onChange={(e) => updateFormData('fallbackChannel', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Select channel</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                    After phone failure, downgrade to SMS or email
                </p>
            </div>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-white px-8 py-6 border-b border-slate-200">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <ArrowLeftIcon className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                            <span>Task Management</span>
                            <span>›</span>
                            <span>Create Task</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">Create Task</h1>
                    </div>
                </div>
            </div>

            {/* Step Indicator */}
            <div className="bg-white px-8 py-6 border-b border-slate-200">
                {renderStepIndicator()}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-8 py-6">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-lg border border-slate-200 p-8">
                        {currentStep === 1 && renderStep1()}
                        {currentStep === 2 && renderStep2()}
                        {currentStep === 3 && renderStep3()}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-white px-8 py-4 border-t border-slate-200">
                <div className="max-w-4xl mx-auto flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    {currentStep > 1 && (
                        <button
                            onClick={handlePrevious}
                            className="px-6 py-2 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                            Previous
                        </button>
                    )}
                    {currentStep < 3 ? (
                        <button
                            onClick={handleNext}
                            className="px-6 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            className="px-6 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            Submit for Review
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
