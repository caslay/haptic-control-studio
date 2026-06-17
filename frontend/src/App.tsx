import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { Dashboard } from './components/Dashboard';
import { ThemeDashboard } from './components/ThemeDashboard';

function App() {
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  // Initialize WebSocket hook targeting local FastAPI server
  const ws = useWebSocket('ws://127.0.0.1:8000/ws');

  // Bind 'Escape' key for safety stop
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        ws.sendStop();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [ws]);

  return (
    <div className="min-h-screen bg-dashboard font-dashboard text-textPrimary relative flex flex-col transition-all duration-300">
      
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--primary-color)_0%,_transparent_45%)] opacity-[0.03] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_var(--secondary-color)_0%,_transparent_35%)] opacity-[0.02] pointer-events-none" />

      {/* Main Control Panel Dashboard */}
      <main className="flex-grow flex items-center justify-center">
        <Dashboard
          wsConnected={ws.wsConnected}
          connected={ws.connected}
          deviceName={ws.deviceName}
          lowFreq={ws.lowFreq}
          highFreq={ws.highFreq}
          pulseEnabled={ws.pulseEnabled}
          pulseInterval={ws.pulseInterval}
          pulseDuration={ws.pulseDuration}
          lastPulse={ws.lastPulse}
          sequenceActive={ws.sequenceActive}
          playheadTime={ws.playheadTime}
          inDelay={ws.inDelay}
          remainingDelay={ws.remainingDelay}
          sendVibration={ws.sendVibration}
          sendPulseConfig={ws.sendPulseConfig}
          sendStop={ws.sendStop}
          startSequence={ws.startSequence}
          stopSequence={ws.stopSequence}
          onOpenTheme={() => setIsThemeOpen(true)}
        />
      </main>

      {/* Appearance Settings Drawer */}
      <ThemeDashboard
        isOpen={isThemeOpen}
        onClose={() => setIsThemeOpen(false)}
      />

      {/* Backdrop overlay for drawer on mobile devices */}
      {isThemeOpen && (
        <div 
          onClick={() => setIsThemeOpen(false)} 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
        />
      )}
    </div>
  );
}

export default App;
