export interface UserProfile {
  id: number;
  firebase_uid: string;
  email: string;
  name: string;
  phone: string | null;
  role: 'USER' | 'ADMIN' | 'KITCHEN' | 'DELIVERY';
}

export interface FoodCategory {
  id: number;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface FoodItem {
  id: number;
  category_id: number | null;
  category_name?: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
  available_start_time: string | null; // e.g. "11:30:00"
  available_end_time: string | null;   // e.g. "15:00:00"
  created_at?: string;
}

export interface DeliveryLocation {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at?: string;
}

export interface RestaurantSettings {
  id: number;
  is_open_today: boolean;
  opening_time: string; // e.g. "07:00:00"
  closing_time: string; // e.g. "23:00:00"
  closed_message: string;
  updated_at?: string;
}

export interface OrderItem {
  id?: number;
  food_item_id: number;
  item_name?: string;
  name?: string;
  price?: number;
  price_snapshot?: number;
  quantity: number;
  subtotal?: number;
}

export interface Order {
  id: number;
  order_number: string;
  idempotency_key?: string;
  user_id: number;
  customer_name?: string;
  customer_phone?: string;
  delivery_location_id: number;
  location_name_snapshot: string;
  delivery_person_id?: number | null;
  status: 'CONFIRMED' | 'PREPARING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  total_amount: number;
  payment_status: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED';
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  raw_otp?: string;
  otp_attempts?: number;
  kitchen_notes?: string;
  created_at: string;
  preparing_at?: string | null;
  prepared_at?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  items?: OrderItem[];
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_name?: string;
  user_email?: string;
  action: string;
  details: string;
  ip_address?: string;
  created_at: string;
}

export interface AnalyticsData {
  total_revenue: number;
  total_orders: number;
  today_revenue: number;
  today_orders: number;
  active_orders: number;
  total_users: number;
  status_distribution: { status: string; count: string | number }[];
  top_items: { name: string; total_quantity: string | number; total_sales: string | number }[];
  recent_logs: AuditLog[];
}
