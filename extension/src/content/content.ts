import { scrapeLinkedIn, scrapeLinkedInSearchResults } from './linkedin.js';
import { scrapeNaukri, scrapeNaukriSearchResults } from './naukri.js';
import { scrapeWellfound, scrapeWellfoundSearchResults } from './wellfound.js';
import { scrapeIndeed, scrapeIndeedSearchResults } from './indeed.js';

let activeBaseUrl = 'https://jobpilot-backend-cjoz.onrender.com/api';

const detectBackend = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch('http://localhost:5001/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      activeBaseUrl = 'http://localhost:5001/api';
      console.log('✈️ JobPilot Content: Local backend detected.');
    }
  } catch (e) {
    // Ignore
  }
};
detectBackend();

let lastUrl = window.location.href;
const processingUrls = new Set<string>();
let isAutoScraping = false;

const isContextValid = (): boolean => {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
  } catch {
    return false;
  }
};

const runScraper = (): any => {
  const host = window.location.host;
  
  if (host.includes('linkedin.com')) {
    return scrapeLinkedIn();
  } else if (host.includes('naukri.com')) {
    return scrapeNaukri();
  } else if (host.includes('wellfound.com')) {
    return scrapeWellfound();
  } else if (host.includes('indeed.com')) {
    return scrapeIndeed();
  }
  return null;
};

const checkPageType = (): { type: 'single' | 'search' | 'none'; count: number } => {
  const host = window.location.host;
  const path = window.location.pathname;
  const href = window.location.href;

  try {
    if (host.includes('linkedin.com')) {
      if (href.includes('/jobs/search') || href.includes('/jobs/collections')) {
        const count = document.querySelectorAll('[data-job-id]').length;
        return { type: 'search', count };
      }
      const hasJobTitle = !!document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1');
      return { type: hasJobTitle ? 'single' : 'none', count: 0 };
    } else if (host.includes('naukri.com')) {
      if (path.includes('/jobs-in') || path.includes('/jobs-search') || document.querySelector('.cust-job-tuple, .jobTuple')) {
        const count = document.querySelectorAll('.cust-job-tuple, .jobTuple, article.jobTuple').length;
        return { type: 'search', count };
      }
      const hasJobTitle = !!document.querySelector('.jd-header-title, h1.title, .job-title');
      return { type: hasJobTitle ? 'single' : 'none', count: 0 };
    } else if (host.includes('wellfound.com')) {
      if (path.includes('/jobs') || document.querySelector('[data-test="JobResultCard"]')) {
        const count = document.querySelectorAll('[data-test="JobResultCard"], [class*="jobCard"], [class*="JobCard"]').length;
        return { type: 'search', count };
      }
      const hasJobTitle = !!document.querySelector('h1.job-title, .job-title, h1');
      return { type: hasJobTitle ? 'single' : 'none', count: 0 };
    } else if (host.includes('indeed.com')) {
      if (href.includes('/jobs') || href.includes('/q-') || document.querySelector('.job_seen_beacon, td.resultContent')) {
        const count = document.querySelectorAll('.job_seen_beacon, td.resultContent, div.jobsearch-SerpJobCard').length;
        return { type: 'search', count };
      }
      const hasJobTitle = !!document.querySelector('.jobsearch-JobInfoHeader-title, h1.jobsearch-JobInfoHeader-title, h1');
      return { type: hasJobTitle ? 'single' : 'none', count: 0 };
    }
  } catch (error) {
    console.error('Error checking page type:', error);
  }
  return { type: 'none', count: 0 };
};

const getAuthTokenFromStorage = (): Promise<string | null> => {
  return new Promise((resolve) => {
    if (isContextValid() && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['auth_token'], (result) => {
        resolve(result.auth_token || null);
      });
    } else {
      resolve(null);
    }
  });
};

const getAlreadySavedUrls = (): Promise<string[]> => {
  return new Promise((resolve) => {
    if (isContextValid() && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['cached_jobs'], (result) => {
        const jobs = result.cached_jobs || [];
        const urls = jobs.map((j: any) => j.apply_link).filter(Boolean);
        resolve(urls);
      });
    } else {
      resolve([]);
    }
  });
};

const saveJobAndMatch = async (job: any, token: string) => {
  try {
    const saveRes = await fetch(`${activeBaseUrl}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(job)
    });
    if (!saveRes.ok) throw new Error('Failed to create job');
    const saveData = await saveRes.json();
    const savedJob = saveData.job;

    const matchRes = await fetch(`${activeBaseUrl}/ai/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        jobRole: job.role,
        jobCompany: job.company,
        jobDescription: job.description
      })
    });
    
    if (matchRes.ok) {
      const matchData = await matchRes.json();
      const notes = `[Match: ${matchData.matchPercent}%] ${matchData.summary}`;
      
      await fetch(`${activeBaseUrl}/jobs/${savedJob.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: savedJob.status,
          notes
        })
      });
    }
    
    console.log(`%c✈️ JobPilot Auto-Scraped & Matched: ${job.role} at ${job.company}`, 'color: #10b981; font-weight: bold;');
    
    try {
      chrome.runtime.sendMessage({ action: 'REFRESH_DASHBOARD' });
    } catch (e) {
      // Popup closed
    }
  } catch (error) {
    console.error('Auto-Scrape save error:', error);
  }
};

const autoScrapeSearchPage = async () => {
  if (isAutoScraping || !isContextValid()) return;
  
  const token = await getAuthTokenFromStorage();
  if (!token) return;

  const pageTypeInfo = checkPageType();
  if (pageTypeInfo.type !== 'search') return;

  const host = window.location.host;
  let rawJobs: any[] = [];

  if (host.includes('linkedin.com')) {
    rawJobs = scrapeLinkedInSearchResults();
  } else if (host.includes('naukri.com')) {
    rawJobs = scrapeNaukriSearchResults();
  } else if (host.includes('wellfound.com')) {
    rawJobs = scrapeWellfoundSearchResults();
  } else if (host.includes('indeed.com')) {
    rawJobs = scrapeIndeedSearchResults();
  }

  if (rawJobs.length === 0) return;

  const savedUrls = await getAlreadySavedUrls();
  const newJobs = rawJobs.filter(job => !savedUrls.includes(job.apply_link) && !processingUrls.has(job.apply_link));

  if (newJobs.length === 0) return;

  isAutoScraping = true;
  console.log(`%c✈️ JobPilot: Found ${newJobs.length} new jobs in search list. Auto-scraping...`, 'color: #6366f1; font-weight: bold;');

  for (const job of newJobs) {
    if (!isContextValid()) break;
    processingUrls.add(job.apply_link);
    
    try {
      let description = '';
      if (job.source === 'LinkedIn' && job.jobId) {
        const res = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ action: 'FETCH_LINKEDIN_JOB_DETAIL', jobId: job.jobId }, resolve);
        });
        if (res && res.success) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(res.html, 'text/html');
          const descEl = doc.querySelector('.description__text, .show-more-less-html__markup');
          description = descEl ? descEl.textContent?.trim() : '';
        }
      } else if (job.apply_link) {
        const res = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ action: 'FETCH_URL', url: job.apply_link }, resolve);
        });
        if (res && res.success) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(res.html, 'text/html');
          let descEl = null;
          if (job.source === 'Naukri') {
            descEl = doc.querySelector('.job-desc, .job-description, #job-description');
          } else if (job.source === 'Wellfound') {
            descEl = doc.querySelector('.job-description, .description, .jobDescription');
          } else if (job.source === 'Indeed') {
            descEl = doc.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText');
          }
          description = descEl ? descEl.textContent?.trim() : '';
        }
      }

      if (!description) {
        description = `Position details for ${job.role} at ${job.company}. Click apply link to view full description.`;
      }

      const textToSearch = (job.role + ' ' + description).toLowerCase();
      const techWords = [
        'react', 'angular', 'vue', 'typescript', 'javascript', 'node', 'express', 
        'python', 'django', 'java', 'spring', 'go', 'golang', 'rust', 'c++', 'c#', 
        'postgres', 'mysql', 'mongodb', 'redis', 'docker', 'kubernetes', 'aws', 
        'gcp', 'kafka', 'git', 'ci/cd', 'graphql', 'next.js', 'tailwind'
      ];
      const skills: string[] = [];
      for (const tech of techWords) {
        const regex = new RegExp(`\\b${tech.replace(/[\.\+]/g, '\\$&')}\\b`, 'i');
        if (regex.test(textToSearch)) {
          const prettyName = tech === 'js' || tech === 'git' || tech === 'aws' || tech === 'gcp'
            ? tech.toUpperCase()
            : tech.charAt(0).toUpperCase() + tech.slice(1);
          skills.push(prettyName);
        }
      }

      const fullJobData = {
        company: job.company,
        role: job.role,
        location: job.location,
        salary: job.salary || 'Not Specified',
        experience: job.experience || 'Not Specified',
        skills: skills.slice(0, 8),
        description,
        apply_link: job.apply_link,
        status: 'Wishlist',
        notes: ''
      };

      await saveJobAndMatch(fullJobData, token);
      await new Promise(resolve => setTimeout(resolve, 2000)); // small delay to respect rate limits
    } catch (e) {
      console.error('Auto-scrape job failure:', e);
    }
  }

  isAutoScraping = false;
};

const runBulkScrape = async (sendProgress: (data: any) => void): Promise<any[]> => {
  const host = window.location.host;
  let rawJobs: any[] = [];

  if (host.includes('linkedin.com')) {
    rawJobs = scrapeLinkedInSearchResults();
  } else if (host.includes('naukri.com')) {
    rawJobs = scrapeNaukriSearchResults();
  } else if (host.includes('wellfound.com')) {
    rawJobs = scrapeWellfoundSearchResults();
  } else if (host.includes('indeed.com')) {
    rawJobs = scrapeIndeedSearchResults();
  }

  const processedJobs: any[] = [];
  const total = rawJobs.length;

  for (let i = 0; i < total; i++) {
    const job = rawJobs[i];
    sendProgress({ status: 'scraping', index: i + 1, total, role: job.role, company: job.company });

    try {
      let html = '';
      let description = '';

      if (job.source === 'LinkedIn' && job.jobId) {
        const res = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ action: 'FETCH_LINKEDIN_JOB_DETAIL', jobId: job.jobId }, resolve);
        });
        if (res && res.success) {
          html = res.html;
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const descEl = doc.querySelector('.description__text, .show-more-less-html__markup');
          description = descEl ? descEl.textContent?.trim() : '';
        }
      } else if (job.apply_link) {
        const res = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ action: 'FETCH_URL', url: job.apply_link }, resolve);
        });
        if (res && res.success) {
          html = res.html;
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          let descEl = null;
          if (job.source === 'Naukri') {
            descEl = doc.querySelector('.job-desc, .job-description, #job-description');
          } else if (job.source === 'Wellfound') {
            descEl = doc.querySelector('.job-description, .description, .jobDescription');
          } else if (job.source === 'Indeed') {
            descEl = doc.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText');
          }
          description = descEl ? descEl.textContent?.trim() : '';
        }
      }

      if (!description) {
        description = `Position details for ${job.role} at ${job.company}. Click apply link to view full description.`;
      }

      const textToSearch = (job.role + ' ' + description).toLowerCase();
      const techWords = [
        'react', 'angular', 'vue', 'typescript', 'javascript', 'node', 'express', 
        'python', 'django', 'java', 'spring', 'go', 'golang', 'rust', 'c++', 'c#', 
        'postgres', 'mysql', 'mongodb', 'redis', 'docker', 'kubernetes', 'aws', 
        'gcp', 'kafka', 'git', 'ci/cd', 'graphql', 'next.js', 'tailwind'
      ];
      const skills: string[] = [];
      for (const tech of techWords) {
        const regex = new RegExp(`\\b${tech.replace(/[\.\+]/g, '\\$&')}\\b`, 'i');
        if (regex.test(textToSearch)) {
          const prettyName = tech === 'js' || tech === 'git' || tech === 'aws' || tech === 'gcp'
            ? tech.toUpperCase()
            : tech.charAt(0).toUpperCase() + tech.slice(1);
          skills.push(prettyName);
        }
      }

      processedJobs.push({
        company: job.company,
        role: job.role,
        location: job.location,
        salary: job.salary || 'Not Specified',
        experience: job.experience || 'Not Specified',
        skills: skills.slice(0, 8),
        description,
        apply_link: job.apply_link,
        status: 'Wishlist',
        notes: ''
      });
    } catch (err) {
      console.error('Error processing bulk scrape item:', err);
    }
  }

  return processedJobs;
};

// Update storage with currently detected job details
const updateDetectedJobInStorage = () => {
  if (!isContextValid()) return;
  try {
    const pageTypeInfo = checkPageType();
    if (pageTypeInfo.type === 'single') {
      const job = runScraper();
      if (job) {
        console.log('%c✈️ JobPilot Auto-Scrape Output:', 'color: #6366f1; font-weight: bold; font-size: 13px;', job);
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ detected_job: job });
        }
      } else {
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.remove('detected_job');
        }
      }
    } else if (pageTypeInfo.type === 'search') {
      // Trigger background search page scraper
      autoScrapeSearchPage();
    } else {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove('detected_job');
      }
    }
  } catch (error) {
    console.debug('JobPilot: Storage update skipped (context invalidated).');
  }
};

// Listen for messages from popup or background
if (isContextValid()) {
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isContextValid()) return false;
      if (message.action === 'SCRAPE_JOB') {
        const job = runScraper();
        console.log('%c✈️ JobPilot Requested Scrape Output:', 'color: #a855f7; font-weight: bold; font-size: 13px;', job);
        sendResponse({ job });
      } else if (message.action === 'CHECK_PAGE_TYPE') {
        const result = checkPageType();
        sendResponse(result);
      } else if (message.action === 'BULK_SCRAPE') {
        runBulkScrape((progress) => {
          try {
            chrome.runtime.sendMessage({ action: 'BULK_SCRAPE_PROGRESS', progress });
          } catch (e) {
            // Popup closed, ignore
          }
        }).then(jobs => {
          sendResponse({ success: true, jobs });
        }).catch(err => {
          sendResponse({ success: false, error: err.message });
        });
        return true; // Keep response channel open for async promise
      }
      return true; // Keep message channel open for async response
    });
  } catch (error) {
    console.debug('JobPilot: Listener registration skipped (context invalidated).');
  }
}

// Initial run
updateDetectedJobInStorage();

// Monitor SPA navigation / DOM changes (LinkedIn job-clicking is dynamic)
const observer = new MutationObserver(() => {
  if (!isContextValid()) {
    observer.disconnect();
    return;
  }
  try {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      setTimeout(updateDetectedJobInStorage, 1000); // Wait for DOM to paint
    } else {
      // Trigger check on DOM changes as well (for scroll-loading items)
      updateDetectedJobInStorage();
    }
  } catch (error) {
    observer.disconnect();
  }
});

try {
  observer.observe(document.body, { childList: true, subtree: true });
} catch (error) {
  console.debug('JobPilot: MutationObserver failed (context invalidated).');
}

// Backup check for item changes inside the DOM (e.g. clicking different job cards)
const intervalId = setInterval(() => {
  if (!isContextValid()) {
    clearInterval(intervalId);
    return;
  }
  try {
    updateDetectedJobInStorage();
  } catch (error) {
    clearInterval(intervalId);
  }
}, 3000);
