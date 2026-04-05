import { describe, expect, it } from "vitest";
import { buildFeedbackMailto } from "../feedback";

describe("buildFeedbackMailto", () => {
  it("builds a mailto link with the title and page", () => {
    const href = buildFeedbackMailto({
      title: "Cellar feedback",
      page: "Cellar dashboard",
    });

    expect(href).toContain("mailto:?");
    expect(decodeURIComponent(href)).toContain("Cellar feedback - Aretae Sommelier");
    expect(decodeURIComponent(href)).toContain("Page: Cellar dashboard");
  });

  it("includes sommelier prompt and reply when provided", () => {
    const href = buildFeedbackMailto({
      title: "Sommelier feedback",
      page: "Sommelier chat",
      userMessage: "What goes with steak?",
      assistantMessage: "Try Barolo.",
    });

    const decoded = decodeURIComponent(href);
    expect(decoded).toContain("Prompt: What goes with steak?");
    expect(decoded).toContain("Sommelier reply: Try Barolo.");
  });
});
