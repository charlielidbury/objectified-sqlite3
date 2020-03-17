const escape2 = require("sql-template-strings");
const sqlstring = require("sqlstring");
const sqlite = require("better-sqlite3");

function addGetters(db, stmt) {
  const parents = [];
  const children = [];

  stmt.columns().forEach(({ table, column, name }) => {
    const relationship = db.schema[table][column];
    if (!relationship) return;

    // parents
    parents.push(relationship);

    // children
    children.push()
  });

  return row => {
    const rawRow = { ...row };

    // puts parents into object
    parents.forEach(({ name, foreignColumn, foreignTable }) => {
      Object.defineProperty(row, name, {
        get: db.prepare`
            SELECT * FROM ?${foreignTable}
            WHERE ?${foreignColumn} = ${rawRow[name]}
          `.get
      });
    });

    // puts children into object
    children.forEach(({ localTable, localColumn, foreignColumn }) => {
      Object.defineProperty(row, localTable + "s", {
        get: db.prepare`
            SELECT * FROM ?${localTable}
            WHERE ?${localColumn} = ${rawRow[foreignColumn]}
          `.all
      });
    });

    return row;
  };
}

function generateSchema(db) {
  const schema = {};

  db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
    .all()
    .forEach(({ name }) => {
      schema[name] = {
        name,
        parents: {},
        children: {},
      };
    });

  // 'one' and 'many' reference the "one to many" relationship
  Object.values(schema).forEach(manyTable => {
    db.prepare(`PRAGMA foreign_key_list("${manyTable.name}")`)
      .all()
      .forEach(({ table: oneTableName, from: manyColumn, to: oneColumn }) => {
        const oneTable = schema[oneTableName];
        const relationship = {
          oneTable,
          oneColumn,
          manyTable,
          manyColumn
        };
        // parent
        manyTable.parents[manyColumn] = relationship;
        // children
        oneTable.children[manyColumn] = relationship;
      });
  });

  return schema;
}

function createDatabase() {
  const db = sqlite(...arguments);
  const schema = generateSchema(db);

  const obj = {
    db,

    schema,

    escape() {
      const { query, values } = escape2(...arguments);
      return sqlstring.format(query, values);
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
      stmt.get = function() {
        return mapFn(stmt._get(...arguments));
      };

      stmt._all = stmt.all;
      stmt.all = function() {
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

  return obj;
}

module.exports = createDatabase;
