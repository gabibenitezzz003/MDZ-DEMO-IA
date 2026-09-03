import { describe, expect, it } from "vitest";
import { loadCampoAgentRuntime } from "@/lib/campo-agent-runtime";

describe("Campo agent guardrail + actions", () => {
  const { contextEngine, guardrail, execActions } = loadCampoAgentRuntime();

  it("builds context from inbound message", () => {
    const ctx = contextEngine({
      chatId: "test-chat",
      input: "Encontré un olivo abandonado en Rivadavia",
      inputType: "text",
      session_raw: "",
      memory_raw: "",
      profile_raw: "",
      notes_raw: "",
      state_raw: "",
    });
    expect(ctx.debounce).toBe(false);
    expect(ctx.input).toMatch(/olivo/i);
  });

  it("approves save_note action", () => {
    const raw = JSON.stringify({
      reply: "Anotado, mañana revisamos Los Álamos.",
      response_mode: "text",
      actions: [{ type: "save_note", text: "Revisar Los Álamos mañana" }],
    });
    const g = guardrail(raw, { input: "anotame los alamos", relevamiento: { status: "idle" } });
    expect(g.ok).toBe(true);
    expect(g.actions).toHaveLength(1);
  });

  it("blocks confirm without user confirmation", () => {
    const raw = JSON.stringify({
      reply: "Listo, mandé todo.",
      actions: [{ type: "confirm_relevamiento", userConfirmed: true }],
    });
    const g = guardrail(raw, {
      input: "foto del sitio",
      relevamiento: {
        status: "confirm",
        formKey: "olivo",
        data: {
          departamento: "Rivadavia",
          estado: "Abandonado",
          consociacion: "Consociado",
          cultivosVecinos: "Vid",
        },
      },
    });
    expect(g.ok).toBe(true);
    expect(g.actions).toHaveLength(0);
    expect(g.rejected?.[0]?.reason).toBe("user_did_not_confirm");
  });

  it("executes note + relevamiento update", () => {
    const result = execActions(
      [
        { type: "start_relevamiento", form: "olivo", data: { departamento: "Rivadavia" } },
        { type: "update_relevamiento", data: { estado: "Abandonado" } },
      ],
      {
        chatId: "c1",
        sessionJson: "{}",
        memoryJson: "{}",
        profileJson: "{}",
        notesJson: '{"items":[]}',
        stateJson: "{}",
      }
    );
    const state = JSON.parse(result.stateJson as string);
    expect(state.formKey).toBe("olivo");
    expect(state.data.departamento).toBe("Rivadavia");
    expect(state.data.estado).toBe("Abandonado");
  });
});
