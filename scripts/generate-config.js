#!/usr/bin/env node
/*
 * Build-time config generator.
 *
 * Netlify runs this before publishing. It reads SUPABASE_URL and
 * SUPABASE_ANON_KEY from the environment and writes js/config.js so the
 * static bundle knows which Supabase project to talk to — one per tenant,
 * without touching the code.
 *
 * Fallback: if the env vars aren't set (local dev, missed setup, …) we
 * emit the PAF Wambrechies defaults so nothing breaks on the historical
 * instance.
 */
const fs   = require('fs');
const path = require('path');

const DEFAULT_URL   = 'https://ancwbfyjzaebxahtlqkm.supabase.co';
const DEFAULT_KEY   = 'sb_publishable_jCDrtwqzqjbsq0NEIwUbPQ_EFeoFaDh';
const DEFAULT_SLUG  = 'paf-wambrechies';

const url  = process.env.SUPABASE_URL      || DEFAULT_URL;
const key  = process.env.SUPABASE_ANON_KEY || DEFAULT_KEY;
const slug = process.env.TENANT_SLUG       || DEFAULT_SLUG;

const body = `/* Generated at build time by scripts/generate-config.js. Do not edit by hand. */
window.__PAF_CONFIG__ = {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(key)},
  TENANT_SLUG: ${JSON.stringify(slug)}
};
`;

const out = path.join(__dirname, '..', 'js', 'config.js');
fs.writeFileSync(out, body);

console.log('[generate-config] Wrote', out);
console.log('[generate-config] TENANT_SLUG =', slug, slug === DEFAULT_SLUG ? '(default)' : '(from env)');
