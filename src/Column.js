
const EventEmitter = require("events");

function Column(table, { name, pk, type, dflt_value }) {
	this.table = table;
	this.references = null;

	// properties
	this.name = name;
	this.primary = pk;
	this.type = type;
	this.default = dflt_value;

	// mapping functions
	this.in = v => v;
	this.out = v => v;

	// registers event emitter
	this.update = new EventEmitter();
	table.db`
		CREATE TEMP TRIGGER ${`column_update_${table.name}_${name}`}
		AFTER UPDATE OF ${this}
		ON ${table}
		BEGIN
			SELECT registerColumnUpdate(
				${table.name},
				${name},
				NEW.rowid,
				NEW.${this},
				OLD.${this}
			);
		END
	`();

	// registers statements
	this.statements = {
		update: table.db`
			UPDATE ${table}
			SET ${this} = ?
			WHERE rowid = ?
		`,
	}
}

Column.prototype.toSqlString = function toSqlString() {
	return '`' + this.name + '`';
}

module.exports = Column;