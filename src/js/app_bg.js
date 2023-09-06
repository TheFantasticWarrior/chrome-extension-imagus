// » header

"use strict";

var app, cfg, Tabs, Port;

if (location.hash) {
    app = location.hash.slice(1).split(",");
    app = {
        name: app[0],
        version: app[1],
    };
}

try {
    void chrome.storage.local;
    var platform = this.browser ? "firefox" : "chrome";
} catch (ex) {
    var platform = "edge";
    this.chrome = this.browser;
}

app = chrome.runtime.getManifest();
app = {
    name: app.name,
    version: app.version,
};

cfg = {
    migrateOldStorage: function (keys, callback) {
        if (localStorage.hz) {
            var itemsToStore = {};

            for (var i = 0; i < keys.length; ++i) {
                var key = keys[i];
                itemsToStore[key] = JSON.parse(localStorage.getItem(key));
            }

            this.set(itemsToStore, function () {
                localStorage.clear();
                callback();
            });
            return;
        }

        callback();
    },

    get: function (keys, callback) {
        chrome.storage.local.get(keys, function (items) {
            for (var key in items) {
                try {
                    if (!items[key]) {
                        throw Error;
                    }

                    items[key] = JSON.parse(items[key]);
                } catch (ex) {
                    delete items[key];
                }
            }

            callback(items);
        });
    },

    set: function (items, callback) {
        for (var key in items) {
            // Use JSON.stringify in order to keep key order in objects,
            // as Chrome sorts it
            items[key] = JSON.stringify(items[key]);
        }

        chrome.storage.local.set(items, callback);
    },

    remove: function (keys) {
        chrome.storage.local.remove(keys);
    },
};

Tabs = {};
Tabs.create = chrome.tabs.create;

Port = {
    parse_msg: function (msg, origin, postMessage) {
        return {
            msg: msg,
            origin: origin.url,
            postMessage: postMessage,
        };
    },
    listen: function (fn) {
        chrome.runtime.onMessage.addListener(fn);
    },
};

var to_fromHistory =
    chrome.history &&
    function (url, removeIfVisited) {
        if (removeIfVisited) {
            chrome.history.getVisits({ url: url }, function (visits) {
                chrome.history[(visits.length ? "delete" : "add") + "Url"]({
                    url: url,
                });
            });
        } else {
            chrome.history.addUrl({ url: url });
        }
    };

window.saveURI = function (details) {
    if (!details || !details.url) {
        return;
    }
    var url = details.url;
    var path = details.path;
    var mimetoext = JSON.parse(details.mimetoext);
    var ext = new RegExp(details.priorityExt, "i");
    var options = { url: url };
    if (path) {
        if (path.slice[-1] != "/") path += "/";
        options.saveAs = false;
    } else {
        path = "";
    }

    var decidename = function (item, suggest) {
        if (!item.filename.includes(".") || !item.filename.match(ext)) {
            var filename = item.filename.match(/([^\.])+/)[0];
            ext = url.match(ext);
            if (!ext) {
                ext = mimetoext[item.mime];
            }

            if (!ext) ext = details.ext;
            filename += "." + ext;

            suggest({ filename: path + filename });
        } else if (path) {
            var filename = item.filename;
            suggest({ filename: path + filename });
        }
        chrome.downloads.onDeterminingFilename.removeListener(decidename);
    };
    if (details.filename) {
        if (!details.filename.includes(".") || !details.filename.match(ext)) {
            ext = url.match(ext);

            if (!ext) ext = details.ext;
            details.filename += "." + ext;
        }
        options.filename = path + details.filename;
    } else {
        chrome.downloads.onDeterminingFilename.addListener(decidename);
    }
    chrome.downloads.download(options);
};
