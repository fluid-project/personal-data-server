/*
 * Copyright 2020-2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 */

"use strict";

require("json5/lib/register");
const path = require("path");
const fluid = require("infusion");
const jqUnit = require("node-jqunit");
const postgresOps = require("../src/dbOps/postgresOps.js");

require("../src/shared/driverUtils.js");
require("./shared/testUtils.js");

jqUnit.module("PostgresDB request unit tests.");

fluid.registerNamespace("fluid.tests.dbOps");

const skipDocker = process.env.SKIPDOCKER === "true" ? true : false;
const config = require("../src/shared/utils.js").loadConfig(path.join(__dirname, "testConfig.json5"));

jqUnit.test("Database request tests", async function () {
    jqUnit.expect(skipDocker ? 7 : 9);
    let response;

    if (!skipDocker) {
        // Start the database
        response = await fluid.personalData.dockerStartDatabase(config.db.dbContainerName, config.db.dbDockerImage, config.db);
        jqUnit.assertTrue("The database has been started successfully", response.dbReady);
    }

    response = await fluid.personalData.createDB(config.db);
    jqUnit.assertTrue("The database " + config.db.database + " has been created successfully", response.isCreated);

    // Initiate the postgres handler and valid
    const postgresHandler = new postgresOps.postgresOps(config.db);
    jqUnit.assertNotNull(postgresHandler, "Check database request object is non-null");
    jqUnit.assertNotNull(postgresHandler.pool, "Check database connection is non-null");

    // Run a SQL to find all databases
    const allDbs = await fluid.tests.dbOps.findAllDatabases(postgresHandler);
    // The query result should match what's tracked in the postgres handler
    fluid.tests.dbOps.testResults(allDbs, postgresHandler);

    // Run a SQL on a non-existent table and check the error is returned
    try {
        await fluid.tests.dbOps.checkNoSuchDatabase(postgresHandler);
    } catch (error) {
        jqUnit.assertEquals("An error should be returned when a SQL is executed on a non-existent table", error.message, "relation \"no_such_databasez\" does not exist");
    }

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
 * Check postgresdb for all of the databases it contains.
 *
 * @param {Object} postgresHandler - The postgres hanedler.
 * @return {Promise} Results returned by the request.
 */
fluid.tests.dbOps.findAllDatabases = function (postgresHandler) {
    let result = postgresHandler.runSql("SELECT datname FROM pg_database");
    result.then(null, function (error) {
        fluid.log(JSON.stringify(error.message));
    });
    return result;
};

/**
 * Check postgresdb for a non-existent table.
 *
 * @param {Object} postgresHandler - The postgres hanedler.
 * @return {Promise} Results returned by the request.
 */
fluid.tests.dbOps.checkNoSuchDatabase = function (postgresHandler) {
    let result = postgresHandler.runSql("SELECT datname FROM no_such_databasez");
    result.then(null, function (error) {
        fluid.log(JSON.stringify(error.message));
    });
    return result;
};

/**
 * Compare the returned results and the information tracked in the postgres handler.
 *
 * @param {Object} results - The results returned by the postgres handler.
 * @param {Object} postgresHandler - The postgres hanedler.
 */
fluid.tests.dbOps.testResults = function (results, postgresHandler) {
    jqUnit.assertNotNull("Check for null query result", results);
    jqUnit.assertNotEquals("Check for empty query result", results.rowCount, 0);

    const ourDatabaseName = postgresHandler.options.database;
    const ourDatabase = fluid.find(results.rows, function (aDatabase) {
        if (aDatabase.datname === ourDatabaseName) {
            return aDatabase;
        }
    }, null);
    jqUnit.assertNotNull(ourDatabase, "Check for '" + ourDatabaseName + "'");
};
