"""
Agente de voz mínimo para LiveKit usando livekit-agents.
Requiere:
  pip install livekit-agents livekit-plugins-openai python-dotenv
Variables de entorno:
  LIVEKIT_URL=wss://demos-wou8p4m8.livekit.cloud
  LIVEKIT_API_KEY=...
  LIVEKIT_API_SECRET=...
  OPENAI_API_KEY=...
Ejecutar:
  python scripts/livekit-agent.py start
"""
import os
from dotenv import load_dotenv
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins.openai import stt, tts

load_dotenv()

async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    system_prompt = (
        "Sos el asistente de voz de la Dirección de Agricultura de Mendoza. "
        "Respondé en español argentino, claro y breve. Podés ayudar con cultivos, "
        "el RUT, mapas, clima y la vista de ingeniería/ODK. No pedís CUIT reales ni contraseñas."
    )

    assistant = VoiceAssistant(
        vad=ctx.proc,
        stt=stt.STT(),
        llm=llm.LLM(model="gpt-4o-mini"),
        tts=tts.TTS(model="gpt-4o-mini-tts"),
        chat_ctx=llm.ChatContext().append(role="system", text=system_prompt),
    )
    await assistant.start(ctx.room)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
