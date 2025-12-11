import React from 'react';
import {
    HomeIcon,
    ChatBubbleLeftRightIcon,
    BookOpenIcon,
    SignalIcon,
    ChatBubbleOvalLeftEllipsisIcon,
    UsersIcon,
    Cog6ToothIcon,
    UserCircleIcon,
    StarIcon,
    PhoneIcon
} from '@heroicons/react/24/outline';

export function Sidebar({ currentView, setCurrentView }) {
    const navItems = [
        { id: 'dashboard', icon: HomeIcon, label: 'Dashboard' },
        { id: 'conversations', icon: ChatBubbleLeftRightIcon, label: 'Inbox', badge: 4 },
        { id: 'campaigns', icon: PhoneIcon, label: 'Campaigns' },
        { id: 'knowledge', icon: BookOpenIcon, label: 'Knowledge' },
        { id: 'channels', icon: SignalIcon, label: 'Channels' },
        { id: 'widget', icon: ChatBubbleOvalLeftEllipsisIcon, label: 'Widget' },
        { id: 'contacts', icon: UsersIcon, label: 'Contacts' },
    ];

    return (
        <div className="w-[240px] bg-white flex flex-col border-r border-slate-200 h-screen transition-all duration-300">
            {/* Logo Section */}
            <div className="h-16 flex items-center px-6 border-b border-slate-100">
                <div className="flex items-center gap-2 text-blue-600">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                        <StarIcon className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-xl tracking-tight text-slate-800">Kira</span>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => (
                    <div
                        key={item.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 group ${currentView === item.id
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        onClick={() => setCurrentView(item.id)}
                    >
                        <item.icon className={`w-5 h-5 ${currentView === item.id ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        <span className="text-sm font-medium">{item.label}</span>
                        {item.badge && (
                            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                {item.badge}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* Bottom Section */}
            <div className="p-3 border-t border-slate-100 space-y-1">
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                    <Cog6ToothIcon className="w-5 h-5 text-slate-400" />
                    <span className="text-sm font-medium">Settings</span>
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                    <UserCircleIcon className="w-5 h-5 text-slate-400" />
                    <span className="text-sm font-medium">Profile</span>
                </div>
            </div>
        </div>
    );
}
