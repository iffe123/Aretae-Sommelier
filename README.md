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
- Chat interface powered by Google Gemini AI
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
- **Google Gemini AI** for sommelier chat
- **PWA** configuration with next-pwa

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project
- Google AI Studio API key (for Gemini)

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

# Gemini AI Configuration
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

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

### Gemini API Setup

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env.local` as `NEXT_PUBLIC_GEMINI_API_KEY`

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add your environment variables in the Vercel dashboard
4. Deploy!

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
