import { getCachedJobs } from '../services/indexeddb.js';
import { providers } from './providers.js';

// Configure extension action click to open side panel
if (typeof chrome !== 'undefined' && (chrome as any).sidePanel && (chrome as any).sidePanel.setPanelBehavior) {
  (chrome as any).sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err: any) => console.log('Error setting side panel behavior:', err));
}

const setupHeaderRules = () => {
  if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest) {
    const rules = [
      {
        id: 1,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'origin', operation: 'remove' },
            { header: 'referer', operation: 'set', value: 'https://www.linkedin.com/' }
          ]
        },
        condition: {
          urlFilter: 'linkedin.com',
          resourceTypes: ['xmlhttprequest']
        }
      },
      {
        id: 2,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'origin', operation: 'remove' },
            { header: 'referer', operation: 'set', value: 'https://www.indeed.com/' }
          ]
        },
        condition: {
          urlFilter: 'indeed.com',
          resourceTypes: ['xmlhttprequest']
        }
      },
      {
        id: 3,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'origin', operation: 'remove' },
            { header: 'referer', operation: 'set', value: 'https://duckduckgo.com/' }
          ]
        },
        condition: {
          urlFilter: 'duckduckgo.com',
          resourceTypes: ['xmlhttprequest']
        }
      }
    ];

    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [1, 2, 3],
      addRules: rules as any
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('DeclarativeNetRequest rules update failed:', chrome.runtime.lastError.message);
      } else {
        console.log('✈️ DeclarativeNetRequest: Outgoing request headers configured successfully.');
      }
    });
  }
};

// Initialize alarms and header rules on installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('JobPilot: Service Worker initialized.');
  // Create an alarm to check for follow-up reminders every 60 minutes
  chrome.alarms.create('check-followup-reminders', { periodInMinutes: 60 });
  setupHeaderRules();
});

// Configure outgoing headers at worker boot
setupHeaderRules();

// Alarm Listener
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'check-followup-reminders') {
    await checkAndNotifyFollowups();
  }
});

// Check applied jobs that are 7+ days old and warn the user
const checkAndNotifyFollowups = async () => {
  try {
    const jobs = await getCachedJobs();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const job of jobs) {
      if (job.status === 'Applied' && job.created_at) {
        const appliedDate = new Date(job.created_at);
        // If applied date is older than 7 days and we haven't reminded about this job yet
        if (appliedDate <= sevenDaysAgo && !job.notes?.includes('[Reminded]')) {
          showNotification(job);
          break; // Avoid spamming multiple notifications at once
        }
      }
    }
  } catch (error) {
    console.error('Error in background check:', error);
  }
};

const showNotification = (job: any) => {
  chrome.notifications.create(
    `followup-${job.id || Math.random()}`,
    {
      type: 'basic',
      iconUrl: 'assets/icon-128.png', // Fallback or standard path
      title: 'JobPilot: Time to Follow Up?',
      message: `You applied to ${job.role} at ${job.company} 7 days ago. Have you heard back?`,
      priority: 1
    },
    (notificationId) => {
      console.log('Follow-up reminder sent:', notificationId);
    }
  );
};

// Listen for message events (if content scripts need proxy fetching)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'GET_ACTIVE_TAB_URL') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ url: tabs[0]?.url || '' });
    });
    return true; // Keep connection open
  }

  if (message.action === 'FETCH_LINKEDIN_JOB_DETAIL') {
    const { jobId } = message;
    fetch(`https://www.linkedin.com/jobs-guest/jobs/api/jobDetail/${jobId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      })
      .then((html) => {
        sendResponse({ success: true, html });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep connection open for async response
  }

  if (message.action === 'FETCH_URL') {
    const { url } = message;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      })
      .then((html) => {
        sendResponse({ success: true, html });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep connection open for async response
  }

  if (message.action === 'SEARCH_AND_MATCH_JOBS') {
    const { keyword } = message;

    chrome.storage.local.get(['auth_token'], (result) => {
      const token = result.auth_token;
      if (!token) {
        sendResponse({ success: false, error: 'User is not logged in. Please log in first.' });
        return;
      }

      // Query all pluggable providers in parallel
      Promise.all(providers.map(p => p.search(keyword)))
        .then(async (providerResults) => {
          // Flatten results from all platforms
          const rawJobs = providerResults.flat();
          if (rawJobs.length === 0) {
            sendResponse({ success: true, jobs: [] });
            return;
          }

          // Process top 8 jobs in parallel to avoid rate limits
          const jobsToProcess = rawJobs.slice(0, 8);
          const processedJobs = await Promise.all(
            jobsToProcess.map(async (job) => {
              try {
                // Determine backend URL (local or Render hosted fallback)
                let matchRes = await fetch('http://localhost:5001/api/ai/match', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    jobRole: job.role,
                    jobCompany: job.company,
                    jobDescription: job.description || `Software role at ${job.company}`
                  })
                });

                let matchData = { matchPercent: 50, summary: 'AI evaluation skipped.' };
                if (matchRes.ok) {
                  matchData = await matchRes.json();
                } else {
                  // Try hosted API if local dev server is not running
                  const hostedRes = await fetch('https://jobpilot-backend-cjoz.onrender.com/api/ai/match', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                      jobRole: job.role,
                      jobCompany: job.company,
                      jobDescription: job.description || `Software role at ${job.company}`
                    })
                  });
                  if (hostedRes.ok) {
                    matchData = await hostedRes.json();
                  }
                }

                return {
                  ...job,
                  matchPercent: matchData.matchPercent,
                  summary: matchData.summary,
                  missingSkills: (matchData as any).missingSkills || [],
                  matchingSkills: (matchData as any).matchingSkills || [],
                  recommendedLearning: (matchData as any).recommendedLearning || []
                };
              } catch (e: any) {
                console.error('Error matching job in background search:', job.role, e);
                return {
                  ...job,
                  matchPercent: 50,
                  summary: 'Failed to generate AI match profile.',
                  missingSkills: [],
                  matchingSkills: [],
                  recommendedLearning: []
                };
              }
            })
          );

          // Sort jobs by match percent descending
          processedJobs.sort((a, b) => b.matchPercent - a.matchPercent);

          sendResponse({ success: true, jobs: processedJobs });
        })
        .catch((err) => {
          sendResponse({ success: false, error: err.message });
        });
    });
    return true; // Keep connection open for async response
  }
});

export const parseLinkedInSearchHTML = (html: string): any[] => {
  const jobs: any[] = [];
  const cardRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
  let match;

  while ((match = cardRegex.exec(html)) !== null) {
    const cardContent = match[1];

    const linkRegex = /href="([^"]*?currentJobId=(\d+)[^"]*?|[^"]*?\/view\/.*?(\d+)\/?)"/;
    const linkMatch = cardContent.match(linkRegex);
    let jobId = '';
    let applyLink = '';

    if (linkMatch) {
      jobId = linkMatch[2] || linkMatch[3];
      applyLink = linkMatch[1];
      if (applyLink && !applyLink.startsWith('http')) {
        applyLink = `https://www.linkedin.com${applyLink}`;
      }
    }

    if (!jobId) {
      const dataIdMatch = cardContent.match(/data-id="(\d+)"/);
      if (dataIdMatch) jobId = dataIdMatch[1];
    }

    if (!jobId) continue;

    const titleRegex = /<h3[^>]*class="[^"]*?base-search-card__title[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/h3>/;
    const titleMatch = cardContent.match(titleRegex);
    let role = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';

    const companyRegex = /<h4[^>]*class="[^"]*?base-search-card__subtitle[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>|<h4[^>]*class="[^"]*?base-search-card__subtitle[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/h4>/;
    const companyMatch = cardContent.match(companyRegex);
    let company = '';
    if (companyMatch) {
      company = (companyMatch[1] || companyMatch[2]).replace(/<[^>]*>/g, '').trim();
    }

    const locationRegex = /<span[^>]*class="[^"]*?job-search-card__location[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/;
    const locationMatch = cardContent.match(locationRegex);
    let location = locationMatch ? locationMatch[1].replace(/<[^>]*>/g, '').trim() : 'Remote';

    if (role && company) {
      jobs.push({
        jobId,
        role,
        company,
        location,
        apply_link: applyLink || `https://www.linkedin.com/jobs/view/${jobId}/`,
        source: 'LinkedIn'
      });
    }
  }

  return jobs;
};

export const extractLinkedInDescription = (html: string): string => {
  const descRegex = /<div[^>]*class="[^"]*?description__text[^"]*"[^>]*>([\s\S]*?)<\/div>/;
  const match = html.match(descRegex);
  if (match) {
    return match[1].replace(/<[^>]*>/g, '').trim();
  }

  const contentRegex = /<div[^>]*class="[^"]*?show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/;
  const contentMatch = html.match(contentRegex);
  return contentMatch ? contentMatch[1].replace(/<[^>]*>/g, '').trim() : '';
};
