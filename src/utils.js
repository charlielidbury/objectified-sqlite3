"use strict";

const sqlTemplateStrings = require("sql-template-strings");
const sqlstring = require("sqlstring");

/**
 * Extends ${func} with ${context}'s prototype and
 * properties.
 * 
 * @example
 * const db = new Database("./path.sqlite");
 * const callableDb = makeCallable(db, db.query);
 * 
 * // the following are all now equivilant
 * const result = db.query();
 * const result = callableDb.query();
 * const result = callableDb();
 * 
 * @param {*} context The object to extend the function with
 * @param {Function} func Origional Function
 * @returns {Function} The extended function
 */
module.exports.makeCallable = function makeCallable(context, func) {
	// seperates function out from prototype
	const instance = func.bind(context);
	const prototype = Object.getPrototypeOf(context);

	// Adds Database methods to db
	Object.entries(prototype).forEach(([key, val]) => {
		instance[key] = typeof val === 'function'
			? val.bind(context)
			: val;
	});

	// Adds Database properties to db
	Object.assign(instance, context);

	return instance;
}



/**
 * @example
 * const var1, var2 = 1, 2;
 * escape("SELECT ?, ?", var1, var2); -> "SELECT 1, 2"
 * escape`SELECT ${var1}, ${var2}`; -> "SELECT 1, 2"
 * 
 * @return {String} Escaped SQL string
 */
module.exports.format = function format(stringOrStrings, ...variables) {
	if (stringOrStrings.constructor === Array) {
		// function being used as a template literal
		const str = stringOrStrings
			.reduce((acc, cur, i) => {
				const value = variables[i - 1];
				const lastChar = acc[acc.length - 1]

				// exceptions for special characters
				if (lastChar === "!") return acc.slice(0, -1) + value + cur; // don't escape
				if (lastChar === "?") return acc.slice(0, -1) + sqlstring.escapeId(value) + cur; // escape as identifier

				return acc + sqlstring.escape(value) + cur
			});

		return str;

	} else {
		// function being used as a normal prepare
		return sqlstring.format(stringOrStrings, variables)
	}
}

/**
 * fn is passed each element of the array, and the returned result
 * is used to make a shortcut for that element
 * 
 * @param {Array} arr Array to be index
 * @param {Function} fn Function used to determine map values
 * @returns {Array} origional array
 */
module.exports.index = function index(arr, fn) {
	return arr.forEach(element => {
		const key = fn(element);

		// silently skips keys that are already defined on the array
		if (arr.hasOwnProperty(key)) return;

		arr[key] = element;
	});
}