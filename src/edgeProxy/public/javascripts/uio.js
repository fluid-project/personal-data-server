"use strict";

fluid.uiOptions(".flc-prefsEditor-separatedPanel", {
    auxiliarySchema: {
        terms: {
            "templatePrefix": "lib/infusion/src/framework/preferences/html",
            "messagePrefix": "lib/infusion/src/framework/preferences/messages"
        },
        "fluid.prefs.tableOfContents": {
            enactor: {
                "tocTemplate": "lib/infusion/src/components/tableOfContents/html/TableOfContents.html",
                "tocMessage": "lib/infusion/src/framework/preferences/messages/tableOfContents-enactor.json",
                ignoreForToC: {
                    "overviewPanel": ".flc-overviewPanel"
                }
            }
        }
    }
});
