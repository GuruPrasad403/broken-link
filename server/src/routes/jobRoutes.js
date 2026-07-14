import express from 'express';
import { jobsDb, assetsDb, generateId } from '../services/store.js';
import { startCrawl } from '../services/crawlerService.js';
import { generateCsvReport, generateExcelReport } from '../services/reportGenerator.js';
import { registerListener, removeListener } from '../services/logBus.js';

const router = express.Router();

// Get all jobs
router.get('/', (req, res) => {
  try {
    const jobs = Array.from(jobsDb.values()).sort((a, b) => b.createdAt - a.createdAt);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create and start a new job
router.post('/', (req, res) => {
  try {
    const { url, depth = 0, concurrency = 10, timeout = 30000 } = req.body;
    // `depth` – maximum crawl depth (0 = unlimited, otherwise limits pages ≈ depth × 100)
    // `concurrency` – how many requests run in parallel (default 10).
    const cleanUrl = url.trim();
    const jobId = generateId();
    const job = {
      _id: jobId,
      url: cleanUrl,
      depth: Number(depth),
      concurrency: Number(concurrency),
      timeout: Number(timeout),
      status: 'pending',
      pagesCrawled: 0,
      assetsChecked: 0,
      brokenAssetsCount: 0,
      createdAt: new Date()
    };
    jobsDb.set(jobId, job);
    assetsDb.set(jobId, []);

    // Start crawl asynchronously
    startCrawl(jobId);

    res.status(201).json(job);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get a specific job
router.get('/:id', (req, res) => {
  try {
    const job = jobsDb.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get broken assets for a job
router.get('/:id/assets', (req, res) => {
  try {
    const assets = assetsDb.get(req.params.id) || [];
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SSE stream: real-time crawl logs
router.get('/:id/logs', (req, res) => {
  const jobId = req.params.id;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send a heartbeat comment every 15s to keep the connection alive
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) {}
  }, 15000);

  registerListener(jobId, res);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeListener(jobId, res);
  });
});

// Download reports
router.get('/:id/download/:format', async (req, res) => {
  try {
    const { id, format } = req.params;
    const job = jobsDb.get(id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const filename = `broken-assets-${id}`;

    if (format === 'csv') {
      const csvData = await generateCsvReport(id);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csvData);
    } else if (format === 'xlsx') {
      const excelData = await generateExcelReport(id);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(excelData);
    } else if (format === 'json') {
      const assets = assetsDb.get(id) || [];
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      return res.json(assets);
    }

    res.status(400).json({ error: 'Invalid format' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
