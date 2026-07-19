import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const adsTxtPath = path.join(projectRoot, 'public', 'ads.txt');

const loadEnvFile = (filename) => {
  const filePath = path.join(projectRoot, filename);
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((envVars, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return envVars;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return envVars;
      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      envVars[key] = rawValue.replace(/^['"]|['"]$/g, '');
      return envVars;
    }, {});
};

const env = {
  ...loadEnvFile('.env'),
  ...loadEnvFile('.env.local'),
  ...process.env,
};

const clientId = String(env.VITE_ADSENSE_CLIENT_ID || '').trim();

if (!/^ca-pub-\d+$/i.test(clientId)) {
  // Keep a discoverable file so /ads.txt is not a soft-404 while waiting for setup.
  const placeholder = [
    '# JobsInVizag.in ads.txt',
    '# Set VITE_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXX in .env / Vercel, then rebuild.',
    '# Example:',
    '# google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0',
    '',
  ].join('\n');
  fs.writeFileSync(adsTxtPath, placeholder, 'utf8');
  console.warn('ads.txt: VITE_ADSENSE_CLIENT_ID not set — wrote placeholder comments only.');
  process.exit(0);
}

const pubId = clientId.replace(/^ca-pub-/i, '');
const line = `google.com, pub-${pubId}, DIRECT, f08c47fec0942fa0`;
fs.writeFileSync(adsTxtPath, `${line}\n`, 'utf8');
console.log(`Generated ads.txt for ${clientId}`);
