import React, { useState, useEffect, useRef } from 'react';
import { Power, Settings, ShieldAlert, Activity, Radio, Sparkles, Wifi } from 'lucide-react';
import { VisualPulse } from './VisualPulse';
import { SplineEditor } from './SplineEditor';

interface DashboardProps {
  wsConnected: boolean;
  connected: boolean;
  deviceName: string;
  lowFreq: number;
  highFreq: number;
  pulseEnabled: boolean;
  pulseInterval: number;
  pulseDuration: number;
  vibrationMultiplier: number;
  lastPulse: any;
  sequenceActive: boolean;
  playheadTime: number;
  inDelay: boolean;
  remainingDelay: number;
  sendVibration: (low: number, high: number) => void;
  sendPulseConfig: (enabled: boolean, interval: number, duration: number) => void;
  sendStop: () => void;
  startSequence: (duration: number, loop: boolean, lowTrack: any[], highTrack: any[], loopDelay?: number) => void;
  stopSequence: () => void;
  sendMultiplier: (multiplier: number) => void;
  onOpenTheme: () => void;
  // Connection Configuration Props
  activeWsUrl: string;
  isAutoWsUrl: boolean;
  onSaveWsUrl: (url: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  wsConnected,
  connected,
  deviceName,
  lowFreq,
  highFreq,
  pulseEnabled,
  pulseInterval,
  pulseDuration,
  vibrationMultiplier,
  lastPulse,
  sequenceActive,
  playheadTime,
  inDelay,
  remainingDelay,
  sendVibration,
  sendPulseConfig,
  sendStop,
  startSequence,
  stopSequence,
  sendMultiplier,
  onOpenTheme,
  activeWsUrl,
  isAutoWsUrl,
  onSaveWsUrl
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'live' | 'sequencer'>('live');

  // Timeline duration state for sequencer
  const [duration, setDuration] = useState(5.0);

  // Local sliders state
  const [localLow, setLocalLow] = useState(lowFreq);
  const [localHigh, setLocalHigh] = useState(highFreq);
  const [localInterval, setLocalInterval] = useState(pulseInterval);
  const [localDuration, setLocalDuration] = useState(pulseDuration);
  
  // Local dragging locks to prevent slider jumps on round-trips
  const [isDraggingLow, setIsDraggingLow] = useState(false);
  const [isDraggingHigh, setIsDraggingHigh] = useState(false);

  // Local multiplier state
  const [localMultiplier, setLocalMultiplier] = useState(() => {
    try {
      const stored = localStorage.getItem('haptic_vibration_multiplier');
      return stored ? parseFloat(stored) : 1.0;
    } catch {
      return 1.0;
    }
  });

  // Connection settings modal state
  const [isConnModalOpen, setIsConnModalOpen] = useState(false);
  const [inputWsUrl, setInputWsUrl] = useState(activeWsUrl);

  // Sync inputs with active configs
  useEffect(() => {
    setInputWsUrl(activeWsUrl);
  }, [activeWsUrl]);

  // Sync local sliders state with server updates only when not dragging
  useEffect(() => {
    if (!isDraggingLow) {
      setLocalLow(lowFreq);
    }
  }, [lowFreq, isDraggingLow]);

  useEffect(() => {
    if (!isDraggingHigh) {
      setLocalHigh(highFreq);
    }
  }, [highFreq, isDraggingHigh]);

  useEffect(() => {
    setLocalInterval(pulseInterval);
  }, [pulseInterval]);

  useEffect(() => {
    setLocalDuration(pulseDuration);
  }, [pulseDuration]);

  // Sync local multiplier with server updates
  useEffect(() => {
    setLocalMultiplier(vibrationMultiplier);
  }, [vibrationMultiplier]);

  const handleMultiplierChange = (val: number) => {
    setLocalMultiplier(val);
    try {
      localStorage.setItem('haptic_vibration_multiplier', val.toString());
    } catch (err) {
      console.error(err);
    }
    sendMultiplier(val);
  };

  // Throttle helper to limit socket traffic to 20Hz (50ms)
  const throttleTimeout = useRef<number | null>(null);
  const nextValues = useRef<{ low: number; high: number } | null>(null);

  const sendVibrationThrottled = (low: number, high: number) => {
    nextValues.current = { low, high };
    
    if (throttleTimeout.current === null) {
      sendVibration(low, high);
      nextValues.current = null;
      
      throttleTimeout.current = window.setTimeout(() => {
        throttleTimeout.current = null;
        if (nextValues.current !== null) {
          sendVibration(nextValues.current.low, nextValues.current.high);
          nextValues.current = null;
        }
      }, 50);
    }
  };

  const handleLowSlider = (val: number) => {
    setLocalLow(val);
    sendVibrationThrottled(val, localHigh);
  };

  const handleHighSlider = (val: number) => {
    setLocalHigh(val);
    sendVibrationThrottled(localLow, val);
  };

  const handlePulseToggle = () => {
    sendPulseConfig(!pulseEnabled, localInterval, localDuration);
  };

  const handleIntervalChange = (val: number) => {
    setLocalInterval(val);
    if (pulseEnabled) {
      sendPulseConfig(true, val, localDuration);
    }
  };

  const handleDurationChange = (val: number) => {
    setLocalDuration(val);
    if (pulseEnabled) {
      sendPulseConfig(true, localInterval, val);
    }
  };

  const triggerPreset = (low: number, high: number) => {
    setLocalLow(low);
    setLocalHigh(high);
    sendVibration(low, high);
  };

  const triggerPulsePreset = (low: number, high: number, interval: number, duration: number) => {
    setLocalLow(low);
    setLocalHigh(high);
    setLocalInterval(interval);
    setLocalDuration(duration);
    
    sendVibration(low, high);
    
    setTimeout(() => {
      sendPulseConfig(true, interval, duration);
    }, 50);
  };

  const handleStopAll = () => {
    setLocalLow(0.0);
    setLocalHigh(0.0);
    sendStop();
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6">
      
      {/* Top Header Row */}
      <header className="flex items-center justify-between pb-3 border-b border-white/5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Haptic Control Studio
          </h1>
          <p className="text-[10px] sm:text-xs text-textSecondary mt-0.5 font-medium">
            Real-time gamepad vibration automation & telemetry
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Server Connection settings icon */}
          <button
            onClick={() => setIsConnModalOpen(true)}
            className={`p-2.5 rounded-xl glass-panel flex items-center justify-center cursor-pointer transition-all border ${
              wsConnected
                ? 'border-secondary/20 bg-secondary/5 text-secondary hover:text-secondary/90 hover:bg-secondary/10 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
                : 'border-rose-500/20 bg-rose-500/5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 shadow-[0_0_10px_rgba(239,68,68,0.05)]'
            }`}
            title="Server Connection Settings"
          >
            <Wifi className="w-4.5 h-4.5" />
          </button>

          <button
            onClick={onOpenTheme}
            className="p-2.5 rounded-xl glass-panel text-textSecondary hover:text-white glass-panel-hover flex items-center justify-center cursor-pointer border border-white/5"
            title="Appearance Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Tab Switcher & Status Bar Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl glass-panel border border-white/5 bg-black/20 self-start">
          <button
            onClick={() => {
              if (sequenceActive) stopSequence();
              setActiveTab('live');
            }}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'live'
                ? 'bg-primary text-white shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                : 'text-textSecondary hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio className="w-4 h-4" /> Live Synthesizer
          </button>
          <button
            onClick={() => {
              // Mute any continuous vibrations before entering sequencer
              if (localLow > 0 || localHigh > 0) handleStopAll();
              setActiveTab('sequencer');
            }}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'sequencer'
                ? 'bg-secondary text-white shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'text-textSecondary hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Sequence Studio
          </button>
        </div>

        {/* Small Hardware Connection Status Tag */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl glass-panel border border-white/5 bg-black/10 text-xs sm:self-center">
          <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center ${
            connected ? 'bg-secondary/20 animate-pulse' : 'bg-slate-500/20'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-secondary shadow-[0_0_8px_var(--secondary-color)]' : 'bg-slate-400'}`} />
          </div>
          <span className="font-semibold text-textSecondary text-[11px] truncate max-w-[180px]">
            {connected ? deviceName : 'No gamepad connected'}
          </span>
        </div>
      </div>

      {/* Main Core Dashboard Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Dynamic Tab View */}
        <div className="lg:col-span-2 space-y-6">
          
          {activeTab === 'live' ? (
            /* TAB 1: LIVE MANUAL SYNTHESIZER */
            <>
              <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-8 relative overflow-hidden border border-white/5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-textSecondary flex items-center gap-2">
                    <Radio className="w-4 h-4 text-primary" /> Motor Frequencies
                  </h2>
                  <div className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-textSecondary">
                    Direct Sliders
                  </div>
                </div>

                {/* Low-Frequency Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold tracking-wide">Low-Frequency rumble</span>
                      <span className="text-[10px] text-textSecondary">Heavy weight, deep rumble (Left motor)</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-primary">{Math.round(localLow * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleLowSlider(localLow > 0 ? 0.0 : 0.5)}
                      disabled={!connected}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                        localLow > 0 
                          ? 'bg-primary/20 border-primary/40 text-white shadow-[0_0_12px_rgba(59,130,246,0.15)]' 
                          : 'border-white/10 text-textSecondary hover:bg-white/5'
                      } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      {localLow > 0 ? 'Mute' : 'Engage'}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1.0"
                      step="0.01"
                      value={localLow}
                      onChange={(e) => handleLowSlider(parseFloat(e.target.value))}
                      onMouseDown={() => setIsDraggingLow(true)}
                      onMouseUp={() => setIsDraggingLow(false)}
                      onTouchStart={() => setIsDraggingLow(true)}
                      onTouchEnd={() => setIsDraggingLow(false)}
                      disabled={!connected}
                      className="flex-1 accent-primary disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* High-Frequency Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold tracking-wide">High-Frequency buzz</span>
                      <span className="text-[10px] text-textSecondary">Sharp speed, buzz/hum (Right motor)</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-secondary">{Math.round(localHigh * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleHighSlider(localHigh > 0 ? 0.0 : 0.5)}
                      disabled={!connected}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                        localHigh > 0 
                          ? 'bg-secondary/20 border-secondary/40 text-white shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                          : 'border-white/10 text-textSecondary hover:bg-white/5'
                      } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      {localHigh > 0 ? 'Mute' : 'Engage'}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1.0"
                      step="0.01"
                      value={localHigh}
                      onChange={(e) => handleHighSlider(parseFloat(e.target.value))}
                      onMouseDown={() => setIsDraggingHigh(true)}
                      onMouseUp={() => setIsDraggingHigh(false)}
                      onTouchStart={() => setIsDraggingHigh(true)}
                      onTouchEnd={() => setIsDraggingHigh(false)}
                      disabled={!connected}
                      className="flex-1 accent-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Continuous Presets */}
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <span className="text-[10px] font-bold text-textSecondary uppercase tracking-widest block">Continuous Presets</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <button
                      onClick={() => triggerPreset(0.3, 0.0)}
                      disabled={!connected}
                      className="py-2 px-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-white/10 cursor-pointer"
                    >
                      <div className="font-semibold">Gentle Rumble</div>
                      <div className="text-[9px] text-textSecondary mt-0.5">LF 30% | HF 0%</div>
                    </button>
                    <button
                      onClick={() => triggerPreset(0.0, 0.4)}
                      disabled={!connected}
                      className="py-2 px-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-white/10 cursor-pointer"
                    >
                      <div className="font-semibold">Sharp Buzz</div>
                      <div className="text-[9px] text-textSecondary mt-0.5">LF 0% | HF 40%</div>
                    </button>
                    <button
                      onClick={() => triggerPreset(0.6, 0.6)}
                      disabled={!connected}
                      className="py-2 px-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-white/10 cursor-pointer"
                    >
                      <div className="font-semibold">Dual Wave</div>
                      <div className="text-[9px] text-textSecondary mt-0.5">LF 60% | HF 60%</div>
                    </button>
                    <button
                      onClick={() => triggerPreset(1.0, 1.0)}
                      disabled={!connected}
                      className="py-2 px-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-primary/30 cursor-pointer"
                    >
                      <div className="font-semibold text-primary">Overdrive</div>
                      <div className="text-[9px] text-primary/80 mt-0.5">LF 100% | HF 100%</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Repeat Mode Panel */}
              <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-6 border border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5 text-secondary" />
                    <h2 className="text-xs font-bold uppercase tracking-widest text-textSecondary">Repeat Mode (Pulse Logic)</h2>
                  </div>
                  <button
                    onClick={handlePulseToggle}
                    disabled={!connected}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                      pulseEnabled ? 'bg-secondary' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                        pulseEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-textSecondary">
                  When Repeat Mode is active, the controller emits vibration pulses at the intensity configured above, repeating at a configured interval.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Repeat Interval</span>
                      <span className="text-xs font-mono font-bold text-secondary">{localInterval.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="5.0"
                      step="0.1"
                      value={localInterval}
                      onChange={(e) => handleIntervalChange(parseFloat(e.target.value))}
                      disabled={!connected}
                      className="accent-secondary disabled:opacity-40"
                    />
                    <span className="text-[10px] text-textSecondary block">Delay between the start of each pulse.</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Pulse Duration</span>
                      <span className="text-xs font-mono font-bold text-secondary">{Math.round(localDuration)}ms</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="1500"
                      step="25"
                      value={localDuration}
                      onChange={(e) => handleDurationChange(parseInt(e.target.value))}
                      disabled={!connected}
                      className="accent-secondary disabled:opacity-40"
                    />
                    <span className="text-[10px] text-textSecondary block">How long the motor vibrates during a pulse.</span>
                  </div>
                </div>

                {/* Pulse Presets */}
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <span className="text-[10px] font-bold text-textSecondary uppercase tracking-widest block">Pulse Presets</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <button
                      onClick={() => triggerPulsePreset(0.6, 0.2, 1.0, 150)}
                      disabled={!connected}
                      className="py-2 px-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-white/10 cursor-pointer"
                    >
                      <div className="font-semibold">Heartbeat Echo</div>
                      <div className="text-[9px] text-textSecondary mt-0.5">Every 1.0s for 150ms</div>
                    </button>
                    <button
                      onClick={() => triggerPulsePreset(0.2, 0.8, 2.5, 300)}
                      disabled={!connected}
                      className="py-2 px-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-white/10 cursor-pointer"
                    >
                      <div className="font-semibold">Sonar Ping</div>
                      <div className="text-[9px] text-textSecondary mt-0.5">Every 2.5s for 300ms</div>
                    </button>
                    <button
                      onClick={() => triggerPulsePreset(0.8, 0.9, 0.5, 200)}
                      disabled={!connected}
                      className="py-2 px-3 rounded-xl border border-secondary/20 bg-secondary/5 hover:bg-secondary/10 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-secondary/30 cursor-pointer"
                    >
                      <div className="font-semibold text-secondary">Warning Siren</div>
                      <div className="text-[9px] text-secondary/80 mt-0.5">Every 0.5s for 200ms</div>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: SPLINE AUTOMATION ENVELOPE EDITOR */
            <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-6 border border-white/5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-textSecondary flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-secondary" /> Spline envelope editor
                </h2>
                <div className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-textSecondary">
                  Automation Grid
                </div>
              </div>
              <SplineEditor
                duration={duration}
                sequenceActive={sequenceActive}
                playheadTime={playheadTime}
                inDelay={inDelay}
                remainingDelay={remainingDelay}
                onDurationChange={setDuration}
                startSequence={startSequence}
                stopSequence={stopSequence}
                activeWsUrl={activeWsUrl}
              />
            </div>
          )}

        </div>

        {/* Right Column - Visual Telemetry & Safe Stop */}
        <div className="space-y-6">
          
          {/* Visual Waveform scope */}
          <div className="glass-panel rounded-3xl p-6 border border-white/5 flex flex-col justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-textSecondary mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Telemetry Scope
            </h2>
            <VisualPulse lowFreq={lowFreq} highFreq={highFreq} lastPulse={lastPulse} />
          </div>

          {/* Safety Emergency Stop */}
          <div className="glass-panel rounded-3xl p-6 border border-rose-500/25 bg-rose-500/5 flex flex-col space-y-4">
            <div className="flex items-center gap-2 text-rose-500">
              <ShieldAlert className="w-5 h-5" />
              <h2 className="text-xs font-bold uppercase tracking-widest">Emergency Safety</h2>
            </div>
            
            <p className="text-xs text-rose-300/80">
              Stop all active patterns, sequences, and vibration loops immediately. Zeroes physical motor registers.
            </p>

            <button
              onClick={handleStopAll}
              disabled={!connected && lowFreq === 0 && highFreq === 0 && !sequenceActive}
              className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs tracking-wide transition-all shadow-[0_4px_20px_rgba(220,38,38,0.25)] hover:shadow-[0_4px_25px_rgba(220,38,38,0.4)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer"
            >
              <Power className="w-4 h-4" /> Stop Haptics (Esc)
            </button>
          </div>
        </div>

      </div>

      {/* Server Connection Settings Modal */}
      {isConnModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            onClick={() => setIsConnModalOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />
          
          {/* Dialog Card */}
          <div className="relative w-full max-w-md bg-slate-950 border border-white/10 rounded-3xl p-6 md:p-8 space-y-5 shadow-[0_10px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-textPrimary flex items-center gap-2">
                <Wifi className="w-4 h-4 text-primary" /> Connection Configuration
              </h3>
              <button 
                onClick={() => setIsConnModalOpen(false)}
                className="text-[10px] font-bold bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg text-textSecondary hover:text-white cursor-pointer transition-all"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              {/* Connection Status Flag */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-black/30 border border-white/5 text-xs">
                <span className="text-textSecondary font-semibold">Websocket Status</span>
                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 ${
                  wsConnected 
                    ? 'bg-secondary/15 text-secondary border border-secondary/35'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/35'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-secondary animate-pulse' : 'bg-rose-400'}`} />
                  {wsConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Vibration Strength Boost Multiplier */}
              <div className="space-y-2 p-3 rounded-2xl bg-black/35 border border-white/5 text-xs">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-textSecondary">Vibration Strength Boost</span>
                  <span className="font-mono text-primary font-bold">{localMultiplier.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={localMultiplier}
                  onChange={(e) => handleMultiplierChange(parseFloat(e.target.value))}
                  className="w-full accent-primary mt-1"
                />
                <span className="text-[9px] text-textSecondary leading-normal block mt-1">
                  Boosts physical haptic motor outputs globally. Useful if rumble feels weak or dampened.
                </span>
              </div>

              {/* URL Form Input */}
              <div className="space-y-2">
                <label className="text-textSecondary font-bold text-[10px] uppercase tracking-wider block">WebSocket Backend Address</label>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={inputWsUrl}
                    onChange={(e) => setInputWsUrl(e.target.value)}
                    placeholder="ws://192.168.1.XX:8000/ws"
                    className="w-full py-2.5 px-3 rounded-xl border border-white/10 bg-slate-900/60 text-white text-xs font-mono focus:outline-none focus:border-primary placeholder-white/20"
                  />
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onSaveWsUrl(inputWsUrl);
                        setIsConnModalOpen(false);
                      }}
                      className="flex-grow py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all cursor-pointer shadow-[0_2px_10px_rgba(59,130,246,0.15)]"
                    >
                      Save & Connect
                    </button>
                    {!isAutoWsUrl && (
                      <button
                        onClick={() => {
                          onSaveWsUrl(''); // Clears storage and resets
                          setIsConnModalOpen(false);
                        }}
                        className="py-2 px-3 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-textSecondary font-semibold cursor-pointer transition-all"
                        title="Reset to Auto-detect"
                      >
                        Reset Auto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Instructions and Guidelines */}
              <div className="pt-3.5 text-[10px] text-textSecondary leading-relaxed space-y-2.5 border-t border-white/5">
                <p className="font-bold text-textPrimary uppercase tracking-wider text-[9px]">How to connect from other devices:</p>
                
                <div className="space-y-1 bg-white/2 p-2.5 rounded-xl border border-white/5">
                  <p className="font-bold text-textPrimary flex items-center gap-1">📱 1. Mobile Wi-Fi Connection</p>
                  <p>Connect your phone and laptop to the **same Wi-Fi network**. Open the app on your phone via the LAN host address shown in your laptop terminal:</p>
                  <p className="font-mono text-[9px] text-primary mt-1 bg-black/40 px-2 py-1 rounded border border-white/5">
                    http://{window.location.hostname}:5173
                  </p>
                </div>

                <div className="space-y-1 bg-white/2 p-2.5 rounded-xl border border-white/5">
                  <p className="font-bold text-textPrimary flex items-center gap-1">🔒 2. Production Vercel (HTTPS)</p>
                  <p>Secure pages block local network <code>ws://</code> requests. If accessing via Vercel, run a secure tunnel on your laptop:</p>
                  <p className="font-mono text-[9px] text-secondary mt-1 bg-black/40 px-2 py-1 rounded border border-white/5">
                    ngrok http 8000
                  </p>
                  <p className="mt-1">Then, copy the secure <code>wss://...</code> URL from your terminal and paste it here.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
