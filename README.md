# Aretae Sommelier

A mobile-first wine cellar app with AI sommelier chat — an hommage to Pär Per.

## Features

### Core Wine Tracking
- **Add wines** with name, winery, vintage, grape variety, region, country, price, and photo of the label
- **Rate wines** (1-5 stars) and add personal tasting notes
- **Track inventory** - bottles owned and storage location
- **Wishlist vs owned** status for wines you want to try
- **Search and filter** your collection by any field
- **Edit and delete** wines easily

### AI Sommelier Chat
- Chat interface powered by a Gateway-first AI stack
- Get **food pairing suggestions**, serving temperature, and decanting advice
- Receive **similar wine recommendations**
- **Context-aware**: when viewing a specific wine, the sommelier knows which wine you're asking about

### User Experience
- Beautiful, elegant design with warm wine colors
- **Mobile-first PWA** - install on your phone's home screen
- Smooth animations and transitions
- Helpful empty states for new users

## Tech Stack

- **Next.js 16** with TypeScript and App Router
- **Tailwind CSS** for styling
- **Firebase Authentication** (email/password + Google sign-in)
- **Firebase Firestore** for the database
- **Firebase Storage** for wine label photos
- **Vercel AI Gateway** for model routing and fallback
- **Google Gemini** as the direct-provider fallback
- **PWA** configuration with next-pwa

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project
- Either Vercel AI Gateway auth or a Google AI Studio API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/aretae-sommelier.git
   cd aretae-sommelier
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file based on `.env.example`:
   ```bash
   cp .env.example .env.local
   ```

4. Fill in your environment variables (see [Environment Variables](#environment-variables) below)

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# AI Configuration
# Recommended: use Vercel AI Gateway auth (local dev token via `vercel env pull`)
VERCEL_OIDC_TOKEN=your_vercel_oidc_token_here

# Optional: static AI Gateway API key if you are not using OIDC
AI_GATEWAY_API_KEY=your_ai_gateway_api_key_here

# Direct Google fallback (recommended even when Gateway is enabled)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional model overrides
AI_PRIMARY_MODEL=openai/gpt-5.4-mini
AI_VISION_MODEL=openai/gpt-5.4-mini
AI_FALLBACK_MODELS=anthropic/claude-sonnet-4.6,google/gemini-2.5-flash
```

#### Validation and error messages

The app validates environment variables at runtime on both the server and client. If any required value is missing or left as a placeholder, the app will log a standardized message like:

`[env] Missing or invalid environment variables (client|server): ...`

API routes will respond with a consistent error payload:

`Service is not configured. Please set required environment variables. See README.md#environment-variables.`

### Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)

2. Enable **Authentication**:
   - Go to Authentication > Sign-in method
   - Enable Email/Password
   - Enable Google sign-in

3. Create a **Firestore Database**:
   - Go to Firestore Database > Create database
   - Start in test mode or configure security rules

4. Enable **Storage**:
   - Go to Storage > Get started
   - Configure security rules as needed

5. Get your Firebase config:
   - Go to Project Settings > General
   - Scroll to "Your apps" and click the web icon (</>)
   - Copy the config values to your `.env.local`

6. **Create required Firestore indexes**:

   The app requires a composite index for querying wines by user and sorting by date. When you first run the app, you may see an error like:
   ```
   The query requires an index. You can create it here: [URL]
   ```

   Click the URL in the error message to automatically create the index, or manually create it:
   - Go to Firestore Database > Indexes
   - Click "Add Index"
   - Collection ID: `wines`
   - Fields to index:
     - `userId` (Ascending)
     - `createdAt` (Descending)
   - Query scope: Collection

### AI Setup

1. Link the project to Vercel:
   ```bash
   npx vercel link
   ```
2. Pull local development env vars, including the OIDC token used by the AI Gateway:
   ```bash
   npx vercel env pull .env.local
   ```
3. Add a Google fallback key in Vercel or `.env.local` as `GEMINI_API_KEY`
4. Optional: override models with `AI_PRIMARY_MODEL`, `AI_VISION_MODEL`, or `AI_FALLBACK_MODELS`

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add your environment variables in the Vercel dashboard
4. Recommended:
   - enable AI Gateway for the project
   - keep `GEMINI_API_KEY` configured as the direct fallback
5. Deploy!

### Firebase Security Rules

For production, update your Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /wines/{wineId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

And Storage rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /wine-photos/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with love for wine enthusiasts.
