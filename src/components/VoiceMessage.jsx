import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon, DocumentTextIcon } from '@heroicons/react/24/solid';

const VoiceMessage = ({ audioSrc, duration, transcript }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration || 1;
      setProgress((current / total) * 100);
      setCurrentTime(current);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Parse duration string (e.g. "45 seconds") to display initial time if needed
  // But usually we show 00:00 or current time. 
  // The screenshot shows "00:09", implying current time.

  return (
    <div className="flex flex-col gap-2 max-w-md w-full">
      <div className="bg-white border border-gray-200 rounded-xl p-3 px-4 flex items-center gap-4 shadow-sm">
        <button
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center bg-[#635BFF] text-white rounded-full hover:bg-[#534be0] transition-all shrink-0 shadow-sm hover:scale-105 active:scale-95"
        >
          {isPlaying ? (
            <PauseIcon className="w-5 h-5" />
          ) : (
            <PlayIcon className="w-5 h-5 ml-0.5" />
          )}
        </button>

        <div className="flex-1 flex items-center gap-3">
          {/* Custom Slider */}
          <div className="relative flex-1 h-1.5 bg-gray-100 rounded-full cursor-pointer group">
            <div
              className="absolute top-0 left-0 h-full bg-[#635BFF] rounded-full"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[#635BFF] rounded-full border-2 border-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
            />
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => {
                const newTime = (e.target.value / 100) * (audioRef.current?.duration || 0);
                if (audioRef.current) audioRef.current.currentTime = newTime;
                setProgress(e.target.value);
              }}
              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <span className="text-xs font-medium text-gray-500 tabular-nums w-10 text-right">
            {formatTime(Math.max(0, (audioRef.current?.duration || 0) - currentTime))}
          </span>
        </div>

        <div className="h-6 w-px bg-gray-200 mx-1"></div>

        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className={`p-2 rounded-lg transition-all ${showTranscript
            ? 'bg-[#635BFF]/10 text-[#635BFF]'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
          title="View Transcript"
        >
          <DocumentTextIcon className="w-5 h-5" />
        </button>

        <audio
          ref={audioRef}
          src={audioSrc}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          className="hidden"
        />
      </div>

      {showTranscript && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-700 leading-relaxed shadow-sm animate-[slideIn_0.2s_ease-out]">
          {transcript}
        </div>
      )}
    </div>
  );
};

export default VoiceMessage;
