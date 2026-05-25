const express    = require('express');
const nodemailer = require('nodemailer');
const csvParser  = require('csv-parser');
const multer     = require('multer');
const fs         = require('fs');
const cron       = require('node-cron');

const app  = express();
const PORT = 3000;

// ─── IN MEMORY STORAGE ────────────────────────────────────────
let savedFilePath = null;
let savedSubject  = '';
let savedMessage  = '';

// ─── MULTER SETUP ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, 'emails.csv'); // always overwrite same file
  }
});
const upload = multer({ storage });

// ─── MIDDLEWARE ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── EMAIL CONFIG ─────────────────────────────────────────────
// const transporter = nodemailer.createTransport({
//   host: 'smtpout.secureserver.net',
//   port: 465,
//   secure: true,
//   auth: {
//     user: 'anum@anumjawaid.org',
//     pass: 'PeachesGodaddy@898'
//   }
// });
const transporter1 = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'anum@anumjawaid.org',
    pass: 'PeachesGodaddy@898'
  }
});

const transporter2 = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'contact@devvisionaries.org',
    pass: 'work@vision-12345'
  }
});

transporter.verify((error) => {
  if (error) console.error(' SMTP Connection Failed:', error.message);
  else        console.log('SMTP Server is ready to send emails');
});

// ─── HELPER: DELAY ────────────────────────────────────────────
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── HELPER: READ CSV ─────────────────────────────────────────
function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        console.log('row', row);
        const email = row.email || row.Email || row.EMAIL;
        const name  = row.name  || row.Name  || row.NAME || '';
        if (email) results.push({ email: email.trim(), name: name.trim() });
      })
      .on('end',   () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

// ─── CORE: SEND EMAILS ────────────────────────────────────────
async function sendEmails(filePath, subject, message) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.log('⚠️  No CSV file found. Please upload one first.');
    return;
  }

  let recipients = [];
  try {
    recipients = await readCSV(filePath);
    console.log(`\n📋 Found ${recipients.length} emails in CSV`);
  } catch (error) {
    console.error(' Failed to read CSV:', error.message);
    return;
  }

  if (recipients.length === 0) {
    console.log(' No valid emails found in CSV');
    return;
  }

  let successCount = 0;
  let failCount    = 0;
  const failed     = [];

  // for (let i = 0; i < recipients.length; i++) {
  //   const { email, name } = recipients[i];


  //   const mailOptions = {
  //     from:    successCount < 35 ? 'anum@anumjawaid.org' : 'contact@devvisionaries.org',
  //     to:      email,
  //     subject: subject,
  //     text:    name ? `Hi ${name},\n\n${message}` : message
  //   };

  //   try {
  //     await transporter.sendMail(mailOptions);
  //     successCount++;
  //     //change email address
  //     if(successCount === 35){
  //       transporter.options.auth.user = 'contact@devvisionaries.org';
  //       transporter.options.auth.pass = 'work@vision-12345';
  //     }
  //     console.log(` [${i + 1}/${recipients.length}] Sent to: ${email}`);
  //   } catch (error) {
  //     failCount++;
  //     failed.push(email);
  //     console.error(`[${i + 1}/${recipients.length}] Failed: ${email} → ${error.message}`);
  //   }

  //   if (i < recipients.length - 1) await delay(3000);
  // }
  for (let i = 0; i < recipients.length; i++) {
  const { email, name } = recipients[i];

  // First 35 emails use transporter1
  // Remaining emails use transporter2
  const currentTransporter = i < 35
    ? transporter1
    : transporter2;

  const fromEmail = i < 35
    ? 'anum@anumjawaid.org'
    : 'contact@devvisionaries.org';

  const mailOptions = {
    from: fromEmail,
    to: email,
    subject: subject,
    text: name
      ? `Hi ${name},\n\n${message}`
      : message
  };

  try {
    await currentTransporter.sendMail(mailOptions);

    successCount++;

    console.log(
      `[${i + 1}/${recipients.length}] Sent to: ${email} using ${fromEmail}`
    );

  } catch (error) {
    failCount++;
    failed.push(email);

    console.error(
      `[${i + 1}/${recipients.length}] Failed: ${email} → ${error.message}`
    );
  }

  // Delay between emails
  if (i < recipients.length - 1) {
    await delay(3000);
  }
}

  console.log('\n─────────────────────────────────');
  console.log(`📊 DONE! Total: ${recipients.length}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed:  ${failCount}`);
  if (failed.length > 0) console.log('Failed emails:', failed.join(', '));
  console.log('\n');
}

// ─── JOB SCHEDULER: EVERY DAY AT 18:00 PM ─────────────────────
cron.schedule('0 18 * * *', () => {
  console.log('\n⏰ Scheduled job triggered — sending emails...');
  sendEmails(savedFilePath, savedSubject, savedMessage);
});

console.log('📅 Scheduler ready — emails will run every day at 6:00 PM');

// ─── ROUTE: HOME ──────────────────────────────────────────────
app.get('/', (req, res) => {
  const csvReady = savedFilePath && fs.existsSync(savedFilePath);

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Email Sender</title>
      <style>
        body     { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        h2       { color: #333; }
        form     { background: #f9f9f9; padding: 20px; border-radius: 8px; }
        input, textarea { width: 100%; padding: 10px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button   { background: #4CAF50; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; width: 100%; margin-top: 5px; }
        button:hover { background: #45a049; }
        .status  { padding: 12px; border-radius: 6px; margin-bottom: 15px; font-size: 14px;
                   background: ${csvReady ? '#e8f5e9' : '#fff3e0'};
                   border-left: 4px solid ${csvReady ? '#4CAF50' : '#FF9800'}; }
      </style>
    </head>
    <body>
      <h2>📧 Bulk Email Sender</h2>

      <div class="status">
        ${csvReady
          ? `✅ CSV uploaded — scheduled to send every day at <strong>9:00 AM</strong>`
          : `⚠️ No CSV uploaded yet — please upload to activate the scheduler`}
      </div>

      <form action="/send-csv" method="POST" enctype="multipart/form-data">
        <label>📎 Upload CSV File (with email column):</label>
        <input type="file" name="csvfile" accept=".csv" required />

        <label>📝 Email Subject:</label>
        <input type="text" name="subject" placeholder="Enter subject..." required />

        <label>💬 Email Message:</label>
        <textarea name="message" rows="5" placeholder="Enter your message..." required></textarea>

        <button type="submit">💾 Upload & Schedule</button>
      </form>
    </body>
    </html>
  `);
});

// ─── ROUTE: UPLOAD CSV & SCHEDULE ─────────────────────────────
app.post('/send-csv', upload.single('csvfile'), async (req, res) => {
  const { subject, message } = req.body;

  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'Please upload a CSV file' });
  }
  if (!subject || !message) {
    return res.status(400).json({ status: 'error', message: 'Subject and message are required' });
  }

  // Save to memory for scheduler to use
  savedFilePath = req.file.path;
  savedSubject  = subject;
  savedMessage  = message;

  console.log(`\n📁 CSV uploaded: ${req.file.path}`);
  console.log(`Subject: ${subject}`);
  console.log(`Scheduler active — will send every day at 9:00 AM\n`);

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Scheduled!</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .box { background: #e8f5e9; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>Scheduled!</h2>
        <p>CSV uploaded successfully.</p>
        <p>Subject: <strong>${subject}</strong></p>
        <p>Emails will send automatically <strong>every day at 9:00 AM</strong></p>
        <a href="/">← Go Back</a>
      </div>
    </body>
    </html>
  `);
});

// ─── START SERVER ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n Server running at http://localhost:${PORT}`);
  console.log(`Open browser and go to http://localhost:${PORT}\n`);
});