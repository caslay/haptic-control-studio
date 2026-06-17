import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from haptic import HapticController

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("main_server")

active_connections: Set[WebSocket] = set()
controller: HapticController = None

async def broadcast_to_all(message: dict):
    """Broadcasts a JSON dictionary to all connected WebSocket clients."""
    if not active_connections:
        return
    message_str = json.dumps(message)
    # Create list to prevent mutations during iteration
    for ws in list(active_connections):
        try:
            await ws.send_text(message_str)
        except Exception as e:
            logger.warning(f"Error sending message to client: {e}")
            active_connections.discard(ws)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes haptic engine, runs poll loops, and guarantees cleanup on shutdown."""
    global controller
    logger.info("Initializing Haptic Engine Backend...")
    
    # Instantiate controller with the broadcast callback
    controller = HapticController(broadcast_callback=broadcast_to_all)
    
    # Start controller connection polling loop in the background
    monitor_task = asyncio.create_task(controller.monitor_connection_loop())
    
    yield
    
    # Server shutdown sequence
    logger.info("Server shutting down. Cleaning up haptics...")
    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        pass
    
    await controller.stop_all()
    logger.info("Backend cleaned up successfully.")

app = FastAPI(lifespan=lifespan)

# Allow CORS for localhost configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/status")
async def get_status():
    """Returns the current connection and motor speeds via HTTP API."""
    if controller:
        return {
            "connected": controller.connected,
            "device_name": controller.device_name,
            "low_freq": controller.low_freq,
            "high_freq": controller.high_freq,
            "pulse_enabled": controller.pulse_enabled,
        }
    return {"error": "Haptic controller not initialized"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket handler for real-time control communications."""
    await websocket.accept()
    active_connections.add(websocket)
    logger.info(f"Client connected: {websocket.client}")

    # Immediately push current hardware state to new client on connect
    if controller:
        state_msg = {
            "type": "state",
            "connected": controller.connected,
            "device_name": controller.device_name,
            "low_freq": controller.low_freq,
            "high_freq": controller.high_freq,
            "pulse_enabled": controller.pulse_enabled,
            "pulse_interval": controller.pulse_interval,
            "pulse_duration": controller.pulse_duration,
        }
        await websocket.send_text(json.dumps(state_msg))

    try:
        while True:
            # Read messages from the socket
            data = await websocket.receive_text()
            try:
                command = json.loads(data)
                cmd_type = command.get("type")
                
                if cmd_type == "set_vibration":
                    low_freq = float(command.get("low_freq", 0.0))
                    high_freq = float(command.get("high_freq", 0.0))
                    await controller.update_vibration(low_freq, high_freq)
                    
                    # Echo state back to synchronize sliders on other tabs/clients
                    await broadcast_to_all({
                        "type": "state_sync",
                        "low_freq": controller.low_freq,
                        "high_freq": controller.high_freq,
                    })

                elif cmd_type == "set_pulse":
                    enabled = bool(command.get("enabled", False))
                    interval = float(command.get("interval", 2.0))
                    duration = int(command.get("duration", 300))
                    await controller.set_pulse_mode(enabled, interval, duration)
                    
                    # Echo full repeat mode configurations
                    await broadcast_to_all({
                        "type": "state_sync",
                        "pulse_enabled": controller.pulse_enabled,
                        "pulse_interval": controller.pulse_interval,
                        "pulse_duration": controller.pulse_duration,
                    })

                elif cmd_type == "stop":
                    await controller.stop_all()
                    # Broadcast stop update to synchronize client UI elements
                    await broadcast_to_all({
                        "type": "state",
                        "connected": controller.connected,
                        "device_name": controller.device_name,
                        "low_freq": 0.0,
                        "high_freq": 0.0,
                        "pulse_enabled": False,
                        "pulse_interval": controller.pulse_interval,
                        "pulse_duration": controller.pulse_duration,
                    })

                elif cmd_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"Malformed socket command: {data}. Error: {e}")
                await websocket.send_text(json.dumps({"type": "error", "message": "Invalid command format"}))

    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {websocket.client}")
        active_connections.discard(websocket)
        
        # If no clients are connected, safety clean up by shutting down vibration
        if not active_connections:
            logger.info("No active socket clients. Safety shut-down of vibration motors.")
            if controller:
                await controller.stop_all()

    except Exception as e:
        logger.error(f"Unexpected error in websocket: {e}")
        active_connections.discard(websocket)
