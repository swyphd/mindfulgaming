const SB_URL = 'https://ektzupeqzwhhseubvdpn.supabase.co/rest/v1/kv_store';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrdHp1cGVxendoaHNldWJ2ZHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MDA1ODgsImV4cCI6MjA5OTI3NjU4OH0.mfeD0Z9Ho--g8asyaK5M6NeQRcRXAzqlqaB5xfHImmU';

async function getFromSupabase(key) {
  const r = await fetch(`${SB_URL}?key=eq.${key}&select=value`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  });
  const d = await r.json();
  return d && d[0] ? JSON.parse(d[0].value) : null;
}

export default async function handler(req, res) {
  // Allow CORS from same origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let tasks, notes, date, recipients;

  if (req.method === 'GET') {
    // Called by Vercel Cron (Monday 10am MT / 17:00 UTC)
    const [current, settingsData] = await Promise.all([
      getFromSupabase('mindful-current-v1'),
      getFromSupabase('mindful-settings-v1')
    ]);
    tasks = (current && current.tasks) || [];
    notes = (current && current.notes) || '';
    date = (current && current.date) || new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const sett = settingsData || {};
    recipients = [sett.email1 || 'jswift8@gmail.com', sett.email2 || 'chad@drchadkelland.com'].filter(Boolean);
  } else if (req.method === 'POST') {
    ({ tasks, notes, date, recipients } = req.body);
    recipients = recipients || ['jswift8@gmail.com', 'chad@drchadkelland.com'];
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const openTasks = (tasks || []).filter(t => !t.done);
  const doneTasks = (tasks || []).filter(t => t.done);

  const taskLines = openTasks.length
    ? openTasks.map(t => `  • ${t.text}`).join('\n')
    : '  (No open tasks)';

  const doneLines = doneTasks.length
    ? doneTasks.map(t => `  ✓ ${t.text}`).join('\n')
    : '';

  const emailText = [
    `Mindful Gaming — Weekly Check-In`,
    `${date}`,
    ``,
    `NOTES`,
    `------`,
    notes || '(No notes recorded)',
    ``,
    `OPEN TASKS`,
    `-----------`,
    taskLines,
    ...(doneLines ? [``, `COMPLETED`, `-----------`, doneLines] : []),
    ``,
    `---`,
    `Mindful Gaming | mindfulgaming.org`,
  ].join('\n');

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:'Georgia',serif;color:#1F2444;background:#EEF1F6;margin:0;padding:0;}
  .wrap{max-width:600px;margin:0 auto;padding:2rem;}
  .card{background:#fff;border-radius:12px;padding:2rem;border:1px solid #C7CEDE;}
  h1{font-size:1.4rem;margin:0 0 0.3rem;font-family:sans-serif;}
  .sub{color:#5C8973;font-size:0.8rem;font-family:monospace;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 1.5rem;}
  h2{font-size:0.9rem;font-family:monospace;text-transform:uppercase;letter-spacing:0.06em;color:#4A5072;border-bottom:1px solid #C7CEDE;padding-bottom:0.4rem;margin:1.5rem 0 0.8rem;}
  .notes{background:#EEF1F6;border-radius:8px;padding:1rem;font-size:0.95rem;white-space:pre-wrap;line-height:1.55;}
  .task{display:flex;align-items:baseline;gap:0.5rem;padding:0.35rem 0;border-bottom:1px solid #EEF1F6;font-size:0.95rem;}
  .bullet{color:#D97F2E;font-weight:bold;}
  .check{color:#5C8973;font-weight:bold;}
  .done{text-decoration:line-through;opacity:0.55;}
  .footer{text-align:center;font-size:0.75rem;font-family:monospace;color:#4A5072;margin-top:2rem;}
  a{color:#5C8973;}
</style></head>
<body><div class="wrap">
  <div class="card">
    <h1>Mindful Gaming — Weekly Check-In</h1>
    <p class="sub">${escHtml(date)}</p>

    <h2>Notes</h2>
    <div class="notes">${escHtml(notes || '(No notes recorded)')}</div>

    <h2>Open Tasks</h2>
    ${openTasks.length
      ? openTasks.map(t => `<div class="task"><span class="bullet">•</span> ${escHtml(t.text)}</div>`).join('')
      : '<div class="task" style="opacity:0.55">(No open tasks)</div>'
    }

    ${doneTasks.length ? `
    <h2>Completed</h2>
    ${doneTasks.map(t => `<div class="task"><span class="check">✓</span> <span class="done">${escHtml(t.text)}</span></div>`).join('')}
    ` : ''}
  </div>
  <div class="footer"><a href="https://mindfulgaming.org/checkin.html">Open Check-In Tool</a></div>
</div></body></html>`;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'checkin@mindfulgaming.org',
        to: recipients,
        subject: `Mindful Gaming Check-In — ${date}`,
        text: emailText,
        html: emailHtml,
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Resend error:', data);
      return res.status(response.status).json(data);
    }
    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error('Send error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
