

function createStatement(database, con, sql) {
	const props = { database };

	// if the sql string starts with a ., turns into "one" mode
	// meaning only the first row will be returned from get
	if (props.one = sql[0] === ".")
		sql = sql.substring(1);

	// compiles statement
	const rawStatement = con.prepare(sql);
	props.reader = rawStatement.reader;
	props.source = rawStatement.source;

	// if reader: get columns
	if (props.reader) {
		props.columns = rawStatement.columns()
			.map(col => [
				col.name,
				database.tables && col.table && database
					.tables[col.table]
					.columns[col.column],
			])

		rawStatement.pluck(props.pluck = props.columns.length === 1);
	}

	const Statement = props.reader
		? function (...vars) {
			const rows = rawStatement.all(...vars);

			props.columns.forEach(([key, origin]) => {
				// if it's an expression or subquery, no functionality added
				if (!origin) return;

				// if it's a forgein key, functionality added
				if (!origin.references) return;

				// sets getters for parents
				if (props.pluck)
					rows.forEach(row => {
						// saves the rowid of the reference internally
						const rowid = row[key];
						// gets that row from the DB every time it's requested
						Object.defineProperty(row, key, {
							get: () => origin.references.table.statements.get(rowid),
						});
					});
				else
					rows.forEach((val, i) => {
						// puts getter in
						Object.defineProperty(rows, i, {
							get: () => origin.references.table.statements.get(val)
						});
					});
			});

			return rows;
		}
		: rawStatement.run.bind(props.rawStatement);

	// puts props on the statement
	Object.assign(Statement, props);

	return Statement;
}

module.exports = createStatement;