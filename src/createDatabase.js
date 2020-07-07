const sqlite = require("better-sqlite3");

const Table = require("./Table");
const createStatement = require("./createStatement")
const utils = require("./utils");


module.exports = function createDatabase(path) {
	const con = sqlite(path);

	function Database() {
		const sql = utils.format(...arguments);
		return createStatement(Database, con, sql);
	}

	Database.one = function one() {
		const stmt = Database(...arguments);
		stmt.one = true;
		return stmt;
	}

	// registers functions
	con.function("registerColumnUpdate", (
		tableName,
		columnName,
		rowid,
		newValue,
		oldValue
	) => {
		// emits event on that column
		Database
			.tables[tableName]
			.columns[columnName]
			.update
			.emit(rowid, newValue, oldValue);
	})

	// creates tables
	Database.tables = Database`SELECT name FROM sqlite_master WHERE type='table'`()
		.map(name => new Table(Database, name));
	utils.index(Database.tables, t => t.name);

	// inits fk rels and compiles statements
	Database.tables.forEach(t => t.initReferences());
	Database.tables.forEach(t => t.initStatements());

	return Database;
}