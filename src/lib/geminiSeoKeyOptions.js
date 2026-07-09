/** @typedef {{ index: number, label: string, source?: string, hint?: string }} GeminiSeoKeyOption */

/**
 * @param {GeminiSeoKeyOption | null | undefined} key
 * @returns {string}
 */
export function formatGeminiSeoKeyOptionLabel(key) {
  if (!key || !Number.isFinite(Number(key.index))) {
    return '';
  }
  const parts = [`Key ${key.index}`];
  if (key.label) {
    parts.push(key.label);
  } else if (key.source) {
    parts.push(key.source);
  }
  if (key.hint) {
    parts.push(key.hint);
  }
  return parts.join(' · ');
}

/**
 * @param {GeminiSeoKeyOption[] | null | undefined} keys
 * @returns {Array<{ value: string, label: string }>}
 */
export function buildGeminiSeoKeySelectOptions(keys) {
  const options = [{ value: '0', label: 'Default (auto shuffle)' }];
  if (!Array.isArray(keys)) {
    return options;
  }
  for (const key of keys) {
    const index = Number(key?.index);
    if (!Number.isFinite(index) || index <= 0) {
      continue;
    }
    options.push({
      value: String(index),
      label: formatGeminiSeoKeyOptionLabel(key),
    });
  }
  return options;
}

/**
 * @param {unknown} value
 * @returns {number} 0 = auto, otherwise 1-based pool index
 */
export function parseGeminiSeoKeySelectValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.floor(n);
}
