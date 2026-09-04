#!/usr/bin/env node
/**
 * SRM Good Foods — Smoke Test & Deployment Readiness Validator
 *
 * Usage:
 *   node scripts/smoke-test.mjs [baseUrl]
 * Example:
 *   node scripts/smoke-test.mjs
 *   node scripts/smoke-test.mjs https://srm-good-foods.vercel.app
 */

const targetBase = process.argv[2] || process.env.TEST_URL || 'http://localhost:3000';
const normalizedBase = targetBase.replace(/\/+$/, '');

console.log('\n======================================================');
console.log('🚀 SRM Good Foods — Production Smoke Test & Verification');
console.log(`🎯 Target Base URL: ${normalizedBase}`);
console.log('======================================================\n');

async function run() {
  try {
    const smokeUrl = `${normalizedBase}/api/smoke-test`;
    console.log(`Testing: ${smokeUrl} ...\n`);

    const res = await fetch(smokeUrl);
    const data = await res.json();

    const c = data.checks || {};

    // 1. Database
    if (c.database?.status === 'pass') {
      console.log(`✅ [PASS] Database Connection`);
      console.log(`         Connected: YES (${c.database.details.latency_ms}ms latency)`);
      console.log(`         Database:  ${c.database.details.database}`);
      console.log(`         Records:   ${c.database.details.categories_count} categories, ${c.database.details.items_count} menu items`);
    } else {
      console.log(`❌ [FAIL] Database Connection`);
      console.log(`         Error: ${c.database?.details?.error || 'Unknown error'}`);
    }

    console.log('');

    // 2. Required Environment Variables
    if (c.environment_variables?.status === 'pass') {
      console.log(`✅ [PASS] Required Environment Variables`);
      console.log(`         Configured: ${c.environment_variables.details.configured_count}/${c.environment_variables.details.total_required} core variables present`);
      console.log(`         Admin Emails: Configured (${c.environment_variables.details.admin_emails_configured ? 'YES' : 'NO'})`);
    } else {
      console.log(`❌ [FAIL] Required Environment Variables`);
      console.log(`         Missing: ${(c.environment_variables?.details?.missing || []).join(', ')}`);
    }

    console.log('');

    // 3. Razorpay Initialization
    if (c.razorpay?.status === 'pass') {
      console.log(`✅ [PASS] Razorpay Payment Gateway`);
      console.log(`         Key ID Prefix: ${c.razorpay.details.key_id_prefix}`);
      console.log(`         Client Initialized: YES`);
    } else if (c.razorpay?.status === 'warn') {
      console.log(`⚠️ [WARN] Razorpay Payment Gateway`);
      console.log(`         ${c.razorpay.details.message}`);
      console.log(`         (Cash on Delivery and test ordering still function normally)`);
    } else {
      console.log(`❌ [FAIL] Razorpay Payment Gateway`);
      console.log(`         ${c.razorpay?.details?.message || 'Initialization failed'}`);
    }

    console.log('');

    // 4. Firebase Configuration
    if (c.firebase?.status === 'pass') {
      console.log(`✅ [PASS] Firebase Authentication & Client Config`);
      console.log(`         Project: ${c.firebase.details.project_id}`);
      console.log(`         API Key Set: ${c.firebase.details.api_key_configured ? 'YES' : 'NO'}`);
    } else {
      console.log(`⚠️ [WARN] Firebase Configuration`);
      console.log(`         ${c.firebase?.details?.message || 'Not configured in environment'}`);
    }

    console.log('\n------------------------------------------------------');
    if (data.status === 'healthy') {
      console.log(`🎉 Overall Status: HEALTHY (${data.checks_passed}/${data.total_checks} checks passed)`);
      console.log('Backend is verified and ready to handle traffic!\n');
      process.exit(0);
    } else {
      console.log(`⚠️ Overall Status: DEGRADED (${data.checks_passed}/${data.total_checks} checks passed)`);
      console.log('Check warnings or failures above before routing production traffic.\n');
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Smoke test connection failed: ${err.message}`);
    console.log('Ensure the server or deployment URL is running and accessible.');
    process.exit(1);
  }
}

run();
