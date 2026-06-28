import { searchAllPlatforms } from './services/jobSearch.js';

async function diagnose() {
  console.log('--- STARTING BING DIAGNOSTIC SEARCH ---');
  try {
    const keyword = 'manager';
    console.log(`Running searchAllPlatforms for keyword: "${keyword}"`);
    const results = await searchAllPlatforms(keyword);
    console.log(`Search completed. Found ${results.length} total results.`);
    
    const platforms = ['LinkedIn', 'Indeed', 'Naukri', 'Wellfound'];
    for (const platform of platforms) {
      const platformJobs = results.filter(j => j.source === platform);
      console.log(`\nPlatform: ${platform} (${platformJobs.length} jobs found)`);
      platformJobs.forEach((job, idx) => {
        console.log(`  [Job ${idx + 1}] Title: "${job.role}", Company: "${job.company}", Link: ${job.apply_link}`);
      });
    }
  } catch (e: any) {
    console.error('Diagnostic error:', e.message);
  }
}

diagnose();
