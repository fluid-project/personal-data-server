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

fluid.registerNamespace("fluid.tests.utils");

fluid.tests.sqlFiles = {
    clearDB: __dirname + "/../../dataModel/ClearDB.sql",
    createTables: __dirname + "/../../dataModel/SsoTables.sql",
    createSessionTable: __dirname + "/../../node_modules/connect-pg-simple/table.sql",
    loadData: __dirname + "/../data/SsoProvidersData.sql"
};

fluid.tests.utils.setDbEnvVars = function (dbConfig) {
    process.env.DATABASE = dbConfig.database;
    process.env.DBHOST = dbConfig.host;
    process.env.DBPORT = dbConfig.port;
    process.env.DBUSER = dbConfig.user;
    process.env.DBPASSWORD = dbConfig.password;
};

/**
 * Initialize a test database and set up its tables, if it/they do not already
 * exist, and load some test data records.
 *
 * @param {String} serverDomain - The server domain.
 * @param {String} endpoint - The end point supported by the server.
 * @param {String} options - Axios options when sending requests.
 * @return {Object} The response object containing the response code and message.
 */
fluid.tests.utils.sendRequest = async function (serverDomain, endpoint, options) {
    console.debug("- Sending '%s' request", endpoint);
    options = options || {};
    try {
        return await axios.get(serverDomain + endpoint, options);
    } catch (e) {
        // Return e.response when the server responds with an error.
        // Return e when the server endpoint doesn't exist.
        return e.response ? e.response : e;
    }
};
