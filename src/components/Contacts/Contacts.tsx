import { useState, useMemo } from 'react';
import {
    FunnelIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    Bars3Icon,
    Squares2X2Icon,
    ChatBubbleLeftIcon,
    TagIcon,
    EllipsisHorizontalIcon,
    UserCircleIcon,
    ClockIcon,
    GlobeAltIcon,
    UsersIcon,
    UserPlusIcon,
    ArrowTrendingUpIcon,
    CheckBadgeIcon,
    XMarkIcon,
    EnvelopeIcon,
    PhoneIcon,
    BuildingOfficeIcon,
    CheckIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import { contactsData as initialContactsData } from '../../data/contactsData.ts';
import type { Contact } from '../../types/index.ts';

// Channel options
const CHANNELS = ['WhatsApp', 'Email', 'Messenger', 'Phone', 'Web Chat'] as const;
const CONTACT_TYPES = ['User', 'Lead', 'Customer', 'VIP'] as const;

// Generate avatar color from name
const generateAvatarColor = (name: string): string => {
    const colors = ['#1D57D8', '#37CFFF', '#34DBAE', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#EF4444'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
};

// Get initials from name
const getInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

interface AddContactModalProps {
    onClose: () => void;
    onAdd: (contact: Omit<Contact, 'id'>) => void;
}

function AddContactModal({ onClose, onAdd }: AddContactModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        channel: 'Email' as typeof CHANNELS[number],
        type: 'Lead' as typeof CONTACT_TYPES[number],
        tags: [] as string[],
    });
    const [tagInput, setTagInput] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setSaving(true);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));

        const newContact: Omit<Contact, 'id'> = {
            name: formData.name,
            email: formData.email || undefined,
            phone: formData.phone || undefined,
            company: formData.company || undefined,
            channel: formData.channel,
            type: formData.type,
            domain: formData.company || formData.email?.split('@')[1] || 'Unknown',
            lastSeen: 'Just now',
            firstSeen: new Date().toLocaleDateString(),
            signedUp: new Date().toLocaleDateString(),
            webSessions: 0,
            tags: formData.tags.length > 0 ? formData.tags : undefined,
            avatar: {
                initials: getInitials(formData.name),
                bg: generateAvatarColor(formData.name),
            },
        };

        onAdd(newContact);
        setSaving(false);
        onClose();
    };

    const addTag = () => {
        if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
            setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
            setTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                style={{ animation: 'slideUp 0.2s ease-out' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-[#1D57D8] to-[#37CFFF] rounded-xl">
                            <UserPlusIcon className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900">Add New Contact</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <UserCircleIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="John Doe"
                                required
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D57D8]/20 focus:border-[#1D57D8] transition-all"
                            />
                        </div>
                    </div>

                    {/* Email & Phone */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                            <div className="relative">
                                <EnvelopeIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="john@example.com"
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D57D8]/20 focus:border-[#1D57D8] transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                            <div className="relative">
                                <PhoneIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                    placeholder="+1 234 567 8900"
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D57D8]/20 focus:border-[#1D57D8] transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Company */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
                        <div className="relative">
                            <BuildingOfficeIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={formData.company}
                                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                                placeholder="Acme Inc."
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D57D8]/20 focus:border-[#1D57D8] transition-all"
                            />
                        </div>
                    </div>

                    {/* Channel & Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Channel</label>
                            <select
                                value={formData.channel}
                                onChange={(e) => setFormData(prev => ({ ...prev, channel: e.target.value as typeof CHANNELS[number] }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D57D8]/20 focus:border-[#1D57D8] bg-white transition-all"
                            >
                                {CHANNELS.map(channel => (
                                    <option key={channel} value={channel}>{channel}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as typeof CONTACT_TYPES[number] }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D57D8]/20 focus:border-[#1D57D8] bg-white transition-all"
                            >
                                {CONTACT_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Tags</label>
                        <div className="flex gap-2 mb-2 flex-wrap">
                            {formData.tags.map(tag => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1D57D8]/10 text-[#1D57D8] rounded-lg text-xs font-medium"
                                >
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => removeTag(tag)}
                                        className="hover:bg-[#1D57D8]/20 rounded-full p-0.5"
                                    >
                                        <XMarkIcon className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                placeholder="Add a tag..."
                                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D57D8]/20 focus:border-[#1D57D8] transition-all"
                            />
                            <button
                                type="button"
                                onClick={addTag}
                                className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200 transition-colors"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !formData.name.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1D57D8] to-[#37CFFF] text-white rounded-xl hover:shadow-lg hover:shadow-[#1D57D8]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                    >
                        {saving ? (
                            <>
                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                Adding...
                            </>
                        ) : (
                            <>
                                <CheckIcon className="w-4 h-4" />
                                Add Contact
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

interface FilterPanelProps {
    filters: {
        channels: string[];
        types: string[];
        hasEmail: boolean | null;
        hasPhone: boolean | null;
    };
    onFiltersChange: (filters: FilterPanelProps['filters']) => void;
    onClose: () => void;
    onReset: () => void;
}

function FilterPanel({ filters, onFiltersChange, onClose, onReset }: FilterPanelProps) {
    const toggleChannel = (channel: string) => {
        const newChannels = filters.channels.includes(channel)
            ? filters.channels.filter(c => c !== channel)
            : [...filters.channels, channel];
        onFiltersChange({ ...filters, channels: newChannels });
    };

    const toggleType = (type: string) => {
        const newTypes = filters.types.includes(type)
            ? filters.types.filter(t => t !== type)
            : [...filters.types, type];
        onFiltersChange({ ...filters, types: newTypes });
    };

    const activeFilterCount = filters.channels.length + filters.types.length +
        (filters.hasEmail !== null ? 1 : 0) + (filters.hasPhone !== null ? 1 : 0);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-end z-50">
            <div
                className="bg-white h-full w-96 shadow-2xl overflow-y-auto"
                style={{ animation: 'slideIn 0.2s ease-out' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-3">
                        <FunnelIcon className="w-5 h-5 text-[#1D57D8]" />
                        <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
                        {activeFilterCount > 0 && (
                            <span className="px-2 py-0.5 bg-[#1D57D8] text-white text-xs font-medium rounded-full">
                                {activeFilterCount}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Filter Content */}
                <div className="p-6 space-y-6">
                    {/* Channel Filter */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-3">Channel</h3>
                        <div className="space-y-2">
                            {CHANNELS.map(channel => (
                                <label
                                    key={channel}
                                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={filters.channels.includes(channel)}
                                        onChange={() => toggleChannel(channel)}
                                        className="w-4 h-4 rounded border-slate-300 text-[#1D57D8] focus:ring-[#1D57D8]/25"
                                    />
                                    <span className={`flex items-center gap-2 text-sm ${
                                        filters.channels.includes(channel) ? 'text-slate-900 font-medium' : 'text-slate-600'
                                    }`}>
                                        <span className={`w-2 h-2 rounded-full ${
                                            channel === 'WhatsApp' ? 'bg-emerald-500' :
                                            channel === 'Email' ? 'bg-blue-500' :
                                            channel === 'Messenger' ? 'bg-indigo-500' :
                                            channel === 'Phone' ? 'bg-purple-500' :
                                            'bg-cyan-500'
                                        }`} />
                                        {channel}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Type Filter */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-3">Contact Type</h3>
                        <div className="flex flex-wrap gap-2">
                            {CONTACT_TYPES.map(type => (
                                <button
                                    key={type}
                                    onClick={() => toggleType(type)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                        filters.types.includes(type)
                                            ? 'bg-[#1D57D8] text-white shadow-md'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Contact Info Filter */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-3">Contact Information</h3>
                        <div className="space-y-2">
                            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                                <span className="flex items-center gap-2 text-sm text-slate-600">
                                    <EnvelopeIcon className="w-4 h-4" />
                                    Has Email
                                </span>
                                <select
                                    value={filters.hasEmail === null ? 'any' : filters.hasEmail ? 'yes' : 'no'}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        onFiltersChange({
                                            ...filters,
                                            hasEmail: val === 'any' ? null : val === 'yes'
                                        });
                                    }}
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D57D8]/20"
                                >
                                    <option value="any">Any</option>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                </select>
                            </label>
                            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                                <span className="flex items-center gap-2 text-sm text-slate-600">
                                    <PhoneIcon className="w-4 h-4" />
                                    Has Phone
                                </span>
                                <select
                                    value={filters.hasPhone === null ? 'any' : filters.hasPhone ? 'yes' : 'no'}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        onFiltersChange({
                                            ...filters,
                                            hasPhone: val === 'any' ? null : val === 'yes'
                                        });
                                    }}
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D57D8]/20"
                                >
                                    <option value="any">Any</option>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                </select>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white">
                    <button
                        onClick={onReset}
                        className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
                    >
                        Reset all
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-[#1D57D8] text-white rounded-xl hover:bg-[#1D57D8]/90 transition-all font-medium"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Contacts() {
    const [contacts, setContacts] = useState<Contact[]>(initialContactsData);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filters, setFilters] = useState({
        channels: [] as string[],
        types: [] as string[],
        hasEmail: null as boolean | null,
        hasPhone: null as boolean | null,
    });

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedUsers(filteredContacts.map(user => user.id));
        } else {
            setSelectedUsers([]);
        }
    };

    const handleSelectUser = (userId: number) => {
        if (selectedUsers.includes(userId)) {
            setSelectedUsers(selectedUsers.filter(id => id !== userId));
        } else {
            setSelectedUsers([...selectedUsers, userId]);
        }
    };

    const handleAddContact = (newContact: Omit<Contact, 'id'>) => {
        const contact: Contact = {
            ...newContact,
            id: Math.max(...contacts.map(c => c.id), 0) + 1,
        };
        setContacts(prev => [contact, ...prev]);
    };

    const resetFilters = () => {
        setFilters({
            channels: [],
            types: [],
            hasEmail: null,
            hasPhone: null,
        });
    };

    const activeFilterCount = filters.channels.length + filters.types.length +
        (filters.hasEmail !== null ? 1 : 0) + (filters.hasPhone !== null ? 1 : 0);

    // Apply filters
    const filteredContacts = useMemo(() => {
        return contacts.filter(contact => {
            // Search filter
            if (searchQuery && !contact.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }

            // Channel filter
            if (filters.channels.length > 0 && !filters.channels.includes(contact.channel)) {
                return false;
            }

            // Type filter
            if (filters.types.length > 0 && !filters.types.includes(contact.type)) {
                return false;
            }

            // Has email filter
            if (filters.hasEmail !== null) {
                const hasEmail = Boolean(contact.email);
                if (filters.hasEmail !== hasEmail) return false;
            }

            // Has phone filter
            if (filters.hasPhone !== null) {
                const hasPhone = Boolean(contact.phone);
                if (filters.hasPhone !== hasPhone) return false;
            }

            return true;
        });
    }, [contacts, searchQuery, filters]);

    // Stats
    const totalContacts = contacts.length;
    const activeContacts = contacts.filter(c => c.lastSeen.includes('hour') || c.lastSeen.includes('minute') || c.lastSeen === 'Just now').length;
    const newThisMonth = Math.floor(totalContacts * 0.3);

    const statsCards = [
        {
            label: 'Total Contacts',
            value: totalContacts,
            icon: UsersIcon,
            gradient: 'from-[#1D57D8] to-[#37CFFF]',
            bgColor: 'bg-blue-50',
            trend: '+18%'
        },
        {
            label: 'Active Today',
            value: activeContacts,
            icon: ArrowTrendingUpIcon,
            gradient: 'from-emerald-500 to-emerald-400',
            bgColor: 'bg-emerald-50',
            trend: '+12%'
        },
        {
            label: 'New This Month',
            value: newThisMonth,
            icon: UserPlusIcon,
            gradient: 'from-[#37CFFF] to-[#34DBAE]',
            bgColor: 'bg-cyan-50',
            trend: '+24%'
        },
        {
            label: 'Verified',
            value: Math.floor(totalContacts * 0.7),
            icon: CheckBadgeIcon,
            gradient: 'from-amber-500 to-amber-400',
            bgColor: 'bg-amber-50',
            trend: '+8%'
        }
    ];

    return (
        <div className="flex-1 bg-slate-50 overflow-y-auto">
            <div className="p-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-1">Contacts</h1>
                        <p className="text-slate-500 text-sm">Manage your customer database and relationships</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowFilterPanel(true)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all shadow-sm ${
                                activeFilterCount > 0
                                    ? 'bg-[#1D57D8] text-white hover:bg-[#1D57D8]/90'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                        >
                            <FunnelIcon className="w-4 h-4" />
                            Filter
                            {activeFilterCount > 0 && (
                                <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1D57D8] to-[#37CFFF] text-white rounded-xl hover:shadow-lg hover:shadow-[#37CFFF]/25 transition-all"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Add Contact
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-5 mb-8">
                    {statsCards.map((card, idx) => (
                        <div
                            key={idx}
                            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg`}>
                                    <card.icon className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
                                    <ArrowTrendingUpIcon className="w-3 h-3" />
                                    {card.trend}
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-slate-900 mb-1">{card.value}</div>
                            <div className="text-sm text-slate-500">{card.label}</div>
                        </div>
                    ))}
                </div>

                {/* Active Filters Display */}
                {activeFilterCount > 0 && (
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <span className="text-sm text-slate-500">Active filters:</span>
                        {filters.channels.map(channel => (
                            <span
                                key={channel}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#1D57D8] rounded-full text-xs font-medium"
                            >
                                {channel}
                                <button onClick={() => setFilters(prev => ({ ...prev, channels: prev.channels.filter(c => c !== channel) }))}>
                                    <XMarkIcon className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                        {filters.types.map(type => (
                            <span
                                key={type}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium"
                            >
                                {type}
                                <button onClick={() => setFilters(prev => ({ ...prev, types: prev.types.filter(t => t !== type) }))}>
                                    <XMarkIcon className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                        {filters.hasEmail !== null && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-medium">
                                {filters.hasEmail ? 'Has email' : 'No email'}
                                <button onClick={() => setFilters(prev => ({ ...prev, hasEmail: null }))}>
                                    <XMarkIcon className="w-3 h-3" />
                                </button>
                            </span>
                        )}
                        {filters.hasPhone !== null && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-medium">
                                {filters.hasPhone ? 'Has phone' : 'No phone'}
                                <button onClick={() => setFilters(prev => ({ ...prev, hasPhone: null }))}>
                                    <XMarkIcon className="w-3 h-3" />
                                </button>
                            </span>
                        )}
                        <button
                            onClick={resetFilters}
                            className="text-xs text-slate-500 hover:text-slate-700 underline"
                        >
                            Clear all
                        </button>
                    </div>
                )}

                {/* Identity Verification Banner */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-center gap-4">
                    <div className="p-2.5 bg-white rounded-lg shadow-sm border border-blue-100">
                        <svg className="w-5 h-5 text-[#1D57D8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-slate-600">
                            <span className="font-medium text-slate-900">Identity verification</span> — Enable to secure customer conversations and build trust.
                        </p>
                    </div>
                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-[#1D57D8] hover:bg-blue-50 hover:border-[#1D57D8]/30 transition-all shadow-sm">
                        Configure
                    </button>
                </div>

                {/* Main Content Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            {/* Search */}
                            <div className="relative">
                                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search contacts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1D57D8] focus:ring-2 focus:ring-[#1D57D8]/10 w-72 transition-all"
                                />
                            </div>
                            <span className="text-sm text-slate-500">
                                <span className="font-semibold text-slate-900">{filteredContacts.length}</span> contacts found
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            {selectedUsers.length > 0 && (
                                <div className="flex items-center gap-2 mr-2 pr-3 border-r border-slate-200">
                                    <span className="text-xs font-medium text-[#1D57D8] bg-blue-50 px-2 py-1 rounded-full">{selectedUsers.length} selected</span>
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-600 hover:bg-slate-200 transition-colors">
                                        <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
                                        Message
                                    </button>
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-600 hover:bg-slate-200 transition-colors">
                                        <TagIcon className="w-3.5 h-3.5" />
                                        Tag
                                    </button>
                                    <button className="p-1.5 bg-slate-100 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors">
                                        <EllipsisHorizontalIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <div className="flex items-center bg-slate-100 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-[#1D57D8] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Bars3Icon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-[#1D57D8] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Squares2X2Icon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="w-12 px-6 py-4">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 bg-white text-[#1D57D8] focus:ring-[#1D57D8]/25 focus:ring-offset-0"
                                            checked={selectedUsers.length === filteredContacts.length && filteredContacts.length > 0}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-left">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            <UserCircleIcon className="w-4 h-4" />
                                            Name
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 transition-colors">
                                            <ClockIcon className="w-4 h-4" />
                                            Last Active
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Channel</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">First Contact</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Sessions</th>
                                    <th className="w-12 px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredContacts.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-16 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                                                    <UsersIcon className="w-8 h-8 text-slate-400" />
                                                </div>
                                                <h3 className="text-lg font-semibold text-slate-900 mb-1">No contacts found</h3>
                                                <p className="text-sm text-slate-500 mb-4">
                                                    {searchQuery || activeFilterCount > 0
                                                        ? 'Try adjusting your search or filters'
                                                        : 'Add your first contact to get started'
                                                    }
                                                </p>
                                                {!searchQuery && activeFilterCount === 0 && (
                                                    <button
                                                        onClick={() => setShowAddModal(true)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-[#1D57D8] text-white rounded-lg text-sm font-medium hover:bg-[#1D57D8]/90 transition-colors"
                                                    >
                                                        <PlusIcon className="w-4 h-4" />
                                                        Add Contact
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredContacts.map((user) => (
                                        <tr
                                            key={user.id}
                                            className={`transition-colors ${selectedUsers.includes(user.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                                        >
                                            <td className="px-6 py-4">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-slate-300 bg-white text-[#1D57D8] focus:ring-[#1D57D8]/25 focus:ring-offset-0"
                                                    checked={selectedUsers.includes(user.id)}
                                                    onChange={() => handleSelectUser(user.id)}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm text-white shrink-0 shadow-md"
                                                        style={{ background: `linear-gradient(135deg, ${user.avatar.bg}, ${user.avatar.bg}dd)` }}
                                                    >
                                                        {user.avatar.initials}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-slate-900">
                                                            {user.name}
                                                        </div>
                                                        <div className="text-xs text-slate-500">{user.email || user.domain}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{user.lastSeen}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                                                    user.channel === 'WhatsApp' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                                                    user.channel === 'Email' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                                                    user.channel === 'Messenger' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' :
                                                    'bg-cyan-50 text-cyan-600 border border-cyan-200'
                                                }`}>
                                                    <GlobeAltIcon className="w-3 h-3" />
                                                    {user.channel}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs text-slate-600 font-medium">
                                                    {user.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{user.firstSeen}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-semibold text-slate-900">{user.webSessions}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                                    <EllipsisHorizontalIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <span className="text-sm text-slate-500">
                            Showing <span className="font-medium text-slate-900">{filteredContacts.length}</span> of <span className="font-medium text-slate-900">{contacts.length}</span> contacts
                        </span>
                        <div className="flex items-center gap-2">
                            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                                Previous
                            </button>
                            <button className="px-3 py-1.5 bg-[#1D57D8] rounded-lg text-sm text-white font-medium shadow-sm">
                                1
                            </button>
                            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Contact Modal */}
            {showAddModal && (
                <AddContactModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAddContact}
                />
            )}

            {/* Filter Panel */}
            {showFilterPanel && (
                <FilterPanel
                    filters={filters}
                    onFiltersChange={setFilters}
                    onClose={() => setShowFilterPanel(false)}
                    onReset={resetFilters}
                />
            )}
        </div>
    );
}
