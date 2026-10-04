import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import emailRoutes from './routes/email.routes.ts';

const app = express();
const port = Number(process.env.PORT || 5000);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(helmet());
app.use(cors({ origin: clientUrl }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }));
app.get('/api/health', (_request, response) => response.json({ ok: true, service: 'jsn-mail-studio' }));
app.use('/api/email', emailRoutes);
app.listen(port, () => console.log(`JSN Mail Studio server listening on port ${port}`));
