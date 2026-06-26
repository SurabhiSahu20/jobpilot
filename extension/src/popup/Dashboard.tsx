import React, { useState, useEffect, useMemo } from 'react';
import { getJobs, updateJobStatus, deleteJob, getUserResume, updateUserResume } from '../services/api.js';
import { setCachedJobs } from '../services/indexeddb.js';
import { Job } from '../types/index.js';

interface DashboardProps {
  userEmail: string;
  onLogout: () => void;
  onHasResumeUpdate: (hasResume: boolean) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ userEmail, onLogout, onHasResumeUpdate }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'resume' | 'analytics'>('list');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Resume states
  const [resumeText, setResumeText] = useState('');
  const [savingResume, setSavingResume] = useState(false);
  const [resumeStatus, setResumeStatus] = useState('');

  // Fetch jobs and resume
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Load jobs
      const jobsList = await getJobs();
      setJobs(jobsList);
      await setCachedJobs(jobsList);

      // 2. Load profile resume
      const profile = await getUserResume();
      setResumeText(profile.resume_text || '');
      onHasResumeUpdate(!!profile.resume_text);
    } catch (err: any) {
      setError(err.message || 'Failed to sync dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (jobId: number | undefined, newStatus: string) => {
    if (!jobId) return;
    try {
      const response = await updateJobStatus(jobId, newStatus);
      const updatedJobs = jobs.map(j => (j.id === jobId ? response.job : j));
      setJobs(updatedJobs);
      await setCachedJobs(updatedJobs);
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleDeleteJob = async (jobId: number | undefined) => {
    if (!jobId || !confirm('Are you sure you want to delete this job application?')) return;
    try {
      await deleteJob(jobId);
      const filteredJobs = jobs.filter(j => j.id !== jobId);
      setJobs(filteredJobs);
      await setCachedJobs(filteredJobs);
    } catch (err: any) {
      alert('Error deleting job: ' + err.message);
    }
  };

  const handleSaveResume = async () => {
    if (!resumeText.trim()) {
      setResumeStatus('Resume text cannot be empty.');
      return;
    }
    setSavingResume(true);
    setResumeStatus('');
    try {
      await updateUserResume(resumeText);
      setResumeStatus('Resume updated successfully! ✅');
      onHasResumeUpdate(true);
      setTimeout(() => setResumeStatus(''), 3000);
    } catch (err: any) {
      setResumeStatus('Failed to update resume: ' + err.message);
    } finally {
      setSavingResume(false);
    }
  };

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => 
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [jobs, searchTerm]);

  // Analytics helper calculations
  const analytics = useMemo(() => {
    const total = jobs.length;
    if (total === 0) return { total: 0, interviewRate: 0, offerRate: 0, pending: 0 };

    const interviews = jobs.filter(j => j.status === 'Interview' || j.status === 'Offer').length;
    const offers = jobs.filter(j => j.status === 'Offer').length;
    const pending = jobs.filter(j => ['Wishlist', 'Applied', 'OA'].includes(j.status)).length;

    return {
      total,
      interviewRate: Math.round((interviews / total) * 100),
      offerRate: Math.round((offers / total) * 100),
      pending
    };
  }, [jobs]);

  return (
    <div>
      <div className="header">
        <h1 className="logo">JobPilot <span>PRO</span></h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={userEmail}>
            {userEmail}
          </span>
          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="tab-navigation">
        <div className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
          Tracker
        </div>
        <div className={`tab-btn ${activeTab === 'resume' ? 'active' : ''}`} onClick={() => setActiveTab('resume')}>
          Resume
        </div>
        <div className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
          Analytics
        </div>
      </div>

      {error && <div className="alert alert-warning">⚠️ {error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
          Syncing dashboard details...
        </div>
      ) : (
        <div>
          {/* TAB 1: LIST TRACKER */}
          {activeTab === 'list' && (
            <div>
              <div style={{ marginBottom: '10px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search by role, company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {filteredJobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-secondary)' }}>
                  {searchTerm ? 'No matching job trackers found.' : 'Your tracking board is empty. Visit a job post on LinkedIn, Naukri, or Wellfound to save your first application.'}
                </div>
              ) : (
                <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  {filteredJobs.map(job => (
                    <div className="job-item" key={job.id}>
                      <div>
                        <div className="job-item-title">{job.role}</div>
                        <div className="job-item-company">{job.company} • {job.location || 'Remote'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          className="input-field"
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            width: '95px',
                            backgroundColor: 'rgba(30, 41, 59, 0.9)',
                            border: '1px solid var(--border-glass)'
                          }}
                          value={job.status}
                          onChange={(e) => handleStatusChange(job.id, e.target.value)}
                        >
                          <option value="Wishlist">Wishlist</option>
                          <option value="Applied">Applied</option>
                          <option value="OA">OA</option>
                          <option value="Interview">Interview</option>
                          <option value="Offer">Offer</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                        <button 
                          className="btn-icon" 
                          style={{ color: 'var(--danger)', padding: '2px' }}
                          onClick={() => handleDeleteJob(job.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RESUME UPLOAD */}
          {activeTab === 'resume' && (
            <div className="card">
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>Resume Text (ATS Context)</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Paste the raw text of your resume below. The AI uses this description to calculate match scores and generate cover letters.
              </p>
              
              {resumeStatus && (
                <div className={`alert ${resumeStatus.includes('success') ? 'alert-info' : 'alert-warning'}`} style={{ padding: '6px 8px', marginBottom: '8px' }}>
                  {resumeStatus}
                </div>
              )}

              <textarea
                className="input-field"
                style={{ height: '260px', fontFamily: 'monospace', fontSize: '11px', resize: 'none' }}
                placeholder="PASTE RESUME PLAIN TEXT HERE..."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
              />

              <button 
                className="btn btn-primary btn-full" 
                style={{ marginTop: '12px' }} 
                onClick={handleSaveResume}
                disabled={savingResume}
              >
                {savingResume ? 'Saving Resume...' : 'Save & Sync Resume'}
              </button>
            </div>
          )}

          {/* TAB 3: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-value">{analytics.total}</div>
                  <div className="metric-label">Applications</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{analytics.pending}</div>
                  <div className="metric-label">In Progress</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value" style={{ color: 'var(--warning)' }}>{analytics.interviewRate}%</div>
                  <div className="metric-label">Interview Rate</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value" style={{ color: 'var(--success)' }}>{analytics.offerRate}%</div>
                  <div className="metric-label">Offer Rate</div>
                </div>
              </div>

              <div className="card">
                <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Application Funnel Details</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed rgba(255, 255, 255, 0.05)' }}>
                    <span>Wishlisted:</span>
                    <span>{jobs.filter(j => j.status === 'Wishlist').length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed rgba(255, 255, 255, 0.05)' }}>
                    <span>Applied Remotely:</span>
                    <span>{jobs.filter(j => j.status === 'Applied').length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed rgba(255, 255, 255, 0.05)' }}>
                    <span>Online Assessment (OA):</span>
                    <span>{jobs.filter(j => j.status === 'OA').length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed rgba(255, 255, 255, 0.05)' }}>
                    <span>Interviews:</span>
                    <span>{jobs.filter(j => j.status === 'Interview').length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed rgba(255, 255, 255, 0.05)' }}>
                    <span>Offers Secured:</span>
                    <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{jobs.filter(j => j.status === 'Offer').length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Rejections:</span>
                    <span style={{ color: 'var(--danger)' }}>{jobs.filter(j => j.status === 'Rejected').length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
