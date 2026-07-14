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
