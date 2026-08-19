import { useState, useRef, useEffect, useCallback } from "react"
import "./App.css"

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000"
const SESSION_ID = crypto.randomUUID()

const STATUS_LABELS = {
  idle: "Hold to speak",
  recording: "Listening...",
  transcribing: "Transcribing...",
  thinking: "Thinking...",
  speaking: "Speaking...",
  ready: "Hold to speak",
  error: "Something went wrong",
  no_speech: "No speech detected",
  connecting: "Connecting...",
}

const STATUS_COLORS = {
  idle: "var(--clr-idle)",
  recording: "var(--clr-recording)",
  transcribing: "var(--clr-processing)",
  thinking: "var(--clr-processing)",
  speaking: "var(--clr-speaking)",
  ready: "var(--clr-idle)",
  error: "var(--clr-error)",
  no_speech: "var(--clr-idle)",
  connecting: "var(--clr-processing)",
}

const DOT_CLASS = {
  idle: "connected",
  recording: "recording",
  transcribing: "processing",
  thinking: "processing",
  speaking: "speaking",
  ready: "connected",
  error: "disconnected",
  connecting: "disconnected",
}

export default function App() {
  const [status, setStatus] = useState("connecting")
  const [messages, setMessages] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [connected, setConnected] = useState(false)

  const wsRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const messagesEndRef = useRef(null)
  const audioContextRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const connectWS = useCallback(() => {
    const ws = new WebSocket(`${WS_URL}/ws/${SESSION_ID}`)
    ws.onopen = () => { setConnected(true); setStatus("idle") }
    ws.onclose = () => { setConnected(false); setStatus("connecting"); setTimeout(connectWS, 2000) }
    ws.onerror = () => setStatus("error")
    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === "status") setStatus(msg.message === "cleared" ? "idle" : msg.message)
      if (msg.type === "transcript") setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: msg.role, text: msg.text }])
      if (msg.type === "audio") await playAudio(msg.audio)
      if (msg.type === "error") { setStatus("error"); setTimeout(() => setStatus("idle"), 2000) }
    }
    wsRef.current = ws
  }, [])

  useEffect(() => { connectWS(); return () => wsRef.current?.close() }, [connectWS])

  const playAudio = async (base64Audio) => {
    const binary = atob(base64Audio)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    if (!audioContextRef.current) audioContextRef.current = new AudioContext()
    const ctx = audioContextRef.current
    if (ctx.state === "suspended") await ctx.resume()
    const audioBuffer = await ctx.decodeAudioData(bytes.buffer)
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    source.start(0)
    source.onended = () => setStatus("idle")
  }

  const startRecording = async () => {
    if (!connected || status === "recording") return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorder.start(100)
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      setStatus("recording")
    } catch (err) { setStatus("error") }
  }

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return
    mediaRecorderRef.current.stop()
    setIsRecording(false)
    setStatus("transcribing")
    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
      const arrayBuffer = await blob.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      wsRef.current?.send(JSON.stringify({ type: "audio", audio: base64 }))
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
    }
  }

  const clearConversation = () => {
    setMessages([])
    wsRef.current?.send(JSON.stringify({ type: "clear" }))
  }

  const isActive = ["transcribing", "thinking", "speaking"].includes(status)
  const orbColor = STATUS_COLORS[status] || "var(--clr-idle)"
  const dotClass = DOT_CLASS[status] || "disconnected"

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <div className={`logo-dot ${dotClass}`} />
            <span className="header-title">Voice Assistant</span>
          </div>
        </div>
        <div className="header-right">
          <span className="badge">Whisper · Groq · ElevenLabs</span>
          <button className="clear-btn" onClick={clearConversation} disabled={!connected}>
            Clear
          </button>
        </div>
      </header>

      <main className="main">
        <div className="messages">
          {messages.length === 0 && (
            <div className="empty">
              <div className="empty-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                </svg>
              </div>
              <p>Hold the button and speak</p>
              <span>Release to get a response</span>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`message message-${msg.role}`}>
              <div className="msg-wrap">
                <span className="msg-label">{msg.role === "user" ? "YOU" : "AI"}</span>
                <div className="message-bubble">{msg.text}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="controls">
          <div className="status-label">{STATUS_LABELS[status] || status}</div>

          <div className="orb-wrap">
            <div className={`orb-ring ${isActive || isRecording ? "visible" : ""}`} style={{ "--orb-color": orbColor }} />
            <button
              className={`orb ${isRecording ? "orb-recording" : ""} ${isActive ? "orb-active" : ""}`}
              style={{ "--orb-color": orbColor }}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={(e) => { e.preventDefault(); startRecording() }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecording() }}
              disabled={!connected || isActive}
              aria-label="Hold to speak"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
          </div>

          <div className="stack-labels">
            <span>Whisper</span>
            <div className="stack-dot" />
            <span>Groq</span>
            <div className="stack-dot" />
            <span>ElevenLabs</span>
            <div className="stack-dot" />
            <span>Tavily</span>
          </div>
        </div>
      </main>
    </div>
  )
}
