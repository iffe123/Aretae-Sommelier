"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Wine } from "@/types/wine";
import { Star } from "lucide-react";

interface RatingDistributionProps {
  wines: Wine[];
}

const RATING_COLORS = {
  1: "#f87171", // red-400
  2: "#fb923c", // orange-400
  3: "#facc15", // yellow-400
  4: "#a3e635", // lime-400
  5: "#4ade80", // green-400
};

export default function RatingDistribution({ wines }: RatingDistributionProps) {
  const data = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    wines.forEach((wine) => {
      if (wine.rating && wine.rating >= 1 && wine.rating <= 5) {
        counts[Math.floor(wine.rating)] = (counts[Math.floor(wine.rating)] || 0) + 1;
      }
    });

    return [1, 2, 3, 4, 5].map((rating) => ({
      rating: `${rating}★`,
      count: counts[rating],
      stars: rating,
    }));
  }, [wines]);

  const ratedWines = wines.filter((w) => w.rating && w.rating >= 1).length;

  if (ratedWines === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-gray-900">Rating Distribution</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-gray-400">
          No rated wines yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
        <h3 className="font-semibold text-gray-900">Rating Distribution</h3>
      </div>

      <div className="h-48 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20 }}>
            <XAxis type="number" allowDecimals={false} />
            <YAxis
              dataKey="rating"
              type="category"
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              formatter={(value: number) => [
                `${value} wine${value !== 1 ? "s" : ""}`,
                "Count",
              ]}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "8px 12px",
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell
                  key={`cell-${entry.stars}`}
                  fill={RATING_COLORS[entry.stars as keyof typeof RATING_COLORS]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-gray-400 text-center mt-2">
        {ratedWines} of {wines.length} wines rated
      </p>
    </div>
  );
}

const SKELETON_WIDTHS = ["60%", "40%", "80%", "30%", "50%"];

export function RatingDistributionSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 bg-gray-200 rounded" />
        <div className="h-5 w-36 bg-gray-200 rounded" />
      </div>
      <div className="h-48 sm:h-56 flex flex-col gap-4 justify-center">
        {SKELETON_WIDTHS.map((width, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-8 h-4 bg-gray-200 rounded" />
            <div
              className="h-6 bg-gray-200 rounded"
              style={{ width }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
