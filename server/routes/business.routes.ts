import { Router } from "express";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import multer from "multer";
import { z } from "zod";
import {
  getDatabase,
  removeDatabaseFile,
  restoreDatabase,
} from "../db/database.ts";
import {
  clientSchema,
  orderSchema,
  orderStatusSchema,
  paymentSchema,
  quotationSchema,
  taskSchema,
  taskStatusSchema,
} from "../schemas/business.ts";

const router = Router();
const restoreUpload = multer({
  dest: join(
    process.env.LOCALAPPDATA || process.env.APPDATA || process.cwd(),
    "JSN Designs Business Studio",
    "restore-temp",
  ),
  limits: { files: 1, fileSize: 200 * 1024 * 1024 },
});
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const ref = (prefix: string) =>
  `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
const bad = (res: any, message: string, status = 400) =>
  res.status(status).json({ error: message });
const parsed = <S extends z.ZodType>(
  schema: S,
  body: unknown,
): z.ZodSafeParseResult<z.output<S>> => schema.safeParse(body);

router.get("/dashboard", (_req, res) => {
  const db = getDatabase();
  const counts = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM clients WHERE archived_at IS NULL) clients,
    (SELECT COUNT(*) FROM quotations WHERE status IN ('draft','sent')) open_quotations,
    (SELECT COUNT(*) FROM orders WHERE status NOT IN ('closed','cancelled')) active_orders,
    (SELECT COUNT(*) FROM tasks WHERE status IN ('pending','in_progress')) open_tasks`,
    )
    .get();
  const outstanding = db
    .prepare(
      `SELECT COALESCE(SUM(o.agreed_amount_minor - COALESCE(p.paid,0)),0) amount_minor FROM orders o LEFT JOIN (SELECT order_id,SUM(amount_minor) paid FROM payments GROUP BY order_id) p ON p.order_id=o.id WHERE o.status NOT IN ('cancelled','closed')`,
    )
    .get();
  const upcomingTasks = db
    .prepare(
      `SELECT id,title,due_date,status,priority FROM tasks WHERE status IN ('pending','in_progress') ORDER BY due_date IS NULL,due_date LIMIT 5`,
    )
    .all();
  res.json({
    ...(counts as object),
    outstanding_minor: (outstanding as any).amount_minor,
    upcoming_tasks: upcomingTasks,
  });
});

router.get("/clients", (_req, res) =>
  res.json(
    getDatabase()
      .prepare(
        "SELECT * FROM clients WHERE archived_at IS NULL ORDER BY created_at DESC",
      )
      .all(),
  ),
);
router.post("/clients", (req, res) => {
  const input = parsed(clientSchema, req.body);
  if (!input.success)
    return bad(
      res,
      input.error.issues[0]?.message || "Invalid client details.",
    );
  const db = getDatabase(),
    id = randomUUID(),
    stamp = now();
  try {
    db.prepare(
      "INSERT INTO clients(id,client_code,name,company_name,email,phone,address,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      ref("CL"),
      input.data.name,
      input.data.company_name || null,
      input.data.email || null,
      input.data.phone || null,
      input.data.address || null,
      input.data.notes || null,
      stamp,
      stamp,
    );
  } catch (e) {
    return bad(
      res,
      e instanceof Error && e.message.includes("UNIQUE")
        ? "Client code collision; retry."
        : "Unable to create client.",
      409,
    );
  }
  res.status(201).json(db.prepare("SELECT * FROM clients WHERE id=?").get(id));
});
router.patch("/clients/:id/archive", (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return bad(res, "Invalid client id.");
  const info = getDatabase()
    .prepare(
      "UPDATE clients SET archived_at=?,updated_at=? WHERE id=? AND archived_at IS NULL",
    )
    .run(now(), now(), id.data);
  return info.changes
    ? res.json({ ok: true })
    : bad(res, "Client not found.", 404);
});

router.get("/quotations", (_req, res) =>
  res.json(
    getDatabase()
      .prepare(
        `SELECT q.*,c.name client_name FROM quotations q JOIN clients c ON c.id=q.client_id ORDER BY q.created_at DESC`,
      )
      .all(),
  ),
);
router.post("/quotations", (req, res) => {
  const input = parsed(quotationSchema, req.body);
  if (!input.success)
    return bad(res, input.error.issues[0]?.message || "Invalid quotation.");
  const db = getDatabase(),
    d = input.data,
    id = randomUUID(),
    stamp = now();
  const itemTotals = d.items.map((i) =>
    Math.round(i.quantity * i.unit_price_minor),
  );
  if (itemTotals.some((n) => !Number.isSafeInteger(n)))
    return bad(res, "Line item amount is too large.");
  const subtotal = itemTotals.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(subtotal))
    return bad(res, "Quotation amount is too large.");
  const discount =
    d.discount_type === "percentage"
      ? Math.round((subtotal * d.discount_value) / 100)
      : d.discount_type === "fixed"
        ? Math.round(d.discount_value * 100)
        : 0;
  if (d.discount_type === "fixed" && discount > subtotal)
    return bad(res, "Fixed discount cannot exceed the subtotal.");
  const total = subtotal - discount;
  if (
    !Number.isSafeInteger(discount) ||
    !Number.isSafeInteger(total) ||
    total < 0
  )
    return bad(res, "Quotation amount is invalid.");
  try {
    db.transaction(() => {
      if (
        !db
          .prepare("SELECT 1 FROM clients WHERE id=? AND archived_at IS NULL")
          .get(d.client_id)
      )
        throw new Error("CLIENT_NOT_FOUND");
      db.prepare(
        `INSERT INTO quotations(id,quotation_number,client_id,title,description,subtotal_minor,discount_type,discount_value,discount_minor,total_minor,issue_date,valid_until,terms,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        id,
        ref("QT"),
        d.client_id,
        d.title,
        d.description || null,
        subtotal,
        d.discount_type,
        d.discount_value,
        discount,
        total,
        d.issue_date || today(),
        d.valid_until || null,
        d.terms || null,
        d.notes || null,
        stamp,
        stamp,
      );
      const insert = db.prepare(
        "INSERT INTO quotation_items(id,quotation_id,description,quantity,unit_price_minor,line_total_minor,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
      );
      d.items.forEach((item, index) =>
        insert.run(
          randomUUID(),
          id,
          item.description,
          item.quantity,
          item.unit_price_minor,
          itemTotals[index],
          index,
          stamp,
          stamp,
        ),
      );
    })();
  } catch (e) {
    return bad(
      res,
      e instanceof Error && e.message === "CLIENT_NOT_FOUND"
        ? "Client not found."
        : "Unable to save quotation.",
      e instanceof Error && e.message === "CLIENT_NOT_FOUND" ? 404 : 500,
    );
  }
  res.status(201).json({
    ...(db.prepare("SELECT * FROM quotations WHERE id=?").get(id) as object),
    items: db
      .prepare(
        "SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY sort_order",
      )
      .all(id),
  });
});
router.get("/quotations/:id", (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return bad(res, "Invalid quotation id.");
  const q = getDatabase()
    .prepare("SELECT * FROM quotations WHERE id=?")
    .get(id.data);
  if (!q) return bad(res, "Quotation not found.", 404);
  res.json({
    ...(q as object),
    items: getDatabase()
      .prepare(
        "SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY sort_order",
      )
      .all(id.data),
  });
});
router.patch("/quotations/:id/status", (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id),
    body = z
      .object({
        status: z.enum([
          "draft",
          "sent",
          "accepted",
          "rejected",
          "expired",
          "cancelled",
        ]),
      })
      .safeParse(req.body);
  if (!id.success || !body.success)
    return bad(res, "Invalid quotation status request.");
  const info = getDatabase()
    .prepare("UPDATE quotations SET status=?,updated_at=? WHERE id=?")
    .run(body.data.status, now(), id.data);
  return info.changes
    ? res.json({ ok: true, status: body.data.status })
    : bad(res, "Quotation not found.", 404);
});
router.post("/quotations/:id/convert", (req, res) => {
  const db = getDatabase(),
    id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return bad(res, "Invalid quotation id.");
  const options = z
    .object({ confirm_unaccepted: z.boolean().optional() })
    .safeParse(req.body ?? {});
  if (!options.success)
    return bad(res, "Invalid quotation conversion options.");
  try {
    const order = db.transaction(() => {
      const q = db
        .prepare("SELECT * FROM quotations WHERE id=?")
        .get(id.data) as any;
      if (!q) throw new Error("NOT_FOUND");
      const existing = db
        .prepare("SELECT * FROM orders WHERE quotation_id=?")
        .get(id.data);
      if (existing) return existing;
      if (q.status !== "accepted" && options.data.confirm_unaccepted !== true)
        throw new Error("NOT_ACCEPTED");
      const stamp = now(),
        orderId = randomUUID();
      db.prepare(
        `INSERT INTO orders(id,order_number,client_id,quotation_id,title,description,agreed_amount_minor,currency,order_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        orderId,
        ref("OR"),
        q.client_id,
        q.id,
        q.title,
        q.description,
        q.total_minor,
        q.currency,
        today(),
        stamp,
        stamp,
      );
      return db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
    })();
    res.status(201).json(order);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return bad(
      res,
      message === "NOT_FOUND"
        ? "Quotation not found."
        : message === "NOT_ACCEPTED"
          ? "Only accepted quotations can be converted."
          : "Unable to convert quotation.",
      message === "NOT_FOUND" ? 404 : message === "NOT_ACCEPTED" ? 409 : 500,
    );
  }
});

router.get("/orders", (_req, res) =>
  res.json(
    getDatabase()
      .prepare(
        `SELECT o.*,c.name client_name,COALESCE(p.paid,0) paid_minor,o.agreed_amount_minor-COALESCE(p.paid,0) outstanding_minor FROM orders o JOIN clients c ON c.id=o.client_id LEFT JOIN (SELECT order_id,SUM(amount_minor) paid FROM payments GROUP BY order_id) p ON p.order_id=o.id ORDER BY o.created_at DESC`,
      )
      .all(),
  ),
);
router.post("/orders", (req, res) => {
  const input = parsed(orderSchema, req.body);
  if (!input.success)
    return bad(res, input.error.issues[0]?.message || "Invalid order.");
  const d = input.data,
    db = getDatabase(),
    id = randomUUID(),
    stamp = now();
  if (
    !db
      .prepare("SELECT 1 FROM clients WHERE id=? AND archived_at IS NULL")
      .get(d.client_id)
  )
    return bad(res, "Client not found.", 404);
  db.prepare(
    `INSERT INTO orders(id,order_number,client_id,title,description,requirements,agreed_amount_minor,priority,order_date,due_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    ref("OR"),
    d.client_id,
    d.title,
    d.description || null,
    d.requirements,
    d.agreed_amount_minor,
    d.priority,
    d.order_date || today(),
    d.due_date || null,
    stamp,
    stamp,
  );
  res.status(201).json(db.prepare("SELECT * FROM orders WHERE id=?").get(id));
});
router.patch("/orders/:id/status", (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id),
    input = parsed(orderStatusSchema, req.body);
  if (!id.success || !input.success)
    return bad(res, "Invalid order status request.");
  const delivered = input.data.status === "delivered" ? now() : null;
  const info = getDatabase()
    .prepare(
      "UPDATE orders SET status=?,delivered_at=COALESCE(?,delivered_at),updated_at=? WHERE id=?",
    )
    .run(input.data.status, delivered, now(), id.data);
  return info.changes
    ? res.json({ ok: true })
    : bad(res, "Order not found.", 404);
});
router.post("/orders/:id/payments", (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id),
    input = parsed(paymentSchema, req.body);
  if (!id.success || !input.success)
    return bad(
      res,
      input.success
        ? "Invalid order id."
        : input.error.issues[0]?.message || "Invalid payment.",
    );
  const db = getDatabase(),
    order = db
      .prepare("SELECT agreed_amount_minor,currency FROM orders WHERE id=?")
      .get(id.data) as any;
  if (!order) return bad(res, "Order not found.", 404);
  const paid = (
    db
      .prepare(
        "SELECT COALESCE(SUM(amount_minor),0) total FROM payments WHERE order_id=?",
      )
      .get(id.data) as any
  ).total;
  if (paid + input.data.amount_minor > order.agreed_amount_minor)
    return bad(res, "Payment exceeds the outstanding balance.");
  const d = input.data,
    stamp = now(),
    pid = randomUUID();
  db.prepare(
    "INSERT INTO payments(id,order_id,amount_minor,currency,payment_date,payment_method,reference,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
  ).run(
    pid,
    id.data,
    d.amount_minor,
    order.currency,
    d.payment_date || today(),
    d.payment_method || null,
    d.reference || null,
    d.notes || null,
    stamp,
    stamp,
  );
  res.status(201).json({
    id: pid,
    paid_minor: paid + d.amount_minor,
    outstanding_minor: order.agreed_amount_minor - paid - d.amount_minor,
  });
});
router.get("/orders/:id/payments", (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return bad(res, "Invalid order id.");
  return res.json(
    getDatabase()
      .prepare(
        "SELECT * FROM payments WHERE order_id=? ORDER BY payment_date DESC",
      )
      .all(id.data),
  );
});
router.get("/tasks", (_req, res) =>
  res.json(
    getDatabase()
      .prepare(
        "SELECT t.*,o.order_number FROM tasks t LEFT JOIN orders o ON o.id=t.order_id ORDER BY t.due_date IS NULL,t.due_date,t.created_at DESC",
      )
      .all(),
  ),
);
router.post("/tasks", (req, res) => {
  const input = parsed(taskSchema, req.body);
  if (!input.success)
    return bad(res, input.error.issues[0]?.message || "Invalid task.");
  const d = input.data,
    db = getDatabase();
  if (
    d.order_id &&
    !db.prepare("SELECT 1 FROM orders WHERE id=?").get(d.order_id)
  )
    return bad(res, "Order not found.", 404);
  const id = randomUUID(),
    stamp = now();
  db.prepare(
    "INSERT INTO tasks(id,order_id,title,description,status,priority,due_date,completed_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    d.order_id || null,
    d.title,
    d.description || null,
    d.status,
    d.priority,
    d.due_date || null,
    d.status === "completed" ? stamp : null,
    stamp,
    stamp,
  );
  res.status(201).json(db.prepare("SELECT * FROM tasks WHERE id=?").get(id));
});
router.patch("/tasks/:id/status", (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id),
    input = parsed(taskStatusSchema, req.body);
  if (!id.success || !input.success)
    return bad(res, "Invalid task status request.");
  const stamp = input.data.status === "completed" ? now() : null,
    info = getDatabase()
      .prepare(
        "UPDATE tasks SET status=?,completed_at=?,updated_at=? WHERE id=?",
      )
      .run(input.data.status, stamp, now(), id.data);
  return info.changes
    ? res.json({ ok: true })
    : bad(res, "Task not found.", 404);
});

router.get("/backup", async (_req, res) => {
  try {
    const dir =
      process.env.BACKUP_DIR ||
      join(
        process.env.LOCALAPPDATA || process.env.APPDATA || process.cwd(),
        "JSN Designs Business Studio",
        "backups",
      );
    mkdirSync(dir, { recursive: true });
    const target = join(
      dir,
      `jsn-business-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
    );
    await getDatabase().backup(target);
    res.download(target);
  } catch {
    return bad(res, "Unable to create database backup.", 500);
  }
});
router.post("/restore", restoreUpload.single("backup"), (req, res) => {
  if (!req.file) return bad(res, "Choose a SQLite backup file.");
  try {
    restoreDatabase(req.file.path);
    return res.json({ ok: true });
  } catch {
    return bad(
      res,
      "Backup validation failed or restore could not complete. The current database was preserved.",
      400,
    );
  } finally {
    if (req.file) removeDatabaseFile(req.file.path);
  }
});
export default router;
