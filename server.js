require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const Database = require('better-sqlite3');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const HMAC_SECRET = process.env.HMAC_SECRET || 'change_this_secret';
const DB_PATH = process.env.DATABASE || './data.db';

// Initialize DB
const db = new Database(DB_PATH);
const schema = fs.readFileSync(path.join(__dirname, 'db.sql'), 'utf-8');
db.exec(schema);

// Helpers
function nowISO() {
  return new Date().toISOString();
}
function hmac(data) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(data).digest('hex');
}
function calcTotals(items) {
  const unitTotals = [];
  let total = 0;
  for (const it of items) {
    const sub = Number(it.qty || 0) * Number(it.unit || 0);
    unitTotals.push({ type: it.type, subtotal: Number(sub.toFixed(2)) });
    total += sub;
  }
  return { unitTotals, total: Number(total.toFixed(2)) };
}

// API: Issue ticket
app.post('/api/tickets', (req, res) => {
  try {
    const { employee_id, items, expires_days } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be array' });
    }
    const issued_at = nowISO();
    const id = `REF-${issued_at.slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*1e6).toString().padStart(6,'0')}`;

    const { unitTotals, total } = calcTotals(items);
    const payloadNoHash = `${id}|${issued_at}`;
    const hash = hmac(payloadNoHash);
    const payload = `${payloadNoHash}|h=${hash}`;

    let expires_at = null;
    if (expires_days && Number(expires_days) > 0) {
      const d = new Date(issued_at);
      d.setDate(d.getDate() + Number(expires_days));
      expires_at = d.toISOString();
    }

    const stmt = db.prepare(`INSERT INTO tickets (id, issued_at, employee_id, items_json, unit_totals_json, total_amount, status, expires_at, hash)
                             VALUES (?, ?, ?, ?, ?, ?, 'issued', ?, ?)`);
    stmt.run(id, issued_at, employee_id || null, JSON.stringify(items), JSON.stringify(unitTotals), total, expires_at, hash);

    res.json({
      id,
      issued_at,
      employee_id,
      items,
      unit_totals: unitTotals,
      total_amount: total,
      status: 'issued',
      expires_at,
      payload
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// API: Get QR as PNG
app.get('/api/qr/:ticketId.png', async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    const row = db.prepare('SELECT id, issued_at, hash FROM tickets WHERE id = ?').get(ticketId);
    if (!row) return res.status(404).send('Not found');
    const payload = `${row.id}|${row.issued_at}|h=${row.hash}`;
    res.setHeader('Content-Type', 'image/png');
    const stream = await QRCode.toBuffer(payload, { errorCorrectionLevel: 'M', margin: 1, width: 256 });
    res.end(stream);
  } catch (e) {
    console.error(e);
    res.status(500).send('Server error');
  }
});

// API: Redeem
app.post('/api/redeem', (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string' || !code.includes('|') || !code.includes('h=')) {
      return res.status(400).json({ error: 'Invalid code format' });
    }
    const [ticketId, issued_at, hpart] = code.split('|');
    const receivedHash = (hpart || '').replace(/^h=/, '');

    const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!row) return res.status(404).json({ error: 'Ticket not found' });

    const expected = crypto.createHmac('sha256', HMAC_SECRET).update(`${ticketId}|${row.issued_at}`).digest('hex');
    if (expected !== receivedHash) {
      return res.status(400).json({ error: 'Hash mismatch (invalid or altered code)' });
    }

    if (row.status !== 'issued') {
      return res.status(400).json({ error: `Ticket not redeemable (status=${row.status})` });
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Ticket expired' });
    }

    const upd = db.prepare('UPDATE tickets SET status = ? WHERE id = ?');
    upd.run('redeemed', ticketId);

    res.json({
      ok: true,
      ticket_id: ticketId,
      total_amount: row.total_amount,
      message: 'Redeemed successfully'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
