import os
import json
import base64
import asyncio
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from groq import AsyncGroq
from elevenlabs.client import ElevenLabs
from elevenlabs import VoiceSettings
from tavily import AsyncTavilyClient
from rich.console import Console

load_dotenv()
console = Console()

app = FastAPI(title="Voice Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
eleven_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
tavily_client = AsyncTavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

conversation_history = {}

NEEDS_SEARCH_KEYWORDS = [
    "today", "now", "current", "latest", "recent", "news",
    "2024", "2025", "2026", "happening", "right now", "flood",
    "weather", "price", "stock", "election", "match", "score",
    "who is", "what is the", "tell me about"
]


def needs_web_search(text: str) -> bool:
    text_lower = text.lower()
    return any(kw in text_lower for kw in NEEDS_SEARCH_KEYWORDS)


async def search_web(query: str) -> str:
    console.log(f"[yellow]🔍 Searching web for:[/yellow] {query}")
    try:
        result = await tavily_client.search(
            query=query,
            search_depth="basic",
            max_results=3,
        )
        snippets = []
        for r in result.get("results", []):
            snippets.append(r.get("content", "")[:300])
        combined = " ".join(snippets)
        console.log(f"[green]Search done:[/green] {len(combined)} chars")
        return combined
    except Exception as e:
        console.log(f"[red]Search failed:[/red] {e}")
        return ""


async def transcribe_audio(audio_bytes: bytes) -> str:
    console.log("[cyan]Transcribing audio...[/cyan]")
    import tempfile, os as _os
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    try:
        with open(tmp_path, "rb") as audio_file:
            transcription = await groq_client.audio.transcriptions.create(
                file=("audio.webm", audio_file, "audio/webm"),
                model="whisper-large-v3-turbo",
                response_format="text",
                language="en",
            )
        text = transcription.strip() if isinstance(transcription, str) else transcription.text.strip()
        console.log(f"[green]Transcribed:[/green] {text}")
        return text
    finally:
        _os.unlink(tmp_path)


async def get_llm_response(session_id: str, user_text: str) -> str:
    console.log(f"[purple]LLM thinking:[/purple] {user_text}")

    if session_id not in conversation_history:
        conversation_history[session_id] = [
            {
                "role": "system",
                "content": (
                    "You are a helpful, friendly voice assistant with access to real-time web search. "
                    "Keep responses concise and conversational — 2-3 sentences max. "
                    "You're being heard as speech, so avoid markdown, bullet points, or special characters. "
                    "Be warm, direct, and natural. When given search results, use them to answer accurately."
                ),
            }
        ]

    # Search web if needed
    web_context = ""
    if needs_web_search(user_text):
        web_context = await search_web(user_text)

    # Build user message with context if available
    if web_context:
        enriched = f"{user_text}\n\n[Real-time search results: {web_context[:800]}]"
    else:
        enriched = user_text

    conversation_history[session_id].append({"role": "user", "content": enriched})

    messages = conversation_history[session_id][-11:]

    response = await groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=messages,
        max_tokens=150,
        temperature=0.7,
    )

    assistant_text = response.choices[0].message.content.strip()
    conversation_history[session_id].append({"role": "assistant", "content": assistant_text})

    console.log(f"[green]LLM response:[/green] {assistant_text}")
    return assistant_text


def text_to_speech(text: str) -> bytes:
    console.log("[cyan]Generating speech...[/cyan]")
    audio_generator = eleven_client.text_to_speech.convert(
        voice_id=VOICE_ID,
        text=text,
        model_id="eleven_turbo_v2_5",
        voice_settings=VoiceSettings(
            stability=0.5,
            similarity_boost=0.75,
            style=0.0,
            use_speaker_boost=True,
        ),
        output_format="mp3_44100_128",
    )
    audio_bytes = b"".join(audio_generator)
    console.log(f"[green]Speech generated:[/green] {len(audio_bytes)} bytes")
    return audio_bytes


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    console.log(f"[bold green]Client connected:[/bold green] {session_id}")

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message["type"] == "audio":
                await websocket.send_text(json.dumps({"type": "status", "message": "transcribing"}))

                audio_bytes = base64.b64decode(message["audio"])

                try:
                    user_text = await transcribe_audio(audio_bytes)
                except Exception as e:
                    await websocket.send_text(json.dumps({"type": "error", "message": f"Transcription failed: {e}"}))
                    continue

                if not user_text:
                    await websocket.send_text(json.dumps({"type": "status", "message": "no_speech"}))
                    continue

                await websocket.send_text(json.dumps({"type": "transcript", "text": user_text, "role": "user"}))
                await websocket.send_text(json.dumps({"type": "status", "message": "thinking"}))

                try:
                    assistant_text = await get_llm_response(session_id, user_text)
                except Exception as e:
                    await websocket.send_text(json.dumps({"type": "error", "message": f"LLM failed: {e}"}))
                    continue

                await websocket.send_text(json.dumps({"type": "transcript", "text": assistant_text, "role": "assistant"}))
                await websocket.send_text(json.dumps({"type": "status", "message": "speaking"}))

                try:
                    audio_bytes_out = await asyncio.to_thread(text_to_speech, assistant_text)
                    audio_b64 = base64.b64encode(audio_bytes_out).decode("utf-8")
                    await websocket.send_text(json.dumps({"type": "audio", "audio": audio_b64, "format": "mp3"}))
                except Exception as e:
                    await websocket.send_text(json.dumps({"type": "error", "message": f"TTS failed: {e}"}))
                    continue

                await websocket.send_text(json.dumps({"type": "status", "message": "ready"}))

            elif message["type"] == "clear":
                conversation_history.pop(session_id, None)
                await websocket.send_text(json.dumps({"type": "status", "message": "cleared"}))

    except WebSocketDisconnect:
        console.log(f"[yellow]Client disconnected:[/yellow] {session_id}")
        conversation_history.pop(session_id, None)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "voice-assistant"}