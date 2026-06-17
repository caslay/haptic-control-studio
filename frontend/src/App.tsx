import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { Dashboard } from './components/Dashboard';
import { ThemeDashboard } from './components/ThemeDashboard';

// Helper to determine the initial/default WebSocket URL based on how the page is loaded
const getAutoWsUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // If running on a local development setup (localhost, 127.0.0.1, or local LAN IP e.g. 192.168.x.x)
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^192\.168\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return `ws://${hostname}:8000/ws`;
    }
    
    // If accessed via a secure production build (like Vercel HTTPS)
    // Default to secure WebSocket on the loading domain, or prompt for manual override
    return `${protocol}//${hostname}/ws`;
  }
  return 'ws://127.0.0.1:8000/ws';
};

function App() {
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  // Custom WebSocket URL config state
  const [wsUrl, setWsUrl] = useState(() => {
    const stored = localStorage.getItem('haptic_custom_ws_url');
    return stored || getAutoWsUrl();
  });

  // Keep track of whether it is an autodetected URL or manual override
  const [isAutoUrl, setIsAutoUrl] = useState(() => {
    return !localStorage.getItem('haptic_custom_ws_url');
  });

  // Initialize WebSocket hook targeting resolved/custom URL
  const ws = useWebSocket(wsUrl);

  const saveCustomWsUrl = useCallback((newUrl: string) => {
    if (!newUrl.trim()) {
      // Revert to autodetected
      localStorage.removeItem('haptic_custom_ws_url');
      setWsUrl(getAutoWsUrl());
      setIsAutoUrl(true);
    } else {
      localStorage.setItem('haptic_custom_ws_url', newUrl);
      setWsUrl(newUrl);
      setIsAutoUrl(false);
    }
  }, []);

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
          activeWsUrl={wsUrl}
          isAutoWsUrl={isAutoUrl}
          onSaveWsUrl={saveCustomWsUrl}
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
