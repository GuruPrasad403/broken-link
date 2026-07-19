import got from 'got';
import pLimit from 'p-limit';
import { generateId } from './store.js';
import { emitLog } from './logBus.js';
import Asset from '../models/Asset.js';

const limit = pLimit(20); // Max concurrent checks

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
      let headResponse = await got.head(assetUrl, gotOptions);
      statusCode = headResponse.statusCode;

      if (statusCode >= 400) {
        const getResp = await got.get(assetUrl, gotOptions);
        statusCode = getResp.statusCode;
      }

      if (statusCode >= 400) {
        if (assetType === 'CSS' || assetType === 'JavaScript') {
          const getResp = await got.get(assetUrl, gotOptions);
          const contentType = getResp.headers['content-type'] || '';
          const body = (getResp.body || '').toString().trim();
          const isHtml = contentType.includes('text/html') || body.startsWith('<html') || body.startsWith('<!DOCTYPE');
          const isTinyError = body.length < 200 && /not found|404|forbidden|403|error/i.test(body);

          if (body.length > 0 && !isHtml && !isTinyError) {
            return false;
          }
        }

        isBroken = true;
        failureReason = `HTTP ${statusCode}`;
      }

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
      const is404 = statusCode === 404;
      if (is404) {
        emitLog(jobId, 'broken', `[BROKEN] ${assetType} → ${failureReason}: ${assetUrl}`, assetUrl, statusCode);
      } else {
        emitLog(jobId, 'error', `[ERROR] ${assetType} error (${statusCode || 'failure'}) → ${failureReason}: ${assetUrl}`, assetUrl, statusCode);
      }
      
      try {
        const asset = new Asset({
          _id: generateId(),
          jobId,
          pageUrl,
          assetUrl,
          assetType,
          statusCode,
          failureReason,
          is404,
          createdAt: new Date()
        });
        await asset.save();
      } catch (err) {
        console.error('Error saving asset:', err);
      }
      
      return true; // Consider it broken (or errored) so it increments the count
    }

    return false;
  });
};
