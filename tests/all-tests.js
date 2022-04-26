/*
 * Copyright 2020-2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 */

"use strict";

const testIncludes = [
    // Test DB operations
    "./postgresOpsTests.js",
    "./postgresRequestTests.js",
    "./tableModelDefTests.js",

    // Test endpoints provided by personal data server
    "./healthReadyTests.js",

    // Test Google single sign on
    "./googleSsoTests.js",

    // Test preferences API
    "./prefsApiTests.js"
];

testIncludes.forEach(function (path) {
    require(path);
});
