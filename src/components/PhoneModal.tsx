import React, { useState } from 'react';
import { Phone, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { UserProfile } from '../types';
import { apiFetch } from '../lib/api';

interface PhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserProfile;
  firebaseUid?: string;
  currentPhone?: string;
  onPhoneUpdated?: (updatedUser: UserProfile) => void;
  onPhoneSaved?: (newPhone: string) => void;
}

export const PhoneModal: React.FC<PhoneModalProps> = ({
  isOpen,
  onClose,
  user,
  firebaseUid,
  currentPhone,
  onPhoneUpdated,
  onPhoneSaved,
}) => {
  const initialPhone = (currentPhone || user?.phone || '').replace(/^\+91/, '');
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const p = (currentPhone || user?.phone || '').replace(/^\+91/, '');
      setPhone(p);
      setError('');
    }
  }, [isOpen, currentPhone, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Clean Indian mobile phone or general phone format
    const cleaned = phone.replace(/[\s-]/g, '');
    if (cleaned.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    const targetUid = user?.firebase_uid || firebaseUid;
    if (!targetUid) {
      setError('User identifier missing. Please re-authenticate.');
      return;
    }

    const formattedPhone = cleaned.startsWith('+91') ? cleaned : `+91${cleaned.slice(-10)}`;

    setLoading(true);
    try {
      const data = await apiFetch<any>('/api/auth/update-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid: targetUid,
          phone: formattedPhone,
        }),
      });

      if (onPhoneUpdated && data.user) onPhoneUpdated(data.user);
      if (onPhoneSaved) onPhoneSaved(formattedPhone);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center gap-3 mb-4 text-[#942626]">
          <div className="p-3 bg-red-50 rounded-xl">
            <Phone className="w-6 h-6 text-[#942626]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-stone-900">Phone Number Required</h3>
            <p className="text-xs text-stone-500">SRM Good Foods Food Delivery Policy</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-5 flex items-start gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            Our campus delivery partners require your mobile number to coordinate delivery and verify your order with OTP.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Contact Mobile Number
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-500">
                +91
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="98765 43210"
                maxLength={10}
                required
                className="w-full pl-14 pr-4 py-3 border border-stone-300 rounded-xl text-stone-900 font-medium focus:ring-2 focus:ring-[#942626] focus:border-[#942626] outline-none text-base transition-all"
              />
            </div>
            {error && <p className="text-xs text-red-600 mt-1.5 font-medium">{error}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-stone-200 rounded-xl text-stone-700 font-medium hover:bg-stone-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || phone.length < 10}
              className="flex-1 py-3 px-4 bg-[#942626] hover:bg-[#7b1f1f] text-white rounded-xl font-semibold shadow-md disabled:opacity-50 flex items-center justify-center gap-2 text-sm transition-all"
            >
              {loading ? (
                'Saving...'
              ) : (
                <>
                  <span>Save & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
