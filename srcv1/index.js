const sqlite = require("better-sqlite3");

const Table = require("./Table");
const createStatement = require("./Statement")
const utils = require("./utils");


module.exports = function createDatabase(path) {
	const con = sqlite(path);

	function Database(...args) {
		const sql = utils.format(...args);
		return createStatement(Database, con, sql);
	}

	// creates tables
	Database.tables = Database`SELECT name FROM sqlite_master WHERE type='table'`()
		.map(n => new Table(Database, n));
	utils.index(Database.tables, t => t.n);

	// inits fk rels and compiles statements
	Database.tables.forEach(t => t.initReferences());
	Database.tables.forEach(t => t.initStatements());

	return Database;
}