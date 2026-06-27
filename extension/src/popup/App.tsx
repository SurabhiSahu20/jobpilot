import React, { useState, useEffect } from 'react';
import { Login } from './Login.js';
import { Dashboard } from './Dashboard.js';
import { JobPanel } from './JobPanel.js';
import { getAuthToken, getAuthUser, getDetectedJob, clearLocalStorageCache } from '../services/indexeddb.js';
import { User, Job } from '../types/index.js';
import './popup.css';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [hasResume, setHasResume] = useState(false);
  const [detectedJob, setDetectedJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation flag to let user view dashboard even if on a job page
  const [forceDashboard, setForceDashboard] = useState(false);

  useEffect(() => {
    // 1. Initial State Load
    const bootstrapState = async () => {
      setLoading(true);
      try {
        const storedToken = await getAuthToken();
        const storedUser = await getAuthUser();
        const activeJob = await getDetectedJob();

        setToken(storedToken);
        setUser(storedUser);
        setDetectedJob(activeJob);
        
        // If there's an active job, show JobPanel first, otherwise Dashboard
        setForceDashboard(!activeJob);
      } catch (err) {
        console.error('Error bootstrapping extension state:', err);
      } finally {
        setLoading(false);
      }
    };

    bootstrapState();

    // 2. Real-time Storage Sync (listen for active tab changes from content script)
    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName === 'local' && changes.detected_job) {
        const newJob = changes.detected_job.newValue as Job | null;
        setDetectedJob(newJob);
        if (newJob) {
          // Auto route to panel when new job is detected
          setForceDashboard(false);
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }
  }, []);

  const handleAuthSuccess = (newToken: string, newUser: User, hasResumeUploaded: boolean) => {
    setToken(newToken);
    setUser(newUser);
    setHasResume(hasResumeUploaded);
    setForceDashboard(!detectedJob);
  };

  const forceLogout = async () => {
    await clearLocalStorageCache();
    setToken(null);
    setUser(null);
    setHasResume(false);
    setDetectedJob(null);
    setForceDashboard(false);
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      await forceLogout();
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px' }}>
        <div style={{ fontSize: '20px', fontWeight: '800', background: 'var(--primary-glow)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          JobPilot
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Loading your application board...
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* If not logged in, force Login screen */}
      {!token ? (
        <div>
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <h1 className="logo" style={{ display: 'inline-flex', fontSize: '28px' }}>JobPilot</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
              Your Intelligent Career Copilot
            </p>
          </div>
          <Login onAuthSuccess={handleAuthSuccess} />
        </div>
      ) : (
        /* If logged in, route depending on job detection and user choice */
        <div>
          {detectedJob && !forceDashboard ? (
            <JobPanel 
              detectedJob={detectedJob} 
              hasResume={hasResume}
              onViewDashboard={() => setForceDashboard(true)} 
            />
          ) : (
            <div>
              {/* If we are forcing dashboard but there is an active job, show quick nav helper */}
              {detectedJob && (
                <div 
                  className="alert alert-info" 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', fontSize: '11px', marginBottom: '10px', cursor: 'pointer' }}
                  onClick={() => setForceDashboard(false)}
                >
                  <span>✨ Job detected on this tab: <b>{detectedJob.role}</b></span>
                  <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>View Panel →</span>
                </div>
              )}
              <Dashboard 
                userEmail={user?.email || ''}
                onLogout={handleLogout} 
                onSessionExpired={forceLogout}
                onHasResumeUpdate={(val) => setHasResume(val)} 
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default App;
