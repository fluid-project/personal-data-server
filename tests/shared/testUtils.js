/*
 * Copyright 2021-2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 */

"use strict";

const fluid = require("infusion");
const jqUnit = require("node-jqunit");
const axios = require("axios");
const nock = require("nock");
const url = require("url");

fluid.registerNamespace("fluid.tests.utils");

fluid.tests.sqlFiles = {
    clearDB: __dirname + "/../../dataModel/ClearDB.sql",
    createTables: __dirname + "/../../dataModel/SsoTables.sql",
    createSessionTable: __dirname + "/../../node_modules/connect-pg-simple/table.sql",
    loadData: __dirname + "/../data/SsoProvidersData.sql"
};

fluid.tests.utils.setDbEnvVars = function (dbConfig) {
    process.env.PDS_DATABASE = dbConfig.database;
    process.env.PDS_DBHOST = dbConfig.host;
    process.env.PDS_DBPORT = dbConfig.port;
    process.env.PDS_DBUSER = dbConfig.user;
    process.env.PDS_DBPASSWORD = dbConfig.password;
};

/**
 * Initialize a test database and set up its tables, if it/they do not already
 * exist, and load some test data records.
 *
 * @param {String} serverDomain - The server domain.
 * @param {String} endpoint - The end point supported by the server.
 * @param {String} options - Optional. Axios options when sending requests.
 * @param {String} method - Optional. Request method. The default is "GET".
 * @param {String|Object} data - Optional. The data to be sent as the request body.
 * Only applicable for request methods 'PUT', 'POST', 'DELETE , and 'PATCH'.
 * @return {Object} The response object containing the response code and message.
 */
fluid.tests.utils.sendRequest = async function (serverDomain, endpoint, options, method, data) {
    console.debug("- Sending '%s' request", endpoint);
    options = options || {};
    method = method || "get";
    try {
        if (["post", "put", "patch"].includes(method)) {
            return await axios[method](serverDomain + endpoint, data, options);
        } else {
            return await axios[method](serverDomain + endpoint, options);
        }
    } catch (e) {
        // Return e.response when the server responds with an error.
        // Return e when the server endpoint doesn't exist.
        return e.response ? e.response : e;
    }
};

fluid.tests.utils.testResponse = function (response, expectedStatus, expected, endPoint) {
    jqUnit.assertEquals("Check '" + endPoint + "' response status", expectedStatus, response.status);
    jqUnit.assertDeepEq("Check '" + endPoint + "' result", expected, response.data);
};

/**
 * Disconnect the postgres client from its server. See https://node-postgres.com/api/client
 *
 * @param {Object} postgresHandler - The postgres handler.
 */
fluid.tests.utils.finish = async function (postgresHandler) {
    await postgresHandler.end().then(() => {
        fluid.log("Postgres operations done");
    });
};

/************ Utilities for auth requests **************/

// The mock code returned via the redirect URI
fluid.tests.utils.mockAuthCode = "mock-auth-code";

// Mock referer URL of an external website
fluid.tests.utils.mockReferer = "https://external.site.com/about/";

fluid.tests.utils.mockAccessTokenInfo = {
    access_token: "PatAccessToken.someRandomeString",
    expires_in: 3600,
    refresh_token: "anotherRandomString"
};

fluid.tests.utils.mockUserInfo = {
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
fluid.tests.utils.authPayload;

fluid.tests.utils.setupMockResponses = function (options, repeatTimes) {
    nock.cleanAll();

    // Mock Google's OAuth2 endpoint.  The request payload is stored in `fluid.tests.utils.authPayload` for subsequent tests.
    nock("https://accounts.google.com")
        .get("/o/oauth2/auth")
        .times(repeatTimes)
        .query(function (payload) {
            fluid.tests.utils.authPayload = payload;
            return true;
        })
        .reply(200);

    // Mock Google's get access token endpoint.
    const accessTokenURL = new url.URL(options.accessTokenUri);
    nock(accessTokenURL.origin)
        .post(accessTokenURL.pathname, {
            grant_type: "authorization_code",
            code: fluid.tests.utils.mockAuthCode,
            redirect_uri: options.redirectUri,
            client_id: "554291169960-repqllu9q9h5loog0hpadr6854fb2oq0.apps.dummy.com",
            client_secret: "ek1k4RNTao8XY6gAmmOXxJ6m"
        })
        .times(repeatTimes)
        .reply(200, fluid.tests.utils.mockAccessTokenInfo);

    // Mock Google's get user info endpoint.
    const userInfoURL = new url.URL(options.userInfoUri);
    nock(userInfoURL.origin)
        .get(userInfoURL.pathname)
        .times(repeatTimes)
        .query(true)
        .reply(200, fluid.tests.utils.mockUserInfo);
};
