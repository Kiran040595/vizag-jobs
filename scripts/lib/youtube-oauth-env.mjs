import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

export function loadEnvFile() {
  const files = ['.env.local', '.env'];
  const merged = {};

  for (const file of files) {
    const filePath = path.join(projectRoot, file);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          return;
        }
        const eq = trimmed.indexOf('=');
        if (eq === -1) {
          return;
        }
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
        merged[key] = value;
      });
  }

  return merged;
}
