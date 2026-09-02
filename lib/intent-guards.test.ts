import { describe, expect, it } from "vitest";
import { wantsContinueTour, wantsListeningCheck, wantsSimpleGreeting } from "@/lib/intent-guards";
import { interpretUtterance } from "@/lib/demo-assistant";

describe("wantsSimpleGreeting", () => {
  it("detects bare hola", () => {
    expect(wantsSimpleGreeting("hola")).toBe(true);
    expect(wantsSimpleGreeting("buenas")).toBe(true);
  });
  it("detects natural greeting phrases", () => {
    expect(wantsSimpleGreeting("hola como estas")).toBe(true);
    expect(wantsSimpleGreeting("hola, ¿cómo andás?")).toBe(true);
    expect(wantsSimpleGreeting("buenas que tal")).toBe(true);
  });
  it("ignores hola with a request", () => {
    expect(wantsSimpleGreeting("hola quiero ciruela")).toBe(false);
    expect(wantsSimpleGreeting("quiero el RUT")).toBe(false);
  });
});

describe("wantsListeningCheck", () => {
  it("detects mic check questions", () => {
    expect(
      wantsListeningCheck("¿Vos me escuchás a mí o escuchás a otra cosa?")
    ).toBe(true);
    expect(wantsListeningCheck("me escuchás?")).toBe(true);
    expect(wantsListeningCheck("hola")).toBe(false);
  });
});

describe("wantsContinueTour", () => {
  it("allows explicit continue, not mic-check phrasing", () => {
    expect(wantsContinueTour("seguimos")).toBe(true);
    expect(wantsContinueTour("mostrame otra sección")).toBe(true);
    expect(
      wantsContinueTour("¿Vos me escuchás a mí o escuchás a otra cosa?")
    ).toBe(false);
  });
});

describe("interpretUtterance greetings", () => {
  it("does not treat a greeting as RUT", () => {
    const intent = interpretUtterance("hola como estas");
    expect(intent.action).toBe("describe");
    expect(intent.target).toBeUndefined();
    expect(intent.reply.toLowerCase()).toMatch(/hola|bien|ayudo/);
  });
});

describe("interpretUtterance coherence", () => {
  it("answers listening checks without navigating away", () => {
    const intent = interpretUtterance(
      "¿Vos me escuchás a mí o escuchás a otra cosa?"
    );
    expect(intent.action).toBe("describe");
    expect(intent.payload?.continueTour).toBeFalsy();
    expect(intent.reply.toLowerCase()).toMatch(/escuch/);
  });
});
