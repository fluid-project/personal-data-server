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
const utils = require("../shared/utils.js");
const config = require("../shared/utils.js").loadConfig(path.join(__dirname, "../../config.json5"));

class DataBaseRequest extends postgresOps.postgresOps {

    get dbConfig() { return config.db; };

    /**
     * Check that the database is ready to accept requests.  The check involves
     * retrieving the 'public' tables for one named "sso_provider".
     *
     * @return {Boolean} - True if the connection to the database succeeds at
     *                     the configured host, port, user, and password, and
     *                     there is an "sso_provider" table; false otherwise.
     */
    async isReady() {
        try {
            const tables = await this.runSql(
                "SELECT * FROM pg_catalog.pg_tables WHERE schemaname='public';"
            );
            return tables.rows.some ((aTable) => {
                return aTable.tablename === "sso_provider";
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
                SELECT * FROM sso_provider WHERE provider='${provider}';
            `);
            console.log("");
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
     * Return an sso user account by sso user account id and provider name. Return null
     * if the record is not found.
     *
     * @param {Object} user_id_from_provider - The id returned by the provider.
     * @param {Object} provider - The SSO provider name such as "google".
     * @return {Object|null} Sso user account record if the account exists. Otherwise, return null.
     */
    async getSsoUserAccount(user_id_from_provider, provider) {
        const ssoAccountRecords = await this.runSql(`
            SELECT sso_user_account.*
            FROM sso_user_account, sso_provider
            WHERE sso_user_account.user_id_from_provider = '${user_id_from_provider}'
            AND sso_provider.provider = '${provider}'
            AND sso_provider.provider_id = sso_user_account.provider_id;
        `);

        return ssoAccountRecords.rowCount > 0 ? ssoAccountRecords.rows[0] : null;
    };

    /**
     * Create a user record. The preferences uses a mock constant for now.
     *
     * @param {Object} preferences - The user preferences.
     * @return {Object} the newly created record.
     */
    async createUser(preferences) {
        const userRecord = await this.runSql(`
            INSERT INTO user_account ("preferences", "created_timestamp")
            VALUES ('${JSON.stringify(preferences)}', current_timestamp)
            RETURNING *;
        `);
        return userRecord.rows[0];
    };

    /**
     * Create a sso_user_account record associated with the given user record, or update an exising sso_user_account.
     * Return an object containing the new record.
     *
     * @param {Number} userAccountId - The corresponding user_account.user_account_id to associate with this new account.
     * @param {Object} userInfo - The user information provided by the SSO provider.
     * @param {String} provider - The SSO provider.
     * @return {Object} An object consisting of the sso user account record.
     */
    async createSsoUserAccount(userAccountId, userInfo, provider) {
        const ssoAccountRecord = await this.runSql(`
            INSERT INTO sso_user_account (user_id_from_provider, provider_id, user_account_id, user_info, created_timestamp)
            SELECT '${userInfo.id}', provider_id, '${userAccountId}', '${JSON.stringify(userInfo)}', current_timestamp
            FROM sso_provider
            WHERE provider = '${provider}'
            RETURNING *;
        `);

        return ssoAccountRecord.rows[0];
    };

    /**
     * Update a sso_user_account record. Return an object containing the updated record.
     *
     * @param {Number} ssoUserAccountId - The sso_user_account.sso_user_account_id.
     * @param {Object} userInfo - The user information provided by the SSO provider.
     * @return {Object} An object consisting of the sso user account record.
     */
    async updateSsoUserAccount(ssoUserAccountId, userInfo) {
        const ssoAccountRecord = await this.runSql(`
            UPDATE sso_user_account
            SET user_info = '${JSON.stringify(userInfo)}', last_updated_timestamp = current_timestamp
            WHERE sso_user_account_id = ${ssoUserAccountId}
            RETURNING *;
        `);

        return ssoAccountRecord.rows[0];
    };

    /**
     * Create a new access_token record. Return an object containing the new record.
     *
     * @param {Number} ssoUserAccountId - The sso user account id that the access token record is created for.
     * @param {Object} accessTokenInfo - Access token information object provided by the SSO provider.
     * @return {Object} An object consisting of the access token record for the given sso user account.
     */
    async createAccessToken(ssoUserAccountId, accessTokenInfo) {
        const expiryTimestamp = utils.calculateExpiredInTimestamp(accessTokenInfo.expires_in);

        const accessTokenRecord = await this.runSql(`
            INSERT INTO access_token (sso_user_account_id, access_token, expires_at, refresh_token, created_timestamp)
            VALUES (${ssoUserAccountId}, '${accessTokenInfo.access_token}', '${expiryTimestamp.toISOString()}', '${accessTokenInfo.refresh_token}', current_timestamp)
            RETURNING *;
        `);

        return accessTokenRecord.rows[0];
    };

    /**
     * Update a access_token record. Return an object containing the updated record.
     *
     * @param {Number} ssoUserAccountId - The sso user account id that the access token record is created for.
     * @param {Object} accessTokenInfo - Access token information object provided by the SSO provider.
     * @return {Object} An object consisting of the access token record for the given sso user account.
     */
    async updateAccessToken(ssoUserAccountId, accessTokenInfo) {
        const expiryTimestamp = utils.calculateExpiredInTimestamp(accessTokenInfo.expires_in);

        const accessTokenRecord = await this.runSql(`
            Update access_token
            SET access_token = '${accessTokenInfo.access_token}',
                expires_at = '${expiryTimestamp.toISOString()}',
                refresh_token = '${accessTokenInfo.refresh_token}',
                last_updated_timestamp = current_timestamp
            WHERE sso_user_account_id = ${ssoUserAccountId}
            RETURNING *;
        `);

        return accessTokenRecord.rows[0];
    };
};

module.exports = new DataBaseRequest(config.db);
