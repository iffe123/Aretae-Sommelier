"use client";

import { useState, useEffect, useCallback } from "react";
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
import NetworkStatus from "@/components/ui/NetworkStatus";
import { addWine } from "@/lib/wine-service";
import { getFirestoreErrorMessage } from "@/lib/error-utils";
import {
  Wine as WineIcon,
  Plus,
  MessageCircle,
  LogOut,
  User,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

export default function CellarPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { toasts, removeToast, showError, showSuccess } = useToast();

  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<WineFilterOptions>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const [grapeVarieties, setGrapeVarieties] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);

  const loadWines = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getUserWines(user.uid, filters);
      setWines(data);
    } catch (error) {
      console.error("Error loading wines:", error);
      showError(getFirestoreErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [user, filters, showError]);

  const loadFilterOptions = useCallback(async () => {
    if (!user) return;
    try {
      const [grapes, ctries, rgns] = await Promise.all([
        getUniqueValues(user.uid, "grapeVariety"),
        getUniqueValues(user.uid, "country"),
        getUniqueValues(user.uid, "region"),
      ]);
      setGrapeVarieties(grapes);
      setCountries(ctries);
      setRegions(rgns);
    } catch (error) {
      console.error("Error loading filter options:", error);
      // Don't show toast for filter loading errors - not critical
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadWines();
      loadFilterOptions();
    }
  }, [user, loadWines, loadFilterOptions]);

  const handleAddWine = async (data: Parameters<typeof addWine>[1]) => {
    if (!user) return;
    // Note: errors are handled in the form, just re-throw for form display
    await addWine(user.uid, data);
    setShowAddModal(false);
    showSuccess("Wine added to your cellar!");
    loadWines();
    loadFilterOptions();
  };

  if (authLoading) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Network Status Banner */}
      <NetworkStatus />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-wine-100 rounded-full flex items-center justify-center">
                <WineIcon className="w-5 h-5 text-wine-600" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900">My Cellar</h1>
                <p className="text-xs text-gray-500">
                  {wines.length} wine{wines.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
              <div className="relative group">
                <button
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-wine-500"
                  aria-label="User menu"
                  aria-haspopup="true"
                >
                  <User className="w-5 h-5 text-gray-600" aria-hidden="true" />
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.displayName || "Wine Lover"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="w-full p-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="mb-6">
          <WineFilters
            filters={filters}
            onFilterChange={setFilters}
            grapeVarieties={grapeVarieties}
            countries={countries}
            regions={regions}
          />
        </div>

        {/* Wine List */}
        <WineList
          wines={wines}
          loading={loading}
          emptyMessage="Your cellar is empty"
          isFilterActive={!!(filters.search || filters.grapeVariety || filters.country || filters.region)}
          onAddWine={() => setShowAddModal(true)}
          onClearFilters={() => setFilters({})}
        />
      </main>

      {/* FAB - Add Wine */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-wine-600 hover:bg-wine-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-30 focus:outline-none focus:ring-2 focus:ring-wine-500 focus:ring-offset-2"
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
