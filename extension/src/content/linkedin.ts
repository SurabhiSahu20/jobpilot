export const scrapeLinkedIn = (): any => {
  try {
    // 1. Role Title
    const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1');
    const role = titleEl ? titleEl.textContent?.trim() : '';

    // 2. Company Name
    const companyEl = document.querySelector(
      '.job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name a'
    );
    const company = companyEl ? companyEl.textContent?.trim() : '';

    // 3. Location
    const locationEl = document.querySelector(
      '.job-details-jobs-unified-top-card__primary-description-container span, .jobs-unified-top-card__bullet, .jobs-unified-top-card__primary-description span'
    );
    const location = locationEl ? locationEl.textContent?.trim() : '';

    // 4. Description
    const descEl = document.querySelector('#job-details, .jobs-description__content, .jobs-box__html-content');
    const description = descEl ? descEl.textContent?.trim() : '';

    // 5. Salary, Experience and Skills
    let salary = '';
    let experience = '';
    const skills: string[] = [];

    // Extract other metadata if present
    const metaContainer = document.querySelector('.job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight');
    if (metaContainer) {
      const text = metaContainer.textContent || '';
      if (text.includes('$') || text.includes('₹') || text.toLowerCase().includes('salary')) {
        salary = text.split('·')[0]?.trim() || '';
      }
      if (text.toLowerCase().includes('yr') || text.toLowerCase().includes('experience')) {
        experience = text.split('·')[0]?.trim() || '';
      }
    }

    // Try to guess some skills from description
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
        // Capitalize nicely
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
      location: location?.split('·')[0]?.trim() || '',
      salary: salary || 'Not Specified',
      experience: experience || 'Not Specified',
      skills: skills.slice(0, 8),
      description: description || '',
      apply_link,
      status: 'Wishlist',
      notes: ''
    };
  } catch (error) {
    console.error('LinkedIn Scraper error:', error);
    return null;
  }
};

export const scrapeLinkedInSearchResults = (): any[] => {
  try {
    const jobs: any[] = [];
    const cards = document.querySelectorAll('[data-job-id]');
    
    cards.forEach(card => {
      const jobId = card.getAttribute('data-job-id');
      if (!jobId) return;

      const titleEl = card.querySelector('.job-card-list__title, .job-card-container__link, a.job-card-list__title');
      const role = titleEl ? titleEl.textContent?.trim() : '';

      const companyEl = card.querySelector('.job-card-container__primary-description, .job-card-container__company-name, .job-card-list__company-name, .artdeco-entity-lockup__subtitle');
      const company = companyEl ? companyEl.textContent?.trim() : '';

      const locationEl = card.querySelector('.job-card-container__metadata-item, .job-card-list__metadata-item, .job-card-container__metadata-wrapper span');
      const location = locationEl ? locationEl.textContent?.trim() : '';

      if (role && company) {
        jobs.push({
          jobId,
          role,
          company,
          location: location?.split('·')[0]?.trim() || 'Remote',
          apply_link: `https://www.linkedin.com/jobs/view/${jobId}/`,
          source: 'LinkedIn'
        });
      }
    });

    return jobs;
  } catch (error) {
    console.error('LinkedIn list scraper error:', error);
    return [];
  }
};
