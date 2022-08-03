/* global getCookieValue */

"use strict";

fluid.registerNamespace("fluid.prefs.edgeProxy");

// Edge Proxy Store
fluid.defaults("fluid.prefs.edgeProxyStore", {
    gradeNames: ["fluid.dataSource", "fluid.dataSource.writable", "fluid.modelComponent"],
    members: {
        isFreshLogon: "@expand:fluid.prefs.edgeProxyStore.getFreshLogon()"
    },
    model: {
        isLoggedIn: false
    },
    components: {
        encoding: {
            type: "fluid.dataSource.encoding.none"
        },
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
        isLoggedIn: {
            listener: "fluid.prefs.edgeProxyStore.updateUnauthedSettings",
            args: ["{that}", "{prefsEditorLoader}", "{change}.value"],
            excludeSource: "init"
        }
    }
});

// Update the fresh logon state at the page load. Check if PDS_freshLogon is a query parameter of the page url.
// If yes, return true. Otherwise, return false.
fluid.prefs.edgeProxyStore.getFreshLogon = function () {
    const url = new URL(window.location);
    const isFreshLogon = url.searchParams.get("PDS_freshLogon") === "true";

    if (isFreshLogon) {
        // Remove "PDS_freshLogon" from query strings not to confuse users
        url.searchParams.delete("PDS_freshLogon");
        window.history.replaceState({}, "", url.href);
    }

    return isFreshLogon;
};

// Update the log in states at the page load.
fluid.prefs.edgeProxyStore.updateLoggedInState = function (that) {
    that.applier.change("isLoggedIn", !!getCookieValue("PDS_loginToken"));
};

fluid.prefs.edgeProxyStore.get = async function (that) {
    if (that.isFreshLogon) {
        const unauthedPrefs = await fluid.prefs.edgeProxyStore.getPrefsFromStore(that.unauthedStore);
        const authedPrefs = await fluid.prefs.edgeProxyStore.getPrefsFromStore(that.authedStore);
        return {
            preferences: fluid.extend(true, {}, authedPrefs, unauthedPrefs)
        };
    } else {
        return that[that.model.isLoggedIn ? "authedStore" : "unauthedStore"].get();
    }
};

fluid.prefs.edgeProxyStore.set = function (that, settings) {
    return that[that.model.isLoggedIn ? "authedStore" : "unauthedStore"].set({}, settings);
};

fluid.prefs.edgeProxyStore.getPrefsFromStore = async function (store) {
    const settings = await store.get();
    return settings?.preferences ?? {};
};

// When user logs out, apply preferences from unauthed store
fluid.prefs.edgeProxyStore.updateUnauthedSettings = async function (that, prefsEditorLoader, isLoggedIn) {
    if (isLoggedIn) {
        return;
    }
    const prefsEditor = prefsEditorLoader.prefsEditor;

    const unauthedSettings = await that.unauthedStore.get();
    const unauthedPrefs = unauthedSettings?.preferences ?? {};
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
                    "tocMessage": "lib/infusion/src/framework/preferences/messages/tableOfContents-enactor.json"
                }
            }
        }
    });
};
