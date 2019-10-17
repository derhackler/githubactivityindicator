function saveOptions(e) {
    // saves the token to local storage
    console.log("saving the token: ", document.querySelector("#github_token").value);
    browser.storage.sync.set({
        github_token: document.querySelector("#github_token").value
    });
    e.preventDefault();
}

function restoreOptions() {
    var gettingItem = browser.storage.sync.get('github_token');
    gettingItem.then((res) => {
        console.log(res);
        document.querySelector("#github_token").value = res.github_token;
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);