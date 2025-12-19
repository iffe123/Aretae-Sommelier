"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Wine } from "@/types/wine";
import { chatWithSommelier, CellarData, CellarWineSummary } from "@/lib/gemini";
import { getUserWines } from "@/lib/wine-service";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { Send, Wine as WineIcon, Bot, User, X } from "lucide-react";

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
  "What foods pair well with this wine?",
  "What temperature should I serve this at?",
  "Should I decant this wine?",
  "How long can I cellar this wine?",
  "Recommend similar wines to try",
];

const GENERAL_PROMPTS = [
  "What wine pairs with steak?",
  "Explain the difference between Old World and New World wines",
  "What's a good wine for beginners?",
  "How do I read a wine label?",
  "What's the proper way to taste wine?",
];

const CELLAR_PROMPTS = [
  "What wine from my cellar pairs with pasta?",
  "What wines do I have from France?",
  "Which of my wines should I drink soon?",
  "What's a good red from my collection for guests?",
  "Show me my best rated wines",
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
      const response = await chatWithSommelier(
        content,
        wineContext,
        messages,
        cellarData || undefined
      );
      const assistantMessage: Message = { role: "model", content: response };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        role: "model",
        content:
          "I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:right-4 sm:bottom-4 sm:w-96 sm:h-[600px] sm:rounded-2xl sm:shadow-2xl sm:border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-wine-600 text-white sm:rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-wine-500 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold">Sommelier</h3>
            <p className="text-xs text-wine-200">
              {wineContext
                ? `Discussing: ${wineContext.name}`
                : cellarLoading
                  ? "Loading your cellar..."
                  : cellarData && cellarData.wines.length > 0
                    ? `Knows your ${cellarData.wines.length} wines`
                    : "Your wine expert"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-wine-500 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="w-16 h-16 bg-wine-100 rounded-full flex items-center justify-center mb-4">
              <WineIcon className="w-8 h-8 text-wine-500" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">
              {wineContext
                ? `Ask about ${wineContext.name}`
                : "Your Personal Sommelier"}
            </h4>
            <p className="text-sm text-gray-500 mb-6">
              {wineContext
                ? "I can help with pairings, serving tips, and more for this wine."
                : cellarData && cellarData.wines.length > 0
                  ? `I have access to your cellar of ${cellarData.wines.length} wines (${cellarData.totalBottles} bottles). Ask me for recommendations from your collection!`
                  : "Ask me anything about wine - pairings, regions, techniques, and recommendations."}
            </p>

            <div className="w-full space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Try asking
              </p>
              {suggestedPrompts.slice(0, 3).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="w-full text-left text-sm p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === "user" ? "bg-wine-100" : "bg-gray-100"
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
                      ? "bg-wine-600 text-white rounded-tr-none"
                      : "bg-gray-100 text-gray-800 rounded-tl-none"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-gray-600" />
                </div>
                <div className="bg-gray-100 p-3 rounded-2xl rounded-tl-none">
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
        className="p-4 border-t bg-gray-50 sm:rounded-b-2xl"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your sommelier..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-wine-500 focus:border-transparent"
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
      </form>
    </div>
  );
}
