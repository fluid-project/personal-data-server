/*
 * Copyright 2021-2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 */

"use strict";

require("json5/lib/register");
const fluid = require("infusion");
const axios = require("axios");
const nock = require("nock");
const url = require("url");
const jqUnit = require("node-jqunit");

require("../src/shared/driverUtils.js");
require("./shared/utilsCommon.js");
require("./shared/utilsSso.js");

const path = require("path");
const config = require("../src/shared/utils.js").loadConfig(path.join(__dirname, "testConfig.json5"));
const serverUrl = "http://localhost:" + config.server.port;
fluid.tests.utils.setDbEnvVars(config.db);

const googleSso = require("../src/server/routes/ssoProviders/googleSso.js");
const ssoDbOps = require("../src/server/dbOps.js");
const server = require("../server.js");

jqUnit.module("Personal Data Server Google SSO Tests");

fluid.registerNamespace("fluid.tests.googleSso");

const skipDocker = process.env.SKIPDOCKER === "true" ? true : false;

// The mock code returned via the redirect URI
const mockAuthCode = "mock-auth-code";

const mockAccessTokenInfo = {
    access_token: "PatAccessToken.someRandomeString",
    expires_in: 3600,
    refresh_token: "anotherRandomString"
};

const mockAccessTokenInfoUpdated = {
    access_token: "UpdatedAccessToken.moreRandomeString",
    expires_in: 3600,
    refresh_token: "updatedRandomString"
};

// Mock referer URL of an external website
const mockReferer = "https://external.site.com/about/";

// Possible errors are "invalid_request", "invalid_client", "invalid_grant".
// "unauthorized_client", "unsupported_grant_type", or "invalid_scope".
// However, the status code is "400 Bad Request" for all of them -- use same
// mock in all cases.
// https://www.rfc-editor.org/rfc/rfc6749#section-5.2
const mockErrorResponse = {
    error: "invalid client",
    error_description: "The specified client is unknown"
};

const mockUserInfo = {
    id: "PatId",
    name: "Pat Smith",
    email: "pat.smith@somewhere.com",
    locale: "en",
    picture: "https://lh3.googleusercontent.com/picture/url",
    given_name: "Pat",
    family_name: "Smith",
    verified_email: true
};

// The record with the same user id will be updated rather than being added as a new record
const mockUserInfoUpdated = {
    id: "PatId",
    name: "Pat Smith Updated",
    email: "pat.smith.updated@somewhere.com",
    locale: "fr",
    picture: "https://lh3.googleusercontent.com/picture/url/updated",
    given_name: "Pat Updated",
    family_name: "Smith Updated",
    verified_email: true
};

// Keep track of the payload returned by the auth request for consequent tests
let authPayload;

jqUnit.test("Google SSO unit tests", async function () {
    jqUnit.expect(skipDocker ? 55 : 57);
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
    response = await fluid.personalData.clearDB(ssoDbOps, fluid.tests.sqlFiles.clearDB);
    jqUnit.assertTrue("The database " + config.db.database + " has been cleared successfully", response.isCleared);

    // Initialize db: create tables and load data
    response = await fluid.personalData.initDB(ssoDbOps, fluid.tests.sqlFiles);
    jqUnit.assertTrue("The database " + config.db.database + " has been initialized successfully", response.isInited);

    // Start the server
    const serverInstance = await server.startServer(config.server.port);
    // In case the server failed to start
    serverInstance.status.catch((error) => {
        throw new Error("Failed at starting server:" + error);
    });
    serverStatus = await fluid.personalData.getServerStatus(config.server.port);
    jqUnit.assertTrue("The server is up and running", serverStatus);

    // Test "/ready" to ensure the server is up and running
    response = await fluid.tests.utils.sendRequest(serverUrl, "/ready");
    fluid.tests.googleSso.testResponse(response, 200, { isReady: true }, "/ready (should succeed)");

    // Unit tests of individual functions
    // Test successful GoogleSso.fetchAccessToken() with mock /token endpoint
    response = await fluid.tests.googleSso.fetchAccessToken(googleSso, mockAuthCode, ssoDbOps, googleSso.options, 200);
    fluid.tests.googleSso.testResponse(response, 200, mockAccessTokenInfo, "googleSso.fetchAccessToken(/token)");

    // Test failure of GoogleSso.fetchAccessToken()
    response = await fluid.tests.googleSso.fetchAccessToken(googleSso, mockAuthCode, ssoDbOps, googleSso.options, 400);
    fluid.tests.googleSso.testResponse(response, 400, mockErrorResponse, "googleSso.fetchAccessToken(/token)");

    // Test successful GoogleSso.fetchUserInfo() with mock /userInfo endpoint
    response = await fluid.tests.googleSso.fetchUserInfo(googleSso, mockAccessTokenInfo, googleSso.options, 200);
    fluid.tests.googleSso.testResponse(response, 200, mockUserInfo, "googleSso.fetchUserInfo(/userInfo)");

    // Test failure GoogleSso.fetchUserInfo() with mock /userInfo endpoint
    response = await fluid.tests.googleSso.fetchUserInfo(googleSso, mockAccessTokenInfo, googleSso.options, 400);
    fluid.tests.googleSso.testResponse(response, 400, mockErrorResponse, "googleSso.fetchUserInfo(/userInfo)");

    // Test googleSso.storeUserAndAccessToken()
    response = await fluid.tests.googleSso.storeUserAndAccessToken(googleSso, ssoDbOps, mockUserInfo, mockAccessTokenInfo);
    await fluid.tests.googleSso.testStoreUserAndAccessToken(response, ssoDbOps, "googleSso.storeUserAndAccessToken()", googleSso.options, mockUserInfo, mockAccessTokenInfo);

    // Recall googleSso.storeUserAndAccessToken() will update the old information
    response = await fluid.tests.googleSso.storeUserAndAccessToken(googleSso, ssoDbOps, mockUserInfoUpdated, mockAccessTokenInfoUpdated);
    await fluid.tests.googleSso.testStoreUserAndAccessToken(response, ssoDbOps, "googleSso.storeUserAndAccessToken()", googleSso.options, mockUserInfoUpdated, mockAccessTokenInfoUpdated, true);

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

jqUnit.test("Google SSO integration tests", async function () {
    jqUnit.expect(skipDocker ? 34 : 36);
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
    response = await fluid.personalData.clearDB(ssoDbOps, fluid.tests.sqlFiles.clearDB);
    jqUnit.assertTrue("The database " + config.db.database + " has been cleared successfully", response.isCleared);

    // Initialize db: create tables and load data
    response = await fluid.personalData.initDB(ssoDbOps, fluid.tests.sqlFiles);
    jqUnit.assertTrue("The database " + config.db.database + " has been initialized successfully", response.isInited);

    // Start the server
    const serverInstance = await server.startServer(config.server.port);
    // In case the server failed to start
    serverInstance.status.catch((error) => {
        throw new Error("Failed at starting server:" + error);
    });
    serverStatus = await fluid.personalData.getServerStatus(config.server.port);
    jqUnit.assertTrue("The server is up and running", serverStatus);

    // Test "/ready" to ensure the server is up and running
    response = await fluid.tests.utils.sendRequest(serverUrl, "/ready");
    fluid.tests.googleSso.testResponse(response, 200, { isReady: true }, "/ready (should succeed)");

    // Setup mock responses from google, the OAuth provider
    fluid.tests.setupMockResponses(googleSso.options, 3);

    // Test the successful workflows of "/sso/google" & "/sso/google/login/callback"
    // Success case 1: referer is not in the "/sso/google" request header
    response = await fluid.tests.googleSso.sendAuthRequest(serverUrl, "/sso/google");
    fluid.tests.googleSso.testResponse(response, 200, "", "/sso/google");
    fluid.tests.googleSso.testNumOfRecords(
        "When the referer is not in the request header, referer_tracker table is not upated",
        ssoDbOps, "referer_tracker", 0
    );

    response = await fluid.tests.utils.sendRequest(serverUrl, "/sso/google/login/callback?code=" + mockAuthCode + "&state=" + authPayload.state);
    fluid.tests.googleSso.testResponse(response, 200, {accessToken: "\"PatAccessToken.someRandomeString\""}, "/sso/google/login/callback");
    fluid.tests.googleSso.testNumOfRecords(
        "When the referer is not in the request header, access token is generated",
        ssoDbOps, "access_token", 1
    );
    fluid.tests.googleSso.testNumOfRecords(
        "When the referer is not in the request header, login token is not generated",
        ssoDbOps, "login_token", 0
    );

    // Success case 2: referer is Personal Data Server self domain
    response = await fluid.tests.googleSso.sendAuthRequest(serverUrl, "/sso/google", {
        "headers": {
            "referer": config.server.selfDomain
        }
    });
    fluid.tests.googleSso.testResponse(response, 200, "", "/sso/google");
    fluid.tests.googleSso.testNumOfRecords(
        "When the referer is Personal Data Server self domain, referer_tracker table is not upated",
        ssoDbOps, "referer_tracker", 0
    );

    response = await fluid.tests.utils.sendRequest(serverUrl, "/sso/google/login/callback?code=" + mockAuthCode + "&state=" + authPayload.state);
    fluid.tests.googleSso.testResponse(response, 200, {accessToken: "\"PatAccessToken.someRandomeString\""}, "/sso/google/login/callback");
    fluid.tests.googleSso.testNumOfRecords(
        "When the referer is Personal Data Server self domain, access token is generated",
        ssoDbOps, "access_token", 1
    );
    fluid.tests.googleSso.testNumOfRecords(
        "When the referer is Personal Data Server self domain, login token is not generated",
        ssoDbOps, "login_token", 0
    );

    // Success case 3: referer is from an external url that is not Personal Data Server self domain.
    // The response should redirect to the external url.
    response = await fluid.tests.googleSso.sendAuthRequest(serverUrl, "/sso/google", {
        "headers": {
            "referer": mockReferer
        }
    });
    fluid.tests.googleSso.testResponse(response, 200, "", "/sso/google");
    fluid.tests.googleSso.testNumOfRecords(
        "When the referer is an external URL, referer_tracker table is upated",
        ssoDbOps, "referer_tracker", 1
    );

    response = await fluid.tests.utils.sendRequest(serverUrl, "/sso/google/login/callback?code=" + mockAuthCode + "&state=" + authPayload.state);
    jqUnit.assertEquals("The response redirects to the mock referer", "external.site.com", response.hostname);
    fluid.tests.googleSso.testNumOfRecords(
        "When the referer is an external URL, referer_tracker record is removed after the verification",
        ssoDbOps, "referer_tracker", 0
    );
    fluid.tests.googleSso.testNumOfRecords(
        "When the referer is an external URL, access token is generated",
        ssoDbOps, "access_token", 1
    );
    fluid.tests.googleSso.testNumOfRecords(
        "When the referer is an external URL, login token is generated",
        ssoDbOps, "login_token", 1
    );

    // Test failure of "/sso/google/login/callback" - wrong anti-forgery parameter
    response = await fluid.tests.utils.sendRequest(serverUrl, "/sso/google/login/callback?code=" + mockAuthCode + "&state=wrongState");
    fluid.tests.googleSso.testResponse(response, 403, {
        isError: true,
        message: "Mismatched anti-forgery parameter"
    }, "/sso/google/login/callback?code=" + mockAuthCode + "&state=wrongState");

    // Test failure of "/sso/google/login/callback" - Request missing authorization code
    response = await fluid.tests.utils.sendRequest(serverUrl, "/sso/google/login/callback?state=one-state-value");
    fluid.tests.googleSso.testResponse(response, 403, {
        isError: true,
        message: "Request missing authorization code"
    }, "/sso/google/login/callback?state=" + authPayload.state);

    // Test failure of "/sso/google/login/callback" -- when an error message is returned by Google
    response = await fluid.tests.utils.sendRequest(serverUrl, "/sso/google/login/callback?error=access_denied");
    fluid.tests.googleSso.testResponse(response, 403, {"isError": true, "message": "The user does not approve the request. Error: access_denied"}, "/sso/google/login/callback");

    if (!skipDocker) {
        // Stop the docker container for the database
        response = await fluid.personalData.dockerStopDatabase(config.db.dbContainerName, ssoDbOps);
        jqUnit.assertTrue("The database docker container has been stopped", response.dbStopped);
    }

    // Stop the server
    await server.stopServer(serverInstance.server);
    serverStatus = await fluid.personalData.getServerStatus(config.server.port);
    jqUnit.assertFalse("The server has been stopped", serverStatus);
});

fluid.tests.googleSso.testResponse = function (response, expectedStatus, expected, endPoint) {
    jqUnit.assertEquals("Check '" + endPoint + "' response status", expectedStatus, response.status);
    jqUnit.assertDeepEq("Check '" + endPoint + "' result", expected, response.data);
};

fluid.tests.setupMockResponses = function (options, repeatTimes) {
    nock.cleanAll();

    // Mock Google's OAuth2 endpoint.  The request payload is stored in `authPayload` for subsequent tests.
    nock("https://accounts.google.com")
        .get("/o/oauth2/auth")
        .times(repeatTimes)
        .query(function (payload) {
            authPayload = payload;
            return true;
        })
        .reply(200);

    // Mock Google's get access token endpoint.
    const accessTokenURL = new url.URL(options.accessTokenUri);
    nock(accessTokenURL.origin)
        .post(accessTokenURL.pathname, {
            grant_type: "authorization_code",
            code: mockAuthCode,
            redirect_uri: options.redirectUri,
            client_id: "554291169960-repqllu9q9h5loog0hpadr6854fb2oq0.apps.dummy.com",
            client_secret: "ek1k4RNTao8XY6gAmmOXxJ6m"
        })
        .times(repeatTimes)
        .reply(200, mockAccessTokenInfo);

    // Mock Google's get user info endpoint.
    const userInfoURL = new url.URL(options.userInfoUri);
    nock(userInfoURL.origin)
        .get(userInfoURL.pathname)
        .times(repeatTimes)
        .query(true)
        .reply(200, mockUserInfo);
};

fluid.tests.googleSso.sendAuthRequest = async function (serverUrl, endpoint, options) {
    options = options ? options : {};
    // Send the auth request which uses the mock response.
    console.debug("- Sending '%s'", endpoint);
    try {
        return await axios.get(serverUrl + endpoint, options);
    } catch (e) {
        return e.response;
    }
};

fluid.tests.googleSso.fetchAccessToken = function (googleSso, code, ssoDbOps, options, responseCode) {
    let mockResponse;

    nock.cleanAll();

    switch (responseCode) {
    case 200:
        mockResponse = {
            status: responseCode,
            body: mockAccessTokenInfo
        };
        break;
    case 400:
        mockResponse = {
            status: 400,
            body: mockErrorResponse
        };
    }
    const accessTokenURL = new url.URL(options.accessTokenUri);
    nock(accessTokenURL.origin)
        .post(accessTokenURL.pathname)
        .reply(mockResponse.status, mockResponse.body);

    console.debug("- Calling googleSso.fetchAccessToken(/token)");
    return googleSso.fetchAccessToken(code, ssoDbOps, options.accessTokenUri, options.redirectUri, options.provider);
};

fluid.tests.googleSso.fetchUserInfo = function (googleSso, accessToken, options, responseCode) {
    let mockResponse;

    nock.cleanAll();

    switch (responseCode) {
    case 200:
        mockResponse = {
            status: responseCode,
            body: mockUserInfo
        };
        break;
    case 400:
        mockResponse = {
            status: 400,
            body: mockErrorResponse
        };
    }
    const userInfoURL = new url.URL(options.userInfoUri);
    nock(userInfoURL.origin)
        .get(userInfoURL.pathname)
        .query(true)
        .reply(mockResponse.status, mockResponse.body);

    console.debug("- Calling googleSso.fetchUserInfo(/userInfo)");
    return googleSso.fetchUserInfo(accessToken, options.userInfoUri, options.provider);
};

fluid.tests.googleSso.testNumOfRecords = async function (msg, ssoDbOps, tableName, expectedNumOfRecords) {
    const results = await ssoDbOps.runSql("SELECT * FROM " + tableName);
    jqUnit.assertEquals(msg, expectedNumOfRecords, results.rowCount);
};

fluid.tests.googleSso.storeUserAndAccessToken = async function (googleSso, ssoDbOps, userInfo, accessTokenInfo) {
    try {
        console.debug("- Calling googleSso.storeUserAndAccessToken()");
        return await googleSso.storeUserAndAccessToken(userInfo, accessTokenInfo, ssoDbOps, googleSso.options.provider, googleSso.options.defaultPreferences);
    } catch (error) {
        console.debug(error.message);
    }
};

fluid.tests.googleSso.testStoreUserAndAccessToken = async function (response, ssoDbOps, testPoint, ssoOptions, expectedUserInfo, expectedAccessTokenInfo, isUpdate) {
    let checkPrefix = `Check '${testPoint}': `;

    // Test function returned response
    jqUnit.assertNotNull(`${checkPrefix} non-null result`, response);

    // Spot check parts of the user record that can be tested
    jqUnit.assertNotNull(`${checkPrefix} non-null sso_user_account_id`, response.sso_user_account_id);
    jqUnit.assertEquals(`${checkPrefix} access_token`, expectedAccessTokenInfo.access_token, response.access_token);
    jqUnit.assertEquals(`${checkPrefix} refresh_token`, expectedAccessTokenInfo.refresh_token, response.refresh_token);
    jqUnit.assertNotNull(`${checkPrefix} expires_at`, response.expires_at);
    jqUnit.assertNotNull(`${checkPrefix} created_timestamp`, response.created_timestamp);
    jqUnit[isUpdate ? "assertNotNull" : "assertNull"](`${checkPrefix} last_updated_timestamp`, response.last_updated_timestamp);

    checkPrefix = `Check '${testPoint}' in DB: `;

    // Check sso_user_account record in the database
    const ssoUserAccountRecord = await ssoDbOps.runSql(`SELECT * FROM sso_user_account WHERE user_id_from_provider='${expectedUserInfo.id}' AND provider_id=(SELECT provider_id from sso_provider WHERE provider = '${ssoOptions.provider}');`);
    jqUnit.assertNotNull(`${checkPrefix} sso_user_account.provider_id`, ssoUserAccountRecord.rows[0].provider_id);
    jqUnit.assertNotNull(`${checkPrefix} sso_user_account.user_id`, ssoUserAccountRecord.rows[0].user_id);
    jqUnit.assertDeepEq(`${checkPrefix} sso_user_account.user_info`, expectedUserInfo, ssoUserAccountRecord.rows[0].user_info);
    jqUnit.assertNotNull(`${checkPrefix} sso_user_account.created_timestamp`, ssoUserAccountRecord.rows[0].created_timestamp);
    jqUnit[isUpdate ? "assertNotNull" : "assertNull"](`${checkPrefix} sso_user_account.last_updated_timestamp`, ssoUserAccountRecord.rows[0].last_updated_timestamp);

    // Check local_user record in the database
    const userRecord = await ssoDbOps.runSql(`SELECT * FROM local_user WHERE user_id='${ssoUserAccountRecord.rows[0].user_id}';`);
    jqUnit.assertDeepEq(`${checkPrefix} local_user.preferences`, ssoOptions.defaultPreferences, userRecord.rows[0].preferences);
    jqUnit.assertNotNull(`${checkPrefix} local_user.created_timestamp`, userRecord.rows[0].created_timestamp);
    jqUnit.assertNull(`${checkPrefix} local_user.last_updated_timestamp`, userRecord.rows[0].last_updated_timestamp);

    // Check access_token record in the database
    const accessTokenRecord = await ssoDbOps.runSql(`SELECT * FROM access_token WHERE sso_user_account_id='${response.sso_user_account_id}';`);
    jqUnit.assertDeepEq(`${checkPrefix} access_token.access_token`, expectedAccessTokenInfo.access_token, accessTokenRecord.rows[0].access_token);
    jqUnit.assertEquals(`${checkPrefix} access_token.refresh_token`, expectedAccessTokenInfo.refresh_token, accessTokenRecord.rows[0].refresh_token);
    jqUnit.assertNotNull(`${checkPrefix} access_token.expires_at`, response.expires_at);
    jqUnit.assertNotNull(`${checkPrefix} access_token.created_timestamp`, accessTokenRecord.rows[0].created_timestamp);
    jqUnit[isUpdate ? "assertNotNull" : "assertNull"](`${checkPrefix} access_token.last_updated_timestamp`, accessTokenRecord.rows[0].last_updated_timestamp);
};

fluid.tests.cleanUpDb = async function (ssoDbOps) {
    console.debug("- Truncate tables: local_user, sso_user_account, access_token");
    const deleteResult = await ssoDbOps.runSql("TRUNCATE TABLE local_user CASCADE;");
    return deleteResult;
};
