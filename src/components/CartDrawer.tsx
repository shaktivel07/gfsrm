import React, { useState } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  MapPin,
  UtensilsCrossed,
  CreditCard,
  AlertCircle,
  Clock,
  Sparkles,
  Phone,
} from 'lucide-react';
import { FoodItem, DeliveryLocation, UserProfile } from '../types';

interface CartItem extends FoodItem {
  quantity: number;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  locations: DeliveryLocation[];
  user: UserProfile | null;
  onUpdateQuantity: (itemId: number, delta: number) => void;
  onClearCart: () => void;
  onRequireAuth: () => void;
  onRequirePhone: () => void;
  onOrderSuccess: (order: any) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  locations,
  user,
  onUpdateQuantity,
  onClearCart,
  onRequireAuth,
  onRequirePhone,
  onOrderSuccess,
}) => {
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>(
    locations.length > 0 ? locations[0].id : ''
  );
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Keep selectedLocationId synchronized whenever locations load or change
  React.useEffect(() => {
    if ((!selectedLocationId || !locations.some((l) => l.id === selectedLocationId)) && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId]);

  if (!isOpen) return null;

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    setError('');

    // 1. Authentication check
    if (!user) {
      onRequireAuth();
      return;
    }

    // 2. Phone number check (strictly mandatory per prompt)
    if (!user.phone) {
      onRequirePhone();
      return;
    }

    // 3. Location check
    if (!selectedLocationId) {
      setError('Please select your campus delivery location');
      return;
    }

    if (cart.length === 0) {
      setError('Your food basket is empty');
      return;
    }

    // 4. Ensure Razorpay checkout script is loaded
    if (typeof (window as any).Razorpay === 'undefined') {
      setError('Razorpay SDK is initializing. Please check your internet connection and try again.');
      return;
    }

    setLoading(true);

    try {
      // Step A: Create order on backend with Razorpay API
      const createRes = await fetch('/api/orders/create-razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid: user.firebase_uid,
          items: cart.map((i) => ({ food_item_id: i.id, quantity: i.quantity, name: i.name })),
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        if (createData.code === 'PHONE_REQUIRED') {
          onRequirePhone();
          return;
        }
        throw new Error(createData.error || 'Failed to initiate Razorpay order');
      }

      // Step B: Launch Razorpay Checkout Popup
      const options = {
        key: createData.key_id || 'rzp_test_TXY51X8Iwi53nE',
        amount: createData.amount,
        currency: createData.currency || 'INR',
        name: 'SRM Good Foods',
        description: `Order of ${cart.length} item(s)`,
        image: 'https://srmgoodfoods.com/wp-content/uploads/2024/06/srm-goodfoods-logo-1-1024x641.png',
        order_id: createData.razorpay_order_id,
        prefill: {
          name: user.name || 'SRM Customer',
          email: user.email || '',
          contact: user.phone || '',
        },
        theme: {
          color: '#942626',
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
        handler: async (response: any) => {
          // Step C: Verify Razorpay signature server-side and record order in PostgreSQL
          try {
            const verifyRes = await fetch('/api/orders/verify-and-place', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                firebase_uid: user.firebase_uid,
                delivery_location_id: selectedLocationId,
                kitchen_notes: kitchenNotes,
                items: cart.map((i) => ({ food_item_id: i.id, quantity: i.quantity })),
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Payment verification failed');
            }

            // Successfully recorded in PostgreSQL
            onClearCart();
            onClose();
            onOrderSuccess(verifyData.order);
          } catch (err: any) {
            console.error('Order verification error:', err);
            setError(err.message || 'Payment was received but order recording failed. Please contact SRM support.');
          } finally {
            setLoading(false);
          }
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        setLoading(false);
        setError(`Payment failed: ${response.error.description || 'Transaction cancelled'}`);
      });
      rzp.open();
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Unable to start checkout');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-fade-in flex justify-end">
      <div className="w-full max-w-md bg-[#faf7f2] h-full flex flex-col shadow-2xl border-l border-stone-200">
        {/* Header */}
        <div className="p-4 bg-[#942626] text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <UtensilsCrossed className="w-5 h-5 text-[#f6ce72]" />
            <h2 className="font-bold text-lg tracking-wide">Your Food Basket</h2>
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full font-semibold">
              {cart.reduce((n, i) => n + i.quantity, 0)} items
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-stone-500">
              <UtensilsCrossed className="w-12 h-12 text-stone-300 mb-3" />
              <p className="font-semibold text-stone-700">Your basket is empty</p>
              <p className="text-xs text-stone-400 mt-1 max-w-[200px]">
                Browse our delicious menu and add freshly made meals to your cart.
              </p>
            </div>
          ) : (
            <>
              {/* Items List */}
              <div className="space-y-2.5">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white rounded-xl border border-stone-200/80 shadow-sm flex items-center gap-3"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-14 h-14 rounded-lg object-cover bg-stone-100 shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-red-50 text-[#942626] flex items-center justify-center font-bold text-xs shrink-0">
                        SRM
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-stone-900 truncate">{item.name}</h4>
                      <p className="text-xs text-[#942626] font-bold mt-0.5">
                        ₹{item.price} <span className="text-stone-400 font-normal">each</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 bg-stone-100 rounded-lg p-1">
                      <button
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="w-6 h-6 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-white rounded transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-stone-800 w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="w-6 h-6 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-white rounded transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right min-w-[50px]">
                      <span className="text-xs font-bold text-stone-900">
                        ₹{item.price * item.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Location Selector */}
              <div className="p-3.5 bg-white rounded-xl border border-stone-200/80 shadow-sm space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                  <MapPin className="w-4 h-4 text-[#942626]" />
                  <span>Campus Delivery Location</span>
                </div>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(Number(e.target.value))}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium text-stone-800 outline-none focus:ring-2 focus:ring-[#942626]"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.description ? `(${loc.description})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kitchen Cooking Notes */}
              <div className="p-3.5 bg-white rounded-xl border border-stone-200/80 shadow-sm space-y-1.5">
                <label className="text-xs font-bold text-stone-800 block">
                  Kitchen Notes / Cooking Instructions (Optional)
                </label>
                <textarea
                  value={kitchenNotes}
                  onChange={(e) => setKitchenNotes(e.target.value)}
                  placeholder="e.g., Less spicy, no cutlery, call upon arrival..."
                  rows={2}
                  className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-800 outline-none focus:ring-2 focus:ring-[#942626]"
                />
              </div>

              {/* User Phone Warning if missing */}
              {user && !user.phone && (
                <div
                  onClick={onRequirePhone}
                  className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between cursor-pointer hover:bg-amber-100/70 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs text-amber-900 font-semibold">
                    <Phone className="w-4 h-4 text-amber-700" />
                    <span>Phone number is required to order</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#942626] underline">Add now</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Summary & Checkout */}
        {cart.length > 0 && (
          <div className="p-4 bg-white border-t border-stone-200 space-y-3 shadow-lg">
            <div className="space-y-1.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-stone-900">₹{totalAmount}</span>
              </div>
              <div className="flex justify-between">
                <span>Campus Delivery</span>
                <span className="text-emerald-600 font-semibold">FREE</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-stone-900 pt-2 border-t border-stone-100">
                <span>Total Payable</span>
                <span className="text-[#942626] font-extrabold text-base">₹{totalAmount}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[#942626] hover:bg-[#7a1f1f] text-white rounded-xl font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-2 text-sm transition-all"
            >
              {loading ? (
                <span>Securing Razorpay Gateway...</span>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 text-[#f6ce72]" />
                  <span>Pay ₹{totalAmount} via Razorpay</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-stone-400 font-medium">
              <span>Only verified Razorpay transactions recorded in PostgreSQL</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
