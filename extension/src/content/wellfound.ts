export const scrapeWellfound = (): any => {
  try {
    const roleEl = document.querySelector('h1.job-title, .job-title, h1');
    const role = roleEl ? roleEl.textContent?.trim() : '';

    // Wellfound often combines company name in title or navigation
    const companyEl = document.querySelector('.company-name, h2.company, h2 a');
    const company = companyEl ? companyEl.textContent?.trim() : '';

    const locationEl = document.querySelector('.job-location, .location, .loc');
    const location = locationEl ? locationEl.textContent?.trim() : '';

    const descEl = document.querySelector('.job-description, .description, .jobDescription');
    const description = descEl ? descEl.textContent?.trim() : '';

    const salaryEl = document.querySelector('.salary-range, .salary');
    const salary = salaryEl ? salaryEl.textContent?.trim() : '';

    const skills: string[] = [];
    const skillTags = document.querySelectorAll('.skill-tag, .tag, .skills span');
    skillTags.forEach(tag => {
      const txt = tag.textContent?.trim();
      if (txt && !skills.includes(txt)) {
        skills.push(txt);
      }
    });

    const apply_link = window.location.href;

    if (!role) {
      return null;
    }

    return {
      company: company || 'Company',
      role,
      location: location || 'Remote',
      salary: salary || 'Not Specified',
      experience: 'Not Specified',
      skills: skills.length > 0 ? skills.slice(0, 8) : [],
      description: description || '',
      apply_link,
      status: 'Wishlist',
      notes: ''
    };
  } catch (error) {
    console.error('Wellfound Scraper error:', error);
    return null;
  }
};

export const scrapeWellfoundSearchResults = (): any[] => {
  try {
    const jobs: any[] = [];
    const cards = document.querySelectorAll('[data-test="JobResultCard"], [class*="jobCard"], [class*="JobCard"]');
    
    cards.forEach(card => {
      const titleEl = card.querySelector('[class*="title"], [class*="jobTitle"], a[href*="/jobs/"]');
      const role = titleEl ? titleEl.textContent?.trim() : '';
      let apply_link = titleEl ? (titleEl.getAttribute('href') || '') : '';
      if (apply_link && !apply_link.startsWith('http')) {
        apply_link = `https://wellfound.com${apply_link}`;
      }

      const companyEl = card.querySelector('[class*="companyName"], [class*="startupName"], [class*="name"]');
      const company = companyEl ? companyEl.textContent?.trim() : '';

      const locationEl = card.querySelector('[class*="location"], [class*="tag"]');
      const location = locationEl ? locationEl.textContent?.trim() : '';

      const salaryEl = card.querySelector('[class*="salary"]');
      const salary = salaryEl ? salaryEl.textContent?.trim() : '';

      if (role && company && apply_link) {
        jobs.push({
          role,
          company,
          location: location || 'Remote',
          salary: salary || 'Not Specified',
          apply_link,
          source: 'Wellfound'
        });
      }
    });

    return jobs;
  } catch (error) {
    console.error('Wellfound list scraper error:', error);
    return [];
  }
};
