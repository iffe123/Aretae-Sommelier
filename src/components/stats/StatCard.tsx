"use client";

import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
  className?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  subtitle,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-wine-50 rounded-lg flex items-center justify-center text-wine-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

interface StatCardSkeletonProps {
  className?: string;
}

export function StatCardSkeleton({ className = "" }: StatCardSkeletonProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-pulse ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-8 w-16 bg-gray-200 rounded mt-2" />
        </div>
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}
