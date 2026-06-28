async function testIndeedRss() {
  try {
    const url = 'https://www.indeed.com/rss?q=manager';
    console.log('Testing Indeed US RSS feed:', url);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('Indeed RSS status:', res.status);
    const text = await res.text();
    console.log('Indeed RSS length:', text.length);
    console.log('Indeed RSS snippet:', text.slice(0, 1000));
  } catch (e: any) {
    console.error('Indeed RSS error:', e.message);
  }
}

async function testIndeedIndiaRss() {
  try {
    const url = 'https://in.indeed.com/rss?q=manager';
    console.log('Testing Indeed India RSS feed:', url);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('Indeed India RSS status:', res.status);
    const text = await res.text();
    console.log('Indeed India RSS length:', text.length);
    console.log('Indeed India RSS snippet:', text.slice(0, 1000));
  } catch (e: any) {
    console.error('Indeed India RSS error:', e.message);
  }
}

const run = async () => {
  await testIndeedRss();
  await testIndeedIndiaRss();
};
run();
