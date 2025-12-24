export class DenoSqliteConnection {
  constructor(config) {
    this.worker = new Worker(new URL("./sqlite-worker.js", import.meta.url).href, {
      type: "module",
    });
    this.config = config;
    this.messageId = 0;
    this.callbacks = new Map();

    this.worker.onmessage = (e) => {
      const { id, result, error } = e.data;
      if (this.callbacks.has(id)) {
        if (error) this.callbacks.get(id).reject(new Error(error));
        else this.callbacks.get(id).resolve(result);
        this.callbacks.delete(id);
      }
    };
  }

  async init() {
    return this._postMessage("init", { filename: this.config.uri });
  }

  _postMessage(method, data = {}) {
    const id = this.messageId++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.worker.postMessage({ id, method, ...data });
    });
  }

  async run(sql, params) {
    const result = await this._postMessage("run", { sql, params });
    return { rowsAffected: result.rowsAffected, lastInsertId: result.lastInsertId };
  }

  async get(sql, params) {
    return this._postMessage("get", { sql, params });
  }

  async all(sql, params) {
    return this._postMessage("all", { sql, params });
  }

  async exec(sql) {
    await this._postMessage("exec", { sql });
  }

  async close() {
    await this._postMessage("close");
    this.worker.terminate();
  }

  async transaction(callback) {
    throw new Error("La méthode 'transaction' doit être implémentée par l'adaptateur spécifique.");
  }
}

export async function createDenoSqliteConnection(config) {
  const connection = new DenoSqliteConnection(config);
  await connection.init();
  return connection;
}
