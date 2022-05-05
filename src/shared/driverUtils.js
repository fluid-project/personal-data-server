/*
 * Copyright 2021-2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 */

"use strict";

const fluid = require("infusion");
const axios = require("axios");
const { execSync } = require("child_process");

fluid.registerNamespace("fluid.personalData");

const NUM_CHECK_REQUESTS = 10;
const DELAY = 2000; // milliseconds

fluid.personalData.sleep = async function (delay) {
    return new Promise((resolve) => setTimeout(resolve, delay));
};

/**
 * Check if the personal data server is running or not.
 *
 * @param {Number} serverPort - The port that the server is listening to.
 * @return {Boolean} The actual server running status. True if running, otherwise false.
 */
fluid.personalData.getServerStatus = async function (serverPort) {
    const url = "http://localhost:" + serverPort;
    let isRunning;  // The actual running status
    let resp;

    console.log("Finding the server running status at " + url);
    for (let i = 0; i < NUM_CHECK_REQUESTS; i++) {
        try {
            console.log(`... attempt ${i}`);
            resp = await axios(url);
        } catch (error) {
            console.log(`... attempt ${i} error: ${error.message}`);
            isRunning = false;
            break;
        }
        if (resp.status === 200) {
            isRunning = true;
            break;
        } else {
            console.log(`... attempt ${i} going to sleep ${DELAY} milliseconds`);
            await fluid.personalData.sleep(DELAY);
        }
    }
    console.log(`- Attempt to find if the server is running, result:  ${isRunning}`);
    return isRunning;
};

/**
 * Start the database using Docker.  This checks whether the docker container
 * is already running, and if not, attempts to start it.
 *
 * @param {String} container - Name of the docker container.
 * @param {String} image - Name of the associated docker image.
 * @param {String} dbConfig - Parameters for creating a database within the
 *                           `container` or to check if one already exists.
 * @param {String} dbConfig.user - Adminstrative user of the database.
 * @param {String} dbConfig.password - Adminstrator's password.
 * @param {String} dbConfig.port - Port for database requests.
 * @return {Boolean} True if the database in the container is ready. Otherwise, return false.
 */
fluid.personalData.dockerStartDatabase = async function (container, image, dbConfig) {
    let execOutput;

    console.log(`- Starting database docker container ${container}`);
    // Try starting a stopped container.  If no such container, the command will throw an error.
    try {
        execOutput = execSync(`docker start ${container}`).toString().trim();
    } catch (error) {
        execOutput = error.message;
    }

    // If the above re-started the container that was stopped previously, the output of `exectSync()`
    // is the `container` name. Otherwise, use `docker run` to start this container the first time.
    if (execOutput !== container) {
        // Start a new container from the given image
        try {
            execSync(
                `docker run -d --name="${container}" \
                -e POSTGRES_USER=${dbConfig.user} \
                -e POSTGRES_PASSWORD=${dbConfig.password} \
                -p ${dbConfig.port}:${dbConfig.port} \
                ${image} postgres -p ${dbConfig.port}`
            ).toString().trim();
        } catch (error) {
            console.log(`Error starting database docker container: ${error}.message`);
            throw {
                isError: true,
                message: `Error starting database docker container: ${error}.message`
            };
        }
    }

    // Loop to check that PostgresDB is ready.
    console.log("Checking if PostgresDB is ready...");
    for (let i = 0; i < NUM_CHECK_REQUESTS; i++) {
        console.log(`... attempt ${i}`);
        try {
            execOutput = execSync(
                `docker exec --user postgres ${container} pg_isready -p ${dbConfig.port}`
            ).toString().trim();
        } catch (error) {
            // Continue to wait until the number of attempts runs out
            await fluid.personalData.sleep(DELAY);
            continue;
        }
        if (execOutput.indexOf("accepting connections") !== -1) {
            return {
                dbReady: true
            };
        } else {
            await fluid.personalData.sleep(DELAY);
        }
    }

    throw {
        isError: true,
        message: "Failed at starting database docker container with unknown error"
    };
};

/**
 * Disconnect the database client from the database and stop the database docker
 * container.
 * Note that `postgresHandler.end()` should only be called once at the last test
 * set to stop the postgres handler. When there are subsequent test sets using
 * the postgres handler, don't pass `postgresHandler` into this function.
 *
 * @param {String} container - Name of the docker container.
 * @param {Object} postgresHandler - Optional: the postgresOps object to disconnect from the database.
 * @return {Object} result of disconnecting `postgresHandler` from the database.
 *                  {dbStopped: true} if no error; {isError: true, message: error-message} otherwise.
 */
fluid.personalData.dockerStopDatabase = async function (container, postgresHandler) {
    console.log(`- Stopping database docker container ${container}`);
    if (postgresHandler) {
        await postgresHandler.end();
    }
    try {
        execSync(`docker stop ${container}`);
        return {
            dbStopped: true
        };
    } catch (error) {
        console.log(`- Failed to stop/remove ${container}: ${error.message}`);
        throw {
            isError: true,
            message: `Failed to stop/remove ${container}: ${error.message}`
        };
    };
};

/**
 * Create a database.
 *
 * @param {String} dbConfig - Parameters for creating a database within the
 *                           `container` or to check if one already exists.
 * @param {String} dbConfig.host - Host for database requests.
 * @param {String} dbConfig.port - Port for database requests.
 * @param {String} dbConfig.database - The database name.
 * @param {String} dbConfig.user - Adminstrative user of the database.
 * @param {String} dbConfig.password - Adminstrator's password.
 * @return {Object} {created: true} if no error; {isError: true, message: error-message} otherwise.
 */
fluid.personalData.createDB = async function (dbConfig) {
    // When using npm module "pg" to create a new database, "pg" requires its instance to connect to
    // an existing database. The workaround is to connect to a system database "postgres", create
    // the database, then connect to the new database.
    // See https://stackoverflow.com/questions/20813154/node-postgres-create-database
    const postgresOps = require("../dbOps/postgresOps.js");
    const postgresHandler = new postgresOps.postgresOps({
        database: "postgres",
        port: dbConfig.port,
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password
    });
    const dbName = dbConfig.database;

    try {
        console.log("- Creating database \"" + dbName + "\" ...");
        await postgresHandler.runSql("CREATE DATABASE \"" + dbName + "\"");
        return {
            isCreated: true
        };
    } catch (error) {
        if (error.message.indexOf("already exists") !== -1) {
            console.log(`database "${dbName}" already exists`);
            return {
                isCreated: true
            };
        } else {
            console.log(`Error at creating database: ${error.message}`);
            throw {
                isError: true,
                message: `Error at creating database: ${error.message}`
            };
        }
    }
};

/**
 * Clear a database.
 *
 * @param {Object} postgresHandler - The postgresOps object to use to interact
 *                             with the database.
 * @param {String} clearDbSqlFile - Path to file containing SQL to clear the database.
 * @return {Object} {isCleared: true} if no error; {isError: true, message: error-message} otherwise.
 */
fluid.personalData.clearDB = async function (postgresHandler, clearDbSqlFile) {
    try {
        console.log("- Clearing database...");
        await postgresHandler.runSqlFile(clearDbSqlFile);
        return {
            isCleared: true
        };
    } catch (error) {
        console.log(`- Error at clearing database: ${error.message}`);
        throw {
            isError: true,
            message: `Error at clearing database: ${error.message}`
        };
    }
};

/**
 * Set up tables and load data records into tables.
 *
 * @param {Object} postgresHandler - The postgresOps object to use to interact with the database.
 * @param {Object} sqlFiles - SQL files to use to initiate the database
 * @param {String} sqlFiles.createTables - Path to SQL file with commands to create the database tables.
 * @param {String} sqlFiles.createSessionTable - Path to SQL file to create the session table.
 * @param {String} sqlFiles.loadData - Path to SQL file to load data into tables.
 * @return {Object} {isInited: true} if no error; {isError: true, message: error-message} otherwise.
 */
fluid.personalData.initDB = async function (postgresHandler, sqlFiles) {
    try {
        console.log("- Creating tables ...");
        await postgresHandler.runSqlFile(sqlFiles.createTables);
        console.log("- Creating the session table ...");
        await postgresHandler.runSqlFile(sqlFiles.createSessionTable);
        console.log("- Loading initial data ...");
        await postgresHandler.runSqlFile(sqlFiles.loadData);
        return {
            isInited: true
        };
    } catch (error) {
        if (error.message.indexOf("already exists") !== -1) {
            console.log("Tables already exist");
            return {
                isInited: true
            };
        } else {
            console.log(`Error at initalizing database: ${error.message}`);
            throw {
                isError: true,
                message: `Error at initalizing database: ${error.message}`
            };
        }
    }
};
