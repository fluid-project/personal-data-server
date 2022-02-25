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
const ssoDbOps = require("../src/server/ssoDbOps.js");
const server = require("../server.js");

jqUnit.module("Personal Data Server Google SSO Tests");

fluid.registerNamespace("fluid.tests.googleSso");

const skipDocker = process.env.SKIPDOCKER === "true" ? true : false;

const mockAccessToken = {
    access_token: "PatAccessToken.someRandomeString",
    expires_in: 3600,
    refresh_token: "anotherRandomString"
};

// The mock code returned via the redirect URI
const mockAuthCode = "mock-auth-code";

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

// Keep track of the payload returned by the auth request for consequent tests
let authPayload;

jqUnit.test("Google SSO tests", async function () {
    jqUnit.expect(skipDocker ? 41 : 43);
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

    // Test "/sso/google"
    response = await fluid.tests.googleSso.sendAuthRequest(serverUrl, "/sso/google");
    fluid.tests.googleSso.testResponse(response, 200, {}, "/sso/google");

    // Test the successful workflow of "/sso/google/login/callback"
    fluid.tests.setupMockResponsesForCallback(googleSso.options);
    response = await fluid.tests.utils.sendRequest(serverUrl, "/sso/google/login/callback?code=" + mockAuthCode);
    jqUnit.assertNotNull("loginToken is returned", response.data.loginToken);

    // Delete the test user -- this will cascade and delete the associated SsoAccount and AccessToken.
    response = await fluid.tests.deleteTestUser(mockUserInfo.id, ssoDbOps);
    jqUnit.assertNotNull(`Checking deletion of mock user ${mockUserInfo.id}`, response);

    // Unit tests of individual functions
    // Test successful GoogleSso.fetchAccessToken() with mock /token endpoint
    response = await fluid.tests.googleSso.fetchAccessToken(googleSso, authPayload.code, ssoDbOps, googleSso.options, 200);
    fluid.tests.googleSso.testResponse(response, 200, mockAccessToken, "googleSso.fetchAccessToken(/token)");

    // Test failure of GoogleSso.fetchAccessToken()
    response = await fluid.tests.googleSso.fetchAccessToken(googleSso, authPayload.code, ssoDbOps, googleSso.options, 400);
    fluid.tests.googleSso.testResponse(response, 400, mockErrorResponse, "googleSso.fetchAccessToken(/token)");

    // Test successful GoogleSso.fetchUserInfo() with mock /userInfo endpoint
    response = await fluid.tests.googleSso.fetchUserInfo(googleSso, mockAccessToken, googleSso.options, 200);
    fluid.tests.googleSso.testResponse(response, 200, mockUserInfo, "googleSso.fetchUserInfo(/userInfo)");

    // Test failure GoogleSso.fetchUserInfo() with mock /userInfo endpoint
    response = await fluid.tests.googleSso.fetchUserInfo(googleSso, mockAccessToken, googleSso.options, 400);
    fluid.tests.googleSso.testResponse(response, 400, mockErrorResponse, "googleSso.fetchUserInfo(/userInfo)");

    // Test googleSso.storeUserAndAccessToken()
    response = await fluid.tests.googleSso.storeUserAndAccessToken(googleSso, ssoDbOps, mockUserInfo, mockAccessToken);
    fluid.tests.googleSso.testStoreUserAndAccessToken(response, "googleSso.storeUserAndAccessToken()", googleSso.options);

    // Test failure of "/sso/google/login/callback" -- missing authorization code parameter
    response = await fluid.tests.utils.sendRequest(serverUrl, "/sso/google/login/callback");
    fluid.tests.googleSso.testResponse(response, 403, {"isError": true, "message": "Request missing authorization code"}, "/sso/google/login/callback");

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

fluid.tests.googleSso.testStoreUserAndAccessToken = function (accountInfo, testPoint, ssoOptions) {
    const checkPrefix = `Check '${testPoint}'`;
    jqUnit.assertNotNull(`${checkPrefix} non-null result`, accountInfo);

    // Spot check parts of the User record that can be tested
    jqUnit.assertNotNull(`${checkPrefix} non-null User`, accountInfo.user);
    jqUnit.assertEquals(`${checkPrefix} User id`, mockUserInfo.id, accountInfo.user.userId);
    jqUnit.assertEquals(`${checkPrefix} User name`, mockUserInfo.name, accountInfo.user.name);
    jqUnit.assertEquals(`${checkPrefix} User email`, mockUserInfo.email, accountInfo.user.email);
    jqUnit.assertEquals(`${checkPrefix} User username`, mockUserInfo.email, accountInfo.user.username);
    jqUnit.assertDeepEq(`${checkPrefix} User roles`, ["user"], accountInfo.user.roles);
    jqUnit.assertEquals(`${checkPrefix} User verified`, true, accountInfo.user.verified);

    // Spot check aspect of the AppSsoProvider record
    jqUnit.assertNotNull(`${checkPrefix} non-null AppSsoProvider`, accountInfo.appSsoProvider);
    jqUnit.assertEquals(`${checkPrefix} AppSsoProvider provider`, ssoOptions.provider, accountInfo.appSsoProvider.provider);

    // Similarly, the SsoAccount record
    jqUnit.assertNotNull(`${checkPrefix} non-null SsoAccount`, accountInfo.ssoAccount);
    jqUnit.assertEquals(`${checkPrefix} SsoAccount user`, mockUserInfo.id, accountInfo.ssoAccount.user);
    jqUnit.assertDeepEq(`${checkPrefix} SsoAccount userInfo`, mockUserInfo, accountInfo.ssoAccount.userInfo);

    // Similarly spot check aspects of the AccessToken record
    jqUnit.assertNotNull(`${checkPrefix} non-null AccessToken`, accountInfo.accessToken);
    jqUnit.assertEquals(`${checkPrefix} AccessToken accessToken`, mockAccessToken.access_token, accountInfo.accessToken.accessToken);
    jqUnit.assertEquals(`${checkPrefix} AccessToken refreshToken`, mockAccessToken.refresh_token, accountInfo.accessToken.refreshToken);
    jqUnit.assertNotNull(`${checkPrefix} AccessToken expiresAt`, accountInfo.accessToken.expiresAt);
    jqUnit.assertNotNull(`${checkPrefix} AccessToken loginToken`, accountInfo.accessToken.loginToken);
};

fluid.tests.setupMockResponsesForCallback = function (options) {
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
        .reply(200, mockAccessToken);


    // Mock Google's get user info endpoint.
    const userInfoURL = new url.URL(options.userInfoUri);
    nock(userInfoURL.origin)
        .get(userInfoURL.pathname)
        .query(true)
        .reply(200, mockUserInfo);
};

fluid.tests.googleSso.sendAuthRequest = async function (serverUrl, endpoint) {
    // Mock Google's OAuth2 endpoint.  The request payload is stored in `authPayload` for subsequent tests.
    nock("https://accounts.google.com")
        .get("/o/oauth2/auth")
        .query(function (payload) {
            authPayload = payload;
            return true;
        })
        .reply(200, {});

    // Send the auth request which uses the mock response.
    console.debug("- Sending '%s'", endpoint);
    try {
        return await axios.get(serverUrl + endpoint);
    } catch (e) {
        return e.response;
    }
};

fluid.tests.googleSso.fetchAccessToken = function (googleSso, code, ssoDbOps, options, responseStatus) {
    let mockResponse;
    switch (responseStatus) {
    case 200:
        mockResponse = {
            status: responseStatus,
            body: mockAccessToken
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
    return googleSso.fetchAccessToken(code, ssoDbOps, options);
};

fluid.tests.googleSso.fetchUserInfo = function (googleSso, accessToken, options, responseStatus) {
    let mockResponse;
    switch (responseStatus) {
    case 200:
        mockResponse = {
            status: responseStatus,
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
    return googleSso.fetchUserInfo(accessToken, options);
};

fluid.tests.googleSso.storeUserAndAccessToken = async function (googleSso, ssoDbOps, userInfo, accessToken) {
    try {
        console.debug("- Calling googleSso.storeUserAndAccessToken()");
        return await googleSso.storeUserAndAccessToken(
            userInfo, accessToken, ssoDbOps, googleSso.options
        );
    } catch (error) {
        console.debug(error.message);
    }
};

fluid.tests.deleteTestUser = async function (userId, ssoDbOps) {
    console.debug(`- Deleting user with id '${userId}'`);
    const deleteResult = await ssoDbOps.runSql(`DELETE FROM "User" WHERE "userId"='${userId}' RETURNING *`);
    return deleteResult;
};
