import React, { useEffect, useState } from 'react';
import {
  PackageCheck,
  ChefHat,
  Bike,
  CheckCircle2,
  Clock,
  KeyRound,
  RefreshCw,
  MapPin,
  Receipt,
  Utensils,
  AlertCircle,
} from 'lucide-react';
import { Order, UserProfile } from '../types';

interface OrderTrackingProps {
  user: UserProfile | null;
  activeOrder: Order | null;
  onSelectOrder: (order: Order) => void;
  onRequireAuth: () => void;
}

export const OrderTracking: React.FC<OrderTrackingProps> = ({
  user,
  activeOrder,
  onSelectOrder,
  onRequireAuth,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(activeOrder);

  const fetchOrders = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`/api/orders/my-orders?firebase_uid=${user.firebase_uid}`);
      const data = await res.json();
      if (res.ok) {
        setOrders(data);
        if (currentOrder) {
          const updated = data.find((o: Order) => o.id === currentOrder.id);
          if (updated) setCurrentOrder(updated);
        } else if (data.length > 0) {
          setCurrentOrder(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchOrders();
      // Poll every 8 seconds for live kitchen / delivery status updates
      const interval = setInterval(() => fetchOrders(true), 8000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (activeOrder) {
      setCurrentOrder(activeOrder);
    }
  }, [activeOrder]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-md">
          <Receipt className="w-12 h-12 text-[#942626] mx-auto mb-3" />
          <h3 className="font-bold text-lg text-stone-900 font-serif">Sign In to Track Orders</h3>
          <p className="text-xs text-stone-500 mt-1 mb-5">
            Log in with your Firebase account to monitor kitchen preparation, track your delivery rider, and view your OTP.
          </p>
          <button
            onClick={onRequireAuth}
            className="w-full py-3 bg-[#942626] hover:bg-[#7a1f1f] text-white rounded-xl font-bold text-sm shadow-md transition-all"
          >
            Sign In with Firebase
          </button>
        </div>
      </div>
    );
  }

  const getStatusStep = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 1;
      case 'PREPARING':
        return 2;
      case 'DISPATCHED':
        return 3;
      case 'DELIVERED':
        return 4;
      case 'CANCELLED':
        return -1;
      default:
        return 1;
    }
  };

  const currentStep = currentOrder ? getStatusStep(currentOrder.status) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 font-serif">
            Live Order Tracking
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">Real-time status synced with SRM Kitchen & Riders</p>
        </div>
        <button
          onClick={() => fetchOrders()}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#942626] ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-stone-200">
          <RefreshCw className="w-8 h-8 text-[#942626] animate-spin mx-auto mb-2" />
          <p className="text-xs text-stone-500 font-medium">Loading your orders from PostgreSQL...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-200 p-8 shadow-sm">
          <Utensils className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="font-bold text-stone-800 text-base">No orders placed yet</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Browse through our menu, select your dishes, and place your order using Razorpay to view real-time tracking here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Order Spotlight */}
          {currentOrder && (
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-3xl border border-stone-200/90 shadow-md p-6 overflow-hidden relative">
                {/* Header info */}
                <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                  <div>
                    <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                      Order ID
                    </span>
                    <h3 className="text-xl font-extrabold text-[#942626] font-mono">
                      #{currentOrder.order_number}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                      Payment
                    </span>
                    <span className="block text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full mt-0.5">
                      Razorpay Verified (₹{currentOrder.total_amount})
                    </span>
                  </div>
                </div>

                {/* Delivery OTP Highlight Box */}
                {currentOrder.raw_otp && currentOrder.status !== 'DELIVERED' && currentOrder.status !== 'CANCELLED' && (
                  <div className="my-5 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-dashed border-amber-300 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-amber-500 text-white rounded-xl shadow-sm">
                        <KeyRound className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                          Delivery Verification Code
                        </span>
                        <p className="text-xs text-amber-700">
                          Share this OTP with your delivery partner to receive your food
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-amber-200 shadow-inner">
                      <span className="text-2xl font-mono font-black tracking-widest text-stone-900">
                        {currentOrder.raw_otp}
                      </span>
                    </div>
                  </div>
                )}

                {/* Status Stepper */}
                <div className="py-6">
                  <div className="grid grid-cols-4 gap-2 text-center relative">
                    {/* Step 1: Confirmed */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          currentStep >= 1
                            ? 'bg-[#942626] text-white shadow-md'
                            : 'bg-stone-100 text-stone-400'
                        }`}
                      >
                        <PackageCheck className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold text-stone-800 mt-2">Placed</span>
                      <span className="text-[10px] text-stone-400">Razorpay Paid</span>
                    </div>

                    {/* Step 2: Preparing */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          currentStep >= 2
                            ? 'bg-[#942626] text-white shadow-md'
                            : 'bg-stone-100 text-stone-400'
                        }`}
                      >
                        <ChefHat className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold text-stone-800 mt-2">Kitchen</span>
                      <span className="text-[10px] text-stone-400">Preparing</span>
                    </div>

                    {/* Step 3: Out for Delivery */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          currentStep >= 3
                            ? 'bg-[#942626] text-white shadow-md'
                            : 'bg-stone-100 text-stone-400'
                        }`}
                      >
                        <Bike className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold text-stone-800 mt-2">Dispatched</span>
                      <span className="text-[10px] text-stone-400">On the way</span>
                    </div>

                    {/* Step 4: Delivered */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          currentStep >= 4
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-stone-100 text-stone-400'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold text-stone-800 mt-2">Delivered</span>
                      <span className="text-[10px] text-stone-400">OTP Verified</span>
                    </div>
                  </div>
                </div>

                {/* Location & Details */}
                <div className="bg-stone-50 rounded-2xl p-4 space-y-2.5 text-xs text-stone-700">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#942626] shrink-0" />
                    <span>
                      Delivery Spot:{' '}
                      <strong className="text-stone-900">
                        {currentOrder.location_name_snapshot || 'Campus Location'}
                      </strong>
                    </span>
                  </div>

                  {currentOrder.kitchen_notes && (
                    <div className="p-2.5 bg-white border border-stone-200 rounded-xl text-stone-600 italic">
                      " {currentOrder.kitchen_notes} "
                    </div>
                  )}

                  {/* Items breakdown */}
                  <div className="pt-2 border-t border-stone-200/80 space-y-1.5">
                    <span className="font-bold text-stone-800 block text-[11px] uppercase tracking-wider">
                      Ordered Items
                    </span>
                    {currentOrder.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-stone-800">
                        <span>
                          {item.quantity}x {item.item_name || item.name}
                        </span>
                        <span className="font-semibold">₹{item.subtotal || item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Past Orders Sidebar List */}
          <div className="space-y-3">
            <h4 className="font-bold text-stone-800 text-sm">Order History</h4>
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {orders.map((ord) => (
                <div
                  key={ord.id}
                  onClick={() => setCurrentOrder(ord)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    currentOrder?.id === ord.id
                      ? 'bg-white border-[#942626] shadow-md ring-1 ring-[#942626]'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold font-mono text-xs text-stone-900">
                      #{ord.order_number}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ord.status === 'DELIVERED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ord.status === 'CANCELLED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>
                      {new Date(ord.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="font-bold text-stone-900">₹{ord.total_amount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
