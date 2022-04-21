-- Copyright 2021-2022 Inclusive Design Research Centre, OCAD University
-- All rights reserved.
--
-- Table definitions to support single sign on (SSO) data models.
--
-- Licensed under the New BSD license. You may not use this file except in
-- compliance with this License.
--
-- You may obtain a copy of the License at
-- https://github.com/fluid-project/personal-data-server/blob/main/LICENSE

-- SSO Provider
CREATE TABLE sso_provider (
    provider_id SERIAL NOT NULL PRIMARY KEY,
    provider varchar(30) NOT NULL,
    name varchar(40) NOT NULL,
    client_id varchar(191) NOT NULL,
    client_secret varchar(191) NOT NULL,
    created_timestamp TIMESTAMPTZ NULL,
    last_updated_timestamp TIMESTAMPTZ NULL
);

-- user_account
CREATE TABLE user_account (
    user_account_id SERIAL PRIMARY KEY NOT NULL,
    preferences JSONB NULL,
    created_timestamp TIMESTAMPTZ NOT NULL,
    last_updated_timestamp TIMESTAMPTZ NULL
);

-- SSO Accounts
CREATE TABLE sso_user_account (
    sso_user_account_id SERIAL PRIMARY KEY NOT NULL,
    user_id_from_provider varchar(64) NOT NULL,
    provider_id INTEGER NOT NULL REFERENCES sso_provider (provider_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    user_account_id INTEGER NOT NULL REFERENCES user_account (user_account_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    user_info JSONB NOT NULL,
    created_timestamp TIMESTAMPTZ NOT NULL,
    last_updated_timestamp TIMESTAMPTZ NULL
);

-- Access Tokens responded from SSO Providers for SSO user accounts
CREATE TABLE access_token (
    sso_user_account_id INTEGER PRIMARY KEY NOT NULL REFERENCES sso_user_account (sso_user_account_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    access_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NULL,
    refresh_token TEXT DEFAULT NULL,
    created_timestamp TIMESTAMPTZ NOT NULL,
    last_updated_timestamp TIMESTAMPTZ NULL
);
