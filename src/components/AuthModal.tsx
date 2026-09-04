import React, { useState } from 'react';
import {
  X,
  AlertCircle,
  ShieldCheck,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import {
  auth,
  googleProvider,
  signInWithPopup,
} from '../lib/firebase';
import { UserProfile } from '../types';
import { apiFetch } from '../lib/api';
import { Logo } from './Logo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: (user: any) => void;
  onSuccess?: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  onSuccess,
}) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState(false);

  if (!isOpen) return null;

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyDomain = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentHostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  // Helper to sync Firebase user with PostgreSQL database
  const syncWithBackend = async (firebaseUser: any, displayName?: string) => {
    const data = await apiFetch<any>('/api/auth/sync-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firebase_uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'SRM Customer',
        phone: firebaseUser.phoneNumber || null,
      }),
    });

    const profile = data.user || data;
    localStorage.setItem('srm_customer_profile', JSON.stringify(profile));

    if (onAuthSuccess) onAuthSuccess(firebaseUser);
    if (onSuccess) onSuccess(profile);
    onClose();
  };

  // Firebase Google Sign-In
  const handleGoogleSignIn = async () => {
    setError('');
    setUnauthorizedDomain(false);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await syncWithBackend(result.user);
    } catch (err: any) {
      console.error('Firebase Google Sign-In Error:', err);
      const isDomainError =
        err.code === 'auth/unauthorized-domain' ||
        (err.message && err.message.includes('auth/unauthorized-domain'));

      if (isDomainError) {
        setUnauthorizedDomain(true);
        setError(`Domain Authorization Required: "${currentHostname}" must be added to Authorized Domains in Firebase Console.`);
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed before completing. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site.');
      } else {
        setError(err.message || 'Firebase Google authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-stone-200 relative text-center max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-stone-400 hover:text-stone-700 transition-colors p-1.5 rounded-full hover:bg-stone-100"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Logo & Header */}
        <div className="mb-6 flex flex-col items-center">
          <Logo size="md" className="mb-2" />
          <h3 className="text-xl font-bold text-stone-900 font-serif tracking-tight">
            Customer Sign In
          </h3>
          <p className="text-xs text-stone-500 mt-1.5 max-w-xs leading-relaxed">
            Sign in with your Google account to place orders, track live food delivery, and view receipts.
          </p>
        </div>

        {/* Domain Whitelist Notification (Shown only if Firebase rejects domain) */}
        {unauthorizedDomain && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-2xl text-left text-xs space-y-3 shadow-sm animate-fade-in">
            <div className="flex items-start gap-2 text-amber-900 font-bold">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>Firebase Domain Authorization</span>
            </div>

            <p className="text-amber-800 text-[11px] leading-relaxed">
              Google OAuth popup requires this domain to be listed under your Firebase project:
            </p>

            <div className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between gap-2">
              <div className="font-mono text-[10px] text-stone-700 truncate select-all">
                {currentHostname}
              </div>
              <button
                type="button"
                onClick={handleCopyDomain}
                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors"
              >
                {copiedDomain ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedDomain ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <div className="text-[10px] text-stone-600 space-y-1 bg-amber-100/50 p-2 rounded-xl">
              <p><strong>1.</strong> Open Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</p>
              <p><strong>2.</strong> Add the domain above to allow Google popup sign-in.</p>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && !unauthorizedDomain && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-left text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Primary Firebase Sign-In: Google */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3.5 px-5 bg-white hover:bg-stone-50 border-2 border-stone-200 hover:border-stone-400 text-stone-800 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-sm active:scale-[0.99] disabled:opacity-60 text-sm"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-stone-400 border-t-[#942626] rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.28-2.1 3.66-5.2 3.66-9.12z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.48 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.13z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.52 1.24 6.58l4.04 3.13c.95-2.83 3.6-4.96 6.72-4.96z"/>
              </svg>
            )}
            <span>{loading ? 'Connecting to Firebase...' : 'Continue with Google'}</span>
          </button>
        </div>

        {/* Security Footer */}
        <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Protected by Firebase Authentication</span>
        </div>
      </div>
    </div>
  );
};
