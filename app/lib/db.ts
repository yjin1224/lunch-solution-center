import { neon } from "@neondatabase/serverless";

// .env.local 에 넣어둔 DATABASE_URL 사용
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const sql = neon(process.env.DATABASE_URL);
