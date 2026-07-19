import Job from '../models/Job.js';
import Asset from '../models/Asset.js';

// Helper to generate IDs
export const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Cleanup all jobs for a specific session
export const cleanupSession = async (sessionId) => {
  try {
    const jobs = await Job.find({ sessionId });
    for (const job of jobs) {
      await Asset.deleteMany({ jobId: job._id });
      await Job.deleteOne({ _id: job._id });
    }
  } catch (error) {
    console.error('Error cleaning up session:', error);
  }
};
