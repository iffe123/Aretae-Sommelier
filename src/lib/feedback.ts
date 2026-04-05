interface FeedbackMailtoOptions {
  title: string;
  page: string;
  source?: string;
  userMessage?: string;
  assistantMessage?: string;
}

export function buildFeedbackMailto({
  title,
  page,
  source,
  userMessage,
  assistantMessage,
}: FeedbackMailtoOptions): string {
  const subject = `${title} - Aretae Sommelier`;
  const body = [
    "Send this note back to the person who invited you to test Aretae Sommelier.",
    "",
    "What worked well?",
    "",
    "What felt confusing, slow, or rough?",
    "",
    "Any bugs or weird behavior?",
    "",
    `Page: ${page}`,
    source ? `Source: ${source}` : "",
    userMessage ? `Prompt: ${userMessage}` : "",
    assistantMessage ? `Sommelier reply: ${assistantMessage}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
