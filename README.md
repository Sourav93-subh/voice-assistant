<div align="center">

<br/>

```
██╗   ██╗ ██████╗ ██╗ ██████╗███████╗
██║   ██║██╔═══██╗██║██╔════╝██╔════╝
██║   ██║██║   ██║██║██║     █████╗  
╚██╗ ██╔╝██║   ██║██║██║     ██╔══╝  
 ╚████╔╝ ╚██████╔╝██║╚██████╗███████╗
  ╚═══╝   ╚═════╝ ╚═╝ ╚═════╝╚══════╝
 █████╗ ███████╗███████╗██╗███████╗████████╗ █████╗ ███╗   ██╗████████╗
██╔══██╗██╔════╝██╔════╝██║██╔════╝╚══██╔══╝██╔══██╗████╗  ██║╚══██╔══╝
███████║███████╗███████╗██║███████╗   ██║   ███████║██╔██╗ ██║   ██║   
██╔══██║╚════██║╚════██║██║╚════██║   ██║   ██╔══██║██║╚██╗██║   ██║   
██║  ██║███████║███████║██║███████║   ██║   ██║  ██║██║ ╚████║   ██║   
╚═╝  ╚═╝╚══════╝╚══════╝╚═╝╚══════╝  ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝  
```

### *Speak. Think. Respond. In under 800ms.*

<br/>

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://voice-assistant-gilt-five.vercel.app)
[![Backend](https://img.shields.io/badge/API-Railway-blueviolet?style=for-the-badge&logo=railway)](https://voice-assistant-production-c0a5.up.railway.app/health)
[![Python](https://img.shields.io/badge/Python-3.13-blue?style=for-the-badge&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)](LICENSE)

<br/>

> **A production-grade real-time voice AI assistant that listens to you, thinks with Groq's blazing-fast LLM, searches the web for current information, and speaks back — all in under 800 milliseconds.**

<br/>

---

</div>

## ✦ Demo

```
🎤  You speak    →  "What's happening in India today?"
                         ↓  ~200ms
🔤  Whisper STT  →  "What's happening in India today?"
                         ↓  ~150ms  
🔍  Tavily       →  searches web for real-time news
                         ↓  ~200ms
🧠  Groq LLM     →  generates concise spoken response
                         ↓  ~200ms
🔊  ElevenLabs   →  converts text to natural speech
                         ↓
🎧  You hear     →  "India is currently..."

Total: < 800ms end-to-end
```

---

## ✦ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                    │
│                       React + Web Audio API                          │
│                                                                      │
│   🎤 Microphone  ──────────────────────────────  🔊 Speaker         │
│        │                                               ↑            │
│        │ base64 audio                    base64 mp3    │            │
│        ▼                                               │            │
│   ┌─────────────────────────────────────────────────┐ │            │
│   │              WebSocket Connection               │ │            │
│   └──────────────────────┬──────────────────────────┘ │            │
└──────────────────────────│────────────────────────────-│────────────┘
                           │                             │
                    send audio                    receive audio
                           │                             │
┌──────────────────────────▼─────────────────────────────────────────┐
│                          BACKEND                                    │
│                    FastAPI + WebSockets                             │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────────┐   │
│  │  Whisper    │    │  Groq LLM   │    │    ElevenLabs TTS    │   │
│  │  STT        │ →  │  + Tavily   │ →  │    eleven_turbo_v2.5 │   │
│  │  large-v3   │    │  web search │    │    mp3_44100_128      │   │
│  └─────────────┘    └─────────────┘    └──────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ✦ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **STT** | Groq Whisper large-v3-turbo | Speech → text in ~200ms |
| **LLM** | Groq · GPT-OSS 120B | Intelligent responses |
| **Web Search** | Tavily API | Real-time information |
| **TTS** | ElevenLabs turbo v2.5 | Natural voice output |
| **Backend** | FastAPI + WebSockets | Real-time async pipeline |
| **Frontend** | React + Web Audio API | Mic recording + audio playback |
| **Backend Deploy** | Railway | Auto-deploy from GitHub |
| **Frontend Deploy** | Vercel | Global CDN |

---

## ✦ Features

```
✓  Sub-800ms end-to-end latency
✓  Real-time web search via Tavily (knows today's news)
✓  Persistent conversation history per session
✓  Auto-reconnect WebSocket with exponential backoff  
✓  Works on mobile (touch events supported)
✓  Visual pipeline indicators (Whisper → Groq → ElevenLabs)
✓  Animated orb UI with status-aware color system
✓  Session-scoped conversation memory
✓  Production deployed — no local setup needed
```

---

## ✦ Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Groq API key](https://console.groq.com) — free
- [ElevenLabs API key](https://elevenlabs.io) — free (10k chars/month)
- [Tavily API key](https://app.tavily.com) — free (1000 searches/month)

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your API keys
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_WS_URL=ws://localhost:8000
npm run dev
```

Open `http://localhost:5173` → hold the mic → speak → release → listen.

---

## ✦ Project Structure

```
voice-assistant/
├── backend/
│   ├── main.py           ← FastAPI + WebSocket pipeline
│   ├── requirements.txt
│   ├── Procfile          ← Railway deployment
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx       ← React UI + Web Audio
    │   └── App.css       ← Animated dark UI
    ├── vercel.json
    └── .env.example
```

---

## ✦ API

### WebSocket — `ws://host/ws/{session_id}`

**Send (client → server):**
```json
{ "type": "audio", "audio": "<base64 webm>" }
{ "type": "clear" }
```

**Receive (server → client):**
```json
{ "type": "status",     "message": "transcribing|thinking|speaking|ready" }
{ "type": "transcript", "role": "user|assistant", "text": "..." }
{ "type": "audio",      "audio": "<base64 mp3>", "format": "mp3" }
{ "type": "error",      "message": "..." }
```

### REST
```
GET /health  →  { "status": "ok" }
```

---

## ✦ Environment Variables

### Backend `.env`
```
GROQ_API_KEY=gsk_...
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
TAVILY_API_KEY=tvly_...
```

### Frontend `.env`
```
VITE_WS_URL=ws://localhost:8000        # local
VITE_WS_URL=wss://your.railway.app    # production
```

---

## ✦ Deployment

### Backend → Railway
1. Connect GitHub repo
2. Set Root Directory: `backend`
3. Add environment variables
4. Generate domain → get `wss://` URL

### Frontend → Vercel
1. Import GitHub repo
2. Set Root Directory: `frontend`
3. Add `VITE_WS_URL=wss://your-railway-url`
4. Deploy

---

## ✦ Resume Bullet

> Built sub-800ms real-time voice AI assistant — Groq Whisper STT → GPT-OSS 120B LLM with Tavily web search → ElevenLabs TTS over WebSockets; async FastAPI backend on Railway, React + Web Audio API frontend on Vercel

---

## ✦ License

MIT © [Sourav Subham](https://github.com/Sourav93-subh)

<div align="center">
<br/>
<i>Built to demonstrate real-time AI systems — the hardest kind to build.</i>
<br/><br/>

⭐ Star this repo if it impressed you

</div>
