/*
 * Copyright 2021-2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 */

"use strict";

require("json5/lib/register");
const crypto = require("crypto");

/**
 * Create a unpredicatable random string of the given length.  This can be used
 * to create nonce and other such tokens.  The tokens generated are URL safe
 * based on RFC 4648 (https://www.rfc-editor.org/rfc/rfc4648.html#section-5).
 *
 * This code was based off https://blog.abelotech.com/posts/generate-random-values-nodejs-javascript/#random-values-in-base64-format
 * Moreover, according to [this thread](https://github.com/keepassxreboot/keepassxc/issues/3255),
 * The random token generated would occasionally include a string of trailing equal signs and Google's
 * OAuth2 server would complain. The suggestion is to remove trailing equal signs.
 *
 * @param {Integer} length - The length of the state string.
 * @return {String} a random set of characters.
 */
const generateRandomToken = function (length) {
    return crypto.randomBytes(length)
        .toString("base64")
        .replace(/\+/g, "-")        // make it url safe: plus becomes minus,
        .replace(/\//g, "_")        // slash becomes underscore,
        .replace(/=*$/, "")         // and trailing equals are removed
        .substring(0, length - 1);  // ensure `length`
};

/**
 * Convert a expires_in value in seconds to a postgres compatible timestamp.
 *
 * @param {Integer} seconds - The remaining lifetime in seconds.
 * @return {String} a timestamp in a format of "2022-03-14 19:54:25.618119+00".
 */
const calculateExpiredInTimestamp = function (seconds) {
    return new Date(Date.now() + (seconds * 1000));
};

/**
 * Load config from a config file. Individual config values can be overridden by the corresponding
 * environment variable.
 *
 * @param {String} configFile - The location of a config file
 * @return {Object} A config object in the structure of config.json5 in the root directory.
 */
const loadConfig = function (configFile) {
    const config = require(configFile);

    return {
        server: {
            port: process.env.SERVERPORT || config.server.port
        },
        db: {
            dbContainerName: config.db.dbContainerName,
            dbDockerImage: config.db.dbDockerImage,
            database: process.env.DATABASE || config.db.database,
            port: process.env.DBPORT || config.db.port,
            host: process.env.DBHOST || config.db.host,
            user: process.env.DBUSER || config.db.user,
            password: process.env.DBPASSWORD || config.db.password
        }
    };
};

module.exports = {
    generateRandomToken,
    calculateExpiredInTimestamp,
    loadConfig
};
