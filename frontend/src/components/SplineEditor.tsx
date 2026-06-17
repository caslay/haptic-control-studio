import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Repeat } from 'lucide-react';

export interface Keyframe {
  id: string;
  time: number;  // 0 to duration
  power: number; // 0.0 to 1.0
}

interface SplineEditorProps {
  duration: number;
  sequenceActive: boolean;
  playheadTime: number;
  onDurationChange: (duration: number) => void;
  startSequence: (duration: number, loop: boolean, lowTrack: any[], highTrack: any[]) => void;
  stopSequence: () => void;
}

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 150;

export const SplineEditor: React.FC<SplineEditorProps> = ({
  duration,
  sequenceActive,
  playheadTime,
  onDurationChange,
  startSequence,
  stopSequence
}) => {
  // Loop state
  const [loopMode, setLoopMode] = useState(true);

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

  // Adjust end node times if duration changes
  useEffect(() => {
    setLowTrack(prev =>
      prev.map(k => (k.id === 'low-end' ? { ...k, time: duration } : k))
    );
    setHighTrack(prev =>
      prev.map(k => (k.id === 'high-end' ? { ...k, time: duration } : k))
    );
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
    // Prevent adding if we are clicking on an existing circle node
    if ((e.target as SVGElement).tagName === 'circle') return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;

    const svgX = (relativeX / rect.width) * VIEWBOX_WIDTH;
    const svgY = (relativeY / rect.height) * VIEWBOX_HEIGHT;

    const timeVal = getTimeFromX(svgX);
    const powerVal = Math.max(0.0, Math.min(1.0, getPowerFromY(svgY)));

    const isLow = trackType === 'low';
    const setTrack = isLow ? setLowTrack : setHighTrack;

    // Generate unique ID and insert node
    const id = `${trackType}-custom-${Date.now()}`;
    const newNode: Keyframe = { id, time: timeVal, power: powerVal };

    setTrack(prev => [...prev, newNode].sort((a, b) => a.time - b.time));
  };

  // Delete Keyframe on double click
  const handleNodeDoubleClick = (nodeId: string, trackType: 'low' | 'high') => {
    // Protect boundary nodes from deletion
    if (nodeId.endsWith('-start') || nodeId.endsWith('-end')) return;

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
  }, [draggingNode, lowTrack, highTrack, sequenceActive]);

  const triggerPlay = () => {
    // Prepare sorted tracks
    const sortedLow = [...lowTrack].sort((a, b) => a.time - b.time).map(k => ({ time: k.time, power: k.power }));
    const sortedHigh = [...highTrack].sort((a, b) => a.time - b.time).map(k => ({ time: k.time, power: k.power }));
    startSequence(duration, loopMode, sortedLow, sortedHigh);
  };

  // Preset Libraries (Sequencer Configurations)
  const loadPreset = (type: 'pulse' | 'engine' | 'wave') => {
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
    <div className="w-full space-y-6">
      
      {/* Sequence player header controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl glass-panel border border-white/5 bg-black/15">
        <div className="flex items-center gap-2">
          {sequenceActive ? (
            <button
              onClick={stopSequence}
              className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)]"
            >
              <Square className="w-3.5 h-3.5 fill-white" /> Stop Pattern
            </button>
          ) : (
            <button
              onClick={triggerPlay}
              className="py-2.5 px-5 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)]"
            >
              <Play className="w-3.5 h-3.5 fill-white" /> Play Pattern
            </button>
          )}

          <button
            onClick={() => setLoopMode(!loopMode)}
            className={`p-2.5 rounded-xl border transition-all ${
              loopMode
                ? 'bg-secondary/15 border-secondary/35 text-secondary shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                : 'border-white/10 text-textSecondary hover:bg-white/5'
            }`}
            title="Loop Playback"
          >
            <Repeat className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Timeline Duration Control */}
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex flex-col w-36">
            <div className="flex items-center justify-between text-xs font-semibold">
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
              className="accent-primary h-1.5 mt-1"
            />
          </div>
          
          {/* Preset Envelope Loaders */}
          <div className="h-8 w-px bg-white/5" />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => loadPreset('pulse')}
              className="px-2.5 py-1.5 rounded-lg border border-white/5 bg-white/2 hover:bg-white/5 text-[10px] font-semibold text-textSecondary hover:text-white transition-all"
            >
              Pulse Train
            </button>
            <button
              onClick={() => loadPreset('engine')}
              className="px-2.5 py-1.5 rounded-lg border border-white/5 bg-white/2 hover:bg-white/5 text-[10px] font-semibold text-textSecondary hover:text-white transition-all"
            >
              Accelerate
            </button>
            <button
              onClick={() => loadPreset('wave')}
              className="px-2.5 py-1.5 rounded-lg border border-white/5 bg-white/2 hover:bg-white/5 text-[10px] font-semibold text-textSecondary hover:text-white transition-all"
            >
              Cross-Wave
            </button>
          </div>
        </div>
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
                <circle
                  key={k.id}
                  cx={getX(k.time)}
                  cy={getY(k.power)}
                  r={6}
                  className={`cursor-ns-resize hover:scale-125 transition-transform ${
                    draggingNode?.nodeId === k.id ? 'fill-white' : 'fill-primary'
                  }`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingNode({ trackType: 'low', nodeId: k.id });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleNodeDoubleClick(k.id, 'low');
                  }}
                  style={{ stroke: 'rgba(255, 255, 255, 0.4)', strokeWidth: 1.5 }}
                />
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
                <circle
                  key={k.id}
                  cx={getX(k.time)}
                  cy={getY(k.power)}
                  r={6}
                  className={`cursor-ns-resize hover:scale-125 transition-transform ${
                    draggingNode?.nodeId === k.id ? 'fill-white' : 'fill-secondary'
                  }`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingNode({ trackType: 'high', nodeId: k.id });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleNodeDoubleClick(k.id, 'high');
                  }}
                  style={{ stroke: 'rgba(255, 255, 255, 0.4)', strokeWidth: 1.5 }}
                />
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
