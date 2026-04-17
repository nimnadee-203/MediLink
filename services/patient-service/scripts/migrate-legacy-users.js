import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import {
  migrateLegacyUsersToDomainCollections,
  dropLegacyTestDatabases
} from '../src/lib/userMigration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const shouldDropTestDbs = process.argv.includes('--drop-test-dbs');
const reportPath = path.join(__dirname, 'migration-report.json');

const run = async () => {
  await connectDB();

  const migration = await migrateLegacyUsersToDomainCollections();
  console.log('Legacy migration summary:', migration);

  const report = {
    executedAt: new Date().toISOString(),
    migration,
    cleanup: null
  };

  if (shouldDropTestDbs) {
    const cleanup = await dropLegacyTestDatabases();
    console.log('Legacy test DB cleanup:', cleanup);
    report.cleanup = cleanup;
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  await mongoose.disconnect();
};

run()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Migration failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
