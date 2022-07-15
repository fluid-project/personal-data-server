"use strict";

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
        },
        authedStore: {
            type: "fluid.prefs.pdsStore"
        }
    },
    listeners: {
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
            listener: "fluid.prefs.edgeProxyStore.updateSettings",
            // args: ["{that}", "{prefsEditor}", "{change}.value"]
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

fluid.prefs.edgeProxyStore.updateSettings = async function (that, prefsEditorLoader, isLoggedIn) {
    let prefsTogo;
    const prefsEditor = prefsEditorLoader.prefsEditor;

    if (isLoggedIn) {
        // Update prefsEditor model with the merged preferences from authedStore and unauthedStore.
        // When same preferences exist in both sets, preferences from the unauthedStore take precedence.
        const unauthedPrefs = await fluid.prefs.edgeProxyStore.getPrefsFromStore(that.unauthedStore);
        const authedPrefs = await fluid.prefs.edgeProxyStore.getPrefsFromStore(that.authedStore);
        console.log("unauthedPrefs: ", unauthedPrefs);
        console.log("authedPrefs: ", authedPrefs);
        prefsTogo = {...authedPrefs, ...unauthedPrefs};
    } else {
        const unauthedSettings = await that.unauthedStore.get();
        const unauthedPrefs = unauthedSettings && unauthedSettings.preferences ? unauthedSettings.preferences : {};
        prefsTogo = {...prefsEditor.initialModel.preferences, ...unauthedPrefs};
    }
    console.log("prefsTogo: ", prefsTogo);
    if (prefsTogo) {
        console.log("prefsEditor: ", prefsEditor);
        prefsEditor.applier.change("preferences", prefsTogo);
    }
};

// Personal Data Server Store
fluid.defaults("fluid.prefs.pdsStore", {
    gradeNames: ["fluid.dataSource.URL", "fluid.dataSource.URL.writable"],
    url: "/api/prefs",
    method: "GET",
    writeMethod: "POST",
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
