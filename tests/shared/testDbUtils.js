/*
 * Copyright 2020-2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/personal-data-server/blob/main/LICENSE
 */

"use strict";

const fluid = require("infusion");
const jqUnit = require("node-jqunit");

fluid.registerNamespace("fluid.tests.utils");

/**
 * A test of the `runSqlArray()` method by a bulk deletion of the given tables
 * from the database.  The tables are dropped in bulk.
 *
 * @param {Component} postgresOps - Postgres operations instance.
 * @param {Array} tableNames - Array of tables to delete.
 * @param {String} ifExists - (Optional) additional IF EXISTS clause.
 * @return {Promise} The value of the drop operation.
 */
fluid.tests.utils.testSqlArray = function (postgresOps, tableNames, ifExists) {
    ifExists = ifExists || "";
    let dropSQL = [];
    fluid.each(tableNames, function (aTableName) {
        dropSQL.push(
            `DROP TABLE ${ifExists} "${aTableName}" CASCADE;`
        );
    });
    return postgresOps.runSqlArray(dropSQL);
};

/**
 * Check the results of running some SQL.  At least check that the
 * results from the query is non-null and there are an equal number of them as
 * there were statements.  Node-postgres returns a results array where each
 * object in the array has a `command` property.  A `command` parameter is
 * optional here, but if provided, is compared to the `command` properties of
 * the results.
 *
 * @param {Array} results - SQL statement(s) results.
 * @param {Number} numStatements - Expected number of SQL statements executed.
 * @param {String} command - Optional: if present, it will be checked against
 *                           commands returned in the results.
 */
fluid.tests.utils.testResults = function (results, numStatements, command) {
    jqUnit.assertNotNull("Check for null result", results);
    jqUnit.assertEquals("Check number of commands", numStatements, results.length);
    if (command) {
        fluid.each(results, function (aResult) {
            jqUnit.assertEquals("Check SQL command", command, aResult.command);
        });
    }
};

/**
 * Compare the key-value pairs of the JSON returned from a database operation
 * against an expected set of key-value pairs.  Date values are a special case
 * since, even though PostGres is documented as outputting the date in ISO
 * format, it replaces the 'T' with a space.  See the note in the "Data/Time
 * Types" documentation:
 * https://www.postgresql.org/docs/13/datatype-datetime.html#DATATYPE-DATETIME-OUTPUT
 *
 * @param {Array} keys - The field names of the JSON objects to compare.
 * @param {Object} actualPairs - JSON object returned from the database.
 * @param {Object} expectedPairs - Expected JSON object.
 * @param {String} msg - Message for the comparison tests.
 */
fluid.tests.utils.checkKeyValuePairs = function (keys, actualPairs, expectedPairs, msg) {
    fluid.each(keys, function (aKey) {
        const actualValue = actualPairs[aKey];
        const expectedValue = expectedPairs[aKey];
        const message = msg + " for key '" + aKey + "'";
        // Special case: time stamps -- convert the value to Date objects for
        // comparison
        if (actualValue instanceof Date) {
            const actualDate = new Date(actualValue);
            const expectedDate = new Date(expectedValue);
            jqUnit.assertDeepEq(message, expectedDate, actualDate);
        } else {
            jqUnit.assertDeepEq(message, expectedValue, actualValue);
        }
    });
};

// Delete all existing tables. See https://stackoverflow.com/questions/3327312/how-can-i-drop-all-the-tables-in-a-postgresql-database?rq=1
fluid.tests.utils.cleanDb = async function (postgresHandler) {
    // Remove all existing tables
    await postgresHandler.runSql("DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;");
};
