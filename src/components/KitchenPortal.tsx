import React, { useEffect, useState } from 'react';
import {
  ChefHat,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  Bike,
  Flame,
  RefreshCw,
  LogOut,
  AlertCircle,
  KeyRound,
  Filter,
} from 'lucide-react';
import { Order } from '../types';
import { Logo } from './Logo';

interface KitchenPortalProps {
  onLogout: () => void;
}

export const KitchenPortal: React.FC<KitchenPortalProps> = ({ onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'PREPARING' | 'DONE'>('ACTIVE');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders/kitchen');
      const data = await res.json();
      if (res.ok) {
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to load kitchen orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 6000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (orderId: number, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, actor: 'Kitchen Staff' }),
      });
      if (res.ok) {
        await fetchOrders();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ACTIVE') return o.status === 'CONFIRMED' || o.status === 'PREPARING';
    if (filter === 'PREPARING') return o.status === 'PREPARING';
    if (filter === 'DONE') return o.status === 'DELIVERED' || o.status === 'CANCELLED';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#1c1917] text-stone-100 pb-16">
      {/* Kitchen Top Bar */}
      <div className="bg-[#292524] border-b border-stone-700/80 px-4 sm:px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo size="sm" className="bg-white/10 p-1.5 rounded-xl backdrop-blur-sm" />
            <div>
              <h1 className="font-extrabold text-lg sm:text-xl font-serif text-white tracking-wide">
                SRM Kitchen Command
              </h1>
              <p className="text-[11px] text-stone-400">
                Logged in as <span className="text-[#f6ce72] font-semibold">srm / kitchen staff</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center bg-stone-800 p-1 rounded-xl border border-stone-700 text-xs">
              {(['ACTIVE', 'PREPARING', 'DONE', 'ALL'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    filter === f ? 'bg-[#942626] text-white' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  {f === 'ACTIVE' ? 'Incoming & Prep' : f}
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchOrders()}
              className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl border border-stone-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 bg-stone-800 hover:bg-red-950/80 text-red-300 hover:text-red-200 rounded-xl border border-stone-700 text-xs font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Exit Portal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="text-center py-20 text-stone-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#f6ce72]" />
            <p className="text-xs">Loading live kitchen stream...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-24 bg-[#292524] rounded-3xl border border-stone-800 p-8">
            <ChefHat className="w-12 h-12 text-stone-600 mx-auto mb-3" />
            <h3 className="font-bold text-base text-stone-300">No active kitchen orders</h3>
            <p className="text-xs text-stone-500 mt-1">
              New customer orders placed with Razorpay will immediately show here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOrders.map((order) => {
              const isPending = order.status === 'CONFIRMED';
              const isPrep = order.status === 'PREPARING';
              const isDispatched = order.status === 'DISPATCHED';
              const isDelivered = order.status === 'DELIVERED';

              return (
                <div
                  key={order.id}
                  className={`bg-[#292524] rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-lg ${
                    isPending
                      ? 'border-amber-500/80 ring-1 ring-amber-500/40'
                      : isPrep
                      ? 'border-orange-500/80'
                      : isDispatched
                      ? 'border-blue-500/50'
                      : 'border-stone-800 opacity-75'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 bg-stone-900/60 border-b border-stone-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                        Order #
                      </span>
                      <h3 className="text-lg font-mono font-black text-white">{order.order_number}</h3>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          isPending
                            ? 'bg-amber-500 text-stone-950 animate-pulse'
                            : isPrep
                            ? 'bg-orange-500 text-stone-950'
                            : isDispatched
                            ? 'bg-blue-600 text-white'
                            : isDelivered
                            ? 'bg-emerald-600 text-white'
                            : 'bg-stone-700 text-stone-300'
                        }`}
                      >
                        {order.status}
                      </span>
                      <span className="block text-[10px] text-stone-400 mt-1">
                        {new Date(order.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Customer & Location */}
                  <div className="p-4 space-y-3 flex-1">
                    <div className="flex items-center justify-between text-xs text-stone-300 bg-stone-800/80 p-2.5 rounded-xl border border-stone-700/60">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#f6ce72] shrink-0" />
                        <span className="font-semibold text-white">
                          {order.location_name_snapshot || 'Campus Location'}
                        </span>
                      </div>
                      {order.customer_phone && (
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="flex items-center gap-1 text-emerald-400 hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{order.customer_phone}</span>
                        </a>
                      )}
                    </div>

                    {/* Customer Cooking Notes */}
                    {order.kitchen_notes && (
                      <div className="p-2.5 bg-amber-950/40 border border-amber-800/50 rounded-xl text-xs text-amber-300">
                        <strong className="block text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-0.5">
                          Kitchen Instruction:
                        </strong>
                        "{order.kitchen_notes}"
                      </div>
                    )}

                    {/* Line Items List */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                        Dishes to Prepare:
                      </span>
                      {order.items?.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-stone-800/40 p-2 rounded-lg text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-[#942626] text-white rounded font-bold flex items-center justify-center text-[11px]">
                              {item.quantity}
                            </span>
                            <span className="font-semibold text-stone-200">
                              {item.item_name || item.name}
                            </span>
                          </div>
                          <span className="text-stone-400">₹{item.subtotal}</span>
                        </div>
                      ))}
                    </div>

                    {/* OTP Snapshot */}
                    {order.raw_otp && (
                      <div className="mt-2 text-[11px] text-stone-400 flex items-center gap-1.5 bg-stone-900/40 px-2.5 py-1.5 rounded-lg">
                        <KeyRound className="w-3.5 h-3.5 text-[#f6ce72]" />
                        <span>
                          Customer OTP: <strong className="text-[#f6ce72] font-mono">{order.raw_otp}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status Action Buttons */}
                  <div className="p-4 bg-stone-900/80 border-t border-stone-800 flex flex-wrap gap-2">
                    {isPending && (
                      <button
                        onClick={() => updateStatus(order.id, 'PREPARING')}
                        disabled={updatingId === order.id}
                        className="flex-1 py-2.5 px-3 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                      >
                        <Flame className="w-4 h-4" />
                        <span>Accept & Start Prep</span>
                      </button>
                    )}

                    {isPrep && (
                      <button
                        onClick={() => updateStatus(order.id, 'DISPATCHED')}
                        disabled={updatingId === order.id}
                        className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                      >
                        <Bike className="w-4 h-4" />
                        <span>Mark Dispatched</span>
                      </button>
                    )}

                    {(isPrep || isDispatched) && (
                      <button
                        onClick={() => updateStatus(order.id, 'DELIVERED')}
                        disabled={updatingId === order.id}
                        className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark Delivered</span>
                      </button>
                    )}

                    {isDelivered && (
                      <div className="w-full text-center py-2 text-xs font-bold text-emerald-400 bg-emerald-950/40 rounded-xl border border-emerald-900/60 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Completed & Delivered</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
