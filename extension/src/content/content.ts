import { scrapeLinkedIn } from './linkedin.js';
import { scrapeNaukri } from './naukri.js';
import { scrapeWellfound } from './wellfound.js';

let lastUrl = window.location.href;

const runScraper = (): any => {
  const host = window.location.host;
  
  if (host.includes('linkedin.com')) {
    return scrapeLinkedIn();
  } else if (host.includes('naukri.com')) {
    return scrapeNaukri();
  } else if (host.includes('wellfound.com')) {
    return scrapeWellfound();
  }
  return null;
};

// Update storage with currently detected job details
const updateDetectedJobInStorage = () => {
  const job = runScraper();
  if (job) {
    console.log('JobPilot: Detected Job details:', job.role, 'at', job.company);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ detected_job: job });
    }
  } else {
    // Clear detected job if we are no longer on a job details page
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove('detected_job');
    }
  }
};

// Listen for messages from popup or background
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'SCRAPE_JOB') {
      const job = runScraper();
      sendResponse({ job });
    }
    return true; // Keep message channel open for async response
  });
}

// Initial run
updateDetectedJobInStorage();

// Monitor SPA navigation / DOM changes (LinkedIn job-clicking is dynamic)
const observer = new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    setTimeout(updateDetectedJobInStorage, 1000); // Wait for DOM to paint
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Backup check for item changes inside the DOM (e.g. clicking different job cards)
setInterval(() => {
  const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1');
  const roleText = titleEl ? titleEl.textContent?.trim() : '';
  
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['detected_job'], (res) => {
      const cached = res.detected_job;
      if (roleText && (!cached || cached.role !== roleText)) {
        updateDetectedJobInStorage();
      }
    });
  }
}, 2000);
