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

const express = require("express");
const router = express.Router();
const dbOps = require("../dbOps.js");

/**
 * Home page.
 */
router.get("/", function (req, res) {
    res.render("index", { title: "Personal Data Server" });
});

/**
 * "/health" end point -- if the server is running at all, it will respond that
 * it is healthy.  This does not necessarily mean the database is ready -- see
 * below.
 */
router.get("/health", function (req, res) {
    res.json({ isHealthy: true });
});

/**
 * "/ready" end point -- if server is healthy and the database is ready.
 */
router.get("/ready", function (req, res) {
    dbOps.isReady().then(
        (ready) => { res.json({ isReady: ready }); },
        () => {
            res.status(503);
            res.json({ isError: true, message: "Database is not ready"});
        }
    );
});

module.exports = router;
