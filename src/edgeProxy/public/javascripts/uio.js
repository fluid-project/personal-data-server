/* global getCookieValue */

"use strict";

// TODO:
// 1. when logged in, click "reset", then reload the page, the cookie store value is applied. The correct behavior is a pure reset.
//      this is because every page load triggers the check of isLoggedIn, which applies preferences from the cookie store.
// 2. when logged in and reset, sometimes the db is not updated.
//    a race condition between the reset of panelIndex and the reset of preferences

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
        isLoggedIn: false
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
            type: "fluid.prefs.pdsStore",
            options: {
                model: {
                    isLoggedIn: "{edgeProxyStore}.model.isLoggedIn"
                },
                listeners: {
                    "onCreate.escalate": "{edgeProxyStore}.events.onAuthedStoreReady.fire"
                }
            }
        }
    },
    events: {
        onAuthedStoreReady: null
    },
    listeners: {
        "onRead.impl": {
            listener: "fluid.prefs.edgeProxyStore.get",
            args: ["{that}"]
        },
        "onWrite.impl": {
            listener: "fluid.prefs.edgeProxyStore.set",
            args: ["{that}", "{arguments}.0"]   // settings
        },
        "onAuthedStoreReady.updateMergedSettings": {
            listener: "fluid.prefs.edgeProxyStore.updateMergedSettings",
            args: ["{that}", "{prefsEditorLoader}"]
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

fluid.prefs.edgeProxyStore.updateMergedSettings = async function (that, prefsEditorLoader) {
    const prefsEditor = prefsEditorLoader.prefsEditor;

    // Update prefsEditor model with the merged preferences from authedStore and unauthedStore.
    // When same preferences exist in both sets, preferences from the unauthedStore take precedence.
    const unauthedPrefs = await fluid.prefs.edgeProxyStore.getPrefsFromStore(that.unauthedStore);
    const authedPrefs = await fluid.prefs.edgeProxyStore.getPrefsFromStore(that.authedStore);
    const prefsTogo = fluid.extend(true, {}, authedPrefs, unauthedPrefs);

    if (prefsTogo) {
        prefsEditor.applier.change("preferences", prefsTogo);
    }
};

fluid.prefs.edgeProxyStore.updateUnauthedSettings = async function (that, prefsEditorLoader, isLoggedIn) {
    const prefsEditor = prefsEditorLoader.prefsEditor;

    if (!isLoggedIn) {
        const unauthedSettings = await that.unauthedStore.get();
        const unauthedPrefs = unauthedSettings && unauthedSettings.preferences ? unauthedSettings.preferences : {};
        // As unauthedPrefs only contains modified preferences, when firing a change request, it leads to an issue that
        // other preferences from authedStore will remain. Merging with the prefsEditor.initialModel cleans up changes
        // from authedStore. This will be handled differently for working with UIO 2.
        const prefsTogo = fluid.extend(true, {}, prefsEditor.initialModel.preferences, unauthedPrefs);

        if (prefsTogo) {
            prefsEditor.applier.change("preferences", prefsTogo);
        }
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

fluid.prefs.edgeProxy.updateLoggedInState = function (uio) {
    uio.store.settingsStore.applier.change("isLoggedIn", getCookieValue("PDS_loginToken") ? true : false);
};

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
        },
        listeners: {
            "onReady.updateLoggedInState": {
                listener: "fluid.prefs.edgeProxy.updateLoggedInState",
                excludeSource: "init"
            }
        }
    });
};
