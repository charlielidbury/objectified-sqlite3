# objectified-sqlite3 ![npm](https://img.shields.io/npm/v/objectified-sqlite3) ![npm bundle size](https://img.shields.io/bundlephobia/min/objectified-sqlite3)

![NPM detials](https://nodei.co/npm/objectified-sqlite3.png?downloads=true)

Blurs the lines between SQL and JavaScript.

- Replaces forgein key references with getters that follow the reference
- Safely escapes values and table/column names
- Useable via template literals

## Installation

```
npm install --save objectified-sqlite3
```

## Usage

```javascript
const db = require("objectified-sqlite3")("./chinook.db");

const [row] = db.sql`SELECT * FROM customers WHERE CustomerId = 42`;

console.log(row.FirstName, row.LastName);
```

# Documentation

## Connecting

`objectified-sqlite3` uses [`better-sqlite3`](https://github.com/JoshuaWise/better-sqlite3) under the hood, so connecting is [the same](https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md#new-databasepath-options), however in `objectified-sqlite3` you don't need to use the `new` keyword before invoking it.

This is because it uses a massive object instead of a class, so functions like `Database.sql` can be seperated out and still work without the `this` keyword.

## Rows

All rows returned by `objectified-sqlite3` are regular JavaScript objects with extra getters:

- **Any column that references another column via a foreign key will be _replaced_ with a getter which returns the row it references.** This happens recursively allowing things like `invite.shift.user.role` which crawl around the database following foreign keys while keeping the illusion of it being a regular object.
- **Any column that is referenced by another column will cause the row to have a getter, returning an array of the rows that reference that one.** The name of the field will be the _name of the table doing the referencing_ followed by an _s_ to make it plural. For instance if `shift.user` references `user.rowid`, any queries returning `user.rowid` will also contain a field called `shifts` which contains an array of the shifts where `shift.user = user.rowid`, like a join.

None of these getters impliment any caching, which means every time you `user.shifts` it could potentially be fetching hundreds of rows. Something to watch out performance wise, but it means no extra memory is used.

## Functions

As part of the escaping: functions are registered via better-sqlite3's [`con.function`](https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md#functionname-options-function---this) and the name of the function is subbed in.

For instance
```js
const stmt = prepare`
	SELECT ${ n => n + 1 }(?) AS n
`;

console.log(stmt.get(5)); // { n: 6 }
```

## .escape\`SQL` -> String

Escapes SQL via a combination of [`sql-template-strings`](https://github.com/felixfbecker/node-sql-template-strings) and [`sqlstring`](https://github.com/mysqljs/sqlstring).

String escaping is done via `sqlstring` instead of through `better-sqlite3` so queries can be escaped before becoming statements. This allows for table names and column names to be escaped via extra question marks, like so:

```js
const tableName = "user";
const columnName = "firstname";

db.escape`SELECT ?${columnName} FROM ?${tableName}`; // SELECT `firstname` FROM `user`
```

This works because `sql-template-strings` blindly replaces JavaScript expressions with `?`, and `sqlstring` interprets `??` as a column/table name. For instance `` db.escape`SELECT * FROM ?${tableName}` `` becomes `sqlstring.format("SELECT * FROM ??", [tableName])` which is evaluated to `` "SELECT * FROM `user`" ``.

It also allows for statements to be escaped before they are prepared, so variables can be injected in multiple steps.

```js
const str = db.escape`SELECT * FROM ?${tableName} WHERE ?${columnName} = ?`; // SELECT * FROM `user` WHERE `firstname` = ?

db.db.prepare(str).all("Charlie"); // executes SELECT * FROM `user` WHERE `firstname` = 'Charlie'
```

## .prepare\`SQL\` -> `statement`

Escapes SQL via `.escape`, then makes it into a [better-sqlite3 `prepared statement`](https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md#class-statement) with a few alterations:

- `.all` and `.get` methods altered to add foreign key getters to returned rows (As described in `Rows`),
- `.iter` method removed (never needed this method myself, and it would be a pain to get it playing nicely with the getters).

## .sql\`SQL` -> array of rows

Prepares statement via `.prepare`, then fetches all rows.

# License

[MIT](./LICENSE)
