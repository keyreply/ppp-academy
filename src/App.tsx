import { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ConversationsPanel } from './components/ConversationsPanel';
import { ChatArea } from './components/ChatArea';
import { RightPanel } from './components/RightPanel';
import { Dashboard } from './components/Dashboard';
import { Preview } from './components/Preview';
import GlobalAIAgent from './components/GlobalAIAgent/GlobalAIAgent';
import ManageBrands from './components/ManageBrands/ManageBrands';
import EditBrand from './components/ManageBrands/EditBrand';
import Channels from './components/Channels/Channels';
import Contacts from './components/Contacts/Contacts';
import KnowledgeBase from './components/Knowledge/KnowledgeBase';
import CampaignList from './components/Campaigns/CampaignList';
import WorkflowList from './components/Workflows/WorkflowList';
import Testing from './components/Testing/Testing';
import WidgetSettings from './components/Widget/WidgetSettings';
import Settings from './components/Settings/Settings';
import LogoDemo from './components/Logo/LogoDemo';
import { allConversationData } from './data/conversations';
import { generateAIResponse } from './utils/ai';
import { api } from './services/api';
import { conversationService } from './services/conversationService';

function App() {
  const [isInboxOpen, setIsInboxOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  const [currentView, setCurrentView] = useState('conversations');
  const [interactionMode, setInteractionMode] = useState('interactive');
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  const [userInput, setUserInput] = useState('');
  const [editingBrand, setEditingBrand] = useState(null);
  const [brands, setBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);

  useEffect(() => {
    if (currentView === 'brands') {
      fetchBrands();
    }
  }, [currentView]);

  const fetchBrands = async () => {
    try {
      setLoadingBrands(true);
      const data = await api.customers.list();
      // Map API response to UI model if needed, or use as is
      // Assuming API returns { customers: [...] } or array
      const customerList = data.customers || data || [];
      const mappedBrands = customerList.map(c => ({
        id: c.id,
        name: c.name,
        agent: 'Kira', // Default or from API
        defaultAddress: c.email || '',
        status: c.status || 'Active',
        iconColor: 'text-white bg-blue-600', // You might want to generate this based on name
        // preserves other fields
        ...c
      }));
      setBrands(mappedBrands);
    } catch (error) {
      console.error("Failed to fetch brands:", error);
      // Fallback to mock if API fails in dev? Or just show empty.
    } finally {
      setLoadingBrands(false);
    }
  };

  const handleSaveBrand = async (updatedBrand) => {
    try {
      if (updatedBrand.isNew) {
        // Create
        const { isNew, ...brandData } = updatedBrand;
        await api.customers.create(brandData);
      } else {
        // Update
        await api.customers.update(updatedBrand.id, updatedBrand);
      }
      await fetchBrands(); // Refresh list
      setEditingBrand(null);
    } catch (error) {
      console.error("Failed to save brand:", error);
      alert("Failed to save brand. Please try again.");
    }
  };

  const handleDeleteBrand = async (brandId) => {
    if (!window.confirm("Are you sure you want to delete this brand?")) return;
    try {
      await api.customers.delete(brandId);
      await fetchBrands();
      setEditingBrand(null);
    } catch (error) {
      console.error("Failed to delete brand:", error);
      alert("Failed to delete brand.");
    }
  };

  const handleNewBrand = () => {
    setEditingBrand({
      id: '', // Server assigns ID usually, or generates on client? Plan said 'Customer DO', ID usually 'customer' + specific ID.
      // If client generates: crypto.randomUUID()
      // If server: leave empty/temp
      name: '',
      agent: 'Kira',
      defaultAddress: '',
      status: 'Active',
      isNew: true
    });
  };
  const [activePanel, setActivePanel] = useState('profile');
  const [conversationLogs, setConversationLogs] = useState([]);

  // Live Preview states
  const [previewMessages, setPreviewMessages] = useState([]);
  const [kiraInput, setKiraInput] = useState('');
  const [userReply, setUserReply] = useState('');
  const [previewMode, setPreviewMode] = useState('kira');

  const messagesEndRef = useRef(null);

  // Real-time integration
  const [realConversations, setRealConversations] = useState([]);
  const [isRealMode, setIsRealMode] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);

  // Fetch real conversations and subscribe to updates
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          setIsRealMode(true);
          // In a real implementation we would fetch the list here
          // const data = await conversationService.getConversations();
          // setRealConversations(data);

          // Connect to the active conversation if present
          if (activeConversationId) {
            conversationService.connect(activeConversationId);
          }
        }
      } catch (err) {
        console.error("Failed to fetch real conversations:", err);
      }
    };
    fetchConversations();
  }, [activeConversationId]);

  // Subscribe to real-time events
  useEffect(() => {
    if (!isRealMode) return;

    const unsubscribeMessage = conversationService.subscribe('message', (message) => {
      // Append new message to history
      setConversationHistory(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === message.id)) return prev;

        // Convert API message format to UI format
        const uiMessage = {
          id: message.id,
          type: message.sender_type === 'user' ? 'user' : 'kira',
          content: message.content,
          timestamp: new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          hasVoice: false // Handle attachments if needed
        };
        return [...prev, uiMessage];
      });

      // Log for demo purposes
      addLog("Real-time Message", `Received message from ${message.sender_name || 'User'}`);
    });

    const unsubscribeTyping = conversationService.subscribe('typing', (data) => {
      if (data.user_id !== 'me') { // Filter self
        setIsTyping(data.is_typing);
      }
    });

    return () => {
      unsubscribeMessage();
      unsubscribeTyping();
    };
  }, [isRealMode]);

  // Combined conversation list
  // For the demo we append real conversations? Or strictly separate?
  // Let's keep demo data for now as primary unless we have real data logic fully mapped.
  // Ideally: const displayConversations = [...allConversationData, ...mappedRealConversations];

  const scenario = allConversationData[selectedScenario];

  // Initialize conversation when scenario or mode changes
  useEffect(() => {
    if (interactionMode === 'interactive') {
      setConversationHistory([scenario.steps[0]]);
      setCurrentStep(0);
      setConversationLogs([]);
      addLog("Conversation Started", `Initialized ${scenario.name} 's journey - ${scenario.title}`);
    } else {
      setConversationHistory([]);
      setConversationLogs(scenario.logs || []);
    }
  }, [selectedScenario, interactionMode]);

  const addLog = (title, detail, code = null) => {
    const newLog = {
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      title,
      detail,
      ...(code && { code })
    };
    setConversationLogs(prev => [...prev, newLog]);
  };

  const handleOptionClick = (optionText) => {
    const userMessage = {
      type: "user",
      content: optionText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setConversationHistory(prev => [...prev, userMessage]);
    addLog("User Response", `User selected: "${optionText}"`);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);

      let nextSteps = [];
      let foundTrigger = false;

      for (let i = currentStep + 1; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        if (step.trigger === optionText || !step.trigger) {
          nextSteps.push({
            ...step,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          foundTrigger = true;
          if (!scenario.steps[i + 1] || scenario.steps[i + 1].trigger !== optionText) {
            setCurrentStep(i);
            break;
          }
        } else if (foundTrigger) {
          break;
        }
      }

      if (nextSteps.length > 0) {
        setConversationHistory(prev => [...prev, ...nextSteps]);
        addLog("AI Response", `Generated ${nextSteps.length} response(s) based on user intent`);
      } else {
        addLog("Conversation Flow", "Transitioned to free-form conversation mode");
      }
    }, 1000);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const userMessage = {
      type: "user",
      content: userInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setConversationHistory(prev => [...prev, userMessage]);
    addLog("Free-form Input", `User typed: "${userInput}"`);

    const input = userInput;
    setUserInput('');
    setIsTyping(true);

    if (isRealMode && activeConversationId) {
      try {
        await conversationService.sendMessage(activeConversationId, input);
        // No need to manually add to history, WebSocket listener will handle it
        setIsTyping(false);
        return;
      } catch (error) {
        console.error("Failed to send message:", error);
        addLog("Error", "Failed to send message via backend");
        // Fallback to demo mode if backend fails? 
        // For now, let's allow fall-through to demo RAG for testing if no active convo
      }
    }

    setTimeout(async () => {
      try {
        // Use RAG API instead of mock
        const response = await api.conversations.askRAG(input, scenario.title); // Pass scenario title as context if needed

        const kiraMessage = {
          type: "kira",
          content: response.response,
          // options: response.options, // RAG response structure might differ. If options needed, backend must provide.
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setConversationHistory(prev => [...prev, kiraMessage]);
        addLog("AI Response", "Response received from RAG Agent");
      } catch (error) {
        console.error("Chat Error:", error);
        const errorMessage = {
          type: "system",
          content: "Sorry, I'm having trouble connecting right now.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setConversationHistory(prev => [...prev, errorMessage]);
        addLog("Error", "Failed to get AI response");
      } finally {
        setIsTyping(false);
      }
    }, 600); // Reduce mock delay since we have real network latency
  };

  const handleReset = () => {
    setConversationHistory([scenario.steps[0]]);
    setCurrentStep(0);
    setConversationLogs([]);
    addLog("Conversation Reset", "Conversation restarted from beginning");
  };

  // Preview mode handlers
  const handleKiraSend = () => {
    if (!kiraInput.trim()) return;
    setPreviewMessages(prev => [...prev, { sender: 'kira', content: kiraInput }]);
    setKiraInput('');
  };

  const handleUserSend = () => {
    if (!userReply.trim()) return;
    setPreviewMessages(prev => [...prev, { sender: 'user', content: userReply }]);
    setUserReply('');
  };

  const messagesToShow = interactionMode === 'interactive'
    ? conversationHistory
    : scenario.messages;

  const showInputBox = interactionMode === 'interactive' &&
    conversationHistory.length > 0 &&
    !isTyping &&
    (!conversationHistory[conversationHistory.length - 1].options ||
      conversationHistory[conversationHistory.length - 1].options.length === 0);

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />

      {currentView === 'conversations' && (
        <>
          {isInboxOpen && (
            <ConversationsPanel
              allConversationData={allConversationData}
              selectedScenario={selectedScenario}
              setSelectedScenario={setSelectedScenario}
              interactionMode={interactionMode}
              setInteractionMode={setInteractionMode}
              isInboxOpen={isInboxOpen}
              setIsInboxOpen={setIsInboxOpen}
            />
          )}
          <ChatArea
            scenario={scenario}
            interactionMode={interactionMode}
            handleReset={handleReset}
            messagesToShow={messagesToShow}
            isTyping={isTyping}
            handleOptionClick={handleOptionClick}
            showInputBox={showInputBox}
            userInput={userInput}
            setUserInput={setUserInput}
            handleSendMessage={handleSendMessage}
            isInboxOpen={isInboxOpen}
            setIsInboxOpen={setIsInboxOpen}
            isRightPanelOpen={isRightPanelOpen}
            setIsRightPanelOpen={setIsRightPanelOpen}
          />
          {isRightPanelOpen && (
            <RightPanel
              activePanel={activePanel}
              setActivePanel={setActivePanel}
              interactionMode={interactionMode}
              scenario={scenario}
              messagesToShow={messagesToShow}
              currentStep={currentStep}
              conversationLogs={conversationLogs}
              setIsRightPanelOpen={setIsRightPanelOpen}
            />
          )}
        </>
      )}

      {currentView === 'dashboard' && <Dashboard />}

      {currentView === 'preview' && (
        <Preview
          previewMessages={previewMessages}
          previewMode={previewMode}
          setPreviewMode={setPreviewMode}
          kiraInput={kiraInput}
          setKiraInput={setKiraInput}
          userReply={userReply}
          setUserReply={setUserReply}
          handleKiraSend={handleKiraSend}
          handleUserSend={handleUserSend}
        />
      )}

      {currentView === 'brands' && !editingBrand && (
        <ManageBrands
          brands={brands}
          onEditBrand={setEditingBrand}
          onNewBrand={handleNewBrand}
        />
      )}

      {currentView === 'brands' && editingBrand && (
        <EditBrand
          brand={editingBrand}
          onCancel={() => setEditingBrand(null)}
          onSave={handleSaveBrand}
          onDelete={() => handleDeleteBrand(editingBrand.id)}
        />
      )}

      {currentView === 'channels' && (
        <Channels />
      )}

      {currentView === 'knowledge' && (
        <KnowledgeBase />
      )}

      {currentView === 'campaigns' && (
        <CampaignList />
      )}

      {currentView === 'workflows' && (
        <WorkflowList />
      )}

      {currentView === 'testing' && (
        <Testing />
      )}

      {currentView === 'widget' && (
        <WidgetSettings />
      )}

      {currentView === 'settings' && (
        <Settings />
      )}

      {currentView === 'contacts' && (
        <Contacts />
      )}

      {currentView === 'logo-demo' && (
        <LogoDemo />
      )}

      {/* Global AI Agent */}
      <GlobalAIAgent />
    </div >
  );
}

export default App;
