// Runs every file in supabase/tests against a database and prints pass or fail for each.
// Each file runs inside a transaction that is always rolled back, so no data is ever left behind.
//
//   TEST_DATABASE_URL=postgres://... npm run test:db
//
// Use a copy of the database (a Supabase branch) or a local one. The tests only create and then roll back their own rows, but they do run real queries.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.log('Skipping database tests: set TEST_DATABASE_URL to run them.');
  process.exit(0);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'tests');
const prelude = readFileSync(join(dir, '_prelude.sql'), 'utf8');
const files = readdirSync(dir).filter((f) => /^\d.*\.sql$/.test(f)).sort();

const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
await client.connect();

let failed = 0;
for (const f of files) {
  const started = Date.now();
  try {
    await client.query('begin');
    await client.query(prelude);
    await client.query(readFileSync(join(dir, f), 'utf8'));
    console.log(`PASS  ${f}  (${Date.now() - started} ms)`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${f}\n      ${String(e.message).split('\n')[0]}`);
  } finally {
    await client.query('rollback').catch(() => {});
  }
}
await client.end();
console.log(failed ? `\n${failed} of ${files.length} database test files failed.` : `\nAll ${files.length} database test files passed.`);
process.exit(failed ? 1 : 0);
