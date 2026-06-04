import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const dbPath = process.env.PGLITE_DB_PATH || "/data/factory";
const host = process.env.PGLITE_HOST || "0.0.0.0";
const port = Number(process.env.PGLITE_PORT || "5432");

const db = await PGlite.create({
  dataDir: dbPath,
  extensions: { vector }
});

const server = new PGLiteSocketServer({
  db,
  host,
  port
});

await server.start();
console.log(`PGlite socket server listening on ${host}:${port} using ${dbPath}`);

async function shutdown() {
  await server.stop();
  await db.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
