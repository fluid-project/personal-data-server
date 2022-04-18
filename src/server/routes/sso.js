/*
 * Copyright 2021-2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Handles endpoints:
 * /sso/
 * /sso/google - trigger SSO for Google OAuth2 provider
 * /sso/google/login/callback - handle OAuth2 callback from Google
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/personal-data-server/blob/main/LICENSE
 */

"use strict";

const express = require("express");
const path = require("path");
const dbOps = require("../dbOps.js");
const googleSso = require("./ssoProviders/googleSso.js");
const sessionStore = require("../sessionStore.js");
const utils = require("../../shared/utils.js");
const config = utils.loadConfig(path.join(__dirname, "../../../config.json5"));

const router = express.Router();

const lengthOfSsoSecret = 12;  // Define the length of SSO secret token

/**
 * Trigger the single sign on workflow where Google is the OAuth2 provider.
 */
router.get("/", function (req, res) {
    res.render("index", {
        title: "Personal Data Server",
        message: "This paragraph intentionally left blank."
    });
});


/**
 * Trigger the single sign on workflow where Google is the OAuth2 provider.
 */
router.get("/google", async function (req, res) {
    let refererOrigin, refererUrl;
    const ssoSecret = utils.generateRandomToken(lengthOfSsoSecret);

    // Problem: After setting`req.session.secret` in the line below, express-session is expected to set these
    // values in the response header: sessionID, session.secret and connect.sid in the headers.cookie.
    // The first 2 values are read only. If the same connect.sid cookie value is sent back in following requests,
    // express-session will use it to look up the corresponding secret value stored in the session store.
    // In the normal browser/server interaction with Google Authentication API, these values are set properly.
    // However, in automated tests that use simulation requests, connect.sid cookie value is not generated and set.
    // Solution: the solution is inpired by https://github.com/expressjs/session/issues/689#issuecomment-551138078:
    // instead of relying on the connect.sid cookie value to look up the session value on the server,
    // `secret + sessionID` string is send in the `state` query parameter. When the same `state` value is sent back
    // in the callback request, use the embedded `sessionID` and sessionStore.get() API to look up the corresponding
    // session value from the session store.
    req.session.secret = ssoSecret;
    const ssoState = ssoSecret + req.sessionID;

    // Keep track of referer origin and url provided:
    // 1. it exists;
    // 2. not intialized by the Personal Data Server's own website.
    if (req.headers.referer) {
        refererUrl = new URL(req.headers.referer);
        refererOrigin = refererUrl.origin;

        // Keep track of the sso state and its corresponding referer origin/url provided the referer URL
        // is from an external website
        if (refererOrigin !== config.server.selfDomain) {
            await dbOps.trackSsoState(ssoState, refererOrigin, refererUrl);
        }
    }

    // Redirects to Google's `/authorize` endpoint
    googleSso.authorize(res, dbOps, googleSso.options, ssoState).then(null, (error) => {
        console.log(error);
        res.status(403).json({"isError": true, "message": error.message});
    });
});

/**
 * Handle the OAuth2 redirect callback from Google.
 */
router.get("/google/login/callback", async function (req, res) {
    if (req.query.error) {
        res.status(403).json({"isError": true, "message": "The user does not approve the request. Error: " + req.query.error});
        return;
    }
    if (!req.query.code) {
        res.status(403).json({"isError": true, "message": "Request missing authorization code"});
        return;
    }
    if (!req.query.state) {
        res.status(403).json({"isError": true, "message": "Request missing state"});
        return;
    }

    const ssoState = req.query.state;
    const ssoSecret = ssoState.substring(0, lengthOfSsoSecret);
    const sessionID = ssoState.substring(lengthOfSsoSecret);

    sessionStore.get(sessionID, async function (err, session) {
        if (err) {
            console.log("Error at fetching session information for the session ID: ", sessionID , " - ", err);
            res.status(403).json({"isError": true, "message": "Mismatched session"});
            return;
        }
        if (!session || session.secret !== ssoSecret) {
            const msg = "Mismatched anti-forgery parameter";
            if (!session) {
                console.log(`${msg}: matched session is not found`);
            } else {
                console.log(`${msg}: expected: '%s', actual: '%s'`, session.secret, ssoSecret);
            }
            res.status(403).json({"isError": true, "message": msg});
            return;
        }

        // Find if the sso state value was generated by our server
        const ssoStateRecord = await dbOps.getSsoState(ssoState);
        // Clean up the sso state record since it's for one time use
        await dbOps.deleteSsoState(ssoState);

        // Anti-forgery check passed -- handle the callback from Google.
        googleSso.handleCallback(req, dbOps, googleSso.options).then(async (accessTokenRecord) => {
            // Find the referer origin where the SSO sign on request is from
            if (ssoStateRecord) {
                // This is a sign on process instantiated by an external website.
                // Generate a login token then redirect back to the external website with the login token
                // as a cookie value in the http header.
                const loginToken = utils.generateRandomToken(128);
                const expiryTimestamp = utils.calculateExpiredInTimestamp(config.server.loginTokenExpiresIn);

                // Save the login token into the database
                let loginTokenRecord = await dbOps.getLoginToken(accessTokenRecord.sso_user_account_id, ssoStateRecord.referer_origin);
                if (loginTokenRecord) {
                    loginTokenRecord = await dbOps.updateLoginToken(accessTokenRecord.sso_user_account_id, ssoStateRecord.referer_origin, loginToken, expiryTimestamp);
                } else {
                    loginTokenRecord = await dbOps.createLoginToken(accessTokenRecord.sso_user_account_id, ssoStateRecord.referer_origin, loginToken, expiryTimestamp);
                }

                // Re-direct back to the referer origin with a cookie expiration defined in
                // googleSso.options.loginTokenExpiresIn
                res.cookie("loginToken", loginToken, { maxAge: config.server.loginTokenExpiresIn * 1000 });
                res.redirect(302, ssoStateRecord.referer_url);
            } else {
                // This is a sign on process instantiated on the Personal Data Server website.
                // Return the access token from Google.
                res.json({"accessToken": JSON.stringify(accessTokenRecord.access_token, null, 2)});
            }
        }).catch((error) => {
            res.status(403).json({"isError": true, "message": error.message});
        });
    });
});

module.exports = router;
