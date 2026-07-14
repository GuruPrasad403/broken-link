import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import JobDetails from './pages/JobDetails';
import { Activity } from 'lucide-react';

function App() {
  return (
    <Router>
      <div className="app-container">
        <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <Activity size={32} color="var(--primary)" />
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 style={{ margin: 0, background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Asset Validator
            </h1>
          </Link>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs/:id" element={<JobDetails />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
