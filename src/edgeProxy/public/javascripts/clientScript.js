"use strict";

const pdsServer = "http://localhost:3000";

// The event listener for the "login" button click
document.getElementById("login").addEventListener("click", () => {
    window.location.href = pdsServer + "/sso/google";
});

// The event listener for the "logout" button click
document.getElementById("logout").addEventListener("click", () => {
    // Remove "PDS_loginToken" cookie value
    document.cookie = "PDS_loginToken=; max-age=-1; path=/";
    document.getElementById("message").innerHTML = "You have successfully logged out.";
});

// The event listener for the "get preferences" button click
document.getElementById("get_prefs").addEventListener("click", () => {
    fetch("/api/get_prefs").then(response => {
        showResponse(response, "Received preferences: <br />");
    });
});

// The event listener for the "save preferences" button click
document.getElementById("save_prefs").addEventListener("click", () => {
    fetch("/api/save_prefs").then(response => {
        showResponse(response, "Saved preferences: <br />");
    });
});

const showResponse = function (response, successHeader) {
    if (response.status === 200) {
        response.json().then(res => {
            document.getElementById("message").innerHTML = successHeader + JSON.stringify(res);
        });
    } else {
        response.json().then(error => {
            document.getElementById("message").innerHTML = JSON.stringify(error);
        });
    }
};
