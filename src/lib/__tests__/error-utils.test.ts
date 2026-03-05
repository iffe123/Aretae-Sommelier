import { describe, it, expect } from 'vitest';
import {
  getAuthErrorMessage,
  getFirestoreErrorMessage,
  getStorageErrorMessage,
  formatFileSize,
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES,
} from '../error-utils';

describe('getAuthErrorMessage', () => {
  it('returns message for known auth error code', () => {
    const error = { code: 'auth/user-not-found' };
    expect(getAuthErrorMessage(error)).toBe('No account found with this email. Please sign up first.');
  });

  it('returns message for invalid-credential', () => {
    const error = { code: 'auth/invalid-credential' };
    expect(getAuthErrorMessage(error)).toBe('Invalid email or password. Please check your credentials and try again.');
  });

  it('returns message for too-many-requests', () => {
    const error = { code: 'auth/too-many-requests' };
    expect(getAuthErrorMessage(error)).toBe('Too many failed attempts. Please try again later.');
  });

  it('returns network error for network-related messages', () => {
    const error = { message: 'Network connection lost' };
    expect(getAuthErrorMessage(error)).toBe('Network error. Please check your internet connection.');
  });

  it('returns timeout error for timeout-related messages', () => {
    const error = { message: 'Request timeout exceeded' };
    expect(getAuthErrorMessage(error)).toBe('Request timed out. Please try again.');
  });

  it('returns fallback for unknown errors', () => {
    const error = { code: 'auth/unknown-code' };
    expect(getAuthErrorMessage(error)).toBe('An error occurred (auth/unknown-code). Please try again.');
  });

  it('handles error with no code or message', () => {
    expect(getAuthErrorMessage({})).toBe('An error occurred. Please try again.');
  });

  it('returns message for email-already-in-use', () => {
    const error = { code: 'auth/email-already-in-use' };
    expect(getAuthErrorMessage(error)).toBe('An account with this email already exists. Try signing in instead.');
  });

  it('returns message for popup-blocked', () => {
    const error = { code: 'auth/popup-blocked' };
    expect(getAuthErrorMessage(error)).toBe('Sign-in popup was blocked. Please allow popups for this site.');
  });
});

describe('getFirestoreErrorMessage', () => {
  it('returns message for permission-denied', () => {
    const error = { code: 'permission-denied' };
    expect(getFirestoreErrorMessage(error)).toBe("You don't have permission to perform this action.");
  });

  it('returns message for not-found', () => {
    const error = { code: 'not-found' };
    expect(getFirestoreErrorMessage(error)).toBe('The requested item was not found.');
  });

  it('returns message for unauthenticated', () => {
    const error = { code: 'unauthenticated' };
    expect(getFirestoreErrorMessage(error)).toBe('Please sign in to continue.');
  });

  it('returns offline error for offline messages', () => {
    const error = { message: 'Client is offline' };
    expect(getFirestoreErrorMessage(error)).toBe('You appear to be offline. Please check your internet connection.');
  });

  it('returns fallback for unknown errors', () => {
    expect(getFirestoreErrorMessage({})).toBe('An error occurred while saving. Please try again.');
  });
});

describe('getStorageErrorMessage', () => {
  it('returns message for storage/unauthorized', () => {
    const error = { code: 'storage/unauthorized' };
    expect(getStorageErrorMessage(error)).toBe("You don't have permission to upload files.");
  });

  it('returns message for storage/quota-exceeded', () => {
    const error = { code: 'storage/quota-exceeded' };
    expect(getStorageErrorMessage(error)).toBe('Storage quota exceeded. Please delete some files first.');
  });

  it('returns fallback for unknown errors', () => {
    expect(getStorageErrorMessage({})).toBe('Failed to upload file. Please try again.');
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('formats edge case at 1KB boundary', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });
});

describe('constants', () => {
  it('MAX_FILE_SIZE is 5MB', () => {
    expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
  });

  it('ALLOWED_IMAGE_TYPES includes common formats', () => {
    expect(ALLOWED_IMAGE_TYPES).toContain('image/jpeg');
    expect(ALLOWED_IMAGE_TYPES).toContain('image/png');
    expect(ALLOWED_IMAGE_TYPES).toContain('image/webp');
  });
});
