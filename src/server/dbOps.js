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
const config = utils.loadConfig(path.join(__dirname, "../../config.json5"));

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
     * Save the mapping between the state token and the referer origin in the table for future look up
     * of the referer origin.
     *
     * @param {String} state - The state token.
     * @param {String} refererOrigin - The referer origin. An example is: https://idrc.ocadu.ca
     * @param {String} refererUrl - The referer URL. An example is: https://idrc.ocadu.ca/about/
     * @return {Object|null} the newly created record.
     */
    async trackstate(state, refererOrigin, refererUrl) {
        let newRecord;
        if (refererOrigin) {
            newRecord = await this.runSql(`
                INSERT INTO referer_tracker ("state", "referer_origin", "referer_url", "created_timestamp")
                VALUES ('${state}', '${refererOrigin}', '${refererUrl}', current_timestamp)
                RETURNING *;
            `);
        } else {
            newRecord = await this.runSql(`
                INSERT INTO referer_tracker ("state","created_timestamp")
                VALUES ('${state}', current_timestamp)
                RETURNING *;
            `);
        }

        return newRecord.rows[0];
    };

    /**
     * User account record
     * @typedef {Object} refererTrackerRecord
     * @property {Number} state The anti-forgery state token.
     * @property {String} referer_origin The referer origin.
     * @property {String} referer_url The referer URL.
     * @property {Date} created_timestamp The timestamp when the record is created.
     */

    /**
     * Get the referer tracker record of the given state token.
     *
     * @param {String} state - The state token.
     * @return {refererTrackerRecord} return the referer tracker record linked with the given state token.
     *         Return null if the record
     * is not found.
     */
    async getRefererTracker(state) {
        const refererTrackerRecord = await this.runSql(`
            SELECT * FROM referer_tracker WHERE state = '${state}';
        `);

        return refererTrackerRecord.rowCount > 0 ? refererTrackerRecord.rows[0] : null;
    };

    /**
     * Save the mapping between the state token and the referer origin in the table for future look up
     * of the referer origin.
     *
     * @param {String} state - The state token.
     * @return {Boolean} return true if the record is deleted. Otherwise, return false.
     */
    async deleteRefererTracker(state) {
        const refererOriginRecord = await this.runSql(`
            DELETE FROM referer_tracker WHERE state = '${state}' RETURNING *;
        `);

        return refererOriginRecord.rowCount > 0;
    };

    /**
     * User account record
     * @typedef {Object} userAccountRecord
     * @property {Number} user_account_id The user account id.
     * @property {Object} preferences The user preferences.
     * @property {Date} created_timestamp The timestamp when the record is created.
     * @property {Date} last_updated_timestamp The timestamp when the record is last updated.
     */

    /**
     * Create a user record. The preferences uses a mock constant for now.
     *
     * @param {Object} preferences - The user preferences.
     * @return {userAccountRecord} the newly created user account record.
     */
    async createUser(preferences) {
        const newRecord = await this.runSql(`
            INSERT INTO user_account ("preferences", "created_timestamp")
            VALUES ('${JSON.stringify(preferences)}', current_timestamp)
            RETURNING *;
        `);

        return newRecord.rows[0];
    };

    /**
     * User information
     * @typedef {Object} userInfo
     * @property {String} id The user id from the SSO provider.
     * @property {String} email The email.
     * @property {Boolean} verified_email Whether the email is verified.
     * @property {String} name The user name.
     * @property {String} given_name User's given name.
     * @property {String} family_name User's family name.
     * @property {String} picture The URL to the user's profile picture.
     * @property {String} locale The locale.
     */

    /**
     * SSO user account record
     * @typedef {Object} ssoUserAccountRecord
     * @property {Number} sso_user_account_id The SSO user account id.
     * @property {String} user_id_from_provider The user id from the SSO provider.
     * @property {Number} provider_id The provider id.
     * @property {Number} user_account_id The user account id.
     * @property {userInfo} userInfo - The user information provided by the SSO provider.
     * @property {Date} created_timestamp The timestamp when the record is created.
     * @property {Date} last_updated_timestamp The timestamp when the record is last updated.
     */

    /**
     * Create a sso_user_account record associated with the given user record, or update an exising sso_user_account.
     * Return an object containing the new record.
     *
     * @param {Number} userAccountId - The corresponding user_account.user_account_id to associate with this new account.
     * @param {userInfo} userInfo - The user information provided by the SSO provider.
     * @param {String} provider - The SSO provider.
     * @return {ssoUserAccountRecord} An object consisting of the sso user account record.
     */
    async createSsoUserAccount(userAccountId, userInfo, provider) {
        const newRecord = await this.runSql(`
            INSERT INTO sso_user_account (user_id_from_provider, provider_id, user_account_id, user_info, created_timestamp)
            SELECT '${userInfo.id}', provider_id, '${userAccountId}', '${JSON.stringify(userInfo)}', current_timestamp
            FROM sso_provider
            WHERE provider = '${provider}'
            RETURNING *;
        `);

        return newRecord.rows[0];
    };

    /**
     * Update a sso_user_account record. Return an object containing the updated record.
     *
     * @param {Number} ssoUserAccountId - The sso_user_account.sso_user_account_id.
     * @param {userInfo} userInfo - The user information provided by the SSO provider.
     * @return {ssoUserAccountRecord} An object consisting of the sso user account record.
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
     * Access token record
     * @typedef {Object} accessTokenInfo
     * @property {String} access_token The access token from the SSO provider.
     * @property {String} refresh_token The refresh token from the SSO provider.
     * @property {Date} expires_in The remaining lifetime in seconds.
     */

    /**
     * Access token record
     * @typedef {Object} accessTokenRecord
     * @property {Number} sso_user_account_id The SSO user account id.
     * @property {String} access_token The access token from the SSO provider.
     * @property {Date} expires_at The timestamp at which this `access_token` expires.
     * @property {String} refresh_token The refresh token from the SSO provider.
     * @property {Date} created_timestamp The timestamp when the record is created.
     * @property {Date} last_updated_timestamp The timestamp when the record is last updated.
     */

    /**
     * Create a new access_token record. Return an object containing the new record.
     *
     * @param {Number} ssoUserAccountId - The sso user account id that the access token record is created for.
     * @param {accessTokenInfo} accessTokenInfo - Access token information object provided by the SSO provider.
     * @return {accessTokenRecord} An object consisting of the access token record for the given sso user account.
     */
    async createAccessToken(ssoUserAccountId, accessTokenInfo) {
        const expiryTimestamp = utils.calculateExpiredInTimestamp(accessTokenInfo.expires_in);

        const newRecord = await this.runSql(`
            INSERT INTO access_token (sso_user_account_id, access_token, expires_at, refresh_token, created_timestamp)
            VALUES (${ssoUserAccountId}, '${accessTokenInfo.access_token}', '${expiryTimestamp.toISOString()}', '${accessTokenInfo.refresh_token}', current_timestamp)
            RETURNING *;
        `);

        return newRecord.rows[0];
    };

    /**
     * Update a access_token record. Return an object containing the updated record.
     *
     * @param {Number} ssoUserAccountId - The sso user account id that the access token record is created for.
     * @param {accessTokenInfo} accessTokenInfo - Access token information object provided by the SSO provider.
     * @return {accessTokenRecord} An object consisting of the access token record for the given sso user account.
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

    /**
     * Login token record
     * @typedef {Object} loginTokenRecord
     * @property {Number} sso_user_account_id The SSO user account id.
     * @property {String} referer_origin The referer domain of an external website calling Personal Data Server API.
     * @property {String} login_token The login token returned to the external website for its future access to
     *                    Personal Data Server API.
     * @property {Date} expires_at The timestamp at which this `login_token` expires.
     * @property {Date} created_timestamp The timestamp when the record is created.
     * @property {Date} last_updated_timestamp The timestamp when the record is last updated.
     */

    /**
     * Get a login_token record of a SSO user account for a referer origin.
     *
     * @param {Number} ssoUserAccountId - The sso user account id that the login token record is created for.
     * @param {String} refererOrigin - The referer origin where the SSO user sends the request from.
     * @return {loginTokenRecord} An object consisting of the login token record.
     */
    async getLoginToken(ssoUserAccountId, refererOrigin) {
        const loginTokenRecord = await this.runSql(`
            SELECT * FROM login_token
            WHERE sso_user_account_id = ${ssoUserAccountId}
            AND referer_origin = '${refererOrigin}'
        `);

        return loginTokenRecord.rows[0];
    };

    /**
     * Create a login_token record. Return an object containing the saved record.
     *
     * @param {Number} ssoUserAccountId - The sso user account id that the login token record is created for.
     * @param {String} refererOrigin - The referer origin where the SSO user sends the request from.
     * @param {String} loginToken - The login token.
     * @param {Date} expiresAt - The timestamp that the login token expires at.
     * @return {loginTokenRecord} An object consisting of the login token record.
     */
    async createLoginToken(ssoUserAccountId, refererOrigin, loginToken, expiresAt) {
        const newRecord = await this.runSql(`
            INSERT INTO login_token ("sso_user_account_id", "referer_origin", "login_token", "expires_at", "created_timestamp")
            VALUES (${ssoUserAccountId}, '${refererOrigin}', '${loginToken}', '${expiresAt.toISOString()}', current_timestamp)
            RETURNING *;
        `);

        return newRecord.rows[0];
    };

    /**
     * Update a login_token record. Return an object containing the updated record.
     *
     * @param {Number} ssoUserAccountId - The sso user account id that the login token record is created for.
     * @param {String} refererOrigin - The referer origin where the SSO user sends the request from.
     * @param {String} loginToken - The login token.
     * @param {Date} expiresAt - The timestamp that the login token expires at.
     * @return {loginTokenRecord} An object consisting of the login token record.
     */
    async updateLoginToken(ssoUserAccountId, refererOrigin, loginToken, expiresAt) {
        const loginTokenRecord = await this.runSql(`
            UPDATE login_token
            SET login_token = '${loginToken}',
                expires_at = '${expiresAt.toISOString()}',
                last_updated_timestamp = current_timestamp
            WHERE sso_user_account_id = ${ssoUserAccountId}
            AND referer_origin = '${refererOrigin}'
            RETURNING *;
        `);

        return loginTokenRecord.rows[0];
    };

    /**
     * Get preferences by the login token.
     *
     * @param {String} loginToken - The login token.
     * @return {Object} The preferences that the login token is associated with.
     */
    async getPreferences(loginToken) {
        const prefsRecord = await this.runSql(`
            SELECT user_account.preferences
            FROM user_account, sso_user_account, login_token
            WHERE login_token.login_token = '${loginToken}'
            AND login_token.expires_at is not NULL
            AND login_token.expires_at > NOW()
            AND login_token.sso_user_account_id = sso_user_account.sso_user_account_id
            AND sso_user_account.user_account_id = user_account.user_account_id;
        `);

        return prefsRecord.rows[0] ? prefsRecord.rows[0].preferences : undefined;
    };

    /**
     * Save preferences based on the given login token.
     *
     * @param {String} loginToken - The login token.
     * @param {Object} preferences - The preferences to save.
     * @return {Boolean} Return true if the update is successful. Otherwise, return false.
     */
    async savePrefsByLoginToken(loginToken, preferences) {
        const prefsRecord = await this.runSql(`
            UPDATE user_account
            SET preferences = '${JSON.stringify(preferences)}'
            FROM sso_user_account, login_token
            WHERE login_token.login_token = '${loginToken}'
            AND login_token.sso_user_account_id = sso_user_account.sso_user_account_id
            AND sso_user_account.user_account_id = user_account.user_account_id;
        `);

        return prefsRecord.rowCount > 0;
    };
};

module.exports = new DataBaseRequest(config.db);
