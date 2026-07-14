import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jobRoutes from './routes/jobRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/jobs', jobRoutes);

// Serve static client build
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// SPA fallback – serve index.html for any non‑API route
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

export default app;
