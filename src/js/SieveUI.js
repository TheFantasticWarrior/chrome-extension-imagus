/* global buildNodes, color_trans, ImprtHandler, cfg, _, $, Port, app, download */
"use strict";

var sieve_sec,
    sieve_container,
    SieveUI = {
        loaded: false,
        lastClicked: null,
        lastXY: [],
        cntr: 0,
        sieve: {},
        k: 0,
        init: function () {
            this.loaded = true;
            this.search_f = document.getElementById("sieve_search");
            this.info_container = sieve_sec.querySelector(".container_info");
            this.countRules();

            this.search_f.onkeydown = function (e) {
                clearTimeout(this.timer);

                if (e.keyCode === 27) {
                    this.value = "";
                    SieveUI.search();
                    e.preventDefault();
                    return;
                } else if (e.keyCode === 13) {
                    e.preventDefault();
                    SieveUI.search();

                    var visibles = document.querySelectorAll(
                        "#sieve_container > div:not(.hidden)"
                    );

                    if (visibles.length === 1) {
                        visibles[0].classList.toggle("opened");

                        if (!visibles[0].lastElementChild.textContent) {
                            SieveUI.genData(visibles[0]);
                        }
                    }

                    return;
                }

                this.timer = setTimeout(SieveUI.search, 200);
            };

            sieve_container.onkeydown = function (e) {
                e.stopPropagation();
                var rname,
                    t = e.target;

                if (t.nodeName !== "SPAN") {
                    return;
                }

                if (e.keyCode === 27 || e.keyCode === 13) {
                    e.preventDefault();

                    rname = t.textContent.trim();

                    if (
                        e.keyCode === 27 &&
                        rname === "" &&
                        t.nextElementSibling.textContent &&
                        [].every.call(
                            t.parentNode.querySelectorAll(
                                'input[type="text"], textarea'
                            ),
                            function (el) {
                                return el.value.trim() === "";
                            }
                        )
                    ) {
                        t.parentNode.parentNode.removeChild(t.parentNode);

                        SieveUI.countRules();
                    } else if (t.textContent) {
                        rname = rname.replace(/[\s,]+/g, "_").substr(0, 50);

                        if (t.parentNode.rule !== rname) {
                            if (SieveUI.sieve[rname]) {
                                color_trans(t, "red");
                                return;
                            }

                            if (
                                t.parentNode.rule &&
                                SieveUI.sieve[t.parentNode.rule]
                            ) {
                                SieveUI.sieve[rname] =
                                    SieveUI.sieve[t.parentNode.rule];
                                delete SieveUI.sieve[t.parentNode.rule];
                            }
                        }

                        t.textContent = t.parentNode.rule = rname;
                        t.contentEditable = false;
                        t.className = "";

                        if (e.keyCode === 13) {
                            t =
                                t.parentNode.querySelector(
                                    'input[type="text"]'
                                );

                            if (t) {
                                t.focus();
                            }
                        }
                    }
                }
            };

            sieve_container.onmousedown = SieveUI.move;
            sieve_container.onclick = SieveUI.click;
            sieve_container.oncontextmenu = SieveUI.rename_del;

            sieve_sec.querySelector(".action_buttons").onclick = function (e) {
                switch (e.target.textContent) {
                    case "●":
                        SieveUI.select("add");
                        break;
                    case "○":
                        SieveUI.select("remove");
                        break;
                    case "◐":
                        SieveUI.select("toggle");
                        break;
                    case "~":
                        SieveUI.keep();
                        break;
                    case "+":
                        SieveUI.add();
                        break;
                    case "-":
                        SieveUI.remove();
                        break;
                    case "Ø":
                        SieveUI.disable();
                        break;
                    case "↓":
                        ImprtHandler(_("NAV_SIEVE"), SieveUI.load);
                        break;
                    case "↑":
                        SieveUI.exprt(e);
                        break;
                    case "⇓":
                        SieveUI.update();
                        break;
                    case "≡":
                        var s = $("sieve_tips").style;
                        s.display = s.display === "none" ? "block" : "none";
                        break;
                }
            };
        },
        load: function (local_sieve, options) {
            if (!local_sieve && SieveUI.loaded) {
                return;
            }

            try {
                var ignored_rules, name, rule, sfrag, visible_rules, i;

                sieve_sec = $("sieve_sec");
                sieve_container = $("sieve_container");

                if (local_sieve) {
                    ignored_rules = [];
                } else {
                    local_sieve = cfg.sieve || {};
                }

                if (options && options.clear) {
                    sieve_container.textContent = "";
                }

                if (Object.keys(local_sieve).length) {
                    sfrag = document.createDocumentFragment();
                    visible_rules = {};
                    i = sieve_container.childElementCount;

                    while (i--) {
                        rule = sieve_container.children[i];

                        if (rule.rule) {
                            visible_rules[rule.rule] = rule;
                        }
                    }

                    for (name in local_sieve) {
                        if (
                            visible_rules[name] &&
                            options &&
                            !options.overwrite
                        ) {
                            ignored_rules.push(name);
                            continue;
                        }

                        rule = SieveUI.genEntry(name, local_sieve[name]);

                        if (visible_rules[name]) {
                            if (
                                visible_rules[name].classList.contains("opened")
                            ) {
                                rule.classList.add("opened");
                            }

                            sieve_container.replaceChild(
                                rule,
                                visible_rules[name]
                            );
                        } else {
                            sfrag.appendChild(rule);
                        }
                    }

                    if (sfrag.childNodes.length) {
                        if (sieve_container.firstElementChild) {
                            sieve_container.insertBefore(
                                sfrag,
                                sieve_container.firstElementChild
                            );
                        } else {
                            sieve_container.appendChild(sfrag);
                        }
                    }
                }

                if (SieveUI.loaded) {
                    SieveUI.countRules();
                    SieveUI.sieve = SieveUI.prepareRules();
                } else {
                    SieveUI.sieve = local_sieve;
                }

                if (ignored_rules && ignored_rules.length) {
                    console.log(app.name, "Ignored rules:", ignored_rules);
                }
            } catch (ex) {
                console.error(ex);
            }

            if (!SieveUI.loaded) {
                SieveUI.init();
            }
        },
        compare: function (d, full) {
            var rule, r;
            for (rule in d) {
                r = this.genEntry(rule, d[rule].old);
                r.classList.add("opened");
                sieve_container.appendChild(r);
                r = this.genEntry(rule, d[rule].new);
                r.classList.add("opened");
                sieve_container.appendChild(r);
            }
            $("save_button").onclick = function (e) {
                $("save_button").removeAttribute("onclick");
                e.preventDefault();
                var newSieve = SieveUI.prepareRules();
                for (rule in newSieve) {
                    full[rule] = newSieve[rule];
                }

                sieve_container.textContent = "";
                SieveUI.load(full);
                save();
                color_trans(this, "green");
            };
        },
        prepareRules: function (ignore_dupes) {
            var i,
                j,
                params,
                param,
                rule,
                opt_name,
                rgxWhitespace = /\s+/g,
                output = {},
                dupes = [],
                rules = sieve_sec.querySelectorAll("#sieve_container > div"),
                some_func = function (el) {
                    return el.value.trim() !== "";
                };

            for (i = 0; i < rules.length; ++i) {
                rule = rules[i].firstElementChild;
                opt_name = rule.textContent.trim().replace(rgxWhitespace, " ");
                rule.textContent = opt_name;

                if (
                    !opt_name &&
                    (!rule.nextElementSibling.textContent ||
                        [].some.call(
                            rules[i].querySelectorAll(
                                'input[type="text"], textarea'
                            ),
                            some_func
                        ))
                ) {
                    alert(_("SIV_ERR_EMPTYNAME"));
                    rule.contentEditable = true;
                    rule.focus();
                    return null;
                }

                if (!ignore_dupes && output[opt_name]) {
                    dupes.push(opt_name.replace(/[[\]{}()*+?.\\^$|]/g, "\\$&"));
                }

                output[opt_name] = true;
            }

            if (!ignore_dupes && dupes.length) {
                alert(_("SIV_ERR_DUPENAME"));
                SieveUI.search_f.value = dupes
                    .filter(function (el, idx, s) {
                        return s.indexOf(el, idx + 1) < 0;
                    })
                    .join("|");
                SieveUI.search();
                return null;
            }

            output = {};

            for (i = 0; i < rules.length; ++i) {
                opt_name = rules[i].firstElementChild.textContent;

                if (!opt_name) {
                    continue;
                }

                output[opt_name] = {};
                rule = output[opt_name];

                if (rules[i].classList.contains("disabled")) {
                    rule.off = 1;
                }

                params = rules[i].querySelectorAll("input, textarea");

                if (!params.length) {
                    if (SieveUI.sieve[rules[i].rule]) {
                        rule = SieveUI.sieve[rules[i].rule];

                        if (rules[i].classList.contains("disabled")) {
                            rule.off = 1;
                        } else {
                            delete rule.off;
                        }

                        output[opt_name] = rule;

                        if (rules[i].rule === opt_name) {
                            rules[i].rule = opt_name;
                        }
                    }

                    continue;
                }

                for (j = 0; j < params.length; ++j) {
                    param = params[j].name.substr(
                        0,
                        params[j].name.indexOf("[")
                    );

                    switch (param) {
                        case "useimg":
                            if (params[j].checked) {
                                rule[param] = 1;
                            }
                            break;

                        case "note":
                            params[j].value = params[j].value.trim();
                        /* falls through */
                        case "link":
                        case "url":
                        case "res":
                        case "img":
                        case "to":
                            if (params[j].value !== "") {
                                rule[param] = params[j].value.replace(
                                    /\r\n?/g,
                                    "\n"
                                );
                            }
                            break;

                        case "link_ci":
                        case "img_ci":
                        case "link_dc":
                        case "img_dc":
                        case "link_loop":
                        case "img_loop":
                            opt_name = param.split("_");
                            param = opt_name[1];
                            opt_name = opt_name[0];

                            if (rule[opt_name] && params[j].checked) {
                                opt_name =
                                    (rule[param] || 0) |
                                    (opt_name === "link" ? 1 : 2);

                                if (opt_name) {
                                    rule[param] = opt_name;
                                }
                            }
                            break;
                    }
                }
            }

            return output;
        },
        countRules: function (msg) {
            var count = (
                sieve_sec.querySelectorAll(
                    "#sieve_container > div:not(.hidden)"
                ) || []
            ).length;

            $("sieve_count").textContent = count;

            if (count) {
                this.info_container.style.display = "none";
            } else {
                this.info_container.textContent = _(
                    msg || (this.search_f.value.trim() ? "NOMATCH" : "EMPTY")
                );
                this.info_container.style.display = "block";
            }
        },
        genData: function (container, data) {
            ++this.cntr;
            var vals = container.lastChild,
                c = "[" + this.cntr + "]",
                sd = data || this.sieve[container.rule] || {};

            buildNodes(vals, [
                {
                    tag: "label",
                    nodes: [
                        {
                            tag: "input",
                            attrs: { type: "checkbox", name: "useimg" },
                        },
                        { tag: "label", attrs: { class: "checkbox" } },
                        " " + _("SIV_USEIMG"),
                    ],
                },
                " ",
                {
                    tag: "input",
                    attrs: {
                        type: "text",
                        name: "link",
                        placeholder: "link",
                        class: "sieve_shorter_inp",
                    },
                },
                {
                    tag: "input",
                    attrs: { type: "checkbox", id: "link_ci", name: "link_ci" },
                },
                { tag: "label", attrs: { class: "checkbox" } },
                {
                    tag: "input",
                    attrs: { type: "checkbox", id: "link_dc", name: "link_dc" },
                },
                { tag: "label", attrs: { class: "checkbox" } },
                {
                    tag: "input",
                    attrs: {
                        type: "checkbox",
                        id: "link_loop",
                        name: "link_loop",
                    },
                },
                { tag: "label", attrs: { class: "checkbox" } },
                {
                    tag: "input",
                    attrs: { type: "text", name: "url", placeholder: "url" },
                },
                { tag: "textarea", attrs: { name: "res", placeholder: "res" } },
                {
                    tag: "input",
                    attrs: {
                        type: "text",
                        name: "img",
                        placeholder: "img",
                        class: "sieve_shorter_inp",
                    },
                },
                {
                    tag: "input",
                    attrs: { type: "checkbox", id: "img_ci", name: "img_ci" },
                },
                { tag: "label", attrs: { class: "checkbox" } },
                {
                    tag: "input",
                    attrs: { type: "checkbox", id: "img_dc", name: "img_dc" },
                },
                { tag: "label", attrs: { class: "checkbox" } },
                {
                    tag: "input",
                    attrs: {
                        type: "checkbox",
                        id: "img_loop",
                        name: "img_loop",
                    },
                },
                { tag: "label", attrs: { class: "checkbox" } },
                { tag: "textarea", attrs: { name: "to", placeholder: "to" } },
                {
                    tag: "textarea",
                    attrs: { name: "note", placeholder: "note" },
                },
            ]);

            vals = vals.querySelectorAll("input, textarea");

            for (var inp_name, i = 0; i < vals.length; ++i) {
                if (vals[i].id) {
                    inp_name = vals[i].id.split("_");
                    vals[i].defaultChecked = vals[i].checked =
                        sd[inp_name[1]] &&
                        sd[inp_name[1]] & (inp_name[0] === "img" ? 2 : 1);

                    vals[i].id += c;
                    vals[i].nextSibling.setAttribute("for", vals[i].id);
                    vals[i].nextSibling.title = _(
                        "SIV_" + inp_name[1].toUpperCase()
                    );
                }

                if (vals[i].name) {
                    if (sd[vals[i].name]) {
                        if (vals[i].type === "checkbox") {
                            vals[i].defaultChecked = vals[i].checked =
                                !!sd[vals[i].name];
                        } else {
                            vals[i].defaultValue = vals[i].value =
                                sd[vals[i].name] || "";
                        }
                    }

                    vals[i].name += c;
                }
            }
        },
        genEntry: function (name, data) {
            var container = document.createElement("div");

            if (data && data.off) {
                container.classList.add("disabled");
            }

            container.rule = name;
            buildNodes(container, [
                { tag: "span" },
                { tag: "div", attrs: { "data-form": "1" } },
            ]);

            if (name) {
                container.firstChild.textContent = name;
            }

            if (this.loaded) {
                this.genData(container, data);
            }

            return container;
        },
        keep: function () {
            var i = 0,
                list = sieve_container.querySelectorAll("div.selected");

            if (list.length) {
                for (; i < list.length; ++i) {
                    var index = cfg.modlist.indexOf(
                        list[i].firstElementChild.textContent
                    );
                    if (index !== -1) {
                        cfg.modlist.splice(index, 1);
                        if (this.k) {
                            list[i].classList.add("hidden");
                            list[i].classList.remove("selected");
                        }
                    } else {
                        cfg.modlist.push(list[i].firstElementChild.textContent);
                    }
                }
                $("save_button").style.color = "#e03c00";
            } else {
                (list = sieve_container.children), (i = list.length);

                while (i--) {
                    if (list[i].firstElementChild.textContent) {
                        list[i].classList[
                            cfg.modlist.indexOf(
                                list[i].firstElementChild.textContent
                            ) != -1 || this.k
                                ? "remove"
                                : "add"
                        ]("hidden");
                    }
                }
                this.k = this.k ? 0 : 1;
            }

            this.countRules();
        },
        add: function () {
            sieve_container.insertBefore(
                this.genEntry(),
                sieve_container.firstElementChild
            );

            var rd = sieve_container.firstElementChild,
                rd_fc = rd.firstElementChild;
            rd_fc.contentEditable = true;
            rd_fc.className = "focus";
            rd.className = "opened";
            rd_fc.focus();
            $("save_button").style.color = "#e03c00";
            this.countRules();
        },
        select: function (type, i, until) {
            var cl;

            i = i || 0;
            until = until || sieve_container.childElementCount;

            for (; i < until; ++i) {
                cl = sieve_container.children[i].classList;

                if (!cl.contains("hidden")) {
                    cl[type]("selected");
                }
            }
        },
        click: function (e) {
            e.stopPropagation();

            if (e.target.nodeName !== "SPAN") {
                return;
            }

            if (e.button === 0) {
                var child, currentIndex;

                if (e.shiftKey && SieveUI.lastClicked !== null) {
                    child = e.target.parentNode;
                    currentIndex = 0;

                    while ((child = child.previousElementSibling)) {
                        currentIndex++;
                    }

                    SieveUI.select(
                        sieve_container.children[
                            SieveUI.lastClicked
                        ].classList.contains("selected")
                            ? "add"
                            : "remove",
                        Math.min(SieveUI.lastClicked, currentIndex),
                        Math.max(SieveUI.lastClicked, currentIndex) + 1
                    );
                } else if (e.ctrlKey || e.metaKey) {
                    SieveUI.lastClicked = 0;
                    child = e.target.parentNode;

                    while ((child = child.previousElementSibling)) {
                        SieveUI.lastClicked++;
                    }

                    e.target.parentNode.classList.toggle("selected");
                    e.preventDefault();
                } else if (
                    !e.target.isContentEditable &&
                    // the cursor still can be moved back to its starting position
                    Math.abs(SieveUI.lastXY[0] - e.clientX) < 4 &&
                    Math.abs(SieveUI.lastXY[1] - e.clientY) < 4
                ) {
                    e.target.parentNode.classList.toggle("opened");

                    if (!e.target.nextElementSibling.textContent) {
                        SieveUI.genData(e.target.parentNode);
                    }
                }
            }
        },
        move: function (e) {
            e.stopPropagation();
            SieveUI.lastXY = [e.clientX, e.clientY];

            var div = e.target.parentNode,
                i,
                list;

            if (
                e.target.isContentEditable ||
                e.target.nodeName !== "SPAN" ||
                div.classList.contains("opened") ||
                e.button !== 0
            ) {
                return;
            }

            e.preventDefault();

            document.onmousemove = function (e) {
                if (
                    Math.abs(SieveUI.lastXY[0] - e.clientX) < 4 &&
                    Math.abs(SieveUI.lastXY[1] - e.clientY) < 4
                ) {
                    return;
                }

                div.style.cssText =
                    "left:" +
                    (e.clientX + 15) +
                    "px;" +
                    "top:" +
                    (e.clientY + 15) +
                    "px";

                if (div.classList.contains("move")) {
                    return;
                }

                div.classList.add("move");

                list = sieve_container.querySelectorAll(
                    (div.classList.contains("selected") ? ".selected, " : "") +
                        ".move"
                );

                for (i = 0; i < list.length; ++i) {
                    if (div !== list[i]) {
                        list[i].classList.add("move_multi");
                    }
                }
            };

            document.onmouseup = function (e) {
                if (
                    div.classList.contains("move") &&
                    e.target.parentNode.rule
                ) {
                    var dcfr = document.createDocumentFragment();

                    for (i = 0; i < list.length; ++i) {
                        sieve_container.removeChild(list[i]);
                        dcfr.appendChild(list[i]);
                    }

                    sieve_container.insertBefore(dcfr, e.target.parentNode);
                    $("save_button").style.color = "#e03c00";
                }

                div.classList.remove("move");
                list = sieve_container.querySelectorAll(".move_multi");

                for (i = 0; i < list.length; ++i) {
                    list[i].classList.remove("move_multi");
                }

                sieve_container.onmouseover =
                    document.onmouseup =
                    document.onmousemove =
                        null;
            };
        },
        exprt: function (e) {
            if (!sieve_container.childElementCount) {
                return;
            }

            var i,
                list = sieve_container.querySelectorAll("div.selected"),
                sieve = SieveUI.prepareRules(true),
                exp = {};

            if (!sieve) {
                return;
            }

            if (list.length) {
                for (i = 0; i < list.length; ++i) {
                    exp[list[i].rule] = sieve[list[i].rule];
                }
            } else {
                exp = sieve;
            }

            if (
                (exp = JSON.stringify(exp, null, e.shiftKey ? 2 : 0)) !== "{}"
            ) {
                download(exp, app.name + "-sieve.json", e.ctrlKey);
            }
        },
        disable: function () {
            var i = sieve_container.childElementCount,
                list = sieve_container.querySelectorAll("div.selected").length,
                cn = sieve_container.children;

            if (i) $("save_button").style.color = "#e03c00";
            while (i--) {
                if (!list || cn[i].classList.contains("selected")) {
                    cn[i].classList.toggle("disabled");
                    var index = cfg.modlist.indexOf(cn[i].innerText);
                    if (index !== -1) {
                        cfg.modlist.splice(index, 1);
                    } else {
                        cfg.modlist.push(cn[i].innerText);
                    }
                }
            }
        },
        remove: function () {
            if (!confirm(_("DELITEMS"))) {
                return;
            }

            var i = 0,
                list = sieve_container.querySelectorAll("div.selected");

            if (list.length) {
                for (; i < list.length; ++i) {
                    sieve_container.removeChild(list[i]);
                    var index = cfg.modlist.indexOf(
                        list[i].firstElementChild.textContent
                    );
                    if (index !== -1) {
                        cfg.modlist.splice(index, 1);
                    }
                }
                $("save_button").style.color = "#e03c00";
            } else {
                sieve_container.textContent = "";
                cfg.modlist = [];
                $("save_button").click();
            }

            this.countRules();
        },
        rename_del: function (e) {
            e.stopPropagation();

            if (e.target.nodeName !== "SPAN") {
                return;
            }

            if (!e.ctrlKey) {
                e.preventDefault();
                e = e.target;
                e.textContent = e.textContent.trim();
                e.contentEditable = !e.isContentEditable;
                e.className = e.isContentEditable ? "focus" : "";

                if (e.contentEditable) {
                    e.focus();
                }
            } else {
                e.preventDefault();

                if (confirm(_("AREYOUSURE"))) {
                    e = e.target.parentNode;
                    e.parentNode.removeChild(e);
                    SieveUI.countRules();
                }
            }
        },
        search: function () {
            var what = RegExp(SieveUI.search_f.value.trim() || ".", "i"),
                list = sieve_container.children,
                i = list.length;

            while (i--) {
                if (list[i].firstElementChild.textContent) {
                    list[i].classList[
                        what.test(list[i].firstElementChild.textContent)
                            ? "remove"
                            : "add"
                    ]("hidden");
                }
            }

            SieveUI.countRules();
        },
        update: function () {
            if (
                !cfg.sieve ||
                !Object.keys(cfg.sieve).length ||
                !$("hz_sievekeepadv").checked ||
                confirm(_("SIV_UPDALERT"))
            ) {
                Port.listen(function (d) {
                    Port.listen(null);

                    if (
                        $("hz_sievekeepadv").checked &&
                        Object.keys((d.data || d).resolving).length
                    ) {
                        SieveUI.compare(
                            (d.data || d).resolving,
                            (d.data || d).updated
                        );
                    } else {
                        SieveUI.load((d.data || d).updated);

                        //save();
                        //color_trans($("save_button"), "green");
                    }
                });

                Port.send({ cmd: "update_sieve" });
                sieve_container.textContent = "";
                SieveUI.countRules("LOADING");

                $("save_button").style.color = "#e03c00";
            }
        },
    };
