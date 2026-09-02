import { describe, expect, it } from "vitest";
import { correctSpeechTranscript } from "@/lib/stt-correct";

describe("correctSpeechTranscript RUT homophones", () => {
  it("fixes root/ruth/rod to RUT", () => {
    expect(correctSpeechTranscript("parte del root").text).toMatch(/RUT/i);
    expect(correctSpeechTranscript("llevame al root").text).toMatch(/RUT/i);
    expect(correctSpeechTranscript("el ruth").text).toMatch(/RUT/i);
    expect(correctSpeechTranscript("Rod").text).toMatch(/RUT/i);
    expect(correctSpeechTranscript("quiero el rod").text).toMatch(/RUT/i);
  });
});
