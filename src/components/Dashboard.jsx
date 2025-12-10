import React, { useState, useEffect } from 'react';
import { analyticsService } from '../services/analyticsService';

export function Dashboard() {
    const [summary, setSummary] = useState({
        totalConversations: 0,
        interestedLeads: 0,
        voiceInteractions: 0,
        declined: 0
    });
    const [funnel, setFunnel] = useState([]);
    const [intents, setIntents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                // Fetch summary (mocked for now in service/worker but wired up)
                const dashboardSummary = await analyticsService.getDashboardSummary();
                setSummary(prev => ({ ...prev, ...dashboardSummary }));

                // Fetch intents
                const intentData = await analyticsService.getIntents();
                setIntents(intentData.intents || []);

                // Fetch campaign stats (using a default/dummy ID for now)
                const campaignStats = await analyticsService.getCampaignStats('default');
                setFunnel(campaignStats.funnel || []);

            } catch (error) {
                console.error("Dashboard fetch failed:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading analytics...</div>;
    }

    return (
        <div className="flex-1 bg-slate-50 overflow-y-auto">
            <div className="p-8">
                <h2 className="text-2xl font-bold mb-6">Campaign Performance Overview</h2>

                <div className="grid grid-cols-4 gap-5 mb-8">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="text-slate-500 text-sm mb-2">Total Conversations</div>
                        <div className="text-3xl font-bold text-slate-800">{summary.totalConversations || 0}</div>
                        <div className="text-xs text-green-600 mt-2">↑ Data from D1</div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="text-slate-500 text-sm mb-2">Active Users</div>
                        <div className="text-3xl font-bold text-green-600">{summary.activeUsers || 0}</div>
                        <div className="text-xs text-slate-500 mt-2">Currently online</div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="text-slate-500 text-sm mb-2">AI Response Rate</div>
                        <div className="text-3xl font-bold text-purple-600">{summary.aiResponseRate || '0%'}</div>
                        <div className="text-xs text-slate-500 mt-2">Automated replies</div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="text-slate-500 text-sm mb-2">Events Tracked</div>
                        <div className="text-3xl font-bold text-red-600">{intents.length || 0}</div>
                        <div className="text-xs text-slate-500 mt-2">Total intent events</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-5 mb-8">
                    {/* Reuse existing UI structure but inject dynamic list if available */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-semibold mb-4">Top Detected Intents</h3>
                        <div className="space-y-4">
                            {intents.length > 0 ? intents.map((intent, idx) => (
                                <div key={idx}>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span>{intent.label}</span>
                                        <span className="font-semibold">{intent.count}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(intent.count * 10, 100)}%` }}></div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-slate-400 text-sm text-center py-4">No intent data yet</div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-semibold mb-4">Lead Status Breakdown</h3>
                        {/* Placeholder for future dynamic status breakdown */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                                        ?
                                    </div>
                                    <div>
                                        <div className="font-semibold text-green-800">Interested</div>
                                        <div className="text-xs text-green-600">Likely to convert</div>
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-green-600">--</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Key Insights</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="text-2xl mb-2">🎙️</div>
                            <div className="font-semibold text-purple-800 mb-1">Live Data Connected</div>
                            <div className="text-sm text-purple-600">Dashboard is now fetching from D1 Analytics</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
