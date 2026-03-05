import { describe, it, expect } from 'vitest';
import {
  getDrinkingWindow,
  getDrinkingWindowInfo,
  formatDrinkingWindow,
  getWinesByDrinkingStatus,
} from '../drinkingWindow';
import { Wine } from '@/types/wine';

function makeWine(overrides: Partial<Wine> = {}): Wine {
  return {
    id: '1',
    userId: 'user1',
    name: 'Test Wine',
    winery: 'Test Winery',
    vintage: 2020,
    grapeVariety: 'Merlot',
    region: 'Napa Valley',
    country: 'USA',
    price: 25,
    bottlesOwned: 1,
    isWishlist: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('getDrinkingWindow', () => {
  it('uses AI-suggested window when both start and end are provided', () => {
    const wine = makeWine({ drinkingWindowStart: 2025, drinkingWindowEnd: 2035 });
    const result = getDrinkingWindow(wine);
    expect(result.start).toBe(2025);
    expect(result.end).toBe(2035);
    expect(result.peak).toBe(2030);
  });

  it('returns default window for unknown grape', () => {
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Unknown Grape' });
    const result = getDrinkingWindow(wine);
    expect(result.start).toBe(2020);
    expect(result.peak).toBe(2022);
    expect(result.end).toBe(2025);
  });

  it('returns longer window for Cabernet Sauvignon', () => {
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Cabernet Sauvignon' });
    const result = getDrinkingWindow(wine);
    expect(result.start).toBe(2023);
    expect(result.peak).toBe(2028);
    expect(result.end).toBe(2040);
  });

  it('returns appropriate window for Pinot Noir', () => {
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Pinot Noir' });
    const result = getDrinkingWindow(wine);
    expect(result.start).toBe(2023);
    expect(result.peak).toBe(2027);
    expect(result.end).toBe(2035);
  });

  it('returns appropriate window for Burgundy region', () => {
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Gamay', region: 'Burgundy' });
    const result = getDrinkingWindow(wine);
    expect(result.start).toBe(2023);
    expect(result.end).toBe(2035);
  });

  it('returns long window for Bordeaux', () => {
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Merlot', region: 'Bordeaux' });
    const result = getDrinkingWindow(wine);
    expect(result.start).toBe(2025);
    expect(result.end).toBe(2045);
  });

  it('returns very long window for Barolo', () => {
    // Nebbiolo matches the age-worthy reds rule before the Barolo region rule
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Nebbiolo', region: 'Barolo' });
    const result = getDrinkingWindow(wine);
    expect(result.start).toBe(2023);
    expect(result.end).toBe(2040);
  });

  it('returns Barolo-specific window when grape is not age-worthy', () => {
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Other', region: 'Barolo' });
    const result = getDrinkingWindow(wine);
    expect(result.start).toBe(2025);
    expect(result.end).toBe(2050);
  });

  it('returns short window for white wines', () => {
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Chardonnay' });
    const result = getDrinkingWindow(wine);
    expect(result.start).toBe(2020);
    expect(result.end).toBe(2027);
  });

  it('handles Champagne/sparkling', () => {
    // Chardonnay matches white wines rule before Champagne region
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Blend', region: 'Champagne' });
    const result = getDrinkingWindow(wine);
    expect(result.start).toBe(2020);
    expect(result.end).toBe(2035);
  });

  it('handles sparkling wineType', () => {
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Prosecco', wineType: 'sparkling' });
    const result = getDrinkingWindow(wine);
    expect(result.end).toBe(2035);
  });

  it('handles dessert wines', () => {
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Semillon', wineType: 'dessert' });
    const result = getDrinkingWindow(wine);
    expect(result.start).toBe(2022);
    expect(result.end).toBe(2050);
  });

  it('handles fortified wines', () => {
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Touriga Nacional', wineType: 'fortified' });
    const result = getDrinkingWindow(wine);
    expect(result.end).toBe(2070);
  });

  it('handles rosé wines', () => {
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Grenache', wineType: 'rosé' });
    const result = getDrinkingWindow(wine);
    expect(result.start).toBe(2020);
    expect(result.end).toBe(2023);
  });

  it('handles orange wines', () => {
    const wine = makeWine({ vintage: 2020, grapeVariety: 'Rkatsiteli', wineType: 'orange' });
    const result = getDrinkingWindow(wine);
    expect(result.start).toBe(2020);
    expect(result.end).toBe(2028);
  });
});

describe('getDrinkingWindowInfo', () => {
  const currentYear = new Date().getFullYear();

  it('returns aging status for wines not yet ready', () => {
    const wine = makeWine({ drinkingWindowStart: currentYear + 5, drinkingWindowEnd: currentYear + 15 });
    const info = getDrinkingWindowInfo(wine);
    expect(info.status).toBe('aging');
    expect(info.statusLabel).toBe('Still Aging');
  });

  it('returns past-peak for wines past their window', () => {
    const wine = makeWine({ drinkingWindowStart: currentYear - 15, drinkingWindowEnd: currentYear - 5 });
    const info = getDrinkingWindowInfo(wine);
    expect(info.status).toBe('past-peak');
    expect(info.statusLabel).toBe('Past Peak');
  });

  it('returns approaching-peak when at peak year', () => {
    const peakYear = currentYear;
    const wine = makeWine({
      drinkingWindowStart: currentYear - 5,
      drinkingWindowEnd: currentYear + 5,
    });
    // The peak is the midpoint: (currentYear-5 + currentYear+5)/2 = currentYear
    const info = getDrinkingWindowInfo(wine);
    expect(info.status).toBe('approaching-peak');
    expect(info.statusLabel).toBe('At Peak');
  });

  it('returns ready for wines within window but not at peak', () => {
    const wine = makeWine({
      drinkingWindowStart: currentYear - 5,
      drinkingWindowEnd: currentYear + 20,
    });
    // peak = midpoint = currentYear + 7.5 (floored), so current is not within peak +/- 1
    const info = getDrinkingWindowInfo(wine);
    expect(info.status).toBe('ready');
    expect(info.statusLabel).toBe('Ready Now');
  });
});

describe('formatDrinkingWindow', () => {
  it('formats window as range string', () => {
    expect(formatDrinkingWindow({ start: 2020, peak: 2025, end: 2030 })).toBe('2020 - 2030');
  });
});

describe('getWinesByDrinkingStatus', () => {
  const currentYear = new Date().getFullYear();

  it('groups wines by drinking status', () => {
    const wines = [
      makeWine({ id: '1', drinkingWindowStart: currentYear + 5, drinkingWindowEnd: currentYear + 15 }),
      makeWine({ id: '2', drinkingWindowStart: currentYear - 15, drinkingWindowEnd: currentYear - 5 }),
    ];
    const result = getWinesByDrinkingStatus(wines);
    expect(result.aging.length).toBe(1);
    expect(result['past-peak'].length).toBe(1);
    expect(result.ready.length).toBe(0);
  });

  it('returns empty arrays when no wines', () => {
    const result = getWinesByDrinkingStatus([]);
    expect(result.ready).toEqual([]);
    expect(result.aging).toEqual([]);
    expect(result['past-peak']).toEqual([]);
    expect(result['approaching-peak']).toEqual([]);
  });
});
