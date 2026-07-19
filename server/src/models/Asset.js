import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  jobId: { type: String, required: true, ref: 'Job' },
  pageUrl: { type: String, required: true },
  assetUrl: { type: String, required: true },
  assetType: { type: String, required: true },
  statusCode: { type: Number },
  failureReason: { type: String },
  is404: { type: Boolean, default: false },
  tagIssueType: { type: String },   // 'cookie' | 'utag' — only set for Tag Issue type
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Asset', assetSchema);
