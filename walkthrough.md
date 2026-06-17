# Walkthrough - Haptic Control Dashboard

We have successfully built and verified the **Haptic Control Dashboard**, a full-stack real-time controller vibration synthesizer and telemetry interface.

---

## 1. Directory Structure

The workspace is structured into two clean standalone layers:
```
haptic_control/
├── backend/
│   ├── haptic.py          # Windows ctypes XInput controller and async timer loops
│   └── main.py            # FastAPI server with WebSocket routes and CORS configuration
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Dashboard.tsx       # Main tactile slider and pulse dashboard
    │   │   ├── ThemeDashboard.tsx  # Global CSS custom variables configurator panel
    │   │   └── VisualPulse.tsx     # Compound canvas scope and ring pulse waves
    │   ├── hooks/
    │   │   └── useWebSocket.ts     # Client WS manager with heartbeat & auto-reconnect
    │   ├── App.tsx                 # App layout wiring and Escape safety keybinds
    │   ├── index.css               # Core styling tokens and font loading imports
    │   └── main.tsx                # StrictMode entrypoint
    ├── index.html                  # HTML entry with search optimization/description
    ├── tailwind.config.js          # Tailored Tailwind CSS config mapped to CSS custom variables
    └── postcss.config.js           # PostCSS configuration using @tailwindcss/postcss
```

---

## 2. Component Highlights
 
 ### 🕹️ Hardware Engine & Async Pulse Logic ([haptic.py](file:///c:/My%20Files/Work/Lab/haptic_control/backend/haptic.py))
 - Directly calls standard Windows `xinput1_4.dll` methods via standard library `ctypes`.
 - Automatically polls for connected devices every `1.0s` without blocking.
 - Implements **Repeat Mode** (Pulse Logic) via a non-blocking `asyncio.sleep` timer loop.
 - Implements **Spline Timeline Sequencing** running at 20Hz, supporting linear envelope interpolation for high-precision tactile feedback curves.
 - Implements a **Loop Delay timer** running on the backend. When a loop completes, the engine silences rumble outputs and counts down before the next iteration, sending live timer metadata.
 - Employs a safety cleanup check: if the socket connection is lost or the server stops, both motors are instantly zeroed.
 
 ### 🌐 FastAPI Server ([main.py](file:///c:/My%20Files/Work/Lab/haptic_control/backend/main.py))
 - Uses WebSockets to push state updates instantly.
 - Echoes state synchronizations to ensure multiple client tabs remain perfectly aligned.
 - Forwards timeline keyframe vectors and loop delay parameters to the background player.
 
 ### 📈 Timeline Spline Editor ([SplineEditor.tsx](file:///c:/My%20Files/Work/Lab/haptic_control/frontend/src/components/SplineEditor.tsx))
 - Hosts two synchronized SVG envelope tracks for drawing custom vibration shapes.
 - **Categorized Preset Library:** Replaces simple preset buttons with a grouped selector for built-in algorithms (Pulse Train, Accelerate, Cross-Wave) and custom-drawn user shapes.
 - **Custom Preset Manager:** Saves user patterns (including keyframe nodes and timeline durations) to `localStorage` under custom names, and provides custom deletion.
 - **Precision Timing Sliders:** Includes a Duration slider and a Loop Delay slider to customize sequence repetitions.
 - **Visual Delay Feedback Overlay:** When the sequencer is in its delay phase, a translucent glass blur overlay drops onto the SVG timelines displaying a live countdown timer (e.g., `Delaying: 1.2s`).
 - **Ergonomic Layout:** Splitted preset load/save options into two separate, full-width rows inside a flex-column wrapper, preventing buttons from clipping or overflowing the grid boundaries.
 - **Enhanced Canvas Space:** Expanded the graph timeline editor height by increasing `VIEWBOX_HEIGHT` from `150` to `250` SVG units, giving a cleaner aspect ratio and more space to place and modify points.
 - **Overlay Hitboxes (r=20):** Keyframes are wrapped in `<g className="group/node">` containing a transparent circle with `r={20}` for mouse event targeting and a visible point `r={8}`. This provides a 3x larger mouse click and drag target, while changing colors and scaling up smoothly on hover.
 - **Proximity click safeguards:** Implemented a Euclidean distance proximity check in SVG coordinates (25 units). Click-to-spawn keyframes are ignored if the coordinate is too close to any existing point, preventing duplicate or accidental point additions when users drag points.
 
 ### 🎨 Appearance Configurator ([ThemeDashboard.tsx](file:///c:/My%20Files/Work/Lab/haptic_control/frontend/src/components/ThemeDashboard.tsx))
 - Dynamically binds configuration values (Accent Colors, Background Themes, Typography, and Weights) to CSS Custom Variables (e.g. `--primary-color`).
 - Modifies theme variables on `document.documentElement` in real time, making changes compile instantly across the Tailwind environment.
 - Persists user preferences using `localStorage`.
 
 ### 📉 Composite Telemetry oscilloscope ([VisualPulse.tsx](file:///c:/My%20Files/Work/Lab/haptic_control/frontend/src/components/VisualPulse.tsx))
 - Renders an interactive composite wave simulation on a canvas.
 - Dynamically blends slow, high-amplitude waves (low-frequency rumble) with rapid, fine oscillations (high-frequency buzz) and overlays radial rings when repeat pulse signals trigger.
 - Automatically flattens back to a rest line during the loop delay countdown phase.
 
 ### ☁️ Neon SQL Cloud Persistence ([database.py](file:///c:/My%20Files/Work/Lab/haptic_control/backend/database.py))
 - Connects the FastAPI backend to your Neon serverless Postgres database using SQLAlchemy.
 - Automatically creates and provisions relational schemas for `presets` and `settings` on server startup.
 - Integrates full CRUD REST endpoints for managing preset keyframe nodes and appearance layout settings.
 - Employs a local cache fallback strategy (`localStorage` syncing) in components to guarantee usability even if connection status drops.
 
 ---
 
 ## 3. Verification & Execution Results

### Backend Verification
The backend scripts are syntax error free and compilation is verified:
```powershell
python -m py_compile backend/haptic.py backend/main.py
```
*(Completed with 0 errors)*

Probing the running FastAPI status endpoint returned the following hardware check:
```json
{
  "connected": true,
  "device_name": "Xbox Controller (Slot 0)",
  "low_freq": 0.0,
  "high_freq": 0.0,
  "pulse_enabled": false
}
```
**Success:** The XInput DLL initialized, detected the physical controller successfully at Slot 0, and exposed correct status parameters.

### Frontend Verification
The Vite React production compiler built the frontend assets correctly with strict type checks passing:
```powershell
npm run build
```
*(Successfully compiled dist files, including bundle sizes and generated stylesheets)*

---

## 4. How to Launch Locally

### Step 1: Start the FastAPI Backend
You can now start the backend server directly from the `frontend` folder using npm:
```powershell
npm run backend
```
Or manually from the `backend` folder:
```powershell
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Step 2: Start the Vite Dev Server
From the `frontend` folder, start the hot-reloading React dev server:
```powershell
npm run dev
```

*Navigate to `http://localhost:5173` inside your browser to open the Haptic Control Dashboard!*
