
const utils = require("./utils");

// DEFINES CLASS
function createStatement(db, sql) {
	this.db = db;

	// if the sql string starts with a ., turns into "one" mode
	// meaning only the first row will be returned from get
	if (this.one = sql[0] === ".")
		sql = sql.substring(1);

	// compiles statement
	this.stmt = db.con.prepare(sql);

	// makes .reader, .source, and .database accessable
	Object.assign(this, this.stmt);

	// reader things
	if (this.reader) {
		this.columns = this.stmt.columns()
			.map(col => ({
				name: col.name,
				origin: col.table && db
					.tables[col.table]
					.columns[col.column],
			}));
	}
}

Statement.prototype.run = function run(...args) {
	if (this.reader) throw ".run() only available for write actions";

	return this.stmt.run(...args);
}

Statement.prototype.get = function get(...args) {
	if (!this.reader) throw ".all() only available for read actions";

	const rows = this.stmt.all(...args);

	this.columns.forEach(col => {
		if (!col.origin) return;

		if (!col.origin.references) return;
		// sets getters for parents
		rows.forEach(row => {
			// saves the rowid of the reference internally
			const rowid = row[col.name];
			// gets that row from the DB every time it's requested
			Object.defineProperty(row, col.name, {
				get: () => col.origin.references.table.query(rowid),
			});
		})
	});

	return rows;
}

/**
 * Compiles an SQL statement
 * 
 * @param {Database} db The database the statement is compiled for
 * @param {String} sql SQL String
 * @returns {Statement} SQL Statement
 */
function createStatement(db, sql) {
	const statement = new Statement(db, sql);

	const fn = statement.reader
		? statement.get
		: statement.run;

	return utils.makeCallable(statement, fn);
}

// exposes Statement class
createStatement.Statement = Statement;

module.exports = createStatement;