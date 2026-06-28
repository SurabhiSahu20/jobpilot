async function printSingleCardHtml() {
  try {
    const url = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=manager';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    
    const cardRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
    const match = cardRegex.exec(html);
    if (match) {
      console.log('--- LINKEDIN GUEST CARD HTML ---');
      console.log(match[0]);
    } else {
      console.log('No card found');
    }
  } catch (e: any) {
    console.error(e.message);
  }
}

printSingleCardHtml();
