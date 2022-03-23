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
const ssoDbOps = require("../ssoDbOps.js");
const googleSso = require("./ssoProviders/googleSso.js");
const utils = require("../../shared/utils.js");
const config = utils.loadConfig(path.join(__dirname, "../../../config.json5"));

const router = express.Router();

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
    const refererUrl = new URL(req.headers.referer);
    const refererOrigin = refererUrl.origin;
    const sessionToken = utils.generateRandomToken(12);

    // Keep track of the mapping between the session token and the referer origin in the table "referer_tracker"
    if (refererOrigin && refererOrigin !== config.server.selfDomain) {
        await ssoDbOps.trackRefererOrigin(sessionToken, refererOrigin, refererUrl);
    }

    // Redirects to Google's `/authorize` endpoint
    googleSso.authorize(req, res, ssoDbOps, googleSso.options, sessionToken)
        .then(null, (error) => {
            console.log(error);
            res.status(403).json({"isError": true, "message": error.message});
        });
});

/**
 * Handle the OAuth2 redirect callback from Google.
 */
router.get("/google/login/callback", async function (req, res) {
    if (req.query.state !== req.session.secret) {
        const msg = "Mismatched anti-forgery parameter";
        console.log(`${msg}: expected: '%s', actual: '%s'`, req.session.secret, req.query.state);
        res.status(403).json({"isError": true, "message": msg});
        return;
    }

    // Anti-forgery check passed -- handle the callback from Google.
    googleSso.handleCallback(req, ssoDbOps, googleSso.options).then(async (accessTokenRecord) => {
        // Finished SSO, forget state secret (needed?)
        req.query.state = "shhhh";

        // Find the referer origin where the SSO sign on request is from
        const refererRecord = await ssoDbOps.getRefererBySessionToken(req.session.secret);
        if (refererRecord) {
            // This is a sign on process instantiated by an external website.
            // Generate a login token then redirect back to the external website with the login token
            // as a cookie value in the http header.
            // 1. Clean up the tracked referer origin record that is no longer needed
            await ssoDbOps.deleteRefererOriginBySessionToken(req.session.secret);

            // 2. Generate a login token and its expiry timestamp
            const loginToken = utils.generateRandomToken(128);
            const expiryTimestamp = utils.calculateExpiredInTimestamp(config.server.loginTokenExpiresIn);

            // 3. Save the login token into the table
            const loginTokenRecord = await ssoDbOps.getLoginToken(accessTokenRecord.sso_user_account_id, refererRecord.referer_origin);
            if (loginTokenRecord) {
                await ssoDbOps.updateLoginToken(accessTokenRecord.sso_user_account_id, refererRecord.referer_origin, loginToken, expiryTimestamp);
            } else {
                await ssoDbOps.createLoginToken(accessTokenRecord.sso_user_account_id, refererRecord.referer_origin, loginToken, expiryTimestamp);
            }

            // 4. Re-direct back to the referer origin with a session expires in a timeframe defined by
            // googleSso.options.loginTokenExpiresIn
            res.cookie("loginToken", loginToken, { maxAge: config.server.loginTokenExpiresIn * 1000 });
            res.redirect(302, refererRecord.referer_url);
        } else {
            // This is a sign on process instantiated on the Personal Data Server website.
            // Return the access token from Google.
            res.json({"accessToken": JSON.stringify(accessTokenRecord.access_token, null, 2)});
        }
    }).catch((error) => {
        res.status(403).json({"isError": true, "message": error.message});
    });
});

module.exports = router;
