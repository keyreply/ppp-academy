import {
    HomeIcon,
    ChatBubbleLeftRightIcon,
    BookOpenIcon,
    SignalIcon,
    ChatBubbleOvalLeftEllipsisIcon,
    UsersIcon,
    Cog6ToothIcon,
    MegaphoneIcon,
    BoltIcon,
    BeakerIcon,
    ArrowRightStartOnRectangleIcon,
    SparklesIcon
} from '@heroicons/react/24/outline';
import type { ViewType } from '../types/index.ts';
import { AnimatedLogo } from './Logo';

interface SidebarProps {
    currentView: ViewType;
    setCurrentView: (view: ViewType) => void;
}

interface NavItem {
    id: ViewType;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    label: string;
    badge?: number;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
    const navItems: NavItem[] = [
        { id: 'dashboard', icon: HomeIcon, label: 'Dashboard' },
        { id: 'conversations', icon: ChatBubbleLeftRightIcon, label: 'Inbox', badge: 4 },
        { id: 'campaigns', icon: MegaphoneIcon, label: 'Campaigns' },
        { id: 'workflows', label: 'Workflows', icon: BoltIcon },
        { id: 'testing', label: 'Testing', icon: BeakerIcon },
        { id: 'knowledge', icon: BookOpenIcon, label: 'Knowledge' },
        { id: 'channels', icon: SignalIcon, label: 'Channels' },
        { id: 'widget', icon: ChatBubbleOvalLeftEllipsisIcon, label: 'Widget' },
        { id: 'contacts', icon: UsersIcon, label: 'Contacts' },
    ];

    return (
        <div className="w-64 bg-white flex flex-col h-screen border-r border-slate-200">
            {/* Logo Section */}
            <div className="h-16 flex items-center px-5 border-b border-slate-200">
                <button
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    onClick={() => setCurrentView('logo-demo')}
                    title="View Logo Demo"
                >
                    <AnimatedLogo size="sm" state="idle" />
                    <div>
                        <span className="font-semibold text-lg text-slate-900 tracking-tight">KeyReply</span>
                    </div>
                </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                <div className="px-3 mb-3">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Menu</span>
                </div>
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group ${currentView === item.id
                            ? 'bg-[#1D57D8] text-white shadow-lg shadow-[#1D57D8]/25'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        onClick={() => setCurrentView(item.id)}
                    >
                        <item.icon className={`w-5 h-5 transition-colors ${currentView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-[#1D57D8]'}`} />
                        <span className="text-sm font-medium">{item.label}</span>
                        {item.badge && (
                            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center ${currentView === item.id
                                ? 'bg-white/20 text-white'
                                : 'bg-[#1D57D8] text-white'
                                }`}>
                                {item.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Bottom Section */}
            <div className="p-3 border-t border-slate-200 space-y-1">
                <button
                    onClick={() => setCurrentView('settings')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${currentView === 'settings'
                        ? 'bg-[#1D57D8] text-white shadow-lg shadow-[#1D57D8]/25'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                    <Cog6ToothIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Settings</span>
                </button>

                {/* User Profile */}
                <div className="flex items-center gap-3 px-3 py-3 mt-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1D57D8] to-[#37CFFF] flex items-center justify-center text-white font-semibold text-sm shadow-lg">
                        JD
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">John Doe</p>
                        <p className="text-xs text-slate-500 truncate">Admin</p>
                    </div>
                    <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                        <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
