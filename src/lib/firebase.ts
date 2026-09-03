import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

// SRM Good Foods — Firebase Configuration
const env = (import.meta as any).env || {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyAh_wDRiQEmmcRMN8TIlQH_YrkB-ARyIRk',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'srmgoodfoods-trichy.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'srmgoodfoods-trichy',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'srmgoodfoods-trichy.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '444885932223',
  appId: env.VITE_FIREBASE_APP_ID || '1:444885932223:web:6b08572b5d412e7d280e0a',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-FWQNMKEV10',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};
export type { User };
