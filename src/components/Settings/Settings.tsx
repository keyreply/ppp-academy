import { useState, useEffect } from 'react';
import {
    Cog6ToothIcon,
    UserCircleIcon,
    BellIcon,
    ShieldCheckIcon,
    CreditCardIcon,
    KeyIcon,
    GlobeAltIcon,
    PaintBrushIcon,
    CheckIcon,
    ExclamationCircleIcon
} from '@heroicons/react/24/outline';

type SectionId = 'general' | 'profile' | 'notifications' | 'security' | 'billing';

interface Section {
    id: SectionId;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    description: string;
}

const SECTIONS: Section[] = [
    { id: 'general', label: 'General', icon: Cog6ToothIcon, description: 'Basic organization settings' },
    { id: 'profile', label: 'Profile', icon: UserCircleIcon, description: 'Your personal information' },
    { id: 'notifications', label: 'Notifications', icon: BellIcon, description: 'Manage your alerts' },
    { id: 'security', label: 'Security', icon: ShieldCheckIcon, description: 'Authentication & access' },
    { id: 'billing', label: 'Billing', icon: CreditCardIcon, description: 'Subscription & payments' },
];

// Toggle Switch Component
interface ToggleSwitchProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    disabled?: boolean;
}

function ToggleSwitch({ enabled, onChange, disabled = false }: ToggleSwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={disabled}
            onClick={() => !disabled && onChange(!enabled)}
            className={`w-12 h-6 rounded-full relative transition-colors ${
                enabled ? 'bg-indigo-500' : 'bg-slate-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    enabled ? 'right-1' : 'left-1'
                }`}
            />
        </button>
    );
}

// Settings state interfaces
interface GeneralSettings {
    organizationName: string;
    timezone: string;
    language: string;
    darkMode: boolean;
    compactView: boolean;
}

interface ProfileSettings {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
}

interface NotificationSettings {
    emailNotifications: boolean;
    pushNotifications: boolean;
    campaignAlerts: boolean;
    weeklyDigest: boolean;
    marketingUpdates: boolean;
}

interface SecuritySettings {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    twoFactorEnabled: boolean;
}

// Load settings from localStorage or use defaults
function loadSettings<T>(key: string, defaults: T): T {
    try {
        const stored = localStorage.getItem(`settings_${key}`);
        if (stored) {
            return { ...defaults, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
    return defaults;
}

// Save settings to localStorage
function saveSettings<T>(key: string, settings: T): void {
    try {
        localStorage.setItem(`settings_${key}`, JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
}

export default function Settings() {
    const [activeSection, setActiveSection] = useState<SectionId>('general');
    const [saved, setSaved] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    // Settings state
    const [general, setGeneral] = useState<GeneralSettings>(() =>
        loadSettings('general', {
            organizationName: 'Acme Corp',
            timezone: 'sgt',
            language: 'en',
            darkMode: false,
            compactView: false
        })
    );

    const [profile, setProfile] = useState<ProfileSettings>(() =>
        loadSettings('profile', {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@acmecorp.com',
            role: 'Administrator'
        })
    );

    const [notifications, setNotifications] = useState<NotificationSettings>(() =>
        loadSettings('notifications', {
            emailNotifications: true,
            pushNotifications: true,
            campaignAlerts: true,
            weeklyDigest: false,
            marketingUpdates: false
        })
    );

    const [security, setSecurity] = useState<SecuritySettings>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        twoFactorEnabled: false
    });

    // Track changes
    useEffect(() => {
        setHasChanges(true);
    }, [general, profile, notifications, security.twoFactorEnabled]);

    // Update general settings
    const updateGeneral = (key: keyof GeneralSettings, value: string | boolean) => {
        setGeneral(prev => ({ ...prev, [key]: value }));
    };

    // Update profile settings
    const updateProfile = (key: keyof ProfileSettings, value: string) => {
        setProfile(prev => ({ ...prev, [key]: value }));
    };

    // Update notification settings
    const updateNotifications = (key: keyof NotificationSettings, value: boolean) => {
        setNotifications(prev => ({ ...prev, [key]: value }));
    };

    // Update security settings
    const updateSecurity = (key: keyof SecuritySettings, value: string | boolean) => {
        setSecurity(prev => ({ ...prev, [key]: value }));
        if (key === 'newPassword' || key === 'confirmPassword') {
            setPasswordError(null);
        }
    };

    // Validate password
    const validatePassword = (): boolean => {
        if (security.newPassword && security.newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters');
            return false;
        }
        if (security.newPassword !== security.confirmPassword) {
            setPasswordError('Passwords do not match');
            return false;
        }
        return true;
    };

    // Handle save
    const handleSave = () => {
        // Validate password if changed
        if (security.newPassword || security.confirmPassword) {
            if (!validatePassword()) return;
        }

        // Save all settings
        saveSettings('general', general);
        saveSettings('profile', profile);
        saveSettings('notifications', notifications);
        // Don't save passwords to localStorage for security

        // Show saved feedback
        setSaved(true);
        setHasChanges(false);
        setTimeout(() => setSaved(false), 2000);

        // Clear password fields after save
        setSecurity(prev => ({
            ...prev,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        }));
    };

    // Get initials for avatar
    const getInitials = () => {
        const first = profile.firstName.charAt(0).toUpperCase();
        const last = profile.lastName.charAt(0).toUpperCase();
        return `${first}${last}`;
    };

    const renderContent = () => {
        switch (activeSection) {
            case 'general':
                return (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-800 mb-6">Organization Settings</h2>
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Organization Name</label>
                                    <input
                                        type="text"
                                        className="w-full max-w-md px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        value={general.organizationName}
                                        onChange={(e) => updateGeneral('organizationName', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Timezone</label>
                                    <select
                                        className="w-full max-w-md px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        value={general.timezone}
                                        onChange={(e) => updateGeneral('timezone', e.target.value)}
                                    >
                                        <option value="utc">UTC (GMT+00:00)</option>
                                        <option value="pst">Pacific Time (GMT-08:00)</option>
                                        <option value="est">Eastern Time (GMT-05:00)</option>
                                        <option value="sgt">Singapore Time (GMT+08:00)</option>
                                        <option value="jst">Japan Time (GMT+09:00)</option>
                                        <option value="gmt">London (GMT+00:00)</option>
                                        <option value="cet">Central Europe (GMT+01:00)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Language</label>
                                    <select
                                        className="w-full max-w-md px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        value={general.language}
                                        onChange={(e) => updateGeneral('language', e.target.value)}
                                    >
                                        <option value="en">English</option>
                                        <option value="es">Spanish</option>
                                        <option value="zh">Chinese (Simplified)</option>
                                        <option value="zh-tw">Chinese (Traditional)</option>
                                        <option value="ja">Japanese</option>
                                        <option value="ko">Korean</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-indigo-50 rounded-xl">
                                    <PaintBrushIcon className="w-5 h-5 text-indigo-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-800">Appearance</h2>
                                    <p className="text-sm text-slate-500">Customize the look and feel</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                    <div>
                                        <span className="text-sm font-medium text-slate-700">Dark Mode</span>
                                        <p className="text-xs text-slate-500">Use dark theme throughout the app</p>
                                    </div>
                                    <ToggleSwitch
                                        enabled={general.darkMode}
                                        onChange={(enabled) => updateGeneral('darkMode', enabled)}
                                    />
                                </div>
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                    <div>
                                        <span className="text-sm font-medium text-slate-700">Compact View</span>
                                        <p className="text-xs text-slate-500">Show more items with less spacing</p>
                                    </div>
                                    <ToggleSwitch
                                        enabled={general.compactView}
                                        onChange={(enabled) => updateGeneral('compactView', enabled)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'profile':
                return (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-800 mb-6">Profile Settings</h2>
                        <div className="flex items-start gap-6 mb-6">
                            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                                {getInitials()}
                            </div>
                            <div className="flex-1">
                                <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm hover:bg-slate-50 transition-all">
                                    Change Photo
                                </button>
                                <p className="text-xs text-slate-500 mt-2">JPG, PNG or GIF. Max 2MB.</p>
                            </div>
                        </div>
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">First Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        value={profile.firstName}
                                        onChange={(e) => updateProfile('firstName', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Last Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        value={profile.lastName}
                                        onChange={(e) => updateProfile('lastName', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Email Address</label>
                                <input
                                    type="email"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                    value={profile.email}
                                    onChange={(e) => updateProfile('email', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Role</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                                    value={profile.role}
                                    disabled
                                />
                                <p className="text-xs text-slate-400 mt-1">Role can only be changed by administrators</p>
                            </div>
                        </div>
                    </div>
                );

            case 'notifications':
                return (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-800 mb-6">Notification Preferences</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div>
                                    <span className="text-sm font-medium text-slate-700">Email Notifications</span>
                                    <p className="text-xs text-slate-500">Receive updates via email</p>
                                </div>
                                <ToggleSwitch
                                    enabled={notifications.emailNotifications}
                                    onChange={(enabled) => updateNotifications('emailNotifications', enabled)}
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div>
                                    <span className="text-sm font-medium text-slate-700">Push Notifications</span>
                                    <p className="text-xs text-slate-500">Get browser notifications</p>
                                </div>
                                <ToggleSwitch
                                    enabled={notifications.pushNotifications}
                                    onChange={(enabled) => updateNotifications('pushNotifications', enabled)}
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div>
                                    <span className="text-sm font-medium text-slate-700">Campaign Alerts</span>
                                    <p className="text-xs text-slate-500">Notify when campaigns complete</p>
                                </div>
                                <ToggleSwitch
                                    enabled={notifications.campaignAlerts}
                                    onChange={(enabled) => updateNotifications('campaignAlerts', enabled)}
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div>
                                    <span className="text-sm font-medium text-slate-700">Weekly Digest</span>
                                    <p className="text-xs text-slate-500">Summary of weekly activity</p>
                                </div>
                                <ToggleSwitch
                                    enabled={notifications.weeklyDigest}
                                    onChange={(enabled) => updateNotifications('weeklyDigest', enabled)}
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div>
                                    <span className="text-sm font-medium text-slate-700">Marketing Updates</span>
                                    <p className="text-xs text-slate-500">News about new features</p>
                                </div>
                                <ToggleSwitch
                                    enabled={notifications.marketingUpdates}
                                    onChange={(enabled) => updateNotifications('marketingUpdates', enabled)}
                                />
                            </div>
                        </div>
                    </div>
                );

            case 'security':
                return (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-amber-50 rounded-xl">
                                    <KeyIcon className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-800">Password</h2>
                                    <p className="text-sm text-slate-500">Update your password regularly</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Current Password</label>
                                    <input
                                        type="password"
                                        className="w-full max-w-md px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        placeholder="Enter current password"
                                        value={security.currentPassword}
                                        onChange={(e) => updateSecurity('currentPassword', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">New Password</label>
                                    <input
                                        type="password"
                                        className={`w-full max-w-md px-4 py-3 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                                            passwordError ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
                                        }`}
                                        placeholder="Enter new password (min. 8 characters)"
                                        value={security.newPassword}
                                        onChange={(e) => updateSecurity('newPassword', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-2">Confirm New Password</label>
                                    <input
                                        type="password"
                                        className={`w-full max-w-md px-4 py-3 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                                            passwordError ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
                                        }`}
                                        placeholder="Confirm new password"
                                        value={security.confirmPassword}
                                        onChange={(e) => updateSecurity('confirmPassword', e.target.value)}
                                    />
                                </div>
                                {passwordError && (
                                    <div className="flex items-center gap-2 text-red-600 text-sm">
                                        <ExclamationCircleIcon className="w-4 h-4" />
                                        {passwordError}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-emerald-50 rounded-xl">
                                    <ShieldCheckIcon className="w-5 h-5 text-emerald-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-800">Two-Factor Authentication</h2>
                                    <p className="text-sm text-slate-500">Add an extra layer of security</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div>
                                    <span className="text-sm font-medium text-slate-700">Enable 2FA</span>
                                    <p className="text-xs text-slate-500">Use authenticator app for login</p>
                                </div>
                                {security.twoFactorEnabled ? (
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-emerald-600 font-medium">Enabled</span>
                                        <button
                                            onClick={() => updateSecurity('twoFactorEnabled', false)}
                                            className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm hover:bg-red-100 transition-all"
                                        >
                                            Disable
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => updateSecurity('twoFactorEnabled', true)}
                                        className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm hover:bg-indigo-600 transition-all shadow-sm"
                                    >
                                        Enable
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-blue-50 rounded-xl">
                                    <GlobeAltIcon className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-800">Active Sessions</h2>
                                    <p className="text-sm text-slate-500">Manage your logged-in devices</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                                            <span className="text-emerald-500 text-lg">💻</span>
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium text-slate-700">MacBook Pro - Chrome</span>
                                            <p className="text-xs text-slate-500">Singapore • Current session</p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium">Active</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'billing':
                return (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <span className="text-xs text-indigo-100 font-medium">CURRENT PLAN</span>
                                    <h2 className="text-2xl font-bold text-white">Pro Plan</h2>
                                </div>
                                <span className="px-3 py-1 bg-white/20 text-white rounded-full text-sm font-medium">
                                    $99/month
                                </span>
                            </div>
                            <p className="text-sm text-indigo-100 mb-4">Access to all features, unlimited campaigns, priority support.</p>
                            <button className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-50 transition-all">
                                Upgrade Plan
                            </button>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-800 mb-6">Payment Method</h2>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                                        VISA
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-slate-700">•••• •••• •••• 4242</span>
                                        <p className="text-xs text-slate-500">Expires 12/25</p>
                                    </div>
                                </div>
                                <button className="text-sm text-indigo-500 hover:text-indigo-600 font-medium transition-colors">
                                    Update
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-800 mb-6">Billing History</h2>
                            <div className="space-y-3">
                                {[
                                    { date: 'Dec 1, 2024', amount: '$99.00', status: 'Paid' },
                                    { date: 'Nov 1, 2024', amount: '$99.00', status: 'Paid' },
                                    { date: 'Oct 1, 2024', amount: '$99.00', status: 'Paid' },
                                ].map((invoice, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                        <div>
                                            <span className="text-sm font-medium text-slate-700">{invoice.date}</span>
                                            <p className="text-xs text-slate-500">Pro Plan - Monthly</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-medium text-slate-700">{invoice.amount}</span>
                                            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium">
                                                {invoice.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="flex-1 bg-slate-50 overflow-y-auto">
            <div className="p-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-800 mb-1">Settings</h1>
                    <p className="text-slate-500 text-sm">Manage your account and organization preferences</p>
                </div>

                <div className="flex gap-8">
                    {/* Sidebar Navigation */}
                    <div className="w-64 shrink-0">
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            {SECTIONS.map(section => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${
                                        activeSection === section.id
                                            ? 'bg-indigo-50 text-indigo-600 border-l-4 border-indigo-500'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800 border-l-4 border-transparent'
                                    }`}
                                >
                                    <section.icon className={`w-5 h-5 ${activeSection === section.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                                    <span className="text-sm font-medium">{section.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1">
                        {renderContent()}

                        {/* Save Button */}
                        <div className="mt-6 flex items-center justify-end gap-4">
                            {hasChanges && !saved && (
                                <span className="text-sm text-slate-500">You have unsaved changes</span>
                            )}
                            <button
                                onClick={handleSave}
                                className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                                    saved
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm'
                                }`}
                            >
                                {saved ? (
                                    <>
                                        <CheckIcon className="w-4 h-4" />
                                        Saved
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
