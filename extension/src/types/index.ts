export interface Job {
  id?: number;
  user_id?: number;
  company: string;
  role: string;
  location: string;
  salary: string;
  experience: string;
  skills: string[];
  description: string;
  apply_link: string;
  status: 'Wishlist' | 'Applied' | 'OA' | 'Interview' | 'Offer' | 'Rejected';
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: number;
  email: string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  hasResume: boolean;
}

export interface MatchResponse {
  matchPercent: number;
  missingSkills: string[];
  matchingSkills: string[];
  summary: string;
}

export interface InterviewPrepResponse {
  hr: string[];
  technical: string[];
  systemDesign: string[];
}

export interface CoverLetterResponse {
  coverLetter: string;
}
