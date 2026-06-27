import React, { useState, useEffect, useMemo } from 'react';
import { getJobs, updateJobStatus, deleteJob, getUserResume, updateUserResume, createJob, fetchResumeMatch, uploadResumeFile } from '../services/api.js';
import { setCachedJobs } from '../services/indexeddb.js';
import { Job } from '../types/index.js';

interface DashboardProps {
  userEmail: string;
  onLogout: () => void;
  onSessionExpired: () => void;
  onHasResumeUpdate: (hasResume: boolean) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ userEmail, onLogout, onSessionExpired, onHasResumeUpdate }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'resume' | 'analytics' | 'search'>('list');

  // Search Engine states
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchingJobs, setSearchingJobs] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [addingJobId, setAddingJobId] = useState<string | null>(null);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Resume states
  const [resumeText, setResumeText] = useState('');
  const [savingResume, setSavingResume] = useState(false);
  const [resumeStatus, setResumeStatus] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setResumeStatus('');
    try {
      const response = await uploadResumeFile(file);
      setResumeText(response.resume_text);
      setResumeStatus('Resume uploaded & parsed successfully! ✅');
      onHasResumeUpdate(true);
      setTimeout(() => setResumeStatus(''), 4000);
    } catch (err: any) {
      setResumeStatus('Failed to upload & parse resume: ' + err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  // Bulk Scraper states
  const [searchPageInfo, setSearchPageInfo] = useState<{ type: 'search' | 'single' | 'none'; count: number } | null>(null);
  const [bulkScraping, setBulkScraping] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ index: number; total: number; role: string; company: string } | null>(null);

  // Fetch jobs, resume, and check active tab page type
  useEffect(() => {
    loadData();
    checkActiveTabPageType();

    // Listen for background auto-scrape refresh triggers
    const refreshListener = (message: any) => {
      if (message.action === 'REFRESH_DASHBOARD') {
        loadData();
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(refreshListener);
      return () => chrome.runtime.onMessage.removeListener(refreshListener);
    }
  }, []);

  const checkActiveTabPageType = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
          chrome.tabs.sendMessage(activeTab.id, { action: 'CHECK_PAGE_TYPE' }, (res) => {
            if (chrome.runtime.lastError) {
              console.log('Error checking page type:', chrome.runtime.lastError);
              return;
            }
            if (res && res.type === 'search') {
              setSearchPageInfo(res);
            }
          });
        }
      });
    }
  };

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
      const errMsg = String(err.message || '');
      if (
        errMsg.includes('token') || 
        errMsg.includes('expired') || 
        errMsg.includes('Unauthorized') || 
        errMsg.includes('401') || 
        errMsg.includes('403')
      ) {
        console.warn('Unauthorized session. Resetting login credentials...', errMsg);
        setTimeout(() => {
          onSessionExpired();
        }, 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBulkScrape = () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        setBulkScraping(true);
        setBulkProgress(null);

        // Listen for progress updates
        const progressListener = (message: any) => {
          if (message.action === 'BULK_SCRAPE_PROGRESS' && message.progress) {
            setBulkProgress(message.progress);
          }
        };
        chrome.runtime.onMessage.addListener(progressListener);

        chrome.tabs.sendMessage(activeTab.id, { action: 'BULK_SCRAPE' }, async (res) => {
          chrome.runtime.onMessage.removeListener(progressListener);
          setBulkScraping(false);
          setBulkProgress(null);

          if (chrome.runtime.lastError) {
            alert('Error scraping search results: ' + chrome.runtime.lastError.message);
            return;
          }

          if (res && res.success && res.jobs) {
            const scrapedJobs = res.jobs;
            if (scrapedJobs.length === 0) {
              alert('No jobs could be scraped from this page.');
              return;
            }

            setBulkScraping(true); // Show progress during DB saves and AI matching
            let successCount = 0;

            for (let i = 0; i < scrapedJobs.length; i++) {
              const job = scrapedJobs[i];
              setBulkProgress({ 
                index: i + 1, 
                total: scrapedJobs.length, 
                role: job.role, 
                company: job.company 
              });

              try {
                // Save the job to the database
                const saveRes = await createJob(job);
                const savedJob = saveRes.job;

                // Trigger AI matching
                try {
                  const matchRes = await fetchResumeMatch(job.role, job.company, job.description);
                  // Update the job with notes containing match score and details
                  const notes = `[Match: ${matchRes.matchPercent}%] ${matchRes.summary}`;
                  await updateJobStatus(savedJob.id!, savedJob.status, notes);
                } catch (e) {
                  console.error('Failed to run AI match for job:', savedJob.id, e);
                }

                successCount++;
              } catch (err) {
                console.error('Failed to save bulk scraped job:', job, err);
              }
            }

            setBulkScraping(false);
            setBulkProgress(null);
            alert(`Successfully scraped and matched ${successCount} jobs!`);
            loadData(); // reload tracker list to show new jobs
          } else {
            alert('Failed to scrape search results: ' + (res?.error || 'Unknown error'));
          }
        });
      }
    });
  };

  const getMatchScoreFromNotes = (notes?: string): number | null => {
    if (!notes) return null;
    const match = notes.match(/\[Match:\s*(\d+)%\]/);
    return match ? parseInt(match[1], 10) : null;
  };

  const handleBackgroundJobSearch = () => {
    if (!searchKeyword.trim()) return;
    setSearchingJobs(true);
    setSearchResults([]);
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage(
        { action: 'SEARCH_AND_MATCH_JOBS', keyword: searchKeyword },
        (res) => {
          setSearchingJobs(false);
          if (chrome.runtime.lastError) {
            alert('Search failed: ' + chrome.runtime.lastError.message);
            return;
          }
          if (res && res.success) {
            setSearchResults(res.jobs || []);
          } else {
            alert('Search failed: ' + (res?.error || 'Unknown error'));
          }
        }
      );
    }
  };

  const handleAddSearchResultToTracker = async (job: any) => {
    setAddingJobId(job.jobId);
    try {
      const skillsArray = job.skills || ['Software Development'];
      const saveRes = await createJob({
        company: job.company,
        role: job.role,
        location: job.location || 'Remote',
        salary: job.salary || 'Not Specified',
        experience: job.experience || 'Not Specified',
        skills: skillsArray,
        description: job.description || '',
        apply_link: job.apply_link,
        status: 'Wishlist',
        notes: ''
      });
      const savedJob = saveRes.job;
      
      const notes = `[Match: ${job.matchPercent}%] ${job.summary}`;
      await updateJobStatus(savedJob.id!, savedJob.status, notes);
      
      alert(`Successfully added ${job.role} at ${job.company} to your tracker!`);
      loadData();
    } catch (err: any) {
      alert('Failed to add job to tracker: ' + err.message);
    } finally {
      setAddingJobId(null);
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

      <div className="tab-navigation" style={{ gap: '4px' }}>
        <div className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} style={{ padding: '6px 4px', fontSize: '11px', flex: 1, textAlign: 'center' }} onClick={() => setActiveTab('list')}>
          Tracker
        </div>
        <div className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`} style={{ padding: '6px 4px', fontSize: '11px', flex: 1, textAlign: 'center' }} onClick={() => setActiveTab('search')}>
          Search
        </div>
        <div className={`tab-btn ${activeTab === 'resume' ? 'active' : ''}`} style={{ padding: '6px 4px', fontSize: '11px', flex: 1, textAlign: 'center' }} onClick={() => setActiveTab('resume')}>
          Resume
        </div>
        <div className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} style={{ padding: '6px 4px', fontSize: '11px', flex: 1, textAlign: 'center' }} onClick={() => setActiveTab('analytics')}>
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
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>

              {searchPageInfo && searchPageInfo.type === 'search' && (
                <div 
                  className="card" 
                  style={{ 
                    padding: '12px', 
                    marginBottom: '12px', 
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🔍 Search page list detected ({searchPageInfo.count} jobs found)
                  </div>
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '6px 12px', fontSize: '11px' }}
                    onClick={handleBulkScrape}
                    disabled={bulkScraping}
                  >
                    🚀 Auto-Scrape & Match All Jobs
                  </button>
                </div>
              )}

              {bulkScraping && (
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    backgroundColor: 'rgba(10, 15, 29, 0.95)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    zIndex: 999, 
                    padding: '24px',
                    textAlign: 'center'
                  }}
                >
                  <div 
                    style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      border: '3px solid rgba(99, 102, 241, 0.2)', 
                      borderTopColor: '#6366f1', 
                      animation: 'spin 1s linear infinite',
                      marginBottom: '16px'
                    }}
                  ></div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
                    Scraping & Matching Jobs
                  </div>
                  {bulkProgress ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <div style={{ marginBottom: '8px' }}>
                        Processing job <b>{bulkProgress.index}</b> of <b>{bulkProgress.total}</b>
                      </div>
                      <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 'bold' }}>
                        {bulkProgress.role}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        at {bulkProgress.company}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Extracting job details from feed...
                    </div>
                  )}
                </div>
              )}

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
                  {filteredJobs.map(job => {
                    const matchScore = getMatchScoreFromNotes(job.notes);
                    return (
                      <div className="job-item" key={job.id}>
                        <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className="job-item-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={job.role}>
                              {job.role}
                            </span>
                            {matchScore !== null && (
                              <span 
                                className="badge" 
                                style={{ 
                                  fontSize: '9px', 
                                  padding: '1px 5px',
                                  borderRadius: '10px',
                                  fontWeight: 'bold',
                                  backgroundColor: matchScore >= 75 ? 'rgba(16, 185, 129, 0.15)' : matchScore >= 60 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: matchScore >= 75 ? '#10b981' : matchScore >= 60 ? '#f59e0b' : '#ef4444',
                                  border: `1px solid ${matchScore >= 75 ? 'rgba(16, 185, 129, 0.3)' : matchScore >= 60 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                }}
                              >
                                {matchScore}% Fit
                              </span>
                            )}
                          </div>
                          <div className="job-item-company" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {job.company} • {job.location || 'Remote'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RESUME UPLOAD */}
          {activeTab === 'resume' && (
            <div className="card">
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>Resume Parser (PDF/DOCX)</h3>
              
              <div 
                style={{ 
                  border: '2px dashed var(--border-glass)', 
                  borderRadius: '8px', 
                  padding: '20px 10px', 
                  textAlign: 'center', 
                  marginBottom: '16px', 
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
                  {uploadingFile ? 'Uploading & parsing resume...' : 'Upload PDF or DOCX Resume'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Limits: PDF, DOCX up to 5MB
                </div>
                <input 
                  type="file" 
                  accept=".pdf,.docx" 
                  onChange={handleFileUpload} 
                  disabled={uploadingFile}
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%', 
                    opacity: 0, 
                    cursor: 'pointer' 
                  }} 
                />
              </div>

              <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                Or Edit Plain Text Context
              </h4>
              
              {resumeStatus && (
                <div className={`alert ${resumeStatus.includes('successfully') ? 'alert-info' : 'alert-warning'}`} style={{ padding: '6px 8px', marginBottom: '8px', fontSize: '11px' }}>
                  {resumeStatus}
                </div>
              )}

              <textarea
                className="input-field"
                style={{ height: '160px', fontFamily: 'monospace', fontSize: '11px', resize: 'none' }}
                placeholder="PASTE OR UPLOAD RESUME DETAILS..."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
              />

              <button 
                className="btn btn-primary btn-full" 
                style={{ marginTop: '12px' }} 
                onClick={handleSaveResume}
                disabled={savingResume || uploadingFile}
              >
                {savingResume ? 'Saving Plain Text...' : 'Save & Sync Text'}
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

          {/* TAB 4: JOB SEARCH ENGINE */}
          {activeTab === 'search' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search jobs on LinkedIn (e.g. software engineer)..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  disabled={searchingJobs}
                  onKeyDown={(e) => e.key === 'Enter' && handleBackgroundJobSearch()}
                />
                <button
                  className="btn btn-primary"
                  style={{ flexShrink: 0, padding: '8px 16px' }}
                  onClick={handleBackgroundJobSearch}
                  disabled={searchingJobs}
                >
                  {searchingJobs ? '🔍' : 'Search'}
                </button>
              </div>

              {searchingJobs && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  <div 
                    style={{ 
                      width: '30px', 
                      height: '30px', 
                      borderRadius: '50%', 
                      border: '3px solid rgba(99, 102, 241, 0.2)', 
                      borderTopColor: '#6366f1', 
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 12px auto'
                    }}
                  ></div>
                  Searching and running AI resume compatibility matching... 🚀
                </div>
              )}

              {!searchingJobs && searchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                  Enter keywords to search and analyze matching jobs from LinkedIn in the background.
                </div>
              )}

              {!searchingJobs && searchResults.length > 0 && (
                <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {searchResults.map((job) => (
                    <div className="card" key={job.jobId} style={{ padding: '12px', border: '1px solid var(--border-glass)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.role}>
                            {job.role}
                          </h4>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {job.company} • {job.location || 'Remote'}
                          </div>
                        </div>
                        <span 
                          className="badge" 
                          style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            backgroundColor: job.matchPercent >= 75 ? 'rgba(16, 185, 129, 0.15)' : job.matchPercent >= 60 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: job.matchPercent >= 75 ? '#10b981' : job.matchPercent >= 60 ? '#f59e0b' : '#ef4444',
                            border: `1px solid ${job.matchPercent >= 75 ? 'rgba(16, 185, 129, 0.3)' : job.matchPercent >= 60 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            flexShrink: 0
                          }}
                        >
                          {job.matchPercent}% Fit
                        </span>
                      </div>

                      <p style={{ fontSize: '11px', lineHeight: '1.4', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {job.summary}
                      </p>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a 
                          href={job.apply_link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-secondary" 
                          style={{ flex: 1, textAlign: 'center', padding: '6px', fontSize: '11px', textDecoration: 'none' }}
                        >
                          View Job 🔗
                        </a>
                        <button 
                          className="btn btn-primary" 
                          style={{ flex: 1, padding: '6px', fontSize: '11px' }}
                          onClick={() => handleAddSearchResultToTracker(job)}
                          disabled={addingJobId !== null}
                        >
                          {addingJobId === job.jobId ? 'Saving...' : 'Add to Tracker'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
