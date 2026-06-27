async function testIndeedRss() {
  try {
    const url = 'https://www.indeed.com/rss?q=software+engineer';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Length:', text.length);
    console.log('Content Snippet:', text.slice(0, 1000));
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}
testIndeedRss();
