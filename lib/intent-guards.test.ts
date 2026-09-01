import { describe, expect, it } from "vitest";
import { wantsContinueTour, wantsListeningCheck } from "@/lib/intent-guards";
import { interpretUtterance } from "@/lib/demo-assistant";

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
