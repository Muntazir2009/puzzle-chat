import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const envPath = join(root, '.env.local');
const wranglerPath = join(root, 'wrangler.jsonc');

// Read wrangler.jsonc and extract NEXT_PUBLIC_ vars
function extractFromWrangler() {
  const raw = readFileSync(wranglerPath, 'utf-8');
  const env = {};
  // Match "NEXT_PUBLIC_...": "value" patterns (handles multiline too)
  const regex = /"(NEXT_PUBLIC_[A-Z_]+)"\s*:\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    env[match[1]] = match[2];
  }
  return env;
}

// Build .env.local content from wrangler vars
const vars = extractFromWrangler();
const content = Object.entries(vars)
  .map(([k, v]) => `${k}=${v}`)
  .join('\n') + '\n';

// Write only if missing or different
if (!existsSync(envPath) || readFileSync(envPath, 'utf-8').trim() !== content.trim()) {
  writeFileSync(envPath, content);
  console.log('[ensure-env] .env.local synced from wrangler.jsonc');
} else {
  console.log('[ensure-env] .env.local already up to date');
}
