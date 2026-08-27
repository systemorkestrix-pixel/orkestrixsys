import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApplication } from '../apps/api/src/server.js';

const app = createApplication({
  databaseUrl: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET || 'project-media',
  secureCookies: process.env.NODE_ENV === 'production',
});

// Auto-bootstrap admin if environment variables are provided on cold start
const bootstrapEmail = process.env.ORKESTRIX_BOOTSTRAP_ADMIN_EMAIL;
const bootstrapPassword = process.env.ORKESTRIX_BOOTSTRAP_ADMIN_PASSWORD;
if (bootstrapEmail && bootstrapPassword) {
  app.database.bootstrapAdmin(bootstrapEmail, bootstrapPassword).catch(console.error);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  return app.handler(req, res);
}
