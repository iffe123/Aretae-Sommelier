# Design Document: Default Language, Configurable Fields & Menu Themes

## Overview

This document outlines design options for three enhancements to the wine menu creation feature:
1. **Default Language**: Change default language to English throughout the app
2. **Configurable Fields**: Add more adjustable fields when creating wine menus
3. **Design Themes**: Allow users to choose between "Classic" and "Modern" menu designs

---

## Current State Analysis

### Hardcoded Swedish Text Locations

| File | Line | Current Text | English Translation |
|------|------|--------------|---------------------|
| `src/app/share-menu/page.tsx` | 23 | "Kvällens viner" | "Tonight's Wines" |
| `src/app/share-menu/page.tsx` | 108 | "Kvållens viner" (fallback) | "Tonight's Wines" |
| `src/app/share-menu/page.tsx` | 164 | "SKAPAD MED ARETAE SOMMELIER" | "CREATED WITH ARETAE SOMMELIER" |
| `src/app/share-menu/page.tsx` | 513 | "Förhandsvisning av din middagsmeny" | "Preview of your dinner menu" |
| `src/app/share-menu/page.tsx` | 626 | "Skapad med Aretae Sommelier" | "Created with Aretae Sommelier" |
| `src/app/cellar/page.tsx` | 260 | "Välj viner till din middagsmeny" | "Select wines for your dinner menu" |
| `src/app/cellar/page.tsx` | 261 | "Skapa meny" | "Create Menu" |
| `src/contexts/WineMenuContext.tsx` | 30 | "Kvällens viner" | "Tonight's Wines" |

### Currently Editable Fields
- Menu Title (inline edit)
- Greeting Message (inline edit)

### Current Design (Modern)
- Dark gradient background (`gray-900` → `gray-800` → `wine-900`)
- Wine-colored accents (`wine-200`, `wine-300`, `wine-400`)
- Decorative elements (gradient lines, wine icon)
- Serif typography (Playfair Display, Georgia)

---

## Feature 1: Default Language to English

### Option A: Simple String Replacement (Recommended)
**Effort**: Low (1-2 hours)

Replace all hardcoded Swedish strings with English equivalents.

**Changes Required:**
```typescript
// src/app/share-menu/page.tsx
- const [menuTitle, setMenuTitle] = useState("Kvällens viner");
+ const [menuTitle, setMenuTitle] = useState("Tonight's Wines");

// Canvas fallback
- ctx.fillText("Kvållens viner", 400, 80);
+ ctx.fillText("Tonight's Wines", 400, 80);

// Footer
- ctx.fillText("SKAPAD MED ARETAE SOMMELIER", 400, canvasHeight - 30);
+ ctx.fillText("CREATED WITH ARETAE SOMMELIER", 400, canvasHeight - 30);

// Preview label
- <p className="...">Förhandsvisning av din middagsmeny</p>
+ <p className="...">Preview of your dinner menu</p>

// HTML footer
- <p className="...">Skapad med Aretae Sommelier</p>
+ <p className="...">Created with Aretae Sommelier</p>

// src/app/cellar/page.tsx
- <p>Välj viner till din middagsmeny</p>
+ <p>Select wines for your dinner menu</p>
- <Button>Skapa meny ({selectedWines.length})</Button>
+ <Button>Create Menu ({selectedWines.length})</Button>
```

**Pros:**
- Minimal code changes
- No new dependencies
- Fast to implement

**Cons:**
- No multi-language support
- Future Swedish users would need code changes

---

### Option B: i18n Framework with Language Selector
**Effort**: Medium-High (4-6 hours)

Implement `next-intl` or `react-i18next` for full internationalization.

**Structure:**
```
src/
├── locales/
│   ├── en.json
│   └── sv.json
├── contexts/
│   └── LanguageContext.tsx
```

**Example Translation File:**
```json
// src/locales/en.json
{
  "menu": {
    "defaultTitle": "Tonight's Wines",
    "previewLabel": "Preview of your dinner menu",
    "footer": "Created with Aretae Sommelier",
    "createButton": "Create Menu",
    "selectWines": "Select wines for your dinner menu"
  }
}
```

**Pros:**
- Easy to add more languages later
- Professional approach
- Translation strings centralized

**Cons:**
- More complex implementation
- Adds dependency
- Overkill if only English is needed

---

### Recommendation for Feature 1
**Option A (Simple String Replacement)** - Quick, effective, matches the request.

---

## Feature 2: More Configurable Fields

### Proposed Additional Fields

| Field | Type | Default Value | Description |
|-------|------|---------------|-------------|
| Subtitle | String | "" | Optional subtitle below title |
| Date | String/Date | Current date | Event date display |
| Location/Venue | String | "" | Where the tasting takes place |
| Host Name | String | "" | Who is hosting |
| Show Wine Numbers | Boolean | true | Toggle wine numbering |
| Show Vintage | Boolean | true | Toggle vintage display |
| Show Region | Boolean | true | Toggle region/country display |
| Show Grape Variety | Boolean | true | Toggle grape variety display |
| Show Price | Boolean | false | Toggle price display |
| Custom Footer | String | "Created with Aretae Sommelier" | Customizable footer text |

### Option A: Settings Panel (Recommended)
**Effort**: Medium (3-4 hours)

Add a collapsible settings panel above the menu preview.

**UI Design:**
```
┌─────────────────────────────────────────┐
│  ⚙️ Menu Settings            [Collapse] │
├─────────────────────────────────────────┤
│  Title:        [Tonight's Wines      ]  │
│  Subtitle:     [A curated selection  ]  │
│  Date:         [December 13, 2025    ]  │
│  Location:     [Wine Cellar          ]  │
│  Host:         [John Smith           ]  │
│                                         │
│  Show Fields:                           │
│  ☑ Wine Numbers  ☑ Vintage  ☑ Region   │
│  ☑ Grape Variety ☐ Price               │
│                                         │
│  Footer:       [Created with Aretae..]  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           TONIGHT'S WINES               │
│          A curated selection            │
│        December 13, 2025                │
│           Wine Cellar                   │
│          Hosted by John Smith           │
│  ─────────────────────────────────────  │
│                                         │
│         [Wine List Preview]             │
│                                         │
└─────────────────────────────────────────┘
```

**Data Model:**
```typescript
interface MenuSettings {
  title: string;
  subtitle: string;
  date: string;
  location: string;
  hostName: string;
  showWineNumbers: boolean;
  showVintage: boolean;
  showRegion: boolean;
  showGrapeVariety: boolean;
  showPrice: boolean;
  footerText: string;
  theme: 'modern' | 'classic';  // For Feature 3
}
```

**Pros:**
- All settings in one place
- Clear visual organization
- Easy to extend

**Cons:**
- Takes up screen space
- May overwhelm some users

---

### Option B: Inline Editing with Toggle Icons
**Effort**: Medium (3-4 hours)

Keep inline editing but add small toggle icons next to each field.

**UI Design:**
Each editable element has a small settings icon that reveals toggle options.

**Pros:**
- Cleaner initial appearance
- Settings contextual to each field

**Cons:**
- Less discoverable
- More complex interaction model

---

### Option C: Two-Step Wizard
**Effort**: High (5-6 hours)

Step 1: Configure settings
Step 2: Preview and export

**Pros:**
- Clear separation of concerns
- Guided user experience

**Cons:**
- More complex navigation
- Slower workflow for repeat users

---

### Recommendation for Feature 2
**Option A (Settings Panel)** - Best balance of usability and discoverability.

---

## Feature 3: Classic vs Modern Design Themes

### Theme Comparison

| Aspect | Modern (Current) | Classic |
|--------|-----------------|---------|
| Background | Dark gradient (gray-900 to wine-900) | White (#ffffff) |
| Primary Text | wine-200, white | Black (#1a1a1a) |
| Secondary Text | gray-400 | Gray (#666666) |
| Accents | wine-400 (bright pink) | wine-700 (dark wine) or black |
| Decorations | Gradient lines, wine icon | Simple lines, minimal |
| Font | Serif (Playfair Display) | Serif (elegant, printable) |
| Print Friendly | No (dark background) | Yes (white background) |

### Classic Theme Design Mockup

```
┌─────────────────────────────────────────┐
│                                         │
│          TONIGHT'S WINES                │  ← Black serif text
│          ─────────────────              │  ← Simple black line
│          A curated selection            │  ← Gray italic text
│                                         │
│          December 13, 2025              │
│             Wine Cellar                 │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  1. Château Margaux                     │  ← Black bold text
│     Château Margaux • 2015              │  ← Gray text
│     Cabernet Sauvignon • Bordeaux       │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  2. Opus One                            │
│     Opus One Winery • 2018              │
│     Red Blend • Napa Valley             │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│       Created with Aretae Sommelier     │  ← Small gray footer
│                                         │
└─────────────────────────────────────────┘
```

### Option A: CSS-Based Theme Switching (Recommended)
**Effort**: Medium (3-4 hours)

Use CSS classes to toggle between themes.

**Implementation:**
```typescript
// Theme configurations
const themes = {
  modern: {
    container: 'bg-gradient-to-br from-gray-900 via-gray-800 to-wine-900',
    title: 'text-wine-200',
    subtitle: 'text-gray-400 italic',
    wineTitle: 'text-white',
    wineDetails: 'text-gray-400',
    border: 'border-gray-700',
    footer: 'text-gray-500',
    showDecorations: true,
  },
  classic: {
    container: 'bg-white',
    title: 'text-gray-900',
    subtitle: 'text-gray-600 italic',
    wineTitle: 'text-gray-900',
    wineDetails: 'text-gray-600',
    border: 'border-gray-300',
    footer: 'text-gray-400',
    showDecorations: false,
  }
};
```

**Theme Selector UI:**
```
┌─────────────────────────────────────────┐
│  Design Theme:                          │
│  ┌─────────────┐  ┌─────────────┐      │
│  │  [Dark BG]  │  │  [White BG] │      │
│  │   Modern    │  │   Classic   │      │
│  │     ○       │  │      ○      │      │
│  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────┘
```

**Canvas Export Considerations:**
Both the HTML preview and canvas-based image export need theme support:

```typescript
// Canvas colors for classic theme
const classicCanvasColors = {
  background: '#ffffff',
  title: '#1a1a1a',
  subtitle: '#666666',
  wineTitle: '#1a1a1a',
  wineDetails: '#666666',
  line: '#d1d5db',
  footer: '#9ca3af',
};

const modernCanvasColors = {
  background: 'gradient', // Current implementation
  title: '#e8c4c4',
  subtitle: '#9ca3af',
  wineTitle: '#ffffff',
  wineDetails: '#9ca3af',
  line: '#374151',
  footer: '#6b7280',
};
```

**Pros:**
- Clean separation of concerns
- Easy to add more themes later
- Consistent HTML preview and image export

**Cons:**
- Need to maintain two color systems

---

### Option B: Tailwind Dark Mode Toggle
**Effort**: Low-Medium (2-3 hours)

Leverage Tailwind's built-in dark mode with inverted logic (Classic = light, Modern = dark).

**Pros:**
- Uses existing Tailwind infrastructure
- Less custom code

**Cons:**
- Less flexibility for future themes
- May conflict with system dark mode

---

### Option C: Full Theming System with Presets
**Effort**: High (6-8 hours)

Create a comprehensive theming system with:
- Multiple preset themes
- Custom color picker
- Save favorite themes

**Pros:**
- Maximum flexibility
- User personalization

**Cons:**
- Over-engineered for current needs
- Complex UI

---

### Recommendation for Feature 3
**Option A (CSS-Based Theme Switching)** - Clean, extensible, appropriate scope.

---

## Implementation Plan

### Phase 1: Default Language to English
1. Update all Swedish strings to English in `share-menu/page.tsx`
2. Update selection mode strings in `cellar/page.tsx`
3. Update `WineMenuContext.tsx` default values
4. Test all text displays correctly

### Phase 2: Theme System (Classic/Modern)
1. Create theme configuration object
2. Add theme state to share-menu page
3. Create theme selector UI component
4. Apply theme classes to menu preview
5. Update canvas export to support both themes
6. Test image generation for both themes

### Phase 3: Configurable Fields
1. Create MenuSettings interface
2. Add settings state management
3. Create settings panel component
4. Wire settings to menu preview
5. Update canvas export to respect settings
6. Add toggle controls for visibility options

### Phase 4: Testing & Polish
1. Test on mobile devices
2. Verify print quality for Classic theme
3. Test image sharing on various platforms
4. Polish animations and transitions

---

## Questions for Stakeholder

1. **Should Classic theme have the wine icon?** Or purely text-based?
2. **Date format preference?** "December 13, 2025" vs "13/12/2025" vs "2025-12-13"
3. **Should settings persist?** Between sessions (localStorage) or fresh each time?
4. **Maximum subtitle/greeting length?** Current title max is ~50 chars.
5. **Any additional themes?** Burgundy (dark wine), Gold (celebration), etc.?

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/app/share-menu/page.tsx` | Theme system, settings panel, English text |
| `src/app/cellar/page.tsx` | English text for selection mode |
| `src/contexts/WineMenuContext.tsx` | English defaults (optional, currently unused) |
| `src/types/menu.ts` | New file: MenuSettings interface |
| `src/components/menu/ThemeSelector.tsx` | New file: Theme toggle component |
| `src/components/menu/SettingsPanel.tsx` | New file: Settings panel component |
| `src/lib/menu-themes.ts` | New file: Theme configurations |

---

## Estimated Total Effort

| Feature | Low Estimate | High Estimate |
|---------|--------------|---------------|
| English Default | 1 hour | 2 hours |
| Theme System | 3 hours | 4 hours |
| Configurable Fields | 3 hours | 5 hours |
| Testing & Polish | 2 hours | 3 hours |
| **Total** | **9 hours** | **14 hours** |
