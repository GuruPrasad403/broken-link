import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jobRoutes from '../server/src/routes/jobRoutes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/jobs', jobRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
