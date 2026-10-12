// Run SQL against the project via the Supabase Management API. Usage: node scripts/sql.mjs "update ..."
// Token: first key in ../.env.admin whose name contains TOKEN. Project ref: from VITE_SUPABASE_URL in ../.env.
import { readFileSync } from 'node:fs';
const parse = (f) => Object.fromEntries(readFileSync(new URL(f, import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const env = parse('../.env'), admin = parse('../.env.admin');
const token = admin[Object.keys(admin).find((k) => /TOKEN/i.test(k))];
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const query = process.argv[2] ?? readFileSync(0, 'utf8');
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
console.log(res.status, JSON.stringify(await res.json()).slice(0, 2000));
