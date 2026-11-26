import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { requireAuth } from './auth.js';
import authRouter from './routes/auth.js';
import membersRouter from './routes/members.js';
import expensesRouter from './routes/expenses.js';
import settlementsRouter from './routes/settlements.js';
import reportsRouter from './routes/reports.js';
import systemRouter from './routes/system.js';
import backupRouter from './routes/backup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (public login/register/status + protected me/users)
app.use('/api/auth', authRouter);

// All application data routes require sign-in
app.use('/api/members', requireAuth, membersRouter);
app.use('/api/expenses', requireAuth, expensesRouter);
app.use('/api/settlements', requireAuth, settlementsRouter);
app.use('/api/reports', requireAuth, reportsRouter);
app.use('/api/system', requireAuth, systemRouter);
app.use('/api/backup', requireAuth, backupRouter);

// Serve frontend in production if built
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

export default app;
