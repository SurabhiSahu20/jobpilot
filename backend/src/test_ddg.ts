async function testRemotive() {
  try {
    const url = 'https://remotive.com/api/remote-jobs?limit=5&search=react';
    const res = await fetch(url);
    console.log('Status:', res.status);
    const data: any = await res.json();
    console.log('Jobs count:', data.jobs ? data.jobs.length : 0);
    if (data.jobs && data.jobs.length > 0) {
      console.log('First job:', {
        title: data.jobs[0].title,
        company: data.jobs[0].company_name,
        url: data.jobs[0].url,
        location: data.jobs[0].candidate_required_location,
        salary: data.jobs[0].salary
      });
    }
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}
testRemotive();
