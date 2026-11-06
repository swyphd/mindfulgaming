// Starter Pack signup: saves the email as a Resend contact and sends the free PDF.
//
// Environment variables (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY       required. Must be a "Full access" key so it can create contacts.
//   RESEND_SEGMENT_ID    optional. Adds each signup to this Resend segment.
//   SIGNUP_NOTIFY_EMAIL  optional. Where new-signup notices go (default jswift8@gmail.com).
//   REPLY_TO_EMAIL       optional. Reply-to on the welcome email (default jeff.swift@me.com).

const SITE = 'https://mindfulgaming.org';
const PDF_URL = `${SITE}/downloads/Mindful_Gaming_Starter_Pack.pdf`;
const JOURNAL_URL = 'https://www.amazon.com/dp/B0HPX4D9VF';
const FROM = 'Jeff Swift <jeff@mindfulgaming.org>';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', SITE);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const email = String(body.email || '').trim().toLowerCase();
  const source = String(body.source || 'unknown').slice(0, 40);
  const ageGroup = String(body.age_group || '').slice(0, 20);

  // Honeypot: bots fill the hidden "website" field. Pretend it worked.
  if (body.website) return res.status(200).json({ ok: true });

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: 'RESEND_API_KEY not configured' });

  // 1. Save the contact. A duplicate or a permissions error must not block the PDF.
  let contactSaved = false;
  try {
    const contact = { email, unsubscribed: false };
    if (process.env.RESEND_SEGMENT_ID) contact.segments = [{ id: process.env.RESEND_SEGMENT_ID }];
    const r = await resend(key, '/contacts', contact);
    contactSaved = r.ok || r.status === 409;
    if (!r.ok && r.status !== 409) console.error('Resend contact error:', r.status, await r.text());
  } catch (err) {
    console.error('Resend contact error:', err.message);
  }

  // 2. Send the Starter Pack.
  try {
    const r = await resend(key, '/emails', {
      from: FROM,
      to: [email],
      reply_to: process.env.REPLY_TO_EMAIL || 'jeff.swift@me.com',
      subject: 'Your free Mindful Gaming Starter Pack',
      text: welcomeText(),
      html: welcomeHtml(),
    });
    if (!r.ok) {
      console.error('Resend email error:', r.status, await r.text());
      return res.status(502).json({ error: 'We couldn’t send the email just now. Please try again.' });
    }
  } catch (err) {
    console.error('Resend email error:', err.message);
    return res.status(502).json({ error: 'We couldn’t send the email just now. Please try again.' });
  }

  // 3. Tell Jeff (also a backup copy of the list in his inbox). Never blocks the response.
  try {
    await resend(key, '/emails', {
      from: 'Mindful Gaming <checkin@mindfulgaming.org>',
      to: [process.env.SIGNUP_NOTIFY_EMAIL || 'jswift8@gmail.com'],
      subject: `New Starter Pack signup: ${email}`,
      text: `Email: ${email}\nSource: ${source}\nAge group: ${ageGroup || 'not given'}\nSaved as Resend contact: ${contactSaved ? 'yes' : 'NO, add by hand'}\nTime: ${new Date().toISOString()}`,
    });
  } catch (err) {
    console.error('Notify error:', err.message);
  }

  return res.status(200).json({ ok: true });
}

function resend(key, path, payload) {
  return fetch(`https://api.resend.com${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}

function welcomeText() {
  return [
    'Hi there,',
    '',
    'Thanks for asking for the Mindful Gaming Starter Pack. Here it is:',
    PDF_URL,
    '',
    'It has the three Mindful Gaming questions, a full journal session you can print as many times as you like, five Side Quests, a session from The Feelings Are Real, and conversation starters for parents.',
    '',
    'If you only try one thing this week, ask your gamer (or yourself) the first question before the next session: "Why am I gaming right now?"',
    '',
    `When you want a page for every session, The Mindful Gaming Journal is on Amazon: ${JOURNAL_URL}`,
    '',
    'I’ll send a short note about twice a month with one question or idea to try. Just reply if you have a question. I read every email.',
    '',
    'Jeff Swift, PhD',
    'mindfulgaming.org',
    '',
    'You’re getting this because you asked for the Starter Pack at mindfulgaming.org. Reply "unsubscribe" and I’ll take you off the list.',
  ].join('\n');
}

function welcomeHtml() {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EEF1F6;font-family:Georgia,serif;color:#1F2444;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border:1px solid #C7CEDE;border-radius:12px;padding:28px;">
      <p style="font-family:monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5C8973;margin:0 0 12px;">Free from mindfulgaming.org</p>
      <h1 style="font-family:Arial,sans-serif;font-size:24px;line-height:1.2;margin:0 0 16px;">Your Mindful Gaming Starter Pack</h1>
      <p style="font-size:16px;line-height:1.55;margin:0 0 20px;">Thanks for asking for it. Print the pages, keep them by the console, and try one before the next session.</p>
      <p style="margin:0 0 24px;"><a href="${PDF_URL}" style="display:inline-block;background:#D97F2E;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;font-size:16px;padding:12px 22px;border-radius:999px;">Download the Starter Pack (PDF)</a></p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 8px;"><strong>Inside:</strong></p>
      <ul style="font-size:15px;line-height:1.55;margin:0 0 20px;padding-left:20px;">
        <li>The three Mindful Gaming questions</li>
        <li>A full journal session you can print as often as you like</li>
        <li>Five Side Quests</li>
        <li>A session and Word Bank page from <em>The Feelings Are Real</em></li>
        <li>Conversation starters for parents</li>
      </ul>
      <p style="font-size:15px;line-height:1.55;margin:0 0 20px;">If you only try one thing this week, ask the first question before the next session: <em>Why am I gaming right now?</em></p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 20px;">When you want a page for every session, <a href="${JOURNAL_URL}" style="color:#5C8973;">The Mindful Gaming Journal</a> is on Amazon.</p>
      <p style="font-size:15px;line-height:1.55;margin:0;">I'll send a short note about twice a month with one question or idea to try. Reply any time. I read every email.</p>
      <p style="font-size:15px;line-height:1.55;margin:16px 0 0;">Jeff Swift, PhD</p>
    </div>
    <p style="font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#4A5072;text-align:center;margin:16px 0 0;">You're getting this because you asked for the Starter Pack at mindfulgaming.org. Reply "unsubscribe" and I'll take you off the list.</p>
  </div>
</body></html>`;
}
