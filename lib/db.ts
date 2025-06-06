import { Pool } from 'pg'

// Ensure the DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

let pool: Pool

// Use a singleton pattern to manage the connection pool
if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  })
} else {
  // In development, use a global variable to preserve the pool across hot reloads
  // biome-ignore lint/suspicious/noGlobalAssign: This is a common pattern for DB connections in development
  const globalWithDb = global as typeof globalThis & {
    _db_pool: Pool;
  };

  if (!globalWithDb._db_pool) {
    globalWithDb._db_pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  pool = globalWithDb._db_pool;
}

export const db = pool 