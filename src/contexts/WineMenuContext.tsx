"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { Wine } from "@/types/wine";

interface WineMenuContextType {
  selectedWines: Wine[];
  isSelectionMode: boolean;
  toggleSelectionMode: () => void;
  toggleWineSelection: (wine: Wine) => void;
  isWineSelected: (wineId: string) => boolean;
  clearSelection: () => void;
  menuTitle: string;
  setMenuTitle: (title: string) => void;
  menuGreeting: string;
  setMenuGreeting: (greeting: string) => void;
}

const WineMenuContext = createContext<WineMenuContextType | undefined>(undefined);

export function WineMenuProvider({ children }: { children: ReactNode }) {
  const [selectedWines, setSelectedWines] = useState<Wine[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [menuTitle, setMenuTitle] = useState("Kvällens viner");
  const [menuGreeting, setMenuGreeting] = useState("");

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) {
        // Clearing selection when exiting selection mode
        setSelectedWines([]);
      }
      return !prev;
    });
  }, []);

  const toggleWineSelection = useCallback((wine: Wine) => {
    setSelectedWines((prev) => {
      const isSelected = prev.some((w) => w.id === wine.id);
      if (isSelected) {
        return prev.filter((w) => w.id !== wine.id);
      } else {
        return [...prev, wine];
      }
    });
  }, []);

  const isWineSelected = useCallback(
    (wineId: string) => selectedWines.some((w) => w.id === wineId),
    [selectedWines]
  );

  const clearSelection = useCallback(() => {
    setSelectedWines([]);
    setIsSelectionMode(false);
  }, []);

  return (
    <WineMenuContext.Provider
      value={{
        selectedWines,
        isSelectionMode,
        toggleSelectionMode,
        toggleWineSelection,
        isWineSelected,
        clearSelection,
        menuTitle,
        setMenuTitle,
        menuGreeting,
        setMenuGreeting,
      }}
    >
      {children}
    </WineMenuContext.Provider>
  );
}

export function useWineMenu() {
  const context = useContext(WineMenuContext);
  if (context === undefined) {
    throw new Error("useWineMenu must be used within a WineMenuProvider");
  }
  return context;
}
