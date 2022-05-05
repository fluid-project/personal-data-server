/*
 * Copyright 2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/personal-data-server/blob/main/LICENSE
 */

"use strict";

const express = require("express");
const router = express.Router();
const dbOps = require("../dbOps.js");

/**
 * Get preferences API
 * Format: GET /get_prefs?loginToken=xxx
 * 1. Verify if the loginToken is valid and not expired;
 * 2. If it is, return the preferences;
 * 3. If it isn't, return error.
 */
router.get("/get_prefs", async function (req, res) {
    const loginToken = getLoginToken(req.headers.authorization);

    if (!loginToken) {
        res.status(403).json({"isError": true, "message": "Please login first."});
        return;
    }

    const preferences = await dbOps.getPreferences(loginToken);

    if (!preferences) {
        res.status(403).json({"isError": true, "message": "Invalid login token. Please login."});
        return;
    } else {
        res.json(preferences);
    }
});

/**
 * Save preferences API
 * Format: POST /save_prefs
 * Post data: {
 *     loginToken: {String},
 *     preferences: {Object}
 * }
 * 1. Verify if the loginToken is valid and not expired;
 * 2. Verify if the preferences object contains the right values;
 * 3. If any verification failes, return error;
 * 4. Otherwise, save preferences.
 */
router.post("/save_prefs", async function (req, res) {
    const loginToken = getLoginToken(req.headers.authorization);

    if (!loginToken) {
        res.status(403).json({"isError": true, "message": "Please login first."});
        return;
    }

    // Verify if the login token is valid
    const prevPrefs = await dbOps.getPreferences(loginToken);

    if (!prevPrefs) {
        res.status(403).json({"isError": true, "message": "Invalid login token. Please login."});
        return;
    }

    const isSuccess = await dbOps.savePrefsByLoginToken(loginToken, req.body);

    if (isSuccess) {
        res.send("Saved successfully.");
    } else {
        res.status(403).json({"isError": true, "message": "Cannot save the incoming preferences."});
        return;
    }
});

/**
 * Parse the login token. The login token must be sent in as a Bearer token in the "Authorization" header.
 * The format is - Authorization: Bearer {login-token}
 *
 * @param {String} authHeader - The "Authorization" value in the request header.
 * @return {String} The login token.
 */
const getLoginToken = function (authHeader) {
    authHeader = authHeader || "";
    const matches = authHeader.match(/Bearer (.*)/);
    return matches && matches.length === 2 ? matches[1] : null;
};

module.exports = router;
