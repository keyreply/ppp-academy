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
import { allConversationData } from './data/conversations';
import { generateAIResponse } from './utils/ai';

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
  const [brands, setBrands] = useState([
    {
      id: 'lr0gyz71',
      name: 'key',
      agent: 'Kira',
      defaultAddress: 'support@key.com',
      status: 'Default brand',
      iconColor: 'text-white bg-blue-600'
    }
  ]);

  const handleSaveBrand = (updatedBrand) => {
    if (brands.find(b => b.id === updatedBrand.id)) {
      setBrands(brands.map(b => b.id === updatedBrand.id ? updatedBrand : b));
    } else {
      setBrands([...brands, { ...updatedBrand, iconColor: 'text-white bg-blue-600' }]);
    }
    setEditingBrand(null);
  };

  const handleNewBrand = () => {
    setEditingBrand({
      id: Math.random().toString(36).substr(2, 9),
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

  const handleSendMessage = () => {
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

    setTimeout(() => {
      setIsTyping(false);
      const aiResponse = generateAIResponse(input);

      const kiraMessage = {
        type: "kira",
        content: aiResponse.content,
        options: aiResponse.options,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setConversationHistory(prev => [...prev, kiraMessage]);
      addLog("AI Generated Response", "Response generated using keyword detection and intent classification");
    }, 1200);
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
        />
      )}

      {currentView === 'channels' && (
        <Channels />
      )}

      {currentView === 'knowledge' && (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Knowledge Base</h2>
            <p className="text-slate-500">Manage your AI's knowledge source here.</p>
          </div>
        </div>
      )}

      {currentView === 'widget' && (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Chat Widget</h2>
            <p className="text-slate-500">Customize your website chat widget.</p>
          </div>
        </div>
      )}

      {currentView === 'contacts' && (
        <Contacts />
      )}

      {/* Global AI Agent */}
      <GlobalAIAgent />
    </div >
  );
}

export default App;
