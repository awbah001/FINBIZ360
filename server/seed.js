import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { openDb, id, hashPassword, atomic, audit } from "./db.js";

export function seed(db, password = randomBytes(18).toString("base64url")) {
  if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n)
    throw new Error(
      "Database already contains users. Seed only an empty demo database.",
    );
  if (password.length < 12)
    throw new Error("Demo password must contain at least 12 characters.");
  atomic(db, () => {
    db.prepare(
      "UPDATE settings SET name='Freetown Trading Co.',mode='demo' WHERE id=1",
    ).run();
    const roles = ["manager", "finance", "cashier", "auditor", "admin"];
    const names = [
      "Aminata Kamara",
      "Mohamed Sesay",
      "Mariama Conteh",
      "Ibrahim Bangura",
      "System Administrator",
    ];
    const users = roles.map((role, i) => {
      const uid = id();
      db.prepare("INSERT INTO users VALUES (?,?,?,?,?,1)").run(
        uid,
        names[i],
        `${role}@finbiz.demo`,
        hashPassword(password),
        role,
      );
      return uid;
    });
    const accounts = [
      ["Cash register", "cash", "Cash"],
      ["Orange Money", "mobile", "Orange"],
      ["Business bank", "bank", "Bank"],
    ].map(([name, channel, provider]) => {
      const aid = id();
      db.prepare(
        "INSERT INTO accounts (id,name,channel,provider) VALUES (?,?,?,?)",
      ).run(aid, name, channel, provider);
      return aid;
    });
    const contacts = [
      ["Kallon General Stores", "customer", "076 000 100"],
      ["Atlantic Supplies", "supplier", "077 000 200"],
      ["Sesay & Sons", "customer", "030 000 300"],
    ].map(([name, type, phone]) => {
      const cid = id();
      db.prepare(
        "INSERT INTO contacts (id,name,type,phone) VALUES (?,?,?,?)",
      ).run(cid, name, type, phone);
      return cid;
    });
    const today = new Date();
    for (let day = 27; day >= 0; day--) {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - day);
      for (let j = 0; j < 2; j++) {
        const tid = id(),
          incoming = j === 0,
          pending = day < 3 && !incoming;
        db.prepare(
          "INSERT INTO transactions (id,date,amount,direction,account_id,reference,description,category,contact_id,user_id,approval,request_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          tid,
          date.toISOString().slice(0, 10),
          incoming ? (1450 + day * 97) * 100 : (180 + day * 23) * 100,
          incoming ? "in" : "out",
          accounts[day % 3],
          `DEMO-${String(day).padStart(2, "0")}-${j}`,
          incoming ? "Retail sales receipt" : "Supplier and operating payment",
          incoming ? "Sales" : day % 2 ? "Supplies" : "Operations",
          incoming ? contacts[0] : contacts[1],
          users[1],
          pending ? "pending" : incoming ? "not_required" : "approved",
          id(),
        );
      }
    }
    const invoice = id(),
      issued = today.toISOString().slice(0, 10);
    const due = new Date(today);
    due.setUTCDate(due.getUTCDate() + 14);
    db.prepare(
      "INSERT INTO invoices (id,number,contact_id,issued,due,amount,description,user_id) VALUES (?,?,?,?,?,?,?,?)",
    ).run(
      invoice,
      "INV-2026-001",
      contacts[2],
      issued,
      due.toISOString().slice(0, 10),
      1850000,
      "Wholesale trading order",
      users[1],
    );
    audit(db, users[0], "demo.seed", "organisation", { synthetic: true });
  });
  return password;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const db = openDb(process.env.DB_PATH || "./data/finbiz-demo.db");
  try {
    const password = seed(db, process.env.DEMO_PASSWORD);
    console.log(
      `Synthetic demo ready.\nAccounts: manager, finance, cashier, auditor, admin @finbiz.demo\nGenerated demo password: ${password}\nKeep this password locally. These accounts must not be used in production.`,
    );
  } finally {
    db.close();
  }
}
