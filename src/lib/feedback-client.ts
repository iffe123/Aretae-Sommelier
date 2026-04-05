"use client";

import { track } from "@vercel/analytics";
import { buildFeedbackMailto } from "@/lib/feedback";

type FeedbackDetailValue = string | number | boolean | null | undefined;

interface OpenFeedbackDraftOptions {
  title: string;
  page: string;
  source?: string;
  userMessage?: string;
  assistantMessage?: string;
  category?: string;
  details?: Record<string, FeedbackDetailValue>;
}

function getBrowserDetails() {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    timestamp: new Date().toISOString(),
    route: window.location.pathname,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language,
    platform: navigator.platform || undefined,
  };
}

export function openFeedbackDraft({
  details,
  ...options
}: OpenFeedbackDraftOptions): string {
  const href = buildFeedbackMailto({
    ...options,
    source:
      options.source ||
      (typeof window !== "undefined" ? window.location.href : undefined),
    details: {
      ...getBrowserDetails(),
      ...details,
    },
  });

  track("Feedback draft opened", {
    page: options.page,
    category: options.category || "general",
  });

  if (typeof window !== "undefined") {
    window.location.href = href;
  }

  return href;
}
