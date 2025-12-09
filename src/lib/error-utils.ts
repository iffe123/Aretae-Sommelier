// Utility functions for user-friendly error handling

/**
 * Converts Firebase Auth error codes to user-friendly messages
 */
export function getAuthErrorMessage(error: unknown): string {
  const errorCode = (error as { code?: string })?.code || '';
  const errorMessage = (error as { message?: string })?.message || '';

  // Firebase Auth error codes
  const errorMessages: Record<string, string> = {
    // Sign-in errors
    'auth/user-not-found': 'No account found with this email. Please sign up.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/invalid-credential': 'Invalid email or password. Please try again.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',

    // Sign-up errors
    'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
    'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',

    // Google sign-in errors
    'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups for this site.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled. Please try again.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email. Try a different sign-in method.',

    // Network errors
    'auth/network-request-failed': 'Network error. Please check your internet connection.',
    'auth/timeout': 'Request timed out. Please try again.',

    // General errors
    'auth/internal-error': 'An unexpected error occurred. Please try again.',
    'auth/invalid-api-key': 'Configuration error. Please contact support.',
  };

  // Check if we have a specific error message
  if (errorCode && errorMessages[errorCode]) {
    return errorMessages[errorCode];
  }

  // Check error message content for common issues
  if (errorMessage.toLowerCase().includes('network')) {
    return 'Network error. Please check your internet connection.';
  }

  if (errorMessage.toLowerCase().includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // Default fallback
  return 'An error occurred. Please try again.';
}

/**
 * Converts Firestore error codes to user-friendly messages
 */
export function getFirestoreErrorMessage(error: unknown): string {
  const errorCode = (error as { code?: string })?.code || '';
  const errorMessage = (error as { message?: string })?.message || '';

  const errorMessages: Record<string, string> = {
    'permission-denied': 'You don\'t have permission to perform this action.',
    'not-found': 'The requested item was not found.',
    'already-exists': 'This item already exists.',
    'resource-exhausted': 'Service temporarily unavailable. Please try again later.',
    'failed-precondition': 'Operation failed. Please try again.',
    'aborted': 'Operation was cancelled. Please try again.',
    'unavailable': 'Service temporarily unavailable. Please try again later.',
    'data-loss': 'Data error. Please try again.',
    'unauthenticated': 'Please sign in to continue.',
    'invalid-argument': 'Invalid data provided. Please check your input.',
  };

  if (errorCode && errorMessages[errorCode]) {
    return errorMessages[errorCode];
  }

  // Check for offline/network issues
  if (errorMessage.toLowerCase().includes('offline') ||
      errorMessage.toLowerCase().includes('network')) {
    return 'You appear to be offline. Please check your internet connection.';
  }

  return 'An error occurred while saving. Please try again.';
}

/**
 * Converts Storage error codes to user-friendly messages
 */
export function getStorageErrorMessage(error: unknown): string {
  const errorCode = (error as { code?: string })?.code || '';

  const errorMessages: Record<string, string> = {
    'storage/unauthorized': 'You don\'t have permission to upload files.',
    'storage/canceled': 'Upload was cancelled.',
    'storage/unknown': 'An unknown error occurred. Please try again.',
    'storage/object-not-found': 'File not found.',
    'storage/bucket-not-found': 'Storage is not configured correctly.',
    'storage/quota-exceeded': 'Storage quota exceeded. Please delete some files first.',
    'storage/unauthenticated': 'Please sign in to upload files.',
    'storage/retry-limit-exceeded': 'Upload failed after multiple attempts. Please try again.',
    'storage/invalid-checksum': 'File may be corrupted. Please try uploading again.',
    'storage/server-file-wrong-size': 'Upload error. Please try again.',
  };

  if (errorCode && errorMessages[errorCode]) {
    return errorMessages[errorCode];
  }

  return 'Failed to upload file. Please try again.';
}

/**
 * Maximum file size for photo uploads (5MB)
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Allowed image MIME types
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];

/**
 * Validates a file for photo upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Please select an image file (JPEG, PNG, GIF, or WebP).',
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${sizeMB}MB). Maximum size is 5MB.`,
    };
  }

  return { valid: true };
}

/**
 * Format bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
