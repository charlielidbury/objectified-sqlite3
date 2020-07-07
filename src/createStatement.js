


module.exports = function createStatement(database, con, sql) {
	function Statement(...vars) {
		// write action: pass it to the run function
		if (!Statement.reader) return rawStatement.run(...vars);

		// pluck action
		if (Statement.column) {
			const values = rawStatement.pluck(true).all(...vars);

			const cells = Statement.column.references
				? new Proxy(values, {
					get(values, i) {
						const value = values[i];
						return Statement.column.references.table.statements.get(value);
					}
				})
				: values;

			return Statement.one ? cells[0] : cells
		}

		// read action
		const rows = rawStatement.all(...vars)
			.map(row => {
				// registers updaters
				Statement.origins.forEach(({ name, origin }) => {
					// waits for update of that row
					origin.update.on(row.rowid, value => {
						// updates the row
						row[name] = value;
					});
				});

				// makes proxy row
				return new Proxy(row, {
					get(row, columnName) {
						const column = Statement.columns[columnName];
						const value = row[columnName];

						// generic get
						if (!column) return Reflect.get(...arguments);

						return column.origin && column.origin.references
							? column.origin.references.table.statements.get(value)
							: value;
					},
					set(row, columnName, value) {
						// generic set
						const column = Statement.columns[columnName];
						if (!column || !column.origin) return Reflect.set(...arguments);

						// gets rowid
						const rowidColumn = Statement.primaries[column.origin.table.name];
						const rowid = row[rowidColumn.name];
						if (!rowid) return Reflect.set(...arguments);

						// makes update
						column.origin.statements.update(value.rowid || value, row.rowid);
					},
				});
			});

		return Statement.one ? rows[0] : rows;
	}

	// compiles statement
	const rawStatement = con.prepare(sql);
	Statement.reader = rawStatement.reader;
	Statement.source = rawStatement.source;

	// if reader: get columns
	if (Statement.reader) {
		const columns = rawStatement.columns()
			.map(col => ({
				name: col.name,
				origin: database.tables && col.table && database
					.tables[col.table]
					.columns[col.column],
			}));

		if (columns.length === 1) {
			// single column, pluck mode
			Statement.column = columns[0];
		} else {
			// multiple columns
			Statement.columns = {};
			columns.forEach(
				column => Statement.columns[column.name] = column
			);

			// origins, for updater emitters
			Statement.origins = columns
				.filter(c => c.origin);

			// primary keys
			Statement.primaries = {};
			Statement.origins
				.filter(c => c.origin.primary)
				.forEach(column => Statement.primaries[column.origin.table.name] = column);
		}
	}

	return Statement;
}