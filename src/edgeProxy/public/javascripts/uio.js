/* global getCookieValue */

"use strict";

// TODO:
// 1. when redirected back to the page after the google login, applying merged preferences throws
// "prefsEditor is undefined".

fluid.registerNamespace("fluid.prefs.edgeProxy");

fluid.defaults("fluid.dataSource.noEncoding", {
    gradeNames: ["fluid.dataSource", "fluid.dataSource.writable"],
    components: {
        encoding: {
            type: "fluid.dataSource.encoding.none"
        }
    }
});

// Edge Proxy Store
fluid.defaults("fluid.prefs.edgeProxyStore", {
    gradeNames: ["fluid.dataSource.noEncoding", "fluid.modelComponent"],
    model: {
        isLoggedIn: false,
        isFreshLogon: false
    },
    components: {
        unauthedStore: {
            type: "fluid.prefs.cookieStore",
            options: {
                writable: true
            }
        }
    },
    dynamicComponents: {
        authedStore: {
            source: "{that}.model.isLoggedIn",
            type: "fluid.prefs.pdsStore"
        }
    },
    listeners: {
        "onCreate.updateLoggedInState": {
            listener: "fluid.prefs.edgeProxyStore.updateLoggedInState",
            args: ["{that}"]
        },
        "onRead.impl": {
            listener: "fluid.prefs.edgeProxyStore.get",
            args: ["{that}"]
        },
        "onWrite.impl": {
            listener: "fluid.prefs.edgeProxyStore.set",
            args: ["{that}", "{arguments}.0"]   // settings
        }
    },
    modelListeners: {
        isFreshLogon: {
            listener: "fluid.prefs.edgeProxyStore.updateMergedSettings",
            args: ["{that}", "{prefsEditorLoader}", "{change}.value"]
        },
        isLoggedIn: {
            listener: "fluid.prefs.edgeProxyStore.updateUnauthedSettings",
            args: ["{that}", "{prefsEditorLoader}", "{change}.value"],
            excludeSource: "init"
        }
    }
});

// Update the log in states at the page load.
fluid.prefs.edgeProxyStore.updateLoggedInState = function (that) {
    that.applier.change("isLoggedIn", getCookieValue("PDS_loginToken") ? true : false);

    // Find if the page is redirected from a fresh logon: check if PDS_freshLogon is a query parameter of the page url
    const url = new URL(window.location);
    that.applier.change("isFreshLogon", url.searchParams.get("PDS_freshLogon") === "true");

    // Remove "PDS_freshLogon" from query strings
    url.searchParams.delete("PDS_freshLogon");
    window.history.replaceState({}, "", url.href);
};

fluid.prefs.edgeProxyStore.get = function (that) {
    return that[that.model.isLoggedIn ? "authedStore" : "unauthedStore"].get();
};

fluid.prefs.edgeProxyStore.set = function (that, settings) {
    return that[that.model.isLoggedIn ? "authedStore" : "unauthedStore"].set({}, settings);
};

fluid.prefs.edgeProxyStore.getPrefsFromStore = async function (store) {
    const settings = await store.get();
    return settings && settings.preferences ? settings.preferences : {};
};

fluid.prefs.edgeProxyStore.updateMergedSettings = async function (that, prefsEditorLoader, isFreshLogon) {
    // Only apply merged settings after a fresh logon
    if (isFreshLogon) {
        const prefsEditor = prefsEditorLoader.prefsEditor;

        // Update prefsEditor model with the merged preferences from authedStore and unauthedStore.
        // When same preferences exist in both sets, preferences from the unauthedStore take precedence.
        const unauthedPrefs = await fluid.prefs.edgeProxyStore.getPrefsFromStore(that.unauthedStore);
        const authedPrefs = await fluid.prefs.edgeProxyStore.getPrefsFromStore(that.authedStore);
        const prefsTogo = fluid.extend(true, {}, authedPrefs, unauthedPrefs);

        if (prefsTogo) {
            prefsEditor.applier.change("preferences", prefsTogo);
        }
    }
};

// When user logs out, apply preferences from unauthed store
fluid.prefs.edgeProxyStore.updateUnauthedSettings = async function (that, prefsEditorLoader, isLoggedIn) {
    if (isLoggedIn) {
        return;
    }
    const prefsEditor = prefsEditorLoader.prefsEditor;

    const unauthedSettings = await that.unauthedStore.get();
    const unauthedPrefs = unauthedSettings && unauthedSettings.preferences ? unauthedSettings.preferences : {};
    // As unauthedPrefs only contains modified preferences, when firing a change request, it leads to an issue that
    // other preferences from authedStore will remain. Merging with the prefsEditor.initialModel cleans up changes
    // from authedStore. This will be handled differently for working with UIO 2.
    const prefsTogo = fluid.extend(true, {}, prefsEditor.initialModel.preferences, unauthedPrefs);

    if (prefsTogo) {
        prefsEditor.applier.change("preferences", prefsTogo);
    }
};

// Personal Data Server Store
fluid.defaults("fluid.prefs.pdsStore", {
    gradeNames: ["fluid.dataSource.URL", "fluid.dataSource.URL.writable"],
    url: "/api/prefs",
    writeMethod: "PUT",
    headers: {
        "Content-Type": "application/json"
    }
});

// Instantiate UIO
// eslint-disable-next-line
const instantiateUIO = function () {
    fluid.contextAware.makeChecks({"fluid.prefs.edgeProxy": true});

    fluid.contextAware.makeAdaptation({
        distributionName: "fluid.prefs.edgeProxyStoreDistributor",
        targetName: "fluid.prefs.store",
        adaptationName: "strategy",
        checkName: "edgeProxyExample",
        record: {
            contextValue: "{fluid.prefs.edgeProxy}",
            gradeNames: "fluid.prefs.edgeProxyStore",
            priority: "after:user"
        }
    });

    return fluid.uiOptions(".flc-prefsEditor-separatedPanel", {
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
};
