import { DB } from "https://deno.land/x/sqlite@v3.4.0/mod.ts";

let db;

self.onmessage = (e) => {
  const { id, method, sql, params, filename } = e.data;

  try {
    if (method === "init") {
      db = new DB(filename);
      self.postMessage({ id, status: "ready" });
      return;
    }

    if (!db) throw new Error("Database not initialized in worker.");

    let result;
    switch (method) {
      case "run":
        db.query(sql, params);
        result = { rowsAffected: db.changes, lastInsertId: db.lastInsertRowId };
        break;
      case "get":
        result = db.query(sql, params).next().value;
        break;
      case "all":
        result = [...db.query(sql, params)];
        break;
      case "exec":
        db.execute(sql);
        result = undefined;
        break;
      case "close":
        db.close();
        db = undefined;
        result = undefined;
        break;
      default:
        throw new Error(`Méthode inconnue: ${method}`);
    }
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
