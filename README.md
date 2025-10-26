# Refund Ticket System (Node/Express + SQLite)

This sample issues and redeems **can/bottle refund tickets** with **HMAC-secured QR codes**.

## Features
- Issue tickets with line items (cans/plastic/glass).
- Compute totals server-side and secure payload with HMAC.
- Generate QR PNGs on demand.
- Redeem page that accepts scanner/keyboard input.
- SQLite database via `better-sqlite3`.

## Quick Start
1. Install Node 18+.
2. Unzip this folder.
3. Copy `.env.example` to `.env` and set a strong `HMAC_SECRET`.
4. Install deps:
   ```bash
   npm install
   ```
5. Start the server:
   ```bash
   npm run start
   ```
6. Open:
   - Issue page: http://localhost:3000/
   - Redeem page: http://localhost:3000/redeem.html

## API Overview
### POST /api/tickets
Body:
```json
{
  "employee_id": "Emp#045",
  "items": [
    {"type":"Cans","qty":12,"unit":0.10},
    {"type":"Plastic bottles","qty":5,"unit":0.20},
    {"type":"Glass bottles","qty":3,"unit":0.25}
  ],
  "expires_days": 90
}
```
Response includes `id`, `payload` (to encode in QR), and `total_amount`.

### GET /api/qr/:ticketId.png
Returns a QR image PNG encoding `TICKETID|ISSUED_AT|h=HASH`.

### POST /api/redeem
Body:
```json
{ "code": "TICKETID|ISO8601|h=HASH" }
```
Validates HMAC, status, and expiry; then marks ticket `redeemed`.

## Security Notes
- Codes are HMAC'd as `hmac(id|issued_at)` with your secret.
- Tickets can be expired via `expires_days`.
- For higher security, add cashier authentication and terminal logging.

## Printer / Paper Tickets
Use the included **PDF** template to print tickets. You can also point a thermal printer to `/api/qr/:id.png` to embed QR on receipts.
# Refund-tickets
