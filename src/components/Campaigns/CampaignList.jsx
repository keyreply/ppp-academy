import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { PlusIcon, PlayIcon, PauseIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import CampaignWizard from './CampaignWizard';

export default function CampaignList() {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        try {
            const data = await api.campaigns.list();
            if (data.campaigns) {
                setCampaigns(data.campaigns);
            }
        } catch (error) {
            console.error("Failed to fetch campaigns:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusAction = async (id, currentStatus) => {
        try {
            if (currentStatus === 'running') {
                await api.campaigns.pause(id);
            } else {
                await api.campaigns.start(id);
            }
            fetchCampaigns(); // Refresh list
        } catch (error) {
            console.error("Failed to update status:", error);
        }
    };

    if (showWizard) {
        return <CampaignWizard onClose={() => { setShowWizard(false); fetchCampaigns(); }} />;
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
                    <p className="text-slate-500">Manage your outbound campaigns</p>
                </div>
                <button
                    onClick={() => setShowWizard(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                    New Campaign
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10 text-slate-500">Loading campaigns...</div>
            ) : campaigns.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
                    <ChartBarIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">No campaigns yet</h3>
                    <p className="text-slate-500 mb-6">Create your first campaign to reach your customers.</p>
                    <button
                        onClick={() => setShowWizard(true)}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                        Create Campaign
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                            <tr>
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Progress</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {campaigns.map((campaign) => (
                                <tr key={campaign.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">{campaign.name}</td>
                                    <td className="px-6 py-4 capitalize text-slate-600">{campaign.type}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                            ${campaign.status === 'running' ? 'bg-green-100 text-green-800' :
                                                campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-slate-100 text-slate-800'}`}>
                                            {campaign.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">
                                        {/* Mock progress for now */}
                                        <div className="w-full bg-slate-200 rounded-full h-1.5 max-w-[100px]">
                                            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '0%' }}></div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleStatusAction(campaign.id, campaign.status)}
                                            className="text-slate-400 hover:text-blue-600 p-1"
                                            title={campaign.status === 'running' ? "Pause" : "Start"}
                                        >
                                            {campaign.status === 'running' ? (
                                                <PauseIcon className="w-5 h-5" />
                                            ) : (
                                                <PlayIcon className="w-5 h-5" />
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
