import { getAuthToken } from './indexeddb.js';
import { Job, MatchResponse, InterviewPrepResponse, CoverLetterResponse } from '../types/index.js';

let activeBaseUrl = 'http://localhost:5001/api';

// Dynamic resolver to connect to local server if it is active
const detectBackend = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const res = await fetch('http://localhost:5001/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      activeBaseUrl = 'https://jobpilot-backend-cjoz.onrender.com/api';
    }
  } catch (e) {
    activeBaseUrl = 'https://jobpilot-backend-cjoz.onrender.com/api';
    console.log('✈️ JobPilot: Local backend inactive. Defaulting to hosted Render server.');
  }
};
detectBackend();

const getHeaders = async (includeAuth = true): Promise<HeadersInit> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (includeAuth) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
};

export const apiRequest = async <T>(
  endpoint: string,
  method = 'GET',
  body?: any,
  includeAuth = true
): Promise<T> => {
  const url = `${activeBaseUrl}${endpoint}`;
  const headers = await getHeaders(includeAuth);

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data as T;
  } catch (error: any) {
    console.error(`API Request error on ${endpoint}:`, error);
    throw error;
  }
};

// Auth Actions
export const loginUser = (email: string, password: string) => {
  return apiRequest<{ message: string; token: string; user: { id: number; email: string; hasResume: boolean } }>(
    '/auth/login',
    'POST',
    { email, password },
    false
  );
};

export const registerUser = (email: string, password: string) => {
  return apiRequest<{ message: string; token: string; user: { id: number; email: string } }>(
    '/auth/register',
    'POST',
    { email, password },
    false
  );
};

export const getUserResume = () => {
  return apiRequest<{ email: string; resume_text: string }>('/auth/profile', 'GET');
};

export const updateUserResume = (resumeText: string) => {
  return apiRequest<{ message: string; resume_text: string }>('/auth/resume', 'PUT', {
    resume_text: resumeText,
  });
};

// Job Tracker Actions
export const getJobs = () => {
  return apiRequest<Job[]>('/jobs', 'GET');
};

export const createJob = (job: Job) => {
  return apiRequest<{ message: string; job: Job }>('/jobs', 'POST', job);
};

export const updateJobStatus = (id: number, status: string, notes?: string) => {
  return apiRequest<{ message: string; job: Job }>(`/jobs/${id}`, 'PUT', { status, notes });
};

export const deleteJob = (id: number) => {
  return apiRequest<{ message: string; job: Job }>(`/jobs/${id}`, 'DELETE');
};

// AI Insights Actions
export const fetchResumeMatch = (jobRole: string, jobCompany: string, jobDescription: string) => {
  return apiRequest<MatchResponse>('/ai/match', 'POST', {
    jobRole,
    jobCompany,
    jobDescription,
  });
};

export const fetchInterviewQuestions = (jobRole: string, jobCompany: string, jobDescription: string) => {
  return apiRequest<InterviewPrepResponse>('/ai/interview-questions', 'POST', {
    jobRole,
    jobCompany,
    jobDescription,
  });
};

export const fetchCoverLetter = (jobRole: string, jobCompany: string, jobDescription: string) => {
  return apiRequest<CoverLetterResponse>('/ai/cover-letter', 'POST', {
    jobRole,
    jobCompany,
    jobDescription,
  });
};

export const uploadResumeFile = async (file: File): Promise<{ message: string; resume_text: string }> => {
  const token = await getAuthToken();
  const url = `${activeBaseUrl}/auth/resume-upload`;
  
  const formData = new FormData();
  formData.append('resume', file);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP error! status: ${response.status}`);
  }
  return data;
};
