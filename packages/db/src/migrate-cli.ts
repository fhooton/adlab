import { openDb } from "./client";

const handle = await openDb({
  url: process.env.DATABASE_URL,
  dataDir: `${process.env.ADLAB_DATA_DIR ?? ".adlab"}/pglite`,
});
await handle.migrate();
await handle.close();
console.log(JSON.stringify({ ok: true, kind: handle.kind }));
