/*
 * Copyright 2021-2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Defines constants and functions to handle the SSO workflow using Google as
 * the provider.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/personal-data-server/blob/main/LICENSE
 */

"use strict";

const axios = require("axios");
const generateNonce = require("../../../shared/utils.js").generateRandomToken;

const REDIRECT_URI = "http://localhost:3000/sso/google/login/callback";

const options = {
    // Google authorization endpoint to start their authorization workflow.
    authorizeUri: "https://accounts.google.com/o/oauth2/auth",

    // Google "get access token" and "refresh access token" endpoints.
    accessTokenUri: "https://accounts.google.com/o/oauth2/token",
    accessType: "offline",

    // Google get user info endpoints.
    userInfoUri: "https://www.googleapis.com/oauth2/v2/userinfo",

    // Google "use access token endpoint"
    credentialsUri: "https://oauth2.googleapis.com/token",

    // URI that Google uses to call back to the Personal Data Server for
    // logging in.
    redirectUri: REDIRECT_URI,
    encodedRedirectUri: encodeURIComponent(REDIRECT_URI),

    // Identifier for retrieving the client information (e.g. id and secret)
    // for the Personal Data Server database.
    provider: "google"
};

class GoogleSso {

    get REDIRECT_URI() { return REDIRECT_URI; };
    get options() { return options; };

    /**
     * Execute the first step in the SSO workflow, making an authorize request
     * to Google.  This throws if there is an error retrieving the client
     * information from the database.
     *
     * @param {Object} req - The express request that triggered the workflow
     * @param {Object} req.session.secret - Anti-forgery token used in the SSO workflow
     * @param {Object} res - The express response used to redirect to Google
     * @param {Object} ssoDbOps - Used to retrieve this client's id and secret
     * @param {Object} options - Other options specific to Google SSO
     * @param {String} options.authorizeUri - Google's authorization endpoint
     * @param {String} options.encodedRedirectUri - The endpoint that Google will call
     * @param {String} options.accessType - The type of access to Google needed for SSO
     *
     */
    async authorize(req, res, ssoDbOps, options) {
        const clientInfo = await ssoDbOps.getSsoClientInfo(this.options.provider);
        req.session.secret = generateNonce(12);
        const authRequest = `${options.authorizeUri}?client_id=${clientInfo.client_id}&redirect_uri=${options.encodedRedirectUri}&scope=openid+profile+email&response_type=code&state=${req.session.secret}&access_type=${options.accessType}`;
        console.debug("Google /authorize request: ", authRequest);
        res.redirect(authRequest);
    };

    /**
     * Handle the redirect callback from Google:
     * - request an access token,
     * - request the user's profile
     * - create/update database with respect to the User, AccessToken, and
     *   SsoAccount records.
     * This throws if an error occurs at any step.
     *
     * @param {Object} req - The express request that triggered the workflow
     * @param {Object} req.query.code - Token from Google to use to request access token
     * @param {Object} ssoDbOps - Used to update User, AccessToken, and SsoAccount
     *                             records
     * @param {Object} options - Other options specific to Google SSO
     * @return {String} - The login token generated for static workflow clients.
     */
    async handleCallback(req, ssoDbOps, options) {
        try {
            if (req.query.error) {
                throw new Error("The user does not approve the request. Error: " + req.query.error);
            }
            if (!req.query.code) {
                throw new Error("Request missing authorization code");
            }

            const accessTokenResponse = await this.fetchAccessToken(req.query.code, ssoDbOps, options);
            if (accessTokenResponse.status !== 200) {
                return accessTokenResponse;
            }
            const accessToken = await accessTokenResponse.data;
            const userInfoResponse = await this.fetchUserInfo(accessToken, options);
            if (userInfoResponse.status !== 200) {
                return userInfoResponse;
            }
            const userInfo = userInfoResponse.data;
            const accountInfo = await this.storeUserAndAccessToken(userInfo, accessToken, ssoDbOps, options);
            return accountInfo.accessToken.loginToken;
        } catch (e) {
            throw e;
        }
    };

    /**
     * Request an access token from Google SSO.
     *
     * @param {String} code - The code provided by Gogole to exchange for the
     *                        access token
     * @param {Object} ssoDbOps - Database access for retrieving client id and
     *                             secret.
     * @param {Object} options - Other options specific to Google SSO.
     * @param {Object} options.provider - Identifier to use to find this client's
     *                                    id and secret in the database.
     * @param {Object} options.accessTokenUri - URI to Google's access token
     *                                          endpoint.
     * @return {Object} The response from Google's `/token` endpoint, either a
     (                  success with an access token (status 200), or an error
     *                  response.
     */
    async fetchAccessToken(code, ssoDbOps, options) {
        try {
            const clientInfo = await ssoDbOps.getSsoClientInfo(options.provider);
            const response = await axios({
                method: "post",
                url: options.accessTokenUri,
                data: {
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: options.redirectUri,
                    client_id: clientInfo.client_id,
                    client_secret: clientInfo.client_secret
                },
                "Content-type": "application/json"
            });
            console.debug("Status: %s: access token for %s", response.status, options.provider);
            return response;
        } catch (e) {
            return e.response;
        }
    };

    /**
     * Request the SSO users's email and profile from Google.
     * @param {Object} accessToken - The access token provided by Google.
     * @param {Object} accessToken.scope - Email and profile scope.
     * @param {Object} options - Other options specific to Google SSO.
     * @param {Object} options.userInfoUri - URI to Google's user profile
     *                 endpoint.
     * @return {Object} The response from Google's `/userInfo` endpoint, either
     *                  a successful response containing the user's profile
     *                  (status 200) or an error response.
     */
    async fetchUserInfo(accessToken, options) {
        const fullUri = `${options.userInfoUri}?` + new URLSearchParams({
            access_token: accessToken.access_token,
            alt: "json"
        });
        try {
            const response = await axios.get(fullUri);
            console.debug("Status: %s: user profile for %s", response.status, options.provider);
            return response;
        } catch (e) {
            return e.response;
        }
    };

    /**
     * Create and persist user, access token, and SSO account records based
     * on the given information.
     *
     * @param {Object} userInfo - The information to use to create the user record.
     * @param {Object} accessToken - The access token provided by the provider for
     *                               the user's access.
     * @param {Object} ssoDbOps - Database access for storing the user, access
     *                             token, and related records.
     * @param {Object} options - Other options specific to Google SSO.
     * @param {Object} options.provider - Google provider id.
     * @return {Object} Object that has the User, SsoAccount, AppSsoProvider,
     *                  and AccessToken records.
     */
    async storeUserAndAccessToken(userInfo, accessToken, ssoDbOps, options) {
        // Use Google's identifier as the userId field for the User record.
        const userRecord = await ssoDbOps.addUser(
            userInfo, {name: "userId", value: userInfo.id}
        );
        let accountInfo = await ssoDbOps.addSsoAccount(userRecord, userInfo, options.provider);
        console.log(`Adding/Updating access token for ${userInfo.id} to database`);
        accountInfo = await ssoDbOps.refreshAccessToken(accountInfo, accessToken);
        return accountInfo;
    };
};

module.exports = new GoogleSso();
