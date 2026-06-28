export const scrapeIndeed = (): any => {
  try {
    const roleEl = document.querySelector('.jobsearch-JobInfoHeader-title, h1.jobsearch-JobInfoHeader-title, h1');
    const role = roleEl ? roleEl.textContent?.trim() : '';

    const companyEl = document.querySelector(
      '[data-company-name="true"] a, .jobsearch-InlineCompanyRating div a, .jobsearch-CompanyInfoContainer a, .jobsearch-JobInfoHeader-companyName, [data-testid="inline-header-companyname"] a'
    ) || document.querySelector('[data-testid="inline-header-companyname"]');
    const company = companyEl ? companyEl.textContent?.trim() : '';

    const locationEl = document.querySelector('[data-testid="inline-header-companylocation"], .jobsearch-JobInfoHeader-companyLocation, .companyLocation');
    const location = locationEl ? locationEl.textContent?.trim() : '';

    const salaryEl = document.querySelector('#salaryInfoAndJobType, .salary-snippet-container, .jobsearch-JobMetadataHeader-item');
    const salary = salaryEl ? salaryEl.textContent?.trim() : '';

    const descEl = document.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText');
    const description = descEl ? descEl.textContent?.trim() : '';

    const expEl = document.querySelector('#jobDetailsSection, .jobsearch-JobDescriptionSection-sectionItem');
    const experience = expEl ? expEl.textContent?.trim() : '';

    const skills: string[] = [];
    const textToSearch = (role + ' ' + description).toLowerCase();
    const techWords = [
      'react', 'angular', 'vue', 'typescript', 'javascript', 'node', 'express', 
      'python', 'django', 'java', 'spring', 'go', 'golang', 'rust', 'c++', 'c#', 
      'postgres', 'mysql', 'mongodb', 'redis', 'docker', 'kubernetes', 'aws', 
      'gcp', 'kafka', 'git', 'ci/cd', 'graphql', 'next.js', 'tailwind'
    ];
    for (const tech of techWords) {
      const regex = new RegExp(`\\b${tech.replace(/[\.\+]/g, '\\$&')}\\b`, 'i');
      if (regex.test(textToSearch)) {
        const prettyName = tech === 'js' || tech === 'git' || tech === 'aws' || tech === 'gcp'
          ? tech.toUpperCase()
          : tech.charAt(0).toUpperCase() + tech.slice(1);
        skills.push(prettyName);
      }
    }

    const apply_link = window.location.href;

    if (!role || !company) {
      return null;
    }

    return {
      company,
      role,
      location: location || 'Remote',
      salary: salary || 'Not Specified',
      experience: experience || 'Not Specified',
      skills: skills.slice(0, 8),
      description: description || '',
      apply_link,
      status: 'Wishlist',
      notes: ''
    };
  } catch (error) {
    console.error('Indeed Scraper error:', error);
    return null;
  }
};

export const scrapeIndeedSearchResults = (): any[] => {
  try {
    const jobs: any[] = [];
    const cards = document.querySelectorAll(
      '.job_seen_beacon, td.resultContent, div.jobsearch-SerpJobCard, [class*="job_seen_beacon"], [class*="resultContent"]'
    );
    
    cards.forEach(card => {
      const titleEl = card.querySelector('h2.jobTitle a, a.jcs-JobDetails, a[href*="/rc/clk"], a[href*="/viewjob"]');
      const role = titleEl ? titleEl.textContent?.trim() : '';
      let apply_link = titleEl ? (titleEl.getAttribute('href') || '') : '';
      if (apply_link && !apply_link.startsWith('http')) {
        apply_link = `https://www.indeed.com${apply_link}`;
      }

      const companyEl = card.querySelector(
        '[data-testid="company-name"], .companyName, .company_location .companyName, [class*="companyName"]'
      );
      const company = companyEl ? companyEl.textContent?.trim() : '';

      const locationEl = card.querySelector(
        '[data-testid="text-location"], .companyLocation, .location, [class*="companyLocation"]'
      );
      const location = locationEl ? locationEl.textContent?.trim() : '';

      const salaryEl = card.querySelector(
        '[data-testid="attribute_snippet-html"], .salary-snippet-container, .metadata.salary-snippet-container, [class*="salary-snippet"]'
      );
      const salary = salaryEl ? salaryEl.textContent?.trim() : '';

      let jobId = '';
      const jkMatch = apply_link.match(/jk=([^&]+)/) || apply_link.match(/\/rc\/clk\?jk=([^&]+)/);
      if (jkMatch) {
        jobId = jkMatch[1];
      } else {
        const idAttr = card.closest('[data-jk]')?.getAttribute('data-jk') || card.getAttribute('data-jk');
        if (idAttr) jobId = idAttr;
      }

      if (role && company && apply_link) {
        jobs.push({
          jobId: jobId || Math.random().toString(),
          role: role.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
          company: company.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
          location: location || 'Remote',
          salary: salary || 'Not Specified',
          apply_link,
          source: 'Indeed'
        });
      }
    });

    // Fallback: search DOM globally for any viewjob / rc/clk links if no cards matched
    if (jobs.length === 0) {
      const links = document.querySelectorAll('a[href*="/viewjob"], a[href*="/rc/clk"]');
      links.forEach(link => {
        let apply_link = link.getAttribute('href') || '';
        if (apply_link && !apply_link.startsWith('http')) {
          apply_link = `https://www.indeed.com${apply_link}`;
        }
        
        const jkMatch = apply_link.match(/jk=([^&]+)/) || apply_link.match(/\/rc\/clk\?jk=([^&]+)/);
        const jobId = jkMatch ? jkMatch[1] : Math.random().toString();
        
        const cardParent = link.closest('li, div[class*="job"], div[class*="result"]');
        if (cardParent) {
          const role = link.textContent?.trim() || 'Software Role';
          const companyEl = cardParent.querySelector('[data-testid="company-name"], .companyName, [class*="companyName"]');
          const company = companyEl ? companyEl.textContent?.trim() : 'Indeed Employer';
          
          const locationEl = cardParent.querySelector('[data-testid="text-location"], .companyLocation, [class*="location"]');
          const location = locationEl ? locationEl.textContent?.trim() : 'Remote';
          
          if (role && company && !jobs.some(j => j.jobId === jobId)) {
            jobs.push({
              jobId,
              role: role.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
              company: company.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
              location: location || 'Remote',
              salary: 'Not Specified',
              apply_link,
              source: 'Indeed'
            });
          }
        }
      });
    }

    return jobs;
  } catch (error) {
    console.error('Indeed list scraper error:', error);
    return [];
  }
};
