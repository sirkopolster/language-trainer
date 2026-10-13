// Runs the Supabase CLI with the access token from ../.env.admin. Usage: node scripts/fn.mjs functions deploy extract
import { spawnSync } from 'node:child_process';
import { env } from './env.mjs';
const r = spawnSync('npx', ['supabase@latest', ...process.argv.slice(2), '--project-ref', 'aoshordvmsoynvypvefc'], {
  stdio: 'inherit', shell: true, env: { ...process.env, SUPABASE_ACCESS_TOKEN: env.SUPABASE_ACCESS_TOKEN },
});
process.exit(r.status ?? 1);
