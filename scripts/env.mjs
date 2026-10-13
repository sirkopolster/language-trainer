// Reads ../.env (anon) and ../.env.admin (token, QA user) into one object. Shared by sql.mjs, smoke.mjs, qa-cleanup.mjs.
import { readFileSync } from 'node:fs';
const parse = (f) => {
  try { return Object.fromEntries(readFileSync(new URL(f, import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })); }
  catch { return {}; }
};
export const env = { ...parse('../.env'), ...parse('../.env.admin') };
