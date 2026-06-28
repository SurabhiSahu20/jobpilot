function isActualJobUrl(link: string, source: 'LinkedIn' | 'Indeed' | 'Naukri' | 'Wellfound'): boolean {
  const url = link.toLowerCase();
  if (source === 'LinkedIn') {
    return url.includes('linkedin.com/jobs/view/') || url.includes('linkedin.com/jobs/search/');
  }
  if (source === 'Indeed') {
    return url.includes('indeed.com/viewjob') || url.includes('indeed.com/rc/clk') || url.includes('vjk=');
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

async function testBingWithCount50() {
  try {
    const query = 'linkedin jobs manager';
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=50`;
    console.log('Testing Bing with count=50:', url);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    console.log('Bing status:', res.status);
    console.log('HTML length:', html.length);
    
    const algoRegex = /<li[^>]*class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
    let match;
    let count = 0;
    while ((match = algoRegex.exec(html)) !== null) {
      const card = match[1];
      const linkMatch = card.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (linkMatch) {
        let rawLink = linkMatch[1].replace(/&amp;/g, '&');
        // Decode Bing link
        let link = rawLink;
        if (rawLink.includes('&u=')) {
          const uMatch = rawLink.match(/[&?]u=([^&]+)/);
          if (uMatch) {
            let encoded = decodeURIComponent(uMatch[1]);
            if (encoded.length > 2) encoded = encoded.slice(2);
            while (encoded.length % 4 !== 0) encoded += '=';
            link = Buffer.from(encoded, 'base64').toString('utf-8');
          }
        }
        
        if (isActualJobUrl(link, 'LinkedIn')) {
          const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();
          console.log(`Matched Job ${count + 1}:`, { title, link });
          count++;
        }
      }
    }
    console.log(`Total valid jobs extracted: ${count}`);
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

testBingWithCount50();
