export const scrapeNaukri = (): any => {
  try {
    const roleEl = document.querySelector('.jd-header-title, h1.title, .job-title');
    const role = roleEl ? roleEl.textContent?.trim() : '';

    const companyEl = document.querySelector('.jd-header-comp-name a, .company-name, .companyName');
    const company = companyEl ? companyEl.textContent?.trim() : '';

    const locationEl = document.querySelector('.location a, .location span, .loc span');
    const location = locationEl ? locationEl.textContent?.trim() : '';

    const salaryEl = document.querySelector('.salary span, .salary-info, .salary');
    const salary = salaryEl ? salaryEl.textContent?.trim() : '';

    const expEl = document.querySelector('.exp span, .experience span, .exp');
    const experience = expEl ? expEl.textContent?.trim() : '';

    const descEl = document.querySelector('.job-desc, .job-description, #job-description');
    const description = descEl ? descEl.textContent?.trim() : '';

    const skills: string[] = [];
    const skillTags = document.querySelectorAll('.key-skill a, .key-skills span, .skills-list span');
    skillTags.forEach(tag => {
      const txt = tag.textContent?.trim();
      if (txt && !skills.includes(txt)) {
        skills.push(txt);
      }
    });

    const apply_link = window.location.href;

    if (!role || !company) {
      return null;
    }

    return {
      company,
      role,
      location: location || 'Not Specified',
      salary: salary || 'Not Specified',
      experience: experience || 'Not Specified',
      skills: skills.length > 0 ? skills.slice(0, 8) : ['Software Development'],
      description: description || '',
      apply_link,
      status: 'Wishlist',
      notes: ''
    };
  } catch (error) {
    console.error('Naukri Scraper error:', error);
    return null;
  }
};
