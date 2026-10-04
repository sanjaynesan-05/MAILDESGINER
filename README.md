# JSN Mail Studio

JSN Mail Studio is an internal, manual HTML email builder for JSN Designs. It lets a user enter recipients and message content, format rich text, build reusable sections and tables, preview the generated email, attach files, send a test message, and send through Gmail SMTP.

The application does not use AI, a database, authentication, a CRM, analytics, tracking, campaigns, or an external email delivery provider. Gmail SMTP and a Gmail App Password are used for delivery.

## 1. Project Overview

The project has two runtime parts:

- **Frontend:** React, Vite, and TypeScript. It runs the email builder and live preview in the browser.
- **Backend:** Node.js, Express, TypeScript, and Nodemailer. It validates requests, handles temporary attachments, generates the final email HTML, and sends through Gmail SMTP.

During development, `npm run dev` starts both processes:

- Vite frontend: `http://localhost:5173`
- Express API: `http://localhost:5000`

Vite proxies `/api` requests to the Express server.

## 2. Key Features

- JSN Designs branded editor using `src/assets/JSN DESIGN.png`.
- Recipient fields for To, CC, and BCC.
- Subject, greeting, title, body, closing, and signature fields.
- Inline rich-text editing for body and paragraph blocks.
- Keyboard shortcuts for bold, italic, and underline.
- Bulleted and numbered lists, alignment, links, text size, and text color.
- Dynamic sections that can be added, duplicated, deleted, and reordered.
- Section blocks for paragraphs, lists, images, CTA buttons, dividers, and tables.
- Visual table editor with editable cells, rows, columns, header-row toggle, padding, colors, alignment, and basic typography settings.
- Desktop and mobile preview modes.
- Preview and generated HTML modes.
- Fullscreen preview mode.
- Copy generated HTML to the clipboard.
- Live HTML size display with a warning above 90 KB.
- Local draft autosave using browser `localStorage`.
- Multiple attachments with a 10 MB per-file limit and a maximum of 10 files per request.
- Send test and send email actions with loading states, validation, toast messages, and a confirmation dialog.
- Gmail logo delivery using a Nodemailer CID attachment.

## 3. Tech Stack

### Frontend

- React 18
- Vite
- TypeScript
- Tailwind CSS and PostCSS
- `lucide-react` for icons
- `sonner` for toast notifications

### Backend

- Node.js
- Express
- TypeScript
- `tsx` for running TypeScript directly
- Nodemailer 10
- Multer 2 for in-memory multipart uploads
- Helmet for security headers
- CORS
- `express-rate-limit`
- `dotenv`

## 4. Project Structure

The repository currently uses a root-level Vite frontend and an Express backend. There is no separate `client/` directory.

```text
.
├─ index.html                 # Vite HTML entry point
├─ package.json               # Scripts and dependencies
├─ package-lock.json
├─ vite.config.ts             # Vite config and /api proxy
├─ tsconfig.json
├─ tsconfig.app.json          # Frontend TypeScript configuration
├─ tsconfig.node.json         # Server/config TypeScript configuration
├─ tailwind.config.js
├─ postcss.config.js
├─ .env.example               # Environment variable template
├─ .gitignore
├─ README.md
├─ mail.txt                   # Sample email copy; not loaded by the application
├─ src/
│  ├─ App.tsx                 # Main editor, preview, sending workflow
│  ├─ main.tsx                # React entry point and toast provider
│  ├─ vite-env.d.ts           # Vite asset type declarations
│  ├─ assets/
│  │  └─ JSN DESIGN.png       # JSN Designs logo
│  ├─ services/
│  │  └─ html.service.ts      # Email-safe HTML generation and sanitization
│  ├─ templates/
│  │  └─ templates.ts         # Legacy template metadata; no active picker
│  ├─ types/
│  │  └─ email.ts             # Draft, block, table, and typography types
│  ├─ styles.css               # Main application styles
│  └─ styles-extensions.css   # Rich editor, table, and preview styles
└─ server/
   ├─ index.ts                # Express app, middleware, and server startup
   ├─ routes/
   │  └─ email.routes.ts      # Email API and multipart handling
   └─ services/
      ├─ html.service.ts      # Re-exports the shared HTML generator
      └─ mail.service.ts      # Gmail SMTP transport
```

Generated folders such as `node_modules/` and `dist/` are not source files. They are ignored or generated locally.

## 5. Prerequisites

- Node.js 20 or newer.
- npm.
- A Gmail or Google Workspace account allowed to send mail through SMTP.
- Google 2-Step Verification enabled for that account.
- A Gmail App Password.
- A modern browser with support for `contentEditable` and the browser editing commands used by the rich-text toolbar.

## 6. Installation

From the project directory:

```powershell
cd "D:\jsn mail"
npm install
Copy-Item .env.example .env
```

Edit `.env` with the Gmail settings described below. Do not commit `.env`.

## 7. Environment Configuration

The backend loads `.env` through `dotenv`. The current `.env.example` is:

```env
GMAIL_USER=your-gmail-address@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
PORT=5000
CLIENT_URL=http://localhost:5173
```

Variables:

| Variable | Required | Description |
| --- | --- | --- |
| `GMAIL_USER` | Yes for sending | Gmail address used as the SMTP username and From address. |
| `GMAIL_APP_PASSWORD` | Yes for sending | The 16-character Google App Password. This is not the normal Gmail password. |
| `PORT` | No | Express API port. Defaults to `5000`. |
| `CLIENT_URL` | No | Allowed CORS origin. Defaults to `http://localhost:5173`. |

The frontend receives only the configured Gmail address and connection status from `/api/email/config`. The app password is never returned to the browser.

## 8. Gmail App Password Setup

1. Sign in to the Google Account used in `GMAIL_USER`.
2. Open the account’s **Security** settings.
3. Enable **2-Step Verification** if it is not already enabled.
4. Open **App passwords**.
5. Create an app password named `JSN Mail Studio`.
6. Copy the generated 16-character value.
7. Put it in `.env` as `GMAIL_APP_PASSWORD`.
8. Restart the backend after changing `.env`.

Example:

```env
GMAIL_USER=studio@example.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
PORT=5000
CLIENT_URL=http://localhost:5173
```

Do not include spaces, quotation marks, or the App Password in source control, screenshots, issue reports, or chat messages.

## 9. Running the Frontend and Backend

### Recommended development command

```powershell
npm run dev
```

This runs:

```text
vite
tsx watch server/index.ts
```

Open the frontend at `http://localhost:5173`.

### Run the backend only

```powershell
npm run start
```

The backend listens on `http://localhost:5000` by default.

### Run the frontend only

```powershell
npm run preview
```

Run `npm run build` first. `npm run preview` serves the built Vite frontend; it does not start the Express API.

If Vite reports that port 5173 is busy, it may choose another frontend port. Update `CLIENT_URL` to match that browser origin if the browser then reports a CORS error. The Vite development proxy targets the API at `http://localhost:5000`.

## 10. Using the Email Builder

1. Start the project with `npm run dev`.
2. Open the Vite URL shown in the terminal.
3. Confirm the From panel shows the connected Gmail account.
4. Enter one or more addresses in **To**. Separate multiple addresses with commas.
5. Optionally enter CC and BCC recipients.
6. Enter a subject.
7. Enter the greeting and email title.
8. Write the body using the rich-text editor.
9. Add sections when the message needs additional content.
10. Add tables, images, CTA buttons, dividers, or lists inside sections as needed.
11. Enter the closing and signature.
12. Add attachments by browsing or dropping files into the attachment area.
13. Review the live preview in Desktop or Mobile mode.
14. Use HTML mode to inspect the generated markup or copy it with **Copy HTML**.
15. Check the displayed HTML size. The UI warns when it exceeds 90 KB.
16. Use **Save draft** when you want an explicit local save. Draft changes also autosave to `localStorage`.
17. Use **Send test** to send the message to the connected Gmail account.
18. Use **Send email** to send it to the entered recipients.
19. After a successful send, review the recipient, subject, and timestamp in the confirmation dialog.

## 11. Rich-Text Editing and Shortcuts

The body and paragraph blocks use a lightweight `contentEditable` editor. Formatting is applied directly while writing.

Toolbar controls include:

- Bold
- Italic
- Underline
- Bulleted list
- Numbered list
- Left, center, and right alignment
- Text size
- Text color
- Link insertion

Keyboard shortcuts:

| Shortcut | Action |
| --- | --- |
| `Ctrl+B` or `Cmd+B` | Bold |
| `Ctrl+I` or `Cmd+I` | Italic |
| `Ctrl+U` or `Cmd+U` | Underline |

The editor stores the resulting markup in the draft. The HTML service keeps a restricted allowlist of formatting tags and converts supported font markup to inline styles before delivery.

## 12. Sections, Tables, Attachments, and HTML Preview

### Sections

Use **Add section** to create a new section. Each section has a heading and editable content blocks. Section controls support:

- Move up
- Move down
- Duplicate
- Delete

Available blocks are:

- Paragraph
- Bullet or numbered list
- Image by HTTP(S) URL
- CTA button
- Divider
- Table

### Tables

The table editor supports:

- Adding and removing rows
- Adding and removing columns
- Editing each cell
- Enabling a header row
- Text color
- Header background color
- Border color
- Cell padding

Tables are generated as HTML tables with inline cell styles. The same generated table markup is used in the live preview and the message sent to Gmail.

### Attachments

Attachments are submitted as `multipart/form-data`. The current limits are:

- Maximum 10 files per request.
- Maximum 10 MB per file.
- Files are stored in memory only for the request.
- Files are not persisted to disk or a database.

The browser displays the filename, size, and remove control before sending.

### HTML Preview

The Preview tab renders the generated HTML in an iframe. The HTML tab shows the generated source. The **Copy HTML** button copies that source to the clipboard.

The generated email uses table-based layout and inline styles. It does not require JavaScript, CSS Grid, Flexbox, or an external stylesheet inside the delivered email.

## 13. Gmail HTML and CID Logo Handling

The browser preview receives the Vite-resolved JSN logo asset. The backend does not send a local file path or a base64 data URI.

Before delivery, `server/routes/email.routes.ts` reads `src/assets/JSN DESIGN.png` and adds it to the Nodemailer message as:

```text
filename: JSN-DESIGN.png
cid: jsn-logo
```

The generated email references it as:

```html
<img src="cid:jsn-logo" ...>
```

This lets Gmail resolve the logo as an inline related attachment. The email generator escapes user text, restricts rich-text tags, validates HTTP(S) links, and uses compact inline email markup.

## 14. Email Sending and Testing Workflow

The frontend sends a `FormData` request containing:

- `payload`: JSON-encoded draft data.
- `attachments`: zero or more uploaded files.

The API then:

1. Parses the draft payload.
2. Validates recipients and subject.
3. Sanitizes uploaded filenames.
4. Adds the JSN logo as the `jsn-logo` CID attachment.
5. Generates the final HTML.
6. Sends with Nodemailer through:

```text
Host: smtp.gmail.com
Port: 465
Secure: true
```

For **Send test**, the frontend targets the configured Gmail account returned by the config endpoint. For **Send email**, it uses the entered To, CC, and BCC values.

Available API routes:

| Method | Route | Behavior |
| --- | --- | --- |
| `GET` | `/api/health` | Returns server health. |
| `GET` | `/api/email/config` | Returns connection status and Gmail address only. |
| `POST` | `/api/email/test` | Sends a test message through Gmail. |
| `POST` | `/api/email/send` | Sends a message to entered recipients. |

## 15. Troubleshooting and Common Errors

### `Gmail is not configured`

- Confirm `.env` exists next to `package.json`.
- Check that both `GMAIL_USER` and `GMAIL_APP_PASSWORD` are populated.
- Restart `npm run dev` after changing `.env`.
- Check `GET http://localhost:5000/api/email/config`.

### Gmail rejects the credentials

- Use a Google App Password, not the normal Gmail password.
- Confirm 2-Step Verification is enabled.
- Confirm the App Password belongs to the account in `GMAIL_USER`.
- Make sure the account is allowed to use SMTP under its organization policy.

### `EADDRINUSE` or “port already in use”

Another process is using port 5000 or 5173. Stop the old development process or change `PORT` for Express. If the frontend moves to another port, set `CLIENT_URL` to the new browser origin and restart.

On Windows, identify listeners with:

```powershell
Get-NetTCPConnection -LocalPort 5000,5173 -State Listen
```

### CORS errors

Set `CLIENT_URL` to the exact frontend origin, including the port:

```env
CLIENT_URL=http://localhost:5173
```

Then restart the backend.

### Attachments are rejected

Check that each file is 10 MB or smaller and that no more than 10 files are selected.

### The Gmail message is clipped or the logo is missing

- Check the HTML size displayed in the preview.
- Remove unnecessary large images or content when the size warning appears.
- Confirm the message was sent through the current backend process after code or `.env` changes.
- Confirm the logo is sent with CID `jsn-logo`, not as a local filesystem path.
- Use Gmail’s “Show original” or the HTML preview to inspect the delivered structure.

### HTML preview does not update

Refresh the browser and confirm the Vite process is running. Draft data is stored in `localStorage`; use **Clear draft** if an old draft has incompatible data.

## 16. Security Notes

- `.env` is ignored by Git. Never commit Gmail credentials.
- The Gmail App Password is read only by the backend.
- `/api/email/config` never returns the App Password.
- Helmet is enabled for security headers.
- CORS is restricted to `CLIENT_URL`.
- Express requests are rate-limited to 60 requests per 15-minute window.
- JSON request bodies are limited to 1 MB.
- Multipart uploads are limited to 10 files and 10 MB per file.
- Uploaded filenames are sanitized before being passed to Nodemailer.
- Recipients are checked against a basic email pattern.
- Subjects must be present and are limited to 200 characters.
- User text is escaped or passed through a small rich-text allowlist before email generation.
- CTA and image URLs accept only HTTP(S) URLs; unsupported schemes become `#`.
- Attachments remain in memory for the request and are not persisted.
- There is currently no user authentication or authorization layer. Keep this application on a trusted internal network or behind an appropriate access-control layer before exposing it beyond the intended internal users.

## 17. Production and Deployment Notes

The repository provides development and build scripts but does not include a production reverse proxy, process manager, hosting configuration, or authentication system.

For a production deployment:

1. Build the frontend:

   ```powershell
   npm run build
   ```

2. Run the Express server with production environment variables:

   ```powershell
   npm run start
   ```

3. Serve the generated `dist/` frontend through a web server or static hosting service.
4. Proxy `/api` requests to the Express server.
5. Set `CLIENT_URL` to the exact HTTPS frontend origin.
6. Store Gmail credentials in the deployment secret manager or protected environment, not in the repository.
7. Use HTTPS for the frontend and API.
8. Keep the app behind trusted access control because the current application has no built-in authentication.
9. Monitor SMTP failures, rate-limit responses, memory usage during attachment uploads, and email size.

The current server binds with Express’s default host behavior and starts on `PORT`. No production static-file serving is configured in `server/index.ts`.

## 18. Useful npm Commands

```powershell
# Install dependencies
npm install

# Run Vite and Express together with file watching
npm run dev

# Type-check and build the frontend
npm run build

# Start only the Express TypeScript server
npm run start

# Preview the built Vite frontend
npm run preview

# Check production dependency vulnerabilities
npm audit --omit=dev --audit-level=high
```

Useful API checks while the backend is running:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5000/api/health
Invoke-WebRequest -UseBasicParsing http://localhost:5000/api/email/config
```

The second response contains only connection status and the Gmail address. Do not print or share `.env` contents.

## 19. Final Project Structure

```text
JSN Mail Studio
├─ Frontend
│  ├─ index.html
│  ├─ src/App.tsx
│  ├─ src/main.tsx
│  ├─ src/assets/JSN DESIGN.png
│  ├─ src/services/html.service.ts
│  ├─ src/types/email.ts
│  ├─ src/styles.css
│  └─ src/styles-extensions.css
├─ Backend
│  ├─ server/index.ts
│  ├─ server/routes/email.routes.ts
│  ├─ server/services/html.service.ts
│  └─ server/services/mail.service.ts
├─ Configuration
│  ├─ package.json
│  ├─ vite.config.ts
│  ├─ tsconfig.json
│  ├─ tsconfig.app.json
│  ├─ tsconfig.node.json
│  ├─ tailwind.config.js
│  ├─ postcss.config.js
│  ├─ .env.example
│  └─ .gitignore
└─ Documentation
   └─ README.md
```

This README describes the current repository behavior and should be updated when scripts, routes, environment variables, upload limits, or email-generation behavior change.
