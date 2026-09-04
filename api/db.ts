import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) {
  console.warn('CRITICAL WARNING: DATABASE_URL is not set in environment variables');
}

// Maintain a global cached connection pool across serverless function invocations
declare global {
  // eslint-disable-next-line no-var
  var __pg_pool: Pool | undefined;
}

let poolInstance: Pool;

if (process.env.NODE_ENV === 'production') {
  poolInstance = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
} else {
  if (!global.__pg_pool) {
    global.__pg_pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  poolInstance = global.__pg_pool;
}

export const pool = poolInstance;

// Audit logging has been completely disabled to preserve database storage space
export async function logAudit(
  _userId: number | null,
  _action: string,
  _details: string,
  _ipAddress: string = '127.0.0.1'
): Promise<void> {
  // No-op: Audit logs are no longer written to Supabase/PostgreSQL to prevent storage consumption
  return;
}

// SRM Default Delivery Locations
export const SRM_DEFAULT_LOCATIONS = [
  { name: 'Tech Park (TP)', description: 'Main Lobby / Reception Area' },
  { name: 'University Building (UB)', description: 'Ground Floor Main Entrance' },
  { name: 'Java Green Food Plaza', description: 'Central Food Court Seating' },
  { name: 'MBA / Management Block', description: 'Portico / Waiting Lobby' },
  { name: 'Bio-Tech Block', description: 'Front Entrance Lobby' },
  { name: 'Hi-Tech / BEL Building', description: 'East Wing Entrance' },
  { name: 'Mechanical & Civil Block', description: 'Workshop Block Porch' },
  { name: 'Architecture & Design Block', description: 'Design Studio Portico' },
  { name: 'Nelson Mandela Hostel', description: 'Hostel Main Gate / Security Desk' },
  { name: 'Paari & Kaari Hostels', description: 'Hostel Complex Entrance' },
  { name: 'Oori Hostel', description: 'Boys Hostel Main Entrance' },
  { name: 'Adhiyaman Hostel', description: 'Boys Hostel Entrance Porch' },
  { name: 'Meenakshi Hostel', description: 'Girls Hostel Security Gate' },
  { name: 'Kalpana Chawla Hostel', description: 'Girls Hostel Security Gate' },
  { name: 'Senbagam Hostel', description: 'Girls Hostel Security Gate' },
  { name: 'SRM Hospital & Medical College', description: 'Hospital Gate 1 Entrance' },
  { name: 'Main Campus Arch Gate', description: 'GST Road Main Entrance' },
];

async function seedDefaultLocations() {
  try {
    for (const loc of SRM_DEFAULT_LOCATIONS) {
      const existing = await pool.query(
        'SELECT id FROM delivery_locations WHERE LOWER(name) = LOWER($1)',
        [loc.name]
      );
      if (existing.rows.length === 0) {
        await pool.query(
          'INSERT INTO delivery_locations (name, description, is_active, created_at) VALUES ($1, $2, true, NOW())',
          [loc.name, loc.description]
        );
      }
    }
  } catch (err) {
    console.error('Error seeding default delivery locations:', err);
  }
}

// Lazy schema initialization cache
let schemaInitPromise: Promise<void> | null = null;

export async function ensureDatabaseReady(): Promise<void> {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      try {
        // Fast path: Check if database tables already exist
        const check = await pool.query("SELECT to_regclass('public.users') as exists");
        if (check.rows[0]?.exists) {
          return; // Database is already fully initialized!
        }
      } catch (err) {
        console.warn('Fast table check failed, attempting initialization:', err);
      }

      // Slow path: initialize schema only if public.users is missing
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          firebase_uid VARCHAR NOT NULL,
          email VARCHAR NOT NULL,
          name VARCHAR NOT NULL,
          phone VARCHAR,
          role VARCHAR NOT NULL DEFAULT 'USER',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS food_categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR NOT NULL UNIQUE,
          display_order INTEGER DEFAULT 1,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS food_items (
          id SERIAL PRIMARY KEY,
          category_id INTEGER NOT NULL REFERENCES food_categories(id),
          name VARCHAR NOT NULL,
          description TEXT,
          price DOUBLE PRECISION NOT NULL,
          image_url TEXT,
          is_available BOOLEAN DEFAULT true,
          available_start_time TIME,
          available_end_time TIME,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS delivery_locations (
          id SERIAL PRIMARY KEY,
          name VARCHAR NOT NULL UNIQUE,
          description VARCHAR,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          order_number VARCHAR NOT NULL UNIQUE,
          idempotency_key VARCHAR UNIQUE,
          user_id INTEGER NOT NULL REFERENCES users(id),
          delivery_location_id INTEGER NOT NULL REFERENCES delivery_locations(id),
          location_name_snapshot VARCHAR NOT NULL,
          delivery_person_id INTEGER REFERENCES users(id),
          status VARCHAR NOT NULL DEFAULT 'CONFIRMED',
          total_amount DOUBLE PRECISION NOT NULL,
          payment_status VARCHAR DEFAULT 'PENDING',
          razorpay_order_id VARCHAR UNIQUE,
          razorpay_payment_id VARCHAR,
          razorpay_signature VARCHAR,
          otp_hash VARCHAR,
          raw_otp VARCHAR,
          otp_attempts INTEGER DEFAULT 0,
          kitchen_notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          preparing_at TIMESTAMP,
          prepared_at TIMESTAMP,
          dispatched_at TIMESTAMP,
          delivered_at TIMESTAMP,
          cancelled_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_items (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          food_item_id INTEGER NOT NULL REFERENCES food_items(id),
          item_name_snapshot VARCHAR NOT NULL,
          price_snapshot DOUBLE PRECISION NOT NULL,
          quantity INTEGER NOT NULL,
          subtotal DOUBLE PRECISION NOT NULL
        );

        CREATE TABLE IF NOT EXISTS restaurant_settings (
          id SERIAL PRIMARY KEY,
          is_open_today BOOLEAN DEFAULT true,
          opening_time TIME DEFAULT '07:00:00',
          closing_time TIME DEFAULT '23:00:00',
          closed_message VARCHAR DEFAULT 'Kitchen is closed today for holiday/leave. Reopening tomorrow at 7:00 AM.',
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // 2. High-performance indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS ix_users_firebase_uid ON users(firebase_uid);
        CREATE INDEX IF NOT EXISTS ix_orders_user_id ON orders(user_id);
        CREATE INDEX IF NOT EXISTS ix_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS ix_orders_created_at ON orders(created_at DESC);
        CREATE INDEX IF NOT EXISTS ix_food_items_category_id ON food_items(category_id);
        CREATE INDEX IF NOT EXISTS ix_food_items_is_available ON food_items(is_available);
        CREATE INDEX IF NOT EXISTS ix_delivery_locations_is_active ON delivery_locations(is_active);
        CREATE INDEX IF NOT EXISTS ix_order_items_order_id ON order_items(order_id);
      `);

      // 3. Seed default SRM delivery locations
      await seedDefaultLocations();

      // 4. Seed default restaurant settings if none exist
      const settingsCheck = await pool.query('SELECT id FROM restaurant_settings LIMIT 1');
      if (settingsCheck.rows.length === 0) {
        await pool.query(`
          INSERT INTO restaurant_settings (is_open_today, opening_time, closing_time, closed_message, updated_at)
          VALUES (true, '07:00:00', '23:00:00', 'Kitchen is currently closed. We reopen at 7:00 AM.', NOW())
        `);
      }
    })().catch((err) => {
      console.error('Database schema initialization error:', err);
      schemaInitPromise = null; // retry on next request
      throw err;
    });
  }
  return schemaInitPromise;
}
