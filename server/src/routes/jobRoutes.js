import express from 'express';
import { cleanupSession, generateId } from '../services/store.js';
import { startCrawl } from '../services/crawlerService.js';
import { generateCsvReport, generateExcelReport } from '../services/reportGenerator.js';
import { registerListener, removeListener } from '../services/logBus.js';
import Job from '../models/Job.js';
import Asset from '../models/Asset.js';

const router = express.Router();

// Cleanup a session
router.post('/cleanup', express.text({ type: '*/*' }), async (req, res) => {
  try {
    let sessionId;
    if (typeof req.body === 'string') {
      try {
        sessionId = JSON.parse(req.body).sessionId;
      } catch (e) {
        // Not JSON
      }
    } else {
      sessionId = req.body?.sessionId;
    }

    if (sessionId) {
      await cleanupSession(sessionId);
    }
    res.status(200).send('OK');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all jobs for a session
router.get('/', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const jobs = await Job.find({ sessionId }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create and start a new job
router.post('/', async (req, res) => {
  try {
    const { url, depth = 0, concurrency = 10, timeout = 30000, verifyTags = true, expectedCookieId = '' } = req.body;
    const cleanUrl = url.trim();
    const jobId = generateId();
    const sessionId = req.headers['x-session-id'];
    
    const job = new Job({
      _id: jobId,
      sessionId,
      url: cleanUrl,
      verifyTags: Boolean(verifyTags),
      expectedCookieId: expectedCookieId.trim(),
      depth: Number(depth),
      concurrency: Number(concurrency),
      timeout: Number(timeout),
      status: 'pending',
      pagesCrawled: 0,
      assetsChecked: 0,
      brokenAssetsCount: 0,
      createdAt: new Date()
    });
    await job.save();

    // Start crawl asynchronously
    startCrawl(jobId).catch(err => {
      console.error('Background crawl task failed:', err);
    });

    res.status(201).json(job);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get a specific job
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a specific job and all its assets
router.delete('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Only allow deletion by the session that owns the job
    const sessionId = req.headers['x-session-id'];
    if (job.sessionId && job.sessionId !== sessionId) {
      return res.status(403).json({ error: 'Not authorized to delete this job' });
    }

    await Asset.deleteMany({ jobId: req.params.id });
    await Job.deleteOne({ _id: req.params.id });

    res.status(200).json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get broken assets for a job
router.get('/:id/assets', async (req, res) => {
  try {
    const assets = await Asset.find({ jobId: req.params.id });
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

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) {
      console.log(`Client disconnected from job ${jobId} logs stream`);
    }
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
    const job = await Job.findById(id);
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
      const assets = await Asset.find({ jobId: id });
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
