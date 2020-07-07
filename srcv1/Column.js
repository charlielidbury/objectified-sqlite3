
const EventEmitter = require("events");

function Column(table, name) {
	this.table = table;
	this.name = name;
	this.references = null;

	this.in = v => v;
	this.out = v => v;

	// registers event emitter
	this.update = new EventEmitter();
	table.db`
		CREATE TEMP TRIGGER ?${`column_update_${table.n}_${name}`}
		ON ?${table.n}
		AFTER UPDATE OF ?${name}
		BEGIN
			SELECT registerColumnUpdate(
				${table.n},
				${name},
				NEW.rowid,
				NEW.?${name},
				OLD.?${name}
			);
		END
	`;

	// registers statements
	this.statements = {
		update: table.db`
			UPDATE ?${table.n}
			SET ?${name} = ?
			WHERE rowid = ?
		`,
	}
}

module.exports = Column;