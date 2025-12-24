export class DatabaseService {
  constructor(configOrConnection) {
    if (typeof configOrConnection === "object" && "driverType" in configOrConnection) {
      this.config = configOrConnection;
      this.isExternalConnection = false;
      this.connection = null;
    } else {
      this.connection = configOrConnection;
      this.isExternalConnection = true;
      this.config = null;
    }
  }

  async ensureConnection() {
    if (this.connection && !this.isExternalConnection) return this.connection;
    if (this.isExternalConnection) return this.connection;

    if (!this.config || !this.config.driverType)
      throw new Error("Configuration de connexion manquante ou type de driver non spécifié.");

    let createConnectionFn;
    switch (this.config.driverType) {
      case "postgres":
        if (typeof process !== "undefined" && process.versions && process.versions.node) {
          const { createNodePostgresConnection } = await import("../sql/postgres/node-postgres.js");
          createConnectionFn = createNodePostgresConnection;
        } else throw new Error("PostgreSQL n'est supporté que dans un environnement Node.js.");
        break;
      case "sqlite":
        if (typeof Deno !== "undefined") {
          const { createDenoSqliteConnection } = await import("../sql/sqlite/deno-sqlite.js");
          createConnectionFn = createDenoSqliteConnection;
        } else if (typeof process !== "undefined" && process.versions && process.versions.node) {
          const { createNodeSqliteConnection } = await import("../sql/sqlite/node-sqlite.js");
          createConnectionFn = createNodeSqliteConnection;
        } else if (typeof window !== "undefined" || typeof self !== "undefined") {
          const { createBrowserSqliteConnection } = await import("../sql/sqlite/browser-sqlite.js");
          createConnectionFn = createBrowserSqliteConnection;
        } else throw new Error("SQLite n'est supporté dans aucun environnement détecté.");
        break;
      case "mysql":
        if (typeof process !== "undefined" && process.versions && process.versions.node) {
          const { createNodeMySQLConnection } = await import("../sql/mysql/node-mysql.js");
          createConnectionFn = createNodeMySQLConnection;
        } else throw new Error("MySQL n'est supporté que dans un environnement Node.js.");
        break;
      default:
        throw new Error(`Type de driver SQL inconnu: ${this.config.driverType}`);
    }

    if (createConnectionFn) this.connection = await createConnectionFn(this.config);
    else
      throw new Error(
        "Impossible de trouver une fonction de création de connexion pour le driver spécifié."
      );

    return this.connection;
  }

  async run(sql, params) {
    const conn = await this.ensureConnection();
    return conn.run(sql, params);
  }

  async get(sql, params) {
    const conn = await this.ensureConnection();
    return conn.get(sql, params);
  }

  async all(sql, params) {
    const conn = await this.ensureConnection();
    return conn.all(sql, params);
  }

  async exec(sql) {
    const conn = await this.ensureConnection();
    return conn.exec(sql);
  }

  async transaction(callback) {
    const conn = await this.ensureConnection();
    return conn.transaction(callback);
  }

  async release() {
    if (!this.isExternalConnection && this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}
