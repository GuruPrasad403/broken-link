import got from 'got';
import pLimit from 'p-limit';
import { assetsDb, generateId } from './store.js';
import { emitLog } from './logBus.js';

const limit = pLimit(20); // Max concurrent checks

/**
 * Check a single asset URL.
 * Returns: true (broken), false (OK), null (already cached / skipped)
 */
export const checkAsset = async (assetUrl, assetType, pageUrl, jobId, cache, timeout = 10000) => {
  if (cache.has(assetUrl)) {
    return null;
  }
  cache.add(assetUrl);

  return limit(async () => {
    let statusCode = null;
    let failureReason = null;
    let isBroken = false;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    const gotOptions = {
      headers,
      timeout: { request: timeout },
      retry: { limit: 1 },
      throwHttpErrors: false,
      followRedirect: true,
      https: { rejectUnauthorized: false }
    };

    try {
      // --- Step 1: HEAD request to get final status code after redirects ---
      let headResponse = await got.head(assetUrl, gotOptions);
      statusCode = headResponse.statusCode;

      // Some servers block HEAD and return 403, 404, 405, etc. — fall back to GET
      if (statusCode >= 400) {
        const getResp = await got.get(assetUrl, gotOptions);
        statusCode = getResp.statusCode;
      }

      // --- Step 2: If status is 4xx/5xx — definitively broken ---
      if (statusCode >= 400) {
        // For CSS/JS only: do a body check to handle servers that serve real content with wrong status codes
        if (assetType === 'CSS' || assetType === 'JavaScript') {
          const getResp = await got.get(assetUrl, gotOptions);
          const contentType = getResp.headers['content-type'] || '';
          const body = (getResp.body || '').toString().trim();
          const isHtml = contentType.includes('text/html') || body.startsWith('<html') || body.startsWith('<!DOCTYPE');
          const isTinyError = body.length < 200 && /not found|404|forbidden|403|error/i.test(body);

          // If body has real CSS/JS content (not HTML, not a tiny error message) → soft error, not broken
          if (body.length > 0 && !isHtml && !isTinyError) {
            return false;
          }
        }

        isBroken = true;
        failureReason = `HTTP ${statusCode}`;
      }
      // Status < 400 means it's working fine. (Soft 404 logic removed as per user request for true 404s only)

    } catch (error) {
      isBroken = true;
      statusCode = null;
      if (error.code === 'ETIMEDOUT' || error.name === 'TimeoutError') failureReason = 'Timeout';
      else if (error.code === 'ENOTFOUND') failureReason = 'DNS failure (domain not found)';
      else if (error.code === 'ECONNREFUSED') failureReason = 'Connection refused';
      else if (error.code === 'ECONNRESET') failureReason = 'Connection reset';
      else if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') failureReason = 'SSL certificate error';
      else failureReason = error.message?.slice(0, 150) || 'Network failure';
    }

    if (isBroken) {
      if (statusCode === 404) {
        emitLog(jobId, 'broken', `[BROKEN] ${assetType} → ${failureReason}: ${assetUrl}`, assetUrl, statusCode);
        const assets = assetsDb.get(jobId);
        if (assets) {
          assets.push({
            _id: generateId(),
            jobId,
            pageUrl,
            assetUrl,
            assetType,
            statusCode,
            failureReason,
            createdAt: new Date()
          });
        }
        return true;
      } else {
        // Not a 404, so we log it as an error/info but do not save it as a broken link.
        emitLog(jobId, 'error', `[ERROR] ${assetType} ignored (not 404, got ${statusCode || 'failure'}) → ${failureReason}: ${assetUrl}`, assetUrl, statusCode);
        return false;
      }
    }

    // Do not log [OK] for every working link on huge sites, to prevent memory crashes
    return false;
  });
};
