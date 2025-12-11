import { useState } from 'react';
import { AnimatedLogo, LogoState } from './AnimatedLogo';

/**
 * Demo page to showcase all logo states and sizes
 */
export function LogoDemo() {
  const [currentState, setCurrentState] = useState<LogoState>('idle');
  const states: LogoState[] = ['idle', 'thinking', 'speaking', 'listening', 'success', 'error'];

  const stateDescriptions: Record<LogoState, string> = {
    idle: 'Default resting state with gentle orbital drift',
    thinking: 'Processing - particles swirl inward faster',
    speaking: 'AI is responding - particles pulse outward',
    listening: 'Absorbing input - particles contract and glow',
    success: 'Task complete - celebratory green burst',
    error: 'Error occurred - red flash and scatter',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-2">
            KeyReply Kira - Animated Logo
          </h1>
          <p className="text-slate-400">
            "Neural Murmuration" - A 3D perspective logo with flocking particle behavior
          </p>
        </div>

        {/* Main Demo */}
        <div className="bg-slate-800/50 rounded-2xl p-8 mb-8 backdrop-blur">
          <div className="flex flex-col items-center gap-6">
            {/* Large interactive logo */}
            <div className="relative">
              <AnimatedLogo state={currentState} size="xl" />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs text-slate-500">
                Hover to interact
              </div>
            </div>

            {/* Current state label */}
            <div className="text-center">
              <span className="inline-block px-4 py-2 rounded-full bg-key-deep-blue/20 text-key-blue font-medium">
                {currentState.charAt(0).toUpperCase() + currentState.slice(1)}
              </span>
              <p className="mt-2 text-slate-400 text-sm">
                {stateDescriptions[currentState]}
              </p>
            </div>
          </div>
        </div>

        {/* State Selector */}
        <div className="bg-slate-800/50 rounded-2xl p-6 mb-8 backdrop-blur">
          <h2 className="text-lg font-semibold text-white mb-4">States</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {states.map((state) => (
              <button
                key={state}
                onClick={() => setCurrentState(state)}
                className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                  currentState === state
                    ? 'bg-key-deep-blue text-white'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <AnimatedLogo state={state} size="sm" />
                <span className="text-xs capitalize">{state}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Size Comparison */}
        <div className="bg-slate-800/50 rounded-2xl p-6 mb-8 backdrop-blur">
          <h2 className="text-lg font-semibold text-white mb-4">Sizes</h2>
          <div className="flex items-end justify-center gap-8">
            {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <AnimatedLogo state={currentState} size={size} />
                <span className="text-xs text-slate-400">{size}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Design Notes */}
        <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur">
          <h2 className="text-lg font-semibold text-white mb-4">Design Features</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-key-blue mt-1.5" />
              <div>
                <strong className="text-white">3D Perspective</strong>
                <p className="text-slate-400">Particles exist in 3D space with depth-based scaling and rendering order</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-key-green mt-1.5" />
              <div>
                <strong className="text-white">Murmuration Flocking</strong>
                <p className="text-slate-400">Particles follow separation, alignment, and cohesion rules like starling flocks</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-key-teal mt-1.5" />
              <div>
                <strong className="text-white">Dynamic Trails</strong>
                <p className="text-slate-400">Trail length responds to particle velocity - longer when moving, shorter when still</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-key-deep-blue mt-1.5" />
              <div>
                <strong className="text-white">Interactive Rotation</strong>
                <p className="text-slate-400">Hover to rotate the 3D view with mouse position</p>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Colors Reference */}
        <div className="mt-8 flex justify-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#37CFFF]" />
            <span className="text-xs text-slate-400">Key Blue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#5DE530]" />
            <span className="text-xs text-slate-400">Key Green</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#34DBAE]" />
            <span className="text-xs text-slate-400">Key Teal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#1D57D8]" />
            <span className="text-xs text-slate-400">Key Deep Blue</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LogoDemo;
