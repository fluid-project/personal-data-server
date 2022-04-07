#!/usr/bin/env node
/*
 * Copyright 2021-2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 */

// This script reads configs from config.js and starts the entire personal data server including the express server,
// the database docker container. It also loads data into the database.
// Usage: node index.js

"use strict";

const path = require("path");
const config = require("./src/shared/utils.js").loadConfig(path.join(__dirname, "config.json5"));
const postgresOps = require("./src/dbOps/postgresOps.js");
const server = require("./server.js");

require("./src/shared/driverUtils.js");

const sqlFiles = {
    clearDB: __dirname + "/dataModel/ClearDB.sql",
    createTables: __dirname + "/dataModel/SsoTables.sql",
    createSessionTable: __dirname + "/node_modules/connect-pg-simple/table.sql",
    loadData: __dirname + "/dataModel/SsoProvidersData.sql"
};

const skipDocker = process.env.SKIPDOCKER === "true" ? true : false;
const clearDB = process.env.CLEARDB === "true" ? true : false;
const serverPort = config.server.port || 3000;

async function main() {
    if (!skipDocker) {
        // Start the database docker container
        await fluid.personalData.dockerStartDatabase(config.db.dbContainerName, config.db.dbDockerImage, config.db);
    }

    // Create database. Will complete successfully if the database already exists
    await fluid.personalData.createDB(config.db);

    const postgresHandler = new postgresOps.postgresOps(config.db);

    // Clear the old data if CLEARDB flag is set to true
    if (clearDB) {
        await fluid.personalData.clearDB(postgresHandler, sqlFiles.clearDB);
    }

    // Initialize db: create tables and load data
    await fluid.personalData.initDB(postgresHandler, sqlFiles);

    // Start the personal data server
    const serverInstance = await server.startServer(serverPort);
    serverInstance.status.then((success) => {
        console.log("Server is up and running:", success);
    }, (error) => {
        throw new Error("Failed at starting server:" + error);
    });
}

main();
