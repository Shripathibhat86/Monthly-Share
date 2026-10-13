import dotenv from 'dotenv';
import os from 'os';
import app from './app.js';
import { initDb, getDbInfo } from './db.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3002', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    console.log('Initializing database tables and members...');
    await initDb();

    app.listen(PORT, HOST, () => {
      console.log('\n======================================================');
      console.log('  MONTHLY SHARED EXPENSE MANAGER SERVER STARTED       ');
      console.log('======================================================');
      console.log(`Local Access:        http://localhost:${PORT}`);
      console.log(`Bound Host:          ${HOST}:${PORT}`);
      
      const dbInfo = getDbInfo();
      console.log(`Database Backend:    ${dbInfo.type}`);
      console.log(`Database Location:   ${dbInfo.storageLocation}`);

      const networkInterfaces = os.networkInterfaces();
      console.log('\nLAN Access (Use these on phone/tablet/other PCs on Wi-Fi):');
      for (const interfaceName of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[interfaceName]) {
          if (net.family === 'IPv4' && !net.internal) {
            console.log(`  -> http://${net.address}:${PORT}  (${interfaceName})`);
          }
        }
      }

      console.log('\nWindows Firewall Command (Run as Admin in PowerShell if needed):');
      console.log(`  netsh advfirewall firewall add rule name="Monthly Expense Tracker" dir=in action=allow protocol=TCP localport=${PORT}`);
      console.log('======================================================\n');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
