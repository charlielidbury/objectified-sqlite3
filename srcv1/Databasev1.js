"use strict";

const utils = require("./utils");
const createStatement = require("./Statement");
const Table = require("./Table");

function Database(con) {
	this.con = con;

	// MAKES TABLE OBJECTS
	this.tables = con.prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
		.pluck(true)
		.all()
		.map(n => new Table(this, n));
	utils.index(this.tables, t => t.n);

	// inits fk rels and compiles statements
	this.tables.forEach(t => t.initReferences());
	this.tables.forEach(t => t.initStatements());

}

Database.prototype.prepare = function prepare() {
	const sql = utils.format(...arguments);
	return createStatement(this, sql);
}

module.exports = Database;
