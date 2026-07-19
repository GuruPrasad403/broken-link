import * as cheerio from 'cheerio';

export const extractAssets = (html, baseUrl) => {
  const $ = cheerio.load(html);
  const cssAssets = [];
  const jsAssets = [];
  const imageAssets = [];
  const htmlLinks = [];

  try {
    const parsedBaseUrl = new URL(baseUrl);

    const normalizeUrl = (assetUrl) => {
      if (!assetUrl) return null;
      const lower = assetUrl.toLowerCase();
      if (lower.startsWith('data:') || lower.startsWith('mailto:') || lower.startsWith('tel:') || lower.startsWith('javascript:')) return null;
      try {
        const resolvedUrl = new URL(assetUrl, parsedBaseUrl.href);
        resolvedUrl.hash = '';
        return resolvedUrl.href;
      } catch (err) {
        return null;
      }
    };

    $('link').each((_, el) => {
      const href = $(el).attr('href');
      const normalized = normalizeUrl(href);
      if (normalized) cssAssets.push(normalized);
    });

    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        const normalized = normalizeUrl(src);
        if (normalized) jsAssets.push(normalized);
      }
    });

    $('img[src], source[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        const normalized = normalizeUrl(src);
        if (normalized) imageAssets.push(normalized);
      }
    });

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const normalized = normalizeUrl(href);
      if (normalized) htmlLinks.push(normalized);
    });

  } catch (error) {
    console.error(`Error parsing assets for ${baseUrl}`, error);
  }

  return { cssAssets, jsAssets, imageAssets, htmlLinks };
};

/**
 * Checks for Cookie Report ID and Utag prod scripts on a given page.
 * Returns an array of issue objects, each with { issueType, detail }
 * issueType: 'cookie' | 'utag'
 */
export const verifyPageTags = (html, pageUrl, expectedCookieId) => {
  const $ = cheerio.load(html);
  const issues = [];

  // ── Cookie ID check ──────────────────────────────────────────────────────
  if (expectedCookieId && expectedCookieId.trim()) {
    const cookieIdNeedle = expectedCookieId.trim().toLowerCase();
    let cookieFound = false;

    // Check all <link> href, <script> src, and <a> href for the cookie policy URL
    $('[href], [src]').each((_, el) => {
      const val = ($(el).attr('href') || $(el).attr('src') || '').toLowerCase();
      if (val.includes(cookieIdNeedle)) cookieFound = true;
    });

    // Also check plain text / inline script content for the cookie ID string
    if (!cookieFound) {
      const htmlLower = html.toLowerCase();
      if (htmlLower.includes(cookieIdNeedle)) cookieFound = true;
    }

    if (!cookieFound) {
      issues.push({
        issueType: 'cookie',
        detail: `Cookie ID "${expectedCookieId}" not found on page`
      });
    }
  }

  // ── Utag check ───────────────────────────────────────────────────────────
  // We look for any script src or inline script content referencing tags.tiqcdn.com/utag/
  const TIQCDN_HOST = 'tags.tiqcdn.com/utag/';

  let utagSrcFound = null;   // The utag src found (for utag.js or utag.sync.js)
  let utagEnvFound = null;   // 'prod', 'qa', 'dev', 'staging' etc.

  // Check script[src] for utag scripts
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src.toLowerCase().includes(TIQCDN_HOST.toLowerCase())) {
      utagSrcFound = src;
      // Extract env segment: tiqcdn.com/utag/{account}/{profile}/{env}/utag*.js
      const match = src.match(/\/utag\/[^/]+\/[^/]+\/([^/]+)\//i);
      if (match) utagEnvFound = match[1].toLowerCase();
    }
  });

  // Also scan inline <script> text content for the dynamic utag.js loader pattern
  if (!utagSrcFound) {
    $('script:not([src])').each((_, el) => {
      const content = $(el).text() || '';
      if (content.toLowerCase().includes(TIQCDN_HOST.toLowerCase())) {
        utagSrcFound = 'inline';
        // Try to extract env from inline code
        const match = content.match(/\/utag\/[^/'"]+\/[^/'"]+\/([^/'"]+)\//i);
        if (match) utagEnvFound = match[1].toLowerCase();
      }
    });
  }

  if (!utagSrcFound) {
    issues.push({
      issueType: 'utag',
      detail: 'Utag script (tags.tiqcdn.com/utag/) not found on page'
    });
  } else if (utagEnvFound && utagEnvFound !== 'prod') {
    issues.push({
      issueType: 'utag',
      detail: `Utag environment is "${utagEnvFound}" — expected "prod"${utagSrcFound !== 'inline' ? ` (src: ${utagSrcFound})` : ' (inline script)'}`
    });
  }
  // If utagEnvFound is prod → no issue

  return issues;
};
