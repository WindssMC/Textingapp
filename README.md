# Chat Website Starter (Next.js + Firebase)

Overview:
- Google sign-in (Firebase Auth)
- Choose unique username
- Create / join servers
- Text chat per server (Firestore)
- Voice chat per server (WebRTC signaling via Firestore)
- Friend requests, blocking, DMs
- In-app notifications
- PWA / mobile app-like layout
- File uploads to chats (Firebase Storage)

Setup:
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication -> Sign-in method -> Google.
3. Create a Firestore database and a Storage bucket.
4. Copy your Firebase config (apiKey, authDomain, projectId, etc).

Environment variables (create .env.local in project root):
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

Run locally:

npm install
npm run dev
Open http://localhost:3000

Firestore rules (basic start — tighten for production):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId;
    }
    match /usernames/{username} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete, update: if false;
    }
    match /servers/{serverId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;
      match /textMessages/{msg} {
        allow read: if request.auth != null;
        allow create: if request.auth != null;
      }
      match /voiceRooms/{any} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

Storage rules (sample):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 15 * 1024 * 1024
        && (request.resource.contentType.matches('image/.*')
            || request.resource.contentType.matches('audio/.*')
            || request.resource.contentType.matches('video/.*')
            || request.resource.contentType.matches('application/.*')
            || request.resource.contentType == 'text/plain');
    }
  }
}
```

Notes:
- This is a starter. For production, harden rules, use transactions for usernames, and consider an SFU for multi-party voice.
