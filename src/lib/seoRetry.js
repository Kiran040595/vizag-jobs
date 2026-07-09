/** Default wait before retrying Make SEO after timeout / gateway errors. */
export const SEO_RETRY_DELAY_MS = 45_000;

/** Max Make SEO attempts per job during automation (rotates keys when configured). */
export const SEO_MAX_ATTEMPTS_PER_JOB = 4;

/**
 * @param {string} message
 * @returns {boolean}
 */
export function isSeoRateLimitError(message) {
  return /429|rate limit|quota|retry in|Wait ~\d+s/i.test(message);
}

/**
 * @param {string} message
 * @returns {boolean}
 */
export function isSeoTimeoutOrGatewayError(message) {
  return /502|504|546|timed out|time limit|aborted|AbortError|TimeoutError|exceeded the server|gateway/i.test(
    message,
  );
}

/**
 * @param {string} message
 * @returns {boolean}
 */
export function isSeoRetryableError(message) {
  return isSeoRateLimitError(message) || isSeoTimeoutOrGatewayError(message);
}

/**
 * @param {string} message
 * @returns {number}
 */
export function parseSeoRateLimitWaitMs(message) {
  const retryIn = message.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  if (retryIn) {
    return Math.ceil(Number(retryIn[1]) * 1000) + 1000;
  }
  const waitTilde = message.match(/Wait ~(\d+)s/i);
  if (waitTilde) {
    return Number(waitTilde[1]) * 1000 + 1000;
  }
  return 20_000;
}

/**
 * @param {string} message
 * @returns {number}
 */
export function parseSeoRetryWaitMs(message) {
  if (isSeoRateLimitError(message)) {
    return parseSeoRateLimitWaitMs(message);
  }
  return SEO_RETRY_DELAY_MS;
}

/**
 * Parse 1-based Gemini pool index from a Make SEO error message.
 * @param {string} message
 * @returns {number | null}
 */
export function parseGeminiKeyIndexFromError(message) {
  const ofTotal = message.match(/Key (\d+) of (\d+)/i);
  if (ofTotal) {
    const index = Number(ofTotal[1]);
    return Number.isFinite(index) && index > 0 ? index : null;
  }
  const hashOnly = message.match(/Key #(\d+)/i);
  if (hashOnly) {
    const index = Number(hashOnly[1]);
    return Number.isFinite(index) && index > 0 ? index : null;
  }
  return null;
}

/**
 * @param {Array<{ index?: number }> | null | undefined} keys
 * @returns {number[]}
 */
export function geminiKeyIndicesFromPool(keys) {
  if (!Array.isArray(keys)) {
    return [];
  }
  return keys
    .map((key) => Number(key?.index))
    .filter((index) => Number.isFinite(index) && index > 0)
    .sort((a, b) => a - b);
}

/**
 * Pick the next configured Gemini key after a failure (wraps around).
 * @param {Array<{ index?: number }> | null | undefined} keys
 * @param {number | null | undefined} lastFailedIndex
 * @returns {number} 0 = auto shuffle, otherwise 1-based pool index
 */
export function nextGeminiKeyIndex(keys, lastFailedIndex) {
  const indices = geminiKeyIndicesFromPool(keys);
  if (indices.length === 0) {
    return 0;
  }
  if (lastFailedIndex == null || lastFailedIndex <= 0) {
    return indices[0];
  }
  const position = indices.indexOf(lastFailedIndex);
  if (position < 0) {
    return indices[0];
  }
  return indices[(position + 1) % indices.length];
}

/**
 * @param {Array<{ index?: number }> | null | undefined} keys
 * @returns {number}
 */
export function maxSeoAttemptsForKeyPool(keys) {
  const count = geminiKeyIndicesFromPool(keys).length;
  if (count <= 0) {
    return 2;
  }
  return Math.min(SEO_MAX_ATTEMPTS_PER_JOB, count);
}
