import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Play, Globe, Settings, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';

const API_BASE = '/api';

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState(1);
  const [concurrency, setConcurrency] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  const fetchJobs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/jobs`);
      setJobs(res.data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (e) => {
    e.preventDefault();
    if (!url) return;
    
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/jobs`, {
        url, depth: Number(depth), concurrency: Number(concurrency)
      });
      setUrl('');
      fetchJobs();
    } catch (error) {
      console.error('Error starting job:', error);
      alert('Failed to start crawl job.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-3">
      {/* Configuration Panel */}
      <div className="glass-panel" style={{ gridColumn: 'span 1', height: 'fit-content' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={20} /> New Crawl
        </h2>
        <form onSubmit={handleStart} style={{ marginTop: '1.5rem' }}>
          <div className="input-group">
            <label>Website URL</label>
            <div style={{ position: 'relative' }}>
              <Globe size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' }} />
              <input 
                type="url" 
                className="input-field" 
                style={{ width: '100%', paddingLeft: '2.5rem', boxSizing: 'border-box' }}
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required 
              />
            </div>
          </div>
          <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
            <div className="input-group">
              <label>Depth Limit</label>
              <input type="number" min="0" max="10" className="input-field" value={depth} onChange={(e) => setDepth(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Concurrency</label>
              <input type="number" min="1" max="50" className="input-field" value={concurrency} onChange={(e) => setConcurrency(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn" style={{ width: '100%', marginTop: '1rem' }} disabled={submitting}>
            {submitting ? <Loader className="animate-spin" size={18} /> : <Play size={18} />}
            Start Crawling
          </button>
        </form>
      </div>

      {/* Recent Jobs */}
      <div className="glass-panel" style={{ gridColumn: 'span 2' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={20} /> Recent Jobs
        </h2>
        {loading && jobs.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Loading jobs...</p>
        ) : jobs.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No jobs found. Start a new crawl!</p>
        ) : (
          <div className="grid" style={{ gap: '1rem', marginTop: '1.5rem' }}>
            {jobs.map(job => (
              <Link to={`/jobs/${job._id}`} key={job._id} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>{job.url}</h3>
                    <div style={{ display: 'flex', gap: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                      <span>Pages: {job.pagesCrawled}</span>
                      <span>Assets: {job.assetsChecked}</span>
                      <span>Broken: {job.brokenAssetsCount}</span>
                      <span>Started: {new Date(job.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div>
                    <span className={`badge ${job.status}`}>
                      {job.status === 'completed' && <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }}/>}
                      {job.status === 'failed' && <XCircle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }}/>}
                      {job.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
