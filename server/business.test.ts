import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import {
  openDatabase,
  initializeDatabase,
  setDatabaseForTests,
} from "./db/database.ts";
import { createApp } from "./app.ts";
import { generateEmailHtml } from "./services/html.service.ts";
import type { EmailDraft } from "../src/types/email.ts";

test("business database, APIs, calculations, backups and HTML generation", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "jsn-business-test-"));
  const dbPath = join(root, "business.sqlite");
  process.env.DATABASE_PATH = dbPath;
  process.env.BACKUP_DIR = join(root, "backups");
  process.env.GMAIL_USER = "";
  process.env.GMAIL_APP_PASSWORD = "";
  const db = initializeDatabase();
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;
  const call = async (path: string, method = "GET", body?: unknown) => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: (await r.json()) as any };
  };
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setDatabaseForTests();
    delete process.env.DATABASE_PATH;
    delete process.env.BACKUP_DIR;
    rmSync(root, { recursive: true, force: true });
  });

  await t.test(
    "new database, repeatable migrations, foreign keys and empty aggregation",
    async () => {
      assert.deepEqual(db.pragma("foreign_keys"), [{ foreign_keys: 1 }]);
      assert.deepEqual(db.pragma("integrity_check"), [
        { integrity_check: "ok" },
      ]);
      assert.equal(
        (
          db
            .prepare("SELECT COUNT(*) count FROM schema_migrations")
            .get() as any
        ).count,
        1,
      );
      const reopened = openDatabase(dbPath);
      reopened.close();
      assert.equal(
        (
          db
            .prepare("SELECT COUNT(*) count FROM schema_migrations")
            .get() as any
        ).count,
        1,
      );
      assert.equal(
        db.prepare("SELECT COUNT(*) count FROM clients").get() &&
          (db.prepare("SELECT COUNT(*) count FROM clients").get() as any).count,
        0,
      );
      assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
      const empty = await call("/dashboard");
      assert.equal(empty.status, 200);
      assert.equal(empty.data.clients, 0);
      assert.equal(empty.data.outstanding_minor, 0);
    },
  );

  await t.test(
    "validates clients; calculates quotation; converts once; tracks payment and task",
    async () => {
      assert.equal((await call("/clients", "POST", { name: "" })).status, 400);
      const made = await call("/clients", "POST", {
        name: "A Client",
        email: "CLIENT@example.com",
      });
      assert.equal(made.status, 201);
      const client = made.data;
      assert.equal(client.email, "client@example.com");
      const quote = await call("/quotations", "POST", {
        client_id: client.id,
        title: "Brand identity",
        items: [
          { description: "Logo", quantity: 2, unit_price_minor: 10000 },
          { description: "Guide", quantity: 1, unit_price_minor: 5000 },
        ],
        discount_type: "percentage",
        discount_value: 10,
      });
      assert.equal(quote.status, 201);
      assert.equal(quote.data.subtotal_minor, 25000);
      assert.equal(quote.data.discount_minor, 2500);
      assert.equal(quote.data.total_minor, 22500);
      assert.equal(
        (
          await call("/quotations", "POST", {
            client_id: client.id,
            title: "Bad",
            items: [{ description: "X", quantity: -1, unit_price_minor: 2 }],
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("/quotations", "POST", {
            client_id: client.id,
            title: "Bad",
            items: [{ description: "X", quantity: 1, unit_price_minor: -1 }],
          })
        ).status,
        400,
      );
      const fixed = await call("/quotations", "POST", {
        client_id: client.id,
        title: "Fixed discount",
        items: [
          {
            description: "Half paise rounding",
            quantity: 0.5,
            unit_price_minor: 101,
          },
        ],
        discount_type: "fixed",
        discount_value: 0.26,
      });
      assert.equal(fixed.data.subtotal_minor, 51);
      assert.equal(fixed.data.discount_minor, 26);
      assert.equal(fixed.data.total_minor, 25);
      assert.equal(
        (
          await call("/quotations", "POST", {
            client_id: client.id,
            title: "Excess discount",
            items: [
              { description: "Logo", quantity: 1, unit_price_minor: 100 },
            ],
            discount_type: "fixed",
            discount_value: 2,
          })
        ).status,
        400,
      );
      assert.equal(
        (await call(`/quotations/${quote.data.id}/convert`, "POST", {})).status,
        409,
      );
      assert.equal(
        (
          await call(`/quotations/${quote.data.id}/status`, "PATCH", {
            status: "accepted",
          })
        ).status,
        200,
      );
      const first = await call(
        `/quotations/${quote.data.id}/convert`,
        "POST",
        {},
      );
      assert.equal(first.status, 201);
      assert.equal(first.data.agreed_amount_minor, 22500);
      const again = await call(
        `/quotations/${quote.data.id}/convert`,
        "POST",
        {},
      );
      assert.equal(again.data.id, first.data.id);
      const quotationList = await call("/quotations");
      assert.ok(
        quotationList.data.some((row: any) => row.id === quote.data.id),
      );
      const orderList = await call("/orders");
      const listedOrder = orderList.data.find(
        (row: any) => row.id === first.data.id,
      );
      assert.equal(listedOrder.outstanding_minor, 22500);
      assert.equal(
        (
          await call(`/orders/${first.data.id}/status`, "PATCH", {
            status: "in_progress",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await call(`/orders/${first.data.id}/payments`, "POST", {
            amount_minor: 5000,
          })
        ).data.outstanding_minor,
        17500,
      );
      assert.equal(
        (
          await call(`/orders/${first.data.id}/payments`, "POST", {
            amount_minor: 18000,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("/tasks", "POST", {
            order_id: first.data.id,
            title: "Prepare files",
            due_date: "2026-10-20",
          })
        ).status,
        201,
      );
      const task = (await call("/tasks")).data[0];
      assert.equal(
        (
          await call(`/tasks/${task.id}/status`, "PATCH", {
            status: "completed",
          })
        ).status,
        200,
      );
      const dashboard = await call("/dashboard");
      assert.equal(dashboard.data.clients, 1);
      assert.equal(dashboard.data.active_orders, 1);
      assert.equal(dashboard.data.outstanding_minor, 17500);
    },
  );

  await t.test(
    "backs up a consistent database and restores only a valid snapshot",
    async () => {
      const download = await fetch(`${base}/backup`);
      assert.equal(download.status, 200);
      assert.match(
        download.headers.get("content-type") || "",
        /application\/octet-stream|application\/vnd\.sqlite3/,
      );
      const saved = join(root, "backup.sqlite");
      await db.backup(saved);
      const backupDb = openDatabase(saved);
      assert.equal(
        (backupDb.prepare("SELECT COUNT(*) count FROM clients").get() as any)
          .count,
        1,
      );
      backupDb.close();
      const before = (
        db.prepare("SELECT COUNT(*) count FROM clients").get() as any
      ).count;
      const invalid = join(root, "invalid.sqlite");
      writeFileSync(invalid, "not a database");
      const invalidForm = new FormData();
      invalidForm.append(
        "backup",
        new Blob([readFileSync(invalid)], { type: "application/octet-stream" }),
        "invalid.sqlite",
      );
      const rejected = await fetch(`${base}/restore`, {
        method: "POST",
        body: invalidForm,
      });
      assert.equal(rejected.status, 400);
      assert.equal(
        (db.prepare("SELECT COUNT(*) count FROM clients").get() as any).count,
        before,
      );
      const validForm = new FormData();
      validForm.append(
        "backup",
        new Blob([readFileSync(saved)], { type: "application/octet-stream" }),
        "backup.sqlite",
      );
      const restored = await fetch(`${base}/restore`, {
        method: "POST",
        body: validForm,
      });
      assert.equal(restored.status, 200);
      assert.equal(
        (
          initializeDatabase()
            .prepare("SELECT COUNT(*) count FROM clients")
            .get() as any
        ).count,
        1,
      );
      assert.ok(
        readdirSync(root).some((name) =>
          name.startsWith("business.sqlite.recovery-"),
        ),
      );
    },
  );

  await t.test("keeps the existing email HTML generator usable", () => {
    const draft = {
      subject: "Hello",
      greeting: "Hi",
      title: "Note",
      body: "Safe <b>formatting</b>",
      sections: [],
      closing: "Thanks",
      signature: "JSN Designs",
      typography: {},
    } as unknown as EmailDraft;
    const html = generateEmailHtml(draft, "cid:jsn-logo");
    assert.match(html, /cid:jsn-logo/);
    assert.match(html, /Hello/);
    assert.match(html, /<b>formatting<\/b>/);
  });

  await t.test(
    "email API rejects invalid input without sending mail",
    async () => {
      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({ to: "not-an-address", subject: "Bad" }),
      );
      const invalid = await fetch(`${base}/email/send`, {
        method: "POST",
        body: form,
      });
      assert.equal(invalid.status, 400);
      const invalidCopy = new FormData();
      invalidCopy.append(
        "payload",
        JSON.stringify({
          to: "client@example.com",
          cc: "bad address",
          subject: "Bad",
        }),
      );
      assert.equal(
        (
          await fetch(`${base}/email/send`, {
            method: "POST",
            body: invalidCopy,
          })
        ).status,
        400,
      );
      const config = await fetch(`${base}/email/config`);
      assert.equal(config.status, 200);
      assert.equal("password" in ((await config.json()) as object), false);
    },
  );
});
