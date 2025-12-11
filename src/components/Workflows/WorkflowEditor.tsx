import { useState, useCallback, useEffect } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../../services/api';
import {
    ArrowLeftIcon,
    CloudArrowUpIcon,
    BoltIcon,
    ChatBubbleLeftRightIcon,
    ClockIcon,
    CodeBracketIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    EnvelopeIcon,
    BellIcon,
    TagIcon,
    PlusCircleIcon,
    CommandLineIcon,
    SparklesIcon,
    XMarkIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

// Types
interface WorkflowNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: {
        label: string;
        nodeType?: string;
        functionName?: string;
        code?: string;
        inputMapping?: Record<string, string>;
        outputVariable?: string;
        timeout?: number;
    };
}

interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
}

interface RunCodeConfigPanelProps {
    node: WorkflowNode;
    onUpdate: (node: WorkflowNode) => void;
    onClose: () => void;
}

interface WorkflowEditorProps {
    workflowId?: string;
    onClose: () => void;
}

const initialNodes = [
    {
        id: '1',
        type: 'input',
        data: { label: 'Start Trigger' },
        position: { x: 250, y: 0 },
    },
];

const initialEdges: WorkflowEdge[] = [];

// Node palette configuration
const nodeTypes = [
    {
        category: 'Triggers',
        items: [
            { type: 'trigger', label: 'Page View', icon: BoltIcon, color: '#1D57D8' },
            { type: 'trigger', label: 'Inbound Message', icon: ChatBubbleLeftRightIcon, color: '#1D57D8' },
            { type: 'trigger', label: 'Tag Added', icon: TagIcon, color: '#1D57D8' },
        ]
    },
    {
        category: 'Actions',
        items: [
            { type: 'action', label: 'Send Message', icon: ChatBubbleLeftRightIcon, color: '#37CFFF' },
            { type: 'action', label: 'Send Email', icon: EnvelopeIcon, color: '#37CFFF' },
            { type: 'action', label: 'Send Notification', icon: BellIcon, color: '#37CFFF' },
            { type: 'action', label: 'Add Tag', icon: TagIcon, color: '#37CFFF' },
        ]
    },
    {
        category: 'Logic',
        items: [
            { type: 'condition', label: 'Condition', icon: CodeBracketIcon, color: '#34DBAE' },
            { type: 'delay', label: 'Delay', icon: ClockIcon, color: '#34DBAE' },
        ]
    },
    {
        category: 'Advanced',
        items: [
            { type: 'run_code', label: 'Run Code', icon: CommandLineIcon, color: '#8B5CF6' },
        ]
    }
];

// RunCode node configuration panel
function RunCodeConfigPanel({ node, onUpdate, onClose }: RunCodeConfigPanelProps) {
    const [functionName, setFunctionName] = useState(node?.data?.functionName || '');
    const [code, setCode] = useState(node?.data?.code || '');
    const [inputMapping, setInputMapping] = useState(node?.data?.inputMapping || {});
    const [outputVariable, setOutputVariable] = useState(node?.data?.outputVariable || 'codeResult');
    const [timeout, setTimeout] = useState(node?.data?.timeout || 10000);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState('');

    const handleGenerateCode = async () => {
        if (!aiPrompt.trim()) return;

        setIsGenerating(true);
        setGenerationError('');

        try {
            const response = await api.functions.generateCode({
                prompt: aiPrompt,
                existingCode: code || undefined,
                context: {
                    functionName: functionName || 'workflow_function',
                    inputVariables: Object.keys(inputMapping),
                    outputVariables: [outputVariable],
                },
            });

            if (response.success && response.code) {
                setCode(response.code);
            } else {
                setGenerationError(response.error || 'Failed to generate code');
            }
        } catch (err: unknown) {
            setGenerationError((err as Error).message || 'Failed to generate code');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => {
        onUpdate({
            ...node,
            data: {
                ...node.data,
                functionName,
                code,
                inputMapping,
                outputVariable,
                timeout,
            }
        });
        onClose();
    };

    const addInputMapping = () => {
        const key = `input${Object.keys(inputMapping).length + 1}`;
        setInputMapping({ ...inputMapping, [key]: '' });
    };

    const updateInputMapping = (oldKey: string, newKey: string, value: string) => {
        const updated = { ...inputMapping };
        if (oldKey !== newKey) {
            delete updated[oldKey];
        }
        updated[newKey] = value;
        setInputMapping(updated);
    };

    const removeInputMapping = (key: string) => {
        const updated = { ...inputMapping };
        delete updated[key];
        setInputMapping(updated);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-purple-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                            <CommandLineIcon className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Configure Run Code Step</h2>
                            <p className="text-sm text-slate-500">Execute custom JavaScript in your workflow</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Function Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Function Name</label>
                        <input
                            type="text"
                            value={functionName}
                            onChange={(e) => setFunctionName(e.target.value)}
                            placeholder="my_custom_function"
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors"
                        />
                        <p className="text-xs text-slate-500 mt-1">This will be used as the Platform Function name</p>
                    </div>

                    {/* AI Code Generation */}
                    <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
                        <div className="flex items-center gap-2 mb-3">
                            <SparklesIcon className="w-5 h-5 text-violet-600" />
                            <span className="font-medium text-violet-900">AI Code Generation</span>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleGenerateCode()}
                                placeholder="Describe what the code should do, e.g., 'Fetch user data from API and calculate score'"
                                className="flex-1 px-4 py-2.5 border border-violet-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white transition-colors"
                            />
                            <button
                                onClick={handleGenerateCode}
                                disabled={isGenerating || !aiPrompt.trim()}
                                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                            >
                                {isGenerating ? (
                                    <>
                                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="w-4 h-4" />
                                        Generate
                                    </>
                                )}
                            </button>
                        </div>
                        {generationError && (
                            <p className="text-sm text-red-600 mt-2">{generationError}</p>
                        )}
                    </div>

                    {/* Code Editor */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Function Code</label>
                        <textarea
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            rows={12}
                            placeholder={`export default async function handler(input) {
  const { __context, ...userInput } = input;

  // Your code here

  return result;
}`}
                            className="w-full px-4 py-3 font-mono text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-slate-900 text-green-400 transition-colors"
                            style={{ tabSize: 2 }}
                        />
                    </div>

                    {/* Input Mapping */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-slate-700">Input Mapping</label>
                            <button
                                onClick={addInputMapping}
                                className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                            >
                                + Add Input
                            </button>
                        </div>
                        <div className="space-y-2">
                            {Object.entries(inputMapping).map(([key, value]) => (
                                <div key={key} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={key}
                                        onChange={(e) => updateInputMapping(key, e.target.value, value as string)}
                                        placeholder="Parameter name"
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                                    />
                                    <span className="flex items-center text-slate-400">=</span>
                                    <input
                                        type="text"
                                        value={value as string}
                                        onChange={(e) => updateInputMapping(key, key, e.target.value)}
                                        placeholder="customer.email"
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                                    />
                                    <button
                                        onClick={() => removeInputMapping(key)}
                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {Object.keys(inputMapping).length === 0 && (
                                <p className="text-sm text-slate-500 italic">No input mappings defined. Click "Add Input" to map workflow variables to function parameters.</p>
                            )}
                        </div>
                    </div>

                    {/* Output Variable */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Output Variable</label>
                            <input
                                type="text"
                                value={outputVariable}
                                onChange={(e) => setOutputVariable(e.target.value)}
                                placeholder="codeResult"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Timeout (ms)</label>
                            <input
                                type="number"
                                value={timeout}
                                onChange={(e) => setTimeout(parseInt(e.target.value) || 10000)}
                                min={1000}
                                max={30000}
                                step={1000}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!functionName.trim() || !code.trim()}
                        className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        <CheckCircleIcon className="w-4 h-4" />
                        Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function WorkflowEditor({ workflowId, onClose }: WorkflowEditorProps) {
    const [nodes, setNodes] = useState(initialNodes);
    const [edges, setEdges] = useState(initialEdges);
    const [name, setName] = useState("New Workflow");
    const [triggerType, setTriggerType] = useState("page_view");
    const [saving, setSaving] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);

    useEffect(() => {
        if (workflowId) {
            loadWorkflow();
        }
    }, [workflowId]);

    const loadWorkflow = async () => {
        try {
            const data = await api.workflows.get(workflowId);
            if (data.workflow) {
                const wf = data.workflow;
                setName(wf.name);
                setTriggerType(wf.trigger_type);
                setIsActive(wf.is_active);
                if (wf.definition) {
                    setNodes(wf.definition.nodes || initialNodes);
                    setEdges(wf.definition.edges || initialEdges);
                }
            }
        } catch (error) {
            console.error("Failed to load workflow:", error);
        }
    };

    const onNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [],
    );
    const onEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [],
    );
    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [],
    );

    const onDragStart = (event, nodeType, label) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType, label }));
        event.dataTransfer.effectAllowed = 'move';
    };

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();

            const data = JSON.parse(event.dataTransfer.getData('application/reactflow'));
            const position = {
                x: event.clientX - 350, // Adjust for sidebar width
                y: event.clientY - 120, // Adjust for header height
            };

            const newNode = {
                id: `node_${Date.now()}`,
                type: 'default',
                position,
                data: {
                    label: data.label,
                    nodeType: data.nodeType,
                },
            };

            setNodes((nds) => nds.concat(newNode));

            // If it's a run_code node, open the config panel immediately
            if (data.nodeType === 'run_code') {
                setSelectedNode(newNode);
            }
        },
        [nodes],
    );

    const onNodeClick = useCallback((event, node) => {
        // Only open config panel for run_code nodes
        if (node.data?.nodeType === 'run_code') {
            setSelectedNode(node);
        }
    }, []);

    const handleNodeUpdate = useCallback((updatedNode) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === updatedNode.id ? updatedNode : node
            )
        );
    }, []);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                name,
                triggerType,
                isActive,
                definition: { nodes, edges }
            };

            if (workflowId) {
                await api.workflows.update(workflowId, payload);
            } else {
                await api.workflows.create(payload);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save workflow:", error);
            alert("Failed to save");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header with gradient accent */}
            <div className="relative h-20 border-b border-slate-200 bg-white shadow-sm">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1D57D8] via-[#37CFFF] to-[#34DBAE]"></div>
                <div className="h-full flex items-center justify-between px-6">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-4">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="bg-transparent text-xl font-semibold text-slate-900 focus:outline-none border-b-2 border-transparent focus:border-[#1D57D8] transition-colors px-1"
                                placeholder="Workflow name"
                            />
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                                <select
                                    value={triggerType}
                                    onChange={(e) => setTriggerType(e.target.value)}
                                    className="text-sm bg-transparent text-slate-700 focus:outline-none"
                                >
                                    <option value="page_view">Page View</option>
                                    <option value="inbound_message">Inbound Message</option>
                                    <option value="tag_added">Tag Added</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Status indicator */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsActive(!isActive)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                            >
                                {isActive ? (
                                    <>
                                        <CheckCircleIcon className="w-4 h-4" />
                                        Active
                                    </>
                                ) : (
                                    <>
                                        <ExclamationTriangleIcon className="w-4 h-4" />
                                        Inactive
                                    </>
                                )}
                            </button>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#1D57D8] text-white rounded-lg hover:bg-[#1546b0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm font-medium"
                        >
                            <CloudArrowUpIcon className="w-5 h-5" />
                            {saving ? 'Saving...' : 'Save Workflow'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main content area with sidebar and canvas */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left sidebar - Node palette */}
                <div className="w-72 bg-white border-r border-slate-200 shadow-sm overflow-y-auto">
                    <div className="p-6">
                        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
                            Node Palette
                        </h2>
                        <p className="text-sm text-slate-600 mb-6">
                            Drag and drop nodes onto the canvas to build your workflow.
                        </p>

                        {nodeTypes.map((category) => (
                            <div key={category.category} className="mb-6">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                    {category.category}
                                </h3>
                                <div className="space-y-2">
                                    {category.items.map((item, idx) => {
                                        const Icon = item.icon;
                                        return (
                                            <div
                                                key={idx}
                                                draggable
                                                onDragStart={(e) => onDragStart(e, item.type, item.label)}
                                                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all group"
                                            >
                                                <div
                                                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                                                    style={{ backgroundColor: `${item.color}15` }}
                                                >
                                                    <Icon className="w-4 h-4" style={{ color: item.color }} />
                                                </div>
                                                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                                                    {item.label}
                                                </span>
                                                <PlusCircleIcon className="w-4 h-4 text-slate-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        <div className="mt-8 p-4 bg-gradient-to-br from-[#1D57D8]/5 to-[#37CFFF]/5 rounded-lg border border-[#37CFFF]/20">
                            <p className="text-xs text-slate-600 leading-relaxed">
                                <strong className="text-slate-900">Tip:</strong> Connect nodes by dragging from one node's handle to another. Use conditions to create branching logic.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Canvas area */}
                <div className="flex-1 bg-slate-50" onDrop={onDrop} onDragOver={onDragOver}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        fitView
                        className="bg-slate-50"
                    >
                        <Background color="#cbd5e1" gap={16} size={1} />
                        <Controls className="bg-white border border-slate-200 rounded-lg shadow-sm" />
                    </ReactFlow>
                </div>
            </div>

            {/* Run Code Configuration Panel */}
            {selectedNode && selectedNode.data?.nodeType === 'run_code' && (
                <RunCodeConfigPanel
                    node={selectedNode}
                    onUpdate={handleNodeUpdate}
                    onClose={() => setSelectedNode(null)}
                />
            )}
        </div>
    );
}
