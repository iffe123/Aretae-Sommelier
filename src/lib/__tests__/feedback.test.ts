import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_FEEDBACK_EMAIL = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL;

afterEach(() => {
  process.env.NEXT_PUBLIC_FEEDBACK_EMAIL = ORIGINAL_FEEDBACK_EMAIL;
  vi.resetModules();
});

describe("buildFeedbackMailto", () => {
  it("builds a mailto link with the title and page", async () => {
    delete process.env.NEXT_PUBLIC_FEEDBACK_EMAIL;
    const { buildFeedbackMailto } = await import("../feedback");

    const href = buildFeedbackMailto({
      title: "Cellar feedback",
      page: "Cellar dashboard",
    });

    expect(href).toContain("mailto:?");
    expect(decodeURIComponent(href)).toContain("Cellar feedback - Aretae Sommelier");
    expect(decodeURIComponent(href)).toContain("Page: Cellar dashboard");
  });

  it("includes sommelier prompt and reply when provided", async () => {
    const { buildFeedbackMailto } = await import("../feedback");

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

  it("uses the configured feedback recipient and includes extra details", async () => {
    process.env.NEXT_PUBLIC_FEEDBACK_EMAIL = "feedback@example.com";
    const { buildFeedbackMailto } = await import("../feedback");

    const href = buildFeedbackMailto({
      title: "Launch feedback",
      page: "Add wine form",
      category: "wine-lookup",
      details: {
        wine_count: 12,
        viewport: "390x844",
      },
    });

    const decoded = decodeURIComponent(href);
    expect(decoded).toContain("mailto:feedback@example.com");
    expect(decoded).toContain("Category: wine-lookup");
    expect(decoded).toContain("Wine Count: 12");
    expect(decoded).toContain("Viewport: 390x844");
  });
});
