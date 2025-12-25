type Row = Record<string, any>;

export interface DMLResult {
  rowsAffected: number;
  lastInsertId?: number;
}

export interface GenericConnection {
  run(sql: string, params?: any[]): Promise<DMLResult>;
  get<T = Row>(sql: string, params?: any[]): Promise<T | undefined>;
  all<T = Row>(sql: string, params?: any[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export interface TransactionDriver {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export type DriverType = "sqlite" | "postgres" | "mysql";

export interface ConnectionConfig {
  uri: string;
  driverType: DriverType;
  [key: string]: any;
}

export interface DatabaseDriver extends GenericConnection {
  transaction<T>(callback: (trx: TransactionDriver) => Promise<T>): Promise<T>;
  release(): Promise<void>;
}
