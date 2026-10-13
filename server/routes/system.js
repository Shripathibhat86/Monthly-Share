import { Router } from 'express';
import os from 'os';
import { getDbInfo } from '../db.js';

const router = Router();

// GET system network info and database status
router.get('/info', (req, res) => {
  const port = process.env.PORT || 3002;
  const networkInterfaces = os.networkInterfaces();
  const lanAddresses = [];

  for (const interfaceName of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[interfaceName]) {
      // IPv4 and not loopback
      if (net.family === 'IPv4' && !net.internal) {
        lanAddresses.push({
          interface: interfaceName,
          ip: net.address,
          url: `http://${net.address}:${port}`
        });
      }
    }
  }

  const dbInfo = getDbInfo();

  res.json({
    port,
    hostname: os.hostname(),
    lanAddresses,
    localUrl: `http://localhost:${port}`,
    firewallCommand: `netsh advfirewall firewall add rule name="Monthly Expense Tracker" dir=in action=allow protocol=TCP localport=${port}`,
    database: dbInfo
  });
});

export default router;
