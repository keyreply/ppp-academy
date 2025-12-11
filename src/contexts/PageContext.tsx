import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// Page information with details about current view
interface PageInfo {
    page: string;           // Display name (e.g., "Dashboard", "Knowledge Base")
    view: string;           // Internal view ID (e.g., "dashboard", "knowledge")
    description: string;    // Brief description of what the page does
    features: string[];     // Key features available on this page
    data?: Record<string, unknown>;  // Additional page-specific data
}

// Context value interface
interface PageContextValue {
    pageInfo: PageInfo;
    setPageInfo: (info: Partial<PageInfo>) => void;
    setPageData: (data: Record<string, unknown>) => void;
}

// Default page info
const defaultPageInfo: PageInfo = {
    page: 'Unknown',
    view: 'unknown',
    description: 'Application page',
    features: [],
    data: {}
};

// Page metadata mapping
export const PAGE_METADATA: Record<string, Omit<PageInfo, 'data'>> = {
    dashboard: {
        page: 'Dashboard',
        view: 'dashboard',
        description: 'Overview of key metrics, conversations, and performance statistics',
        features: ['Analytics charts', 'Conversation metrics', 'Performance KPIs', 'Recent activity']
    },
    conversations: {
        page: 'Conversations',
        view: 'conversations',
        description: 'Manage customer conversations and inbox messages',
        features: ['Inbox messages', 'Customer chat', 'Conversation history', 'Quick replies', 'AI suggestions']
    },
    brands: {
        page: 'Manage Brands',
        view: 'brands',
        description: 'Configure and manage customer/brand profiles',
        features: ['Brand list', 'Brand settings', 'Agent assignment', 'Contact information']
    },
    channels: {
        page: 'Channels',
        view: 'channels',
        description: 'Configure communication channels (WhatsApp, Email, Live Chat, etc.)',
        features: ['Channel configuration', 'Integration settings', 'Connection status', 'Message templates']
    },
    contacts: {
        page: 'Contacts',
        view: 'contacts',
        description: 'Manage customer contact information and segments',
        features: ['Contact list', 'Contact details', 'Tags and segments', 'Import/Export']
    },
    knowledge: {
        page: 'Knowledge Base',
        view: 'knowledge',
        description: 'Manage documents and knowledge for AI-powered responses',
        features: ['Document upload', 'Document management', 'RAG search', 'AI indexing status']
    },
    campaigns: {
        page: 'Campaigns',
        view: 'campaigns',
        description: 'Create and manage marketing campaigns and outreach',
        features: ['Campaign list', 'Campaign wizard', 'Audience targeting', 'Schedule management', 'Analytics']
    },
    workflows: {
        page: 'Workflows',
        view: 'workflows',
        description: 'Design automation workflows and triggers',
        features: ['Workflow builder', 'Trigger configuration', 'Action steps', 'Workflow status']
    },
    testing: {
        page: 'Testing',
        view: 'testing',
        description: 'Test AI responses and conversation flows',
        features: ['Chat testing', 'Response preview', 'Debug mode']
    },
    widget: {
        page: 'Widget Settings',
        view: 'widget',
        description: 'Configure the customer-facing chat widget appearance and behavior',
        features: ['Widget customization', 'Color themes', 'Welcome messages', 'Position settings', 'Preview']
    },
    settings: {
        page: 'Settings',
        view: 'settings',
        description: 'Manage account and organization settings',
        features: ['General settings', 'Profile', 'Notifications', 'Security', 'Billing']
    },
    preview: {
        page: 'Live Preview',
        view: 'preview',
        description: 'Preview conversations as they would appear to users',
        features: ['Live chat preview', 'Message simulation']
    },
    'logo-demo': {
        page: 'Logo Demo',
        view: 'logo-demo',
        description: 'Interactive logo and brand identity demonstration',
        features: ['Animated logo', '3D visualization']
    }
};

// Create the context
const PageContext = createContext<PageContextValue | undefined>(undefined);

// Provider component
export function PageContextProvider({ children }: { children: React.ReactNode }) {
    const [pageInfo, setPageInfoState] = useState<PageInfo>(defaultPageInfo);

    const setPageInfo = useCallback((info: Partial<PageInfo>) => {
        setPageInfoState(prev => ({
            ...prev,
            ...info
        }));
    }, []);

    const setPageData = useCallback((data: Record<string, unknown>) => {
        setPageInfoState(prev => ({
            ...prev,
            data: {
                ...prev.data,
                ...data
            }
        }));
    }, []);

    const value = useMemo(() => ({
        pageInfo,
        setPageInfo,
        setPageData
    }), [pageInfo, setPageInfo, setPageData]);

    return (
        <PageContext.Provider value={value}>
            {children}
        </PageContext.Provider>
    );
}

// Hook to use the page context
export function usePageContext() {
    const context = useContext(PageContext);
    if (context === undefined) {
        throw new Error('usePageContext must be used within a PageContextProvider');
    }
    return context;
}

// Hook for pages to register their context
export function useRegisterPageContext(view: string, additionalData?: Record<string, unknown>) {
    const { setPageInfo, setPageData } = usePageContext();

    React.useEffect(() => {
        const metadata = PAGE_METADATA[view] || {
            page: view.charAt(0).toUpperCase() + view.slice(1),
            view,
            description: 'Application page',
            features: []
        };

        setPageInfo({
            ...metadata,
            data: additionalData || {}
        });
    }, [view, setPageInfo]);

    // Return setPageData so pages can update their data dynamically
    return { setPageData };
}

// Utility to format context for AI consumption
export function formatContextForAI(pageInfo: PageInfo): string {
    const parts = [
        `Current Page: ${pageInfo.page}`,
        `Description: ${pageInfo.description}`
    ];

    if (pageInfo.features.length > 0) {
        parts.push(`Available Features: ${pageInfo.features.join(', ')}`);
    }

    if (pageInfo.data && Object.keys(pageInfo.data).length > 0) {
        const dataStr = Object.entries(pageInfo.data)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => {
                if (typeof v === 'object') {
                    return `${k}: ${JSON.stringify(v)}`;
                }
                return `${k}: ${v}`;
            })
            .join('; ');
        if (dataStr) {
            parts.push(`Page Data: ${dataStr}`);
        }
    }

    return parts.join('\n');
}
