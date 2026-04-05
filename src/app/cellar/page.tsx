"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Wine, WineFilterOptions } from "@/types/wine";
import { getUserWines, getUniqueValues } from "@/lib/wine-service";
import WineList from "@/components/wine/WineList";
import WineFilters from "@/components/wine/WineFilters";
import WineForm from "@/components/wine/WineForm";
import Modal from "@/components/ui/Modal";
import SommelierChat from "@/components/chat/SommelierChat";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import NetworkStatus from "@/components/ui/NetworkStatus";
import { addWine } from "@/lib/wine-service";
import { getFirestoreErrorMessage } from "@/lib/error-utils";
import { openFeedbackDraft } from "@/lib/feedback-client";
import {
  Wine as WineIcon,
  Plus,
  MessageCircle,
  LogOut,
  User,
  BarChart3,
  ListChecks,
  X,
  Utensils,
  Sparkles,
  Mail,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";

export default function CellarPage() {
  const { user, loading: authLoading, checkingRedirect, signOut } = useAuth();
  const router = useRouter();
  const { toasts, removeToast, showError, showSuccess } = useToast();

  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<WineFilterOptions>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Wine menu selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedWines, setSelectedWines] = useState<Wine[]>([]);

  const [grapeVarieties, setGrapeVarieties] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [storageLocations, setStorageLocations] = useState<string[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Use ref for showError to avoid it in useCallback dependencies
  const showErrorRef = useRef(showError);
  useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);

  const loadWines = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getUserWines(user.uid, filters);
      setWines(data);
    } catch (error) {
      console.error("Error loading wines:", error);
      showErrorRef.current(getFirestoreErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  const loadFilterOptions = useCallback(async () => {
    if (!user) return;
    try {
      const [grapes, ctries, rgns, storageLocs] = await Promise.all([
        getUniqueValues(user.uid, "grapeVariety"),
        getUniqueValues(user.uid, "country"),
        getUniqueValues(user.uid, "region"),
        getUniqueValues(user.uid, "storageLocation"),
      ]);
      setGrapeVarieties(grapes);
      setCountries(ctries);
      setRegions(rgns);
      setStorageLocations(storageLocs);
    } catch (error) {
      console.error("Error loading filter options:", error);
      // Don't show toast for filter loading errors - not critical
    }
  }, [user]);

  useEffect(() => {
    // Wait for BOTH auth loading AND redirect check to complete
    if (!authLoading && !checkingRedirect && !user) {
      router.push("/signin");
    }
  }, [user, authLoading, checkingRedirect, router]);

  useEffect(() => {
    if (user) {
      loadWines();
      loadFilterOptions();
    }
  }, [user, loadWines, loadFilterOptions]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleAddWine = async (data: Parameters<typeof addWine>[1]) => {
    if (!user) return;
    // Note: errors are handled in the form, just re-throw for form display
    await addWine(user.uid, data);
    setShowAddModal(false);
    showSuccess("Wine added to your cellar!");
    loadWines();
    loadFilterOptions();
  };

  // Wine menu selection handlers
  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedWines([]);
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const toggleWineSelection = (wine: Wine) => {
    setSelectedWines((prev) => {
      const isSelected = prev.some((w) => w.id === wine.id);
      if (isSelected) {
        return prev.filter((w) => w.id !== wine.id);
      } else {
        return [...prev, wine];
      }
    });
  };

  const handleCreateMenu = () => {
    // Store selected wines in sessionStorage for the share-menu page
    sessionStorage.setItem("menuWines", JSON.stringify(selectedWines));
    router.push("/share-menu");
  };

  const handleSendFeedback = () => {
    setShowUserMenu(false);

    openFeedbackDraft({
      title: "Cellar beta feedback",
      page: "Cellar dashboard",
      category: "cellar",
      details: {
        wine_count: wines.length,
        selection_mode: isSelectionMode,
        selected_wines: selectedWines.length,
      },
    });
  };

  if (authLoading || checkingRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wine-50">
        <div className="animate-pulse">
          <WineIcon className="w-12 h-12 text-wine-400" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = user.displayName || "Wine Lover";
  const firstName = displayName.split(" ")[0];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fcfaf9_0%,#f5f1ef_48%,#f3f4f6_100%)]">
      {/* Network Status Banner */}
      <NetworkStatus />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-wine-100 to-rose-100 shadow-sm">
                <WineIcon className="w-5 h-5 text-wine-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-gray-900">My Cellar</h1>
                  <span className="inline-flex items-center gap-1 rounded-full border border-wine-200 bg-wine-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-wine-700">
                    <Sparkles className="h-3 w-3" />
                    Live Beta
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {wines.length} wine{wines.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Wine Menu Selection Toggle */}
              <button
                onClick={toggleSelectionMode}
                className={`p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-wine-500 relative ${
                  isSelectionMode
                    ? "bg-wine-100 text-wine-600"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
                aria-label={isSelectionMode ? "Exit selection mode" : "Select wines for dinner menu"}
              >
                {isSelectionMode ? (
                  <X className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <ListChecks className="w-5 h-5" aria-hidden="true" />
                )}
                {selectedWines.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-wine-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {selectedWines.length}
                  </span>
                )}
              </button>
              <Link
                href="/stats"
                className="p-2 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-wine-500"
                aria-label="View collection statistics"
              >
                <BarChart3 className="w-5 h-5 text-gray-600" aria-hidden="true" />
              </Link>
              <button
                onClick={() => setShowChat(true)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-wine-500"
                aria-label="Open AI Sommelier chat"
              >
                <MessageCircle className="w-5 h-5 text-gray-600" aria-hidden="true" />
              </button>
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setShowUserMenu((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-wine-500"
                  aria-label="User menu"
                  aria-haspopup="true"
                  aria-expanded={showUserMenu}
                >
                  <User className="h-4 w-4 text-gray-600" aria-hidden="true" />
                  <span className="hidden max-w-24 truncate sm:block">{firstName}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${showUserMenu ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/stats"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-2 p-3 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <BarChart3 className="h-4 w-4" />
                    View stats
                  </Link>
                  <button
                    onClick={handleSendFeedback}
                    className="flex w-full items-center gap-2 p-3 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <Mail className="h-4 w-4" />
                    Send feedback
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2 p-3 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <section className="relative mb-6 overflow-hidden rounded-[28px] border border-wine-200/70 bg-[linear-gradient(135deg,#fff7f1_0%,#fce7de_42%,#f5d8d7_100%)] p-6 shadow-[0_24px_60px_-36px_rgba(115,32,46,0.55)]">
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/35 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-28 w-28 rounded-full bg-wine-200/30 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-wine-800 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Friends & Family Tasting Room
              </span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
                {wines.length > 0
                  ? `${firstName}, your cellar is ready for tonight's pour.`
                  : `${firstName}, let's get your first bottles into the cellar.`}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-gray-700 sm:text-base">
                This launch build is tuned for real-world testing: add a bottle, ask the sommelier something fun, and send over any rough edges your friends spot.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={() => setShowChat(true)} className="rounded-full px-5">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Ask The Sommelier
                </Button>
                <Button onClick={() => setShowAddModal(true)} variant="outline" className="rounded-full border-white/80 bg-white/55 px-5 backdrop-blur">
                  <Plus className="mr-2 h-4 w-4" />
                  Add A Bottle
                </Button>
                <Button onClick={handleSendFeedback} variant="ghost" className="rounded-full bg-white/35 px-5 text-gray-800 hover:bg-white/60">
                  <Mail className="mr-2 h-4 w-4" />
                  Send Feedback
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
              <div className="rounded-2xl border border-white/70 bg-white/55 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Sommelier</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">Live</p>
                <p className="mt-1 text-sm text-gray-600">Ask for pairings, serving tips, and bottle picks.</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/55 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Collection</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{wines.length}</p>
                <p className="mt-1 text-sm text-gray-600">Wine{wines.length !== 1 ? "s" : ""} ready to search, rate, and share.</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/55 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Goal</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">First delight</p>
                <p className="mt-1 text-sm text-gray-600">Make every first bottle and first question feel smooth.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Filters */}
        <div className="mb-6">
          <WineFilters
            filters={filters}
            onFilterChange={setFilters}
            grapeVarieties={grapeVarieties}
            countries={countries}
            regions={regions}
            storageLocations={storageLocations}
          />
        </div>

        {/* Selection Mode Banner */}
        {isSelectionMode && (
          <div className="mb-4 bg-wine-50 border border-wine-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ListChecks className="w-5 h-5 text-wine-600" />
              <div>
                <p className="font-medium text-wine-900">
                  {selectedWines.length === 0
                    ? "Select wines for your dinner menu"
                    : `${selectedWines.length} wine${selectedWines.length !== 1 ? "s" : ""} selected`}
                </p>
                <p className="text-sm text-wine-600">
                  Tap on wines to select them
                </p>
              </div>
            </div>
            {selectedWines.length > 0 && (
              <button
                onClick={handleCreateMenu}
                className="flex items-center gap-2 bg-wine-600 hover:bg-wine-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <Utensils className="w-4 h-4" />
                Create Menu
              </button>
            )}
          </div>
        )}

        {/* Wine List */}
        <WineList
          wines={wines}
          loading={loading}
          emptyMessage="Your cellar is empty"
          isFilterActive={!!(filters.search || filters.wineType || filters.grapeVariety || filters.country || filters.region || filters.storageLocation)}
          onAddWine={() => setShowAddModal(true)}
          onClearFilters={() => setFilters({})}
          isSelectionMode={isSelectionMode}
          selectedWineIds={selectedWines.map((w) => w.id)}
          onToggleSelect={toggleWineSelection}
        />
      </main>

      {/* FAB - Add Wine */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-wine-600 hover:bg-wine-700 text-white rounded-full shadow-lg flex items-center justify-center z-30 focus:outline-none focus:ring-2 focus:ring-wine-500 focus:ring-offset-2 fab-animated"
        aria-label="Add new wine"
      >
        <Plus className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* Add Wine Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Wine"
      >
        <div className="max-h-[70vh] overflow-y-auto -mx-6 px-6">
          <WineForm
            onSubmit={handleAddWine}
            onCancel={() => setShowAddModal(false)}
          />
        </div>
      </Modal>

      {/* Sommelier Chat */}
      <SommelierChat isOpen={showChat} onClose={() => setShowChat(false)} />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
