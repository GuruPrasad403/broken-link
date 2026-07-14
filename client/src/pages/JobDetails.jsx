import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Download, FileSpreadsheet, FileJson, AlertTriangle, Link2, Code2, FileCode2, Terminal, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

const API_BASE = '/api';

const BRAND = { blue: '#0A74DA', pink: '#E91E63', cyan: '#00BCD4' };
const TYPE_STYLES = {
  CSS:          { bg: 'rgba(10, 116, 218, 0.2)', color: BRAND.blue, icon: <FileCode2 size={12} /> },
  JavaScript:   { bg: 'rgba(233, 30, 99, 0.2)', color: BRAND.pink, icon: <Code2 size={12} /> },
  Image:        { bg: 'rgba(0, 188, 212, 0.2)', color: BRAND.cyan, icon: <Link2 size={12} /> },
  'Page/Link':  { bg: 'rgba(10, 116, 218, 0.2)', color: BRAND.blue, icon: <Link2 size={12} /> },
};

// Console log entry color by type
const LOG_COLORS = {
  page:    { color: BRAND.blue, prefix: '🌐' },
  css:     { color: BRAND.blue, prefix: '🎨' },
  js:      { color: BRAND.pink, prefix: '⚡' },
  link:    { color: BRAND.cyan, prefix: '🔗' },
  ok:      { color: '#34d399', prefix: '✅' },
  broken:  { color: '#f87171', prefix: '❌' },
  skip:    { color: '#64748b', prefix: '⏭' },
  info:    { color: '#94a3b8', prefix: 'ℹ' },
  error:   { color: '#fb923c', prefix: '🔥' },
};

function ConsolePanel({ jobId, isRunning }) {
  const [logs, setLogs] = useState([]);
  const [open, setOpen] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('all');
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/jobs/${jobId}/logs`);
    es.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data);
        setLogs(prev => [...prev.slice(-999), entry]); // Keep last 1000
      } catch (_) {}
    };
    es.onerror = () => { /* connection closed or server restarted */ };
    return () => es.close();
  }, [jobId]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60);
  };

  const filtered = filter === 'all' ? logs : logs.filter(l => l.type === filter);

  return (
    <div className="glass-panel" style={{ marginTop: '1.5rem', padding: 0, overflow: 'hidden' }}>
      {/* Console Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.9rem 1.25rem', cursor: 'pointer',
          borderBottom: open ? '1px solid var(--glass-border)' : 'none',
          background: 'rgba(0,0,0,0.2)',
          userSelect: 'none'
        }}
      >
        <Terminal size={18} color="#38bdf8" />
        <span style={{ fontWeight: 600, color: '#e2e8f0', flex: 1 }}>
          Live Console
          {isRunning && (
            <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#38bdf8', animation: 'pulse 1s infinite' }} />
              Live
            </span>
          )}
        </span>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{logs.length} entries</span>
        <button
          onClick={(e) => { e.stopPropagation(); setLogs([]); }}
          title="Clear console"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px', display: 'flex', alignItems: 'center' }}
        >
          <Trash2 size={14} />
        </button>
        {open ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
      </div>

      {open && (
        <>
          {/* Filter bar */}
          <div style={{
            display: 'flex', gap: '0.5rem', padding: '0.6rem 1rem',
            background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid var(--glass-border)',
            flexWrap: 'wrap', alignItems: 'center'
          }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>Filter:</span>
            {[
              { key: 'all',    label: 'All',      color: '#94a3b8' },
              { key: 'page',   label: '🌐 Pages',  color: '#38bdf8' },
              { key: 'css',    label: '🎨 CSS',    color: '#a78bfa' },
              { key: 'js',     label: '⚡ JS',     color: '#fbbf24' },
              { key: 'image',  label: '🖼️ Image',  color: '#f472b6' },
              { key: 'link',   label: '🔗 Links',  color: '#60a5fa' },
              { key: 'broken', label: '❌ Broken', color: '#f87171' },
              { key: 'ok',     label: '✅ OK',     color: '#34d399' },
              { key: 'skip',   label: '⏭ Skip',   color: '#64748b' },
              { key: 'error',  label: '🔥 Error',  color: '#fb923c' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '0.2rem 0.65rem', borderRadius: '999px',
                  border: `1px solid ${filter === f.key ? f.color : 'rgba(255,255,255,0.08)'}`,
                  background: filter === f.key ? `${f.color}22` : 'transparent',
                  color: filter === f.key ? f.color : '#64748b',
                  cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'monospace',
                  fontWeight: filter === f.key ? 700 : 400,
                  transition: 'all 0.15s'
                }}
              >
                {f.label}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.72rem', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                Auto-scroll
              </label>
            </div>
          </div>

          {/* Log body */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            style={{
              height: '320px', overflowY: 'auto', overflowX: 'hidden',
              fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
              fontSize: '0.72rem', lineHeight: '1.7',
              background: 'rgba(0,0,0,0.35)',
              padding: '0.75rem 1rem',
            }}
          >
            {filtered.length === 0 ? (
              <span style={{ color: '#475569' }}>
                {logs.length === 0 ? 'Waiting for crawl to start...' : 'No entries match this filter.'}
              </span>
            ) : (
              filtered.map((entry, i) => {
                const style = LOG_COLORS[entry.type] || LOG_COLORS.info;
                const time = new Date(entry.t).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return (
                  <div key={i} style={{ display: 'flex', gap: '0.6rem', padding: '1px 0', wordBreak: 'break-all' }}>
                    <span style={{ color: '#334155', flexShrink: 0, minWidth: '7ch' }}>{time}</span>
                    <span style={{ flexShrink: 0 }}>{style.prefix}</span>
                    <span style={{ color: style.color }}>{entry.message}</span>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </>
      )}
    </div>
  );
}

export default function JobDetails() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const jobStatusRef = useRef(null);

  const fetchJobData = async () => {
    try {
      const [jobRes, assetsRes] = await Promise.all([
        axios.get(`${API_BASE}/jobs/${id}`),
        axios.get(`${API_BASE}/jobs/${id}/assets`)
      ]);
      const fetchedJob = jobRes.data;
      setJob(fetchedJob);
      jobStatusRef.current = fetchedJob.status;
      setAssets(assetsRes.data);
    } catch (error) {
      console.error('Error fetching job details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobData();
    const interval = setInterval(() => {
      // Always poll — ref is always up to date
      if (jobStatusRef.current === 'pending' || jobStatusRef.current === 'running') {
        fetchJobData();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [id]);

  const filteredAssets = filter === 'All' ? assets : assets.filter(a => a.assetType === filter);
  const counts = {
    All: assets.length,
    CSS: assets.filter(a => a.assetType === 'CSS').length,
    JavaScript: assets.filter(a => a.assetType === 'JavaScript').length,
    Image: assets.filter(a => a.assetType === 'Image').length,
    'Page/Link': assets.filter(a => a.assetType === 'Page/Link').length,
  };

  if (loading && !job) return <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading job details...</div>;
  if (!job) return <div style={{ textAlign: 'center', padding: '3rem', color: '#ef4444' }}>Job not found</div>;

  const isRunning = job.status === 'running' || job.status === 'pending';

  return (
    <div>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', textDecoration: 'none', marginBottom: '1.5rem', fontWeight: 500 }}>
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      {/* Job Summary */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.75rem 0', wordBreak: 'break-all' }}>Crawl Results: {job.url}</h2>
            <div style={{ display: 'flex', gap: '1.5rem', color: '#cbd5e1', flexWrap: 'wrap' }}>
              <span>Status: <span className={`badge ${job.status}`}>{job.status}</span></span>
              <span>Pages Crawled: <strong>{job.pagesCrawled}</strong></span>
              <span>Assets Checked: <strong>{job.assetsChecked}</strong></span>
              <span>Broken: <strong style={{ color: 'var(--danger)' }}>{job.brokenAssetsCount}</strong></span>
            </div>
            {isRunning && (
              <div style={{ marginTop: '0.75rem', color: '#38bdf8', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', animation: 'pulse 1.5s infinite' }} />
                Crawling in progress — results update every 3 seconds
              </div>
            )}
            {job.errorMessage && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', borderRadius: '4px', color: '#f87171' }}>
                <AlertTriangle size={18} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
                {job.errorMessage}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <a href={`${API_BASE}/jobs/${id}/download/csv`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="btn" style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--glass-border)' }}>
                <Download size={16} /> CSV
              </button>
            </a>
            <a href={`${API_BASE}/jobs/${id}/download/xlsx`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="btn" style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
                <FileSpreadsheet size={16} /> Excel
              </button>
            </a>
            <a href={`${API_BASE}/jobs/${id}/download/json`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="btn" style={{ background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24' }}>
                <FileJson size={16} /> JSON
              </button>
            </a>
          </div>
        </div>
      </div>

      {/* Live Console */}
      <ConsolePanel jobId={id} isRunning={isRunning} />

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', margin: '1.5rem 0 1rem', flexWrap: 'wrap' }}>
        {['All', 'CSS', 'JavaScript', 'Image', 'Page/Link'].map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            style={{
              padding: '0.4rem 1rem', borderRadius: '999px', border: '1px solid',
              cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem', transition: 'all 0.2s',
              borderColor: filter === type ? 'var(--primary)' : 'var(--glass-border)',
              background: filter === type ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              color: filter === type ? '#818cf8' : '#94a3b8',
            }}
          >
            {type} <span style={{ opacity: 0.7 }}>({counts[type]})</span>
          </button>
        ))}
      </div>

      {/* Broken Assets Table */}
      <div className="glass-panel">
        <h3 style={{ marginTop: 0 }}>Broken Assets — {filter} ({filteredAssets.length})</h3>
        {filteredAssets.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>
            {assets.length === 0
              ? (isRunning ? 'Crawling... broken assets will appear here.' : 'No broken assets found — great news!')
              : `No broken assets of type "${filter}".`
            }
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Page URL</th>
                  <th style={{ minWidth: 200 }}>Broken Asset / Link URL</th>
                  <th>Type</th>
                  <th>Failure Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map(asset => {
                  const typeStyle = TYPE_STYLES[asset.assetType] || TYPE_STYLES['CSS'];
                  return (
                    <tr key={asset._id}>
                      <td style={{ maxWidth: '300px', wordBreak: 'break-all', fontSize: '0.8rem' }}>
                        <a href={asset.pageUrl} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>{asset.pageUrl}</a>
                      </td>
                      <td style={{ maxWidth: '300px', wordBreak: 'break-all', fontSize: '0.8rem' }}>
                        <a href={asset.assetUrl} target="_blank" rel="noreferrer" style={{ color: '#f472b6' }}>{asset.assetUrl}</a>
                      </td>
                      <td>
                        <span className="badge" style={{ background: typeStyle.bg, color: typeStyle.color, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {typeStyle.icon} {asset.assetType}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--danger)', fontWeight: 500, fontSize: '0.85rem' }}>
                          {asset.failureReason || (asset.statusCode ? `HTTP ${asset.statusCode}` : 'Unknown')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
