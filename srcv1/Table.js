
const utils = require("./utils");
const Column = require("./Column");

function Table(db, n) {
	this.db = db;
	this.n = n;

	this.statements = null;

	// INITS COLUMNS
	this.columns = db`SELECT name FROM pragma_table_info(${n})`()
		.map(columnName => new Column(this, columnName));
	// makes the tables easier to access by putting their names on the array object
	utils.index(this.columns, c => c.name);
}

Table.prototype.initReferences = function initReferences() {
	this.db`PRAGMA foreign_key_list(${this.n})`()
		.forEach(fk => {
			this.columns[fk.from].references = this.db
				.tables[fk.table]
				.columns[fk.to || "rowid"];
		});
}

Table.prototype.initStatements = function initStatements() {
	this.statements = {
		get: this.db`
			SELECT *
			FROM ?${this.n}
			WHERE rowid = ?
		`,
	}
}

module.exports = Table;