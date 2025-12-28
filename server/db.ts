import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const { Pool } = pg;

// DATABASE_URL is optional during Supabase migration
// New features use Supabase client directly
let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  db = drizzle(pool);
} else {
  console.warn('DATABASE_URL not set - legacy Drizzle features will be unavailable. Using Supabase for new features.');
}

export { pool, db };

