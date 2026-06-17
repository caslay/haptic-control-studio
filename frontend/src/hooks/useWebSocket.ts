import { useEffect, useRef, useState, useCallback } from 'react';

export interface HapticState {
  connected: boolean;
  deviceName: string;
  lowFreq: number;
  highFreq: number;
  pulseEnabled: boolean;
  pulseInterval: number;
  pulseDuration: number;
}

export function useWebSocket(url: string) {
  const [wsConnected, setWsConnected] = useState(false);
  const [state, setState] = useState<HapticState>({
    connected: false,
    deviceName: 'None',
    lowFreq: 0.0,
    highFreq: 0.0,
    pulseEnabled: false,
    pulseInterval: 2.0,
    pulseDuration: 300,
  });

  const [lastPulse, setLastPulse] = useState<{ timestamp: number; duration: number; lowFreq: number; highFreq: number } | null>(null);

  // Playback Sequencer States
  const [sequenceActive, setSequenceActive] = useState(false);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [inDelay, setInDelay] = useState(false);
  const [remainingDelay, setRemainingDelay] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected to backend');
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'state') {
          setState({
            connected: msg.connected,
            deviceName: msg.device_name,
            lowFreq: msg.low_freq,
            highFreq: msg.high_freq,
            pulseEnabled: msg.pulse_enabled,
            pulseInterval: msg.pulse_interval,
            pulseDuration: msg.pulse_duration,
          });
        } else if (msg.type === 'status') {
          setState(prev => ({
            ...prev,
            connected: msg.connected,
            deviceName: msg.device_name,
          }));
        } else if (msg.type === 'state_sync') {
          setState(prev => ({
            ...prev,
            lowFreq: msg.low_freq !== undefined ? msg.low_freq : prev.lowFreq,
            highFreq: msg.high_freq !== undefined ? msg.high_freq : prev.highFreq,
            pulseEnabled: msg.pulse_enabled !== undefined ? msg.pulse_enabled : prev.pulseEnabled,
            pulseInterval: msg.pulse_interval !== undefined ? msg.pulse_interval : prev.pulseInterval,
            pulseDuration: msg.pulse_duration !== undefined ? msg.pulse_duration : prev.pulseDuration,
          }));
        } else if (msg.type === 'pulse_event') {
          setLastPulse({
            timestamp: Date.now(),
            duration: msg.duration,
            lowFreq: msg.low_freq,
            highFreq: msg.high_freq,
          });
        } else if (msg.type === 'sequence_playhead') {
          setPlayheadTime(msg.time);
          setSequenceActive(true);
          setInDelay(!!msg.in_delay);
          setRemainingDelay(msg.remaining_delay || 0.0);
          // Sync low/high freq variables dynamically so visual waveform matches output
          setState(prev => ({
            ...prev,
            lowFreq: msg.low_val !== undefined ? msg.low_val : prev.lowFreq,
            highFreq: msg.high_val !== undefined ? msg.high_val : prev.highFreq
          }));
        } else if (msg.type === 'sequence_finished') {
          setSequenceActive(false);
          setPlayheadTime(0);
          setInDelay(false);
          setRemainingDelay(0);
          setState(prev => ({ ...prev, lowFreq: 0.0, highFreq: 0.0 }));
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected. Reconnecting in 2 seconds...');
      setWsConnected(false);
      setSequenceActive(false);
      setPlayheadTime(0);
      setInDelay(false);
      setRemainingDelay(0);
      // Reset hardware connection representation when server is unreachable
      setState(prev => ({ ...prev, connected: false, deviceName: 'None' }));
      
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 2000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket connection error:', err);
      ws.close();
    };
  }, [url]);

  useEffect(() => {
    connect();

    // Setup heartbeat ping to keep connection active
    const heartbeat = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 8000);

    return () => {
      clearInterval(heartbeat);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendVibration = useCallback((low: number, high: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'set_vibration',
        low_freq: low,
        high_freq: high,
      }));
    }
  }, []);

  const sendPulseConfig = useCallback((enabled: boolean, interval: number, duration: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'set_pulse',
        enabled,
        interval,
        duration,
      }));
    }
  }, []);

  const sendStop = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setSequenceActive(false);
      setPlayheadTime(0);
      setInDelay(false);
      setRemainingDelay(0);
      wsRef.current.send(JSON.stringify({
        type: 'stop',
      }));
    }
  }, []);

  // Playback Sequencer Controllers
  const startSequence = useCallback((duration: number, loop: boolean, lowTrack: any[], highTrack: any[], loopDelay: number = 0.0) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setSequenceActive(true);
      setPlayheadTime(0);
      setInDelay(false);
      setRemainingDelay(0);
      wsRef.current.send(JSON.stringify({
        type: 'start_sequence',
        duration,
        loop,
        loop_delay: loopDelay,
        low_track: lowTrack,
        high_track: highTrack
      }));
    }
  }, []);
 
  const stopSequence = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setSequenceActive(false);
      setPlayheadTime(0);
      setInDelay(false);
      setRemainingDelay(0);
      wsRef.current.send(JSON.stringify({
        type: 'stop_sequence'
      }));
    }
  }, []);

  return {
    wsConnected,
    ...state,
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
  };
}
