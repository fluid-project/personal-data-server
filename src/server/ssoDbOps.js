/*
 * Copyright 2021-2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/personal-data-server/blob/main/LICENSE
 */

"use strict";

const path = require("path");
const postgresOps = require("../dbOps/postgresOps.js");
const generateToken = require("../shared/utils.js").generateRandomToken;
const config = require("../shared/utils.js").loadConfig(path.join(__dirname, "../../config.json5"));

class DataBaseRequest extends postgresOps.postgresOps {

    get dbConfig() { return config.db; };

    /**
     * Check that the database is ready to accept requests.  The check involves
     * retrieving the 'public' tables for one named "AppSsoProvider".
     *
     * @return {Boolean} - True if the connection to the database succeeds at
     *                     the configured host, port, user, and password, and
     *                     there is an "AppSsoProvider" table; false otherwise.
     */
    async isReady() {
        try {
            const tables = await this.runSql(
                "SELECT * FROM pg_catalog.pg_tables WHERE schemaname='public';"
            );
            return tables.rows.some ((aTable) => {
                return aTable.tablename === "AppSsoProvider";
            });
        } catch (error) {
            console.error("Error accessing database, ", error);
            throw error;
        }
    };

    /**
     * Retrieve, from the database, the clientId and secret for this app as provided
     * by given provider.
     *
     * @param {String} provider - The SSO provider, e.g, google, github, or some
     *                            other.
     * @return {Object}           The client information record for the given
     *                            provider.  Otherwise, an error is thrown;
     *                            either a "No such provider..." error, or a
     *                            database error.
     */
    async getSsoClientInfo(provider) {
        try {
            const clientInfo = await this.runSql(`
                SELECT * FROM "AppSsoProvider" WHERE provider='${provider}';
            `);
            if (clientInfo.rowCount !== 0) {
                return clientInfo.rows[0];
            } else {
                throw new Error(`No such provider as ${provider}`);
            }
        } catch (error) {
            console.error(`Error retrieving ${provider} provider info: `, error);
            throw error;
        }
    };

    /**
     * Create a User record, or find an exising one.  The default way to
     * identify a User is by their email whose value is given in the first
     * argument `userInfo`.  Another way to identify the user can be provided
     * by the caller using the `constraint` argument, e.g.
     * `{ name: "username", value: "pat" }`.
     *
     * @param {Object} userInfo - The information to use to locate an existing
     *                            User record or create a new one.
     * @param {Object} constraint - Optional field name and value to use to find
     *                              the user.
     * @param {String} constraint.name - Name of the field to filter by,
     *                                   defaults to "email",
     * @param {String} constraint.value - Value of the field to filter by,
     *                                    defaults to the form "name@host.com".
     * @return {Object} The User record that matches the `userInfo` and
     *                  `constraint`.
     */
    async addUser(userInfo, constraint) {
        const filter = constraint || {
            name: "email",
            value: userInfo.email
        };
        // Check if user already exists and create one if none.
        let userRecords = await this.runSql(
            `SELECT * FROM "User" WHERE "${filter.name}"='${filter.value}';`
        );
        // TODO: derived_key, verification_code, and salt are meaningless in
        // an SSO scenario.  Is it nonetheless necessary to create actual
        // values?  Using `generateToken()` for now.
        if (userRecords.rowCount === 0) {
            const newUser = {
                userId: userInfo.id,
                iterations: 0,
                username: userInfo.email,
                name: userInfo.name,
                roles: ["user"],
                derived_key: generateToken(255),
                verification_code: generateToken(255),
                salt: generateToken(255),
                email: userInfo.email,
                verified: true
            };
            const results =  await this.loadFromJSON("User", [newUser]);
            userRecords = results[0];
        }
        return userRecords.rows[0];
    };

    /**
     * Create an SsoAccount record associated with the given User record, or
     * update an exising SsoAccount.  Return an object consisting of the
     * associate User, SsoAccount, and AppSsoProvider records.
     *
     * @param {Object} userRecord - The User record in the database associated
     *                              with this account.
     * @param {Object} userInfo - The user information provided by the SSO
     *                            provider.
     * @param {String} provider - The SSO provider.
     * @return {Object} An object consisting of the User record, the
     *                  AppSsoProvider record, the SsoAccount record.
     */
    async addSsoAccount(userRecord, userInfo, provider) {
        const clientInfo = await this.getSsoClientInfo(provider);
        let ssoAccountRecords = await this.runSql(
            `SELECT * FROM "SsoAccount" WHERE "user"='${userRecord.userId}' AND "provider"='${clientInfo.providerId}';`
        );
        if (ssoAccountRecords.rowCount === 0) {
            const results = await this.loadFromJSON("SsoAccount", [{
                user: userRecord.userId,
                provider: clientInfo.providerId,
                userInfo: userInfo
            }]);
            ssoAccountRecords = results[0];
        } else {
            // TODO: consider adding updateFromJSON().
            const accountId = ssoAccountRecords.rows[0].ssoAccountId;
            const userInfoStr = JSON.stringify(userInfo);
            ssoAccountRecords = await this.runSql(`
                UPDATE "SsoAccount"
                    SET "userInfo"='${userInfoStr}'
                    WHERE "ssoAccountId"=${accountId}
                    RETURNING *;
            `);
        }
        return {
            user: userRecord,
            appSsoProvider: clientInfo,
            ssoAccount: ssoAccountRecords.rows[0]
        };
    };

    /**
     * Create and persist an AccessToken record, or update an exising one.
     * Add the new or updated AccessToken record to the `accountRecords`
     * object.
     *
     * @param {Object} accountRecords - Object containing the associated User,
     *                                  AppSsoProvider, and SsoAccount records.
     * @param {Object} accessToken - Access token associated with the User as
     *                               provided by the SSO provider.
     * @return {Object} An object consisting of the User record, and the
     *                  associated SsoAccount, AccessToken, and AppSsoProvider
     *                  records.
     */
    async refreshAccessToken(accountRecords, accessToken) {
        let accessTokenRecords = await this.runSql(`
            SELECT * FROM "AccessToken" WHERE
                "ssoAccount"=${accountRecords.ssoAccount.ssoAccountId} AND
                "ssoProvider"=${accountRecords.appSsoProvider.providerId};
        `);
        // If there is an access token record in the database, update it with
        // the new incoming access token, expiry, and possible refresh token.
        const expiryTimestamp = new Date(Date.now() + (accessToken.expires_in * 1000));
        let newTokenRecords;
        if (accessTokenRecords.rowCount > 0) {
            const accessTokenRecord = accessTokenRecords.rows[0];

            // If the value of the incoming access token is new, create a new
            // loginToken at the same time.
            let loginToken;
            if (accessTokenRecord.accessToken !== accessToken.access_token) {
                loginToken = generateToken(128);
            } else {
                loginToken = accessTokenRecord.loginToken;
            }
            // If there is a new incoming refresh token, update the database
            // with it; otherwise, leave it as is.
            if (accessToken.refresh_token) {
                newTokenRecords = await this.runSql(`
                    UPDATE "AccessToken" SET
                      "accessToken" = '${accessToken.access_token}',
                      "expiresAt" =  '${expiryTimestamp.toISOString()}',
                      "refreshToken" = '${accessToken.refresh_token}',
                      "loginToken" = '${loginToken}'
                      WHERE id=${accessTokenRecord.id}
                      RETURNING *;
                `);
            } else {
                newTokenRecords = await this.runSql(`
                    UPDATE "AccessToken" SET
                      "accessToken" = '${accessToken.access_token}',
                      "expiresAt" = '${expiryTimestamp.toISOString()}',
                      "loginToken" = '${loginToken}'
                      WHERE id=${accessTokenRecords.rows[0].id}
                      RETURNING *;
                `);
            }
        // No existing access token in the database for this user. Insert a new
        // one.
        } else {
            let accessTokenJSON = {
                ssoAccount: accountRecords.ssoAccount.ssoAccountId,
                ssoProvider: accountRecords.appSsoProvider.providerId,
                accessToken: accessToken.access_token,
                expiresAt: expiryTimestamp.toISOString(),
                loginToken: generateToken(128)
            };
            if (accessToken.refresh_token) {
                accessTokenJSON.refreshToken = accessToken.refresh_token;
            }
            const results = await this.loadFromJSON("AccessToken", [accessTokenJSON]);
            newTokenRecords = results[0];
        }
        accountRecords.accessToken = newTokenRecords.rows[0];
        return accountRecords;
    };
};

module.exports = new DataBaseRequest(config.db);
