import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import membersRouter from './routes/members.js';
import expensesRouter from './routes/expenses.js';
import settlementsRouter from './routes/settlements.js';
import reportsRouter from './routes/reports.js';
import systemRouter from './routes/system.js';
import backupRouter from './routes/backup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Mount API routes
app.use('/api/members', membersRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/settlements', settlementsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/system', systemRouter);
app.use('/api/backup', backupRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
