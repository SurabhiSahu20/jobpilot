async function testNaukriApi() {
  try {
    const url = 'https://www.naukri.com/jobapi/v3/search?noOfResults=5&searchType=adv&key=react';
    const res = await fetch(url, {
      headers: {
        'appid': '135',
        'systemid': '135',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    console.log('Naukri API status:', res.status);
    const text = await res.text();
    console.log('Naukri API response length:', text.length);
    console.log('Naukri API snippet:', text.slice(0, 500));
  } catch (e: any) {
    console.error('Naukri API error:', e.message);
  }
}

async function testLinkedIn() {
  try {
    const url = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=react';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    });
    console.log('LinkedIn status:', res.status);
  } catch (e: any) {
    console.error('LinkedIn error:', e.message);
  }
}

const run = async () => {
  await testNaukriApi();
  await testLinkedIn();
};
run();
