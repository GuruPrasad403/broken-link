import { useState, useEffect } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import { Play, Globe, Settings, Clock, CheckCircle, XCircle, Loader, Trash2 } from 'lucide-react';

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState(1);
  const [concurrency, setConcurrency] = useState(10);
  const [verifyTags, setVerifyTags] = useState(true);
  const [expectedCookieId, setExpectedCookieId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Initialize deleteOnClose from localStorage, default false
  const [deleteOnClose, setDeleteOnClose] = useState(() => {
    return localStorage.getItem('deleteOnClose') === 'true';
  });

  const handleDeleteOnCloseChange = (e) => {
    const checked = e.target.checked;
    setDeleteOnClose(checked);
    localStorage.setItem('deleteOnClose', checked);
  };

  const fetchJobs = async () => {
    try {
      const res = await api.get('/jobs');
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
      await api.post('/jobs', {
        url, depth: Number(depth), concurrency: Number(concurrency), verifyTags, expectedCookieId
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

  const handleDeleteJob = async (e, jobId) => {
    e.preventDefault();  // don't navigate to job detail
    e.stopPropagation();
    if (!window.confirm('Delete this job and all its data from the database?')) return;
    try {
      await api.delete(`/jobs/${jobId}`);
      setJobs(prev => prev.filter(j => j._id !== jobId));
    } catch (error) {
      console.error('Error deleting job:', error);
      alert('Failed to delete job.');
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

          <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input 
                type="checkbox" 
                checked={verifyTags} 
                onChange={(e) => setVerifyTags(e.target.checked)}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              Verify Cookie ID & Utag (prod)
            </label>
            
            {verifyTags && (
              <div className="input-group" style={{ marginTop: '0.75rem', marginBottom: '0' }}>
                <label>Expected Cookie ID (e.g. 8ad4101c-en-gb.html)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Leave empty to just check Utag"
                  value={expectedCookieId}
                  onChange={(e) => setExpectedCookieId(e.target.value)}
                />
              </div>
            )}
          </div>
          
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input 
                type="checkbox" 
                checked={deleteOnClose} 
                onChange={handleDeleteOnCloseChange}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              Delete crawl data when I close this tab
            </label>
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.url}</h3>
                    <div style={{ display: 'flex', gap: '1rem', color: '#94a3b8', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                      <span>Pages: {job.pagesCrawled}</span>
                      <span>Assets: {job.assetsChecked}</span>
                      <span>Broken: {job.brokenAssetsCount}</span>
                      <span>Started: {new Date(job.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, marginLeft: '1rem' }}>
                    <span className={`badge ${job.status}`}>
                      {job.status === 'completed' && <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }}/>}
                      {job.status === 'failed' && <XCircle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }}/>}
                      {job.status}
                    </span>
                    <button
                      onClick={(e) => handleDeleteJob(e, job._id)}
                      title="Delete job"
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '6px',
                        padding: '0.35rem 0.5rem',
                        cursor: 'pointer',
                        color: '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                    >
                      <Trash2 size={15} />
                    </button>
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
