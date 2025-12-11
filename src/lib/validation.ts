// Input validation utilities

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface WineFormErrors {
  name?: string;
  winery?: string;
  vintage?: string;
  grapeVariety?: string;
  region?: string;
  country?: string;
  price?: string;
  bottlesOwned?: string;
  storageLocation?: string;
  tastingNotes?: string;
}

// Character limits
export const LIMITS = {
  name: 200,
  winery: 200,
  grapeVariety: 100,
  region: 100,
  country: 100,
  storageLocation: 200,
  tastingNotes: 2000,
  displayName: 100,
};

// Current year for vintage validation
const currentYear = new Date().getFullYear();
const minVintageYear = 1900;

// Maximum price validation
export const MAX_PRICE = 1000000;

/**
 * Validates a required field
 */
export function validateRequired(value: string | number | undefined | null, fieldName: string): ValidationResult {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    return { valid: false, error: `${fieldName} is required` };
  }
  return { valid: true };
}

/**
 * Validates string length
 */
export function validateLength(value: string, maxLength: number, fieldName: string): ValidationResult {
  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} must be ${maxLength} characters or less` };
  }
  return { valid: true };
}

/**
 * Validates a vintage year
 */
export function validateVintage(year: number | string | undefined | null): ValidationResult {
  if (year === undefined || year === null || year === '') {
    return { valid: false, error: 'Vintage is required' };
  }

  const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;

  if (isNaN(yearNum)) {
    return { valid: false, error: 'Vintage must be a valid year' };
  }

  if (yearNum < minVintageYear || yearNum > currentYear) {
    return { valid: false, error: `Vintage must be between ${minVintageYear} and ${currentYear}` };
  }

  return { valid: true };
}

/**
 * Validates a price value
 */
export function validatePrice(price: number | string | undefined | null): ValidationResult {
  if (price === undefined || price === null || price === '') {
    return { valid: false, error: 'Price is required' };
  }

  const priceNum = typeof price === 'string' ? parseFloat(price) : price;

  if (isNaN(priceNum)) {
    return { valid: false, error: 'Price must be a valid number' };
  }

  if (priceNum < 0) {
    return { valid: false, error: 'Price cannot be negative' };
  }

  if (priceNum > MAX_PRICE) {
    return { valid: false, error: `Price cannot exceed $${MAX_PRICE.toLocaleString()}` };
  }

  return { valid: true };
}

/**
 * Validates bottles owned (optional, non-negative integer)
 */
export function validateBottlesOwned(count: number | string | undefined | null): ValidationResult {
  if (count === undefined || count === null || count === '') {
    return { valid: true }; // Optional field
  }

  const countNum = typeof count === 'string' ? parseInt(count, 10) : count;

  if (isNaN(countNum)) {
    return { valid: false, error: 'Bottles owned must be a number' };
  }

  if (countNum < 0) {
    return { valid: false, error: 'Bottles owned cannot be negative' };
  }

  if (!Number.isInteger(countNum)) {
    return { valid: false, error: 'Bottles owned must be a whole number' };
  }

  return { valid: true };
}

/**
 * Validates an email address
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || !email.trim()) {
    return { valid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  return { valid: true };
}

/**
 * Validates a password
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  return { valid: true };
}

/**
 * Gets password strength indicator
 */
export function getPasswordStrength(password: string): {
  strength: 'weak' | 'fair' | 'good' | 'strong';
  score: number;
  feedback: string;
} {
  let score = 0;
  const feedback: string[] = [];

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (password.length < 8) feedback.push('Use at least 8 characters');
  if (!/[A-Z]/.test(password)) feedback.push('Add uppercase letters');
  if (!/[0-9]/.test(password)) feedback.push('Add numbers');
  if (!/[^a-zA-Z0-9]/.test(password)) feedback.push('Add special characters');

  let strength: 'weak' | 'fair' | 'good' | 'strong';
  if (score <= 2) strength = 'weak';
  else if (score <= 3) strength = 'fair';
  else if (score <= 4) strength = 'good';
  else strength = 'strong';

  return {
    strength,
    score,
    feedback: feedback.slice(0, 2).join('. '),
  };
}

/**
 * Validates the entire wine form
 */
export function validateWineForm(data: {
  name?: string;
  winery?: string;
  vintage?: number;
  grapeVariety?: string;
  region?: string;
  country?: string;
  price?: number;
  bottlesOwned?: number;
  storageLocation?: string;
  tastingNotes?: string;
}): { valid: boolean; errors: WineFormErrors } {
  const errors: WineFormErrors = {};
  let valid = true;

  // Required fields
  const nameResult = validateRequired(data.name, 'Wine name');
  if (!nameResult.valid) {
    errors.name = nameResult.error;
    valid = false;
  } else if (data.name && data.name.length > LIMITS.name) {
    errors.name = `Wine name must be ${LIMITS.name} characters or less`;
    valid = false;
  }

  const wineryResult = validateRequired(data.winery, 'Winery');
  if (!wineryResult.valid) {
    errors.winery = wineryResult.error;
    valid = false;
  } else if (data.winery && data.winery.length > LIMITS.winery) {
    errors.winery = `Winery must be ${LIMITS.winery} characters or less`;
    valid = false;
  }

  const vintageResult = validateVintage(data.vintage);
  if (!vintageResult.valid) {
    errors.vintage = vintageResult.error;
    valid = false;
  }

  const grapeResult = validateRequired(data.grapeVariety, 'Grape variety');
  if (!grapeResult.valid) {
    errors.grapeVariety = grapeResult.error;
    valid = false;
  } else if (data.grapeVariety && data.grapeVariety.length > LIMITS.grapeVariety) {
    errors.grapeVariety = `Grape variety must be ${LIMITS.grapeVariety} characters or less`;
    valid = false;
  }

  const regionResult = validateRequired(data.region, 'Region');
  if (!regionResult.valid) {
    errors.region = regionResult.error;
    valid = false;
  } else if (data.region && data.region.length > LIMITS.region) {
    errors.region = `Region must be ${LIMITS.region} characters or less`;
    valid = false;
  }

  const countryResult = validateRequired(data.country, 'Country');
  if (!countryResult.valid) {
    errors.country = countryResult.error;
    valid = false;
  } else if (data.country && data.country.length > LIMITS.country) {
    errors.country = `Country must be ${LIMITS.country} characters or less`;
    valid = false;
  }

  const priceResult = validatePrice(data.price);
  if (!priceResult.valid) {
    errors.price = priceResult.error;
    valid = false;
  }

  // Optional fields with limits
  const bottlesResult = validateBottlesOwned(data.bottlesOwned);
  if (!bottlesResult.valid) {
    errors.bottlesOwned = bottlesResult.error;
    valid = false;
  }

  if (data.storageLocation && data.storageLocation.length > LIMITS.storageLocation) {
    errors.storageLocation = `Storage location must be ${LIMITS.storageLocation} characters or less`;
    valid = false;
  }

  if (data.tastingNotes && data.tastingNotes.length > LIMITS.tastingNotes) {
    errors.tastingNotes = `Tasting notes must be ${LIMITS.tastingNotes} characters or less`;
    valid = false;
  }

  return { valid, errors };
}
