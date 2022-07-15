/* global instantiateUIO */

"use strict";

const pdsServer = "http://localhost:3000";

// Parse document.cookie to get the value of a given cookie name
const getCookieValue = function (cookieName) {
    if (document.cookie === "") {
        return null;
    }

    const cookieStr = document.cookie
        .split("; ")
        .find(row => row.startsWith(cookieName + "="));
    return cookieStr ? cookieStr.split("=")[1] : null;
};

// Update DOM element states based on the isLoggedIn flag
const updateLoggedInState = function (isLoggedIn) {
    document.getElementById("login").disabled = isLoggedIn ? true : false;
    document.getElementById("logout").disabled = isLoggedIn ? false : true;
    document.getElementById("message").innerHTML = "You have logged " + (isLoggedIn ? "in." : "out.");
};

// The event listener for the "login" button click
document.getElementById("login").addEventListener("click", () => {
    window.location.href = pdsServer + "/sso/google";
});

// The event listener for the "logout" button click
document.getElementById("logout").addEventListener("click", () => {
    // Remove "PDS_loginToken" cookie value
    document.cookie = "PDS_loginToken=; max-age=-1; path=/";

    // Update UIO with preferences fetched from the unauthenticated store
    uio.store.settingsStore.applier.change("isLoggedIn", false);

    // Update buttons and messages on the webpage to the logged out state
    updateLoggedInState(false);
});

// Get the login token
const loginToken = getCookieValue("PDS_loginToken");
// Instantiate UI Options
const uio = instantiateUIO();
console.log(uio);
console.log(uio.prefsEditorLoader.prefsEditor);

// Actions performed at a page load based on whether the user has already logged in.
if (loginToken) {
    // Update UIO with merged preferences fetched from the authenticated store and unauthenticated store.
    uio.store.settingsStore.applier.change("isLoggedIn", true);

    // Update buttons and messages on the webpage to the logged in state
    updateLoggedInState(true);
} else {
    // Update buttons and messages on the webpage to the logged out state
    updateLoggedInState(false);
}
