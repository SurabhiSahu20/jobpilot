import { Job, User } from '../types/index.js';

// Safe wrapper around chrome.storage.local with localStorage fallback
const isExtensionEnvironment = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

export const storageGet = <T>(key: string): Promise<T | null> => {
  return new Promise((resolve) => {
    if (isExtensionEnvironment) {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] !== undefined ? (result[key] as T) : null);
      });
    } else {
      const data = localStorage.getItem(key);
      try {
        resolve(data ? JSON.parse(data) : null);
      } catch {
        resolve(data as unknown as T);
      }
    }
  });
};

export const storageSet = (key: string, value: any): Promise<void> => {
  return new Promise((resolve) => {
    if (isExtensionEnvironment) {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    } else {
      localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
      resolve();
    }
  });
};

export const storageRemove = (key: string): Promise<void> => {
  return new Promise((resolve) => {
    if (isExtensionEnvironment) {
      chrome.storage.local.remove([key], () => {
        resolve();
      });
    } else {
      localStorage.removeItem(key);
      resolve();
    }
  });
};

// Application State Getters/Setters
export const getAuthToken = (): Promise<string | null> => storageGet<string>('auth_token');
export const setAuthToken = (token: string | null): Promise<void> => {
  if (token) return storageSet('auth_token', token);
  return storageRemove('auth_token');
};

export const getAuthUser = (): Promise<User | null> => storageGet<User>('auth_user');
export const setAuthUser = (user: User | null): Promise<void> => {
  if (user) return storageSet('auth_user', user);
  return storageRemove('auth_user');
};

export const getCachedJobs = (): Promise<Job[]> => storageGet<Job[]>('cached_jobs').then(jobs => jobs || []);
export const setCachedJobs = (jobs: Job[]): Promise<void> => storageSet('cached_jobs', jobs);

export const getDetectedJob = (): Promise<Job | null> => storageGet<Job>('detected_job');
export const setDetectedJob = (job: Job | null): Promise<void> => {
  if (job) return storageSet('detected_job', job);
  return storageRemove('detected_job');
};

export const clearLocalStorageCache = async (): Promise<void> => {
  await storageRemove('auth_token');
  await storageRemove('auth_user');
  await storageRemove('cached_jobs');
  await storageRemove('detected_job');
};
