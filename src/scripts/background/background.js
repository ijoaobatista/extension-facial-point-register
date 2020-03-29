chrome.browserAction.onClicked.addListener(function() {
    chrome.tabs.create({url: "home.html", active: true});
});

