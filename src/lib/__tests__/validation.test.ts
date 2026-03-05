import { describe, it, expect } from 'vitest';
import {
  validateRequired,
  validateLength,
  validateVintage,
  validatePrice,
  validateBottlesOwned,
  validateAlcoholContent,
  validateDrinkingWindow,
  validateVivinoRating,
  validateVivinoRatingsCount,
  validateUrl,
  validateFoodPairings,
  validateEmail,
  validatePassword,
  getPasswordStrength,
  validateWineForm,
  LIMITS,
  MAX_PRICE,
} from '../validation';

describe('validateRequired', () => {
  it('returns invalid for undefined', () => {
    expect(validateRequired(undefined, 'Field')).toEqual({ valid: false, error: 'Field is required' });
  });

  it('returns invalid for null', () => {
    expect(validateRequired(null, 'Field')).toEqual({ valid: false, error: 'Field is required' });
  });

  it('returns invalid for empty string', () => {
    expect(validateRequired('', 'Field')).toEqual({ valid: false, error: 'Field is required' });
  });

  it('returns invalid for whitespace-only string', () => {
    expect(validateRequired('   ', 'Field')).toEqual({ valid: false, error: 'Field is required' });
  });

  it('returns valid for non-empty string', () => {
    expect(validateRequired('hello', 'Field')).toEqual({ valid: true });
  });

  it('returns valid for number 0', () => {
    expect(validateRequired(0, 'Field')).toEqual({ valid: true });
  });
});

describe('validateLength', () => {
  it('returns valid when under limit', () => {
    expect(validateLength('abc', 10, 'Field')).toEqual({ valid: true });
  });

  it('returns valid when at limit', () => {
    expect(validateLength('abc', 3, 'Field')).toEqual({ valid: true });
  });

  it('returns invalid when over limit', () => {
    expect(validateLength('abcd', 3, 'Field')).toEqual({
      valid: false,
      error: 'Field must be 3 characters or less',
    });
  });
});

describe('validateVintage', () => {
  it('returns invalid for undefined', () => {
    expect(validateVintage(undefined).valid).toBe(false);
  });

  it('returns invalid for empty string', () => {
    expect(validateVintage('').valid).toBe(false);
  });

  it('returns invalid for non-numeric string', () => {
    const result = validateVintage('abc');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Vintage must be a valid year');
  });

  it('returns invalid for year before 1900', () => {
    expect(validateVintage(1899).valid).toBe(false);
  });

  it('returns valid for 1900', () => {
    expect(validateVintage(1900).valid).toBe(true);
  });

  it('returns valid for current year', () => {
    expect(validateVintage(new Date().getFullYear()).valid).toBe(true);
  });

  it('returns invalid for future year', () => {
    expect(validateVintage(new Date().getFullYear() + 1).valid).toBe(false);
  });

  it('accepts string year', () => {
    expect(validateVintage('2020').valid).toBe(true);
  });
});

describe('validatePrice', () => {
  it('returns invalid for undefined', () => {
    expect(validatePrice(undefined).valid).toBe(false);
  });

  it('returns invalid for empty string', () => {
    expect(validatePrice('').valid).toBe(false);
  });

  it('returns invalid for non-numeric string', () => {
    expect(validatePrice('abc').valid).toBe(false);
  });

  it('returns invalid for negative price', () => {
    expect(validatePrice(-1).valid).toBe(false);
  });

  it('returns valid for zero', () => {
    expect(validatePrice(0).valid).toBe(true);
  });

  it('returns valid for normal price', () => {
    expect(validatePrice(29.99).valid).toBe(true);
  });

  it('returns invalid for price exceeding max', () => {
    expect(validatePrice(MAX_PRICE + 1).valid).toBe(false);
  });

  it('returns valid for max price', () => {
    expect(validatePrice(MAX_PRICE).valid).toBe(true);
  });

  it('accepts string price', () => {
    expect(validatePrice('25.50').valid).toBe(true);
  });
});

describe('validateBottlesOwned', () => {
  it('returns valid for undefined (optional)', () => {
    expect(validateBottlesOwned(undefined).valid).toBe(true);
  });

  it('returns valid for empty string (optional)', () => {
    expect(validateBottlesOwned('').valid).toBe(true);
  });

  it('returns invalid for non-numeric string', () => {
    expect(validateBottlesOwned('abc').valid).toBe(false);
  });

  it('returns invalid for negative', () => {
    expect(validateBottlesOwned(-1).valid).toBe(false);
  });

  it('returns invalid for non-integer', () => {
    expect(validateBottlesOwned(1.5).valid).toBe(false);
  });

  it('returns valid for zero', () => {
    expect(validateBottlesOwned(0).valid).toBe(true);
  });

  it('returns valid for positive integer', () => {
    expect(validateBottlesOwned(12).valid).toBe(true);
  });
});

describe('validateAlcoholContent', () => {
  it('returns valid for undefined (optional)', () => {
    expect(validateAlcoholContent(undefined).valid).toBe(true);
  });

  it('returns invalid for NaN', () => {
    expect(validateAlcoholContent(NaN).valid).toBe(false);
  });

  it('returns invalid for negative', () => {
    expect(validateAlcoholContent(-1).valid).toBe(false);
  });

  it('returns invalid for over 25', () => {
    expect(validateAlcoholContent(26).valid).toBe(false);
  });

  it('returns valid for 0', () => {
    expect(validateAlcoholContent(0).valid).toBe(true);
  });

  it('returns valid for 13.5', () => {
    expect(validateAlcoholContent(13.5).valid).toBe(true);
  });

  it('returns valid for 25', () => {
    expect(validateAlcoholContent(25).valid).toBe(true);
  });
});

describe('validateDrinkingWindow', () => {
  it('returns valid when both undefined', () => {
    expect(validateDrinkingWindow(undefined, undefined).valid).toBe(true);
  });

  it('returns valid for valid range', () => {
    expect(validateDrinkingWindow(2020, 2030).valid).toBe(true);
  });

  it('returns invalid when end before start', () => {
    const result = validateDrinkingWindow(2030, 2020);
    expect(result.valid).toBe(false);
    expect(result.endError).toBeDefined();
  });

  it('returns invalid for year below 1900', () => {
    expect(validateDrinkingWindow(1800, 2020).valid).toBe(false);
  });

  it('returns invalid for year above 2100', () => {
    expect(validateDrinkingWindow(2020, 2200).valid).toBe(false);
  });

  it('returns valid when only start provided', () => {
    expect(validateDrinkingWindow(2020, undefined).valid).toBe(true);
  });

  it('returns valid when only end provided', () => {
    expect(validateDrinkingWindow(undefined, 2030).valid).toBe(true);
  });
});

describe('validateVivinoRating', () => {
  it('returns valid for undefined (optional)', () => {
    expect(validateVivinoRating(undefined).valid).toBe(true);
  });

  it('returns invalid for negative', () => {
    expect(validateVivinoRating(-1).valid).toBe(false);
  });

  it('returns invalid for over 5', () => {
    expect(validateVivinoRating(6).valid).toBe(false);
  });

  it('returns valid for 4.2', () => {
    expect(validateVivinoRating(4.2).valid).toBe(true);
  });
});

describe('validateVivinoRatingsCount', () => {
  it('returns valid for undefined (optional)', () => {
    expect(validateVivinoRatingsCount(undefined).valid).toBe(true);
  });

  it('returns invalid for negative', () => {
    expect(validateVivinoRatingsCount(-1).valid).toBe(false);
  });

  it('returns valid for 0', () => {
    expect(validateVivinoRatingsCount(0).valid).toBe(true);
  });

  it('returns valid for positive', () => {
    expect(validateVivinoRatingsCount(1000).valid).toBe(true);
  });
});

describe('validateUrl', () => {
  it('returns valid for empty string (optional)', () => {
    expect(validateUrl('').valid).toBe(true);
  });

  it('returns valid for undefined (optional)', () => {
    expect(validateUrl(undefined).valid).toBe(true);
  });

  it('returns valid for valid URL', () => {
    expect(validateUrl('https://www.vivino.com/wine/123').valid).toBe(true);
  });

  it('returns invalid for invalid URL', () => {
    expect(validateUrl('not-a-url').valid).toBe(false);
  });
});

describe('validateFoodPairings', () => {
  it('returns valid for undefined (optional)', () => {
    expect(validateFoodPairings(undefined).valid).toBe(true);
  });

  it('returns valid for empty array', () => {
    expect(validateFoodPairings([]).valid).toBe(true);
  });

  it('returns valid for normal array', () => {
    expect(validateFoodPairings(['steak', 'cheese']).valid).toBe(true);
  });

  it('returns invalid for too many items', () => {
    const items = Array(51).fill('food');
    expect(validateFoodPairings(items).valid).toBe(false);
  });
});

describe('validateEmail', () => {
  it('returns invalid for empty string', () => {
    expect(validateEmail('').valid).toBe(false);
  });

  it('returns invalid for missing @', () => {
    expect(validateEmail('invalid').valid).toBe(false);
  });

  it('returns invalid for missing domain', () => {
    expect(validateEmail('test@').valid).toBe(false);
  });

  it('returns valid for proper email', () => {
    expect(validateEmail('test@example.com').valid).toBe(true);
  });
});

describe('validatePassword', () => {
  it('returns invalid for empty string', () => {
    expect(validatePassword('').valid).toBe(false);
  });

  it('returns invalid for short password', () => {
    expect(validatePassword('abc').valid).toBe(false);
  });

  it('returns valid for 8+ characters', () => {
    expect(validatePassword('12345678').valid).toBe(true);
  });
});

describe('getPasswordStrength', () => {
  it('returns weak for short lowercase', () => {
    const result = getPasswordStrength('abc');
    expect(result.strength).toBe('weak');
  });

  it('returns strong for complex password', () => {
    const result = getPasswordStrength('MyStr0ng!Pass');
    expect(result.strength).toBe('strong');
  });

  it('returns feedback for missing criteria', () => {
    const result = getPasswordStrength('abc');
    expect(result.feedback).toBeTruthy();
  });

  it('increments score for length >= 12', () => {
    const short = getPasswordStrength('abcdefgh');
    const long = getPasswordStrength('abcdefghijkl');
    expect(long.score).toBeGreaterThan(short.score);
  });
});

describe('validateWineForm', () => {
  const validData = {
    name: 'Chateau Margaux',
    winery: 'Chateau Margaux',
    vintage: 2015,
    grapeVariety: 'Cabernet Sauvignon',
    region: 'Bordeaux',
    country: 'France',
    price: 250,
  };

  it('returns valid for complete valid data', () => {
    const result = validateWineForm(validData);
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors).length).toBe(0);
  });

  it('returns invalid when name is missing', () => {
    const result = validateWineForm({ ...validData, name: undefined });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('returns invalid when name exceeds limit', () => {
    const result = validateWineForm({ ...validData, name: 'a'.repeat(LIMITS.name + 1) });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('returns invalid when winery is missing', () => {
    const result = validateWineForm({ ...validData, winery: undefined });
    expect(result.valid).toBe(false);
    expect(result.errors.winery).toBeDefined();
  });

  it('returns invalid for bad vintage', () => {
    const result = validateWineForm({ ...validData, vintage: 1800 });
    expect(result.valid).toBe(false);
    expect(result.errors.vintage).toBeDefined();
  });

  it('validates optional fields when provided', () => {
    const result = validateWineForm({
      ...validData,
      alcoholContent: 30,
      vivinoRating: 6,
      vivinoUrl: 'not-a-url',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.alcoholContent).toBeDefined();
    expect(result.errors.vivinoRating).toBeDefined();
    expect(result.errors.vivinoUrl).toBeDefined();
  });

  it('validates drinking window', () => {
    const result = validateWineForm({
      ...validData,
      drinkingWindowStart: 2030,
      drinkingWindowEnd: 2020,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.drinkingWindowEnd).toBeDefined();
  });

  it('validates body and acidity length', () => {
    const result = validateWineForm({
      ...validData,
      body: 'a'.repeat(101),
      acidity: 'b'.repeat(101),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.body).toBeDefined();
    expect(result.errors.acidity).toBeDefined();
  });
});
