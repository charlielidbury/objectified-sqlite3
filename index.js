const escape2 = require("sql-template-strings");
const sqlstring = require("sqlstring");
const sqlite = require("better-sqlite3");
const md5 = require("md5");

function addGetters(db, stmt) {
  const columns = stmt
    .columns()
    .filter(c => c.table)
    .map(({ table, column, name }) => ({
      name,
      rel: db.schema[table] && db.schema[table][column]
    }))
    .filter(c => c.rel);

  return row => {
    const rawRow = { ...row };

    // adds getters to object
    columns.forEach(({ name, rel: { parent, children } }) => {
      if (parent)
        Object.defineProperty(row, name, {
          get: () => parent.stmt.get(rawRow[name])
        });

      if (children)
        children.forEach(child => {
          Object.defineProperty(row, child.manyTable + "s", {
            get: () => child.stmt.all(rawRow[child.oneColumn])
          });
        });
    });

    return row;
  };
}

function generateSchema(db) {
  const schema = {
    /*
    table: {
      column1: {
        parent: relationship, // { oneTable, oneColumn, manyTable, manyColumn }
      },
      column2: {
        children: [relationship]
      }
    }
  */
  };

  db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
    .all()
    .forEach(({ name }) => {
      schema[name] = {};
    });

  // puts all parents in schema
  Object.keys(schema).forEach(manyTable => {
    db.prepare(`PRAGMA foreign_key_list("${manyTable}")`)
      .all()
      .forEach(({ table: oneTable, from: manyColumn, to: oneColumn }) => {
        schema[manyTable][manyColumn] = {
          parent: {
            oneTable,
            oneColumn: oneColumn || "rowid",
            manyTable,
            manyColumn
          },
          children: []
        };
      });
  });

  // fills in the children
  Object.values(schema).forEach(obj =>
    Object.values(obj).forEach(({ parent }) => {
      if (!parent) return;

      const { oneTable, oneColumn } = parent;

      if (!schema[oneTable][oneColumn])
        schema[oneTable][oneColumn] = {
          children: []
        };

      schema[oneTable][oneColumn].children.push(parent);
    })
  );

  return schema;
}

function addStatementsToSchema(db) {
  Object.values(db.schema).forEach(table =>
    Object.values(table).forEach(({ parent, children }) => {
      if (parent)
        parent.stmt = db.prepare`
        SELECT * FROM ?${parent.oneTable}
        WHERE ?${parent.oneColumn} = ?
      `;

      if (children)
        children.forEach(child => {
          child.stmt = db.prepare`
            SELECT * FROM ?${child.manyTable}
            WHERE ?${child.manyColumn} = ?
          `;
        });
    })
  );
}

function createDatabase() {
  const db = sqlite(...arguments);
  const schema = generateSchema(db);

  const obj = {
    db,

    schema,

    escape() {
      const { query, values } = escape2(...arguments);

      const funcVals = values.map(value => {
        if (typeof value !== "function") return value;

        const funcName = "AUTO_FUNC_" + md5(value.toString());

        db.function(funcName, value);

        return funcName;
      });

      return sqlstring.format(query, funcVals);
    },

    prepare() {
      const str = obj.escape(...arguments);

      let stmt;
      try {
        stmt = db.prepare(str);
      } catch (err) {
        throw err;
      }
      const mapFn = addGetters(obj, stmt);

      stmt._get = stmt.get;
      stmt.get = function () {
        return mapFn(stmt._get(...arguments));
      };

      stmt._all = stmt.all;
      stmt.all = function () {
        return stmt._all(...arguments).map(mapFn);
      };

      delete stmt.iterate;

      return stmt;
    },

    sql() {
      const stmt = obj.prepare(...arguments);

      return stmt.all();
    }
  };

  addStatementsToSchema(obj);

  return obj;
}

module.exports = createDatabase;
