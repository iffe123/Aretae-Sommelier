# Firebase Security Rules

This document contains the recommended security rules for Firestore and Firebase Storage.
Copy these rules to your Firebase Console.

## Firestore Rules

Copy to: Firebase Console > Firestore Database > Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own wines
    match /wines/{wineId} {
      // Allow read only if user is authenticated and owns the wine
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;

      // Allow create only if user is authenticated and setting their own userId
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;

      // Allow update/delete only if user is authenticated and owns the wine
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }

    // Deny all other access by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Storage Rules

Copy to: Firebase Console > Storage > Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Wine photos can only be uploaded by authenticated users to their own folder
    match /wine-photos/{userId}/{allPaths=**} {
      // Allow read for authenticated users (to view photos)
      allow read: if request.auth != null;

      // Allow write only if:
      // 1. User is authenticated
      // 2. User is uploading to their own folder
      // 3. File size is less than 5MB
      // 4. File is an image
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }

    // Deny all other access by default
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## How to Apply These Rules

1. Go to the [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. For Firestore rules:
   - Navigate to Firestore Database > Rules
   - Copy the Firestore rules above
   - Click "Publish"
4. For Storage rules:
   - Navigate to Storage > Rules
   - Copy the Storage rules above
   - Click "Publish"

## Firestore Indexes

The app requires composite indexes for efficient querying. If you see "index required" errors in the console, Firestore will provide a direct link to create the missing index.

### Required Composite Indexes

Create these indexes in Firebase Console > Firestore Database > Indexes, or use the Firebase CLI.

| Collection | Fields | Query Scope |
|------------|--------|-------------|
| wines | `userId` (Asc), `createdAt` (Desc) | Collection |
| wines | `userId` (Asc), `isWishlist` (Asc), `createdAt` (Desc) | Collection |
| wines | `userId` (Asc), `rating` (Asc), `createdAt` (Desc) | Collection |
| wines | `userId` (Asc), `name` (Asc) | Collection |
| wines | `userId` (Asc), `name` (Desc) | Collection |
| wines | `userId` (Asc), `vintage` (Asc) | Collection |
| wines | `userId` (Asc), `vintage` (Desc) | Collection |
| wines | `userId` (Asc), `rating` (Desc) | Collection |
| wines | `userId` (Asc), `price` (Asc) | Collection |
| wines | `userId` (Asc), `price` (Desc) | Collection |

### Using Firebase CLI

To create indexes using the CLI:

```bash
# Export current indexes
firebase firestore:indexes > firestore.indexes.json

# Deploy indexes from file
firebase deploy --only firestore:indexes
```

Example `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "wines",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "wines",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "isWishlist", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "wines",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "rating", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

## Security Checklist

- [x] Gemini API key is server-side only (no NEXT_PUBLIC_ prefix)
- [x] Firebase config uses environment variables
- [x] User input is validated before submission
- [x] File uploads are validated for type and size
- [x] Photo URLs are extracted safely from Firebase Storage URLs
- [ ] Apply Firestore security rules (manual step)
- [ ] Apply Storage security rules (manual step)
- [ ] Enable App Check for additional protection (optional)
