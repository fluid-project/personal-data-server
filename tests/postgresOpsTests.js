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

require("json5/lib/register");
const path = require("path");
const fluid = require("infusion");
const jqUnit = require("node-jqunit");
const postgresOps = require("../src/dbOps/postgresOps.js");

require("../src/shared/driverUtils.js");
require("./shared/testUtils.js");
require("./shared/testDbUtils.js");

// Tables structures and test data records
require("./data/testTableModels.js");
require("./data/testTableData.js");

jqUnit.module("PostgresDB operations unit tests.");

fluid.registerNamespace("fluid.tests.dbOps");

const skipDocker = process.env.SKIPDOCKER === "true" ? true : false;
const config = require("../src/shared/utils.js").loadConfig(path.join(__dirname, "testConfig.json5"));

const parameterizedInsert = `
    INSERT INTO rgb (id, color, "colourMap") VALUES($1, $2, $3);
`;

const valueParameters = [
    "plum",
    "purple",
    {
        "name": "purple",
        "HSL": [306, 41, 40]
    }
];

const sqlFile = __dirname + "/data/createInsertPrefs.sql";

const testData = {
    userToInsert: `
        INSERT INTO users
                   ("user_id",                iterations, username, name,    email,             roles,      derived_key,                                salt,                               verification_code, verified)
            VALUES ('another.user:nonadmin', 0,          'carla',  'carla', 'carla@localhost', '{"user"}', '9ff4bc1c1846181d303971b08b65122a45174d04', '2653c80aabd3889c3dfd6e198d3dca93', 'carlaIsVerified', true)
            RETURNING *;
        `,
    userToInsertJSON: {
        "user_id": "another.user:nonadmin",
        "iterations": 0,
        "username": "carla",
        "name": "carla",
        "email": "carla@localhost",
        "roles": [
            "user"
        ],
        "derived_key": "9ff4bc1c1846181d303971b08b65122a45174d04",
        "salt": "2653c80aabd3889c3dfd6e198d3dca93",
        "verification_code": "carlaIsVerified",
        "verified": true
    },
    userChanges: `
        UPDATE users
            SET verified=false, email='carla@globalhost'
            WHERE "user_id"='another.user:nonadmin'
            RETURNING *;
    `,
    primaryKeyChange: `
        UPDATE users
            SET "user_id"='some.new.id'
            WHERE "user_id"='another.user:nonadmin'
            RETURNING *;
    `
};

const expected = {
    userChanges: fluid.extend(
        true, {}, testData.userToInsertJSON,
        { verified: false, email: "carla@globalhost" }
    ),
    primaryKeyChange: fluid.extend(
        true, {}, testData.userToInsertJSON,
        { user_id: "some.new.id", verified: false, email: "carla@globalhost" }
    )
};

const rgbChartreuse = fluid.find(fluid.tests.dbOps.testTableData.rgb, function (aColour) {
    if (aColour.id === "chartreuse") {
        return aColour;
    }
});

jqUnit.test("Database operations tests", async function () {
    jqUnit.expect(skipDocker ? 235 : 237);
    let response;

    if (!skipDocker) {
        // Start the database
        response = await fluid.personalData.dockerStartDatabase(config.db.dbContainerName, config.db.dbDockerImage, config.db);
        jqUnit.assertTrue("The database has been started successfully", response.dbReady);
    }

    response = await fluid.personalData.createDB(config.db);
    jqUnit.assertTrue("The database " + config.db.database + " has been created successfully", response.isCreated);

    const postgresHandler = new postgresOps.postgresOps(config.db);

    // Start with a clean database
    await fluid.tests.utils.cleanDb(postgresHandler);

    // Create all of the test tables
    response = await postgresHandler.runSql(fluid.tests.dbOps.tableDefinitions);
    fluid.tests.utils.testResults(response, fluid.tests.dbOps.tableNames.length, "CREATE");

    // Load one test table based on JSON data
    response = await postgresHandler.loadFromJSON("rgb", fluid.tests.dbOps.testTableData.rgb);
    fluid.tests.utils.testResults(response, fluid.tests.dbOps.testTableData.rgb.length, "INSERT");

    // Delete all records from the rgb table loaded previously
    response = await postgresHandler.runSql("DELETE FROM rgb;");
    jqUnit.assertEquals("Check for number of rows deleted", fluid.tests.dbOps.testTableData.rgb.length, response.rowCount);

    // Check that rgb data is truly gone
    response = await postgresHandler.runSql("SELECT * FROM rgb;");
    jqUnit.assertEquals("Check retrieve value when querying empty table 'rgb'", 0, response.rowCount);

    // Test failure of attempt to load into a non-existent table.
    try {
        await postgresHandler.runSql("INSERT INTO noSuchTable (foo, bar) VALUES ('baz', 'snafu');");
    } catch (error) {
        jqUnit.assertEquals("Check INSERT into non-existent table", "relation \"nosuchtable\" does not exist", error.message);
    }

    // Load all tables with data
    response = await fluid.tests.dbOps.loadJSON(postgresHandler, fluid.tests.dbOps.testTableData);
    jqUnit.assertNotNull("Check for null result", response);
    fluid.each(response, function (aResult, index) {
        const tableName = fluid.tests.dbOps.tableNames[index];
        fluid.tests.utils.testResults(
            aResult, fluid.tests.dbOps.testTableData[tableName].length, "INSERT"
        );
    });

    // Add another rgb record using parameters
    response = await postgresHandler.runSql(parameterizedInsert, valueParameters);
    jqUnit.assertEquals("Check number of rows added", 1, response.rowCount);
    jqUnit.assertEquals("Check SQL command", "INSERT", response.command);

    // Select from existing table
    response = await postgresHandler.runSql("SELECT * FROM rgb WHERE color='green';");
    fluid.each(response.rows, function (actualRecord) {
        fluid.each(fluid.tests.dbOps.testTableData.rgb, function (expectedRecord) {
            if (expectedRecord.id === actualRecord.id) {
                const expectedFields = Object.keys(expectedRecord);
                fluid.tests.utils.checkKeyValuePairs(
                    expectedFields, actualRecord, expectedRecord,
                    "Check row values"
                );
            }
        });
    });

    // Select from non-existant table -- should fail
    try {
        await postgresHandler.runSql("SELECT * FROM noSuchTable WHERE color='green';");
    } catch (error) {
        jqUnit.assertEquals("Check SELECT from non-existent table", "relation \"nosuchtable\" does not exist", error.message);
    }

    // Test retrieval of a JSONB value
    response = await postgresHandler.runSql("SELECT \"colourMap\" FROM rgb WHERE id='chartreuse'");
    jqUnit.assertNotEquals("Check for empty result", 0, response.length);
    jqUnit.assertDeepEq("Check value retrieved", rgbChartreuse.colourMap, response.rows[0].colourMap);

    // Test failing case where column does not exist
    try {
        await postgresHandler.runSql("SELECT \"noSuchColumn\" FROM rgb WHERE color='chartreuse';");
    } catch (error) {
        jqUnit.assertEquals("Check SELECT from non-existent column", "column \"noSuchColumn\" does not exist", error.message);
    }

    // Insert new user record
    response = await postgresHandler.runSql(testData.userToInsert);
    const expectedKeys = Object.keys(testData.userToInsertJSON);
    fluid.tests.utils.checkKeyValuePairs(expectedKeys, response.rows[0], testData.userToInsertJSON, "Check added record");

    // Insert new record again -- should fail
    try {
        await postgresHandler.runSql(testData.userToInsert);
    } catch (error) {
        jqUnit.assertEquals("Check second INSERT of same record", "duplicate key value violates unique constraint \"users_pkey\"", error.message);
    }

    // Update a field with a proper identifier
    response = await postgresHandler.runSql(testData.userChanges);
    fluid.tests.utils.checkKeyValuePairs(Object.keys(expected.userChanges), response.rows[0], expected.userChanges, "Check update results");

    // Update the primary key itself
    response = await postgresHandler.runSql(testData.primaryKeyChange);
    fluid.tests.utils.checkKeyValuePairs(Object.keys(expected.primaryKeyChange), response.rows[0], expected.primaryKeyChange, "Check update results");

    // Update with non-existent primary key; should return zero results
    response = await postgresHandler.runSql("UPDATE users SET iterations=55 WHERE \"user_id\"='noSuchUser';");
    jqUnit.assertEquals("Check UPDATE with mismatched primaryKey", 0, response.rowCount);

    // Test successful deletion
    response = await postgresHandler.runSql("DELETE FROM \"users\" WHERE \"user_id\"='some.new.id';");
    // response = await postgresHandler.runSql("DELETE FROM \"prefsSafes\" WHERE \"prefsSafesId\"='prefsSafe-1';");
    jqUnit.assertEquals("Check number of records deleted", 1, response.rowCount);

    // Run sql from a file.
    response = await postgresHandler.runSqlFile(sqlFile);
    fluid.tests.utils.testResults(response, 3);

    // Run sql from a non-existent file -- should fail
    try {
        await postgresHandler.runSqlFile("/no/such/file.sql");
    } catch (error) {
        jqUnit.assertTrue("Check the failure code ENOENT is presented", error.message.startsWith("ENOENT"));
        jqUnit.assertTrue("Check the file name appears in the error message", error.message.includes("file.sql"));
    }

    // Delete all records from one table using TRUNCATE.  Note that TRUNCATE returns nothing so it either resolved or rejected.
    // The test that follows this TRUNCATE test checks that all of the records were deleted.
    await postgresHandler.runSql("TRUNCATE massive;");

    // Check that massive data is truly gone
    response = await postgresHandler.runSql("SELECT * FROM massive;");
    jqUnit.assertEquals("Check retrieve value when querying empty table 'massive'", 0, response.rowCount);

    // Final clean up
    // 1. Disconnect the postgres client from its server. See https://node-postgres.com/api/client
    fluid.tests.utils.finish(postgresHandler);

    if (!skipDocker) {
        // 2. Stop the docker container for the database
        response = await fluid.personalData.dockerStopDatabase(config.db.dbContainerName);
        jqUnit.assertTrue("The database docker container has been stopped", response.dbStopped);
    }
});

/**
 * Load test data supplied for all of the test tables into those tables
 *
 * @param {Object} postgresHandler - postgresHandler instance.
 * @param {Object} tableData - Where all of the input data is held.
 * @return {Promise} - results of the requests to load the test data.
 */
fluid.tests.dbOps.loadJSON = function (postgresHandler, tableData) {
    let loadSequence = [];
    fluid.each(fluid.tests.dbOps.tableNames, function (aTableName) {
        loadSequence.push(
            postgresHandler.loadFromJSON(aTableName, tableData[aTableName])
        );
    });
    return Promise.all(loadSequence);
};
