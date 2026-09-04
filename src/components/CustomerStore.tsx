import React, { useState } from 'react';
import {
  Clock,
  Plus,
  Minus,
  AlertTriangle,
  Sparkles,
  ShoppingBag,
  Info,
  CheckCircle,
} from 'lucide-react';
import { FoodCategory, FoodItem, RestaurantSettings } from '../types';

interface CartItem extends FoodItem {
  quantity: number;
}

interface CustomerStoreProps {
  categories: FoodCategory[];
  items: FoodItem[];
  settings: RestaurantSettings | null;
  cart: CartItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onAddToCart: (item: FoodItem) => void;
  onUpdateQuantity: (itemId: number, delta: number) => void;
  onOpenCart: () => void;
}

export const CustomerStore: React.FC<CustomerStoreProps> = ({
  categories,
  items,
  settings,
  cart,
  isLoading = false,
  error = null,
  onRetry,
  onAddToCart,
  onUpdateQuantity,
  onOpenCart,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Helper to check if current time falls within available_start_time and available_end_time
  const isItemAvailableByTime = (item: FoodItem) => {
    if (!item.available_start_time || !item.available_end_time) {
      return { isAvailable: true, message: null };
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = item.available_start_time.split(':').map(Number);
    const [endH, endM] = item.available_end_time.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const formatTime = (h: number, m: number) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedH = h % 12 || 12;
      const formattedM = m < 10 ? `0${m}` : m;
      return `${formattedH}:${formattedM} ${ampm}`;
    };

    const timeRangeStr = `${formatTime(startH, startM)} - ${formatTime(endH, endM)}`;

    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return { isAvailable: true, message: `Serving now (${timeRangeStr})` };
    } else {
      return { isAvailable: false, message: `Only available ${timeRangeStr}` };
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory =
      selectedCategory === 'ALL' || item.category_id === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const isShopOpen = settings ? settings.is_open_today : true;

  return (
    <div className="pb-24 max-w-5xl mx-auto px-4 sm:px-6 pt-4">
      {/* Restaurant Status Banner */}
      {!isShopOpen && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 shadow-sm animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Restaurant Currently Closed</h4>
            <p className="text-xs text-red-700 mt-0.5">
              {settings?.closed_message || 'The kitchen is not accepting new orders today.'}
            </p>
          </div>
        </div>
      )}

      {/* Hero Welcome / Timings Info */}
      <div className="bg-gradient-to-r from-[#942626] to-[#781c1c] text-white rounded-3xl p-6 sm:p-8 shadow-xl mb-8 relative overflow-hidden">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#f6ce72]/20 border border-[#f6ce72]/30 rounded-full text-xs font-semibold text-[#f6ce72] mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Campus Dining Excellence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-serif tracking-tight leading-tight">
            Fresh, Delicious Meals Delivered to You
          </h1>
          <p className="text-xs sm:text-sm text-red-100/90 mt-2 leading-relaxed">
            Order your favorite campus meals online with instant Razorpay checkout, live kitchen tracking, and contactless OTP delivery.
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-5 text-xs text-red-100">
            <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-lg backdrop-blur-sm">
              <Clock className="w-4 h-4 text-[#f6ce72]" />
              <span>
                Hours: {settings ? `${settings.opening_time.slice(0, 5)} - ${settings.closing_time.slice(0, 5)}` : '07:00 - 23:00'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-lg backdrop-blur-sm">
              <CheckCircle className="w-4 h-4 text-emerald-300" />
              <span>Direct Campus Delivery</span>
            </div>
          </div>
        </div>

        {/* Decorative Watermark */}
        <div className="absolute -right-6 -bottom-6 opacity-15 pointer-events-none w-56 h-36">
          <img
            src="https://srmgoodfoods.com/wp-content/uploads/2024/06/srm-goodfoods-logo-1-1024x641.png"
            alt=""
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.src = '/srm-goodfoods-logo.png';
            }}
          />
        </div>
      </div>

      {/* Category Pills & Search */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Categories Horizontal Scroll */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-[#942626] text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:border-stone-300'
              }`}
            >
              All Delicacies
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-[#942626] text-white shadow-sm'
                    : 'bg-white text-stone-700 border border-stone-200 hover:border-stone-300'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="w-full px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#942626] shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Network Alert Banner */}
      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Menu service update: {error}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all shadow-xs"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Food Items Grid */}
      {isLoading && items.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-sm p-4 animate-pulse space-y-3"
            >
              <div className="h-44 bg-stone-200 rounded-xl" />
              <div className="h-4 bg-stone-200 rounded w-3/4" />
              <div className="h-3 bg-stone-100 rounded w-1/2" />
              <div className="h-8 bg-stone-200 rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-200 p-8 shadow-sm">
          <Info className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <h3 className="font-bold text-stone-700 text-sm">No items found</h3>
          <p className="text-xs text-stone-500 mt-1">
            Try choosing a different category or search keyword.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all"
            >
              Refresh Menu
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const timeCheck = isItemAvailableByTime(item);
            const cartItem = cart.find((i) => i.id === item.id);
            const canOrder = isShopOpen && item.is_available && timeCheck.isAvailable;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Item Image with Fallback */}
                  <div className="h-44 bg-stone-100 relative overflow-hidden">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-50 to-amber-50 p-4">
                        <img
                          src="https://srmgoodfoods.com/wp-content/uploads/2024/06/srm-goodfoods-logo-1-1024x641.png"
                          alt="SRM Good Foods"
                          className="h-14 w-auto object-contain opacity-70"
                          onError={(e) => {
                            e.currentTarget.src = '/srm-goodfoods-logo.png';
                          }}
                        />
                      </div>
                    )}

                    {/* Time-Slot Duration Tag */}
                    {item.available_start_time && item.available_end_time && (
                      <div
                        className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold backdrop-blur-md shadow-sm ${
                          timeCheck.isAvailable
                            ? 'bg-emerald-800/90 text-white'
                            : 'bg-stone-900/80 text-amber-300'
                        }`}
                      >
                        <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />
                        {timeCheck.message}
                      </div>
                    )}

                    {/* Category Label */}
                    {item.category_name && (
                      <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full text-[10px] font-semibold">
                        {item.category_name}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-stone-900 text-base leading-snug">{item.name}</h3>
                      <span className="text-[#942626] font-extrabold text-base shrink-0">
                        ₹{item.price}
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-xs text-stone-500 mt-1.5 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Action */}
                <div className="p-4 pt-0 border-t border-stone-100 flex items-center justify-between mt-2">
                  <span className="text-[11px] font-medium text-stone-400">
                    {!isShopOpen
                      ? 'Shop closed'
                      : !item.is_available
                      ? 'Sold out'
                      : !timeCheck.isAvailable
                      ? 'Not in time slot'
                      : 'Freshly prepared'}
                  </span>

                  {cartItem ? (
                    <div className="flex items-center gap-2 bg-[#942626] text-white rounded-xl p-1 shadow-sm">
                      <button
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-black/20 rounded-lg transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center">{cartItem.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-black/20 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onAddToCart(item)}
                      disabled={!canOrder}
                      className="px-4 py-2 bg-[#942626] hover:bg-[#7a1f1f] disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Cart Pill (Mobile & Desktop) */}
      {cartCount > 0 && (
        <div className="fixed bottom-5 left-0 right-0 z-40 px-4 flex justify-center pointer-events-none">
          <button
            onClick={onOpenCart}
            className="pointer-events-auto bg-[#942626] hover:bg-[#7a1f1f] text-white px-5 py-3.5 rounded-full shadow-2xl flex items-center gap-4 transition-all transform hover:scale-[1.02] active:scale-95 border-2 border-[#f6ce72]/40"
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShoppingBag className="w-5 h-5 text-[#f6ce72]" />
                <span className="absolute -top-1.5 -right-1.5 bg-white text-[#942626] font-extrabold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              </div>
              <span className="text-xs font-bold tracking-wide uppercase">View Basket</span>
            </div>
            <div className="h-4 w-[1px] bg-white/30" />
            <span className="text-sm font-extrabold text-[#f6ce72]">₹{cartTotal}</span>
          </button>
        </div>
      )}
    </div>
  );
};
