import React, { useState, useEffect } from 'react';
import { createJob, fetchResumeMatch, fetchInterviewQuestions, fetchCoverLetter } from '../services/api.js';
import { Job, MatchResponse, InterviewPrepResponse, CoverLetterResponse } from '../types/index.js';

interface JobPanelProps {
  detectedJob: Job;
  hasResume: boolean;
  onViewDashboard: () => void;
}

const SimilarJobCard: React.FC<{ job: any }> = ({ job }) => {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      const skillsArray = job.skills || ['Software Development'];
      await createJob({
        company: job.company,
        role: job.role,
        location: job.location || 'Remote',
        salary: job.salary || 'Not Specified',
        experience: job.experience || 'Not Specified',
        skills: skillsArray,
        description: job.description || '',
        apply_link: job.apply_link,
        status: 'Wishlist',
        notes: `[Match: ${job.matchPercent}%] ${job.summary}`
      });
      setSaved(true);
      alert(`Saved ${job.role} at ${job.company} to tracker!`);
    } catch (err: any) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="job-item" 
      onClick={() => setExpanded(!expanded)}
      style={{ 
        flexDirection: 'column',
        alignItems: 'stretch',
        cursor: 'pointer',
        padding: '10px 12px',
        backgroundColor: expanded ? 'rgba(30, 41, 59, 0.55)' : 'rgba(30, 41, 59, 0.3)',
        borderColor: expanded ? 'rgba(99, 102, 241, 0.5)' : 'var(--border-glass)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.role}>
            {job.role}
          </h4>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {job.company} • {job.location || 'Remote'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
          <span 
            className="badge" 
            style={{ 
              fontSize: '9px', 
              padding: '1px 5px',
              backgroundColor: job.matchPercent >= 75 ? 'rgba(16, 185, 129, 0.15)' : job.matchPercent >= 60 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: job.matchPercent >= 75 ? '#10b981' : job.matchPercent >= 60 ? '#f59e0b' : '#ef4444',
              border: `1px solid ${job.matchPercent >= 75 ? 'rgba(16, 185, 129, 0.3)' : job.matchPercent >= 60 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}
          >
            {job.matchPercent}% Fit
          </span>
          <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {job.source}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <div style={{ fontWeight: 'bold', color: '#818cf8', marginBottom: '2px' }}>Score Explanation</div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.3' }}>{job.summary}</p>
          </div>

          {job.missingSkills && job.missingSkills.length > 0 && (
            <div>
              <div style={{ fontWeight: 'bold', color: 'var(--danger)', marginBottom: '2px' }}>Missing Technologies</div>
              <div className="skills-list" style={{ marginTop: '2px' }}>
                {job.missingSkills.map((s: string, i: number) => (
                  <span className="skill-tag missing" style={{ fontSize: '9px', padding: '1px 4px' }} key={i}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {job.recommendedLearning && job.recommendedLearning.length > 0 && (
            <div>
              <div style={{ fontWeight: 'bold', color: 'var(--success)', marginBottom: '2px' }}>Recommended Improvements</div>
              <ul style={{ paddingLeft: '14px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {job.recommendedLearning.map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <a 
              href={job.apply_link} 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={(e) => e.stopPropagation()}
              className="btn btn-secondary" 
              style={{ flex: 1, padding: '4px', fontSize: '10px', textAlign: 'center', display: 'block', textDecoration: 'none' }}
            >
              Apply 🔗
            </a>
            <button 
              className="btn btn-primary" 
              onClick={handleAdd}
              disabled={saved || saving}
              style={{ flex: 1, padding: '4px', fontSize: '10px' }}
            >
              {saving ? 'Adding...' : saved ? '✓ Saved' : 'Add Tracker'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const JobPanel: React.FC<JobPanelProps> = ({ detectedJob, hasResume, onViewDashboard }) => {
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // AI related states
  const [aiActiveTab, setAiActiveTab] = useState<'match' | 'similar' | 'questions' | 'coverletter' | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState('');

  const [matchData, setMatchData] = useState<MatchResponse | null>(null);
  const [questionsData, setQuestionsData] = useState<InterviewPrepResponse | null>(null);
  const [coverLetterData, setCoverLetterData] = useState<CoverLetterResponse | null>(null);

  // Similar Jobs states
  const [similarJobs, setSimilarJobs] = useState<any[]>([]);
  const [searchingSimilar, setSearchingSimilar] = useState(false);
  const [similarError, setSimilarError] = useState('');

  const handleFetchSimilarJobs = async () => {
    if (!hasResume) return;
    setAiActiveTab('similar');
    if (similarJobs.length > 0) return; // already loaded

    setSearchingSimilar(true);
    setSimilarError('');
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage(
          { action: 'SEARCH_AND_MATCH_JOBS', keyword: detectedJob.role },
          (res) => {
            setSearchingSimilar(false);
            if (chrome.runtime.lastError) {
              setSimilarError(chrome.runtime.lastError.message || 'Unknown extension runtime error.');
              return;
            }
            if (res && res.success) {
              setSimilarJobs(res.jobs || []);
            } else {
              setSimilarError(res?.error || 'Failed to search similar jobs.');
            }
          }
        );
      } else {
        setSearchingSimilar(false);
        setSimilarError('Extension service worker not available.');
      }
    } catch (err: any) {
      setSearchingSimilar(false);
      setSimilarError(err.message || 'Failed to trigger search.');
    }
  };

  // Check if job is already saved (simulated / cached)
  useEffect(() => {
    setIsSaved(false);
    // Reset AI results when job changes
    setMatchData(null);
    setQuestionsData(null);
    setCoverLetterData(null);
    setSimilarJobs([]);
    setAiActiveTab(null);
  }, [detectedJob]);

  const handleSaveJob = async () => {
    setSaving(true);
    try {
      await createJob(detectedJob);
      setIsSaved(true);
    } catch (err: any) {
      alert('Error saving job application: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRunAiMatch = async () => {
    if (!hasResume) return;
    setAiActiveTab('match');
    if (matchData) return; // already loaded
    
    setLoadingAi(true);
    setAiError('');
    try {
      const res = await fetchResumeMatch(detectedJob.role, detectedJob.company, detectedJob.description);
      setMatchData(res);
    } catch (err: any) {
      setAiError(err.message || 'Failed to match resume.');
    } finally {
      setLoadingAi(false);
    }
  };

  const handleRunAiQuestions = async () => {
    setAiActiveTab('questions');
    if (questionsData) return; // already loaded

    setLoadingAi(true);
    setAiError('');
    try {
      const res = await fetchInterviewQuestions(detectedJob.role, detectedJob.company, detectedJob.description);
      setQuestionsData(res);
    } catch (err: any) {
      setAiError(err.message || 'Failed to generate interview questions.');
    } finally {
      setLoadingAi(false);
    }
  };

  const handleRunAiCoverLetter = async () => {
    if (!hasResume) return;
    setAiActiveTab('coverletter');
    if (coverLetterData) return; // already loaded

    setLoadingAi(true);
    setAiError('');
    try {
      const res = await fetchCoverLetter(detectedJob.role, detectedJob.company, detectedJob.description);
      setCoverLetterData(res);
    } catch (err: any) {
      setAiError(err.message || 'Failed to generate cover letter.');
    } finally {
      setLoadingAi(false);
    }
  };

  const copyCoverLetter = () => {
    if (!coverLetterData) return;
    navigator.clipboard.writeText(coverLetterData.coverLetter);
    alert('Cover letter copied to clipboard! 📋');
  };

  return (
    <div style={{ paddingBottom: '10px' }}>
      <div className="header">
        <h1 className="logo">JobPilot <span>PANEL</span></h1>
        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={onViewDashboard}>
          Dashboard
        </button>
      </div>

      {/* Detected Job Summary Card */}
      <div className="card" style={{ marginBottom: '16px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
          <span className="badge badge-applied">✓ Job Detected</span>
        </div>
        
        <h2 style={{ fontSize: '18px', fontWeight: '800', marginRight: '80px', color: '#fff', wordBreak: 'break-word' }}>
          {detectedJob.role}
        </h2>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '600' }}>
          {detectedJob.company}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
          <span className="skill-tag">📍 {detectedJob.location || 'Remote'}</span>
          <span className="skill-tag">💰 {detectedJob.salary || 'Not Specified'}</span>
          <span className="skill-tag">💼 {detectedJob.experience || 'Not Specified'}</span>
        </div>

        {detectedJob.skills && detectedJob.skills.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Key Skills Required</div>
            <div className="skills-list">
              {detectedJob.skills.map((skill, index) => (
                <span className="skill-tag" key={index}>{skill}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          <button 
            className="btn btn-primary btn-full" 
            onClick={handleSaveJob}
            disabled={saving || isSaved}
          >
            {saving ? 'Saving...' : isSaved ? '✓ Job Saved to Tracker' : 'Save Application Tracker'}
          </button>
        </div>
      </div>

      {/* AI Operations Section */}
      <div className="card">
        <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '10px', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ✨ AI Application Insights
        </h3>

        {!hasResume ? (
          <div className="alert alert-warning" style={{ margin: 0, fontSize: '12px', lineHeight: '1.4' }}>
            <span>⚠️ Resume is missing. Paste your resume plain text under the <b>Resume</b> tab on the Dashboard to activate resume matching and cover letter generation.</span>
          </div>
        ) : (
          <div>
            {/* Quick buttons */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
              <button 
                className={`btn btn-secondary btn-full ${aiActiveTab === 'match' ? 'active' : ''}`}
                style={{ padding: '8px 2px', fontSize: '10px', flex: 1, borderColor: aiActiveTab === 'match' ? '#6366f1' : 'var(--border-glass)' }}
                onClick={handleRunAiMatch}
              >
                📊 Fit Score
              </button>
              <button 
                className={`btn btn-secondary btn-full ${aiActiveTab === 'similar' ? 'active' : ''}`}
                style={{ padding: '8px 2px', fontSize: '10px', flex: 1, borderColor: aiActiveTab === 'similar' ? '#6366f1' : 'var(--border-glass)' }}
                onClick={handleFetchSimilarJobs}
              >
                🔍 Similar
              </button>
              <button 
                className={`btn btn-secondary btn-full ${aiActiveTab === 'questions' ? 'active' : ''}`}
                style={{ padding: '8px 2px', fontSize: '10px', flex: 1, borderColor: aiActiveTab === 'questions' ? '#6366f1' : 'var(--border-glass)' }}
                onClick={handleRunAiQuestions}
              >
                💡 Prep QA
              </button>
              <button 
                className={`btn btn-secondary btn-full ${aiActiveTab === 'coverletter' ? 'active' : ''}`}
                style={{ padding: '8px 2px', fontSize: '10px', flex: 1, borderColor: aiActiveTab === 'coverletter' ? '#6366f1' : 'var(--border-glass)' }}
                onClick={handleRunAiCoverLetter}
              >
                📝 Letter
              </button>
            </div>

            {/* AI Error */}
            {aiError && <div className="alert alert-warning" style={{ fontSize: '11px' }}>⚠️ {aiError}</div>}

            {/* AI Loading indicator */}
            {loadingAi && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
                Analyzing with Gemini AI... 🚀
              </div>
            )}

            {/* AI Result views */}
            {!loadingAi && !aiError && (
              <div>
                {/* 1. MATCH RESULTS */}
                {aiActiveTab === 'match' && matchData && (
                  <div>
                    <div className="match-score-container" style={{ gap: '12px' }}>
                      <div className="match-circle" style={{ '--progress': `${matchData.matchPercent * 3.6}deg`, flexShrink: 0 } as any}>
                        <div className="match-text">{matchData.matchPercent}%</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '12px' }}>Overall ATS Fit</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.2' }}>
                          Compatibility score calculated.
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '10px', fontSize: '10px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px 6px', borderRadius: '4px' }}>
                        Skills: <b style={{ color: '#818cf8' }}>{(matchData as any).skillMatchPercent || matchData.matchPercent}%</b>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px 6px', borderRadius: '4px' }}>
                        Experience: <b style={{ color: '#c084fc' }}>{(matchData as any).experienceMatchPercent || 70}%</b>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px 6px', borderRadius: '4px' }}>
                        Education: <b style={{ color: '#34d399' }}>{(matchData as any).educationMatchPercent || 100}%</b>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px 6px', borderRadius: '4px' }}>
                        Keywords: <b style={{ color: '#fb7185' }}>{(matchData as any).keywordMatchPercent || 65}%</b>
                      </div>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Missing Skills</div>
                      <div className="skills-list">
                        {matchData.missingSkills.map((s, i) => (
                          <span className="skill-tag missing" key={i}>{s}</span>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Matching Skills</div>
                      <div className="skills-list">
                        {matchData.matchingSkills.map((s, i) => (
                          <span className="skill-tag matching" key={i}>{s}</span>
                        ))}
                      </div>
                    </div>

                    {(matchData as any).recommendedLearning && (matchData as any).recommendedLearning.length > 0 && (
                      <div style={{ marginBottom: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--success)' }}>Recommended Improvements</div>
                        <ul style={{ paddingLeft: '14px', fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {(matchData as any).recommendedLearning.map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p style={{ fontSize: '11px', lineHeight: '1.4', color: 'var(--text-secondary)', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                      <b>Why it matches:</b> {matchData.summary}
                    </p>
                  </div>
                )}

                {/* 2. SIMILAR JOBS SEARCH & RANKING */}
                {aiActiveTab === ('similar' as any) && (
                  <div>
                    {searchingSimilar && (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        Searching active jobs & scoring compatibility... 🚀
                      </div>
                    )}

                    {similarError && (
                      <div className="alert alert-warning" style={{ fontSize: '11px' }}>⚠️ {similarError}</div>
                    )}

                    {!searchingSimilar && !similarError && similarJobs.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-secondary)', fontSize: '11px' }}>
                        No similar jobs found on other platforms.
                      </div>
                    )}

                    {!searchingSimilar && similarJobs.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                        {similarJobs.map((job) => (
                          <SimilarJobCard job={job} key={job.jobId} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. INTERVIEW PREP */}
                {aiActiveTab === 'questions' && questionsData && (
                  <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#818cf8', marginBottom: '6px' }}>💬 HR / Behavioral Qs</div>
                      {questionsData.hr.map((q, i) => (
                        <div className="question-list-item" style={{ fontSize: '11px', color: 'var(--text-secondary)' }} key={i}>{i+1}. {q}</div>
                      ))}
                    </div>
                    
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#c084fc', marginBottom: '6px' }}>💻 Technical Qs</div>
                      {questionsData.technical.map((q, i) => (
                        <div className="question-list-item" style={{ fontSize: '11px', color: 'var(--text-secondary)' }} key={i}>{i+1}. {q}</div>
                      ))}
                    </div>

                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#34d399', marginBottom: '6px' }}>🏗️ System Design / Architecture</div>
                      {questionsData.systemDesign.map((q, i) => (
                        <div className="question-list-item" style={{ fontSize: '11px', color: 'var(--text-secondary)' }} key={i}>{i+1}. {q}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. COVER LETTER */}
                {aiActiveTab === 'coverletter' && coverLetterData && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Tailored Cover Letter</span>
                      <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={copyCoverLetter}>
                        Copy Letter
                      </button>
                    </div>
                    <textarea 
                      className="input-field" 
                      style={{ height: '180px', fontSize: '11px', fontFamily: 'monospace', resize: 'none' }}
                      readOnly
                      value={coverLetterData.coverLetter}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '12px' }}>
        <span 
          style={{ fontSize: '12px', color: '#818cf8', cursor: 'pointer', textDecoration: 'underline' }}
          onClick={onViewDashboard}
        >
          Go to Application Dashboard →
        </span>
      </div>
    </div>
  );
};
