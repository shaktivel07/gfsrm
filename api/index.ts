import express, { Request, Response, Router } from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { pool, ensureDatabaseReady, logAudit } from './db.js';
import { razorpay, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from './razorpay.js';

dotenv.config();

const app = express();

// Handle pre-parsed bodies in Vercel serverless functions without hanging
app.use((req: any, _res: any, next: any) => {
  if (req.body && typeof req.body === 'object') {
    req._body = true;
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS & Preflight middleware
app.use((req: Request, res: Response, next: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Lazy DB schema ensure middleware
app.use(async (_req: Request, res: Response, next: any) => {
  try {
    await ensureDatabaseReady();
    next();
  } catch (err: any) {
    console.error('Database connection error in API:', err);
    return res.status(500).json({
      error: `Database connection error: ${err?.message || 'Failed to connect to Supabase'}`,
      code: 'DB_CONNECTION_ERROR'
    });
  }
});

// Authorized admin emails (configured via ADMIN_EMAILS in .env)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const KITCHEN_PASSWORD = process.env.KITCHEN_PASSWORD;
const DELIVERY_PASSWORD = process.env.DELIVERY_PASSWORD;

const matchPassword = (input: string, envVal?: string): boolean => {
  if (!envVal || !input) return false;
  return envVal.split(',').map((p) => p.trim()).includes(input);
};

// Main API Router containing all REST endpoints
const router = Router();

// -------------------------------------------------------------
// 1. HEALTH CHECK & SMOKE TEST
// -------------------------------------------------------------
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const dbRes = await pool.query('SELECT NOW() as db_time');
    res.json({
      status: 'ok',
      service: 'SRM Good Foods Serverless Backend',
      runtime: 'Vercel Serverless Function',
      db: 'connected',
      db_time: dbRes.rows[0].db_time,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/smoke-test', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: 'pass' | 'fail' | 'warn'; details: any }> = {};

  // 1. Database connection check
  try {
    await ensureDatabaseReady();
    const dbStart = Date.now();
    const dbRes = await pool.query(`
      SELECT 
        NOW() as server_time,
        current_database() as db_name,
        (SELECT count(*) FROM food_categories)::int as categories_count,
        (SELECT count(*) FROM food_items)::int as items_count,
        (SELECT count(*) FROM delivery_locations)::int as locations_count
    `);
    const latency = Date.now() - dbStart;
    checks.database = {
      status: 'pass',
      details: {
        connected: true,
        latency_ms: latency,
        database: dbRes.rows[0].db_name,
        categories_count: dbRes.rows[0].categories_count,
        items_count: dbRes.rows[0].items_count,
        locations_count: dbRes.rows[0].locations_count,
      },
    };
  } catch (err: any) {
    checks.database = {
      status: 'fail',
      details: {
        connected: false,
        error: err.message,
      },
    };
  }

  // 2. Required Environment Variables check
  const requiredVars = [
    'DATABASE_URL',
    'ADMIN_PASSWORD',
    'KITCHEN_PASSWORD',
    'DELIVERY_PASSWORD',
  ];
  const missingVars = requiredVars.filter((v) => !process.env[v]);
  const configuredVars = requiredVars.filter((v) => !!process.env[v]);

  checks.environment_variables = {
    status: missingVars.length === 0 ? 'pass' : 'fail',
    details: {
      configured_count: configuredVars.length,
      total_required: requiredVars.length,
      missing: missingVars,
      admin_emails_configured: ADMIN_EMAILS.length > 0,
    },
  };

  // 3. Razorpay initialization check
  const hasRazorpayKey = !!RAZORPAY_KEY_ID && RAZORPAY_KEY_ID !== 'rzp_placeholder';
  const hasRazorpaySecret = !!RAZORPAY_KEY_SECRET && RAZORPAY_KEY_SECRET !== 'secret_placeholder';
  checks.razorpay = {
    status: hasRazorpayKey && hasRazorpaySecret ? 'pass' : 'warn',
    details: {
      key_id_set: !!RAZORPAY_KEY_ID,
      key_id_prefix: RAZORPAY_KEY_ID ? `${RAZORPAY_KEY_ID.substring(0, 8)}...` : 'not set',
      secret_set: !!RAZORPAY_KEY_SECRET,
      client_initialized: typeof razorpay?.orders?.create === 'function',
      message: hasRazorpayKey && hasRazorpaySecret 
        ? 'Razorpay credentials configured' 
        : 'Razorpay keys not configured (COD fallback mode active)',
    },
  };

  // 4. Firebase configuration check
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
  const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY || '';
  const hasFirebase = !!firebaseProjectId || !!firebaseApiKey;
  checks.firebase = {
    status: hasFirebase ? 'pass' : 'warn',
    details: {
      project_id: firebaseProjectId ? `${firebaseProjectId.substring(0, 8)}...` : 'not set',
      api_key_configured: !!firebaseApiKey,
      message: hasFirebase ? 'Firebase parameters detected' : 'Firebase parameters not configured in environment',
    },
  };

  // 5. Hostname & Production Domain check
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://goodfoods.srmtrc.in';
  let prodHost = 'goodfoods.srmtrc.in';
  try {
    prodHost = new URL(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`).hostname;
  } catch {
    prodHost = appUrl;
  }
  checks.domain = {
    status: 'pass',
    details: {
      production_url: appUrl,
      production_host: prodHost,
      primary_domain: 'goodfoods.srmtrc.in',
    },
  };

  const isAllPassing = checks.database.status === 'pass' && checks.environment_variables.status === 'pass';
  const httpStatus = isAllPassing ? 200 : 503;

  res.status(httpStatus).json({
    status: isAllPassing ? 'healthy' : 'degraded',
    checks_passed: Object.values(checks).filter((c) => c.status === 'pass').length,
    total_checks: Object.keys(checks).length,
    timestamp: new Date().toISOString(),
    checks,
  });
});

// -------------------------------------------------------------
// 2. AUTHENTICATION & USER MANAGEMENT
// -------------------------------------------------------------
router.post('/auth/sync-user', async (req: Request, res: Response) => {
  const { firebase_uid, email, name, phone } = req.body;
  if (!firebase_uid || !email) {
    return res.status(400).json({ error: 'firebase_uid and email are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const isAdminEmail = ADMIN_EMAILS.includes(normalizedEmail);

  try {
    const existing = await pool.query(
      'SELECT id, firebase_uid, email, name, phone, role FROM users WHERE firebase_uid = $1 OR email = $2',
      [firebase_uid, normalizedEmail]
    );

    let user;
    if (existing.rows.length > 0) {
      user = existing.rows[0];
      const targetRole = isAdminEmail ? 'ADMIN' : user.role || 'USER';
      const cleanPhone = phone ? phone.trim() : user.phone;
      const updated = await pool.query(
        'UPDATE users SET firebase_uid = $1, name = COALESCE($2, name), phone = COALESCE($3, phone), role = $4, updated_at = NOW() WHERE id = $5 RETURNING id, firebase_uid, email, name, phone, role',
        [firebase_uid, name || user.name, cleanPhone, targetRole, user.id]
      );
      user = updated.rows[0];
    } else {
      const targetRole = isAdminEmail ? 'ADMIN' : 'USER';
      const cleanPhone = phone ? phone.trim() : null;
      const created = await pool.query(
        'INSERT INTO users (firebase_uid, email, name, phone, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id, firebase_uid, email, name, phone, role',
        [firebase_uid, normalizedEmail, name || 'SRM Customer', cleanPhone, targetRole]
      );
      user = created.rows[0];
      await logAudit(user.id, 'USER_REGISTERED', `New customer signed in: ${normalizedEmail}`);
    }

    res.json({ user, ...user });
  } catch (err: any) {
    console.error('Error syncing user:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/update-phone', async (req: Request, res: Response) => {
  const { firebase_uid, phone } = req.body;
  if (!firebase_uid || !phone) {
    return res.status(400).json({ error: 'firebase_uid and phone are required' });
  }

  const cleanPhone = phone.trim();
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit phone number' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET phone = $1, updated_at = NOW() WHERE firebase_uid = $2 RETURNING id, firebase_uid, email, name, phone, role',
      [cleanPhone, firebase_uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    await logAudit(user.id, 'PHONE_UPDATED', `User updated phone number to: ${cleanPhone}`);
    res.json({ user });
  } catch (err: any) {
    console.error('Error updating phone:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/portal-login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Email / Username and password are required' });
  }

  const normalized = username.trim().toLowerCase();

  const isKitchenUser = [
    'srm',
    'kitchen',
    'kitchen@srmgoodfoods.com',
    'kitchen@srmist.edu.in',
    'srm@srmist.edu.in',
  ].includes(normalized);
  if (isKitchenUser && matchPassword(password, KITCHEN_PASSWORD)) {
    return res.json({
      portal: 'KITCHEN',
      user: {
        id: -101,
        name: 'SRM Kitchen Master',
        role: 'KITCHEN',
        username: 'srm',
        email: normalized.includes('@') ? normalized : 'kitchen@srmgoodfoods.com',
      },
      token: 'srm_kitchen_portal_token_2026',
    });
  }

  const isDeliveryUser = [
    'delivery',
    'delivery@srmgoodfoods.com',
    'delivery@srmist.edu.in',
    'rider@srmgoodfoods.com',
  ].includes(normalized);
  if (isDeliveryUser && matchPassword(password, DELIVERY_PASSWORD)) {
    return res.json({
      portal: 'DELIVERY',
      user: {
        id: -102,
        name: 'SRM Delivery Executive',
        role: 'DELIVERY',
        username: 'delivery',
        email: normalized.includes('@') ? normalized : 'delivery@srmgoodfoods.com',
      },
      token: 'srm_delivery_portal_token_2026',
    });
  }

  const isAdminUser =
    normalized === 'admin' ||
    normalized === 'admin@srmgoodfoods.com' ||
    normalized === 'admin@srmist.edu.in' ||
    ADMIN_EMAILS.includes(normalized);
  if (isAdminUser && matchPassword(password, ADMIN_PASSWORD)) {
    return res.json({
      portal: 'ADMIN',
      user: {
        id: -100,
        name: 'SRM Administrator',
        email: normalized.includes('@') ? normalized : 'admin@srmgoodfoods.com',
        role: 'ADMIN',
        username: 'admin',
      },
      token: 'srm_admin_portal_token_2026',
    });
  }

  try {
    const dbAdmin = await pool.query(
      "SELECT id, name, email, role FROM users WHERE LOWER(email) = $1 AND role = 'ADMIN' LIMIT 1",
      [normalized]
    );
    if (dbAdmin.rows.length > 0 && matchPassword(password, ADMIN_PASSWORD)) {
      const u = dbAdmin.rows[0];
      return res.json({
        portal: 'ADMIN',
        user: {
          id: u.id,
          name: u.name || 'SRM Administrator',
          email: u.email,
          role: 'ADMIN',
          username: 'admin',
        },
        token: 'srm_admin_portal_token_2026',
      });
    }
  } catch (err) {
    console.error('DB Admin check error:', err);
  }

  return res.status(401).json({
    error: 'Invalid credentials. Please verify your email / username and password.',
  });
});

// -------------------------------------------------------------
// 3. RESTAURANT SETTINGS & TIMINGS
// -------------------------------------------------------------
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM restaurant_settings ORDER BY id ASC LIMIT 1');
    if (result.rows.length === 0) {
      const inserted = await pool.query(
        "INSERT INTO restaurant_settings (is_open_today, opening_time, closing_time, closed_message, updated_at) VALUES (true, '07:00:00', '23:00:00', 'Kitchen is currently closed. We reopen at 7:00 AM.', NOW()) RETURNING *"
      );
      return res.json(inserted.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', async (req: Request, res: Response) => {
  const { is_open_today, opening_time, closing_time, closed_message } = req.body;
  try {
    const existing = await pool.query('SELECT id FROM restaurant_settings LIMIT 1');
    let updated;
    if (existing.rows.length > 0) {
      updated = await pool.query(
        'UPDATE restaurant_settings SET is_open_today = $1, opening_time = $2, closing_time = $3, closed_message = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
        [is_open_today, opening_time, closing_time, closed_message, existing.rows[0].id]
      );
    } else {
      updated = await pool.query(
        'INSERT INTO restaurant_settings (is_open_today, opening_time, closing_time, closed_message, updated_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
        [is_open_today, opening_time, closing_time, closed_message]
      );
    }
    await logAudit(
      null,
      'SETTINGS_UPDATED',
      `Shop settings updated: is_open=${is_open_today}, hours=${opening_time}-${closing_time}`
    );
    res.json(updated.rows[0]);
  } catch (err: any) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 4. CATEGORIES
// -------------------------------------------------------------
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM food_categories WHERE is_active = true ORDER BY display_order ASC, id ASC'
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/categories', async (req: Request, res: Response) => {
  const { name, display_order, is_active } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  try {
    const result = await pool.query(
      'INSERT INTO food_categories (name, display_order, is_active, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [name.trim(), display_order || 0, is_active !== false]
    );
    await logAudit(null, 'CATEGORY_ADDED', `Added category: ${name}`);
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error adding category:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/categories/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, display_order, is_active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE food_categories SET name = COALESCE($1, name), display_order = COALESCE($2, display_order), is_active = COALESCE($3, is_active) WHERE id = $4 RETURNING *',
      [name, display_order, is_active, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error updating category:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/categories/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE food_categories SET is_active = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Category deactivated' });
  } catch (err: any) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. FOOD ITEMS
// -------------------------------------------------------------
router.get('/items', async (req: Request, res: Response) => {
  const includeAll = req.query.all === 'true';
  try {
    let query = `
      SELECT f.*, c.name as category_name
      FROM food_items f
      LEFT JOIN food_categories c ON f.category_id = c.id
    `;
    if (!includeAll) {
      query += ' WHERE f.is_available = true AND (c.is_active = true OR c.is_active IS NULL)';
    }
    query += ' ORDER BY f.category_id ASC, f.id ASC';

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching items:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/items', async (req: Request, res: Response) => {
  const {
    category_id,
    name,
    description,
    price,
    image_url,
    is_available,
    available_start_time,
    available_end_time,
  } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO food_items 
       (category_id, name, description, price, image_url, is_available, available_start_time, available_end_time, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        category_id || null,
        name.trim(),
        description || '',
        parseFloat(price),
        image_url || '',
        is_available !== false,
        available_start_time || null,
        available_end_time || null,
      ]
    );
    await logAudit(null, 'ITEM_ADDED', `Added food item: ${name} (Rs. ${price})`);
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error adding item:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/items/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    category_id,
    name,
    description,
    price,
    image_url,
    is_available,
    available_start_time,
    available_end_time,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE food_items
       SET category_id = COALESCE($1, category_id),
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           price = COALESCE($4, price),
           image_url = COALESCE($5, image_url),
           is_available = COALESCE($6, is_available),
           available_start_time = $7,
           available_end_time = $8
       WHERE id = $9
       RETURNING *`,
      [
        category_id !== undefined ? category_id : null,
        name !== undefined ? name.trim() : null,
        description !== undefined ? description : null,
        price !== undefined ? parseFloat(price) : null,
        image_url !== undefined ? image_url : null,
        is_available !== undefined ? is_available : null,
        available_start_time || null,
        available_end_time || null,
        id,
      ]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error updating item:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/items/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM food_items WHERE id = $1', [id]);
    res.json({ success: true, message: 'Item deleted' });
  } catch (err: any) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 6. DELIVERY LOCATIONS
// -------------------------------------------------------------
router.get('/locations', async (req: Request, res: Response) => {
  const showAll = req.query.all === 'true';
  try {
    const query = showAll
      ? 'SELECT * FROM delivery_locations ORDER BY name ASC'
      : 'SELECT * FROM delivery_locations WHERE is_active = true ORDER BY name ASC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/locations', async (req: Request, res: Response) => {
  const { name, description, is_active } = req.body;
  if (!name) return res.status(400).json({ error: 'Location name is required' });

  try {
    const result = await pool.query(
      'INSERT INTO delivery_locations (name, description, is_active, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [name.trim(), description || '', is_active !== false]
    );
    await logAudit(null, 'LOCATION_ADDED', `Added delivery location: ${name}`);
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error adding location:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/locations/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, is_active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE delivery_locations SET name = COALESCE($1, name), description = COALESCE($2, description), is_active = COALESCE($3, is_active) WHERE id = $4 RETURNING *',
      [name, description, is_active, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Location not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error updating location:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/locations/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const hard = req.query.hard === 'true';
  try {
    if (hard) {
      const orderCheck = await pool.query(
        'SELECT id FROM orders WHERE delivery_location_id = $1 LIMIT 1',
        [id]
      );
      if (orderCheck.rows.length > 0) {
        await pool.query('UPDATE delivery_locations SET is_active = false WHERE id = $1', [id]);
        return res.json({
          success: true,
          message: 'Location deactivated as it has associated order history',
        });
      }
      await pool.query('DELETE FROM delivery_locations WHERE id = $1', [id]);
      return res.json({ success: true, message: 'Location permanently deleted' });
    } else {
      await pool.query('UPDATE delivery_locations SET is_active = false WHERE id = $1', [id]);
      return res.json({ success: true, message: 'Location deactivated' });
    }
  } catch (err: any) {
    console.error('Error deleting location:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 7. RAZORPAY PAYMENT & ORDER PLACEMENT
// -------------------------------------------------------------
router.post('/orders/create-razorpay-order', async (req: Request, res: Response) => {
  const { items, firebase_uid } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  try {
    if (firebase_uid) {
      const userRes = await pool.query('SELECT phone FROM users WHERE firebase_uid = $1', [
        firebase_uid,
      ]);
      if (userRes.rows.length === 0 || !userRes.rows[0].phone) {
        return res.status(400).json({
          error: 'Phone number is strictly required before placing order',
          code: 'PHONE_REQUIRED',
        });
      }
    }

    const settingsRes = await pool.query('SELECT * FROM restaurant_settings LIMIT 1');
    if (settingsRes.rows.length > 0) {
      const settings = settingsRes.rows[0];
      if (!settings.is_open_today) {
        return res.status(400).json({
          error: settings.closed_message || 'Restaurant is currently closed today.',
        });
      }
    }

    const itemIds = items.map((i: any) => i.food_item_id);
    const dbItemsRes = await pool.query(
      'SELECT id, name, price, is_available FROM food_items WHERE id = ANY($1)',
      [itemIds]
    );
    const dbItemsMap = new Map(dbItemsRes.rows.map((item) => [item.id, item]));

    let totalAmount = 0;
    for (const cartItem of items) {
      const dbItem = dbItemsMap.get(cartItem.food_item_id);
      if (!dbItem || !dbItem.is_available) {
        return res.status(400).json({
          error: `Item "${cartItem.name || 'selected'}" is currently unavailable`,
        });
      }
      totalAmount += dbItem.price * cartItem.quantity;
    }

    if (totalAmount <= 0) {
      return res.status(400).json({ error: 'Invalid order total' });
    }

    const amountInPaisa = Math.round(totalAmount * 100);

    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaisa,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      notes: {
        firebase_uid: firebase_uid || '',
      },
    });

    res.json({
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: RAZORPAY_KEY_ID,
      total_amount: totalAmount,
    });
  } catch (err: any) {
    console.error('Error creating Razorpay order:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/orders/verify-and-place', async (req: Request, res: Response) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    firebase_uid,
    delivery_location_id,
    kitchen_notes,
    items,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing Razorpay payment verification details' });
  }

  if (!firebase_uid) {
    return res.status(400).json({ error: 'User authentication is required' });
  }

  if (!delivery_location_id) {
    return res.status(400).json({ error: 'Please select a delivery location' });
  }

  try {
    const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error('Signature mismatch:', { generatedSignature, razorpay_signature });
      return res.status(400).json({
        error: 'Payment signature verification failed. Order not recorded.',
      });
    }

    const userRes = await pool.query(
      'SELECT id, name, email, phone FROM users WHERE firebase_uid = $1',
      [firebase_uid]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    const user = userRes.rows[0];

    if (!user.phone) {
      return res.status(400).json({
        error: 'Phone number is strictly required before placing order',
        code: 'PHONE_REQUIRED',
      });
    }

    const locRes = await pool.query('SELECT id, name FROM delivery_locations WHERE id = $1', [
      delivery_location_id,
    ]);
    const locationName = locRes.rows.length > 0 ? locRes.rows[0].name : 'Campus Location';

    const itemIds = items.map((i: any) => i.food_item_id);
    const dbItemsRes = await pool.query(
      'SELECT id, name, price FROM food_items WHERE id = ANY($1)',
      [itemIds]
    );
    const dbItemsMap = new Map(dbItemsRes.rows.map((item) => [item.id, item]));

    let totalAmount = 0;
    const validatedItems: any[] = [];
    for (const item of items) {
      const dbItem = dbItemsMap.get(item.food_item_id);
      if (dbItem) {
        const subtotal = dbItem.price * item.quantity;
        totalAmount += subtotal;
        validatedItems.push({
          food_item_id: dbItem.id,
          name: dbItem.name,
          price: dbItem.price,
          quantity: item.quantity,
          subtotal,
        });
      }
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `SRM-${randomSuffix}`;
    const rawOtp = String(Math.floor(1000 + Math.random() * 9000));
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

    const orderInsert = await pool.query(
      `INSERT INTO orders 
       (order_number, user_id, delivery_location_id, location_name_snapshot, status, total_amount, payment_status, 
        razorpay_order_id, razorpay_payment_id, razorpay_signature, raw_otp, otp_hash, otp_attempts, kitchen_notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, $13, NOW())
       RETURNING *`,
      [
        orderNumber,
        user.id,
        delivery_location_id,
        locationName,
        'CONFIRMED',
        totalAmount,
        'PAID',
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        rawOtp,
        otpHash,
        kitchen_notes || '',
      ]
    );

    const createdOrder = orderInsert.rows[0];

    for (const vItem of validatedItems) {
      await pool.query(
        `INSERT INTO order_items (order_id, food_item_id, item_name_snapshot, price_snapshot, quantity, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [createdOrder.id, vItem.food_item_id, vItem.name, vItem.price, vItem.quantity, vItem.subtotal]
      );
    }

    await logAudit(
      user.id,
      'ORDER_PLACED',
      `Order ${orderNumber} placed for Rs. ${totalAmount}. Payment ID: ${razorpay_payment_id}. Location: ${locationName}`
    );

    res.json({
      success: true,
      order: {
        ...createdOrder,
        items: validatedItems,
      },
    });
  } catch (err: any) {
    console.error('Error verifying and placing order:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 8. ORDER QUERIES & STATUS UPDATES
// -------------------------------------------------------------
router.get('/orders/my-orders', async (req: Request, res: Response) => {
  const { firebase_uid } = req.query;
  if (!firebase_uid) {
    return res.status(400).json({ error: 'firebase_uid is required' });
  }

  try {
    const userRes = await pool.query('SELECT id FROM users WHERE firebase_uid = $1', [
      firebase_uid,
    ]);
    if (userRes.rows.length === 0) {
      return res.json([]);
    }
    const userId = userRes.rows[0].id;

    const ordersRes = await pool.query(
      `SELECT o.*, 
        json_agg(json_build_object(
          'id', oi.id,
          'food_item_id', oi.food_item_id,
          'item_name', oi.item_name_snapshot,
          'price', oi.price_snapshot,
          'quantity', oi.quantity,
          'subtotal', oi.subtotal
        )) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [userId]
    );

    res.json(ordersRes.rows);
  } catch (err: any) {
    console.error('Error fetching user orders:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders/track/:orderNumber', async (req: Request, res: Response) => {
  const { orderNumber } = req.params;
  try {
    const orderRes = await pool.query(
      `SELECT o.*, u.name as customer_name, u.phone as customer_phone,
        json_agg(json_build_object(
          'id', oi.id,
          'food_item_id', oi.food_item_id,
          'item_name', oi.item_name_snapshot,
          'price', oi.price_snapshot,
          'quantity', oi.quantity,
          'subtotal', oi.subtotal
        )) as items
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.order_number = $1 OR o.id::text = $1
       GROUP BY o.id, u.name, u.phone`,
      [orderNumber]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(orderRes.rows[0]);
  } catch (err: any) {
    console.error('Error tracking order:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders/kitchen', async (_req: Request, res: Response) => {
  try {
    const ordersRes = await pool.query(
      `SELECT o.*, u.name as customer_name, u.phone as customer_phone,
        json_agg(json_build_object(
          'id', oi.id,
          'food_item_id', oi.food_item_id,
          'item_name', oi.item_name_snapshot,
          'price', oi.price_snapshot,
          'quantity', oi.quantity,
          'subtotal', oi.subtotal
        )) as items
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       GROUP BY o.id, u.name, u.phone
       ORDER BY 
         CASE 
           WHEN o.status = 'CONFIRMED' THEN 1
           WHEN o.status = 'PREPARING' THEN 2
           WHEN o.status = 'DISPATCHED' THEN 3
           ELSE 4
         END ASC,
         o.created_at DESC`
    );

    res.json(ordersRes.rows);
  } catch (err: any) {
    console.error('Error fetching kitchen orders:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders/delivery', async (_req: Request, res: Response) => {
  try {
    const ordersRes = await pool.query(
      `SELECT o.*, u.name as customer_name, u.phone as customer_phone,
        json_agg(json_build_object(
          'id', oi.id,
          'food_item_id', oi.food_item_id,
          'item_name', oi.item_name_snapshot,
          'price', oi.price_snapshot,
          'quantity', oi.quantity,
          'subtotal', oi.subtotal
        )) as items
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       GROUP BY o.id, u.name, u.phone
       ORDER BY 
         CASE 
           WHEN o.status = 'DISPATCHED' THEN 1
           WHEN o.status = 'PREPARING' THEN 2
           WHEN o.status = 'CONFIRMED' THEN 3
           ELSE 4
         END ASC,
         o.created_at DESC`
    );

    res.json(ordersRes.rows);
  } catch (err: any) {
    console.error('Error fetching delivery orders:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/orders/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, actor } = req.body;

  const validStatuses = ['CONFIRMED', 'PREPARING', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    let timestampCol = '';
    if (status === 'PREPARING') timestampCol = ', preparing_at = NOW()';
    if (status === 'DISPATCHED') timestampCol = ', dispatched_at = NOW()';
    if (status === 'DELIVERED') timestampCol = ', delivered_at = NOW()';
    if (status === 'CANCELLED') timestampCol = ', cancelled_at = NOW()';

    const result = await pool.query(
      `UPDATE orders SET status = $1 ${timestampCol} WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = result.rows[0];
    await logAudit(
      null,
      'STATUS_UPDATED',
      `Order ${order.order_number} status updated to ${status} by ${actor || 'Staff'}`
    );

    res.json({ success: true, order });
  } catch (err: any) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/orders/:id/verify-otp', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { otp, actor } = req.body;

  if (!otp) {
    return res.status(400).json({
      error: 'Please enter the 4-digit OTP provided by the customer',
    });
  }

  try {
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRes.rows[0];
    const inputCleanOtp = String(otp).trim();

    const inputHash = crypto.createHash('sha256').update(inputCleanOtp).digest('hex');
    const isMatch = order.raw_otp === inputCleanOtp || order.otp_hash === inputHash;

    if (!isMatch) {
      await pool.query(
        'UPDATE orders SET otp_attempts = COALESCE(otp_attempts, 0) + 1 WHERE id = $1',
        [id]
      );
      return res.status(400).json({
        error: 'Incorrect OTP. Please ask the customer for the correct 4-digit code.',
      });
    }

    const updated = await pool.query(
      'UPDATE orders SET status = $1, delivered_at = NOW() WHERE id = $2 RETURNING *',
      ['DELIVERED', id]
    );

    await logAudit(
      null,
      'OTP_VERIFIED_DELIVERED',
      `Order ${order.order_number} delivered successfully with OTP verification by ${
        actor || 'Delivery Partner'
      }`
    );

    res.json({
      success: true,
      message: 'OTP verified! Order successfully marked as Delivered.',
      order: updated.rows[0],
    });
  } catch (err: any) {
    console.error('Error verifying delivery OTP:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 9. ADMIN ANALYTICS & USERS (Zero audit_logs storage)
// -------------------------------------------------------------
router.get('/admin/analytics', async (_req: Request, res: Response) => {
  try {
    const revRes = await pool.query(
      "SELECT COALESCE(SUM(total_amount), 0) as total_revenue, COUNT(*) as total_orders FROM orders WHERE payment_status = 'PAID' AND status != 'CANCELLED'"
    );

    const todayRes = await pool.query(
      "SELECT COALESCE(SUM(total_amount), 0) as today_revenue, COUNT(*) as today_orders FROM orders WHERE payment_status = 'PAID' AND status != 'CANCELLED' AND created_at >= CURRENT_DATE"
    );

    const activeRes = await pool.query(
      "SELECT COUNT(*) as active_orders FROM orders WHERE status IN ('CONFIRMED', 'PREPARING', 'DISPATCHED')"
    );

    const statusRes = await pool.query(
      'SELECT status, COUNT(*) as count FROM orders GROUP BY status'
    );

    const topItemsRes = await pool.query(
      `SELECT oi.item_name_snapshot as name, SUM(oi.quantity) as total_quantity, SUM(oi.subtotal) as total_sales
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.payment_status = 'PAID' AND o.status != 'CANCELLED'
       GROUP BY oi.item_name_snapshot
       ORDER BY total_quantity DESC
       LIMIT 6`
    );

    // Recent activity is synthesized directly from orders (consumes 0 audit log storage space)
    let recentLogs: any[] = [];
    try {
      const recentOrdersRes = await pool.query(
        `SELECT o.id, 
                o.user_id,
                'ORDER_' || o.status as action,
                'Order #' || o.order_number || ' (' || o.status || ') - ₹' || o.total_amount || ' at ' || o.location_name_snapshot as details,
                u.name as user_name,
                u.email as user_email,
                o.created_at
         FROM orders o
         JOIN users u ON o.user_id = u.id
         ORDER BY o.created_at DESC
         LIMIT 20`
      );
      recentLogs = recentOrdersRes.rows;
    } catch {
      recentLogs = [];
    }

    const usersCountRes = await pool.query('SELECT COUNT(*) as count FROM users');

    res.json({
      total_revenue: parseFloat(revRes.rows[0].total_revenue),
      total_orders: parseInt(revRes.rows[0].total_orders, 10),
      today_revenue: parseFloat(todayRes.rows[0].today_revenue),
      today_orders: parseInt(todayRes.rows[0].today_orders, 10),
      active_orders: parseInt(activeRes.rows[0].active_orders, 10),
      total_users: parseInt(usersCountRes.rows[0].count, 10),
      status_distribution: statusRes.rows,
      top_items: topItemsRes.rows,
      recent_logs: recentLogs,
    });
  } catch (err: any) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/users', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.firebase_uid, u.email, u.name, u.phone, u.role, u.created_at, u.updated_at,
        COUNT(o.id) as orders_count,
        COALESCE(SUM(o.total_amount), 0) as total_spent
       FROM users u
       LEFT JOIN orders o ON u.id = o.user_id AND o.payment_status = 'PAID'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/clear-orders', async (req: Request, res: Response) => {
  const { mode } = req.body;
  try {
    if (mode === 'COMPLETED_ONLY') {
      const orderIdsRes = await pool.query(
        "SELECT id FROM orders WHERE status IN ('DELIVERED', 'CANCELLED')"
      );
      const ids = orderIdsRes.rows.map((r) => r.id);
      if (ids.length > 0) {
        await pool.query('DELETE FROM order_items WHERE order_id = ANY($1)', [ids]);
        await pool.query('DELETE FROM orders WHERE id = ANY($1)', [ids]);
      }
      return res.json({
        success: true,
        count: ids.length,
        message: `Successfully cleared ${ids.length} completed orders.`,
      });
    } else if (mode === 'ALL') {
      await pool.query('DELETE FROM order_items');
      const delOrders = await pool.query('DELETE FROM orders');
      return res.json({
        success: true,
        count: delOrders.rowCount,
        message: 'All orders cleared successfully.',
      });
    } else {
      return res.status(400).json({ error: "Invalid mode. Use 'COMPLETED_ONLY' or 'ALL'" });
    }
  } catch (err: any) {
    console.error('Error clearing orders:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mount router on both '/api' and root '/'
app.use('/api', router);
app.use('/', router);

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the Vite static build directory (supports dist/api/index.js on Render or local execution)
const distPath = fs.existsSync(path.join(__dirname, '../../dist'))
  ? path.join(__dirname, '../../dist')
  : fs.existsSync(path.join(__dirname, '../dist'))
  ? path.join(__dirname, '../dist')
  : path.join(process.cwd(), 'dist');

// Serve Vite build static assets
app.use(express.static(distPath));

// Fallback to index.html for client-side SPA routing (only for non-API routes)
app.get('*', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api')) {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  res.status(404).json({ error: 'API route not found' });
});

// Global Express error handler ensuring JSON responses instead of HTML
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('Unhandled API Error:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: err.message || 'A server error occurred in API',
      code: err.code || 'INTERNAL_SERVER_ERROR',
    });
  }
});

const PORT = process.env.PORT || 3000;

// Start server on Render or standalone Node; Vite handles routing in dev mode
if (!process.env.VITE_DEV_SERVER) {
  app.listen(PORT, () => {
    console.log(`SRM Good Foods running on ${PORT}`);
  });
}

export default app;
