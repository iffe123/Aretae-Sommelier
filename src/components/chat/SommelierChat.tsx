"use client";

import { useState, useRef, useEffect } from "react";
import { Wine } from "@/types/wine";
import { chatWithSommelier, CellarData, CellarWineSummary } from "@/lib/gemini";
import { getUserWines } from "@/lib/wine-service";
import { useAuth } from "@/contexts/AuthContext";
import { buildFeedbackMailto } from "@/lib/feedback";
import Button from "@/components/ui/Button";
import { Send, Wine as WineIcon, Bot, User, X, Mail, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "model";
  content: string;
}

interface SommelierChatProps {
  wineContext?: Wine;
  isOpen: boolean;
  onClose: () => void;
}

const SUGGESTED_PROMPTS = [
  "What food would be amazing with this?",
  "How should I serve this wine?",
  "Does this need decanting?",
  "When's the perfect time to drink this?",
  "What else would I love if I like this?",
];

const GENERAL_PROMPTS = [
  "What wine would blow my mind with a steak?",
  "Old World vs New World - what's the deal?",
  "I'm new to wine - where do I start?",
  "Help me decode wine labels!",
  "Teach me to taste like a pro!",
];

const CELLAR_PROMPTS = [
  "What should I open with pasta tonight?",
  "What gems do I have from France?",
  "What wine should I drink soon before it's too late?",
  "Pick a crowd-pleaser from my cellar!",
  "What are my best bottles based on my ratings?",
];

const MAX_CELLAR_WINES = 50;

function formatCellarData(wines: Wine[]): CellarData {
  // Limit to most recent wines to avoid token limits
  const limitedWines = wines.slice(0, MAX_CELLAR_WINES);

  const cellarWines: CellarWineSummary[] = limitedWines.map((wine) => ({
    name: wine.name,
    winery: wine.winery,
    vintage: wine.vintage,
    grapeVariety: wine.grapeVariety,
    region: wine.region,
    country: wine.country,
    price: wine.price ?? undefined,
    rating: wine.rating ?? undefined,
    quantity: wine.bottlesOwned ?? undefined,
    storageLocation: wine.storageLocation ?? undefined,
    wineType: wine.wineType ?? undefined,
    classification: wine.classification ?? undefined,
  }));

  const totalBottles = wines.reduce((sum, wine) => sum + (wine.bottlesOwned || 0), 0);
  const totalValue = wines.reduce((sum, wine) => sum + ((wine.price || 0) * (wine.bottlesOwned || 1)), 0);

  return {
    wines: cellarWines,
    totalBottles,
    totalValue,
  };
}

export default function SommelierChat({
  wineContext,
  isOpen,
  onClose,
}: SommelierChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [cellarData, setCellarData] = useState<CellarData | null>(null);
  const [cellarLoading, setCellarLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const cellarFetchedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else if (isVisible) {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isVisible]);

  // Fetch cellar data when chat opens (only once per session)
  useEffect(() => {
    const fetchCellarData = async () => {
      if (!isOpen || !user?.uid || cellarFetchedRef.current || cellarLoading) {
        return;
      }

      cellarFetchedRef.current = true;
      setCellarLoading(true);

      try {
        // Fetch wines sorted by most recently added
        const wines = await getUserWines(user.uid, {
          sortBy: "createdAt",
          sortOrder: "desc",
          isWishlist: false, // Only include wines in cellar, not wishlist
        });
        const formattedData = formatCellarData(wines);
        setCellarData(formattedData);
      } catch (error) {
        console.error("Failed to fetch cellar data:", error);
        // Continue without cellar data - chat still works
      } finally {
        setCellarLoading(false);
      }
    };

    fetchCellarData();
  }, [isOpen, user?.uid, cellarLoading]);

  // Clear messages when wine context changes to start fresh conversation
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [wineContext?.id]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMessage: Message = { role: "user", content };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const getChatResponse = async (forceRefreshToken = false) => {
        const idToken = user ? await user.getIdToken(forceRefreshToken) : undefined;
        return chatWithSommelier(
          content,
          wineContext,
          messages,
          cellarData || undefined,
          idToken
        );
      };

      let response: string;
      try {
        response = await getChatResponse();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "";
        const shouldRetryWithFreshToken =
          !!user &&
          errorMessage.toLowerCase().includes("invalid or expired token");

        if (!shouldRetryWithFreshToken) {
          throw error;
        }

        response = await getChatResponse(true);
      }

      const assistantMessage: Message = { role: "model", content: response };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorText = error instanceof Error ? error.message.toLowerCase() : "";
      const userFacingMessage =
        errorText.includes("invalid or expired token")
          ? "Your session expired. Please sign out and sign in again."
          : errorText.includes("server auth configuration error")
            ? "Server auth is misconfigured (Firebase Admin key). Please verify Vercel environment variables."
            : "I apologize, but I'm having trouble connecting right now. Please try again in a moment.";

      const errorMessage: Message = {
        role: "model",
        content: userFacingMessage,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Use cellar-specific prompts when user has wines in their cellar
  const suggestedPrompts = wineContext
    ? SUGGESTED_PROMPTS
    : (cellarData && cellarData.wines.length > 0)
      ? CELLAR_PROMPTS
      : GENERAL_PROMPTS;

  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "model");

  const handleSendFeedback = () => {
    const href = buildFeedbackMailto({
      title: wineContext ? `Sommelier feedback for ${wineContext.name}` : "Sommelier feedback",
      page: wineContext ? `Sommelier chat - ${wineContext.name}` : "Sommelier chat",
      source: typeof window !== "undefined" ? window.location.href : "/cellar",
      userMessage: latestUserMessage?.content,
      assistantMessage: latestAssistantMessage?.content,
    });

    window.location.href = href;
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm sm:hidden transition-opacity duration-300 ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#fcfaf8] sm:inset-auto sm:right-4 sm:bottom-4 sm:h-[640px] sm:w-[420px] sm:rounded-[28px] sm:border sm:border-white/70 sm:shadow-[0_30px_90px_-40px_rgba(77,20,30,0.65)] transition-all duration-300 ease-out ${
          isAnimating
            ? "translate-y-0 sm:translate-y-0 sm:scale-100 opacity-100"
            : "translate-y-full sm:translate-y-4 sm:scale-95 opacity-0"
        }`}
      >
      {/* Header */}
      <div className="relative border-b border-white/20 bg-[linear-gradient(135deg,#722734_0%,#8f3946_52%,#b66b61_100%)] px-5 py-4 text-white sm:rounded-t-[28px]">
        <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-white/12 blur-2xl" />
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Sommelier</h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.2em] text-white/80">
                <Sparkles className="h-3 w-3" />
                Live
              </span>
            </div>
            <p className="mt-1 text-xs text-wine-100/90">
              {wineContext
                ? `Discussing: ${wineContext.name}`
                : cellarLoading
                  ? "Loading your cellar..."
                  : cellarData && cellarData.wines.length > 0
                    ? `Knows your ${cellarData.wines.length} wines`
                    : "Your wine expert"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSendFeedback}
            className="hidden rounded-full border border-white/20 bg-white/10 p-2 transition-colors hover:bg-white/15 sm:block"
            aria-label="Send feedback about sommelier"
            title="Send feedback"
          >
            <Mail className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-white/12 sm:right-3 sm:top-3"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,#fff3ec_0%,#fcfaf8_42%,#f7f3f1_100%)] p-4 space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white shadow-sm ring-1 ring-wine-100">
              <WineIcon className="w-8 h-8 text-wine-500" />
            </div>
            <h4 className="mb-2 font-medium text-gray-900">
              {wineContext
                ? `Let's talk about ${wineContext.name}!`
                : "Hey, Wine Friend!"}
            </h4>
            <p className="mb-6 max-w-sm text-sm leading-6 text-gray-600">
              {wineContext
                ? "Ooh, great choice! I'd love to help with pairings, serving tips, or anything about this wine."
                : cellarData && cellarData.wines.length > 0
                  ? `I know your cellar of ${cellarData.wines.length} wines (${cellarData.totalBottles} bottles) and your taste! Let's find your next perfect pour.`
                  : "I'm a total wine nerd and I'd love to chat about pairings, regions, hidden gems, or whatever's on your mind!"}
            </p>

            <div className="mb-5 grid w-full gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4 text-left shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Knows</p>
                <p className="mt-2 text-sm font-medium text-gray-900">
                  {cellarData && cellarData.wines.length > 0
                    ? `Your recent ${Math.min(cellarData.wines.length, MAX_CELLAR_WINES)} wines`
                    : "Food pairings, serving tips, and buying advice"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4 text-left shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Best use</p>
                <p className="mt-2 text-sm font-medium text-gray-900">
                  Ask a specific dinner, bottle, grape, or region question for sharper answers.
                </p>
              </div>
            </div>

            <div className="w-full space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-gray-400">
                Try asking
              </p>
              {suggestedPrompts.slice(0, 3).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="w-full rounded-2xl border border-white/80 bg-white/85 p-3 text-left text-sm text-gray-700 shadow-sm transition-colors hover:bg-white"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl ${
                    message.role === "user" ? "bg-wine-100" : "bg-white ring-1 ring-wine-100"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="w-4 h-4 text-wine-600" />
                  ) : (
                    <Bot className="w-4 h-4 text-gray-600" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    message.role === "user"
                      ? "rounded-tr-none bg-[linear-gradient(135deg,#7c2c39_0%,#984453_100%)] text-white shadow-sm"
                      : "rounded-tl-none border border-rose-100/70 bg-white/95 text-gray-800 shadow-sm"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white ring-1 ring-wine-100">
                  <Bot className="w-4 h-4 text-gray-600" />
                </div>
                <div className="rounded-2xl rounded-tl-none border border-rose-100/70 bg-white/95 p-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-wine-100/70 bg-white/80 p-4 backdrop-blur sm:rounded-b-[28px]"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your sommelier..."
            className="flex-1 rounded-full border border-wine-100 bg-white px-4 py-2 shadow-inner shadow-wine-50/40 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-wine-500"
            disabled={loading}
            aria-label="Message to sommelier"
          />
          <Button
            type="submit"
            disabled={!input.trim() || loading}
            className="rounded-full px-4"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-3 flex items-center justify-between px-1 text-xs text-gray-500">
          <p>Spot a weird reply or rough edge? Send it with one tap.</p>
          <button
            type="button"
            onClick={handleSendFeedback}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-wine-700 transition-colors hover:bg-wine-50"
          >
            <Mail className="h-3.5 w-3.5" />
            Send feedback
          </button>
        </div>
      </form>
      </div>
    </>
  );
}
