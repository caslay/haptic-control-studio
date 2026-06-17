import React, { useState, useEffect, useRef } from 'react';
import { Power, Settings, ShieldAlert, Activity, Radio } from 'lucide-react';
import { VisualPulse } from './VisualPulse';

interface DashboardProps {
  wsConnected: boolean;
  connected: boolean;
  deviceName: string;
  lowFreq: number;
  highFreq: number;
  pulseEnabled: boolean;
  pulseInterval: number;
  pulseDuration: number;
  lastPulse: any;
  sendVibration: (low: number, high: number) => void;
  sendPulseConfig: (enabled: boolean, interval: number, duration: number) => void;
  sendStop: () => void;
  onOpenTheme: () => void;
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
  lastPulse,
  sendVibration,
  sendPulseConfig,
  sendStop,
  onOpenTheme
}) => {
  // Local sliders state
  const [localLow, setLocalLow] = useState(lowFreq);
  const [localHigh, setLocalHigh] = useState(highFreq);
  const [localInterval, setLocalInterval] = useState(pulseInterval);
  const [localDuration, setLocalDuration] = useState(pulseDuration);

  // Sync local sliders state with server updates
  useEffect(() => {
    setLocalLow(lowFreq);
  }, [lowFreq]);

  useEffect(() => {
    setLocalHigh(highFreq);
  }, [highFreq]);

  useEffect(() => {
    setLocalInterval(pulseInterval);
  }, [pulseInterval]);

  useEffect(() => {
    setLocalDuration(pulseDuration);
  }, [pulseDuration]);

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
    <div className="w-full max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-6">
      
      {/* Top Header Row */}
      <header className="flex items-center justify-between pb-4 border-b border-white/5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Haptic Control Studio
          </h1>
          <p className="text-xs text-textSecondary mt-0.5 font-medium">
            Real-time gamepad vibration synthesizer & telemetry
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTheme}
            className="p-2.5 rounded-xl glass-panel text-textSecondary hover:text-white glass-panel-hover flex items-center justify-center"
            title="Appearance Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Connection and Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* WebSocket Status */}
        <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border border-white/5 bg-black/10">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
              wsConnected ? 'bg-primary/20 animate-pulse' : 'bg-rose-500/20'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-primary shadow-[0_0_8px_var(--primary-color)]' : 'bg-rose-500'}`} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-textSecondary opacity-80">Server Connection</div>
              <div className="text-xs font-semibold mt-0.5">{wsConnected ? 'Connected to local node' : 'Attempting reconnection...'}</div>
            </div>
          </div>
          <div className="text-[10px] font-mono text-textSecondary bg-white/5 px-2 py-1 rounded">WS:8000</div>
        </div>

        {/* Gamepad Connection */}
        <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border border-white/5 bg-black/10">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
              connected ? 'bg-secondary/20 animate-pulse' : 'bg-slate-500/20'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-secondary shadow-[0_0_8px_var(--secondary-color)]' : 'bg-slate-400'}`} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-textSecondary opacity-80">Hardware Gamepad</div>
              <div className="text-xs font-semibold mt-0.5 text-ellipsis overflow-hidden max-w-[200px] whitespace-nowrap">
                {connected ? deviceName : 'No gamepad detected'}
              </div>
            </div>
          </div>
          {!connected && (
            <div className="text-[9px] uppercase font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded animate-pulse">
              Connect USB
            </div>
          )}
        </div>
      </div>

      {/* Main Core Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Interactive Sliders */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-8 relative overflow-hidden border border-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-textSecondary flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" /> Motor Frequencies
              </h2>
              <div className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-textSecondary">
                Precision Control
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    localLow > 0 
                      ? 'bg-primary/20 border-primary/40 text-white shadow-[0_0_12px_rgba(59,130,246,0.15)]' 
                      : 'border-white/10 text-textSecondary hover:bg-white/5'
                  }`}
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    localHigh > 0 
                      ? 'bg-secondary/20 border-secondary/40 text-white shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                      : 'border-white/10 text-textSecondary hover:bg-white/5'
                  }`}
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
                  disabled={!connected}
                  className="flex-1 accent-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Presets Bar */}
            <div className="pt-4 border-t border-white/5 space-y-3">
              <span className="text-[10px] font-bold text-textSecondary uppercase tracking-widest block">Continuous Presets</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                  onClick={() => triggerPreset(0.3, 0.0)}
                  disabled={!connected}
                  className="py-2 px-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-white/10"
                >
                  <div className="font-semibold">Gentle Rumble</div>
                  <div className="text-[9px] text-textSecondary mt-0.5">LF 30% | HF 0%</div>
                </button>
                <button
                  onClick={() => triggerPreset(0.0, 0.4)}
                  disabled={!connected}
                  className="py-2 px-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-white/10"
                >
                  <div className="font-semibold">Sharp Buzz</div>
                  <div className="text-[9px] text-textSecondary mt-0.5">LF 0% | HF 40%</div>
                </button>
                <button
                  onClick={() => triggerPreset(0.6, 0.6)}
                  disabled={!connected}
                  className="py-2 px-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-white/10"
                >
                  <div className="font-semibold">Dual Wave</div>
                  <div className="text-[9px] text-textSecondary mt-0.5">LF 60% | HF 60%</div>
                </button>
                <button
                  onClick={() => triggerPreset(1.0, 1.0)}
                  disabled={!connected}
                  className="py-2 px-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-primary/30"
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
                <h2 className="text-sm font-bold uppercase tracking-widest text-textSecondary">Repeat Mode (Pulse Logic)</h2>
              </div>
              <button
                onClick={handlePulseToggle}
                disabled={!connected}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed ${
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
                  className="py-2 px-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-white/10"
                >
                  <div className="font-semibold">Heartbeat Echo</div>
                  <div className="text-[9px] text-textSecondary mt-0.5">Every 1.0s for 150ms</div>
                </button>
                <button
                  onClick={() => triggerPulsePreset(0.2, 0.8, 2.5, 300)}
                  disabled={!connected}
                  className="py-2 px-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-white/10"
                >
                  <div className="font-semibold">Sonar Ping</div>
                  <div className="text-[9px] text-textSecondary mt-0.5">Every 2.5s for 300ms</div>
                </button>
                <button
                  onClick={() => triggerPulsePreset(0.8, 0.9, 0.5, 200)}
                  disabled={!connected}
                  className="py-2 px-3 rounded-xl border border-secondary/20 bg-secondary/5 hover:bg-secondary/10 disabled:opacity-30 text-[11px] font-medium text-left transition-all hover:border-secondary/30"
                >
                  <div className="font-semibold text-secondary">Warning Siren</div>
                  <div className="text-[9px] text-secondary/80 mt-0.5">Every 0.5s for 200ms</div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Telemetry Column */}
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6 border border-white/5 flex flex-col justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-textSecondary mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Telemetry Scope
            </h2>
            <VisualPulse lowFreq={localLow} highFreq={localHigh} lastPulse={lastPulse} />
          </div>

          {/* Safety Emergency Stop */}
          <div className="glass-panel rounded-3xl p-6 border border-rose-500/25 bg-rose-500/5 flex flex-col space-y-4">
            <div className="flex items-center gap-2 text-rose-500">
              <ShieldAlert className="w-5 h-5" />
              <h2 className="text-xs font-bold uppercase tracking-widest">Emergency Safety</h2>
            </div>
            
            <p className="text-xs text-rose-300/80">
              Stop all vibration loops immediately. Zeroes physical motor registers and resets server loops.
            </p>

            <button
              onClick={handleStopAll}
              disabled={!connected && localLow === 0 && localHigh === 0}
              className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm tracking-wide transition-all shadow-[0_4px_20px_rgba(220,38,38,0.25)] hover:shadow-[0_4px_25px_rgba(220,38,38,0.4)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
            >
              <Power className="w-4 h-4" /> Stop Haptics (Esc)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
