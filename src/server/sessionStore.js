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

const expressSession = require("express-session");
const ssoDbOps = require("./ssoDbOps.js");
const PgSession = require("connect-pg-simple")(expressSession);

module.exports = new PgSession({
    pool: ssoDbOps
});
