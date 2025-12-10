import { api } from './api';

export const analyticsService = {
    /**
     * Get campaign funnel stats
     */
    getCampaignStats: async (campaignId) => {
        try {
            // Direct call to worker endpoint
            const response = await fetch(`${import.meta.env.VITE_API_URL}/analytics/campaign/${campaignId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch campaign stats:", error);
            return { funnel: [] };
        }
    },

    /**
     * Get intent distribution
     */
    getIntents: async (range = '7d') => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/analytics/intents?range=${range}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch intent stats:", error);
            return { intents: [] };
        }
    },

    /**
     * Get dashboard summary
     */
    getDashboardSummary: async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/analytics/dashboard/summary`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch dashboard summary:", error);
            return { totalConversations: 0, activeUsers: 0, aiResponseRate: "0%" };
        }
    }
};
