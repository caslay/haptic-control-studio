import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Repeat, Trash2, Save } from 'lucide-react';

export interface Keyframe {
  id: string;
  time: number;  // 0 to duration
  power: number; // 0.0 to 1.0
}

interface SplineEditorProps {
  duration: number;
  sequenceActive: boolean;
  playheadTime: number;
  inDelay?: boolean;
  remainingDelay?: number;
  onDurationChange: (duration: number) => void;
  startSequence: (duration: number, loop: boolean, lowTrack: any[], highTrack: any[], loopDelay?: number) => void;
  stopSequence: () => void;
  activeWsUrl?: string;
}

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 250;

export interface SavedPreset {
  id: string;
  name: string;
  duration: number;
  lowTrack: Keyframe[];
  highTrack: Keyframe[];
}

export const SplineEditor: React.FC<SplineEditorProps> = ({
  duration,
  sequenceActive,
  playheadTime,
  inDelay = false,
  remainingDelay = 0.0,
  onDurationChange,
  startSequence,
  stopSequence,
  activeWsUrl
}) => {
  // Loop state
  const [loopMode, setLoopMode] = useState(true);
  const [loopDelay, setLoopDelay] = useState(0.0);

  // Custom Presets State
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');

  // Dynamically resolve API base from WebSocket URL, with loopback fallback
  const getApiBase = (wsUrl?: string) => {
    if (wsUrl) {
      try {
        const url = new URL(wsUrl);
        const protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
        return `${protocol}//${url.host}`;
      } catch (e) {
        console.error('Failed to parse WebSocket URL for API base, using fallback', e);
      }
    }
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://${hostname}:8000`;
      }
    }
    return 'http://127.0.0.1:8000';
  };

  const API_BASE = getApiBase(activeWsUrl);

  // Tracks State: Default tracks have nodes at start (t=0) and end (t=duration)
  const [lowTrack, setLowTrack] = useState<Keyframe[]>([
    { id: 'low-start', time: 0, power: 0.2 },
    { id: 'low-mid1', time: 1.5, power: 0.8 },
    { id: 'low-mid2', time: 3.2, power: 0.1 },
    { id: 'low-end', time: duration, power: 0.3 }
  ]);

  const [highTrack, setHighTrack] = useState<Keyframe[]>([
    { id: 'high-start', time: 0, power: 0.0 },
    { id: 'high-mid1', time: 2.0, power: 0.6 },
    { id: 'high-mid2', time: 3.8, power: 0.9 },
    { id: 'high-end', time: duration, power: 0.0 }
  ]);

  // Load custom presets on mount from database
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/presets`);
        if (res.ok) {
          const data = await res.json();
          setSavedPresets(data);
        }
      } catch (e) {
        console.error('Failed to load presets from database. Falling back to localStorage.', e);
        try {
          const stored = localStorage.getItem('haptic_studio_presets');
          if (stored) {
            setSavedPresets(JSON.parse(stored));
          }
        } catch (err) {
          console.error('LocalStorage fallback failed', err);
        }
      }
    };
    fetchPresets();
  }, [API_BASE]);

  // Adjust end node times if duration changes
  useEffect(() => {
    setLowTrack(prev =>
      prev.map(k => (k.id === 'low-end' ? { ...k, time: duration } : k))
    );
    setHighTrack(prev =>
      prev.map(k => (k.id === 'high-end' ? { ...k, time: duration } : k))
    );
    setSelectedPresetId(''); // Reset preset selection on duration change
  }, [duration]);

  // Dragging states
  const [draggingNode, setDraggingNode] = useState<{
    trackType: 'low' | 'high';
    nodeId: string;
  } | null>(null);

  const lowSvgRef = useRef<SVGSVGElement | null>(null);
  const highSvgRef = useRef<SVGSVGElement | null>(null);

  // Coordinate Conversion Helpers
  const getX = (time: number) => (time / duration) * VIEWBOX_WIDTH;
  const getY = (power: number) => (1.0 - power) * VIEWBOX_HEIGHT;

  const getTimeFromX = (x: number) => (x / VIEWBOX_WIDTH) * duration;
  const getPowerFromY = (y: number) => 1.0 - (y / VIEWBOX_HEIGHT);

  // Handle Drag Move
  const handleDrag = (clientX: number, clientY: number, svgRef: React.RefObject<SVGSVGElement | null>, trackType: 'low' | 'high') => {
    if (!draggingNode || draggingNode.trackType !== trackType || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;

    // Convert screen coordinates to SVG viewBox scale
    const svgX = (relativeX / rect.width) * VIEWBOX_WIDTH;
    const svgY = (relativeY / rect.height) * VIEWBOX_HEIGHT;

    const timeVal = Math.max(0, Math.min(duration, getTimeFromX(svgX)));
    const powerVal = Math.max(0.0, Math.min(1.0, getPowerFromY(svgY)));

    const isLow = trackType === 'low';
    const setTrack = isLow ? setLowTrack : setHighTrack;

    setSelectedPresetId(''); // Reset preset selection on modification

    setTrack(prev => {
      const sorted = [...prev].sort((a, b) => a.time - b.time);
      const index = sorted.findIndex(k => k.id === draggingNode.nodeId);
      if (index === -1) return prev;

      const node = sorted[index];

      // Boundary nodes (start and end) can only be moved vertically (power coordinate)
      if (node.id === `${trackType}-start`) {
        return prev.map(k => (k.id === node.id ? { ...k, power: powerVal } : k));
      }
      if (node.id === `${trackType}-end`) {
        return prev.map(k => (k.id === node.id ? { ...k, power: powerVal } : k));
      }

      // Drag clamping between adjacent nodes to prevent crossover (UX best practice)
      const prevNode = sorted[index - 1];
      const nextNode = sorted[index + 1];
      const minTime = prevNode ? prevNode.time + 0.05 : 0.05;
      const maxTime = nextNode ? nextNode.time - 0.05 : duration - 0.05;

      const clampedTime = Math.max(minTime, Math.min(maxTime, timeVal));

      return prev.map(k =>
        k.id === node.id ? { ...k, time: clampedTime, power: powerVal } : k
      );
    });
  };

  // Add Keyframe on click
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>, trackType: 'low' | 'high') => {
    // Prevent adding if we are clicking on an existing circle node or its container/children
    const target = e.target as SVGElement;
    if (target.tagName === 'circle' || target.closest('.keyframe-node-group')) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;

    const svgX = (relativeX / rect.width) * VIEWBOX_WIDTH;
    const svgY = (relativeY / rect.height) * VIEWBOX_HEIGHT;

    const timeVal = getTimeFromX(svgX);
    const powerVal = Math.max(0.0, Math.min(1.0, getPowerFromY(svgY)));

    const isLow = trackType === 'low';
    const track = isLow ? lowTrack : highTrack;
    const setTrack = isLow ? setLowTrack : setHighTrack;

    // Proximity check: Avoid spawning keyframes too close to existing ones in SVG coordinates
    const PROXIMITY_THRESHOLD = 25; // in SVG units
    const isTooClose = track.some(k => {
      const nodeX = getX(k.time);
      const nodeY = getY(k.power);
      const dx = nodeX - svgX;
      const dy = nodeY - svgY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist < PROXIMITY_THRESHOLD;
    });

    if (isTooClose) return;

    setSelectedPresetId(''); // Reset preset selection on modification

    // Generate unique ID and insert node
    const id = `${trackType}-custom-${Date.now()}`;
    const newNode: Keyframe = { id, time: timeVal, power: powerVal };

    setTrack(prev => [...prev, newNode].sort((a, b) => a.time - b.time));
  };

  // Delete Keyframe on double click
  const handleNodeDoubleClick = (nodeId: string, trackType: 'low' | 'high') => {
    // Protect boundary nodes from deletion
    if (nodeId.endsWith('-start') || nodeId.endsWith('-end')) return;

    setSelectedPresetId(''); // Reset preset selection on modification

    const setTrack = trackType === 'low' ? setLowTrack : setHighTrack;
    setTrack(prev => prev.filter(k => k.id !== nodeId));
  };

  // Global mouse listeners to support dragging outside of the SVG viewport safely
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggingNode) {
        if (draggingNode.trackType === 'low') {
          handleDrag(e.clientX, e.clientY, lowSvgRef, 'low');
        } else {
          handleDrag(e.clientX, e.clientY, highSvgRef, 'high');
        }
      }
    };

    const handleGlobalMouseUp = () => {
      if (draggingNode) {
        setDraggingNode(null);
        // If playing, update the loop parameters in real time on release!
        if (sequenceActive) {
          triggerPlay();
        }
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingNode, lowTrack, highTrack, sequenceActive, duration, loopMode, loopDelay]);

  const triggerPlay = () => {
    // Prepare sorted tracks
    const sortedLow = [...lowTrack].sort((a, b) => a.time - b.time).map(k => ({ time: k.time, power: k.power }));
    const sortedHigh = [...highTrack].sort((a, b) => a.time - b.time).map(k => ({ time: k.time, power: k.power }));
    startSequence(duration, loopMode, sortedLow, sortedHigh, loopDelay);
  };

  // Preset Libraries (Sequencer Configurations)
  const loadPreset = (type: 'pulse' | 'engine' | 'wave') => {
    setSelectedPresetId(`builtin-${type}`);
    if (type === 'pulse') {
      setLowTrack([
        { id: 'low-start', time: 0, power: 1.0 },
        { id: 'low-p1', time: 0.8, power: 1.0 },
        { id: 'low-p2', time: 0.9, power: 0.0 },
        { id: 'low-p3', time: 1.8, power: 0.0 },
        { id: 'low-p4', time: 1.9, power: 1.0 },
        { id: 'low-end', time: duration, power: 1.0 }
      ]);
      setHighTrack([
        { id: 'high-start', time: 0, power: 0.0 },
        { id: 'high-p1', time: 0.9, power: 0.0 },
        { id: 'high-p2', time: 1.0, power: 0.8 },
        { id: 'high-p3', time: 1.7, power: 0.8 },
        { id: 'high-p4', time: 1.8, power: 0.0 },
        { id: 'high-end', time: duration, power: 0.0 }
      ]);
    } else if (type === 'engine') {
      setLowTrack([
        { id: 'low-start', time: 0, power: 0.1 },
        { id: 'low-e1', time: 2.0, power: 0.4 },
        { id: 'low-e2', time: 3.5, power: 0.9 },
        { id: 'low-end', time: duration, power: 0.2 }
      ]);
      setHighTrack([
        { id: 'high-start', time: 0, power: 0.0 },
        { id: 'high-e1', time: 1.5, power: 0.2 },
        { id: 'high-e2', time: 3.0, power: 0.8 },
        { id: 'high-end', time: duration, power: 0.0 }
      ]);
    } else if (type === 'wave') {
      setLowTrack([
        { id: 'low-start', time: 0, power: 0.0 },
        { id: 'low-w1', time: 1.25, power: 0.8 },
        { id: 'low-w2', time: 2.5, power: 0.0 },
        { id: 'low-w3', time: 3.75, power: 0.8 },
        { id: 'low-end', time: duration, power: 0.0 }
      ]);
      setHighTrack([
        { id: 'high-start', time: 0, power: 0.8 },
        { id: 'high-w1', time: 1.25, power: 0.0 },
        { id: 'high-w2', time: 2.5, power: 0.8 },
        { id: 'high-w3', time: 3.75, power: 0.0 },
        { id: 'high-end', time: duration, power: 0.8 }
      ]);
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId) return;

    if (presetId.startsWith('builtin-')) {
      const type = presetId.replace('builtin-', '') as 'pulse' | 'engine' | 'wave';
      loadPreset(type);
    } else {
      const found = savedPresets.find(p => p.id === presetId);
      if (found) {
        setLowTrack(found.lowTrack);
        setHighTrack(found.highTrack);
        onDurationChange(found.duration);
      }
    }
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPresetName.trim();
    if (!name) return;

    const newPreset: SavedPreset = {
      id: `custom-${Date.now()}`,
      name,
      duration,
      lowTrack,
      highTrack
    };

    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    localStorage.setItem('haptic_studio_presets', JSON.stringify(updated));
    setSelectedPresetId(newPreset.id);
    setNewPresetName('');

    try {
      await fetch(`${API_BASE}/api/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newPreset.id,
          name: newPreset.name,
          duration: newPreset.duration,
          low_track: newPreset.lowTrack,
          high_track: newPreset.highTrack
        })
      });
    } catch (err) {
      console.error('Failed to save preset to database:', err);
    }
  };

  const handleDeletePreset = async (idToDelete: string) => {
    if (!idToDelete || idToDelete.startsWith('builtin-')) return;
    const updated = savedPresets.filter(p => p.id !== idToDelete);
    setSavedPresets(updated);
    localStorage.setItem('haptic_studio_presets', JSON.stringify(updated));
    setSelectedPresetId('');

    try {
      await fetch(`${API_BASE}/api/presets/${idToDelete}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to delete preset from database:', err);
    }
  };

  // Rendering Helper: Generates SVG path command for linear ramps
  const getPathData = (track: Keyframe[]) => {
    const sorted = [...track].sort((a, b) => a.time - b.time);
    return sorted.map((k, i) => `${i === 0 ? 'M' : 'L'} ${getX(k.time)} ${getY(k.power)}`).join(' ');
  };

  // Generates closed SVG path command for color gradients underneath the line
  const getClosedPathData = (track: Keyframe[]) => {
    const sorted = [...track].sort((a, b) => a.time - b.time);
    if (sorted.length === 0) return '';
    const openPath = getPathData(sorted);
    return `${openPath} L ${getX(duration)} ${VIEWBOX_HEIGHT} L 0 ${VIEWBOX_HEIGHT} Z`;
  };

  const playheadX = getX(playheadTime);

  return (
    <div className="w-full space-y-4">
      
      {/* Sequence player header controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl glass-panel border border-white/5 bg-black/15">
        <div className="flex items-center gap-2">
          {sequenceActive ? (
            <button
              onClick={stopSequence}
              className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-white" /> Stop Pattern
            </button>
          ) : (
            <button
              onClick={triggerPlay}
              className="py-2.5 px-5 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)] cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" /> Play Pattern
            </button>
          )}

          <button
            onClick={() => setLoopMode(!loopMode)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              loopMode
                ? 'bg-secondary/15 border-secondary/35 text-secondary shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                : 'border-white/10 text-textSecondary hover:bg-white/5'
            }`}
            title="Loop Playback"
          >
            <Repeat className="w-4.5 h-4.5" />
          </button>

          {inDelay && (
            <span className="text-[10px] font-mono font-bold text-secondary bg-secondary/10 border border-secondary/20 px-2 py-1 rounded-lg animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" /> Delaying {remainingDelay.toFixed(1)}s
            </span>
          )}
        </div>

        {/* Timeline Sliders */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 w-full sm:w-auto">
          {/* Timeline Duration Control */}
          <div className="flex flex-col w-32 flex-grow sm:flex-none">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-textSecondary">Duration</span>
              <span className="font-mono text-primary font-bold">{duration.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="10.0"
              step="0.5"
              value={duration}
              onChange={(e) => onDurationChange(parseFloat(e.target.value))}
              disabled={sequenceActive}
              className="accent-primary h-1 mt-1 cursor-ew-resize disabled:opacity-40"
            />
          </div>

          {/* Loop Delay Control */}
          <div className="flex flex-col w-32 flex-grow sm:flex-none">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-textSecondary">Loop Delay</span>
              <span className="font-mono text-secondary font-bold">{loopDelay.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="5.0"
              step="0.1"
              value={loopDelay}
              onChange={(e) => setLoopDelay(parseFloat(e.target.value))}
              disabled={!loopMode || sequenceActive}
              className="accent-secondary h-1 mt-1 cursor-ew-resize disabled:opacity-35"
            />
          </div>
        </div>
      </div>

      {/* Preset Saving & Loading Library Bar */}
      <div className="flex flex-col gap-4 p-4 rounded-2xl glass-panel border border-white/5 bg-black/10 text-xs">
        {/* Row 1: Load Preset Dropdown */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-textSecondary font-semibold text-[10px] uppercase tracking-wider">Load Preset Library</label>
          <div className="flex items-center gap-2 w-full">
            <select
              value={selectedPresetId}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="flex-grow py-2 px-3 rounded-xl border border-white/10 bg-slate-950/60 text-white text-xs font-semibold focus:outline-none focus:border-secondary cursor-pointer"
            >
              <option value="">-- Load a Preset --</option>
              <optgroup label="Built-in Presets" className="bg-slate-950 text-white font-medium">
                <option value="builtin-pulse">Pulse Train</option>
                <option value="builtin-engine">Accelerate</option>
                <option value="builtin-wave">Cross-Wave</option>
              </optgroup>
              {savedPresets.length > 0 && (
                <optgroup label="My Custom Presets" className="bg-slate-950 text-white font-medium">
                  {savedPresets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            
            {selectedPresetId && !selectedPresetId.startsWith('builtin-') && (
              <button
                type="button"
                onClick={() => handleDeletePreset(selectedPresetId)}
                className="py-2 px-3 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold transition-all cursor-pointer flex items-center gap-1"
                title="Delete Selected Preset"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Save Current As Custom Preset */}
        <form onSubmit={handleSavePreset} className="flex flex-col gap-1.5 w-full">
          <label className="text-textSecondary font-semibold text-[10px] uppercase tracking-wider">Save Current Envelope</label>
          <div className="flex items-center gap-2 w-full">
            <input
              type="text"
              placeholder="Preset Name..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="flex-grow py-2 px-3 rounded-xl border border-white/10 bg-slate-950/60 text-white text-xs placeholder-white/20 focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!newPresetName.trim()}
              className="py-2 px-4 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </form>
      </div>

      {/* Editor grids */}
      <div className="space-y-4">
        
        {/* Track 1: Low-Frequency Envelope */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-primary flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Low-Frequency Track (Left Rumble)
            </span>
            <span className="text-[10px] text-textSecondary font-mono uppercase tracking-wider">Click to add node • Double-click to remove</span>
          </div>

          <div className="w-full relative rounded-2xl overflow-hidden glass-panel border border-white/5 bg-black/20">
            {inDelay && (
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-10 animate-pulse">
                <span className="text-secondary font-mono font-bold text-xs tracking-wider bg-black/75 px-3 py-1.5 rounded-xl border border-secondary/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" /> Delaying: {remainingDelay.toFixed(1)}s
                </span>
              </div>
            )}
            <svg
              ref={lowSvgRef}
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              className="w-full h-full block cursor-crosshair select-none"
              onMouseDown={(e) => handleCanvasClick(e, 'low')}
            >
              <defs>
                <linearGradient id="low-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--primary-color)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0.25, 0.5, 0.75].map((p) => (
                <line
                  key={p}
                  x1="0"
                  y1={getY(p)}
                  x2={VIEWBOX_WIDTH}
                  y2={getY(p)}
                  stroke="rgba(255, 255, 255, 0.03)"
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: Math.ceil(duration) }).map((_, idx) => (
                <line
                  key={idx}
                  x1={getX(idx)}
                  y1="0"
                  x2={getX(idx)}
                  y2={VIEWBOX_HEIGHT}
                  stroke="rgba(255, 255, 255, 0.03)"
                  strokeWidth={1}
                />
              ))}

              {/* Area path */}
              {lowTrack.length > 1 && (
                <path d={getClosedPathData(lowTrack)} fill="url(#low-gradient)" />
              )}

              {/* Envelope curve path */}
              {lowTrack.length > 1 && (
                <path
                  d={getPathData(lowTrack)}
                  fill="none"
                  stroke="var(--primary-color)"
                  strokeWidth={2.5}
                />
              )}

              {/* Interactive Keyframe Circles */}
              {lowTrack.map((k) => (
                <g key={k.id} className="keyframe-node-group group/node">
                  {/* Invisible larger click/drag target hitbox */}
                  <circle
                    cx={getX(k.time)}
                    cy={getY(k.power)}
                    r={20}
                    fill="transparent"
                    className="cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDraggingNode({ trackType: 'low', nodeId: k.id });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleNodeDoubleClick(k.id, 'low');
                    }}
                  />
                  {/* Visible circle node */}
                  <circle
                    cx={getX(k.time)}
                    cy={getY(k.power)}
                    r={8}
                    className={`pointer-events-none transition-all duration-150 ${
                      draggingNode?.nodeId === k.id
                        ? 'fill-white scale-125'
                        : 'fill-primary group-hover/node:fill-white group-hover/node:scale-125'
                    }`}
                    style={{
                      stroke: 'rgba(255, 255, 255, 0.4)',
                      strokeWidth: 1.5,
                      transformOrigin: 'center',
                      transformBox: 'fill-box'
                    }}
                  />
                </g>
              ))}

              {/* Playhead Overlay */}
              {sequenceActive && (
                <line
                  x1={playheadX}
                  y1="0"
                  x2={playheadX}
                  y2={VIEWBOX_HEIGHT}
                  stroke="var(--primary-color)"
                  strokeWidth={2}
                  className="shadow-[0_0_10px_var(--primary-color)]"
                />
              )}
            </svg>
          </div>
        </div>

        {/* Track 2: High-Frequency Envelope */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-secondary flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary" /> High-Frequency Track (Right Buzz)
            </span>
          </div>

          <div className="w-full relative rounded-2xl overflow-hidden glass-panel border border-white/5 bg-black/20">
            {inDelay && (
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-10 animate-pulse">
                <span className="text-secondary font-mono font-bold text-xs tracking-wider bg-black/75 px-3 py-1.5 rounded-xl border border-secondary/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" /> Delaying: {remainingDelay.toFixed(1)}s
                </span>
              </div>
            )}
            <svg
              ref={highSvgRef}
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              className="w-full h-full block cursor-crosshair select-none"
              onMouseDown={(e) => handleCanvasClick(e, 'high')}
            >
              <defs>
                <linearGradient id="high-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--secondary-color)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--secondary-color)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0.25, 0.5, 0.75].map((p) => (
                <line
                  key={p}
                  x1="0"
                  y1={getY(p)}
                  x2={VIEWBOX_WIDTH}
                  y2={getY(p)}
                  stroke="rgba(255, 255, 255, 0.03)"
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: Math.ceil(duration) }).map((_, idx) => (
                <line
                  key={idx}
                  x1={getX(idx)}
                  y1="0"
                  x2={getX(idx)}
                  y2={VIEWBOX_HEIGHT}
                  stroke="rgba(255, 255, 255, 0.03)"
                  strokeWidth={1}
                />
              ))}

              {/* Area path */}
              {highTrack.length > 1 && (
                <path d={getClosedPathData(highTrack)} fill="url(#high-gradient)" />
              )}

              {/* Envelope curve path */}
              {highTrack.length > 1 && (
                <path
                  d={getPathData(highTrack)}
                  fill="none"
                  stroke="var(--secondary-color)"
                  strokeWidth={2.5}
                />
              )}

              {/* Interactive Keyframe Circles */}
              {highTrack.map((k) => (
                <g key={k.id} className="keyframe-node-group group/node">
                  {/* Invisible larger click/drag target hitbox */}
                  <circle
                    cx={getX(k.time)}
                    cy={getY(k.power)}
                    r={20}
                    fill="transparent"
                    className="cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDraggingNode({ trackType: 'high', nodeId: k.id });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleNodeDoubleClick(k.id, 'high');
                    }}
                  />
                  {/* Visible circle node */}
                  <circle
                    cx={getX(k.time)}
                    cy={getY(k.power)}
                    r={8}
                    className={`pointer-events-none transition-all duration-150 ${
                      draggingNode?.nodeId === k.id
                        ? 'fill-white scale-125'
                        : 'fill-secondary group-hover/node:fill-white group-hover/node:scale-125'
                    }`}
                    style={{
                      stroke: 'rgba(255, 255, 255, 0.4)',
                      strokeWidth: 1.5,
                      transformOrigin: 'center',
                      transformBox: 'fill-box'
                    }}
                  />
                </g>
              ))}

              {/* Playhead Overlay */}
              {sequenceActive && (
                <line
                  x1={playheadX}
                  y1="0"
                  x2={playheadX}
                  y2={VIEWBOX_HEIGHT}
                  stroke="var(--secondary-color)"
                  strokeWidth={2}
                  className="shadow-[0_0_10px_var(--secondary-color)]"
                />
              )}
            </svg>
          </div>
        </div>

      </div>
      
    </div>
  );
};
