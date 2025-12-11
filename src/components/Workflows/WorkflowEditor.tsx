import { useState, useCallback, useEffect, useMemo } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    Handle,
    Position,
    type Node,
    type Edge,
    type NodeProps,
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
    ArrowPathIcon,
    PlayIcon,
    Cog6ToothIcon,
    ChevronDownIcon,
    ArrowsPointingOutIcon,
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
        color?: string;
        icon?: string;
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

// Node configuration
const NODE_CONFIGS = {
    trigger: { gradient: 'from-key-deep-blue to-key-blue', ring: 'ring-key-deep-blue/20', iconBg: 'bg-key-deep-blue' },
    action: { gradient: 'from-key-blue to-key-teal', ring: 'ring-key-blue/20', iconBg: 'bg-key-blue' },
    condition: { gradient: 'from-key-teal to-key-green', ring: 'ring-key-teal/20', iconBg: 'bg-key-teal' },
    delay: { gradient: 'from-amber-500 to-orange-500', ring: 'ring-amber-500/20', iconBg: 'bg-amber-500' },
    run_code: { gradient: 'from-violet-500 to-purple-500', ring: 'ring-violet-500/20', iconBg: 'bg-violet-500' },
};

const getNodeIcon = (nodeType: string, label: string) => {
    if (nodeType === 'run_code') return CommandLineIcon;
    if (nodeType === 'condition') return CodeBracketIcon;
    if (nodeType === 'delay') return ClockIcon;
    if (label.includes('Email')) return EnvelopeIcon;
    if (label.includes('Message')) return ChatBubbleLeftRightIcon;
    if (label.includes('Notification')) return BellIcon;
    if (label.includes('Tag')) return TagIcon;
    return BoltIcon;
};

// Custom Node Component
function CustomNode({ data, selected }: NodeProps) {
    const nodeType = data.nodeType as string || 'trigger';
    const config = NODE_CONFIGS[nodeType as keyof typeof NODE_CONFIGS] || NODE_CONFIGS.trigger;
    const Icon = getNodeIcon(nodeType, data.label as string);

    return (
        <div
            className={`
                group relative
                ${selected ? 'scale-105' : ''}
                transition-all duration-200 ease-out
            `}
        >
            {/* Glow effect on hover/select */}
            <div className={`
                absolute -inset-2 rounded-2xl opacity-0 blur-xl transition-opacity duration-300
                bg-gradient-to-br ${config.gradient}
                ${selected ? 'opacity-30' : 'group-hover:opacity-20'}
            `} />

            {/* Main node card */}
            <div className={`
                relative bg-white rounded-xl border-2 shadow-lg
                min-w-[180px] overflow-hidden
                transition-all duration-200
                ${selected ? 'border-key-deep-blue shadow-xl shadow-key-deep-blue/10' : 'border-slate-200 hover:border-slate-300 hover:shadow-xl'}
            `}>
                {/* Top accent bar */}
                <div className={`h-1 bg-gradient-to-r ${config.gradient}`} />

                {/* Content */}
                <div className="p-4">
                    <div className="flex items-center gap-3">
                        <div className={`
                            w-10 h-10 rounded-xl ${config.iconBg}
                            flex items-center justify-center
                            shadow-lg shadow-current/20
                            transition-transform duration-200
                            group-hover:scale-110
                        `}>
                            <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                                {data.label as string}
                            </p>
                            <p className="text-xs text-slate-500 capitalize">
                                {nodeType.replace('_', ' ')}
                            </p>
                        </div>
                    </div>

                    {/* Show config indicator for run_code nodes */}
                    {nodeType === 'run_code' && data.functionName && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="flex items-center gap-2 text-xs text-violet-600 bg-violet-50 px-2 py-1 rounded-lg">
                                <Cog6ToothIcon className="w-3 h-3" />
                                <span className="truncate font-medium">{data.functionName as string}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Handles with custom styling */}
                <Handle
                    type="target"
                    position={Position.Top}
                    className="!w-3 !h-3 !bg-slate-300 !border-2 !border-white hover:!bg-key-deep-blue transition-colors !-top-1.5"
                />
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="!w-3 !h-3 !bg-slate-300 !border-2 !border-white hover:!bg-key-deep-blue transition-colors !-bottom-1.5"
                />
            </div>
        </div>
    );
}

// Start Node Component
function StartNode({ data, selected }: NodeProps) {
    return (
        <div className={`
            group relative
            ${selected ? 'scale-105' : ''}
            transition-all duration-200 ease-out
        `}>
            {/* Animated pulse ring */}
            <div className="absolute inset-0 rounded-full bg-key-deep-blue/20 animate-ping" style={{ animationDuration: '2s' }} />

            {/* Main node */}
            <div className={`
                relative w-24 h-24 rounded-full
                bg-gradient-to-br from-key-deep-blue to-key-blue
                shadow-xl shadow-key-deep-blue/30
                flex items-center justify-center
                transition-all duration-200
                ${selected ? 'ring-4 ring-key-deep-blue/30' : ''}
            `}>
                <div className="text-center">
                    <PlayIcon className="w-8 h-8 text-white mx-auto mb-1" />
                    <span className="text-xs font-semibold text-white/90">START</span>
                </div>

                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="!w-4 !h-4 !bg-white !border-2 !border-key-deep-blue !-bottom-2"
                />
            </div>
        </div>
    );
}

const nodeTypes = {
    custom: CustomNode,
    start: StartNode,
};

const initialNodes: Node[] = [
    {
        id: '1',
        type: 'start',
        data: { label: 'Start Trigger' },
        position: { x: 250, y: 0 },
    },
];

const initialEdges: Edge[] = [];

// Node palette configuration
const nodePalette = [
    {
        category: 'Triggers',
        description: 'Events that start workflows',
        items: [
            { type: 'trigger', label: 'Page View', icon: BoltIcon, color: '#1D57D8' },
            { type: 'trigger', label: 'Inbound Message', icon: ChatBubbleLeftRightIcon, color: '#1D57D8' },
            { type: 'trigger', label: 'Tag Added', icon: TagIcon, color: '#1D57D8' },
        ]
    },
    {
        category: 'Actions',
        description: 'Tasks to perform',
        items: [
            { type: 'action', label: 'Send Message', icon: ChatBubbleLeftRightIcon, color: '#37CFFF' },
            { type: 'action', label: 'Send Email', icon: EnvelopeIcon, color: '#37CFFF' },
            { type: 'action', label: 'Send Notification', icon: BellIcon, color: '#37CFFF' },
            { type: 'action', label: 'Add Tag', icon: TagIcon, color: '#37CFFF' },
        ]
    },
    {
        category: 'Logic',
        description: 'Control flow',
        items: [
            { type: 'condition', label: 'Condition', icon: CodeBracketIcon, color: '#34DBAE' },
            { type: 'delay', label: 'Delay', icon: ClockIcon, color: '#F59E0B' },
        ]
    },
    {
        category: 'Advanced',
        description: 'Custom code execution',
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
        <div className="fixed inset-0 bg-key-navy/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
                className="bg-white rounded-2xl shadow-2xl w-[900px] max-h-[90vh] overflow-hidden flex flex-col border border-slate-200"
                style={{ animation: 'slideUp 0.3s ease-out' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <CommandLineIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Configure Code Block</h2>
                            <p className="text-sm text-slate-500 mt-0.5">Execute custom JavaScript in your workflow</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-white/80 rounded-xl transition-all"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Function Name */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Function Name</label>
                        <input
                            type="text"
                            value={functionName}
                            onChange={(e) => setFunctionName(e.target.value)}
                            placeholder="my_custom_function"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all text-slate-900"
                        />
                        <p className="text-xs text-slate-500 mt-1.5">This will be used as the Platform Function name</p>
                    </div>

                    {/* AI Code Generation */}
                    <div className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 p-5">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-400/20 to-purple-400/20 rounded-full blur-2xl" />
                        <div className="relative">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg">
                                    <SparklesIcon className="w-4 h-4 text-white" />
                                </div>
                                <span className="font-semibold text-violet-900">AI Code Generation</span>
                                <span className="px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 rounded-full">Beta</span>
                            </div>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleGenerateCode()}
                                    placeholder="Describe what the code should do..."
                                    className="flex-1 px-4 py-3 border border-violet-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white/80 backdrop-blur-sm transition-all text-slate-900 placeholder-slate-400"
                                />
                                <button
                                    onClick={handleGenerateCode}
                                    disabled={isGenerating || !aiPrompt.trim()}
                                    className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold shadow-lg shadow-violet-500/25"
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
                                <p className="text-sm text-red-600 mt-3 flex items-center gap-2">
                                    <ExclamationTriangleIcon className="w-4 h-4" />
                                    {generationError}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Code Editor */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Function Code</label>
                        <div className="relative rounded-xl overflow-hidden border border-slate-200">
                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                </div>
                                <span className="text-xs text-slate-400 ml-2">index.js</span>
                            </div>
                            <textarea
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                rows={14}
                                placeholder={`export default async function handler(input) {
  const { __context, ...userInput } = input;

  // Your code here

  return result;
}`}
                                className="w-full px-4 py-4 font-mono text-sm bg-slate-900 text-emerald-400 focus:outline-none resize-none"
                                style={{ tabSize: 2 }}
                                spellCheck={false}
                            />
                        </div>
                    </div>

                    {/* Input Mapping */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold text-slate-700">Input Mapping</label>
                            <button
                                onClick={addInputMapping}
                                className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
                            >
                                <PlusCircleIcon className="w-4 h-4" />
                                Add Input
                            </button>
                        </div>
                        <div className="space-y-2">
                            {Object.entries(inputMapping).map(([key, value]) => (
                                <div key={key} className="flex gap-3 items-center">
                                    <input
                                        type="text"
                                        value={key}
                                        onChange={(e) => updateInputMapping(key, e.target.value, value as string)}
                                        placeholder="Parameter name"
                                        className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all"
                                    />
                                    <div className="text-slate-300 font-mono">=</div>
                                    <input
                                        type="text"
                                        value={value as string}
                                        onChange={(e) => updateInputMapping(key, key, e.target.value)}
                                        placeholder="{{customer.email}}"
                                        className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all font-mono"
                                    />
                                    <button
                                        onClick={() => removeInputMapping(key)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {Object.keys(inputMapping).length === 0 && (
                                <div className="text-sm text-slate-500 italic bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200">
                                    No input mappings defined. Click "Add Input" to map workflow variables to function parameters.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Output Variable & Timeout */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Output Variable</label>
                            <input
                                type="text"
                                value={outputVariable}
                                onChange={(e) => setOutputVariable(e.target.value)}
                                placeholder="codeResult"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all font-mono text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Timeout (ms)</label>
                            <input
                                type="number"
                                value={timeout}
                                onChange={(e) => setTimeout(parseInt(e.target.value) || 10000)}
                                min={1000}
                                max={30000}
                                step={1000}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
                    <p className="text-xs text-slate-500">
                        Code runs in an isolated sandbox with 30s max execution time
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-slate-600 hover:text-slate-800 font-medium transition-colors hover:bg-slate-100 rounded-xl"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!functionName.trim() || !code.trim()}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold shadow-lg shadow-violet-500/25"
                        >
                            <CheckCircleIcon className="w-4 h-4" />
                            Save Configuration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function WorkflowEditor({ workflowId, onClose }: WorkflowEditorProps) {
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const [name, setName] = useState("New Workflow");
    const [triggerType, setTriggerType] = useState("page_view");
    const [saving, setSaving] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['Triggers', 'Actions', 'Logic', 'Advanced']);

    const customNodeTypes = useMemo(() => nodeTypes, []);

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
        (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [],
    );
    const onEdgesChange = useCallback(
        (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [],
    );
    const onConnect = useCallback(
        (params: any) => setEdges((eds) => addEdge({
            ...params,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
            animated: true,
        }, eds)),
        [],
    );

    const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType, label }));
        event.dataTransfer.effectAllowed = 'move';
    };

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const data = JSON.parse(event.dataTransfer.getData('application/reactflow'));
            const position = {
                x: event.clientX - 400,
                y: event.clientY - 150,
            };

            const newNode: Node = {
                id: `node_${Date.now()}`,
                type: 'custom',
                position,
                data: {
                    label: data.label,
                    nodeType: data.nodeType,
                },
            };

            setNodes((nds) => nds.concat(newNode));

            if (data.nodeType === 'run_code') {
                setSelectedNode(newNode as unknown as WorkflowNode);
            }
        },
        [],
    );

    const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        if (node.data?.nodeType === 'run_code') {
            setSelectedNode(node as unknown as WorkflowNode);
        }
    }, []);

    const handleNodeUpdate = useCallback((updatedNode: WorkflowNode) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === updatedNode.id ? updatedNode as unknown as Node : node
            )
        );
    }, []);

    const onDragOver = useCallback((event: React.DragEvent) => {
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

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    return (
        <div className="flex flex-col h-screen bg-slate-100">
            {/* Header */}
            <header className="relative h-16 bg-white border-b border-slate-200 shadow-sm z-20">
                {/* Gradient accent line */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-key-deep-blue via-key-blue to-key-teal" />

                <div className="h-full flex items-center justify-between px-4">
                    {/* Left section */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                        </button>

                        <div className="h-8 w-px bg-slate-200" />

                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-key-deep-blue to-key-blue rounded-lg shadow-md shadow-key-deep-blue/20">
                                <BoltIcon className="w-4 h-4 text-white" />
                            </div>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="text-lg font-semibold text-slate-900 bg-transparent border-none focus:outline-none focus:ring-0 px-0"
                                placeholder="Workflow name"
                            />
                        </div>
                    </div>

                    {/* Center - Trigger selector */}
                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Trigger:</span>
                        <select
                            value={triggerType}
                            onChange={(e) => setTriggerType(e.target.value)}
                            className="pl-3 pr-8 py-1.5 text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-key-deep-blue/20 focus:border-key-deep-blue appearance-none cursor-pointer"
                        >
                            <option value="page_view">Page View</option>
                            <option value="inbound_message">Inbound Message</option>
                            <option value="tag_added">Tag Added</option>
                        </select>
                    </div>

                    {/* Right section */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsActive(!isActive)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                                isActive
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {isActive ? 'Active' : 'Inactive'}
                        </button>

                        <div className="h-8 w-px bg-slate-200" />

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-key-deep-blue to-key-blue text-white rounded-lg hover:shadow-lg hover:shadow-key-deep-blue/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm"
                        >
                            <CloudArrowUpIcon className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left sidebar - Node palette */}
                <aside className="w-72 bg-white border-r border-slate-200 shadow-sm overflow-y-auto">
                    <div className="p-5">
                        <div className="mb-6">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Components
                            </h2>
                            <p className="text-xs text-slate-500">
                                Drag nodes to the canvas
                            </p>
                        </div>

                        {nodePalette.map((category) => (
                            <div key={category.category} className="mb-4">
                                <button
                                    onClick={() => toggleCategory(category.category)}
                                    className="w-full flex items-center justify-between py-2 text-left group"
                                >
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                                            {category.category}
                                        </h3>
                                        <p className="text-xs text-slate-400">{category.description}</p>
                                    </div>
                                    <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${
                                        expandedCategories.includes(category.category) ? '' : '-rotate-90'
                                    }`} />
                                </button>

                                {expandedCategories.includes(category.category) && (
                                    <div className="mt-2 space-y-1.5">
                                        {category.items.map((item, idx) => {
                                            const Icon = item.icon;
                                            return (
                                                <div
                                                    key={idx}
                                                    draggable
                                                    onDragStart={(e) => onDragStart(e, item.type, item.label)}
                                                    className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-md cursor-grab active:cursor-grabbing transition-all group"
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-110"
                                                        style={{ backgroundColor: item.color }}
                                                    >
                                                        <Icon className="w-4 h-4 text-white" />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 flex-1">
                                                        {item.label}
                                                    </span>
                                                    <PlusCircleIcon className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Tips card */}
                        <div className="mt-6 p-4 bg-gradient-to-br from-key-deep-blue/5 to-key-blue/5 rounded-xl border border-key-blue/10">
                            <div className="flex items-start gap-3">
                                <div className="p-1.5 bg-key-deep-blue/10 rounded-lg">
                                    <SparklesIcon className="w-4 h-4 text-key-deep-blue" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-700 mb-1">Pro tip</p>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Connect nodes by dragging from the bottom handle to the top handle of another node.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Canvas area */}
                <main
                    className="flex-1 relative"
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                >
                    {/* Blueprint-style background pattern */}
                    <div
                        className="absolute inset-0 opacity-40"
                        style={{
                            backgroundImage: `
                                linear-gradient(to right, #e2e8f0 1px, transparent 1px),
                                linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
                            `,
                            backgroundSize: '24px 24px',
                        }}
                    />

                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        nodeTypes={customNodeTypes}
                        fitView
                        className="bg-slate-50/50"
                        defaultEdgeOptions={{
                            style: { stroke: '#94a3b8', strokeWidth: 2 },
                            animated: true,
                        }}
                    >
                        <Background color="#cbd5e1" gap={24} size={1} />
                        <Controls
                            className="!bg-white !border !border-slate-200 !rounded-xl !shadow-lg overflow-hidden"
                            showInteractive={false}
                        />
                    </ReactFlow>

                    {/* Canvas overlay info */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-slate-200 text-xs text-slate-600">
                            <span className="font-medium">{nodes.length}</span> nodes
                            <span className="text-slate-300">•</span>
                            <span className="font-medium">{edges.length}</span> connections
                        </div>
                    </div>
                </main>
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
