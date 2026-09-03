import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  Activity,
  UtensilsCrossed,
  FolderPlus,
  MapPin,
  Settings,
  Trash2,
  Edit,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ExternalLink,
  Phone,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  FoodCategory,
  FoodItem,
  DeliveryLocation,
  RestaurantSettings,
  AnalyticsData,
  UserProfile,
} from '../types';
import { Logo } from './Logo';

interface AdminPortalProps {
  onLogout: () => void;
  currentUser: any;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onLogout, currentUser }) => {
  const [activeTab, setActiveTab] = useState<
    'ANALYTICS' | 'MENU' | 'LOCATIONS' | 'SETTINGS' | 'USERS' | 'STORAGE'
  >('ANALYTICS');

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  // Modals & form state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', display_order: 1, is_active: true });

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    category_id: 1,
    description: '',
    price: 99,
    image_url: '',
    is_available: true,
    available_start_time: '',
    available_end_time: '',
  });

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationForm, setLocationForm] = useState({ name: '', description: '', is_active: true });

  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearMode, setClearMode] = useState<'COMPLETED_ONLY' | 'ALL'>('COMPLETED_ONLY');

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [anRes, catRes, itRes, locRes, setRes, usRes] = await Promise.all([
        fetch('/api/admin/analytics'),
        fetch('/api/categories'),
        fetch('/api/items?all=true'),
        fetch('/api/locations?all=true'),
        fetch('/api/settings'),
        fetch('/api/admin/users'),
      ]);

      if (anRes.ok) setAnalytics(await anRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (itRes.ok) setItems(await itRes.json());
      if (locRes.ok) setLocations(await locRes.json());
      if (setRes.ok) setSettings(await setRes.json());
      if (usRes.ok) setUsers(await usRes.json());
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const flashMessage = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 4000);
  };

  // 1. Settings save handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        flashMessage('Shop timings and status updated successfully in PostgreSQL');
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // 2. Category handlers
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm),
      });
      if (res.ok) {
        setIsCategoryModalOpen(false);
        setCategoryForm({ name: '', display_order: 1, is_active: true });
        flashMessage('Category added successfully');
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 3. Item handlers
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingItem ? 'PUT' : 'POST';
      const url = editingItem ? `/api/items/${editingItem.id}` : '/api/items';

      const payload = {
        ...itemForm,
        available_start_time: itemForm.available_start_time || null,
        available_end_time: itemForm.available_end_time || null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsItemModalOpen(false);
        setEditingItem(null);
        flashMessage(`Food item ${editingItem ? 'updated' : 'added'} successfully`);
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Are you sure you want to remove this food item?')) return;
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
      if (res.ok) {
        flashMessage('Item removed');
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 4. Location handlers
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationForm),
      });
      if (res.ok) {
        setIsLocationModalOpen(false);
        setLocationForm({ name: '', description: '', is_active: true });
        flashMessage('Delivery location added');
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleLocationStatus = async (loc: DeliveryLocation) => {
    try {
      const res = await fetch(`/api/locations/${loc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !loc.is_active }),
      });
      if (res.ok) {
        flashMessage(`Location ${!loc.is_active ? 'activated' : 'deactivated'}`);
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLocation = async (id: number) => {
    if (!confirm('Are you sure you want to delete or deactivate this campus location?')) return;
    try {
      const res = await fetch(`/api/locations/${id}?hard=true`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        flashMessage(data.message || 'Location removed');
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 5. Storage optimization: Clear orders handler
  const handleExecuteClearOrders = async () => {
    try {
      const res = await fetch('/api/admin/clear-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: clearMode }),
      });
      const data = await res.json();
      if (res.ok) {
        setClearModalOpen(false);
        flashMessage(data.message || 'Orders table cleared successfully');
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf7f2] text-stone-900 pb-20">
      {/* Top Banner */}
      <div className="bg-[#1c1917] text-white px-4 sm:px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo size="sm" className="bg-white/10 p-1.5 rounded-xl backdrop-blur-sm" />
            <div>
              <h1 className="font-extrabold text-lg sm:text-xl font-serif tracking-wide text-white">
                SRM Admin Command Console
              </h1>
              <p className="text-[11px] text-amber-400">
                Connected to Supabase PostgreSQL • Real-time Monitoring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadAllData()}
              className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-red-950/70 text-red-300 rounded-xl text-xs font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Exit Admin</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        {actionMsg && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800 animate-fade-in shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMsg}</span>
          </div>
        )}

        <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none bg-stone-200/70 p-1 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('ANALYTICS')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'ANALYTICS' ? 'bg-white text-[#942626] shadow-sm' : 'text-stone-600'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Analytics & Activity</span>
          </button>

          <button
            onClick={() => setActiveTab('MENU')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'MENU' ? 'bg-white text-[#942626] shadow-sm' : 'text-stone-600'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Dishes & Categories</span>
          </button>

          <button
            onClick={() => setActiveTab('LOCATIONS')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'LOCATIONS' ? 'bg-white text-[#942626] shadow-sm' : 'text-stone-600'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Delivery Spots</span>
          </button>

          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'SETTINGS' ? 'bg-white text-[#942626] shadow-sm' : 'text-stone-600'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Shop Timings</span>
          </button>

          <button
            onClick={() => setActiveTab('USERS')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'USERS' ? 'bg-white text-[#942626] shadow-sm' : 'text-stone-600'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Customer Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('STORAGE')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'STORAGE' ? 'bg-white text-red-700 shadow-sm' : 'text-stone-600'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Orders / DB Storage</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ========================================================= */}
        {/* 1. ANALYTICS & LIVE ACTIVITY */}
        {/* ========================================================= */}
        {activeTab === 'ANALYTICS' && (
          <div className="space-y-6">
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div className="flex items-center justify-between text-stone-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Sales</span>
                  <DollarSign className="w-4 h-4 text-[#942626]" />
                </div>
                <div className="text-2xl font-black text-stone-900">
                  ₹{analytics?.total_revenue || 0}
                </div>
                <p className="text-[11px] text-stone-500 mt-1">Paid via Razorpay</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div className="flex items-center justify-between text-stone-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Today's Revenue</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-700">
                  ₹{analytics?.today_revenue || 0}
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  {analytics?.today_orders || 0} order(s) today
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div className="flex items-center justify-between text-stone-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Active Orders</span>
                  <ShoppingBag className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-700">
                  {analytics?.active_orders || 0}
                </div>
                <p className="text-[11px] text-stone-500 mt-1">In kitchen or out for delivery</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div className="flex items-center justify-between text-stone-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Registered Users</span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-stone-900">
                  {analytics?.total_users || users.length}
                </div>
                <p className="text-[11px] text-stone-500 mt-1">Verified with Firebase</p>
              </div>
            </div>

            {/* Top Items & Status Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Selling Dishes */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <h3 className="font-bold text-sm text-stone-900 mb-4 flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-[#942626]" />
                  <span>Top-Selling Delicacies</span>
                </h3>
                {analytics?.top_items && analytics.top_items.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.top_items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-stone-100 font-bold text-stone-600 flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-stone-800">{it.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-stone-900">{it.total_quantity} sold</span>
                          <span className="block text-[10px] text-stone-400">₹{it.total_sales}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 py-6 text-center">
                    No completed order metrics yet
                  </p>
                )}
              </div>

              {/* Status Distribution */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <h3 className="font-bold text-sm text-stone-900 mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-stone-700" />
                  <span>Order Pipeline Breakdown</span>
                </h3>
                {analytics?.status_distribution && analytics.status_distribution.length > 0 ? (
                  <div className="space-y-2.5">
                    {analytics.status_distribution.map((st, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl text-xs"
                      >
                        <span className="font-bold text-stone-800">{st.status}</span>
                        <span className="font-mono font-bold bg-white px-2.5 py-0.5 rounded-lg border border-stone-200">
                          {st.count} orders
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 py-6 text-center">No orders pipeline yet</p>
                )}
              </div>
            </div>

            {/* Real-time Customer Activity Stream */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <h3 className="font-bold text-sm text-stone-900 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>Live Activity & Order Stream</span>
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {analytics?.recent_logs && analytics.recent_logs.length > 0 ? (
                  analytics.recent_logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                    >
                      <div>
                        <span className="font-bold text-stone-900 mr-2">[{log.action}]</span>
                        <span className="text-stone-700">{log.details}</span>
                        {log.user_email && (
                          <span className="text-stone-400 text-[11px] block mt-0.5">
                            by {log.user_email}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-stone-400 py-4 text-center">No recent activity recorded yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. MENU MANAGEMENT (ITEMS & CATEGORIES) */}
        {/* ========================================================= */}
        {activeTab === 'MENU' && (
          <div className="space-y-6">
            {/* Header with Add Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <div>
                <h3 className="font-bold text-base text-stone-900">Food Menu & Timing Schedules</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Manage categories, prices, image URLs, and daily time slot duration
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <FolderPlus className="w-4 h-4 text-[#942626]" />
                  <span>Add Category</span>
                </button>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setItemForm({
                      name: '',
                      category_id: categories.length > 0 ? categories[0].id : 1,
                      description: '',
                      price: 99,
                      image_url: '',
                      is_available: true,
                      available_start_time: '',
                      available_end_time: '',
                    });
                    setIsItemModalOpen(true);
                  }}
                  className="px-4 py-2 bg-[#942626] hover:bg-[#7a1f1f] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Food Item</span>
                </button>
              </div>
            </div>

            {/* Categories Pills */}
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="px-3.5 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-700 flex items-center gap-2 shadow-sm"
                >
                  <span>{cat.name}</span>
                  <span className="text-[10px] text-stone-400 font-normal">
                    (Order: {cat.display_order})
                  </span>
                </div>
              ))}
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5">Item</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Price</th>
                      <th className="p-3.5">Daily Time Window</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="p-3.5 flex items-center gap-3">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-10 h-10 rounded-lg object-cover bg-stone-100 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-red-50 text-[#942626] font-bold text-xs flex items-center justify-center shrink-0">
                              SRM
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-stone-900 block">{item.name}</span>
                            <span className="text-[11px] text-stone-400 line-clamp-1">
                              {item.description || 'No description'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 text-stone-700">{item.category_name || '-'}</td>
                        <td className="p-3.5 font-bold text-[#942626]">₹{item.price}</td>
                        <td className="p-3.5 text-stone-600">
                          {item.available_start_time && item.available_end_time ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md font-medium text-[11px]">
                              <Clock className="w-3 h-3" />
                              {item.available_start_time.slice(0, 5)} - {item.available_end_time.slice(0, 5)}
                            </span>
                          ) : (
                            <span className="text-stone-400">All Day</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.is_available
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.is_available ? 'Available' : 'Unavailable'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setItemForm({
                                name: item.name,
                                category_id: item.category_id || (categories[0]?.id || 1),
                                description: item.description || '',
                                price: item.price,
                                image_url: item.image_url || '',
                                is_available: item.is_available,
                                available_start_time: item.available_start_time || '',
                                available_end_time: item.available_end_time || '',
                              });
                              setIsItemModalOpen(true);
                            }}
                            className="p-1.5 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. DELIVERY LOCATIONS */}
        {/* ========================================================= */}
        {activeTab === 'LOCATIONS' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <div>
                <h3 className="font-bold text-base text-stone-900">Campus Delivery Locations</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Points on campus where riders deliver orders
                </p>
              </div>
              <button
                onClick={() => setIsLocationModalOpen(true)}
                className="px-4 py-2 bg-[#942626] hover:bg-[#7a1f1f] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Delivery Spot</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className={`p-4 rounded-2xl border transition-all shadow-sm flex items-start justify-between ${
                    loc.is_active ? 'bg-white border-stone-200' : 'bg-stone-50 border-stone-300/80 opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${
                        loc.is_active ? 'bg-red-50 text-[#942626]' : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <h4 className="font-bold text-sm text-stone-900 truncate">{loc.name}</h4>
                      <p className="text-xs text-stone-500 mt-0.5 truncate">
                        {loc.description || 'Campus building'}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            loc.is_active
                              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                              : 'text-stone-600 bg-stone-200'
                          }`}
                        >
                          {loc.is_active ? 'Active Drop Point' : 'Deactivated'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => handleToggleLocationStatus(loc)}
                      className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                        loc.is_active
                          ? 'border-stone-200 text-stone-600 hover:bg-stone-100'
                          : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                      title={loc.is_active ? 'Deactivate location' : 'Activate location'}
                    >
                      {loc.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLocation(loc.id)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete location"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. SHOP TIMINGS & EMERGENCY OPEN/CLOSE */}
        {/* ========================================================= */}
        {activeTab === 'SETTINGS' && (
          <div className="max-w-xl mx-auto bg-white p-6 rounded-3xl border border-stone-200 shadow-md">
            <h3 className="font-bold text-lg text-stone-900 font-serif mb-1">
              Store Operating Hours & Status
            </h3>
            <p className="text-xs text-stone-500 mb-6">
              Control kitchen open/close state and operating hours
            </p>

            {settings && (
              <form onSubmit={handleSaveSettings} className="space-y-4">
                {/* Master Open Switch */}
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-stone-900">Kitchen Open Today</h4>
                    <p className="text-xs text-stone-500">
                      When turned off, customers will see your closed message and checkout will be blocked.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.is_open_today}
                    onChange={(e) =>
                      setSettings({ ...settings, is_open_today: e.target.checked })
                    }
                    className="w-5 h-5 accent-[#942626] rounded cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Opening Time</label>
                    <input
                      type="time"
                      value={settings.opening_time.slice(0, 5)}
                      onChange={(e) =>
                        setSettings({ ...settings, opening_time: `${e.target.value}:00` })
                      }
                      className="w-full p-2.5 border border-stone-300 rounded-xl text-xs text-stone-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Closing Time</label>
                    <input
                      type="time"
                      value={settings.closing_time.slice(0, 5)}
                      onChange={(e) =>
                        setSettings({ ...settings, closing_time: `${e.target.value}:00` })
                      }
                      className="w-full p-2.5 border border-stone-300 rounded-xl text-xs text-stone-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Closed Announcement Message
                  </label>
                  <textarea
                    rows={3}
                    value={settings.closed_message}
                    onChange={(e) =>
                      setSettings({ ...settings, closed_message: e.target.value })
                    }
                    className="w-full p-2.5 border border-stone-300 rounded-xl text-xs text-stone-900"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#942626] hover:bg-[#7a1f1f] text-white font-bold rounded-xl text-xs shadow-md transition-all"
                >
                  Save Store Settings
                </button>
              </form>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. CUSTOMER LOGS & USER DIRECTORY */}
        {/* ========================================================= */}
        {activeTab === 'USERS' && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-stone-900">Customer Directory & Logs</h3>
                <p className="text-xs text-stone-500">
                  Registered customer profiles stored in PostgreSQL `users` table
                </p>
              </div>
              <span className="text-xs font-bold text-stone-500">{users.length} registered</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Contact Phone</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Orders Placed</th>
                    <th className="p-3.5">Total Spent</th>
                    <th className="p-3.5">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-stone-50/50">
                      <td className="p-3.5">
                        <span className="font-bold text-stone-900 block">{u.name || 'Anonymous'}</span>
                        <span className="text-[11px] text-stone-400">{u.email}</span>
                      </td>
                      <td className="p-3.5">
                        {u.phone ? (
                          <span className="font-mono font-bold text-stone-800">{u.phone}</span>
                        ) : (
                          <span className="text-amber-600 font-medium">Pending phone</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === 'ADMIN'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {u.role || 'USER'}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-stone-800">{u.orders_count || 0}</td>
                      <td className="p-3.5 font-bold text-[#942626]">₹{u.total_spent || 0}</td>
                      <td className="p-3.5 text-stone-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 6. STORAGE OPTIMIZATION (CLEAR ORDERS) */}
        {/* ========================================================= */}
        {activeTab === 'STORAGE' && (
          <div className="max-w-xl mx-auto bg-white p-6 rounded-3xl border border-stone-200 shadow-md space-y-5">
            <div className="flex items-center gap-3 text-red-700">
              <div className="p-3 bg-red-50 rounded-2xl">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-stone-900 font-serif">
                  Storage Optimization & Order Purge
                </h3>
                <p className="text-xs text-stone-500">
                  Timely manual clearing of orders table to optimize Supabase PostgreSQL storage
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Storage Maintenance Guide</span>
              </div>
              <p>
                As requested, to conserve cloud storage space and keep queries lightning fast, old orders and line items can be purged manually on a regular basis.
              </p>
            </div>

            <div className="space-y-3">
              <label
                className={`p-3.5 border rounded-2xl flex items-start gap-3 cursor-pointer transition-all ${
                  clearMode === 'COMPLETED_ONLY'
                    ? 'border-[#942626] bg-red-50/40'
                    : 'border-stone-200'
                }`}
              >
                <input
                  type="radio"
                  name="clearMode"
                  checked={clearMode === 'COMPLETED_ONLY'}
                  onChange={() => setClearMode('COMPLETED_ONLY')}
                  className="mt-1 accent-[#942626]"
                />
                <div>
                  <span className="font-bold text-sm text-stone-900 block">
                    Clear Completed & Cancelled Orders Only (Recommended)
                  </span>
                  <span className="text-xs text-stone-500">
                    Purges delivered orders while preserving all active orders in the kitchen pipeline.
                  </span>
                </div>
              </label>

              <label
                className={`p-3.5 border rounded-2xl flex items-start gap-3 cursor-pointer transition-all ${
                  clearMode === 'ALL' ? 'border-red-600 bg-red-50/40' : 'border-stone-200'
                }`}
              >
                <input
                  type="radio"
                  name="clearMode"
                  checked={clearMode === 'ALL'}
                  onChange={() => setClearMode('ALL')}
                  className="mt-1 accent-red-600"
                />
                <div>
                  <span className="font-bold text-sm text-stone-900 block">
                    Purge All Orders & Reset Order Table
                  </span>
                  <span className="text-xs text-stone-500">
                    Deletes all records from `orders` and `order_items` tables.
                  </span>
                </div>
              </label>
            </div>

            <button
              onClick={() => setClearModalOpen(true)}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Execute Order Table Clean</span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Clearing Orders */}
      {clearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-stone-900">Confirm Order Deletion</h3>
            <p className="text-xs text-stone-500 mt-1 mb-5">
              Are you sure you want to permanently clear the orders table? This operation cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setClearModalOpen(false)}
                className="flex-1 py-3 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteClearOrders}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Yes, Purge Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-base text-stone-900 mb-4">Add New Category</h3>
            <form onSubmit={handleSaveCategory} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g., Breakfast, Snacks, Beverages"
                  className="w-full p-2.5 border border-stone-300 rounded-xl text-xs text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={categoryForm.display_order}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, display_order: Number(e.target.value) })
                  }
                  className="w-full p-2.5 border border-stone-300 rounded-xl text-xs text-stone-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="flex-1 py-2.5 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#942626] hover:bg-[#7a1f1f] text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-stone-900 mb-4">
              {editingItem ? 'Edit Food Item' : 'Add New Food Item'}
            </h3>
            <form onSubmit={handleSaveItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Dish Name</label>
                <input
                  type="text"
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="e.g., Paneer Butter Masala"
                  className="w-full p-2.5 border border-stone-300 rounded-xl text-xs text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Category</label>
                  <select
                    value={itemForm.category_id}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, category_id: Number(e.target.value) })
                    }
                    className="w-full p-2.5 border border-stone-300 rounded-xl text-xs text-stone-900 bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: Number(e.target.value) })}
                    className="w-full p-2.5 border border-stone-300 rounded-xl text-xs text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Image URL Link (Saves bucket storage)
                </label>
                <input
                  type="url"
                  value={itemForm.image_url}
                  onChange={(e) => setItemForm({ ...itemForm, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full p-2.5 border border-stone-300 rounded-xl text-xs text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="Fresh ingredients, aromatic spices..."
                  className="w-full p-2.5 border border-stone-300 rounded-xl text-xs text-stone-900"
                />
              </div>

              {/* Time Slot Availability Duration */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
                <span className="block text-xs font-bold text-stone-800">
                  Time Slot Availability (Optional Duration)
                </span>
                <p className="text-[11px] text-stone-500">
                  Specify starting and ending time if item is served only during a duration (e.g. 11:30 - 15:00 for Lunch).
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-stone-400 block mb-0.5">Start Time</span>
                    <input
                      type="time"
                      value={itemForm.available_start_time.slice(0, 5)}
                      onChange={(e) =>
                        setItemForm({
                          ...itemForm,
                          available_start_time: e.target.value ? `${e.target.value}:00` : '',
                        })
                      }
                      className="w-full p-2 border border-stone-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block mb-0.5">End Time</span>
                    <input
                      type="time"
                      value={itemForm.available_end_time.slice(0, 5)}
                      onChange={(e) =>
                        setItemForm({
                          ...itemForm,
                          available_end_time: e.target.value ? `${e.target.value}:00` : '',
                        })
                      }
                      className="w-full p-2 border border-stone-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_avail"
                  checked={itemForm.is_available}
                  onChange={(e) => setItemForm({ ...itemForm, is_available: e.target.checked })}
                  className="w-4 h-4 accent-[#942626]"
                />
                <label htmlFor="is_avail" className="text-xs font-bold text-stone-800 cursor-pointer">
                  Item is currently in stock & available
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="flex-1 py-2.5 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#942626] hover:bg-[#7a1f1f] text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  {editingItem ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-base text-stone-900 mb-4">Add Delivery Spot</h3>
            <form onSubmit={handleSaveLocation} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Spot Name</label>
                <input
                  type="text"
                  required
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  placeholder="e.g. S-Block Lobby"
                  className="w-full p-2.5 border border-stone-300 rounded-xl text-xs text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Description</label>
                <input
                  type="text"
                  value={locationForm.description}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, description: e.target.value })
                  }
                  placeholder="e.g. Ground floor main entrance"
                  className="w-full p-2.5 border border-stone-300 rounded-xl text-xs text-stone-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(false)}
                  className="flex-1 py-2.5 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#942626] hover:bg-[#7a1f1f] text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Add Spot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
