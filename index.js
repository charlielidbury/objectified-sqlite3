const escape = require("sql-template-strings");
const sqlstring = require("sqlstring");
const sqlite = require("better-sqlite3");

module.exports = class {
  constructor(path) {
    this.db = sqlite(path);
    this.schema = this.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all()
      .map(({ name }) =>
        db
          .prepare(`PRAGMA foreign_key_list("${name}")`)
          .all()
          .map(({ table, from, to }) => ({
            localTable: name,
            localColumn: from || "rowid",
            foreignTable: table,
            foreignColumn: to || "rowid"
          }))
      )
      .flat();
  }

  _addGetters(stmt) {
    const parents = [];
    const children = [];

    stmt.columns().forEach(({ table, column, name }) => {
      fks.forEach(
        ({ localTable, localColumn, foreignTable, foreignColumn }) => {
          if (table === localTable && column === localColumn) {
            // parent
            parents.push({
              name,
              foreignColumn,
              foreignTable
            });
          } else if (table === foreignTable && column === foreignColumn) {
            // child
            children.push({
              localTable,
              localColumn,
              foreignTable,
              foreignColumn
            });
          }
        }
      );
    });

    return row => {
      const rawRow = { ...row };

      // puts parents into object
      parents.forEach(({ name, foreignColumn, foreignTable }) => {
        Object.defineProperty(row, name, {
          get: this.prepare`
            SELECT * FROM ?${foreignTable}
            WHERE ?${foreignColumn} = ${rawRow[name]}
          `.get
        });
      });

      // puts children into object
      children.forEach(({ localTable, localColumn, foreignColumn }) => {
        Object.defineProperty(row, localTable + "s", {
          get: this.prepare`
            SELECT * FROM ?${localTable}
            WHERE ?${localColumn} = ${rawRow[foreignColumn]}
          `.all
        });
      });

      return row;
    };
  }

  escape() {
    const { query, values } = escape(...arguments);
    sqlstring.format(query, values);
  }

  prepare() {
    const str = this.escape(...arguments);
    const stmt = this.db.prepare(str);
    const mapFn = this._addGetters(stmt);

    stmt._get = stmt.get;
    stmt.get = function() {
      return mapFn(stmt._get(...arguments));
    };

    stmt._all = stmt.all;
    stmt.all = function() {
      return stmt._all(...arguments).map(mapFn);
    };

    delete stmt.iterate;

    return stmt;
  }

  sql() {
    const stmt = this.prepare(...arguments);

    return stmt.all();
  }
};
