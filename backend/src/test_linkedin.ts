async function testBingParser() {
  try {
    const url = 'https://www.bing.com/search?q=linkedin+jobs+manager';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    console.log('Bing HTML Status:', res.status);
    
    const algoRegex = /<li[^>]*class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
    let match;
    let count = 0;
    
    while ((match = algoRegex.exec(html)) !== null && count < 10) {
      const card = match[1];
      // Support h2 tags with classes or attributes
      const linkMatch = card.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (linkMatch) {
        const link = linkMatch[1].replace(/&amp;/g, '&');
        const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();
        console.log(`Match ${count + 1}:`, { title, link });
        count++;
      }
    }
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

testBingParser();
