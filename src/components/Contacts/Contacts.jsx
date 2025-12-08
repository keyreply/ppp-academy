import React, { useState } from 'react';
import {
    FunnelIcon,
    PlusIcon,
    EllipsisHorizontalIcon,
    Bars3Icon,
    Squares2X2Icon
} from '@heroicons/react/24/outline';
import { contactsData } from '../../data/contactsData.js';

export default function Contacts() {
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [sortColumn, setSortColumn] = useState('lastSeen');
    const [sortDirection, setSortDirection] = useState('desc');

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedUsers(contactsData.map(user => user.id));
        } else {
            setSelectedUsers([]);
        }
    };

    const handleSelectUser = (userId) => {
        if (selectedUsers.includes(userId)) {
            setSelectedUsers(selectedUsers.filter(id => id !== userId));
        } else {
            setSelectedUsers([...selectedUsers, userId]);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-white">
            {/* Header */}
            <div className="p-6 border-b border-slate-200">
                <h1 className="text-2xl font-bold text-slate-900 mb-4">All users</h1>

                {/* Identity Verification Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                        <p className="text-sm text-blue-900">
                            Enforce identity verification to protect customer conversations and prevent impersonation.{' '}
                            <a href="#" className="text-blue-600 font-medium hover:text-blue-700 underline">
                                Set up identity verification.
                            </a>
                        </p>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            Users
                        </button>
                        <button className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                            <FunnelIcon className="w-4 h-4" />
                            Add filter
                        </button>
                        <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {contactsData.length} users
                        </div>
                        <button className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            New message
                        </button>
                        <button className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                            Add tag
                        </button>
                        <button className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                            More
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <Bars3Icon className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <Squares2X2Icon className="w-5 h-5" />
                        </button>
                        <button className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
                            <PlusIcon className="w-4 h-4" />
                            New users onboarding
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                            <th className="w-12 px-6 py-3">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    checked={selectedUsers.length === contactsData.length}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    Name
                                </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Last seen
                                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">TYPE</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">FIRST SEEN</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">SIGNED UP</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">WEB SESSIONS</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {contactsData.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={selectedUsers.includes(user.id)}
                                        onChange={() => handleSelectUser(user.id)}
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm text-white shrink-0"
                                            style={{ backgroundColor: user.avatar.bg }}
                                        >
                                            {user.avatar.initials}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-900">
                                                {user.name} at{' '}
                                                <span className="text-slate-500">{user.domain}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">{user.lastSeen}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">{user.type}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">{user.firstSeen}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">{user.signedUp}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">{user.webSessions}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
