// Minimal ambient typing for Node's built-in `node:sqlite` module.
//
// This module shipped in Node 22.5+ (stable without a flag from Node
// 22.13+/23.4+; this app targets Node 22.5+, see package.json "engines").
// The project's installed @types/node (^20.14.15) predates it, and the npm
// registry is unreachable from where this was built, so a newer @types/node
// that would ship real definitions can't be installed. This file declares
// only the small surface RecMap actually uses (see lib/db.ts) rather than
// the module's full API.
declare module "node:sqlite" {
  export interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    run(...params: unknown[]): StatementResultingChanges;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  }

  export class DatabaseSync {
    constructor(path: string, options?: { open?: boolean });
    open(): void;
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
