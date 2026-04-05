import "dotenv/config";
import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  console.log("Connecting to Turso...");

  const migrationPath = path.join(
    __dirname,
    "../prisma/migrations/20260405001637_init/migration.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf-8");

  // Split by semicolons and execute each statement
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Executing ${statements.length} statements...`);

  for (const stmt of statements) {
    try {
      await client.execute(stmt);
      const preview = stmt.substring(0, 60).replace(/\n/g, " ");
      console.log(`  ✓ ${preview}...`);
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        const preview = stmt.substring(0, 60).replace(/\n/g, " ");
        console.log(`  ⊘ ${preview}... (already exists)`);
      } else {
        throw e;
      }
    }
  }

  console.log("\nSchema pushed to Turso successfully!");
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
