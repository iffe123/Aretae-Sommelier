"use client";

import { useMemo, useState } from "react";
import { Wine } from "@/types/wine";
import {
  getDrinkingWindowInfo,
  getWinesByDrinkingStatus,
  DrinkingStatus,
} from "@/lib/drinkingWindow";
import { Wine as WineIcon, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

interface DrinkingWindowListProps {
  wines: Wine[];
}

const STATUS_CONFIG: Record<
  DrinkingStatus,
  { label: string; emoji: string; description: string }
> = {
  ready: {
    label: "Ready Now",
    emoji: "🟢",
    description: "Wines in their drinking window",
  },
  "approaching-peak": {
    label: "At Peak",
    emoji: "🟡",
    description: "Wines at or near their peak",
  },
  "past-peak": {
    label: "Past Peak",
    emoji: "🔴",
    description: "Wines past their optimal window",
  },
  aging: {
    label: "Still Aging",
    emoji: "⏳",
    description: "Wines that need more time",
  },
};

const STATUS_ORDER: DrinkingStatus[] = [
  "ready",
  "approaching-peak",
  "past-peak",
  "aging",
];

interface WineItemProps {
  wine: Wine;
}

function WineItem({ wine }: WineItemProps) {
  const windowInfo = getDrinkingWindowInfo(wine);

  return (
    <Link
      href={`/cellar/${wine.id}`}
      className="block bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-wine-100 rounded flex items-center justify-center flex-shrink-0">
          <WineIcon className="w-4 h-4 text-wine-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {wine.vintage} {wine.name}
          </p>
          <p className="text-sm text-gray-500 truncate">{wine.winery}</p>
          <p className="text-xs text-gray-400 mt-1">
            Drink: {windowInfo.start} - {windowInfo.end}
            {windowInfo.status === "approaching-peak" &&
              ` (Peak: ${windowInfo.peak})`}
          </p>
        </div>
      </div>
    </Link>
  );
}

interface StatusSectionProps {
  status: DrinkingStatus;
  wines: Wine[];
}

function StatusSection({ status, wines }: StatusSectionProps) {
  const [isExpanded, setIsExpanded] = useState(status === "ready" || status === "approaching-peak");
  const config = STATUS_CONFIG[status];

  if (wines.length === 0) return null;

  const displayWines = isExpanded ? wines : wines.slice(0, 3);

  return (
    <div className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.emoji}</span>
          <span className="font-medium text-gray-900">{config.label}</span>
          <span className="text-sm text-gray-400">({wines.length})</span>
        </div>
        {wines.length > 3 && (
          isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )
        )}
      </button>

      <div className="space-y-2 mt-2">
        {displayWines.map((wine) => (
          <WineItem key={wine.id} wine={wine} />
        ))}
        {!isExpanded && wines.length > 3 && (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full text-center text-sm text-wine-600 hover:text-wine-700 py-2"
          >
            Show {wines.length - 3} more...
          </button>
        )}
      </div>
    </div>
  );
}

export default function DrinkingWindowList({ wines }: DrinkingWindowListProps) {
  const winesByStatus = useMemo(
    () => getWinesByDrinkingStatus(wines),
    [wines]
  );

  const hasAnyWines = wines.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🍷</span>
        <h3 className="font-semibold text-gray-900">Drinking Windows</h3>
      </div>

      {!hasAnyWines ? (
        <div className="py-8 text-center text-gray-400">
          Add wines to see drinking recommendations
        </div>
      ) : (
        <div className="space-y-4">
          {STATUS_ORDER.map((status) => (
            <StatusSection
              key={status}
              status={status}
              wines={winesByStatus[status]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DrinkingWindowListSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 bg-gray-200 rounded" />
        <div className="h-5 w-36 bg-gray-200 rounded" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-200 rounded" />
              <div className="h-5 w-24 bg-gray-200 rounded" />
            </div>
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-gray-200 rounded" />
                  <div className="h-3 w-1/2 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
