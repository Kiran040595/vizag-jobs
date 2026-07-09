/**
 * Human-readable Gemini API key usage from Make SEO `seo_meta` or edge response.
 * Never shows full keys — only secret name, pool index, and last-4 hint.
 *
 * @param {Record<string, unknown> | null | undefined} meta
 * @returns {string | null}
 */
export function formatGeminiKeyUsage(meta) {
  if (!meta || typeof meta !== 'object') {
    return null;
  }

  const label = typeof meta.gemini_key_label === 'string' ? meta.gemini_key_label.trim() : '';
  const source = typeof meta.gemini_key_source === 'string' ? meta.gemini_key_source.trim() : '';
  const hint = typeof meta.gemini_key_hint === 'string' ? meta.gemini_key_hint.trim() : '';
  const index = Number(meta.gemini_key_index);
  const total = Number(meta.gemini_keys_total);

  const name = label || source;
  if (!name && !Number.isFinite(index)) {
    return null;
  }

  const parts = [];
  if (Number.isFinite(index) && Number.isFinite(total) && total > 0) {
    parts.push(`Key ${index} of ${total}`);
  } else if (Number.isFinite(index) && index > 0) {
    parts.push(`Key #${index}`);
  }
  if (name) {
    parts.push(name);
  }
  if (hint) {
    parts.push(hint);
  }
  return parts.join(' · ');
}

/**
 * @param {Record<string, unknown> | null | undefined} data SEO edge response
 * @returns {Record<string, unknown> | null}
 */
export function geminiKeyFieldsFromSeoResponse(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const jobMeta =
    data.job && typeof data.job === 'object' && data.job.seo_meta && typeof data.job.seo_meta === 'object'
      ? data.job.seo_meta
      : null;
  const pick = (key) => data[key] ?? jobMeta?.[key];
  if (
    pick('gemini_key_label') == null &&
    pick('gemini_key_index') == null &&
    !Array.isArray(pick('gemini_keys_configured'))
  ) {
    return null;
  }
  return {
    gemini_model: pick('gemini_model'),
    gemini_key_index: pick('gemini_key_index'),
    gemini_keys_total: pick('gemini_keys_total'),
    gemini_key_source: pick('gemini_key_source'),
    gemini_key_label: pick('gemini_key_label'),
    gemini_key_hint: pick('gemini_key_hint'),
    gemini_keys_configured: pick('gemini_keys_configured'),
    runtime_ms: pick('runtime_ms'),
    seo_profile: pick('seo_profile'),
  };
}

/**
 * Append Gemini key context to a Make SEO error message (502/timeouts included).
 * @param {string} message
 * @param {Record<string, unknown> | null | undefined} data
 * @returns {string}
 */
export function appendGeminiKeyToSeoErrorMessage(message, data) {
  const fields = geminiKeyFieldsFromSeoResponse(data);
  const keyLine = formatGeminiKeyUsage(fields);
  if (keyLine) {
    if (message.includes(keyLine) || message.includes('Gemini key:')) {
      return message;
    }
    return `${message} Gemini key: ${keyLine}.`;
  }

  const configured = fields?.gemini_keys_configured;
  if (Array.isArray(configured) && configured.length > 0) {
    const list = configured.map(String).join(', ');
    if (message.includes(list)) {
      return message;
    }
    return `${message} Configured Gemini keys (${configured.length}): ${list}.`;
  }

  return message;
}
