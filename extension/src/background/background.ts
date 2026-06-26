import { getCachedJobs } from '../services/indexeddb.js';

// Initialize alarms on installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('JobPilot: Service Worker initialized.');
  // Create an alarm to check for follow-up reminders every 60 minutes
  chrome.alarms.create('check-followup-reminders', { periodInMinutes: 60 });
});

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
});
