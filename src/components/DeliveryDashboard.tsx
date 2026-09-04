import React, { useEffect, useState } from 'react';
import {
  Bike,
  Phone,
  MapPin,
  KeyRound,
  CheckCircle2,
  Clock,
  LogOut,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { Order } from '../types';
import { Logo } from './Logo';
import { apiFetch } from '../lib/api';

interface DeliveryDashboardProps {
  onLogout: () => void;
}

export const DeliveryDashboard: React.FC<DeliveryDashboardProps> = ({ onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [filter, setFilter] = useState<'PENDING_DELIVERY' | 'COMPLETED' | 'ALL'>('PENDING_DELIVERY');

  const fetchOrders = async () => {
    try {
      const data = await apiFetch<Order[]>('/api/orders/delivery');
      if (data) {
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to load delivery orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 7000);
    return () => clearInterval(interval);
  }, []);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setOtpError('');
    setOtpSuccess('');

    if (otpInput.trim().length !== 4) {
      setOtpError('Please enter the full 4-digit OTP provided by the customer');
      return;
    }

    setVerifying(true);
    try {
      await apiFetch(`/api/orders/${selectedOrder.id}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otpInput.trim(), actor: 'Delivery Executive' }),
      });

      setOtpSuccess('OTP verified successfully! Order marked as Delivered.');
      setTimeout(() => {
        setSelectedOrder(null);
        setOtpInput('');
        setOtpSuccess('');
        fetchOrders();
      }, 1500);
    } catch (err: any) {
      setOtpError(err.message || 'OTP verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'PENDING_DELIVERY') {
      return o.status === 'DISPATCHED' || o.status === 'PREPARING' || o.status === 'CONFIRMED';
    }
    if (filter === 'COMPLETED') return o.status === 'DELIVERED';
    return true;
  });

  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;
  const activeCount = orders.filter(
    (o) => o.status === 'DISPATCHED' || o.status === 'PREPARING'
  ).length;

  return (
    <div className="min-h-screen bg-[#faf7f2] text-stone-900 pb-20">
      {/* Top Header */}
      <div className="bg-[#1c1917] text-white px-4 sm:px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="sm" className="bg-white/10 p-1.5 rounded-xl backdrop-blur-sm" />
            <div>
              <h1 className="font-extrabold text-lg sm:text-xl font-serif tracking-wide text-white">
                SRM Delivery Partner
              </h1>
              <p className="text-[11px] text-emerald-400 font-medium">Active Campus Courier Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchOrders()}
              className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-red-950/70 text-red-300 rounded-xl text-xs font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Quick Stats Banner */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                Active Trips
              </span>
              <span className="text-xl font-black text-stone-900">{activeCount}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                Delivered
              </span>
              <span className="text-xl font-black text-stone-900">{deliveredCount}</span>
            </div>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="flex items-center gap-2 bg-stone-200/70 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setFilter('PENDING_DELIVERY')}
            className={`flex-1 py-2 rounded-lg transition-all ${
              filter === 'PENDING_DELIVERY' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
            }`}
          >
            Assigned / Active ({activeCount})
          </button>
          <button
            onClick={() => setFilter('COMPLETED')}
            className={`flex-1 py-2 rounded-lg transition-all ${
              filter === 'COMPLETED' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
            }`}
          >
            Completed ({deliveredCount})
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filter === 'ALL' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
            }`}
          >
            All
          </button>
        </div>

        {/* Orders Feed */}
        {loading ? (
          <div className="text-center py-16 text-stone-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#942626]" />
            <p className="text-xs">Loading delivery assignments...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
            <Bike className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="font-bold text-base text-stone-800">No deliveries in this section</h3>
            <p className="text-xs text-stone-500 mt-1">
              Active campus delivery orders will be displayed here for real-time OTP fulfillment.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const isDelivered = order.status === 'DELIVERED';

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
                    isDelivered ? 'border-stone-200 opacity-80' : 'border-stone-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                    <div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                        Order Number
                      </span>
                      <h3 className="text-base font-extrabold font-mono text-stone-900">
                        #{order.order_number}
                      </h3>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          isDelivered
                            ? 'bg-emerald-100 text-emerald-800'
                            : order.status === 'DISPATCHED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {order.status}
                      </span>
                      <span className="block text-[11px] font-bold text-[#942626] mt-1">
                        ₹{order.total_amount} (Paid)
                      </span>
                    </div>
                  </div>

                  {/* Customer Info & Location */}
                  <div className="py-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500">Customer:</span>
                      <span className="font-bold text-stone-900">{order.customer_name || 'Customer'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-stone-500">Delivery Location:</span>
                      <div className="flex items-center gap-1 font-bold text-[#942626]">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{order.location_name_snapshot || 'Campus'}</span>
                      </div>
                    </div>

                    {order.customer_phone && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-stone-500">Contact:</span>
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-bold border border-emerald-200 hover:bg-emerald-100"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Call {order.customer_phone}</span>
                        </a>
                      </div>
                    )}

                    {order.kitchen_notes && (
                      <div className="p-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-600 italic">
                        Note: "{order.kitchen_notes}"
                      </div>
                    )}
                  </div>

                  {/* Verification CTA */}
                  {!isDelivered && (
                    <div className="pt-3 border-t border-stone-100">
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setOtpInput('');
                          setOtpError('');
                          setOtpSuccess('');
                        }}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>Verify Customer OTP & Handover</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* OTP Verification Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 relative">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900">Verify Delivery OTP</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Order <strong className="font-mono text-stone-900">#{selectedOrder.order_number}</strong>
              </p>
            </div>

            {otpError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            {otpSuccess && (
              <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{otpSuccess}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 text-center mb-2">
                  Enter 4-Digit Code
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  autoFocus
                  required
                  className="w-full text-center text-3xl font-mono font-black tracking-widest py-3 border-2 border-stone-300 rounded-2xl focus:border-emerald-600 outline-none text-stone-900"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 py-3 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying || otpInput.length < 4}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  {verifying ? 'Verifying...' : 'Confirm Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
