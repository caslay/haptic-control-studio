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
- Employs a safety cleanup check: if the socket connection is lost or the server stops, both motors are instantly zeroed.

### 🌐 FastAPI Server ([main.py](file:///c:/My%20Files/Work/Lab/haptic_control/backend/main.py))
- Uses WebSockets to push state updates instantly.
- Echoes state synchronizations to ensure multiple client tabs remain perfectly aligned.

### 🎨 Appearance Configurator ([ThemeDashboard.tsx](file:///c:/My%20Files/Work/Lab/haptic_control/frontend/src/components/ThemeDashboard.tsx))
- Dynamically binds configuration values (Accent Colors, Background Themes, Typography, and Weights) to CSS Custom Variables (e.g. `--primary-color`).
- Modifies theme variables on `document.documentElement` in real time, making changes compile instantly across the Tailwind environment.
- Persists user preferences using `localStorage`.

### 📉 Composite Telemetry oscilloscope ([VisualPulse.tsx](file:///c:/My%20Files/Work/Lab/haptic_control/frontend/src/components/VisualPulse.tsx))
- Renders an interactive composite wave simulation on a canvas.
- Dynamically blends slow, high-amplitude waves (low-frequency rumble) with rapid, fine oscillations (high-frequency buzz) and overlays radial rings when repeat pulse signals trigger.

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
