"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Wine } from "@/types/wine";

interface CollectionChartProps {
  wines: Wine[];
  groupBy: "country" | "grapeVariety" | "region";
  title: string;
  icon: string;
}

const COLORS = [
  "#722f37", // wine-600
  "#df4872", // wine-500
  "#ec7696", // wine-400
  "#f4a9bc", // wine-300
  "#f9d0da", // wine-200
  "#9ca3af", // gray-400 for "Other"
];

export default function CollectionChart({
  wines,
  groupBy,
  title,
  icon,
}: CollectionChartProps) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};

    wines.forEach((wine) => {
      const key = wine[groupBy] || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });

    // Sort by count and take top 5
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    if (sorted.length <= 6) {
      return sorted;
    }

    // Top 5 + "Other"
    const top5 = sorted.slice(0, 5);
    const otherCount = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);

    return [...top5, { name: "Other", value: otherCount }];
  }, [wines, groupBy]);

  const total = wines.length;

  if (wines.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">{icon}</span>
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="h-48 flex items-center justify-center text-gray-400">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{icon}</span>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>

      <div className="h-48 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              label={({ percent }) =>
                percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""
              }
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [
                `${value} wine${value !== 1 ? "s" : ""} (${((value / total) * 100).toFixed(1)}%)`,
                "",
              ]}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "8px 12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 justify-center">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-gray-600 truncate max-w-[100px]">
              {item.name}
            </span>
            <span className="text-gray-400">({item.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CollectionChartSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 bg-gray-200 rounded" />
        <div className="h-5 w-32 bg-gray-200 rounded" />
      </div>
      <div className="h-48 sm:h-56 flex items-center justify-center">
        <div className="w-36 h-36 bg-gray-200 rounded-full" />
      </div>
      <div className="mt-4 flex flex-wrap gap-4 justify-center">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-20 bg-gray-200 rounded" />
        ))}
      </div>
    </div>
  );
}
