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
const expressSession = require("express-session");
const logger = require("morgan");
const path = require("path");

const utils = require("../shared/utils.js");
const config = utils.loadConfig(path.join(__dirname, "../../config.json5"));
const indexRouter = require("./routes/index.js");
const ssoRouter = require("./routes/sso.js");
const prefsRouter = require("./routes/prefs.js");
const sessionStore = require("./sessionStore.js");

const app = express();
app.use(logger("dev"));

// Parse incoming requests with JSON payloads
app.use(express.json({
    // Control the maximum size of the preferences object
    limit: config.server.allowedPrefsSize
}));

// Express session
app.use(expressSession({
    store: sessionStore,
    secret: "shhhh",
    resave: false
}));

// Endpoints
app.use("/", indexRouter);
app.use("/", prefsRouter);
app.use("/sso", ssoRouter);

// General endpoint for 404s
app.use(function (req, res, next) {
    res.status(404).send("Sorry, can't find it");
    next();
});

module.exports = app;
