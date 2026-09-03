import React, { useEffect, useState, useCallback } from 'react';
import {
  ShoppingBag,
  User as UserIcon,
  LogOut,
  ChefHat,
  Bike,
  ShieldCheck,
  Phone,
  Menu as MenuIcon,
  X,
  MapPin,
  Lock,
} from 'lucide-react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { Logo } from './components/Logo';
import { AuthModal } from './components/AuthModal';
import { PhoneModal } from './components/PhoneModal';
import { StaffLoginModal } from './components/StaffLoginModal';
import { CustomerStore } from './components/CustomerStore';
import { CartDrawer } from './components/CartDrawer';
import { OrderTracking } from './components/OrderTracking';
import { KitchenPortal } from './components/KitchenPortal';
import { DeliveryDashboard } from './components/DeliveryDashboard';
import { AdminPortal } from './components/AdminPortal';
import {
  FoodCategory,
  FoodItem,
  DeliveryLocation,
  RestaurantSettings,
  UserProfile,
  Order,
} from './types';

interface CartItem extends FoodItem {
  quantity: number;
}

export default function App() {
  // Navigation & View State
  const [activeView, setActiveView] = useState<'STORE' | 'TRACKING' | 'KITCHEN' | 'DELIVERY' | 'ADMIN'>('STORE');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Customer Authentication State (Persisted in localStorage)
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('srm_customer_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const updateCustomerProfile = (profile: UserProfile | null) => {
    setUserProfile(profile);
    try {
      if (profile) {
        localStorage.setItem('srm_customer_profile', JSON.stringify(profile));
      } else {
        localStorage.removeItem('srm_customer_profile');
      }
    } catch (e) {
      console.error('Failed to sync profile to localStorage:', e);
    }
  };

  // Hidden Staff Session (Persisted in sessionStorage for /admin, /kitchen, /delivery)
  const [staffSession, setStaffSession] = useState<{
    portal: 'KITCHEN' | 'DELIVERY' | 'ADMIN';
    user: any;
  } | null>(() => {
    try {
      const saved = sessionStorage.getItem('srm_staff_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffModalDefaultPortal, setStaffModalDefaultPortal] = useState<'ADMIN' | 'KITCHEN' | 'DELIVERY'>('ADMIN');
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Data Store
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Cart State with LocalStorage sync
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('srm_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('srm_cart', JSON.stringify(cart));
    } catch (err) {
      console.error(err);
    }
  }, [cart]);

  // Load Initial Public Data
  const loadPublicData = async () => {
    try {
      const [catRes, itemRes, locRes, setRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/items'),
        fetch('/api/locations'),
        fetch('/api/settings'),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (itemRes.ok) setItems(await itemRes.json());
      if (locRes.ok) setLocations(await locRes.json());
      if (setRes.ok) setSettings(await setRes.json());
    } catch (err) {
      console.error('Error fetching public menu data:', err);
    }
  };

  useEffect(() => {
    loadPublicData();
  }, []);

  // Hidden Portals Route Detection (/admin, /kitchen, /delivery)
  const syncHiddenPortalRoute = useCallback(() => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');

    if (path === '/admin' || hash === 'admin') {
      const currentStaff = (() => {
        try {
          const s = sessionStorage.getItem('srm_staff_session');
          return s ? JSON.parse(s) : null;
        } catch {
          return null;
        }
      })();

      if (currentStaff?.portal === 'ADMIN') {
        setActiveView('ADMIN');
      } else {
        setStaffModalDefaultPortal('ADMIN');
        setIsStaffModalOpen(true);
      }
    } else if (path === '/kitchen' || hash === 'kitchen') {
      const currentStaff = (() => {
        try {
          const s = sessionStorage.getItem('srm_staff_session');
          return s ? JSON.parse(s) : null;
        } catch {
          return null;
        }
      })();

      if (currentStaff?.portal === 'KITCHEN') {
        setActiveView('KITCHEN');
      } else {
        setStaffModalDefaultPortal('KITCHEN');
        setIsStaffModalOpen(true);
      }
    } else if (path === '/delivery' || hash === 'delivery') {
      const currentStaff = (() => {
        try {
          const s = sessionStorage.getItem('srm_staff_session');
          return s ? JSON.parse(s) : null;
        } catch {
          return null;
        }
      })();

      if (currentStaff?.portal === 'DELIVERY') {
        setActiveView('DELIVERY');
      } else {
        setStaffModalDefaultPortal('DELIVERY');
        setIsStaffModalOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    syncHiddenPortalRoute();
    window.addEventListener('popstate', syncHiddenPortalRoute);
    window.addEventListener('hashchange', syncHiddenPortalRoute);
    return () => {
      window.removeEventListener('popstate', syncHiddenPortalRoute);
      window.removeEventListener('hashchange', syncHiddenPortalRoute);
    };
  }, [syncHiddenPortalRoute]);

  // Sync Firebase Auth with PostgreSQL
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const res = await fetch('/api/auth/sync-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firebase_uid: user.uid,
              email: user.email,
              name: user.displayName,
              phone: user.phoneNumber,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const profile = data.user || data;
            updateCustomerProfile(profile);
            // If phone is missing, prompt customer immediately
            if (!profile.phone) {
              setIsPhoneModalOpen(true);
            }
          }
        } catch (err) {
          console.error('Failed to sync customer with PostgreSQL:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Cart Handlers
  const handleAddToCart = (item: FoodItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (itemId: number, delta: number) => {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.id === itemId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleOrderSuccess = (order: Order) => {
    setActiveOrder(order);
    setActiveView('TRACKING');
  };

  const handleCustomerLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase signout:', e);
    }
    setFirebaseUser(null);
    updateCustomerProfile(null);
  };

  const handleStaffLogout = () => {
    setStaffSession(null);
    try {
      sessionStorage.removeItem('srm_staff_session');
    } catch (e) {
      console.error(e);
    }
    setActiveView('STORE');
    window.history.pushState(null, '', '/');
  };

  const handleStaffLoginSuccess = (portal: 'KITCHEN' | 'DELIVERY' | 'ADMIN', user: any) => {
    const session = { portal, user };
    setStaffSession(session);
    try {
      sessionStorage.setItem('srm_staff_session', JSON.stringify(session));
    } catch (e) {
      console.error(e);
    }
    setActiveView(portal);
    window.history.pushState(null, '', `/${portal.toLowerCase()}`);
  };

  // Render Hidden Staff Portals when active
  if (activeView === 'KITCHEN') {
    return <KitchenPortal onLogout={handleStaffLogout} />;
  }

  if (activeView === 'DELIVERY') {
    return <DeliveryDashboard onLogout={handleStaffLogout} />;
  }

  if (activeView === 'ADMIN') {
    return (
      <AdminPortal
        currentUser={staffSession?.user || userProfile}
        onLogout={handleStaffLogout}
      />
    );
  }

  const cartTotalItems = cart.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="min-h-screen bg-[#faf7f2] text-stone-900 flex flex-col font-sans">
      {/* Top Main Navbar (Customer Facing) */}
      <header className="bg-white border-b border-stone-200/80 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          {/* Brand Logo & Name */}
          <div
            onClick={() => setActiveView('STORE')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <Logo size="md" />
            <div className="hidden sm:block">
              <span className="font-extrabold text-lg text-stone-900 tracking-tight font-serif block leading-none">
                SRM Good Foods
              </span>
              <span className="text-[10px] font-semibold text-[#942626] uppercase tracking-wider block mt-1">
                Campus Dining & Delivery
              </span>
            </div>
          </div>

          {/* Center Navigation Links (Customer Views Only) */}
          <nav className="hidden md:flex items-center gap-1 bg-stone-100/80 p-1 rounded-2xl border border-stone-200 text-xs font-bold">
            <button
              onClick={() => setActiveView('STORE')}
              className={`px-4 py-2 rounded-xl transition-all ${
                activeView === 'STORE'
                  ? 'bg-white text-[#942626] shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Menu & Order
            </button>
            <button
              onClick={() => setActiveView('TRACKING')}
              className={`px-4 py-2 rounded-xl transition-all ${
                activeView === 'TRACKING'
                  ? 'bg-white text-[#942626] shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Track Orders & OTP
            </button>
          </nav>

          {/* Right Action Area */}
          <div className="flex items-center gap-3">
            {/* If staff session is currently active, show a discreet shortcut back into the portal */}
            {staffSession && (
              <button
                onClick={() => setActiveView(staffSession.portal)}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-black transition-all"
                title={`Open ${staffSession.portal} Portal`}
              >
                {staffSession.portal === 'KITCHEN' && <ChefHat className="w-3.5 h-3.5 text-[#f6ce72]" />}
                {staffSession.portal === 'DELIVERY' && <Bike className="w-3.5 h-3.5 text-emerald-400" />}
                {staffSession.portal === 'ADMIN' && <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />}
                <span>{staffSession.portal} Portal</span>
              </button>
            )}

            {/* Basket Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl transition-colors flex items-center gap-2"
              title="View Cart"
            >
              <ShoppingBag className="w-5 h-5 text-[#942626]" />
              {cartTotalItems > 0 && (
                <span className="bg-[#942626] text-white font-extrabold text-[11px] px-2 py-0.5 rounded-full">
                  {cartTotalItems}
                </span>
              )}
            </button>

            {/* Customer Auth / Profile Area */}
            {userProfile ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-bold text-stone-900 truncate max-w-[130px]">
                    {userProfile.name || userProfile.email?.split('@')[0]}
                  </div>
                  {userProfile.phone ? (
                    <div className="text-[10px] text-stone-500 font-mono">
                      {userProfile.phone}
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsPhoneModalOpen(true)}
                      className="text-[10px] font-bold text-[#942626] underline flex items-center gap-0.5 justify-end"
                    >
                      <Phone className="w-2.5 h-2.5" />
                      Add Phone
                    </button>
                  )}
                </div>

                {/* Admin shortcut if logged-in customer account has role ADMIN */}
                {userProfile.role === 'ADMIN' && (
                  <button
                    onClick={() => setActiveView('ADMIN')}
                    className="hidden sm:flex p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold items-center gap-1"
                    title="Open Admin Console"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Admin</span>
                  </button>
                )}

                <button
                  onClick={handleCustomerLogout}
                  className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-4 py-2.5 bg-[#942626] hover:bg-[#7a1f1f] text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-stone-600 rounded-xl hover:bg-stone-100"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200 bg-white p-3 space-y-2 animate-fade-in shadow-md">
            <button
              onClick={() => {
                setActiveView('STORE');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left p-2.5 rounded-xl text-xs font-bold ${
                activeView === 'STORE' ? 'bg-red-50 text-[#942626]' : 'text-stone-700'
              }`}
            >
              Menu & Order Food
            </button>
            <button
              onClick={() => {
                setActiveView('TRACKING');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left p-2.5 rounded-xl text-xs font-bold ${
                activeView === 'TRACKING' ? 'bg-red-50 text-[#942626]' : 'text-stone-700'
              }`}
            >
              Live Order Tracking & OTP
            </button>
            {staffSession && (
              <button
                onClick={() => {
                  setActiveView(staffSession.portal);
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left p-2.5 rounded-xl text-xs font-bold bg-stone-900 text-white flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Back to {staffSession.portal} Portal</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Content Router */}
      <main className="flex-1">
        {activeView === 'STORE' && (
          <CustomerStore
            categories={categories}
            items={items}
            settings={settings}
            cart={cart}
            onAddToCart={handleAddToCart}
            onUpdateQuantity={handleUpdateQuantity}
            onOpenCart={() => setIsCartOpen(true)}
          />
        )}

        {activeView === 'TRACKING' && (
          <OrderTracking
            user={userProfile}
            activeOrder={activeOrder}
            onSelectOrder={(ord) => setActiveOrder(ord)}
            onRequireAuth={() => setIsAuthModalOpen(true)}
          />
        )}
      </main>

      {/* Customer Footer */}
      <footer className="bg-[#1c1917] text-stone-400 py-12 border-t border-stone-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Logo size="sm" />
              <span className="font-bold text-white text-sm font-serif">SRM Good Foods</span>
            </div>
            <p className="text-stone-400 leading-relaxed text-[11px]">
              Fresh, high-quality meals prepared daily on campus with seamless Razorpay online checkout and OTP delivery confirmation.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-stone-200 uppercase tracking-wider mb-3 text-[11px]">
              Campus Dining
            </h4>
            <ul className="space-y-2 text-[11px]">
              <li>
                <button onClick={() => setActiveView('STORE')} className="hover:text-white">
                  Browse Full Menu
                </button>
              </li>
              <li>
                <button onClick={() => setActiveView('TRACKING')} className="hover:text-white">
                  Track Active Orders
                </button>
              </li>
              <li>
                <button onClick={() => setIsCartOpen(true)} className="hover:text-white">
                  Shopping Basket ({cartTotalItems})
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-stone-200 uppercase tracking-wider mb-3 text-[11px]">
              Campus Delivery Spots
            </h4>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              Delivering to Tech Park, University Building, Hostels, MBA Block, Java Green, and all SRM campus locations.
            </p>
            <div className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{locations.length} Active Drop Points</span>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-stone-200 uppercase tracking-wider mb-3 text-[11px]">
              Payment & Security
            </h4>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              Verified transactions through Razorpay payment gateway. Customer authentication backed by Firebase Google OAuth.
            </p>
          </div>
        </div>

        {/* Discreet Operations & Hidden Portals Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 mt-8 border-t border-stone-800 flex flex-wrap items-center justify-between gap-4 text-[11px] text-stone-500">
          <div>
            © {new Date().getFullYear()} SRM Good Foods. All rights reserved.
          </div>

          {/* Discreet link for authorized personnel to access hidden portals */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setStaffModalDefaultPortal('KITCHEN');
                setIsStaffModalOpen(true);
              }}
              className="text-stone-600 hover:text-stone-400 transition-colors flex items-center gap-1 text-[10px]"
            >
              <Lock className="w-2.5 h-2.5" />
              <span>Operations Portal</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        locations={locations}
        user={userProfile}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={handleClearCart}
        onRequireAuth={() => {
          setIsCartOpen(false);
          setIsAuthModalOpen(true);
        }}
        onRequirePhone={() => {
          setIsCartOpen(false);
          setIsPhoneModalOpen(true);
        }}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Customer Auth Modal (Google OAuth & Direct SRM Sign-In) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(profile) => {
          updateCustomerProfile(profile);
          if (!profile.phone) {
            setIsPhoneModalOpen(true);
          }
        }}
        onAuthSuccess={async (user) => {
          setFirebaseUser(user);
        }}
      />

      {/* Mandatory Phone Registration Modal */}
      {userProfile && (
        <PhoneModal
          isOpen={isPhoneModalOpen}
          onClose={() => {
            setIsPhoneModalOpen(false);
          }}
          user={userProfile}
          firebaseUid={userProfile.firebase_uid}
          currentPhone={userProfile.phone}
          onPhoneUpdated={(updated) => {
            updateCustomerProfile(updated);
          }}
          onPhoneSaved={(newPhone) => {
            updateCustomerProfile({ ...userProfile, phone: newPhone });
          }}
        />
      )}

      {/* Staff & Hidden Portals Login Modal (Email / Username & Password) */}
      <StaffLoginModal
        isOpen={isStaffModalOpen}
        defaultPortal={staffModalDefaultPortal}
        onClose={() => setIsStaffModalOpen(false)}
        onLoginSuccess={handleStaffLoginSuccess}
      />
    </div>
  );
}
