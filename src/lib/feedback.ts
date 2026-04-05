interface FeedbackMailtoOptions {
  title: string;
  page: string;
  source?: string;
  userMessage?: string;
  assistantMessage?: string;
  category?: string;
  details?: Record<string, string | number | boolean | null | undefined>;
}

const FEEDBACK_RECIPIENT = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL || "";

function formatDetailLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function buildFeedbackMailto({
  title,
  page,
  source,
  userMessage,
  assistantMessage,
  category,
  details,
}: FeedbackMailtoOptions): string {
  const subject = `${title} - Aretae Sommelier`;
  const detailLines = Object.entries(details || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${formatDetailLabel(key)}: ${value}`);

  const body = [
    "Send this note back to the person who invited you to test Aretae Sommelier.",
    "",
    "What worked well?",
    "",
    "What felt confusing, slow, or rough?",
    "",
    "Any bugs or weird behavior?",
    "",
    category ? `Category: ${category}` : "",
    `Page: ${page}`,
    source ? `Source: ${source}` : "",
    userMessage ? `Prompt: ${userMessage}` : "",
    assistantMessage ? `Sommelier reply: ${assistantMessage}` : "",
    ...detailLines,
  ]
    .filter(Boolean)
    .join("\n");

  return `mailto:${encodeURIComponent(FEEDBACK_RECIPIENT)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
