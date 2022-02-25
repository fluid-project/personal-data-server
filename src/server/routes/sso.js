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
const ssoDbOps = require("../ssoDbOps.js");
const googleSso = require("./ssoProviders/googleSso.js");

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
router.get("/google", function (req, res) {
    // Redirects to Google's `/authorize` endpoint
    googleSso.authorize(req, res, ssoDbOps, googleSso.options)
        .then(null, (error) => {
            console.log(error);
            res.status(403).json({"isError": true, "message": error.message});
        });
});

/**
 * Handle the OAuth2 redirect callback from Google.
 */
router.get("/google/login/callback", function (req, res) {
    if (req.query.state !== req.session.secret) {
        const msg = "Mismatched anti-forgery parameter";
        console.log(`${msg}: expected: '%s', actual: '%s'`, req.session.secret, req.query.state);
        res.status(403).json({"isError": true, "message": msg});
        return;
    }
    // Anti-forgery check passed -- handle the callback from Google.
    googleSso.handleCallback(req, ssoDbOps, googleSso.options).then((loginToken) => {
        // Finished SSO, forget state secret (needed?)
        req.query.state = "shhhh";
        req.session.staticToken = loginToken;

        // TODO: The response here is just for debugging/testing. Replace
        // with a simple 200 status code, with no payload (?)
        res.json({"loginToken": JSON.stringify(req.session.staticToken, null, 2)});
    }).catch((error) => {
        res.status(403).json({"isError": true, "message": error.message});
    });
});

module.exports = router;
