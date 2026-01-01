'use client';

import {
  initializeApp,
  getApp,
  getApps,
  FirebaseApp,
} from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

import { firebaseConfig } from './config';

// App is initialized on the client-side
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db = getFirestore(app);
const auth = getAuth(app);

// Export the initialized services
export { app, db, auth };

// Export hooks and providers
export { FirebaseProvider, useFirebase, useFirebaseApp, useFirestore, useAuth } from './provider';
export { useUser } from './auth/use-user';
