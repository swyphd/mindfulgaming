export default async function handler(req, res) {
  const SB_URL = 'https://ektzupeqzwhhseubvdpn.supabase.co/rest/v1/kv_store';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrdHp1cGVxendoaHNldWJ2ZHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MDA1ODgsImV4cCI6MjA5OTI3NjU4OH0.mfeD0Z9Ho--g8asyaK5M6NeQRcRXAzqlqaB5xfHImmU';
  const SB_HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

  // Handle Vercel Cron GET: load data from Supabase and send automatically
  if (req.method === 'GET') {
    const [currentRes, settingsRes] = await Promise.all([
      fetch(`${SB_URL}?key=eq.mindful-current-v1&select=value`, { headers: SB_HEADERS }),
      fetch(`${SB_URL}?key=eq.mindful-settings-v1&select=value`, { headers: SB_HEADERS }),
    ]);
    const [currentData, settingsData] = await Promise.all([
      currentRes.json(),
      settingsRes.json(),
    ]);
    const current = currentData[0]
      ? JSON.parse(currentData[0].value)
      : { tasks: [], notes: '', date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) };
    const settings = settingsData[0]
      ? JSON.parse(settingsData[0].value)
      : { recipients: ['jswift8@gmail.com', 'chad@drchadkelland.com'] };

    req.method = 'POST';
    req.body = { ...current, recipients: settings.recipients };
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { tasks = [], notes = '', date = new Date().toLocaleDateString(), recipients } = req.body;

  const openTasks = tasks.filter(t => !t.done);
  const doneTasks = tasks.filter(t => t.done);

  const taskLines = tasks.length
    ? [
        openTasks.length ? `Open (${openTasks.length}):\n` + openTasks.map(t => `  • ${t.text}`).join('\n') : '',
        doneTasks.length ? `\nCompleted (${doneTasks.length}):\n` + doneTasks.map(t => `  ✓ ${t.text}`).join('\n') : '',
      ].filter(Boolean).join('\n')
    : 'No tasks this week.';

  const emailBody = [
    `Mindful Gaming Weekly Check-In`,
    `Date: ${date}`,
    ``,
    `── MEETING NOTES ──────────────────────────`,
    notes || '(no notes)',
    ``,
    `── ACTION ITEMS ───────────────────────────`,
    taskLines,
    ``,
    `──────────────────────────────────────────`,
    `Sent from mindfulgaming.org/checkin.html`,
  ].join('\n');

  const toList = recipients || ['jswift8@gmail.com', 'chad@drchadkelland.com'];

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY environment variable is not set.' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'checkin@mindfulgaming.org',
        to: toList,
        subject: `Mindful Gaming Check-In: ${date}`,
        text: emailBody,
      }),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
