/* global buildNodes, platform, app, Port, _, cfg:true, SieveUI */
"use strict";

var input_changes = {};
var $ = function (id) {
    return document.getElementById(id);
};

var replaceSave = function (y, value) {
    y = y.parentElement.parentElement;
    y.childNodes[5].replaceWith(_("ASK_SAVE"));
    y.removeChild(y.childNodes[4]);
    var t = document.createElement("input");
    y.insertBefore(t, y.childNodes[4]);
    t.className = "normal";

    t.inputmode = "verbatim";
    t.placeholder = "folder name, no . or :";
    t.pattern = "[^.:]*$";
    t.size = 20;
    t.value = value;
    //t.id = "hz_save";
    t.name = "hz_save";
    return t;
};

var processLNG = function (nodes) {
    var els, l, args, attrs, attrnode, string;
    var i = nodes.length;

    while (i--) {
        if (nodes[i].lng_loaded) {
            continue;
        }

        els = nodes[i].querySelectorAll("[data-lng]");
        l = els.length;

        while (l--) {
            string = _(els[l].dataset["lng"]);
            attrs = els[l].dataset["lngattr"];

            if (attrs) {
                if (/^(title|placeholder)$/.test(attrs)) {
                    els[l][attrs] = string;
                }

                els[l].removeAttribute("data-lngattr");
            } else {
                platform.insertHTML(els[l], string);
            }

            els[l].removeAttribute("data-lng");

            if (els[l].dataset["lngargs"] === void 0) {
                continue;
            }

            args = els[l].dataset["lngargs"].split(" ");
            args.idx = args.length;

            while (args.idx--) {
                args[args.idx] = args[args.idx].split(":");
                args[args.idx][0] = "data-" + args[args.idx][0];
                attrnode = els[l].querySelector("[" + args[args.idx][0] + "]");

                if (!attrnode) {
                    continue;
                }

                attrs = args[args.idx][1].split(",");
                attrs.idx = attrs.length;

                while (attrs.idx--) {
                    if (!/^(href|style|target)$/i.test(attrs[attrs.idx])) {
                        continue;
                    }

                    attrnode.setAttribute(
                        attrs[attrs.idx],
                        els[l].getAttribute(
                            args[args.idx][0] + "-" + attrs[attrs.idx]
                        )
                    );
                }
            }

            els[l].removeAttribute("data-lngargs");
        }

        nodes[i].lng_loaded = true;
    }
};

var color_trans = function (node, color, time) {
    clearTimeout(node.col_trans_timer);

    if (color === null) {
        node.style.color = "";
        delete node.col_trans_timer;
        return;
    }

    node.style.color = color;
    node.col_trans_timer = setTimeout(function () {
        color_trans(node, null);
    }, time || 2000);
};

var ImprtHandler = function (caption, data_handler, hide_opts) {
    var x,
        importer = $("importer");

    processLNG([importer]);

    if (importer.data_handler !== data_handler) {
        importer.data_handler = data_handler;
        importer.lastElementChild.value = "";
        importer.firstElementChild.textContent =
            caption + " - " + _("IMPR_IMPORT");

        x = importer.querySelectorAll(".op_buttons div > div > input[id]");
        hide_opts = hide_opts || {};
        x[0].parentNode.style.display = hide_opts.clear ? "none" : "";
        x[1].parentNode.style.display = hide_opts.overwrite ? "none" : "";
        x[0].checked = x[1].checked = false;
    }

    var imprt_file = $("imprt_file");

    if (imprt_file.onchange) {
        importer.visible(true);
        return;
    }

    x[0].nextInput = x[1];

    x[0].onchange = function () {
        this.nextInput.disabled = this.checked;

        if (this.checked) {
            this.nextInput.checked = false;
        }

        this.nextInput.parentNode.lastElementChild.style.color = this.checked
            ? "silver"
            : "";
    };

    importer.visible = function (show) {
        importer.style.display = show === true ? "block" : "none";
    };

    importer.querySelector("b").onclick = importer.visible;

    importer.ondata = function (data, button) {
        var options = this.querySelectorAll('input[type="checkbox"]');

        options = {
            clear: options[0].checked,
            overwrite: options[1].checked,
        };

        if (importer.data_handler(data, options) === false) {
            color_trans(button, "red");
        } else {
            importer.visible(false);
        }
    };

    importer.readfile = function (file) {
        if (file.size > 5242880) {
            color_trans(imprt_file.parentNode, "red");
        } else {
            var reader = new FileReader();

            reader.onerror = function () {
                color_trans(imprt_file.parentNode, "red");
            };

            reader.onload = function (e) {
                try {
                    e = JSON.parse(e.target.result);
                } catch (ex) {
                    alert(_("INVALIDFORMAT"));
                    return;
                }

                importer.ondata(e, imprt_file.parentNode);
            };

            reader.readAsText(file);
        }
    };

    imprt_file.onchange = function () {
        importer.readfile(this.files[0]);
    };

    imprt_file.ondragover = function (e) {
        e.preventDefault();
    };

    imprt_file.ondragenter = function (e) {
        e.preventDefault();

        if ([].slice.call(e.dataTransfer.types, 0).indexOf("Files") > -1) {
            this.parentNode.style.boxShadow = "0 2px 4px green";
        }
    };

    imprt_file.ondragleave = function () {
        this.parentNode.style.boxShadow = "";
    };

    imprt_file.ondrop = function (e) {
        this.parentNode.style.boxShadow = "";

        if (e.dataTransfer.files.length) {
            importer.readfile(e.dataTransfer.files[0]);
        }

        e.preventDefault();
    };

    $("imprt_text").onclick = function (e) {
        var tarea = importer.lastElementChild;

        if ((e = tarea.value.trim())) {
            try {
                e = JSON.parse(e);
            } catch (ex) {
                color_trans(this, "red");
                return;
            }

            importer.ondata(e, this);
        } else {
            tarea.focus();
        }
    };

    importer.visible(true);
};

var fill_output = function (e) {
    e = e.target || e;
    var op = e.previousElementSibling;
    op.textContent = op.dataset["as_percent"]
        ? parseInt(e.value * 100, 10)
        : e.value;
};

var color_text_input = function (e) {
    e = e.type === "input" ? this : e;
    var v = /^#([\da-f]{3}){1,2}$/i.test(e.value) ? e.value : "#ffffff";
    e.previousElementSibling.value =
        v.length === 4 ? "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3] : v;
};

var color_change = function () {
    this.nextElementSibling.value = this.value;
};

var setDefault = function (query) {
    if (!query) {
        return;
    }

    [].forEach.call(
        typeof query === "string" ? document.querySelectorAll(query) : [query],
        function (el) {
            if (el.type === "checkbox") {
                el.checked = el.defaultChecked;
            } else if (/^SELECT/i.test(el.type)) {
                for (var i = el.length; i--; ) {
                    if (el[i].hasAttribute("selected")) {
                        el.selectedIndex = i;
                        break;
                    }
                }
            } else {
                el.value = el.defaultValue;

                if (el.type === "range") {
                    fill_output(el);
                }
            }
        }
    );
};

var load = function () {
    var fields = document.querySelectorAll(
            "input[name*=_], select[name*=_], textarea[name*=_]"
        ),
        i = fields.length,
        j,
        m,
        fld,
        fld_type,
        shosts,
        pref,
        prefs = {};

    while (i--) {
        fld = fields[i];

        if (fld.disabled || fld.readOnly) {
            continue;
        }

        pref = fld.name.split("_");

        if (!prefs[pref[0]]) {
            try {
                prefs[pref[0]] = JSON.parse(cfg[pref[0]] || "{}");
            } catch (ex) {
                prefs[pref[0]] = cfg[pref[0]];
            }
        }

        if (pref[0] === "tls" && pref[1] === "sendToHosts") {
            if (Array.isArray(prefs.tls[pref[1]])) {
                shosts = [];

                for (j = 0; j < prefs.tls[pref[1]].length; ++j) {
                    shosts.push(prefs.tls[pref[1]][j].join("|"));
                }

                fld.rows = shosts.length || 1;
                fld.value = fld.defValue = shosts.join("\n");
            }
        } else if (pref[0] === "grants") {
            shosts = [];
            m = prefs.grants;

            if (m && m.length) {
                for (j = 0; j < m.length; ++j) {
                    shosts.push(
                        m[j].op === ";"
                            ? ";" + m[j].txt
                            : m[j].op +
                                  (m[j].rules || m[j].opts || "") +
                                  ":" +
                                  m[j].url
                    );
                }
            }

            fld.value = fld.defValue = shosts.join("\n");
        } else if (pref[0] === "keys") {
            m = pref[1].replace("-", "_");

            if (prefs.keys[m] !== void 0) {
                fld.value = fld.defValue = prefs.keys[m];
            }
        } else {
            if (prefs[pref[0]] && prefs[pref[0]][pref[1]] !== void 0) {
                fld_type = fld.getAttribute("type") || "text";

                if (fld.type !== fld_type) {
                    fld_type = fld.type;
                }

                if (fld_type === "checkbox") {
                    if (pref[1] == "save") {
                        if (!!chrome.downloads)
                            fld = replaceSave(
                                fld,
                                prefs[pref[0]][pref[1]] || ""
                            );
                    } else
                        fld.checked = fld.defChecked =
                            !!prefs[pref[0]][pref[1]];
                } else {
                    fld.value = fld.defValue = prefs[pref[0]][pref[1]];

                    if (fld_type === "range") {
                        m = fld.previousElementSibling;

                        if (m && m.nodeName === "OUTPUT") {
                            fill_output(fld);
                        }

                        m = m.previousElementSibling;

                        if (m && m.getAttribute("type") === "color") {
                            m.style.opacity = fld.value;
                        }

                        fld.addEventListener("change", fill_output, false);
                    } else if (
                        fld_type === "text" &&
                        fld.previousElementSibling &&
                        fld.previousElementSibling.getAttribute("type") ===
                            "color"
                    ) {
                        fld.addEventListener("input", color_text_input, false);
                        color_text_input(fld);
                        fld.previousElementSibling.addEventListener(
                            "change",
                            color_change,
                            false
                        );
                    }
                }
            }
        }

        if (fld.type === "checkbox") {
            fld.defaultChecked = fld.checked;
        } else if (fld.nodeName.toUpperCase() === "SELECT") {
            for (j = 0; j < fld.length; ++j) {
                if (fld[j].value === fld.value) {
                    fld[j].setAttribute("selected", "");
                    break;
                }
            }
        } else {
            fld.defaultValue = fld.value;
        }
    }
};

var save = function () {
    var i, m, fld, fldType, host, shidx, shosts, pref;
    var fields = document.querySelectorAll(
        "input[name*=_], select[name*=_], textarea[name*=_]"
    );
    var prefs = {};
    var rgxNewLine = /[\r\n]+/;
    // rules ((?:[^,:]+,?\s*)+)?
    var rgxGrant = /^(?:(;.+)|([!~]{1,2}):(.+))/;

    if (SieveUI.loaded) {
        prefs.sieve = JSON.stringify(SieveUI.prepareRules());
        prefs.modlist = cfg.modlist;
    }

    for (i = 0; i < fields.length; ++i) {
        fld = fields[i];
        if (fld.readOnly) {
            continue;
        }

        pref = fld.name.split("_");

        if (!prefs[pref[0]]) {
            prefs[pref[0]] = {};
        }

        if (pref[0] === "tls" && pref[1] === "sendToHosts") {
            shosts = fld.value.trim().split(rgxNewLine);
            prefs.tls[pref[1]] = [];

            for (shidx = 0; shidx < shosts.length; ++shidx) {
                host = shosts[shidx].split("|");

                if (host.length === 2) {
                    prefs.tls[pref[1]].push(host);
                }
            }
        } else if (pref[0] === "grants") {
            prefs.grants = [];

            if (fld.value === "") {
                continue;
            }

            var grant;
            var grnts = fld.value.trim().split(rgxNewLine);

            if (!grnts.length) {
                continue;
            }

            for (shidx = 0; shidx < grnts.length; ++shidx) {
                if ((grant = rgxGrant.exec(grnts[shidx].trim()))) {
                    if (grant[1]) {
                        grant[1] = grant[1].trim();
                        host = { op: ";", txt: grant[1].substr(1) };
                    } else {
                        host = { op: grant[2], url: grant[3].trim() };
                    }

                    /*if (grant[3]) {
						if (host.op[0] === '@') {
							host.opts = {};
							var rgxOpt = /(?:(?:hz|keys|tls){(?:[\w-]+\s*:\s*(?:true|false|\d+|"[^"\\]*(?:\\.[^"\\]*)*"),?)+})/g;

							console.log(grant[2], rgxOpt.exec(grant[2]));
							//@@hz{zoomresized:0}{caption:true}:^https?://maps\.google\.
							/(@@?)((?:hz|keys|tls)\|(?:[\w\-]+:\s*(?:true|false|-?\d+(?:\.\d+)?|"[^"\\]*(?:\\.[^"\\]*)*");?)+)+:(.+)/
							return;
						} else {
							host.rules = grant[3].split(',');
						}
					}*/

                    prefs.grants.push(host);
                }
            }

            fld.value = prefs.grants
                .map(function (el) {
                    return el.op === ";"
                        ? ";" + el.txt
                        : el.op + (el.rules || el.opts || "") + ":" + el.url;
                })
                .join("\n");
        } else if (pref[0] === "keys") {
            m = pref[1].replace("-", "_");
            prefs.keys[m] = fld.value;
        } else if (prefs[pref[0]]) {
            fldType = fld.getAttribute("type");

            if (fldType === "checkbox") {
                prefs[pref[0]][pref[1]] = fld.checked;
            } else if (
                fldType === "range" ||
                fldType === "number" ||
                fld.classList.contains("number")
            ) {
                prefs[pref[0]][pref[1]] = fld.min
                    ? Math.max(
                          fld.min,
                          Math.min(fld.max, parseFloat(fld.value))
                      )
                    : parseFloat(fld.value);

                if (typeof prefs[pref[0]][pref[1]] !== "number") {
                    prefs[pref[0]][pref[1]] = parseFloat(fld.defaultValue);
                }

                fld.value = prefs[pref[0]][pref[1]];
            } else {
                prefs[pref[0]][pref[1]] = fld.value;
            }
        }
    }

    Port.send({ cmd: "savePrefs", prefs: prefs });
};

var download = function (data, filename, exportAsText) {
    var a = document.createElement("a");

    if (exportAsText || a.download === void 0 || !URL.createObjectURL) {
        Port.send({
            cmd: "open",
            url: "data:text/plain;charset=utf-8," + encodeURIComponent(data),
        });
        return;
    }

    var blobUrl = URL.createObjectURL(new Blob([data], { type: "text/plain" }));
    a.href = blobUrl;
    a.download = filename || "";
    a.dispatchEvent(new MouseEvent("click"));
    setTimeout(function () {
        URL.revokeObjectURL(blobUrl);
    }, 1e3);
};

var prefs = function (data, options, ev) {
    var i,
        pref_keys = ["hz", "keys", "tls", "grants"];

    if (typeof data === "object") {
        if (JSON.stringify(data) === "{}") {
            return false;
        }

        if ((options || {}).clear) {
            Port.send({ cmd: "cfg_del", keys: Object.keys(data) });
        }

        Port.send({ cmd: "savePrefs", prefs: data });
        location.reload(true);
        return;
    }

    data = {};

    for (i = 0; i < 5; ++i) {
        if (pref_keys[i] in cfg) {
            data[pref_keys[i]] = cfg[pref_keys[i]];
        }
    }

    download(
        JSON.stringify(data, null, ev.shiftKey ? 2 : 0),
        app.name + "-conf.json",
        ev.ctrlKey
    );
};

window.onhashchange = function () {
    var section,
        args = [],
        menu = $("nav_menu"),
        old = (menu && menu.active && menu.active.hash.slice(1)) || "settings",
        hash = location.hash.slice(1) || "settings";

    if (hash.indexOf("/") > -1) {
        args = hash.split("/");
        hash = args.shift();
    }

    section = $(hash + "_sec") || $("settings_sec");

    if (!section.lng_loaded) {
        if (hash === "sieve") {
            Port.listen(function (d) {
                Port.listen(null);

                d = d.data || d;
                cfg.sieve = d.cfg.sieve;
                cfg.modlist = d.cfg.modlist;
                SieveUI.load();
                $("sieve_search").focus();
            });
            Port.send({ cmd: "cfg_get", keys: ["sieve", "modlist"] });
        } else if (hash === "grants") {
            section.querySelector(".action_buttons").onclick = function (e) {
                if (e.target.textContent === "≡") {
                    $("grants_help").style.display =
                        $("grants_help").style.display === "block"
                            ? "none"
                            : "block";
                }
            };
        } else if (hash === "info") {
            if (args[0]) {
                $(
                    args[0] === "0" ? "app_installed" : "app_updated"
                ).style.display = "block";
            }

            section.querySelector("h3:not([data-lng])").textContent =
                " v" + app.version;

            Port.listen(function (response) {
                Port.listen(null);

                var alpha2,
                    td2,
                    locales = [];
                var lng_map = function (el, idx) {
                    el.name =
                        (el.name || el.fullname || "") +
                            (el.fullname && el.name
                                ? " (" + el.fullname + ")"
                                : "") ||
                        el.email ||
                        el.web;

                    if (idx) {
                        td2.nodes.push(", ");
                    }

                    td2.nodes.push(
                        el.email || el.web
                            ? {
                                  tag: "a",
                                  attrs: {
                                      href: el.email
                                          ? "mailto:" + el.email
                                          : el.web,
                                  },
                                  text: el.name,
                              }
                            : el.name
                    );
                };

                var locales_json = JSON.parse(response);

                for (alpha2 in locales_json) {
                    if (alpha2 === "_") {
                        continue;
                    }

                    td2 = { tag: "td" };

                    locales.push({
                        tag: "tr",
                        nodes: [
                            {
                                tag: "td",
                                attrs: locales_json[alpha2]["%"]
                                    ? { title: locales_json[alpha2]["%"] + "%" }
                                    : null,
                                text: alpha2 + ", " + locales_json[alpha2].name,
                            },
                            td2,
                        ],
                    });

                    if (locales_json[alpha2].translators) {
                        td2.nodes = [];
                        locales_json[alpha2].translators.forEach(lng_map);
                    } else {
                        td2.text = "anonymous";
                    }
                }

                buildNodes($("locales_table"), locales);
            });
            Port.send({ cmd: "getLocaleList" });
        }
    }

    if (old !== hash && (old = $(old + "_sec"))) {
        old.style.display = "none";
    }

    if (section) {
        processLNG([section]);
        section.style.display = "block";
    }

    if (menu.active) {
        menu.active.classList.remove("active");
    }

    if ((menu.active = menu.querySelector('a[href="#' + hash + '"]'))) {
        menu.active.classList.add("active");
    }
};

window.addEventListener(
    "load",
    function () {
        var tmp = $("app_version");
        tmp.textContent = app.name + " v" + app.version;

        ["opera", "firefox", "chrome", "safari", "maxthon"].some(function (el) {
            if (platform[el]) {
                document.body.classList.add(el);
                return true;
            }

            return false;
        });

        var menu = $("nav_menu");

        processLNG([menu, $("right_panel").firstElementChild]);

        if (
            (tmp = document.querySelectorAll(
                'input[type="color"] + output + input[type="range"], textarea[name="tls_sendToHosts"], textarea[name*="hz_ext]'
            ))
        ) {
            var range_onchange = function () {
                this.parentNode.firstElementChild.style.opacity = this.value;
            };

            [].forEach.call(tmp, function (el) {
                if (el.nodeName === "TEXTAREA") {
                    el.oninput = function () {
                        this.rows = Math.min(
                            (this.value.match(/(?:\n|\r\n?)/g) || []).length +
                                1,
                            10
                        );
                    };
                } else {
                    el.onchange = range_onchange;
                }
            });
        }

        menu.onclick = function (e) {
            if (e.target.hash) {
                e.preventDefault();
                location.hash = e.target.hash;
            }
        };

        document.forms[0].addEventListener(
            "keydown",
            function (e) {
                if (
                    e.repeat ||
                    !e.target.name ||
                    e.target.name.indexOf("keys_") !== 0 ||
                    e.key == "Meta" ||
                    e.key == "OS"
                ) {
                    return;
                }

                e.stopPropagation();
                e.preventDefault();

                color_trans(e.target, null);
                var hotkey = parseHotkey(e, $("hz_numpad").checked);
                var del_key = $("keys_del");
                var keys = document.body.querySelectorAll(
                    'input[name^="keys_"]'
                );
                if (hotkey === del_key.value) {
                    hotkey = "";
                } else {
                    for (var i = 0; i < keys.length; ++i) {
                        if (keys[i].value !== hotkey) {
                            continue;
                        }

                        if (e.target !== keys[i]) {
                            color_trans(e.target, "red");
                        }

                        return false;
                    }
                }

                e.target.value = hotkey;

                hotkey = "";
                document.forms[0].onchange(e);
            },
            false
        );

        document.forms[0].addEventListener(
            "contextmenu",
            function (e) {
                e.stopPropagation();
                var t = e.target;

                if (t.classList.contains("checkbox")) {
                    t = t.previousElementSibling;
                }

                if (!t.name || t.name.indexOf("_") === -1) {
                    return;
                }

                if (e.ctrlKey) {
                    e.preventDefault();
                    setDefault(t);
                    document.forms[0].onchange({ target: t });
                } else if (e.shiftKey && t.name.indexOf("_") > -1) {
                    e.preventDefault();
                    t = t.name.split("_");
                    e = {};
                    t[2] = JSON.parse(cfg[t[0]]);

                    if (t[1]) {
                        e[t[0]] = {};
                        e[t[0]][t[1]] = t[2][t[1]];
                    } else {
                        e[t[0]] = t[2];
                    }

                    alert(JSON.stringify(e));
                }
            },
            false
        );

        // leave it callable
        document.forms[0].onchange = function (e) {
            if (e.stopPropagation) {
                e.stopPropagation();
            }

            var defval,
                t = e.target;

            if (t.form_saved) {
                delete t.form_saved;
            } else if (
                t.parentNode.dataset["form"] ||
                t.parentNode.parentNode.dataset["form"]
            ) {
                defval = "default";
            } else if (t.name.indexOf("_") > 0) {
                defval = "def";
            }

            if (!defval) {
                return;
            }
            if (t.id === "hz_settingsCSS") {
                document.querySelectorAll("link")[1].href =
                    "./css/" + t.value + ".css";
                return;
            }
            if (
                (t.type === "checkbox" &&
                    t[defval + "Checked"] !== t.checked) ||
                (t.type !== "checkbox" && t[defval + "Value"] != t.value)
                // != is not a mistake
            ) {
                if (t.checked == true) {
                    if (t.name == "hz_history") {
                        chrome.permissions.request(
                            {
                                permissions: ["history"],
                            },
                            (response) => {
                                if (response == true) {
                                    t.checked = true;
                                    input_changes[t.name] = true;
                                } else t.checked = false;
                            }
                        );
                    } else if (t.name == "hz_save") {
                        chrome.permissions.request(
                            {
                                permissions: ["downloads"],
                            },
                            (response) => {
                                if (response == true) {
                                    replaceSave(t, "");
                                    save();
                                } else t.checked = false;
                            }
                        );
                    } else input_changes[t.name] = true;
                } else input_changes[t.name] = true;
            } else delete input_changes[t.name];

            $("save_button").style.color = Object.keys(input_changes).length
                ? "#e03c00"
                : "";
        };

        var reset_button = $("reset_button");

        reset_button.reset = function () {
            delete reset_button.pending;
            reset_button.style.color = "#000";
        };

        reset_button.addEventListener(
            "click",
            function (e) {
                if (reset_button.pending) {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        e = ["", "input,", "select,", "textarea"];
                        setDefault(
                            e.join((location.hash || "#settings") + "_sec ")
                        );
                        e = "lime";
                    } else {
                        e = "green";
                    }

                    clearTimeout(reset_button.pending);
                    reset_button.pending = setTimeout(reset_button.reset, 2000);
                    reset_button.style.color = e;
                    reset_button.nextElementSibling.style.color = "#e03c00";
                    input_changes["form_reset"] = true;

                    // it should happen after the reset, so delay it a bit
                    setTimeout(function () {
                        // the value of output elements would be cleared on reset
                        [].forEach.call(
                            document.querySelectorAll(
                                'output + input[type="range"]'
                            ) || [],
                            fill_output
                        );
                    }, 0xf);

                    return;
                }

                reset_button.style.color = "orange";
                reset_button.pending = setTimeout(reset_button.reset, 2000);
                e.preventDefault();
            },
            false
        );

        $("save_button").addEventListener(
            "click",
            function (e) {
                e.preventDefault();
                if (
                    !document.querySelector(".normal") ||
                    document.querySelector(".normal").reportValidity()
                ) {
                    save();
                    color_trans(this, "green");
                }
            },
            false
        );

        $("import").onclick = () =>
            ImprtHandler(_("SC_PREFS"), prefs, {
                overwrite: 1,
            });

        $("export").onclick = (e) => prefs(0, 0, e);

        [].forEach.call(
            document.body.querySelectorAll(".action_buttons") || [],
            function (el) {
                el.onmousedown = function (e) {
                    e.preventDefault();
                };
            }
        );
        Port.listen(function (d) {
            if (!d || !d.cfg) {
                return;
            }

            Port.listen(null);
            cfg = d.cfg;
            document.querySelectorAll("link")[1].href =
                "./css/" + cfg.hz.settingsCSS + ".css";
            load();
            window.onhashchange();

            var advanced_prefs = $("tls_advanced");
            advanced_prefs.onchange = function () {
                document.body.classList[this.checked ? "add" : "remove"](
                    "advanced"
                );
            };

            advanced_prefs.onchange();

            document.body.style.display = "block";
        });
        Port.send({ cmd: "cfg_get", keys: ["hz", "keys", "tls", "grants"] });
    },
    false
);
