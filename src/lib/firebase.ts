import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

// SRM Good Foods — Firebase Configuration (configured via environment variables)
const env = (import.meta as any).env || {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
};
export type { User };

// Production hostname configured dynamically via VITE_APP_URL, defaulting to goodfoods.srmtrc.in
export const getProductionHostname = (): string => {
  const envUrl = env.VITE_APP_URL || '';
  if (envUrl) {
    try {
      return new URL(envUrl.startsWith('http') ? envUrl : `https://${envUrl}`).hostname;
    } catch {
      return envUrl.replace(/^https?:\/\//, '').split('/')[0];
    }
  }
  return 'goodfoods.srmtrc.in';
};

// Check if a given hostname is an accepted/authorized domain for SRM Good Foods
export const isDomainAuthorized = (hostname: string): boolean => {
  if (!hostname) return true;
  const prodHost = getProductionHostname().toLowerCase();
  const cleanHost = hostname.toLowerCase().trim();

  // Explicitly authorize goodfoods.srmtrc.in, dynamic VITE_APP_URL, and standard development hosts
  if (
    cleanHost === 'goodfoods.srmtrc.in' ||
    cleanHost === prodHost ||
    cleanHost === 'localhost' ||
    cleanHost === '127.0.0.1' ||
    cleanHost.endsWith('.srmtrc.in') ||
    cleanHost.endsWith('.run.app') ||
    cleanHost.endsWith('.firebaseapp.com') ||
    cleanHost.endsWith('.web.app')
  ) {
    return true;
  }
  return false;
};
