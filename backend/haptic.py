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
            self._apply_rumble(0.0, 0.0)
            logger.info("Hardware controller stopped and cleared.")
