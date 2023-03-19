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
} catch (ex) {
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
  function download(url, path, filename) {
    try {
      // Chrome fails if there's an unexpected property,
      // incognito is Firefox only
      browser.downloads.download({
        url: url,
        filename: path + filename,
        incognito: details.isPrivate,
        saveAs: false
      });
    } catch (ex) {
      browser.downloads.download({
          url: url,
          filename: path + filename,
          saveAs: false,
      });
    }
  }
  cfg.get("hz", function (i) {
    let path = i["hz"]["save"];
    if (path) {
      if(path.slice[-1]!="/")path+="/";
      var filename;
      filename = url.match(/.*\/(.+\..+)/)[1];
      if (filename) download(url, path, filename);
      else {
        let xhr = new XMLHttpRequest();
        xhr.open("HEAD", details.url);
        xhr.onload = function () {
          let header = xhr.getResponseHeader("Content-Disposition");
          filename = header.match(/.*\/(.+\..+)/)[1];
          download(url, path, filename);
        };
        xhr.send();
      }
    } else {
      try {
          browser.downloads.download({
              url: url,
              incognito: details.isPrivate
          });
      } catch (ex) {
          browser.downloads.download({
              url: url,
          });
      }
    }
    
    });

};
