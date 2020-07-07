const sqlTemplateStrings = require("sql-template-strings");
const sqlstring = require("sqlstring");
const sqlite = require("better-sqlite3");

function escape(stringOrStrings, ...variables) {
	/*
	const var1, var2 = 1, 2;
	escape("SELECT ?, ?", var1, var2); -> "SELECT 1, 2"
	escape`SELECT ${var1}, ${var2}`; -> "SELECT 1, 2"
	*/
	if (stringOrStrings.constructor === Array) {
		// function being used as a template literal
		const { query, values } = sqlTemplateStrings(...arguments);
		return sqlstring.format(query, values);

	} else {
		// function being used as a normal prepare
		return sqlstring.format(stringOrStrings, variables)
	}
}

function createColumn(table, name) {
	const Column = {
		table,
		name,
	};

	return Column;
}

function createTable(db, name) {
	function Table() {
		const sql = escape(...arguments);

		const stmt = db.prepare(`SELECT * FROM \`${name}\` ` + sql);

		return stmt.all();
	}

	// inits columns
	Table.columns = db.prepare(`SELECT name FROM pragma_table_info(${name})`).pluck(true).all()
		.map(columnName => createColumn(Table, columnName));
	// makes the tables easier to access by putting their names on the array object
	Table.columns.forEach(column => Table.columns[column.name] = column);

	return Table;
}

function createDatabase(path) {
	// makes connection
	const con = sqlite(path);

	function Database() {
		const stmt = Database.prepare(...arguments);

		return stmt.all();
	}

	// CONNECTS ALL TABLES
	Database.tables = con.prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
		.pluck(true)
		.all()
		.map(name => createTable(Database, name));

	Database.tables.forEach(table => Database.tables[table.name] = table);

	// PREPARES STATEMENTS
	Database.prepare = function prepare() {
		const sql = escape(...arguments);
		const stmt = con.prepare(sql);

		const Statement = {
			run() {
				return stmt.run(...arguments);
			},
		}

		if (stmt.reader) {
			//  RETURNS ARRAY OF COLUMNS
			Statement.columns = stmt.columns()
				.map(col => ({
					name: col.name,
					type: col.type,
					origin: col.table && Database
						.tables[col.table]
						.columns[col.column],
				}));

			// RETURNS ALL ROWS OF QUERY
			Statement.all = function all() {
				const results = stmt.all(...arguments);

				Statement.columns.forEach(col => {
					if (!col.origin) return;

					const addProps = col.origin.references
						// if that column is a forgein key
						? obj => {
							const rowidCopy = obj[col.name]; // takes copy of rowid
							Object.defineProperty(obj, col.name, {
								get: () => col.origin.references.table(rowidCopy),
							});
						}
						// if its a regular column reference
						: obj => {

						}

					results.forEach(addProps);
				});

				return results;
			};

			// RETURNS FIRST ROW OF QUERY
			Statement.get = function get() {
				return Statement.all(...arguments)[0];
			}
		}


		return Statement
	}

	return Database;
}

module.exports = createDatabase;