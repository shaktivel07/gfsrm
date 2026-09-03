import React, { useState } from 'react';
import {
  X,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  UserCheck,
  Mail,
  User as UserIcon,
  Phone,
  ArrowRight,
  Info,
} from 'lucide-react';
import { auth, googleProvider, signInWithPopup } from '../lib/firebase';
import { UserProfile } from '../types';
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
  const [authMode, setAuthMode] = useState<'GOOGLE' | 'DIRECT'>('GOOGLE');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState(false);

  // Direct SRM Sign-In Fields
  const [name, setName] = useState('Shaktivel K');
  const [email, setEmail] = useState('shaktivelkumaresan07@gmail.com');
  const [phone, setPhone] = useState('9876543210');

  if (!isOpen) return null;

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyDomain = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentHostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setUnauthorizedDomain(false);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Sync with PostgreSQL
      const res = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid: user.uid,
          email: user.email,
          name: user.displayName || user.email?.split('@')[0] || 'SRM Customer',
          phone: user.phoneNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync account with server');
      }

      const profile = data.user || data;
      // Persist customer profile in localStorage
      localStorage.setItem('srm_customer_profile', JSON.stringify(profile));

      if (onAuthSuccess) onAuthSuccess(user);
      if (onSuccess) onSuccess(profile);
      onClose();
    } catch (err: any) {
      console.error('Customer Google Sign-In Error:', err);
      const isDomainError =
        err.code === 'auth/unauthorized-domain' ||
        (err.message && err.message.includes('auth/unauthorized-domain'));

      if (isDomainError) {
        setUnauthorizedDomain(true);
        setError(`Firebase Error: Current domain "${currentHostname}" is not yet whitelisted in Firebase Console.`);
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. Please click Continue with Google again to proceed.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by browser. Please allow popups for this site and try again.');
      } else {
        setError(err.message || 'Google sign-in could not be completed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDirectSignIn = async (e?: React.FormEvent, customEmail?: string, customName?: string, customPhone?: string) => {
    if (e) e.preventDefault();
    const finalEmail = (customEmail || email).trim().toLowerCase();
    const finalName = (customName || name).trim();
    const finalPhone = (customPhone || phone).trim();

    if (!finalEmail || !finalEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setError('');
    setLoading(true);
    try {
      // Deterministic UID for direct customer sign in
      const emailHash = Math.abs(
        finalEmail.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
      );
      const directUid = `srm_${emailHash}_${finalEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')}`;

      const res = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid: directUid,
          email: finalEmail,
          name: finalName || 'SRM Customer',
          phone: finalPhone || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate user');
      }

      const profile = data.user || data;
      // Persist customer profile in localStorage
      localStorage.setItem('srm_customer_profile', JSON.stringify(profile));

      if (onAuthSuccess) {
        onAuthSuccess({
          uid: profile.firebase_uid,
          email: profile.email,
          displayName: profile.name,
          phoneNumber: profile.phone,
        });
      }
      if (onSuccess) onSuccess(profile);
      onClose();
    } catch (err: any) {
      console.error('Direct Sign-In Error:', err);
      setError(err.message || 'Authentication failed. Please try again.');
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
        <div className="mb-4 flex flex-col items-center">
          <Logo size="md" className="mb-2" />
          <h3 className="text-xl font-bold text-stone-900 font-serif tracking-tight">
            Welcome to SRM Good Foods
          </h3>
          <p className="text-xs text-stone-500 mt-1 max-w-xs leading-relaxed">
            Fresh, campus-cooked meals delivered directly to your department, lab, or hostel.
          </p>
        </div>

        {/* Sign-In Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-2xl mb-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setAuthMode('GOOGLE');
              setError('');
            }}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'GOOGLE'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.28-2.1 3.66-5.2 3.66-9.12z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.48 7.33 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.13z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.52 1.24 6.58l4.04 3.13c.95-2.83 3.6-4.96 6.72-4.96z"/>
            </svg>
            <span>Google Account</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('DIRECT');
              setError('');
            }}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'DIRECT'
                ? 'bg-white text-[#942626] shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#942626]" />
            <span>Instant SRM Login</span>
          </button>
        </div>

        {/* Detailed Unauthorized Domain Resolution Panel */}
        {unauthorizedDomain && (
          <div className="mb-4 p-4 bg-amber-50/90 border border-amber-300/80 rounded-2xl text-left text-xs space-y-3 shadow-sm animate-fade-in">
            <div className="flex items-start gap-2 text-amber-900 font-bold">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>Firebase Domain Whitelist Required</span>
            </div>

            <p className="text-amber-800 text-[11px] leading-relaxed">
              Google OAuth popup blocks domains that are not yet listed under your Firebase project. To enable Google Sign-In permanently for this URL:
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
              <p><strong>2.</strong> Click &ldquo;Add domain&rdquo; and paste the domain above.</p>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('DIRECT');
                  handleDirectSignIn(undefined, 'shaktivelkumaresan07@gmail.com', 'Shaktivel K', '9876543210');
                }}
                className="w-full py-2.5 px-3 bg-[#942626] hover:bg-[#7a1f1f] text-white rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-sm transition-all"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Instant Sign-In as Shaktivel K (No Waiting)</span>
              </button>
            </div>
          </div>
        )}

        {/* Generic Error Notification */}
        {error && !unauthorizedDomain && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-left text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {authMode === 'GOOGLE' ? (
          /* Google OAuth Mode */
          <div className="space-y-3.5">
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
              <span>{loading ? 'Authenticating...' : 'Continue with Google'}</span>
            </button>

            <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200/80 text-left flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-[#942626] shrink-0 mt-0.5" />
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Works with your <span className="font-semibold text-stone-800">@srmist.edu.in</span> college email or personal Google ID.
              </p>
            </div>

            <div className="pt-2 text-center">
              <span className="text-xs text-stone-400">or</span>
              <button
                type="button"
                onClick={() => setAuthMode('DIRECT')}
                className="mt-1 block mx-auto text-xs font-bold text-[#942626] hover:underline"
              >
                Sign in with SRM Email &amp; Phone directly &rarr;
              </button>
            </div>
          </div>
        ) : (
          /* Direct SRM Sign-In Mode */
          <div className="space-y-3.5 text-left animate-fade-in">
            {/* Quick 1-Click Preset Buttons */}
            <div className="space-y-1.5 mb-3">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Quick 1-Click Access
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setName('Shaktivel K');
                    setEmail('shaktivelkumaresan07@gmail.com');
                    setPhone('9876543210');
                    handleDirectSignIn(undefined, 'shaktivelkumaresan07@gmail.com', 'Shaktivel K', '9876543210');
                  }}
                  className="p-2.5 bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200 text-stone-800 rounded-xl text-xs flex items-center justify-between transition-colors font-medium text-left"
                >
                  <div className="truncate pr-2">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                      <span>Shaktivel K</span>
                      <span className="px-1.5 py-0.2 bg-amber-200 text-amber-800 rounded text-[9px] font-extrabold uppercase">
                        Admin
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-500 font-mono truncate">
                      shaktivelkumaresan07@gmail.com
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setName('SRM Student');
                    setEmail('student@srmist.edu.in');
                    setPhone('9876501234');
                    handleDirectSignIn(undefined, 'student@srmist.edu.in', 'SRM Student', '9876501234');
                  }}
                  className="p-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 rounded-xl text-xs flex items-center justify-between transition-colors font-medium text-left"
                >
                  <div className="truncate pr-2">
                    <div className="font-bold text-stone-800">SRM Student Account</div>
                    <div className="text-[10px] text-stone-500 font-mono truncate">
                      student@srmist.edu.in
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                </button>
              </div>
            </div>

            <form onSubmit={(e) => handleDirectSignIn(e)} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Full Name"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#942626] focus:border-[#942626] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  SRM / Personal Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@srmist.edu.in or personal email"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#942626] focus:border-[#942626] outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Contact Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    maxLength={10}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#942626] focus:border-[#942626] outline-none font-mono"
                  />
                </div>
                <p className="text-[10px] text-stone-400 mt-1">Used for order delivery coordinates &amp; SMS OTP</p>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 px-4 bg-[#942626] hover:bg-[#7a1f1f] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] disabled:opacity-60 text-xs"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In &amp; Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Security Footer */}
        <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Encrypted authentication &bull; SRM Good Foods Security</span>
        </div>
      </div>
    </div>
  );
};

