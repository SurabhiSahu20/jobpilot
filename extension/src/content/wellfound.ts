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
