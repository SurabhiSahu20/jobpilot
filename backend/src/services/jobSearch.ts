import { GoogleGenerativeAI } from '@google/generative-ai';

export interface RawSearchResult {
  jobId: string;
  role: string;
  company: string;
  location: string;
  salary: string;
  experience: string;
  skills: string[];
  description: string;
  apply_link: string;
  source: 'LinkedIn' | 'Indeed' | 'Naukri' | 'Wellfound';
}

export interface JobSearchProvider {
  name: string;
  search(keyword: string): Promise<RawSearchResult[]>;
}

// Shared cache variables to fetch Remotive fallback jobs once and partition them across providers
let remotivePromise: Promise<any[]> | null = null;
let currentCacheKeyword = '';
let cachedJobsList: any[] = [];

async function getRemotiveJobs(keyword: string): Promise<any[]> {
  if (currentCacheKeyword === keyword && cachedJobsList.length > 0) {
    return cachedJobsList;
  }
  
  if (remotivePromise && currentCacheKeyword === keyword) {
    return remotivePromise;
  }
  
  currentCacheKeyword = keyword;
  remotivePromise = (async () => {
    try {
      const url = `https://remotive.com/api/remote-jobs?limit=50&search=${encodeURIComponent(keyword)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Remotive fetch failed');
      const data = await res.json() as any;
      if (data.jobs && Array.isArray(data.jobs)) {
        const words = keyword.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
        
        const scored = data.jobs.map((item: any) => {
          const titleLower = item.title.toLowerCase();
          let score = 0;
          for (const word of words) {
            if (titleLower.includes(word)) {
              score += 1;
            }
          }
          return { item, score };
        });
        
        const filtered = scored
          .filter((entry: any) => entry.score > 0)
          .sort((a: any, b: any) => b.score - a.score)
          .map((entry: any) => entry.item);
          
        cachedJobsList = filtered;
        return filtered;
      }
      cachedJobsList = [];
      return [];
    } catch (e) {
      console.error('Error fetching Remotive fallback:', e);
      cachedJobsList = [];
      return [];
    }
  })();
  
  return remotivePromise;
}

async function getPartitionedJobs(keyword: string, source: 'LinkedIn' | 'Indeed' | 'Naukri' | 'Wellfound'): Promise<RawSearchResult[]> {
  const allJobs = await getRemotiveJobs(keyword);
  const results: RawSearchResult[] = [];
  
  let offset = 0;
  if (source === 'Indeed') offset = 1;
  else if (source === 'Naukri') offset = 2;
  else if (source === 'Wellfound') offset = 3;
  
  let count = 0;
  for (let i = offset; i < allJobs.length && count < 3; i += 4) {
    const item = allJobs[i];
    const skills: string[] = ['Software Engineering'];
    if (item.tags) {
      skills.push(...item.tags);
    }
    const description = (item.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    results.push({
      jobId: `remotive-${source.toLowerCase()}-${item.id}`,
      role: item.title,
      company: item.company_name,
      location: item.candidate_required_location || 'Remote',
      salary: item.salary || 'Not Specified',
      experience: 'Not Specified',
      skills: skills.slice(0, 5),
      description: description.slice(0, 500) + '...',
      apply_link: item.url,
      source
    });
    count++;
  }
  
  return results;
}

function decodeBingLink(bingLink: string): string {
  try {
    if (bingLink.includes('&u=')) {
      const uMatch = bingLink.match(/[&?]u=([^&]+)/);
      if (uMatch) {
        let encoded = decodeURIComponent(uMatch[1]);
        if (encoded.length > 2) {
          encoded = encoded.slice(2);
        }
        while (encoded.length % 4 !== 0) {
          encoded += '=';
        }
        return Buffer.from(encoded, 'base64').toString('utf-8');
      }
    }
  } catch (e) {
    console.error('Failed to decode Bing link:', e);
  }
  return bingLink;
}

function isActualJobUrl(link: string, source: 'LinkedIn' | 'Indeed' | 'Naukri' | 'Wellfound'): boolean {
  const url = link.toLowerCase();
  
  if (source === 'LinkedIn') {
    return url.includes('linkedin.com/jobs/view/') || url.includes('linkedin.com/jobs/search/');
  }
  if (source === 'Indeed') {
    return url.includes('indeed.com/viewjob') || url.includes('indeed.com/rc/clk');
  }
  if (source === 'Naukri') {
    return url.includes('naukri.com/job-listings');
  }
  if (source === 'Wellfound') {
    if (url.endsWith('wellfound.com/jobs') || url.endsWith('wellfound.com/jobs/')) {
      return false;
    }
    return url.includes('wellfound.com/jobs/') || url.includes('wellfound.com/company/');
  }
  return false;
}

async function searchViaBing(keyword: string, source: 'LinkedIn' | 'Indeed' | 'Naukri' | 'Wellfound'): Promise<RawSearchResult[]> {
  try {
    const query = `${source.toLowerCase()} jobs ${keyword}`;
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!res.ok) throw new Error(`Bing query status ${res.status}`);
    const html = await res.text();
    
    const results: RawSearchResult[] = [];
    const algoRegex = /<li[^>]*class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
    let match;
    let count = 0;
    
    while ((match = algoRegex.exec(html)) !== null) {
      if (count >= 3) break;
      
      const card = match[1];
      const linkMatch = card.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (linkMatch) {
        let rawLink = linkMatch[1].replace(/&amp;/g, '&');
        const link = decodeBingLink(rawLink);
        
        const isMatchingDomain = link.includes(source.toLowerCase()) || 
                                 (source === 'Naukri' && link.includes('naukri.com')) || 
                                 (source === 'Wellfound' && (link.includes('wellfound.com') || link.includes('angel.co')));
                                 
        if (!isMatchingDomain) continue;
        if (!isActualJobUrl(link, source)) continue;
        
        const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();
        
        let role = title;
        let company = source.toString();
        
        if (title.includes(' at ')) {
          const parts = title.split(' at ');
          role = parts[0].trim();
          company = parts[1].split(' - ')[0].split(' | ')[0].split(' : ')[0].trim();
        } else if (title.includes(' - ')) {
          const parts = title.split(' - ');
          role = parts[0].trim();
          if (parts[1]) {
            company = parts[1].split(' | ')[0].split(' : ')[0].trim();
          }
        } else if (title.includes(' | ')) {
          const parts = title.split(' | ');
          role = parts[0].trim();
          if (parts[1]) {
            company = parts[1].trim();
          }
        }
        
        role = role.replace(/Job in.*/i, '').replace(/Careers.*/i, '').trim();
        company = company.replace(/Careers.*/i, '').replace(/Job.*/i, '').trim();
        
        results.push({
          jobId: `${source.toLowerCase()}-${Math.floor(Math.random() * 100000)}`,
          role,
          company,
          location: 'Remote',
          salary: 'Not Specified',
          experience: 'Not Specified',
          skills: ['Software Engineering'],
          description: `Active job opening: ${role} at ${company}. View full details and apply directly.`,
          apply_link: link,
          source
        });
        count++;
      }
    }
    return results;
  } catch (error) {
    console.warn(`Bing search fallback for ${source} failed:`, error);
    return [];
  }
}

export class LinkedInProvider implements JobSearchProvider {
  name = 'LinkedIn';

  async search(keyword: string): Promise<RawSearchResult[]> {
    try {
      const searchUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keyword)}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const html = await res.text();
      
      const jobs: RawSearchResult[] = [];
      const cardRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
      let match;
      let count = 0;

      while ((match = cardRegex.exec(html)) !== null && count < 3) {
        const cardContent = match[1];
        const linkMatch = cardContent.match(/href="([^"]*?currentJobId=(\d+)[^"]*?|[^"]*?\/view\/.*?(\d+)\/?)"/);
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
        const role = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';

        const companyRegex = /<h4[^>]*class="[^"]*?base-search-card__subtitle[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>|<h4[^>]*class="[^"]*?base-search-card__subtitle[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/h4>/;
        const companyMatch = cardContent.match(companyRegex);
        let company = '';
        if (companyMatch) {
          company = (companyMatch[1] || companyMatch[2]).replace(/<[^>]*>/g, '').trim();
        }

        const locationRegex = /<span[^>]*class="[^"]*?job-search-card__location[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/;
        const locationMatch = cardContent.match(locationRegex);
        const location = locationMatch ? locationMatch[1].replace(/<[^>]*>/g, '').trim() : 'Remote';

        if (role && company) {
          let description = `Position at ${company}.`;
          try {
            const descRes = await fetch(`https://www.linkedin.com/jobs-guest/jobs/api/jobDetail/${jobId}`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
              }
            });
            if (descRes.ok) {
              const descHtml = await descRes.text();
              const descRegex = /<div[^>]*class="[^"]*?description__text[^"]*"[^>]*>([\s\S]*?)<\/div>/;
              const dMatch = descHtml.match(descRegex);
              if (dMatch) {
                description = dMatch[1].replace(/<[^>]*>/g, '').trim();
              } else {
                const altMatch = descHtml.match(/<div[^>]*class="[^"]*?show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/);
                if (altMatch) description = altMatch[1].replace(/<[^>]*>/g, '').trim();
              }
            }
          } catch (e) {
            console.error('LinkedIn detail fetch failed:', e);
          }

          jobs.push({
            jobId,
            role,
            company,
            location,
            salary: 'Not Specified',
            experience: 'Not Specified',
            skills: ['React', 'TypeScript', 'Node.js'],
            description,
            apply_link: applyLink || `https://www.linkedin.com/jobs/view/${jobId}/`,
            source: 'LinkedIn'
          });
          count++;
        }
      }
      if (jobs.length > 0) return jobs;
      
      const bingResults = await searchViaBing(keyword, 'LinkedIn');
      if (bingResults.length > 0) return bingResults;

      return await getPartitionedJobs(keyword, 'LinkedIn');
    } catch (error) {
      console.warn('LinkedIn search provider failed. Using search engine fallback.', error);
      const bingResults = await searchViaBing(keyword, 'LinkedIn');
      if (bingResults.length > 0) return bingResults;
      return await getPartitionedJobs(keyword, 'LinkedIn');
    }
  }
}

export class IndeedProvider implements JobSearchProvider {
  name = 'Indeed';

  async search(keyword: string): Promise<RawSearchResult[]> {
    try {
      const formattedKeyword = encodeURIComponent(keyword);
      const url = `https://www.indeed.com/jobs?q=${formattedKeyword}&l=`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const html = await response.text();
      
      const jobs: RawSearchResult[] = [];
      const matchJobBeacons = html.match(/<div[^>]*class="[^"]*?job_seen_beacon[^"]*"[^>]*>([\s\S]*?)<\/div>/g) || [];
      
      for (const card of matchJobBeacons.slice(0, 3)) {
        const titleMatch = card.match(/class="jobTitle[^"]*"[^>]*>([\s\S]*?)<\/h2>/);
        const role = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';

        const companyMatch = card.match(/data-testid="company-name"[^>]*>([\s\S]*?)<\/span>/);
        const company = companyMatch ? companyMatch[1].replace(/<[^>]*>/g, '').trim() : '';

        const locMatch = card.match(/data-testid="text-location"[^>]*>([\s\S]*?)<\/div>/);
        const location = locMatch ? locMatch[1].replace(/<[^>]*>/g, '').trim() : 'Remote';

        const jobIdMatch = card.match(/data-jk="([^"]+)"/);
        const jobId = jobIdMatch ? jobIdMatch[1] : Math.random().toString();

        if (role && company) {
          jobs.push({
            jobId,
            role,
            company,
            location,
            salary: 'Not Specified',
            experience: 'Not Specified',
            skills: ['Software Engineering'],
            description: `A stellar ${role} opportunity at ${company} located in ${location}.`,
            apply_link: `https://www.indeed.com/viewjob?jk=${jobId}`,
            source: 'Indeed'
          });
        }
      }

      if (jobs.length > 0) return jobs;
      throw new Error('No jobs parsed from Indeed page.');
    } catch (error) {
      console.log('Indeed Provider: Scrape blocked. Utilizing search engine parser.');
      const bingResults = await searchViaBing(keyword, 'Indeed');
      if (bingResults.length > 0) return bingResults;
      return await getPartitionedJobs(keyword, 'Indeed');
    }
  }
}

export class NaukriProvider implements JobSearchProvider {
  name = 'Naukri';

  async search(keyword: string): Promise<RawSearchResult[]> {
    const results = await searchViaBing(keyword, 'Naukri');
    if (results.length > 0) return results;
    return await getPartitionedJobs(keyword, 'Naukri');
  }
}

export class WellfoundProvider implements JobSearchProvider {
  name = 'Wellfound';

  async search(keyword: string): Promise<RawSearchResult[]> {
    const results = await searchViaBing(keyword, 'Wellfound');
    if (results.length > 0) return results;
    return await getPartitionedJobs(keyword, 'Wellfound');
  }
}

const providers: JobSearchProvider[] = [
  new LinkedInProvider(),
  new IndeedProvider(),
  new NaukriProvider(),
  new WellfoundProvider()
];

export async function searchAllPlatforms(keyword: string): Promise<RawSearchResult[]> {
  const results = await Promise.all(providers.map(p => p.search(keyword).catch(e => {
    console.error(`Search failed for provider ${p.name}:`, e);
    return [];
  })));
  return results.flat();
}
