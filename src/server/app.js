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
const path = require("path");
const logger = require("morgan");

const indexRouter = require("./routes/index.js");
const ssoRouter = require("./routes/sso.js");
const sessionStore = require("./sessionStore.js");

const app = express();
app.use(logger("dev"));

// Views
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

// Express session

app.use(expressSession({
    store: sessionStore,
    secret: "shhhh",
    resave: false
}));

// Endpoints
app.use("/", indexRouter);
app.use("/sso", ssoRouter);

// General endpoint for 404s
app.use(function (req, res, next) {
    res.status(404).send("Sorry, can't find it");
    next();
});

module.exports = app;
