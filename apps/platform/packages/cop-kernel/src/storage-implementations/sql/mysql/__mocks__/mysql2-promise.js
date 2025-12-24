class MockMysqlConnection {
  constructor() {
    this.calls = {
      execute: [],
      query: [],
      beginTransaction: [],
      commit: [],
      rollback: [],
      end: [],
      release: [],
    };
    this.results = {};
  }
  async execute(sql, params) {
    this.calls.execute.push({ sql, params });
    if (this.results[sql]) {
      return [this.results[sql]];
    }
    // Default mock results for common operations
    if (sql.startsWith("INSERT") || sql.startsWith("UPDATE") || sql.startsWith("DELETE")) {
      return [{ affectedRows: 1, insertId: 1 }]; // Simulate affected rows and last insert ID
    }
    if (sql.startsWith("SELECT") && !sql.includes("LIMIT 1")) {
      return [
        [
          { id: 1, name: "test" },
          { id: 2, name: "test2" },
        ],
      ]; // Simulate multiple rows for 'all'
    }
    if (sql.startsWith("SELECT") && sql.includes("LIMIT 1")) {
      return [[{ id: 1, name: "test" }]]; // Simulate single row for 'get'
    }
    return [[]];
  }

  async query(sql, params) {
    this.calls.query.push({ sql, params });
    return this.execute(sql, params);
  }

  async beginTransaction() {
    this.calls.beginTransaction.push({});
  }

  async commit() {
    this.calls.commit.push({});
  }

  async rollback() {
    this.calls.rollback.push({});
  }

  async end() {
    this.calls.end.push({});
  }

  async release() {
    this.calls.release.push({});
  }
}

// Mock the 'mysql2' module to return our MockMysqlConnection
const mockMysql2 = {
  createConnection: async () => {
    return new MockMysqlConnection();
  },
  createPool: (options) => {
    const mockConnection = new MockMysqlConnection();
    return {
      getConnection: async () => new MockMysqlConnection(),
      execute: async (sql, params) => mockConnection.execute(sql, params),
      query: async (sql, params) => mockConnection.query(sql, params),
      end: async () => mockConnection.end(),
      mockConnection: mockConnection, // Expose for testing
    };
  },
};

export default mockMysql2;
