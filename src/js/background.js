/* global app, cfg, Tabs, Port, to_fromHistory */

"use strict";

var prefs_, sieveResLocal;

RegExp.escape = function (s) {
    return s.replace(/[/\\^$-.+*?|(){}[\]]/g, "\\$&");
};

var withBaseURI = function (base, link, addProtocol) {
    if (link[1] === "/" && link[0] === "/") {
        if (addProtocol) {
            return base.slice(0, base.indexOf(":") + 1) + link;
        }

        return link;
    }

    if (/^[\w-]{2,20}:/i.test(link)) {
        return link;
    }

    return (
        base.replace(
            link[0] === "/" ? /(\/\/[^/]+)\/.*/ : /(\/)[^/]*(?:[?#].*)?$/,
            "$1"
        ) + link
    );
};

var updateSieve = function (localUpdate, callback) {
    var newSieve;
    var xhr = new XMLHttpRequest();

    var onStoredSieveReady = function (items) {
        var localSieve = items.sieve;
        var modlist = items.modlist;

        if (localSieve) {
            var keep = {};

            for (var i = 0; i < modlist.length; i++) {
                if (newSieve[modlist[i]]) {
                    keep[modlist[i]] = {
                        old: localSieve[modlist[i]],
                        new: JSON.parse(JSON.stringify(newSieve[modlist[i]])),
                    };
                    newSieve[modlist[i]].off = localSieve[modlist[i]].off;
                } else {
                    keep[modlist[i]] = {
                        old: localSieve[modlist[i]],
                        new: { link: "!!!NOT IN UPDATE!!!" },
                    };
                }
            }

            if (typeof callback === "function") {
                callback({ updated: newSieve, resolving: keep });
            }
            /*
            for (rule in localSieve) {
                // this rule is the first one, so skip everything from here
                // stupid, but...
                if (rule === "dereferers") {
                    break;
                }

                // ignore those that are in the new version,
                // mainly for ordering
                if (!newSieve[rule]) {
                    tempSieve[rule] = localSieve[rule];
                }
            }

            for (rule in newSieve) {
                tempSieve[rule] = newSieve[rule];
            }

            newSieve = tempSieve;*/
        } else {
            updatePrefs({ sieve: newSieve }, function () {
                if (typeof callback === "function")
                    callback({ updated: newSieve });
            });
        }

        console.info(
            app.name +
                ": Sieve updated from " +
                (localUpdate ? "local" : "remote") +
                " repository."
        );
    };

    xhr.onload = function () {
        this.onload = null;

        try {
            if (!localUpdate && !this.responseText) {
                throw new Error("HTTP " + this.status);
            }

            newSieve = JSON.parse(this.responseText);
            cfg.get(["sieve", "modlist"], onStoredSieveReady);
        } catch (ex) {
            console.warn(
                app.name +
                    ": Sieve failed to update from " +
                    (localUpdate ? "local" : "remote") +
                    " repository! | ",
                ex.message
            );

            if (!localUpdate) {
                cfg.get("sieve", function (items) {
                    if (!items.sieve) {
                        updateSieve(true);
                    }
                });
            }
        }
    };

    xhr.overrideMimeType("application/json;charset=utf-8");
    xhr.open(
        "GET",
        localUpdate
            ? withBaseURI(document.baseURI, "sieve.jsn")
            : prefs_.sieveRepository,
        true
    );
    xhr.send(null);
};

var cacheSieve = function (newSieve) {
    if (typeof newSieve === "string") {
        newSieve = JSON.parse(newSieve);
    } else {
        newSieve = JSON.parse(JSON.stringify(newSieve));
    }

    var cachedSieve = [];
    sieveResLocal = [];

    for (var ruleName in newSieve) {
        var rule = newSieve[ruleName];

        if ((!rule.link && !rule.img) || (rule.img && !rule.to && !rule.res)) {
            continue;
        }

        try {
            if (rule.off) {
                throw ruleName + " is off";
            }

            if (rule.res) {
                // store function bodies here, and send them only when requested
                if (/^:\n/.test(rule.res)) {
                    sieveResLocal[cachedSieve.length] = rule.res.slice(2);
                    rule.res = 1;
                    // store other (parsed) regexes/queries only in the background script
                } else {
                    if (rule.res.indexOf("\n") > -1) {
                        var lines = rule.res.split(/\n+/);
                        rule.res = RegExp(lines[0]);

                        if (lines[1]) {
                            rule.res = [rule.res, RegExp(lines[1])];
                        }
                    } else {
                        rule.res = RegExp(rule.res);
                    }

                    sieveResLocal[cachedSieve.length] = rule.res;
                    rule.res = true;
                }
            }
        } catch (ex) {
            if (typeof ex === "object") {
                console.error(ruleName, rule, ex);
            } else {
                console.info(ex);
            }

            continue;
        }

        if (
            rule.to &&
            rule.to.indexOf("\n") > 0 &&
            rule.to.indexOf(":\n") !== 0
        ) {
            rule.to = rule.to.split("\n");
        }

        delete rule.note;
        cachedSieve.push(rule);
    }

    prefs_.sieve = cachedSieve;
};

var updatePrefs = function (sentPrefs, callback) {
    if (!sentPrefs) {
        sentPrefs = {};
    }

    var defPrefs;
    var onStoredPrefsReady = function (items) {
        var needToUpdate, key, pref;
        var newPrefs = {};
        var itemsToStore = {};

        for (key in defPrefs) {
            needToUpdate = false;
            if (typeof defPrefs[key] === "object") {
                newPrefs[key] = sentPrefs[key] || items[key] || defPrefs[key];
                needToUpdate = true;

                if (!Array.isArray(defPrefs[key])) {
                    for (pref in defPrefs[key]) {
                        if (
                            (newPrefs[key][pref] === void 0 ||
                                typeof newPrefs[key][pref] !==
                                    typeof defPrefs[key][pref]) &&
                            pref != "save"
                        ) {
                            // if preference is not sent, then use the actual or the default preference
                            newPrefs[key][pref] = (
                                !prefs_ || prefs_[key][pref] === void 0
                                    ? defPrefs
                                    : prefs_
                            )[key][pref];
                        }
                    }
                }
            } else {
                // Maxthon will give an empty string instead of null for non-existent prefs
                // therefore empty string should be considered unset in other browsers too
                pref = sentPrefs[key] || items[key] || defPrefs[key];

                // replace the sent pref with the default one, if their type doesn't match
                if (typeof pref !== typeof defPrefs[key]) {
                    pref = defPrefs[key];
                }

                if (!prefs_ || prefs_[key] !== pref) {
                    needToUpdate = true;
                }

                newPrefs[key] = pref;
            }

            if (needToUpdate || items[key] === void 0) {
                itemsToStore[key] = newPrefs[key];
            }
        }

        prefs_ = newPrefs;

        if (newPrefs.grants) {
            pref = newPrefs.grants || [];
            var grants = [];

            for (key = 0; key < pref.length; ++key) {
                if (pref[key].op === ";") {
                    continue;
                }

                grants.push({
                    op: pref[key].op,
                    url:
                        pref[key].op.length === 2
                            ? RegExp(pref[key].url, "i")
                            : pref[key].url,
                });
            }

            if (grants.length) {
                prefs_.grants = grants;
            }
        }

        if (sentPrefs.sieve) {
            itemsToStore.sieve =
                typeof sentPrefs.sieve === "string"
                    ? JSON.parse(sentPrefs.sieve)
                    : sentPrefs.sieve;
            cacheSieve(itemsToStore.sieve);
        }

        cfg.set(itemsToStore, function () {
            if (!sentPrefs.sieve) {
                cfg.get("sieve", function (prefs) {
                    if (prefs.sieve) {
                        cacheSieve(prefs.sieve);
                    } else {
                        updateSieve(true);
                    }
                });
            }

            if (typeof callback === "function") {
                callback();
            }
        });
    };

    defPrefs = new XMLHttpRequest();
    defPrefs.overrideMimeType("application/json;charset=utf-8");
    // jsn instead of json to bypass an Opera 12 bug with custom json MIME handler
    defPrefs.open("GET", withBaseURI(document.baseURI, "defaults.jsn"), true);
    defPrefs.onload = function () {
        this.onload = null;
        defPrefs = JSON.parse(defPrefs.responseText);
        cfg.get(Object.keys(defPrefs), onStoredPrefsReady);
    };
    defPrefs.send(null);
};

var onMessage = function (ev, origin, postMessage) {
    var msg, e;

    // the function was called directly (not by an event)
    if (origin === null) {
        msg = ev;
    } else {
        e = Port.parse_msg(ev, origin, postMessage);
        msg = e.msg;
    }

    if (!msg.cmd) {
        return;
    }

    switch (msg.cmd) {
        case "hello":
            var i,
                l,
                grants,
                blockaccess = false,
                // blocked_rules = {},
                sitePrefs = {
                    hz: prefs_.hz,
                    sieve: prefs_.sieve,
                    tls: prefs_.tls,
                    keys: prefs_.keys,
                    grants: prefs_.grants,
                },
                blockedPrefs = {
                    numpad: prefs_.hz.numpad,
                    key: prefs_.keys.hz_grants,
                    grants: prefs_.grants,
                };

            if (prefs_.grants) {
                grants = prefs_.grants;

                for (i = 0, l = grants.length; i < l; ++i) {
                    if (
                        grants[i].url === "*" ||
                        (grants[i].op[1] && grants[i].url.test(e.origin)) ||
                        e.origin.indexOf(grants[i].url) > -1
                    ) {
                        /*if (grants[i].op[0] === '@') {
							if (!grants[i].opts || !grants[i].opts.length) {
								continue;
							}

							clone(sitePrefs);

							for (j in grants[i].opts) {
								j = j.split('_');
								sitePrefs[j[0]][j[1].replace('-', '_')] = grants[i].opts[j.join('_')];
							}
						}
						else if (grants[i].rules) {
							k = grants[i].op[0] === '!';

							if (blockaccess && !k) {
								for (j in sitePrefs.sieve) {
									blocked_rules[j] = true;
								}
							}

							for (j = 0; j < grants[i].rules.length; ++j) {
								blocked_rules[grants[i].rules[j]] = k;
							}

							blocked_rules[':'] = true;
							blockaccess = false;
						}
						else {
							blockaccess = grants[i].op[0] === '!' ? true : false;
							blocked_rules[':'] = false;
						}*/

                        blockaccess = grants[i].op[0] === "!" ? true : false;
                    }
                }

                /*if (blocked_rules[':']) {
					sitePrefs.sieve = clone(sitePrefs.sieve);

					for (i in blocked_rules) {
						if (blocked_rules[i]) {
							delete sitePrefs.sieve[i];
						}
					}
				}*/
            }

            // TODO: do not clone modified settings, instead send the differences
            // and overwrite them in the content script
            e.postMessage({
                cmd: "hello",
                prefs: blockaccess ? blockedPrefs : sitePrefs,
                allow: !blockaccess,
            });
            break;

        case "cfg_get":
            if (!Array.isArray(msg.keys)) {
                msg.keys = [msg.keys];
            }

            cfg.get(msg.keys, function (items) {
                e.postMessage({ cfg: items });
            });
            break;

        case "cfg_del":
            if (!Array.isArray(msg.keys)) {
                msg.keys = [msg.keys];
            }

            cfg.remove(msg.keys);
            break;

        case "getLocaleList":
            var lxhr = new XMLHttpRequest();
            lxhr.overrideMimeType("application/json;charset=utf-8");
            lxhr.open(
                "GET",
                withBaseURI(document.baseURI, "locales.jsn"),
                true
            );
            lxhr.onload = function () {
                this.onload = null;
                e.postMessage(this.responseText);
            };
            lxhr.send(null);
            break;

        case "savePrefs":
            updatePrefs(msg.prefs);
            break;

        case "update_sieve":
            updateSieve(false, function (data) {
                e.postMessage(data);
            });
            break;

        case "download":
            if (typeof chrome.downloads === "undefined") {
                e.postMessage(false);
                break;
            }
            if (typeof window.saveURI === "function") {
                window.saveURI({
                    ...msg,
                    isPrivate: e.isPrivate,
                });
            }
            e.postMessage(true);
            break;

        case "history":
            if (typeof to_fromHistory === "function" && !e.isPrivate) {
                to_fromHistory(msg.url, msg.manual);
            }
            break;

        case "open":
            if (!Array.isArray(msg.url)) {
                msg.url = [msg.url];
            }

            msg.url.forEach(function (url) {
                if (!url || typeof url !== "string") {
                    return;
                }

                var params = {
                    url: url,
                    active: !msg.nf,
                };

                if (origin && origin.tab && origin.tab.id) {
                    params.openerTabId = origin.tab.id;
                }

                try {
                    Tabs.create(params);
                } catch (ex) {
                    delete params.openerTabId;
                    Tabs.create(params);
                }
            });
            break;

        case "resolve":
            var data = {
                cmd: "resolved",
                id: msg.id,
                m: null,
                params: msg.params,
            };

            var rule = prefs_.sieve[data.params.rule.id];

            if (data.params.rule.req_res) {
                data.params.rule.req_res = sieveResLocal[data.params.rule.id];
            }

            if (data.params.rule.skip_resolve) {
                // since we didn't really fetch anything, no need to set url
                data.params.url = [""];
                e.postMessage(data);
                return;
            }

            var post_params = /([^\s]+)(?: +:(.+)?)?/.exec(msg.url);
            msg.url = post_params[1];

            if (!post_params[2]) {
                post_params[2] = null;
            }

            if (rule.res === 1) {
                data.m = true;
                data.params._ = "";
                data.params.url = [post_params[1], post_params[2]];
            }

            post_params = post_params[2];

            var xhr = new XMLHttpRequest();
            xhr.onloadend = function () {
                this.onloadend = null;

                var base_url, match;

                if (
                    /^(image|video|audio)\//i.test(
                        this.getResponseHeader("Content-Type")
                    )
                ) {
                    data.m = msg.url;
                    data.noloop = true;
                    console.warn(
                        app.name +
                            ": rule " +
                            data.params.rule.id +
                            " matched against an image file"
                    );
                    e.postMessage(data);
                    return;
                }

                base_url = this.responseXML && this.responseXML.baseURI;

                if (!base_url) {
                    base_url = this.responseText.slice(0, 4096);

                    if (
                        (base_url = /<base\s+href\s*=\s*("[^"]+"|'[^']+')/.exec(
                            base_url
                        ))
                    ) {
                        base_url = withBaseURI(
                            msg.url,
                            base_url[1].slice(1, -1).replace(/&amp;/g, "&"),
                            true
                        );
                    } else {
                        base_url = msg.url;
                    }
                }

                if (rule.res === 1) {
                    data.params._ = this.responseText;
                    data.params.base = base_url.replace(
                        /(\/)[^\/]*(?:[?#].*)*$/,
                        "$1"
                    );
                    e.postMessage(data);
                    return;
                }

                var _match = sieveResLocal[data.params.rule.id];
                _match = (Array.isArray(_match) ? _match : [_match]).map(
                    function (el) {
                        var sel = el.source || el;

                        if (sel.indexOf("$") === -1) {
                            return el;
                        }

                        // allow matching groups (from URLs, without functions) in "res"
                        // e.g., regex: src="(http://$1/content.ext)
                        var group = data.params.length;
                        group = Array.apply(null, Array(group))
                            .map(function (_, i) {
                                return i;
                            })
                            .join("|");
                        group = RegExp("([^\\\\]?)\\$(" + group + ")", "g");
                        group = !group.test(sel)
                            ? el
                            : sel.replace(group, function (m, prefix, id) {
                                  return id < data.params.length &&
                                      prefix !== "\\"
                                      ? prefix +
                                            (data.params[id]
                                                ? RegExp.escape(data.params[id])
                                                : "")
                                      : m;
                              });

                        return typeof el === "string" ? group : RegExp(group);
                    }
                );

                match = _match[0].exec(this.responseText);

                if (match) {
                    var match_param = data.params.rule.loop_param;

                    if (
                        rule.dc &&
                        ((match_param === "link" && rule.dc !== 2) ||
                            (match_param === "img" && rule.dc > 1))
                    ) {
                        match[1] = decodeURIComponent(
                            decodeURIComponent(match[1])
                        );
                    }

                    data.m = withBaseURI(
                        base_url,
                        match[1].replace(/&amp;/g, "&")
                    );

                    if (
                        (match[2] && (match = match.slice(1))) ||
                        (_match[1] &&
                            (match = _match[1].exec(this.responseText)))
                    ) {
                        data.m = [
                            data.m,
                            match
                                .filter(function (el, idx) {
                                    return idx && el ? true : false;
                                })
                                .join(" - "),
                        ];
                    }
                } else {
                    console.info(
                        app.name + ": no match for " + data.params.rule.id
                    );
                }

                e.postMessage(data);
            };
            xhr.open(post_params ? "POST" : "GET", msg.url);

            if (post_params) {
                xhr.setRequestHeader(
                    "Content-Type",
                    "application/x-www-form-urlencoded"
                );
            }

            xhr.send(post_params);
            break;

        case "toggle":
            if (msg.value)
                chrome.browserAction.setIcon({
                    path: chrome.runtime.getURL("disabled.png"),
                });
            else
                chrome.browserAction.setIcon({
                    path: chrome.runtime.getURL("icon.png"),
                });
    }

    // Chrome
    return true;
};

Port.listen(onMessage);
document.title = ":: " + app.name + " ::";

cfg.migrateOldStorage(
    ["version", "hz", "tls", "keys", "grants", "sieve"],
    function () {
        cfg.get("version", function (items) {
            var day = 24 * 3600 * 1000;
            var version = items.version || {};
            var lastCheck = version.lastCheck || 0;

            if (version.current !== app.version) {
                var oldVersion = version.current;
                version = {
                    current: app.version,
                    lastCheck: Date.now() + ((Math.random() * 15) | 0) * day,
                };
                console.info(
                    app.name +
                        " has been " +
                        (oldVersion ? "updated!" : "installed!")
                );

                cfg.set({ version: version }, function () {
                    if (oldVersion) {
                        cfg.get("sieveRepository", function (old) {
                            sieveRepository = old.sieveRepository;
                            if (
                                sieveRepository ===
                                "https://raw.githubusercontent.com/wvxwxvw/Imagus_sieve_RuBoard/master/updated.txt"
                            ) {
                                sieveRepository =
                                    "https://raw.githubusercontent.com/kuzn123/Imagus-Sieve-RuBoard/master/update.txt";

                                cfg.set({ sieveRepository: sieveRepository });
                            }
                        });
                        updateSieve(true);
                    } else {
                        updatePrefs();
                    }
                });
                return;
            }

            updatePrefs(null, function () {
                if (!prefs_.tls.sieveAutoUpdate) {
                    return;
                }

                if (lastCheck && Date.now() - lastCheck < 15 * day) {
                    return;
                }

                var xhr = new XMLHttpRequest();
                xhr.onload = function () {
                    try {
                        // {sieve_ver: timestamp}
                        var check = JSON.parse(this.responseText);

                        if (lastCheck < check.sieve_ver) {
                            updateSieve();
                        }
                    } catch (ex) {
                        console.warn(app.name + ": update check failed!", ex);
                    }

                    version.lastCheck = Date.now();
                    cfg.set({ version: version });
                };

                xhr.open(
                    "GET",
                    withBaseURI(document.baseURI, "info.json", true)
                );
                xhr.send(null);
            });
        });
    }
);
chrome.browserAction.onClicked.addListener((a, b) => {
    if (b && b.modifiers.length) chrome.runtime.openOptionsPage();
    else chrome.tabs.sendMessage(a.id, "disable");
});
