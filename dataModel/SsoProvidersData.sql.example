-- Copyright 2021-2022 Inclusive Design Research Centre, OCAD University
-- All rights reserved.
--
-- Test record for Google SSO provider client information.
--
-- Licensed under the New BSD license. You may not use this file except in
-- compliance with this License.
--
-- You may obtain a copy of the License at
-- https://github.com/fluid-project/personal-data-server/blob/main/LICENSE

-- Note that this is a dummy client id and secret for testing Google SSO

INSERT INTO sso_provider (provider, name, client_id, client_secret, created_timestamp) VALUES (
    'google',
    'Google',
    '554291169960-repqllu9q9h5loog0hpadr6854fb2oq0.apps.dummy.com',
    'ek1k4RNTao8XY6gAmmOXxJ6m',
    current_timestamp
) RETURNING *;
