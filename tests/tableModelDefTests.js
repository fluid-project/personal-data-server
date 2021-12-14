/*
 * Copyright 2020-2021 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 */

"use strict";

const fluid = require("infusion");
const jqUnit = require("node-jqunit");
const postgresOps = require("../src/dbOps/postgresOps.js");

require("../src/shared/driverUtils.js");
require("./shared/utilsCommon.js");
require("./shared/utilsDb.js");

jqUnit.module("PostgresDB table definitions unit tests.");

fluid.registerNamespace("fluid.tests.dbOps");

// Table names, SQL CREATE, and SQL ALTER statements
require("./data/testTableModels.js");

jqUnit.test("Database table data models tests", async function () {
    jqUnit.expect(13);

    // Start the database
    const dbStatus = await fluid.personalData.dockerStartDatabase(fluid.tests.postgresContainer, fluid.tests.postgresImage, fluid.tests.dbConfig);
    jqUnit.assertTrue("The database has been started successfully", dbStatus);

    const postgresHandler = new postgresOps.postgresOps(fluid.tests.dbConfig);

    // Start with a clean database
    await fluid.tests.utils.cleanDb(postgresHandler);

    // Drop the tables again -- should reject since there are no such tables any more.
    try {
        await fluid.tests.utils.testSqlArray(postgresHandler, fluid.tests.dbOps.tableNames);
    } catch (dropError) {
        jqUnit.assertEquals(
            "Check DROP of non-existant table",
            `table "${fluid.tests.dbOps.tableNames[0]}" does not exist`,
            dropError.message
        );
    }

    // Create the tables
    let response = await postgresHandler.runSql(fluid.tests.dbOps.tableDefinitions);
    fluid.tests.utils.testResults(response, fluid.tests.dbOps.tableNames.length, "CREATE");

    // Test failure by trying to create the same tables again. It will fail on the first table.
    try {
        await postgresHandler.runSql(fluid.tests.dbOps.tableDefinitions);
    } catch (alterError) {
        jqUnit.assertEquals("Check error message",
            "relation \"" + fluid.tests.dbOps.tableNames[0] + "\" already exists",
            alterError.message
        );
    }

    // Test ALTER of a table.
    response = await postgresHandler.runSql(fluid.tests.dbOps.tableUpdates);
    // fluid.tests.utils.testTableUpdates(response, fluid.tests.dbOps.numTableUpdates);
    fluid.tests.utils.testResults(response, fluid.tests.dbOps.numTableUpdates);
    fluid.each(response, function (aResult) {
        jqUnit.assertEquals("Check ALTER command", "ALTER", aResult.command);
    });

    // Final clean up
    // 1. Disconnect the postgres client from its server. See https://node-postgres.com/api/client
    fluid.tests.utils.finish(postgresHandler);

    // 2. Stop the docker container for the database
    await fluid.personalData.dockerStopDatabase(fluid.tests.postgresContainer, dbStatus);
});
