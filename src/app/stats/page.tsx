"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Wine } from "@/types/wine";
import { getUserWines } from "@/lib/wine-service";
import StatCard, { StatCardSkeleton } from "@/components/stats/StatCard";
import CollectionChart, {
  CollectionChartSkeleton,
} from "@/components/stats/CollectionChart";
import RatingDistribution, {
  RatingDistributionSkeleton,
} from "@/components/stats/RatingDistribution";
import DrinkingWindowList, {
  DrinkingWindowListSkeleton,
} from "@/components/stats/DrinkingWindowList";
import {
  Wine as WineIcon,
  Grape,
  DollarSign,
  Star,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export default function StatsPage() {
  const { user, loading: authLoading, checkingRedirect } = useAuth();
  const router = useRouter();

  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for BOTH auth loading AND redirect check to complete
    if (!authLoading && !checkingRedirect && !user) {
      router.push("/signin");
    }
  }, [user, authLoading, checkingRedirect, router]);

  useEffect(() => {
    async function loadWines() {
      if (!user) return;
      setLoading(true);
      try {
        const data = await getUserWines(user.uid, {});
        setWines(data);
      } catch (error) {
        console.error("Error loading wines:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadWines();
    }
  }, [user]);

  // Calculate stats
  const stats = useMemo(() => {
    const cellarWines = wines.filter((w) => !w.isWishlist);

    const totalBottles = cellarWines.reduce(
      (sum, wine) => sum + (wine.bottlesOwned || 0),
      0
    );

    const uniqueWines = cellarWines.length;

    const estimatedValue = cellarWines.reduce(
      (sum, wine) => sum + (wine.price || 0) * (wine.bottlesOwned || 0),
      0
    );

    const ratedWines = cellarWines.filter((w) => w.rating && w.rating > 0);
    const averageRating =
      ratedWines.length > 0
        ? ratedWines.reduce((sum, w) => sum + (w.rating || 0), 0) /
          ratedWines.length
        : 0;

    return {
      totalBottles,
      uniqueWines,
      estimatedValue,
      averageRating,
    };
  }, [wines]);

  // Filter to only cellar wines (not wishlist) for charts
  const cellarWines = useMemo(
    () => wines.filter((w) => !w.isWishlist),
    [wines]
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: "SEK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value).replace("SEK", "kr");
  };

  const formatRating = (rating: number) => {
    if (rating === 0) return "-";
    return rating.toFixed(1);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/cellar"
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-wine-100 rounded-full flex items-center justify-center">
                <WineIcon className="w-5 h-5 text-wine-600" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900">Cellar Stats</h1>
                <p className="text-xs text-gray-500">
                  Insights into your collection
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Overview Stats */}
        <section className="mb-8">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Bottles"
                value={stats.totalBottles}
                icon={<WineIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
                subtitle="in your cellar"
              />
              <StatCard
                title="Unique Wines"
                value={stats.uniqueWines}
                icon={<Grape className="w-5 h-5 sm:w-6 sm:h-6" />}
                subtitle="different wines"
              />
              <StatCard
                title="Estimated Value"
                value={formatCurrency(stats.estimatedValue)}
                icon={<DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />}
                subtitle="total collection value"
              />
              <StatCard
                title="Average Rating"
                value={formatRating(stats.averageRating)}
                icon={
                  <Star className="w-5 h-5 sm:w-6 sm:h-6 fill-current text-amber-400" />
                }
                subtitle={
                  stats.averageRating > 0
                    ? `out of 5 stars`
                    : "no ratings yet"
                }
              />
            </div>
          )}
        </section>

        {/* Charts Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Collection Breakdown
          </h2>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CollectionChartSkeleton />
              <CollectionChartSkeleton />
              <CollectionChartSkeleton />
              <RatingDistributionSkeleton />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CollectionChart
                wines={cellarWines}
                groupBy="country"
                title="By Country"
                icon="🌍"
              />
              <CollectionChart
                wines={cellarWines}
                groupBy="grapeVariety"
                title="By Grape Variety"
                icon="🍇"
              />
              <CollectionChart
                wines={cellarWines}
                groupBy="region"
                title="By Region"
                icon="📍"
              />
              <RatingDistribution wines={cellarWines} />
            </div>
          )}
        </section>

        {/* Drinking Windows Section */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Drinking Windows
          </h2>
          {loading ? (
            <DrinkingWindowListSkeleton />
          ) : (
            <DrinkingWindowList wines={cellarWines} />
          )}
        </section>

        {/* Empty State */}
        {!loading && cellarWines.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-wine-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <WineIcon className="w-8 h-8 text-wine-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No wines in your cellar yet
            </h3>
            <p className="text-gray-500 mb-4">
              Add some wines to see your collection statistics
            </p>
            <Link
              href="/cellar"
              className="inline-flex items-center px-4 py-2 bg-wine-600 text-white rounded-lg hover:bg-wine-700 transition-colors"
            >
              Go to Cellar
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
