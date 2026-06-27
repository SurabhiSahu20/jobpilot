async function testLinkedIn() {
  try {
    const url = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=react';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    console.log('LinkedIn status:', res.status);
    const html = await res.text();
    console.log('LinkedIn HTML length:', html.length);
    const cardRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
    let match;
    let count = 0;
    while ((match = cardRegex.exec(html)) !== null && count < 3) {
      count++;
    }
    console.log('LinkedIn jobs parsed:', count);
  } catch (e: any) {
    console.error('LinkedIn error:', e.message);
  }
}

async function testIndeed() {
  try {
    const url = 'https://www.indeed.com/jobs?q=react&l=';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    console.log('Indeed status:', res.status);
    const html = await res.text();
    console.log('Indeed HTML length:', html.length);
    const matches = html.match(/job_seen_beacon/g) || [];
    console.log('Indeed jobs parsed:', matches.length);
  } catch (e: any) {
    console.error('Indeed error:', e.message);
  }
}

const run = async () => {
  await testLinkedIn();
  await testIndeed();
};
run();
