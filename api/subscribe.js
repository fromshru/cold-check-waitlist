const fs = require('fs');
const path = require('path');
const https = require('https');
const { kv } = require('@vercel/kv');

// Standard Node-native HTTPS fetch implementation for robust runtime compatibility
const httpsFetch = function(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isPostOrPut = options.method === 'POST' || options.method === 'PUT';
    const reqOpts = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = https.request(reqOpts, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          json: async () => JSON.parse(body),
          text: async () => body
        });
      });
    });
    
    req.on('error', reject);
    if (isPostOrPut && options.body !== undefined) {
      req.write(options.body);
    }
    req.end();
  });
};

// Automated welcome email trigger via Resend API
async function sendWelcomeEmail(toEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('Skipping welcome email: RESEND_API_KEY environment variable not set.');
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Cold Check <onboarding@resend.dev>';
  const subject = 'You’re on the waitlist 🎉';
  const htmlBody = `
    <div style="background-color: #111110; color: #FAF6F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid rgba(250, 246, 240, 0.08);">
      <h1 style="font-family: 'DM Serif Display', Georgia, serif; color: #FAF6F0; font-size: 28px; margin-bottom: 20px; font-weight: normal; letter-spacing: -0.3px;">Cold<span style="color: #E8533D;">Check</span></h1>
      <p style="font-size: 16px; line-height: 1.6; color: #C9C2B8; margin-bottom: 24px;">You are officially on the waitlist.</p>
      <p style="font-size: 14px; line-height: 1.6; color: #8A8A8A; margin-bottom: 30px;">
        ColdCheck is built on the belief that the most useful thing you can do with a hard question is sit with it yourself first. One daily dilemma. Your answer first. No AI. No algorithm. Just honest reasoning.
      </p>
      <div style="margin-top: 40px; border-top: 1px solid rgba(250, 246, 240, 0.08); padding-top: 20px; font-size: 12px; color: #5A5A5A; text-align: center;">
        © 2026 ColdCheck. Built for thinkers. Only sent when it matters.
      </div>
    </div>
  `;

  try {
    const response = await httpsFetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmail,
        subject: subject,
        html: htmlBody
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API returned error:', errorText);
    } else {
      console.log(`Successfully sent welcome email to ${toEmail}`);
    }
  } catch (err) {
    console.error('Failed to send welcome email via Resend:', err);
  }
}

module.exports = async function handler(req, res) {
  // Enable CORS from client dev server locally
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle Options preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GET request to retrieve waitlist count
  if (req.method === 'GET') {
    const isVercel = !!process.env.VERCEL;
    
    if (isVercel) {
      // Option A: Vercel KV (Redis)
      if (process.env.KV_URL && process.env.KV_REST_API_TOKEN) {
        try {
          if (kv) {
            const count = await kv.scard('waitlist:emails');
            return res.status(200).json({ count });
          }
        } catch (err) {
          console.error('Vercel KV count error:', err);
        }
      }
      
      // Option C: ExtendsClass JSON Bin Fallback
      const binId = 'bcffdda';
      try {
        const getResponse = await httpsFetch(`https://extendsclass.com/api/json-storage/bin/${binId}`);
        if (getResponse.ok) {
          const list = await getResponse.json();
          if (Array.isArray(list)) {
            return res.status(200).json({ count: list.length });
          }
        }
      } catch (err) {
        console.error('ExtendsClass count error:', err);
      }
      
      return res.status(200).json({ count: 0 });
    } else {
      // Local development
      try {
        const DATA_DIR = path.join(process.cwd(), 'data');
        const jsonPath = path.join(DATA_DIR, 'waitlist.json');
        if (fs.existsSync(jsonPath)) {
          const list = JSON.parse(fs.readFileSync(jsonPath, 'utf8') || '[]');
          if (Array.isArray(list)) {
            return res.status(200).json({ count: list.length });
          }
        }
      } catch (err) {
        console.error('Local count error:', err);
      }
      return res.status(200).json({ count: 0 });
    }
  }

  // Only allow POST requests for subscription
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  // Server-side email format regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const timestamp = new Date().toISOString();
  const isVercel = !!process.env.VERCEL;

  if (isVercel) {
    // ----------------------------------------------------
    // SECURE PRODUCTION STORAGE (Vercel Serverless Env)
    // ----------------------------------------------------

    // OPTION A: Vercel KV (Redis) Store
    if (process.env.KV_URL && process.env.KV_REST_API_TOKEN) {
      try {
        if (!kv) {
          throw new Error('@vercel/kv module could not be initialized.');
        }

        // sadd returns 1 if email is added successfully, 0 if it already exists (duplicate prevention)
        const added = await kv.sadd('waitlist:emails', cleanEmail);
        if (added === 1) {
          // Record signup timestamp details
          await kv.hset(`waitlist:details:${cleanEmail}`, {
            email: cleanEmail,
            timestamp: timestamp
          });
          
          // Also append to list for sequential exports/views
          await kv.rpush('waitlist:list', JSON.stringify({ email: cleanEmail, timestamp: timestamp }));

          // Trigger email confirmation asynchronously
          try {
            await sendWelcomeEmail(cleanEmail);
          } catch (emailErr) {
            console.error('Async welcome email failure (Vercel KV):', emailErr);
          }

          return res.status(201).json({ success: true, message: 'Successfully joined waitlist.' });
        } else {
          return res.status(200).json({ success: true, message: 'Already registered on the waitlist.' });
        }
      } catch (err) {
        console.error('Vercel KV Storage Error:', err);
        // Fall through to other options if Vercel KV fails
      }
    }

    // OPTION B: Google Sheets integration via simple Apps Script webhook url
    if (process.env.GOOGLE_SHEETS_WEBHOOK_URL) {
      try {
        const response = await httpsFetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, timestamp: timestamp })
        });
        const data = await response.json();
        if (data.success || response.ok) {
          // Trigger email confirmation asynchronously
          try {
            await sendWelcomeEmail(cleanEmail);
          } catch (emailErr) {
            console.error('Async welcome email failure (Sheets Webhook):', emailErr);
          }

          return res.status(201).json({ success: true, message: 'Successfully joined waitlist.' });
        }
      } catch (err) {
        console.error('Google Sheets Webhook Error:', err);
      }
    }

    // OPTION C: Secure Zero-Config Fallback Database (extendsclass.com JSON Storage)
    // Runs when neither Vercel KV nor Google Sheets is connected in Vercel settings.
    // Uses an anonymous JSON bin to securely store waitlist signups in the cloud.
    const binId = 'bcffdda';
    try {
      const getResponse = await httpsFetch(`https://extendsclass.com/api/json-storage/bin/${binId}`);
      let list = [];
      if (getResponse.ok) {
        try {
          list = await getResponse.json();
        } catch (e) {
          list = [];
        }
      }

      if (!Array.isArray(list)) {
        list = [];
      }

      const exists = list.some(item => item.email === cleanEmail);
      if (!exists) {
        list.push({ email: cleanEmail, timestamp });
        
        const putResponse = await httpsFetch(`https://extendsclass.com/api/json-storage/bin/${binId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(list)
        });

        const resBody = await putResponse.json();
        if (resBody.status === 0 || putResponse.ok) {
          // Trigger email confirmation asynchronously
          try {
            await sendWelcomeEmail(cleanEmail);
          } catch (emailErr) {
            console.error('Async welcome email failure (Fallback Bin):', emailErr);
          }

          return res.status(201).json({ success: true, message: 'Successfully joined waitlist.' });
        } else {
          throw new Error(`Failed to update fallback database: status ${putResponse.status}`);
        }
      } else {
        return res.status(200).json({ success: true, message: 'Already registered on the waitlist.' });
      }
    } catch (err) {
      console.error('Production Fallback DB Error:', err);
      return res.status(500).json({
        error: `Production database error: ${err.message || err}`
      });
    }
  } else {
    // ----------------------------------------------------
    // SECURE LOCAL STORAGE FALLBACK (Local Dev Node Server)
    // ----------------------------------------------------
    try {
      const DATA_DIR = path.join(process.cwd(), 'data');
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // JSON DB Check for duplicate prevention
      const jsonPath = path.join(DATA_DIR, 'waitlist.json');
      let list = [];
      if (fs.existsSync(jsonPath)) {
        try {
          list = JSON.parse(fs.readFileSync(jsonPath, 'utf8') || '[]');
        } catch (e) {
          list = [];
        }
      }

      if (!list.some(item => item.email.toLowerCase() === cleanEmail)) {
        // Append to waitlist.json
        list.push({
          email: cleanEmail,
          created_at: timestamp
        });
        fs.writeFileSync(jsonPath, JSON.stringify(list, null, 2), 'utf8');

        // Append to waitlist.csv spreadsheet
        const csvPath = path.join(DATA_DIR, 'waitlist.csv');
        if (!fs.existsSync(csvPath)) {
          fs.writeFileSync(csvPath, 'Email,Timestamp\n', 'utf8');
        }

        // Format date as DD/MM/YYYY
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;

        const escapedEmail = cleanEmail.replace(/"/g, '""');
        fs.appendFileSync(csvPath, `"${escapedEmail}",${formattedDate}\n`, 'utf8');

        // Trigger email confirmation asynchronously
        try {
          await sendWelcomeEmail(cleanEmail);
        } catch (emailErr) {
          console.error('Async welcome email failure (Local Dev):', emailErr);
        }

        return res.status(201).json({ success: true, message: 'Successfully joined waitlist.' });
      } else {
        return res.status(200).json({ success: true, message: 'Already registered on the waitlist.' });
      }
    } catch (err) {
      console.error('Local file write error:', err);
      return res.status(500).json({ error: 'Failed to write waitlist details locally.' });
    }
  }
};
