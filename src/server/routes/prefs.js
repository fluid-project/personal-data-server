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
    if (!req.query.loginToken) {
        res.status(403).json({"isError": true, "message": "Please login first."});
        return;
    }

    const preferences = await dbOps.getPreferences(req.query.loginToken);

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
    if (!req.body.loginToken) {
        res.status(403).json({"isError": true, "message": "Please login first."});
        return;
    }

    if (!req.body.preferences) {
        res.status(403).json({"isError": true, "message": "Preferences is undefined."});
        return;
    }

    // Verify the login token
    const preferences = await dbOps.getPreferences(req.body.loginToken);

    if (!preferences) {
        res.status(403).json({"isError": true, "message": "Invalid login token. Please login."});
        return;
    }

    // TODO: how to verify the preferences object.

    const isSuccess = await dbOps.savePrefsByLoginToken(req.body.loginToken, req.body.preferences);

    if (isSuccess) {
        res.send("Saved successfully.");
    } else {
        res.status(403).json({"isError": true, "message": "Cannot save the incoming preferences."});
        return;
    });
});

module.exports = router;
