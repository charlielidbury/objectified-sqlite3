
const utils = require("./utils");
const Column = require("./Column");

function Table(db, name) {
	this.db = db;
	this.name = name;

	this.statements = null;

	// INITS COLUMNS
	this.columns = db`SELECT * FROM pragma_table_info(${name})`()
		.map(definition => new Column(this, definition));
	// makes the tables easier to access by putting their names on the array object
	utils.index(this.columns, c => c.name);
	// NOTICE: only supports one primary key
	this.primary = this.columns.find(c => c.primary);
}

Table.prototype.initReferences = function initReferences() {
	this.db`PRAGMA foreign_key_list(${this.name})`()
		.forEach(fk => {
			this.columns[fk.from].references = this.db
				.tables[fk.table]
				.columns[fk.to || "rowid"];
		});
}

Table.prototype.initStatements = function initStatements() {
	this.statements = {
		get: this.db.one`
			SELECT *
			FROM ${this}
			WHERE rowid = ?
		`,
		insert: this.db`
			INSERT INTO ${this}
			(${this.columns})
			VALUES (!${this.columns.map(c => ':' + c.name).join(", ")})
		`,
		delete: this.db`
			DELETE FROM ${this}
			WHERE rowid = ?
		`,
	};
}

Table.prototype.toSqlString = function toSqlString() {
	return '`' + this.name + '`';
}

Table.prototype.insert = function insert(row) {
	this.columns.forEach(({ name }) => {
		row[name] = row[name] || null;
	})

	const { lastInsertRowid } = this.statements.insert(row);

	return this.statements.get(lastInsertRowid);
}

module.exports = Table;