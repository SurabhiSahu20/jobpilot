import React, { useState, useEffect } from 'react';
import { createJob, fetchResumeMatch, fetchInterviewQuestions, fetchCoverLetter } from '../services/api.js';
import { Job, MatchResponse, InterviewPrepResponse, CoverLetterResponse } from '../types/index.js';

interface JobPanelProps {
  detectedJob: Job;
  hasResume: boolean;
  onViewDashboard: () => void;
}

export const JobPanel: React.FC<JobPanelProps> = ({ detectedJob, hasResume, onViewDashboard }) => {
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // AI related states
  const [aiActiveTab, setAiActiveTab] = useState<'match' | 'questions' | 'coverletter' | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState('');

  const [matchData, setMatchData] = useState<MatchResponse | null>(null);
  const [questionsData, setQuestionsData] = useState<InterviewPrepResponse | null>(null);
  const [coverLetterData, setCoverLetterData] = useState<CoverLetterResponse | null>(null);

  // Check if job is already saved (simulated / cached)
  useEffect(() => {
    setIsSaved(false);
    // Reset AI results when job changes
    setMatchData(null);
    setQuestionsData(null);
    setCoverLetterData(null);
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
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <button 
                className={`btn btn-secondary btn-full ${aiActiveTab === 'match' ? 'active' : ''}`}
                style={{ padding: '8px 4px', fontSize: '11px', flex: 1, borderColor: aiActiveTab === 'match' ? '#6366f1' : 'var(--border-glass)' }}
                onClick={handleRunAiMatch}
              >
                📊 Check Fit
              </button>
              <button 
                className={`btn btn-secondary btn-full ${aiActiveTab === 'questions' ? 'active' : ''}`}
                style={{ padding: '8px 4px', fontSize: '11px', flex: 1, borderColor: aiActiveTab === 'questions' ? '#6366f1' : 'var(--border-glass)' }}
                onClick={handleRunAiQuestions}
              >
                💡 Prep QA
              </button>
              <button 
                className={`btn btn-secondary btn-full ${aiActiveTab === 'coverletter' ? 'active' : ''}`}
                style={{ padding: '8px 4px', fontSize: '11px', flex: 1, borderColor: aiActiveTab === 'coverletter' ? '#6366f1' : 'var(--border-glass)' }}
                onClick={handleRunAiCoverLetter}
              >
                📝 Cover Letter
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
                    <div className="match-score-container">
                      <div className="match-circle" style={{ '--progress': `${matchData.matchPercent * 3.6}deg` } as any}>
                        <div className="match-text">{matchData.matchPercent}%</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '13px' }}>Resume Fit Score</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>
                          Parsed against job requirements.
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Missing Skills (Skill Gap)</div>
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

                    <p style={{ fontSize: '11px', lineHeight: '1.4', color: 'var(--text-secondary)', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                      <b>Recruiter Fit:</b> {matchData.summary}
                    </p>
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
