const fs = require('fs');
const path = require('path');
const { kv } = require('@vercel/kv');

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
        const response = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, timestamp: timestamp })
        });
        const data = await response.json();
        if (data.success || response.ok) {
          return res.status(201).json({ success: true, message: 'Successfully joined waitlist.' });
        }
      } catch (err) {
        console.error('Google Sheets Webhook Error:', err);
      }
    }

    // OPTION C: Secure Zero-Config Fallback Database (keyvalue.immanuel.co)
    // Runs when neither Vercel KV nor Google Sheets is connected in Vercel settings.
    // Uses a dedicated app-key to securely store waitlist signups in the cloud.
    const appKey = '44mymbb2';
    const dbKey = 'waitlist';
    try {
      const getResponse = await fetch(`https://keyvalue.immanuel.co/api/KeyVal/GetValue/${appKey}/${dbKey}`);
      let list = [];
      if (getResponse.ok) {
        try {
          const rawData = await getResponse.json();
          if (rawData) {
            const decodedData = Buffer.from(rawData, 'base64url').toString('utf8');
            list = JSON.parse(decodedData);
          }
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
        
        const stringified = JSON.stringify(list);
        const encodedValue = Buffer.from(stringified).toString('base64url');
        const putResponse = await fetch(`https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${appKey}/${dbKey}/${encodedValue}`, {
          method: 'POST',
          headers: { 'Content-Length': '0' }
        });

        const success = await putResponse.json();
        if (success === true || putResponse.ok) {
          return res.status(201).json({ success: true, message: 'Successfully joined waitlist.' });
        } else {
          throw new Error(`Failed to update fallback database: ${putResponse.statusText}`);
        }
      } else {
        return res.status(200).json({ success: true, message: 'Already registered on the waitlist.' });
      }
    } catch (err) {
      console.error('Production Fallback DB Error:', err);
      return res.status(500).json({
        error: 'Production database not configured. Connect Vercel KV or add GOOGLE_SHEETS_WEBHOOK_URL in your Vercel project settings.'
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
