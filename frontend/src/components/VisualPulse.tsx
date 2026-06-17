import React, { useEffect, useRef, useState } from 'react';

interface VisualPulseProps {
  lowFreq: number;    // 0.0 to 1.0
  highFreq: number;   // 0.0 to 1.0
  lastPulse: { timestamp: number; duration: number; lowFreq: number; highFreq: number } | null;
}

export const VisualPulse: React.FC<VisualPulseProps> = ({ lowFreq, highFreq, lastPulse }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Track active pulse state for the visual ring
  const [pulseActive, setPulseActive] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(0);

  // Trigger pulse rings when lastPulse changes
  useEffect(() => {
    if (!lastPulse) return;

    setPulseActive(true);
    setPulseIntensity((lastPulse.lowFreq + lastPulse.highFreq) / 2 || 0.5);

    const timeout = setTimeout(() => {
      setPulseActive(false);
    }, lastPulse.duration);

    return () => clearTimeout(timeout);
  }, [lastPulse]);

  // Waveform rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const resizeCanvas = () => {
      if (canvas && containerRef.current) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = 140;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      if (!ctx || !canvas) return;

      // Clear with slight trailing alpha for smooth motion blur
      ctx.fillStyle = 'rgba(11, 15, 25, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Check active vibration levels (either direct or during a pulse)
      const currentLow = pulseActive && lastPulse ? lastPulse.lowFreq : lowFreq;
      const currentHigh = pulseActive && lastPulse ? lastPulse.highFreq : highFreq;

      const isVibrating = currentLow > 0 || currentHigh > 0;

      // Draw grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Plot composite waveform
      ctx.beginPath();
      ctx.lineWidth = 2.5;

      // Read computed values of the theme CSS variables for canvas drawing
      const computedStyle = getComputedStyle(document.documentElement);
      const primaryColor = computedStyle.getPropertyValue('--primary-color').trim() || '#3b82f6';
      const secondaryColor = computedStyle.getPropertyValue('--secondary-color').trim() || '#10b981';

      // Create a gradient for the wave line based on active theme variables
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, primaryColor);
      gradient.addColorStop(0.5, secondaryColor);
      gradient.addColorStop(1, primaryColor);
      ctx.strokeStyle = isVibrating ? gradient : 'rgba(255, 255, 255, 0.1)';

      // If vibrating, add a glow effect
      if (isVibrating) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = primaryColor;
      } else {
        ctx.shadowBlur = 0;
      }

      for (let x = 0; x < width; x++) {
        // Flat line default, modulated by vibration intensities
        let y = centerY;

        if (isVibrating) {
          // Low frequency: Heavy, long waves
          const lowWave = Math.sin(x * 0.015 - phase * 0.5) * (currentLow * 25);
          
          // High frequency: Sharp, fast buzzing oscillations
          const highWave = Math.sin(x * 0.08 - phase * 1.8) * (currentHigh * 12);
          
          // Noise factor to represent controller jitter
          const jitter = (Math.random() - 0.5) * (currentLow * 4 + currentHigh * 2);

          y = centerY + lowWave + highWave + jitter;
        } else {
          // Subtle resting state wave
          y = centerY + Math.sin(x * 0.01 - phase * 0.05) * 1.5;
        }

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.shadowBlur = 0; // Reset shadow

      // Draw secondary motor signals independently as dotted guides
      if (currentLow > 0) {
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)'; // Faint primary/blue for low
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x++) {
          const y = centerY + Math.sin(x * 0.01 - phase * 0.3) * (currentLow * 15);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]); // Reset
      }

      if (currentHigh > 0) {
        ctx.beginPath();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)'; // Faint secondary/emerald for high
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x++) {
          const y = centerY + Math.sin(x * 0.07 - phase * 1.2) * (currentHigh * 8);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]); // Reset
      }

      phase += 0.1;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [lowFreq, highFreq, pulseActive, lastPulse]);

  return (
    <div ref={containerRef} className="w-full flex flex-col items-center select-none">
      {/* Waveform Telemetry Screen */}
      <div className="w-full relative h-[140px] rounded-2xl overflow-hidden glass-panel border border-white/5 mb-6 flex items-center justify-center">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
        
        {/* Floating intensity badge */}
        <div className="absolute top-3 right-4 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-mono glass-panel border border-white/10 bg-black/40 flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${lowFreq > 0 || highFreq > 0 ? 'bg-primary animate-pulse' : 'bg-slate-500'}`} />
          LF: {Math.round(lowFreq * 100)}% | HF: {Math.round(highFreq * 100)}%
        </div>

        {/* Dynamic overlay label */}
        <div className="absolute bottom-2 left-4 text-[10px] uppercase font-mono tracking-widest text-textSecondary opacity-60">
          Composite Oscilloscope Output
        </div>
      </div>

      {/* Pulse Rings Panel */}
      <div className="w-full h-32 glass-panel rounded-2xl relative flex items-center justify-center overflow-hidden border border-white/5 bg-black/10">
        {/* Pulse center core */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 z-10 ${
          pulseActive 
            ? 'bg-primary text-white scale-125 shadow-[0_0_20px_var(--primary-color)]' 
            : (lowFreq > 0 || highFreq > 0)
              ? 'bg-secondary/80 text-white scale-105 shadow-[0_0_10px_var(--secondary-color)]'
              : 'bg-white/5 text-textSecondary scale-100'
        }`}>
          <div className={`w-3 h-3 rounded-full ${pulseActive || lowFreq > 0 || highFreq > 0 ? 'bg-white' : 'bg-white/20'}`} />
        </div>

        {/* Pulsing Concentric Rings */}
        {pulseActive && (
          <>
            <div className="absolute w-24 h-24 rounded-full border border-primary/50 animate-ring-pulse" style={{ animationDelay: '0s', borderWidth: `${Math.max(1, pulseIntensity * 4)}px`, opacity: pulseIntensity }} />
            <div className="absolute w-24 h-24 rounded-full border border-secondary/40 animate-ring-pulse" style={{ animationDelay: '0.25s', borderWidth: `${Math.max(1, pulseIntensity * 3)}px`, opacity: pulseIntensity * 0.8 }} />
            <div className="absolute w-24 h-24 rounded-full border border-primary/20 animate-ring-pulse" style={{ animationDelay: '0.5s', borderWidth: `${Math.max(1, pulseIntensity * 2)}px`, opacity: pulseIntensity * 0.6 }} />
          </>
        )}

        {/* Steady low ripples for continuous vibration */}
        {!pulseActive && (lowFreq > 0 || highFreq > 0) && (
          <div className="absolute w-20 h-20 rounded-full border border-secondary/20 animate-ping opacity-60" style={{ animationDuration: '2s' }} />
        )}

        <div className="absolute bottom-3 text-[10px] uppercase font-mono tracking-widest text-textSecondary opacity-60">
          Tactile Pulse Rings
        </div>
      </div>
    </div>
  );
};
