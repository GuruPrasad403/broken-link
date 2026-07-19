import { CheerioCrawler, Configuration } from 'crawlee';
import { extractAssets, verifyPageTags } from './parserService.js';
import { checkAsset } from './checkerService.js';
import { emitLog, clearJobLogs } from './logBus.js';
import Job from '../models/Job.js';
import Asset from '../models/Asset.js';

export const startCrawl = async (jobId) => {
  const job = await Job.findById(jobId);
  if (!job) return;

  job.status = 'running';
  job.startedAt = new Date();
  job.pagesCrawled = 0;
  job.assetsChecked = 0;
  job.brokenAssetsCount = 0;
  await job.save();

  // Clear any stale broken-asset records from a previous run of this job
  await Asset.deleteMany({ jobId });

  clearJobLogs(jobId); // Clear old logs for this job

  const cache = new Set();
  let pagesCrawled = 0;
  let assetsChecked = 0;
  let brokenAssetsCount = 0;

  const flushStats = async () => {
    try {
      await Job.updateOne({ _id: jobId }, {
        $set: {
          pagesCrawled,
          assetsChecked,
          brokenAssetsCount
        }
      });
    } catch (err) {
      console.error('Error flushing stats:', err);
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
      sessionPoolOptions: {
        maxPoolSize: 10,
      },
      preNavigationHooks: [
        ({ request }) => {
          request.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': job.url,
          };
        }
      ],
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

        // ── Tag Verification (runs independently of crawl asset checks) ───────
        if (job.verifyTags) {
          const tagIssues = verifyPageTags($.html(), pageUrl, job.expectedCookieId);
          for (const issue of tagIssues) {
            const { generateId } = await import('./store.js');
            const tagAsset = new Asset({
              _id: generateId(),
              jobId,
              pageUrl,
              assetUrl: pageUrl,
              assetType: 'Tag Issue',
              statusCode: null,
              failureReason: issue.detail,
              is404: false,
              tagIssueType: issue.issueType,
              createdAt: new Date()
            });
            try { await tagAsset.save(); } catch (e) { console.error('Tag issue save error:', e); }
            emitLog(jobId, 'error', `[TAG] ${issue.issueType.toUpperCase()} — ${pageUrl} — ${issue.detail}`, pageUrl);
          }
        }

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
        // User requested not to record general page failures as broken assets
        
        await flushStats();
      },
    }, config);

    await crawler.run([job.url]);

    emitLog(jobId, 'info', `[DONE] Crawl completed. Pages: ${pagesCrawled}, Checked: ${assetsChecked}, Broken: ${brokenAssetsCount}`);
    await Job.updateOne({ _id: jobId }, {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        pagesCrawled,
        assetsChecked,
        brokenAssetsCount
      }
    });
  } catch (error) {
    console.error('Crawler failed:', error);
    emitLog(jobId, 'error', `[ERROR] Crawler crashed: ${error.message}`);
    await Job.updateOne({ _id: jobId }, {
      $set: {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
        pagesCrawled,
        assetsChecked,
        brokenAssetsCount
      }
    });
  }
};
