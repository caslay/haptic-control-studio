import ctypes
import asyncio
import logging
from typing import Callable, Optional, Dict, Any

logger = logging.getLogger("haptic_controller")
logger.setLevel(logging.INFO)

# Define XInput structure for motor speed mapping
class XINPUT_VIBRATION(ctypes.Structure):
    _fields_ = [
        ("wLeftMotorSpeed", ctypes.c_ushort),
        ("wRightMotorSpeed", ctypes.c_ushort)
    ]

# Define XInput State structure to check gamepad connection
class XINPUT_STATE(ctypes.Structure):
    _fields_ = [
        ("dwPacketNumber", ctypes.c_ulong),
        ("raw_gamepad_data", ctypes.c_byte * 12)  # 12 bytes of gamepad state info
    ]

class HapticController:
    def __init__(self, broadcast_callback: Optional[Callable[[Dict[str, Any]], Any]] = None):
        self.broadcast_callback = broadcast_callback
        
        # Load XInput DLL
        self.xinput = None
        for dll_name in ["xinput1_4", "xinput1_3", "xinput9_1_0"]:
            try:
                self.xinput = ctypes.windll.LoadLibrary(dll_name)
                logger.info(f"Loaded XInput DLL: {dll_name}")
                break
            except Exception as e:
                logger.warning(f"Failed to load {dll_name}: {e}")
        
        if not self.xinput:
            logger.error("No compatible XInput DLL found. Haptic feedback will be emulated.")

        # Controller states
        self.connected = False
        self.device_name = "None"
        self.connected_slots = []  # List of active XInput user indexes

        # Vibration levels (0.0 to 1.0)
        self.low_freq = 0.0   # Left motor (heavy rumble)
        self.high_freq = 0.0  # Right motor (sharp buzz)

        # Pulse settings (Repeat Mode)
        self.pulse_enabled = False
        self.pulse_interval = 2.0    # Seconds
        self.pulse_duration = 300.0   # Milliseconds
        self.pulse_task: Optional[asyncio.Task] = None

        # Sequence settings (Automation Envelope)
        self.sequence_active = False
        self.sequence_duration = 5.0
        self.sequence_loop = True
        self.sequence_loop_delay = 0.0
        self.sequence_low_track = []
        self.sequence_high_track = []
        self.sequence_task: Optional[asyncio.Task] = None

        # Lock to prevent concurrent rumble writes overriding each other
        self.rumble_lock = asyncio.Lock()

    def _apply_rumble(self, low: float, high: float):
        """Helper to send rumble values directly to XInput DLL."""
        if not self.xinput or not self.connected:
            return
        
        # Clamp to 0.0 - 1.0
        low = max(0.0, min(1.0, low))
        high = max(0.0, min(1.0, high))

        # Map to XInput WORD (0 to 65535)
        left_speed = int(low * 65535)
        right_speed = int(high * 65535)

        vibration = XINPUT_VIBRATION(left_speed, right_speed)
        
        # Send vibration commands to all active gamepad slots
        for slot in self.connected_slots:
            try:
                self.xinput.XInputSetState(slot, ctypes.byref(vibration))
            except Exception as e:
                logger.error(f"Error in XInputSetState for Slot {slot}: {e}")

    async def update_vibration(self, low: float, high: float):
        """Updates the current vibration intensities."""
        async with self.rumble_lock:
            self.low_freq = low
            self.high_freq = high
            
            # If repeat mode is NOT active, apply immediately
            if not self.pulse_enabled:
                self._apply_rumble(self.low_freq, self.high_freq)

    async def set_pulse_mode(self, enabled: bool, interval: float, duration: int):
        """Toggles repeat pulse mode and updates parameters."""
        async with self.rumble_lock:
            self.pulse_enabled = enabled
            self.pulse_interval = max(0.1, interval)
            self.pulse_duration = max(10, duration)

            if not self.pulse_enabled:
                # Stop repeat task and zero out motors immediately
                if self.pulse_task:
                    self.pulse_task.cancel()
                    self.pulse_task = None
                self._apply_rumble(0.0, 0.0)
                logger.info("Pulse mode disabled.")
            else:
                # Start repeat task if not already running
                if not self.pulse_task or self.pulse_task.done():
                    self.pulse_task = asyncio.create_task(self._pulse_loop())
                logger.info(f"Pulse mode enabled: Interval={self.pulse_interval}s, Duration={self.pulse_duration}ms")

    async def _pulse_loop(self):
        """Asynchronous background loop for Repeat Mode."""
        try:
            while self.pulse_enabled:
                if self.connected and (self.low_freq > 0.0 or self.high_freq > 0.0):
                    # Trigger the pulse vibration
                    self._apply_rumble(self.low_freq, self.high_freq)

                    # Notify client about the physical pulse trigger event
                    if self.broadcast_callback:
                        await self.broadcast_callback({
                            "type": "pulse_event",
                            "duration": self.pulse_duration,
                            "low_freq": self.low_freq,
                            "high_freq": self.high_freq
                        })

                    # Vibrate for the configured duration
                    await asyncio.sleep(self.pulse_duration / 1000.0)
                    
                    # Stop vibration (idle phase)
                    self._apply_rumble(0.0, 0.0)

                # Wait for the remaining time of the interval
                sleep_time = max(0.01, self.pulse_interval - (self.pulse_duration / 1000.0))
                await asyncio.sleep(sleep_time)
        except asyncio.CancelledError:
            # Handle cancellation cleanup
            self._apply_rumble(0.0, 0.0)
        except Exception as e:
            logger.error(f"Error in pulse loop: {e}")
            self._apply_rumble(0.0, 0.0)

    def check_gamepad_connection(self) -> bool:
        """Polls XInput slots 0-3 and updates connected_slots. Returns True if state or slots changed."""
        if not self.xinput:
            return False
        
        state = XINPUT_STATE()
        active_slots = []
        for i in range(4):
            res = self.xinput.XInputGetState(i, ctypes.byref(state))
            if res == 0:  # ERROR_SUCCESS
                active_slots.append(i)
        
        changed = (active_slots != self.connected_slots)
        if changed:
            self.connected_slots = active_slots
            self.connected = len(active_slots) > 0
            if self.connected:
                # Format friendly device list (e.g. Gamepad (Slot 0) & Gamepad (Slot 1))
                self.device_name = " & ".join([f"Gamepad (Slot {s})" for s in active_slots])
            else:
                self.device_name = "None"
            logger.info(f"Connected slots updated: {self.device_name}")
            
        return changed

    async def monitor_connection_loop(self):
        """Background loop to poll controller connection status."""
        while True:
            # check_gamepad_connection returns True if slots changed
            state_changed = self.check_gamepad_connection()
            
            # Broadcast state changes to clients
            if state_changed and self.broadcast_callback:
                await self.broadcast_callback({
                    "type": "status",
                    "connected": self.connected,
                    "device_name": self.device_name
                })
                
                # Safety shutoff if all controllers disappear
                if not self.connected:
                    await self.stop_all()

            await asyncio.sleep(1.0)  # Check connection every second

    async def stop_all(self):
        """Immediately zeros out all vibration motors and cancels background tasks."""
        async with self.rumble_lock:
            if self.pulse_task:
                self.pulse_task.cancel()
                self.pulse_task = None
            if self.sequence_task:
                self.sequence_task.cancel()
                self.sequence_task = None
            self.sequence_active = False
            self._apply_rumble(0.0, 0.0)
            logger.info("Hardware controller stopped and cleared.")

    def _interpolate_intensity(self, track: list, t: float) -> float:
        """Helper to compute linear interpolation of motor power at elapsed time t."""
        if not track:
            return 0.0
        
        # Sort track by time coordinate
        sorted_track = sorted(track, key=lambda k: k.get("time", 0.0))
        
        # Boundary checks
        if t <= sorted_track[0]["time"]:
            return sorted_track[0]["power"]
        if t >= sorted_track[-1]["time"]:
            return sorted_track[-1]["power"]
            
        # Find the envelope keyframes enclosing the current time t
        for i in range(len(sorted_track) - 1):
            k1 = sorted_track[i]
            k2 = sorted_track[i+1]
            t1, p1 = k1["time"], k1["power"]
            t2, p2 = k2["time"], k2["power"]
            
            if t1 <= t <= t2:
                if t2 == t1:
                    return p1
                # Interpolate power value
                return p1 + (p2 - p1) * (t - t1) / (t2 - t1)
                
        return 0.0

    async def start_sequence(self, duration: float, loop: bool, low_track: list, high_track: list, loop_delay: float = 0.0):
        """Spawns an async loop to play and loop a custom haptic pattern sequence."""
        async with self.rumble_lock:
            # Cancel current sequence if running
            if self.sequence_task:
                self.sequence_task.cancel()
                self.sequence_task = None
                
            # Disable legacy pulse mode if running
            if self.pulse_task:
                self.pulse_task.cancel()
                self.pulse_task = None
                self.pulse_enabled = False
                
            self.sequence_active = True
            self.sequence_duration = max(0.1, duration)
            self.sequence_loop = loop
            self.sequence_loop_delay = max(0.0, loop_delay)
            self.sequence_low_track = low_track
            self.sequence_high_track = high_track
            
            # Start background play loop
            self.sequence_task = asyncio.create_task(self._sequence_playback_loop())
            logger.info(f"Haptic sequence automation started: duration={self.sequence_duration}s, loop={self.sequence_loop}, delay={self.sequence_loop_delay}s")

    async def stop_sequence(self):
        """Stops the active sequence task and zeroes motor output."""
        async with self.rumble_lock:
            self.sequence_active = False
            if self.sequence_task:
                self.sequence_task.cancel()
                self.sequence_task = None
            self._apply_rumble(0.0, 0.0)
            logger.info("Haptic sequence automation stopped.")

    async def _sequence_playback_loop(self):
        """Asynchronous execution loop that steps through the sequence timeline."""
        start_time = asyncio.get_event_loop().time()
        try:
            while self.sequence_active:
                current_time = asyncio.get_event_loop().time()
                elapsed = current_time - start_time
                total_duration = self.sequence_duration + self.sequence_loop_delay
                
                # Check for end of timeline
                if elapsed >= total_duration:
                    if self.sequence_loop:
                        # Wrap back to start
                        start_time = current_time - (elapsed % total_duration)
                        elapsed = elapsed % total_duration
                    else:
                        # End playback and notify clients
                        self.sequence_active = False
                        self._apply_rumble(0.0, 0.0)
                        if self.broadcast_callback:
                            await self.broadcast_callback({"type": "sequence_finished"})
                        break
                
                in_delay = elapsed >= self.sequence_duration
                if in_delay:
                    low_val = 0.0
                    high_val = 0.0
                    remaining_delay = total_duration - elapsed
                else:
                    # Calculate interpolated vibration targets for this step
                    low_val = self._interpolate_intensity(self.sequence_low_track, elapsed)
                    high_val = self._interpolate_intensity(self.sequence_high_track, elapsed)
                    remaining_delay = 0.0
                
                # Set physical motor rumbles
                self._apply_rumble(low_val, high_val)
                
                # Broadcast playhead position back to clients for oscilloscope/tracker updates (20Hz)
                if self.broadcast_callback:
                    await self.broadcast_callback({
                        "type": "sequence_playhead",
                        "time": min(elapsed, self.sequence_duration),
                        "low_val": low_val,
                        "high_val": high_val,
                        "in_delay": in_delay,
                        "remaining_delay": remaining_delay
                    })
                
                # Tick at 20Hz
                await asyncio.sleep(0.05)
                
        except asyncio.CancelledError:
            self._apply_rumble(0.0, 0.0)
        except Exception as e:
            logger.error(f"Error in sequence playback loop: {e}")
            self._apply_rumble(0.0, 0.0)
