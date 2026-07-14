// In-memory data store to replace MongoDB

// Map of jobId -> Job object
export const jobsDb = new Map();

// Map of jobId -> Array of BrokenAsset objects
export const assetsDb = new Map();

// Helper to generate IDs
export const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
