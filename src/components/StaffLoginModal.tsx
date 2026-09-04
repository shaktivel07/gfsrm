import React, { useState, useEffect } from 'react';
import { ChefHat, Bike, ShieldCheck, X, ArrowRight, AlertCircle, Lock, Mail } from 'lucide-react';
import { Logo } from './Logo';
import { apiFetch } from '../lib/api';

interface StaffLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPortal?: 'ADMIN' | 'KITCHEN' | 'DELIVERY';
  onLoginSuccess: (portal: 'KITCHEN' | 'DELIVERY' | 'ADMIN', user: any) => void;
}

export const StaffLoginModal: React.FC<StaffLoginModalProps> = ({
  isOpen,
  onClose,
  defaultPortal = 'ADMIN',
  onLoginSuccess,
}) => {
  const [selectedPortal, setSelectedPortal] = useState<'ADMIN' | 'KITCHEN' | 'DELIVERY'>(defaultPortal);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (defaultPortal) {
      setSelectedPortal(defaultPortal);
    }
  }, [defaultPortal]);

  if (!isOpen) return null;

  const handleLogin = async (u = username, p = password) => {
    setError('');
    setLoading(true);

    try {
      const data = await apiFetch<any>('/api/auth/portal-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });

      onLoginSuccess(data.portal, data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePortalSwitch = (portal: 'ADMIN' | 'KITCHEN' | 'DELIVERY') => {
    setSelectedPortal(portal);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-stone-200 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-stone-400 hover:text-stone-700 transition-colors p-1.5 rounded-full hover:bg-stone-100"
          aria-label="Close portal login"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <Logo size="md" className="mb-2" />
          <h3 className="text-xl font-bold text-stone-900 font-serif">
            Internal Operations Login
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Authorized access for SRM Good Foods Kitchen, Delivery, and Admin teams
          </p>
        </div>

        {/* Portal Switcher Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-2xl mb-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => handlePortalSwitch('ADMIN')}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              selectedPortal === 'ADMIN'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>Admin</span>
          </button>

          <button
            type="button"
            onClick={() => handlePortalSwitch('KITCHEN')}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              selectedPortal === 'KITCHEN'
                ? 'bg-white text-[#942626] shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5 text-[#942626]" />
            <span>Kitchen</span>
          </button>

          <button
            type="button"
            onClick={() => handlePortalSwitch('DELIVERY')}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              selectedPortal === 'DELIVERY'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Bike className="w-3.5 h-3.5 text-emerald-600" />
            <span>Delivery</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Email Address or Username
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={
                  selectedPortal === 'ADMIN'
                    ? 'admin@srmgoodfoods.com or admin'
                    : selectedPortal === 'KITCHEN'
                    ? 'kitchen@srmgoodfoods.com or srm'
                    : 'delivery@srmgoodfoods.com or delivery'
                }
                required
                className="w-full pl-10 pr-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium text-stone-900 focus:bg-white focus:ring-2 focus:ring-[#942626] focus:border-[#942626] outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Portal Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium text-stone-900 focus:bg-white focus:ring-2 focus:ring-[#942626] focus:border-[#942626] outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#1c1917] hover:bg-black text-white rounded-xl font-bold shadow-md disabled:opacity-50 text-xs transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? 'Authenticating...' : `Enter ${selectedPortal} Portal`}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
