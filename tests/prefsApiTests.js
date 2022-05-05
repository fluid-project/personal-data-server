/*
 * Copyright 2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 */

"use strict";

const fluid = require("infusion");
const jqUnit = require("node-jqunit");

require("../src/shared/driverUtils.js");
require("./shared/testUtils.js");

const path = require("path");
const config = require("../src/shared/utils.js").loadConfig(path.join(__dirname, "testConfig.json5"));
const serverUrl = "http://localhost:" + config.server.port;
fluid.tests.utils.setDbEnvVars(config.db);

const googleSso = require("../src/server/routes/ssoProviders/googleSso.js");
const dbOps = require("../src/server/dbOps.js");
const server = require("../server.js");

jqUnit.module("Personal Data Server Preferences API Tests");

fluid.registerNamespace("fluid.tests.prefsApi");

const skipDocker = process.env.PDS_SKIPDOCKER === "true" ? true : false;

jqUnit.test("Get preferences /get_prefs API tests", async function () {
    jqUnit.expect(skipDocker ? 11 : 13);
    let serverStatus, response;

    if (!skipDocker) {
        // Start the database
        response = await fluid.personalData.dockerStartDatabase(config.db.dbContainerName, config.db.dbDockerImage, config.db);
        jqUnit.assertTrue("The database docker container has been started successfully", response.dbReady);
    }

    // Create db
    response = await fluid.personalData.createDB(config.db);
    jqUnit.assertTrue("The database " + config.db.database + " has been created successfully", response.isCreated);

    // Clear the database for a fresh start
    response = await fluid.personalData.clearDB(dbOps, fluid.tests.sqlFiles.clearDB);
    jqUnit.assertTrue("The database " + config.db.database + " has been cleared successfully", response.isCleared);

    // Initialize db: create tables and load data
    response = await fluid.personalData.initDB(dbOps, fluid.tests.sqlFiles);
    jqUnit.assertTrue("The database " + config.db.database + " has been initialized successfully", response.isInited);

    // Start the server
    const serverInstance = await server.startServer(config.server.port);
    // In case the server failed to start
    serverInstance.status.catch((error) => {
        throw new Error("Failed at starting server:" + error);
    });
    serverStatus = await fluid.personalData.getServerStatus(config.server.port);
    jqUnit.assertTrue("The server is up and running", serverStatus);

    // Setup mock responses from google, the OAuth provider
    fluid.tests.utils.setupMockResponses(googleSso.options, 1);

    // 1. Success case: go through the login process to create a login token, then use the login token to
    // test the /get_prefs API
    // 1.1 Preparation: go through the login process to generate a login token
    response = await fluid.tests.utils.sendRequest(serverUrl, "/sso/google", {
        "headers": {
            "referer": fluid.tests.utils.mockReferer
        }
    });
    response = await fluid.tests.utils.sendRequest(serverUrl, "/sso/google/login/callback?code=" + fluid.tests.utils.mockAuthCode + "&state=" + fluid.tests.utils.authPayload.state);

    // 1.2 Retrieve the generated login token
    response = await dbOps.getLoginToken(1, "https://external.site.com");

    // 1.3 Use the login token to test /get_prefs API
    response = await fluid.tests.utils.sendRequest(serverUrl, "/get_prefs", {
        headers: {
            "Authorization": "Bearer " + response.login_token
        }
    });
    fluid.tests.utils.testResponse(response, 200, {
        textSize: 1.2,
        lineSpace: 1.2
    }, "/get_prefs (should succeed)");

    // 2. Failed case: loginToken is not provided
    response = await fluid.tests.utils.sendRequest(serverUrl, "/get_prefs");
    fluid.tests.utils.testResponse(response, 403, {"isError": true, "message": "Please login first."}, "/get_prefs");

    // 3. Failed case: wrong loginToken is not provided
    response = await fluid.tests.utils.sendRequest(serverUrl, "/get_prefs", {
        headers: {
            "Authorization": "Bearer wrong"
        }
    });
    fluid.tests.utils.testResponse(response, 403, {"isError": true, "message": "Invalid login token. Please login."}, "/get_prefs");

    if (!skipDocker) {
        // Stop the docker container for the database
        response = await fluid.personalData.dockerStopDatabase(config.db.dbContainerName);
        jqUnit.assertTrue("The database docker container has been stopped", response.dbStopped);
    }

    // Stop the server
    await server.stopServer(serverInstance.server);
    serverStatus = await fluid.personalData.getServerStatus(config.server.port);
    jqUnit.assertFalse("The server has been stopped", serverStatus);
});

jqUnit.test("Save preferences /save_prefs API tests", async function () {
    jqUnit.expect(skipDocker ? 17 : 19);
    let serverStatus, response;

    if (!skipDocker) {
        // Start the database
        response = await fluid.personalData.dockerStartDatabase(config.db.dbContainerName, config.db.dbDockerImage, config.db);
        jqUnit.assertTrue("The database docker container has been started successfully", response.dbReady);
    }

    // Create db
    response = await fluid.personalData.createDB(config.db);
    jqUnit.assertTrue("The database " + config.db.database + " has been created successfully", response.isCreated);

    // Clear the database for a fresh start
    response = await fluid.personalData.clearDB(dbOps, fluid.tests.sqlFiles.clearDB);
    jqUnit.assertTrue("The database " + config.db.database + " has been cleared successfully", response.isCleared);

    // Initialize db: create tables and load data
    response = await fluid.personalData.initDB(dbOps, fluid.tests.sqlFiles);
    jqUnit.assertTrue("The database " + config.db.database + " has been initialized successfully", response.isInited);

    // Start the server
    const serverInstance = await server.startServer(config.server.port);
    // In case the server failed to start
    serverInstance.status.catch((error) => {
        throw new Error("Failed at starting server:" + error);
    });
    serverStatus = await fluid.personalData.getServerStatus(config.server.port);
    jqUnit.assertTrue("The server is up and running", serverStatus);

    // Setup mock responses from google, the OAuth provider
    fluid.tests.utils.setupMockResponses(googleSso.options, 1);

    // 1. Success case: go through the login process to create a login token, then use the login token to
    // test the /save_prefs API
    // 1.1 Preparation: go through the login process to generate a login token
    response = await fluid.tests.utils.sendRequest(serverUrl, "/sso/google", {
        "headers": {
            "referer": fluid.tests.utils.mockReferer
        }
    });
    response = await fluid.tests.utils.sendRequest(serverUrl, "/sso/google/login/callback?code=" + fluid.tests.utils.mockAuthCode + "&state=" + fluid.tests.utils.authPayload.state);

    // 1.2 Retrieve the generated login token
    response = await dbOps.getLoginToken(1, "https://external.site.com");

    const loginToken = response.login_token;
    const prefsToSave = {
        textSize: 2
    };

    // 1.3 Use the login token to test /save_prefs API
    response = await fluid.tests.utils.sendRequest(serverUrl, "/save_prefs", {
        headers: {
            "Authorization": "Bearer " + loginToken
        }
    }, "post", prefsToSave);
    fluid.tests.utils.testResponse(response, 200, "Saved successfully.", "/save_prefs (should succeed)");
    jqUnit.assertDeepEq("The new preferences object is saved in the database", prefsToSave, await dbOps.getPreferences(loginToken));

    // 2. Success case: when the preferences object is not provided, an empty object is saved into the database
    response = await fluid.tests.utils.sendRequest(serverUrl, "/save_prefs", {
        headers: {
            "Authorization": "Bearer " + loginToken
        }
    }, "post", undefined);
    fluid.tests.utils.testResponse(response, 200, "Saved successfully.", "/save_prefs (should succeed)");
    jqUnit.assertDeepEq("The new preferences object is saved in the database", {}, await dbOps.getPreferences(loginToken));

    // 3. Failed case: loginToken is not provided
    response = await fluid.tests.utils.sendRequest(serverUrl, "/save_prefs", null, "post", prefsToSave);
    fluid.tests.utils.testResponse(response, 403, {"isError": true, "message": "Please login first."}, "/save_prefs");

    // 4. Failed case: wrong loginToken is not provided
    response = await fluid.tests.utils.sendRequest(serverUrl, "/save_prefs", {
        headers: {
            "Authorization": "Bearer wrong"
        }
    }, "post", prefsToSave);
    fluid.tests.utils.testResponse(response, 403, {"isError": true, "message": "Invalid login token. Please login."}, "/save_prefs");

    // 5. Failed case: when the size of the preferences object exceeds the size limit
    const largeObject = fluid.tests.prefsApi.createLargeObject(config.server.allowedPrefsSize + 1);
    response = await fluid.tests.utils.sendRequest(serverUrl, "/save_prefs", {
        headers: {
            "Authorization": "Bearer " + loginToken
        }
    }, "post", largeObject);
    jqUnit.assertEquals("The response code is 413", 413, response.status);
    jqUnit.assertTrue("The error is reported", response.data.includes("request entity too large"));

    if (!skipDocker) {
        // Stop the docker container for the database
        response = await fluid.personalData.dockerStopDatabase(config.db.dbContainerName);
        jqUnit.assertTrue("The database docker container has been stopped", response.dbStopped);
    }

    // Stop the server
    await server.stopServer(serverInstance.server);
    serverStatus = await fluid.personalData.getServerStatus(config.server.port);
    jqUnit.assertFalse("The server has been stopped", serverStatus);
});

// create a large object in the given size
// See https://stackoverflow.com/questions/14343844/create-a-string-of-variable-length-filled-with-a-repeated-character/34811384#34811384
fluid.tests.prefsApi.createLargeObject = function (size) {
    return {
        "a": "#".repeat(size - 1)
    };
};
