# JSN Mail Studio

Internal HTML email builder for JSN Designs. Compose a message, preview the email-safe HTML, attach files, send a test to the connected Gmail account, or send to recipients through Gmail SMTP.

## Requirements

- Node.js 20+
- A Gmail or Google Workspace mailbox with 2-Step Verification enabled
- A Gmail App Password (regular Gmail passwords do not work with SMTP)

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Set `.env`:

```env
GMAIL_USER=studio@your-domain.com
GMAIL_APP_PASSWORD=your-16-character-app-password
PORT=5000
CLIENT_URL=http://localhost:5173
```

The app password is read only by the server. It is never sent to the browser, returned by `/api/email/config`, or logged.

## Gmail App Password

1. Open the Google Account security page for the sending mailbox.
2. Enable 2-Step Verification.
3. Open **App passwords**, create one named `JSN Mail Studio`, and copy the generated 16-character password.
4. Put it in `GMAIL_APP_PASSWORD` without committing `.env`.

## Commands

```powershell
npm run dev
npm run build
npm run start
```

The requested development command is `npm run dev`. It starts Vite at `http://localhost:5173` and the API at `http://localhost:5000`.

## API

- `GET /api/health` returns server status.
- `GET /api/email/config` returns connection status and the configured Gmail address only.
- `POST /api/email/test` sends the submitted email to the configured Gmail account.
- `POST /api/email/send` sends to the submitted recipients.

Send endpoints accept `multipart/form-data`: a JSON `payload` field and zero or more `attachments` fields. Attachments are held in memory for the request, limited to 10 files and 10 MB per file, and are not persisted.

## Troubleshooting

- `Gmail is not configured`: confirm `.env` exists beside `package.json`, then restart `npm run dev`.
- `Username and Password not accepted`: use an App Password, not the Google account password, and confirm 2-Step Verification is enabled.
- CORS errors: make sure `CLIENT_URL` exactly matches the browser URL.
- Port in use: change `PORT` for the API or the Vite port in `vite.config.ts`.
- Preview HTML is intentionally table-based with inline styles so it can be delivered by Gmail without external CSS or JavaScript.
