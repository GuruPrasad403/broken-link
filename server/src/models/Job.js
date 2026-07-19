import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sessionId: { type: String },
  url: { type: String, required: true },
  verifyTags: { type: Boolean, default: true },
  expectedCookieId: { type: String },
  depth: { type: Number, default: 0 },
  concurrency: { type: Number, default: 10 },
  timeout: { type: Number, default: 30000 },
  status: { type: String, default: 'pending', enum: ['pending', 'running', 'completed', 'failed'] },
  pagesCrawled: { type: Number, default: 0 },
  assetsChecked: { type: Number, default: 0 },
  brokenAssetsCount: { type: Number, default: 0 },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
  startedAt: { type: Date },
  completedAt: { type: Date }
});

export default mongoose.model('Job', jobSchema);
