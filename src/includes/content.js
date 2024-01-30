/* global buildNodes, platform, app, Port, cfg:true */

"use strict";

(function (win, doc) {
    if (win.location.protocol === "safari-extension:") {
        return;
    }

    if (!doc || doc instanceof win.HTMLDocument === false) {
        return;
    }

    var imgDoc = doc.images && doc.images.length === 1 && doc.images[0];

    if (
        imgDoc &&
        imgDoc.parentNode === doc.body &&
        imgDoc.src === win.location.href
    ) {
        return;
    }

    var flip = function (el, ori) {
        if (!el.scale) {
            el.scale = { h: 1, v: 1 };
        }

        el.scale[ori ? "h" : "v"] *= -1;
        ori =
            el.scale.h !== 1 || el.scale.v !== 1
                ? "scale(" + el.scale.h + "," + el.scale.v + ")"
                : "";

        if (el.curdeg) {
            ori += " rotate(" + el.curdeg + "deg)";
        }

        el.style[platform["transform"]] = ori;
    };

    var pdsp = function (e, d, p) {
        if (!e || !e.preventDefault || !e.stopPropagation) {
            return;
        }

        if (d === void 0 || d === true) {
            e.preventDefault();
        }

        if (p !== false) {
            e.stopImmediatePropagation();
        }
    };

    var imageSendTo = function (sf) {
        if (
            (!sf.url && !sf.name && !sf.url) ||
            (sf.url && !/^http/.test(sf.url))
        ) {
            alert("Invalid URL! (" + sf.url.slice(0, sf.url.indexOf(":") + 1));
            return;
        }

        var i = 0;
        var urls = [];
        var hosts = cfg.tls.sendToHosts;

        for (; i < hosts.length; ++i) {
            if (
                sf.host === i ||
                (sf.host === void 0 && hosts[i][0][0] === "+")
            ) {
                urls.push(
                    hosts[i][1]
                        .replace("%url", encodeURIComponent(sf.url))
                        .replace("%raw_url", sf.url)
                );
            }
        }

        Port.send({
            cmd: "open",
            url: urls,
            nf: !!sf.nf,
        });
    };

    var checkBG = function (imgs) {
        if (imgs) {
            if (
                Array.isArray(
                    (imgs = imgs.match(
                        /\burl\(([^'"\)][^\)]*|"[^"\\]+(?:\\.[^"\\]*)*|'[^'\\]+(?:\\.[^'\\]*)*)(?=['"]?\))/g
                    ))
                )
            ) {
                var i = imgs.length;

                while (i--) {
                    imgs[i] = imgs[i].slice(/'|"/.test(imgs[i][4]) ? 5 : 4);
                }

                return imgs;
            }
        }

        return null;
    };

    var checkIMG = function (node) {
        var nname = node.nodeName.toUpperCase();

        if (nname === "IMG" || node.type === "image" || nname === "EMBED") {
            return node.src;
        } else if (nname === "CANVAS") {
            return node.toDataURL();
        } else if (nname === "OBJECT" && node.data) {
            return node.data;
        } else if (nname === "AREA") {
            var img = doc.querySelector(
                'img[usemap="#' + node.parentNode.name + '"]'
            );
            return img.src;
        } else if (nname === "VIDEO") {
            nname = doc.createElement("canvas");
            nname.width = node.clientWidth;
            nname.height = node.clientHeight;
            nname
                .getContext("2d")
                .drawImage(node, 0, 0, nname.width, nname.height);
            return nname.toDataURL("image/jpeg");
        } else if (node.poster) {
            return node.poster;
        }

        return null;
    };

    var mdownstart, winW, winH, topWinW, topWinH;
    var rgxHash = /#(?![?!].).*/;
    var rgxIsSVG = /\.svgz?$/i;

    var viewportDimensions = function (targetDoc) {
        var d = targetDoc || doc;
        d = (d.compatMode === "BackCompat" && d.body) || d.documentElement;
        var w = d.clientWidth;
        var h = d.clientHeight;

        if (targetDoc) {
            return { width: w, height: h };
        }

        if (w === winW && h === winH) {
            return;
        }

        winW = w;
        winH = h;
        topWinW = w;
        topWinH = h;
    };

    var releaseFreeze = function (e) {
        if (typeof PVI.freeze === "number") {
            PVI.freeze = !cfg.hz.deactivate;
            return;
        }

        if (e.type === "mouseup") {
            if ([1, 3, 4].includes(e.button)) {
                PVI.key_action(e);
                return;
            }
            if (e.target !== PVI.CNT || PVI.fullZm || e.button !== 0) {
                return;
            }

            if (e.ctrlKey || e.shiftKey || e.altKey) {
                return;
            }

            if (PVI.md_x !== e.clientX || PVI.md_y !== e.clientY) {
                return;
            }

            PVI.reset(true);
            return;
        }

        // drag or visibilitychange
        if (PVI.keyup_freeze_on) {
            PVI.keyup_freeze();
        }
    };

    var onMouseDown = function (e) {
        if (!cfg || !e.isTrusted) {
            return;
        }

        var d =
            doc.compatMode && doc.compatMode[0] === "B"
                ? doc.body
                : doc.documentElement;

        // some browsers (Safari, Firefox) fire mouse events on the window scrollbars
        if (e.clientX >= d.clientWidth || e.clientY >= d.clientHeight) {
            return;
        }

        // don't show the pop-up (if that isn't visible yet) on any mousedown event
        // except on manual activation with right mouse button
        d =
            e.button === 2 &&
            PVI.freeze &&
            PVI.SRC !== void 0 &&
            !cfg.hz.deactivate;

        if (PVI.fireHide && PVI.state < 3 && !d) {
            PVI.m_over({ relatedTarget: PVI.TRG });

            // prevent zooming while selecting text
            if (!PVI.freeze || PVI.lastScrollTRG) {
                PVI.freeze = 1;
            }

            return;
        }

        if (e.button === 0) {
            if (PVI.fullZm) {
                mdownstart = true;

                if (e.ctrlKey || PVI.fullZm !== 2) {
                    return;
                }

                PVI.fullZm = 3;
                win.addEventListener("mouseup", PVI.fzDragEnd, true);
                return;
            }

            // Opera doesn't fire mouseup event after dragging an overflow scrollbar
            // Just ignore those cases, so the zooming won't stay suspended
            if (
                platform.opera &&
                ((e.target.clientWidth && e.offsetX >= e.target.clientWidth) ||
                    (e.target.clientHeight &&
                        e.offsetY >= e.target.clientHeight))
            ) {
                return;
            }

            if (e.target === PVI.CNT) {
                PVI.md_x = e.clientX;
                PVI.md_y = e.clientY;
                return;
            }

            // hide the pop-up if that is visible
            if (PVI.fireHide) {
                PVI.m_over({
                    relatedTarget: PVI.TRG,
                    clientX: e.clientX,
                    clientY: e.clientY,
                });
            }

            if (!PVI.freeze || PVI.lastScrollTRG) {
                PVI.freeze = 1;
            }

            return;
        }

        if (e.button !== 2) {
            return;
        }

        if (cfg.hz.actTrigger === "m2") {
            if (PVI.fireHide && d) {
                // so in contextmenu we can determine if it needs loading
                PVI.SRC = {
                    m2:
                        PVI.SRC === null
                            ? PVI.TRG.IMGS_c_resolved
                            : PVI.SRC.m2 || PVI.SRC,
                };
            }

            PVI.freeze = cfg.hz.deactivate;
        } else if (PVI.keyup_freeze_on) {
            PVI.keyup_freeze();
            PVI.freeze = PVI.freeze ? 1 : 0;
        }

        mdownstart = e.timeStamp;

        // context menu should work where the mousedown event happened (Chrome...)
        PVI.md_x = e.clientX;
        PVI.md_y = e.clientY;

        // https://crbug.com/469063
        // document.evaluate('./ancestor-or-self::a[@href]', e.target, null, 9, null).singleNodeValue
        if (
            platform.chrome &&
            (e.target.href || ((d = e.target.parentNode) && d.href))
        ) {
            e.preventDefault();
        }
    };

    var onContextMenu = function (e) {
        if (
            !mdownstart ||
            e.button !== 2 ||
            PVI.md_x !== e.clientX ||
            PVI.md_y !== e.clientY
        ) {
            if (mdownstart) {
                mdownstart = null;
            }

            // when "enabled when holding right button" is used,
            // the contextmenu should be prevented if the mouse cursor moved (10px radius),
            // except if the pop-up is hidden, and the click happend over PVI.TRG
            if (
                e.button === 2 &&
                (!PVI.fireHide || PVI.state > 2) &&
                (Math.abs(PVI.md_x - e.clientX) > 5 ||
                    Math.abs(PVI.md_y - e.clientY) > 5) &&
                cfg.hz.actTrigger === "m2" &&
                !cfg.hz.deactivate
            ) {
                pdsp(e);
            }

            return;
        }

        var i;
        var elapsed = e.timeStamp - mdownstart >= 300;

        mdownstart = null;

        // TODO: ? maybe not the best combination with single right click
        i =
            PVI.state > 2 &&
            ((elapsed && cfg.hz.fzOnPress === 2) ||
                (!elapsed && !PVI.fullZm && cfg.hz.fzOnPress === 1));

        if (i) {
            PVI.fullzmtoggle(PVI.fullZm ? true : e.shiftKey);
        } else if ((i = PVI.state < 3 && PVI.SRC && PVI.SRC.m2 !== void 0)) {
            if (elapsed) {
                return;
            }
            // set in mousedown above
            PVI.load(PVI.SRC.m2);
            PVI.SRC = void 0;
        } else if (
            elapsed &&
            PVI.state > 2 &&
            !PVI.fullZm &&
            cfg.hz.fzOnPress === 1
        ) {
            return;
        }

        if (i) {
            pdsp(e);
        } else if (e.target === PVI.CNT) {
            pdsp(e, false);
        } else if (
            e.ctrlKey &&
            !elapsed &&
            !e.shiftKey &&
            !e.altKey &&
            cfg.tls.opzoom &&
            PVI.state < 2 &&
            (i =
                checkIMG(e.target) ||
                checkBG(win.getComputedStyle(e.target).backgroundImage))
        ) {
            PVI.TRG = PVI.nodeToReset = e.target;
            PVI.fireHide = true;
            PVI.x = e.clientX;
            PVI.y = e.clientY;
            PVI.set(Array.isArray(i) ? i[0] : i);
            pdsp(e);
        }
    };

    var PVI = {
        TRG: null,
        DIV: null,
        IMG: null,
        CAP: null,
        HLP: doc.createElement("a"),
        anim: {},
        stack: {},
        timers: {},
        resolving: [],
        lastTRGStyle: { cursor: null, outline: null },
        iFrame: false,
        /* state
		0 - uninitialized - PVI.DIV not created
		1 - hidden - PVI.DIV and PVI.LDR are in the DOM, but not displayed
		2 - hiding - PVI.DIV or PVI.LDR is hiding
		3 - loading - PVI.LDR is visible, but PVI.IMG is hidden
		4 - visible - PVI.IMG is visible
	*/
        state: null,
        rgxHTTPs: /^https?:\/\/(?:www\.)?/,
        pageProtocol: win.location.protocol.replace(/^(?!https?:).+/, "http:"),
        palette: {
            load: "rgb(255, 255, 255)",
            R_load: "rgb(255, 204, 204)",
            res: "rgb(222, 255, 205)",
            R_res: "rgb(255, 234, 128)",
            R_js: "rgb(200, 200, 200)",
            // 'frames': 'rgb(153, 221, 255)',
            // 'pile_frames_bg': 'rgb(120, 210, 255)',
            pile_fg: "#000",
            pile_bg: "rgb(255, 255, 0)",
        },
        // Chrome, Maxthon cannot send regexes
        convertSieveRegexes: function () {
            var s = cfg.sieve,
                i;

            if (
                !Array.isArray(s) ||
                !(i = s.length) ||
                typeof (s[0].link || s[0].img) !== "string"
            ) {
                return;
            }

            while (i--) {
                if (s[i].link) {
                    s[i].link = RegExp(
                        s[i].link,
                        s[i].ci && s[i].ci & 1 ? "i" : ""
                    );
                }

                if (s[i].img) {
                    s[i].img = RegExp(
                        s[i].img,
                        s[i].ci && s[i].ci & 2 ? "i" : ""
                    );
                }
            }
        },
        create: function () {
            if (PVI.DIV) {
                return;
            }

            var x, y, z, p;

            // PVI.BOX could be DIV | LDR
            // PVI.CNT could be IMG (images and SVGs) | VID (video or audio) | IFR (else)

            // PVI.INP = doc.createElement('input'); // helper for focusing
            PVI.HLP = doc.createElement("a");
            PVI.DIV = doc.createElement("div");
            PVI.VID = doc.createElement("video");
            PVI.IMG = doc.createElement("img");
            PVI.LDR = PVI.IMG.cloneNode(false);
            PVI.CNT = PVI.IMG;

            PVI.DIV.IMGS_ =
                PVI.DIV.IMGS_c =
                PVI.LDR.IMGS_ =
                PVI.LDR.IMGS_c =
                PVI.VID.IMGS_ =
                PVI.VID.IMGS_c =
                PVI.IMG.IMGS_ =
                PVI.IMG.IMGS_c =
                    true;

            /*PVI.INP.readOnly = true;
		PVI.INP.style.cssText = 'position: fixed !important; left: 0 !important; top: 0 !important; width: 0; height: 0; margin: 0; padding: 0; opacity: 0 !important';*/

            PVI.DIV.style.cssText =
                "margin: 0; padding: 0; " +
                (cfg.hz.css || "") +
                (cfg.hz.cssdim
                    ? "box-shadow: 0 0 0 2000px rgba(0, 0, 0," +
                      cfg.hz.cssdim +
                      "), 0 0 150px rgba(255, 255, 255, 0.8)"
                    : "") +
                "; visibility: visible; cursor: default; display: none; z-index: 2147483647; " +
                "position: fixed !important; box-sizing: content-box !important; left: auto; top: auto; right: auto; bottom: auto; width: auto; height: auto; max-width: none !important; max-height: none !important; ";

            PVI.DIV.curdeg = 0;

            PVI.LDR.wh = [35, 35];
            var onLDRLoad = function () {
                this.removeEventListener("load", onLDRLoad, false);
                onLDRLoad = null;
                var x = this.style;
                this.wh = [
                    x.width
                        ? parseInt(x.width, 10)
                        : this.naturalWidth || this.wh[0],
                    x.height
                        ? parseInt(x.height, 10)
                        : this.naturalHeight || this.wh[1],
                ];
            };
            PVI.LDR.addEventListener("load", onLDRLoad, false);

            PVI.LDR.alt = "";
            PVI.LDR.draggable = false;
            PVI.LDR.style.cssText =
                (cfg.hz.LDRcss ||
                    "padding: 5px; border-radius: 50% !important; box-shadow: 0px 0px 5px 1px #a6a6a6 !important; background-clip: padding-box; width: 38px; height: 38px") +
                "; position: fixed !important; z-index: 2147483647; display: none; left: auto; top: auto; right: auto; bottom: auto; margin: 0; box-sizing: border-box !important; " +
                (cfg.hz.LDRanimate
                    ? platform["transition_css"] +
                      ": background-color .5s, opacity .2s ease, top .15s ease-out, left .15s ease-out"
                    : "");
            PVI.LDR.src =
                cfg.hz.LDRsrc ||
                "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOng9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWluWU1pbiBub25lIj48Zz48cGF0aCBpZD0icCIgZD0iTTMzIDQyYTEgMSAwIDAgMSA1NS0yMCAzNiAzNiAwIDAgMC01NSAyMCIvPjx1c2UgeDpocmVmPSIjcCIgdHJhbnNmb3JtPSJyb3RhdGUoNzIgNTAgNTApIi8+PHVzZSB4OmhyZWY9IiNwIiB0cmFuc2Zvcm09InJvdGF0ZSgxNDQgNTAgNTApIi8+PHVzZSB4OmhyZWY9IiNwIiB0cmFuc2Zvcm09InJvdGF0ZSgyMTYgNTAgNTApIi8+PHVzZSB4OmhyZWY9IiNwIiB0cmFuc2Zvcm09InJvdGF0ZSgyODggNTAgNTApIi8+PGFuaW1hdGVUcmFuc2Zvcm0gYXR0cmlidXRlTmFtZT0idHJhbnNmb3JtIiB0eXBlPSJyb3RhdGUiIHZhbHVlcz0iMzYwIDUwIDUwOzAgNTAgNTAiIGR1cj0iMS44cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L2c+PC9zdmc+";

            x =
                "display: none; visibility: inherit !important; background: none; position: relative; width: 100%; height: 100%; max-width: inherit; max-height: inherit; margin: 0; padding: 0; border: 0; ";

            PVI.IMG.alt = "";
            PVI.IMG.style.cssText =
                x + "; image-orientation: initial !important";
            PVI.IMG.addEventListener("error", PVI.content_onerror);
            PVI.DIV.appendChild(PVI.IMG);

            // Blink (WebKit?) renders a black square for unset poster,
            // so use a transparent image instead
            if (platform.chrome || platform.maxthon) {
                PVI.VID.poster =
                    "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";
            }

            PVI.VID.volume = cfg.hz.mediaVolume / 100;
            PVI.VID.autoplay = true;
            PVI.VID.style.cssText = x + "box-shadow: 0 0 0 1px #f16529";
            PVI.VID.addEventListener("loadeddata", PVI.content_onready);
            PVI.VID.addEventListener("error", PVI.content_onerror, true);
            PVI.DIV.appendChild(PVI.VID);

            if (cfg.hz.thumbAsBG || cfg.hz.history) {
                PVI.IMG.addEventListener("load", PVI.content_onload);
                PVI.VID.addEventListener("canplay", PVI.content_onload);
            }

            if (cfg.hz.hideIdleCursor >= 50) {
                PVI.DIV.cursor_hide = function () {
                    // Opera doesn't support cursor: none
                    PVI.CNT.style.cursor = platform.opera ? "text" : "none";
                    PVI.timers.cursor_hide = null;
                };

                PVI.DIV.addEventListener("mousemove", function (e) {
                    if (
                        e.target !== PVI.CNT ||
                        (PVI.CNT === PVI.VID &&
                            PVI.VID.clientHeight - 35 <
                                (e.offsetY || e.layerY || 0))
                    ) {
                        clearTimeout(PVI.timers.cursor_hide);
                        return;
                    }

                    if (PVI.timers.cursor_hide) {
                        clearTimeout(PVI.timers.cursor_hide);
                    } else {
                        PVI.CNT.style.cursor = "";
                    }

                    PVI.timers.cursor_hide = setTimeout(
                        PVI.DIV.cursor_hide,
                        cfg.hz.hideIdleCursor
                    );
                });

                PVI.DIV.addEventListener(
                    "mouseout",
                    function (e) {
                        if (e.target !== PVI.CNT) {
                            return;
                        }

                        clearTimeout(PVI.timers.cursor_hide);
                        PVI.CNT.style.cursor = "";
                    },
                    false
                );
            } else if (cfg.hz.hideIdleCursor >= 0) {
                PVI.IMG.style.cursor = platform.opera ? "text" : "none";
            }

            PVI.DIV.addEventListener(
                "dragstart",
                function (e) {
                    pdsp(e, false);
                },
                true
            );

            x = doc.documentElement;
            x.appendChild(PVI.DIV);
            x.appendChild(PVI.LDR);

            PVI.DBOX = {};
            x = win.getComputedStyle(PVI.DIV);
            y = {
                mt: "marginTop",
                mr: "marginRight",
                mb: "marginBottom",
                ml: "marginLeft",
                bt: "borderTopWidth",
                br: "borderRightWidth",
                bb: "borderBottomWidth",
                bl: "borderLeftWidth",
                pt: "paddingTop",
                pr: "paddingRight",
                pb: "paddingBottom",
                pl: "paddingLeft",
            };

            for (z in y) {
                if (z[0] === "m") {
                    PVI.DBOX[z] = parseInt(x[y[z]], 10);
                }

                if (z[1] === "t" || z[1] === "b") {
                    p = z[1] + (z[0] === "p" ? "p" : "bm");
                    PVI.DBOX[p] = (PVI.DBOX[p] || 0) + parseInt(x[y[z]], 10);
                }

                p =
                    (z[1] === "l" || z[1] === "r" ? "w" : "h") +
                    (z[0] === "m" ? "m" : "pb");
                PVI.DBOX[p] = (PVI.DBOX[p] || 0) + parseInt(x[y[z]], 10);
            }

            PVI.anim = {
                maxDelay: 0,
                opacityTransition: function () {
                    PVI.BOX.style.opacity = PVI.BOX.opacity || "1";
                },
            };

            y = platform["transition"];

            if (x[y + "Property"]) {
                p = /,\s*/;
                p = [
                    x[y + "Property"].split(p),
                    x[y + "Duration"].replace(/initial/g, "0s").split(p),
                ];

                PVI.anim.css = x[y] || PVI.DIV.style[y];

                ["opacity", "left", "top", "width", "height"].forEach(function (
                    el
                ) {
                    var idx = p[0].indexOf(el),
                        val = parseFloat(p[1][idx]) * 1000;

                    if (val > 0 && idx > -1) {
                        PVI.anim[el] = val;

                        if (val > PVI.anim.maxDelay) {
                            PVI.anim.maxDelay = val;
                        }

                        if (el === "opacity" && x.opacity) {
                            PVI.DIV.opacity = "" + Math.max(0.01, x.opacity);
                        }
                    }
                });
            }

            if (cfg.hz.capText || cfg.hz.capWH) {
                PVI.createCAP();
            }

            if (!platform.opera && doc.querySelector("embed, object")) {
                // For Opera, setting the background color is enough.
                // Hack to keep the image always on top of embedded content,
                // however doesn't work when the plug-in is in an iframe
                // z-index: -1 is needed, otherwise it'll go over the video element
                PVI.DIV.insertBefore(
                    doc.createElement("iframe"),
                    PVI.DIV.firstElementChild
                );
                PVI.DIV.firstChild.style.cssText =
                    "z-index: -1; width: 100%; height: 100%; position: absolute; left: 0; top: 0; border: 0";
            }

            PVI.reset();
        },
        createCAP: function () {
            if (PVI.CAP) {
                return;
            }

            PVI.CAP = doc.createElement("div");
            buildNodes(PVI.CAP, [
                {
                    tag: "b",
                    attrs: {
                        style:
                            "display: none; " +
                            platform["transition_css"] +
                            ": background-color .1s; border-radius: 3px; padding: 0 2px",
                    },
                },
                " ",
                {
                    tag: "b",
                    attrs: {
                        style:
                            "display: " +
                            (cfg.hz.capWH ? "inline-block" : "none"),
                    },
                },
                " ",
                {
                    tag: "span",
                    attrs: {
                        style:
                            "color: inherit; display: " +
                            (cfg.hz.capText ? "inline-block" : "none"),
                    },
                },
            ]);

            var n = PVI.CAP.firstElementChild;

            do {
                n.IMGS_ = n.IMGS_c = true;
            } while ((n = n.nextElementSibling));

            PVI.CAP.IMGS_ = PVI.CAP.IMGS_c = true;
            PVI.create();
            n = cfg.hz.capStyle;

            PVI.palette.wh_fg = n ? "rgb(100, 0, 0)" : "rgb(204, 238, 255)";
            PVI.palette.wh_fg_hd = n ? "rgb(255, 0, 0)" : "rgb(120, 210, 255)";
            PVI.CAP.style.cssText =
                "left:0; right:auto; display:block; cursor:default; position:absolute; width:auto; height:auto; border:0; white-space: " +
                (cfg.hz.capWrapByDef ? "pre-line" : "nowrap") +
                '; font:13px/1.4em "Trebuchet MS",sans-serif; background:rgba(' +
                (n ? "255,255,255,.95" : "0,0,0,.75") +
                ") !important; color:#" +
                (n ? "000" : "fff") +
                " !important; box-shadow: 0 0 1px #" +
                (n ? "666" : "ddd") +
                " inset; padding:0 4px; border-radius: 3px";
            n = cfg.hz.capPos ? "bottom" : "top";
            PVI.CAP.overhead = Math.max(
                -18,
                Math.min(0, PVI.DBOX[n[0] + "p"] - 18)
            );
            PVI.CAP.style[n] = PVI.CAP.overhead + "px";
            PVI.CAP.overhead = Math.max(
                0,
                -PVI.CAP.overhead - PVI.DBOX[n[0] + "bm"]
            );
            PVI.DIV.appendChild(PVI.CAP);
        },
        prepareCaption: function (trg, caption) {
            if (caption && typeof caption === "string") {
                // strip and break HTML tags, so no tags would be parsed, since we're only
                // interested in textContent, where HTML entities are properly converted
                PVI.HLP.innerHTML = caption
                    .replace(/<[^>]+>/g, "")
                    .replace(/</g, "&lt;");
                trg.IMGS_caption = PVI.HLP.textContent
                    .trim()
                    .replace(/[\n\r]+/g, " ");
                PVI.HLP.textContent = "";
            } else {
                trg.IMGS_caption = "";
            }
        },
        flash_caption: function () {
            PVI.timers.pileflicker = 0;
            PVI.timers.pile_flash = setInterval(PVI.flick_caption, 150);
        },
        flick_caption: function () {
            if (PVI.timers.pileflicker++ >= cfg.hz.capFlashCount * 2) {
                PVI.timers.pileflicker = null;
                clearInterval(PVI.timers.pile_flash);
                return;
            }

            var s = PVI.CAP.firstChild.style;
            s.backgroundColor =
                s.backgroundColor === PVI.palette.pile_bg
                    ? "red"
                    : PVI.palette.pile_bg;
        },
        updateCaption: function () {
            var c = PVI.CAP,
                h;

            if (!c || c.state === 0) {
                return;
            }

            if (c.style.display !== "none") {
                return;
            }

            if (PVI.TRG.IMGS_album) {
                if (
                    c.firstChild.style.display === "none" &&
                    (h = PVI.stack[PVI.TRG.IMGS_album]) &&
                    h[2]
                ) {
                    h = c.firstChild.style;
                    h.color = PVI.palette.pile_fg;
                    h.backgroundColor = PVI.palette.pile_bg;
                    h.display = "inline-block";

                    if (cfg.hz.capFlashCount) {
                        if (cfg.hz.capFlashCount > 5) {
                            cfg.hz.capFlashCount = 5;
                        }

                        clearTimeout(PVI.timers.pile_flash);
                        PVI.timers.pile_flash = setTimeout(
                            PVI.flash_caption,
                            PVI.anim.maxDelay
                        );
                    }
                }
            }

            if (PVI.CNT !== PVI.IFR) {
                h = c.children[1];

                if (cfg.hz.capWH || c.state === 2) {
                    h.style.display = "inline-block";
                    h.style.color =
                        PVI.palette[
                            PVI.TRG.IMGS_HD === false ? "wh_fg_hd" : "wh_fg"
                        ];
                    h.textContent = (
                        PVI.TRG.IMGS_SVG
                            ? PVI.stack[PVI.IMG.src]
                            : [PVI.CNT.naturalWidth, PVI.CNT.naturalHeight]
                    ).join("\u00d7");
                } else {
                    h.style.display = "none";
                }
            }

            h = c.lastChild;

            if (cfg.hz.capText || c.state === 2) {
                h.textContent = PVI.TRG.IMGS_caption || "";
                h.style.display = "inline";
            } else {
                h.style.display = "none";
            }

            c.style.display = PVI.DIV.curdeg % 360 ? "none" : "block";
        },
        attrObserver: function (target, isStyle, oldValue) {
            if (isStyle) {
                var bgImage = target.style.backgroundImage;

                if (
                    (!bgImage ||
                        (oldValue &&
                            oldValue.indexOf(bgImage.slice(5, -2)) !== -1)) &&
                    oldValue &&
                    oldValue.indexOf("opacity") === -1 &&
                    target.style.cssText.indexOf("opacity") === -1
                ) {
                    return;
                }
            }

            PVI.resetNode(target);
        },
        onAttrChange: function (e) {
            if (e.attrChange !== 1) {
                return;
            }

            var target = e.target;

            switch (e.attrName) {
                case "style":
                    var bgImg = target.style.backgroundImage;

                    // Not perfect, new bg url can be just part of the old url
                    if (
                        (!bgImg ||
                            e.prevValue.indexOf(bgImg.slice(5, -2)) !== -1) &&
                        e.prevValue.indexOf("opacity") === -1 &&
                        target.style.cssText.indexOf("opacity") === -1
                    ) {
                        return;
                    }
                /* falls through */
                case "href":
                case "src":
                case "title":
                case "alt":
                    if (target === PVI.TRG) {
                        PVI.nodeToReset = target;
                    } else {
                        PVI.resetNode(target);
                    }

                    target.removeEventListener(
                        "DOMAttrModified",
                        PVI.onAttrChange
                    );
            }

            e.stopPropagation();
        },
        listen_attr_changes: function (node) {
            if (PVI.mutObserver) {
                PVI.mutObserver.observe(node, PVI.mutObserverConf);
            } else {
                node.addEventListener("DOMAttrModified", PVI.onAttrChange);
            }
        },
        resetNode: function (node, keepAlbum) {
            delete node.IMGS_c;
            delete node.IMGS_c_resolved;
            delete node.IMGS_thumb;
            delete node.IMGS_thumb_ok;
            delete node.IMGS_SVG;
            delete node.IMGS_HD;
            delete node.IMGS_HD_stack;
            delete node.IMGS_fallback_zoom;

            if (!keepAlbum) {
                delete node.IMGS_album;
            }

            if (node.localName !== "a") {
                return;
            }

            var childNodes = node.querySelectorAll(
                'img[src], :not(img)[style*="background-image"],' +
                    "b, i, u, strong, em, span, div"
            );

            if (childNodes.length) {
                [].forEach.call(childNodes, function (el) {
                    if (el.IMGS_c) {
                        PVI.resetNode(el);
                    }
                });
            }
        },
        getImages: function (el) {
            var imgs, p;
            var isHTMLElement = el && el instanceof win.HTMLElement;

            // For overlays (it deals with common cases, not a general solution)
            if (isHTMLElement) {
                if (el.childElementCount > 0 && el.childElementCount < 3) {
                    imgs = el.firstElementChild;

                    if (imgs.childElementCount && imgs.childElementCount < 4) {
                        if (imgs.firstElementChild.localName === "img") {
                            imgs = imgs.firstElementChild;
                        } else if (imgs.lastElementChild.localName === "img") {
                            imgs = imgs.lastElementChild;
                        }
                    }

                    if (
                        imgs.src &&
                        !/\S/.test(el.textContent) &&
                        el.offsetWidth - imgs.offsetWidth < 25 &&
                        el.offsetHeight - imgs.offsetHeight < 25
                    ) {
                        el = imgs;
                    }
                } else if (
                    !el.childElementCount &&
                    el.parentNode.childElementCount <= 5 &&
                    (el.localName === "img"
                        ? el.src.lastIndexOf("data:", 0) === 0 ||
                          el.naturalWidth < 3 ||
                          el.naturalHeight < 3 ||
                          el.style.opacity === "0"
                        : !/\S/.test(el.textContent)) &&
                    el.style.backgroundImage[0] !== "u"
                ) {
                    p = el.previousElementSibling;
                    [
                        p && p.previousElementSibling,
                        p,
                        el.nextElementSibling,
                    ].some(function (sib) {
                        if (
                            sib &&
                            sib.localName === "img" &&
                            sib.offsetParent === el.offsetParent &&
                            Math.abs(sib.offsetLeft - el.offsetLeft) <= 10 &&
                            Math.abs(sib.offsetTop - el.offsetTop) <= 10 &&
                            Math.abs(sib.clientWidth - el.clientWidth) <= 30 &&
                            Math.abs(sib.clientHeight - el.clientHeight) <= 30
                        ) {
                            el = sib;
                            return true;
                        }
                    });
                }
            }

            // TODO: too raw, somehow should consider the ratio too
            if (
                el.clientWidth > topWinW * 0.7 &&
                el.clientHeight > topWinH * 0.7
            ) {
                return null;
            }

            imgs = { imgSRC_o: el.currentSrc || el.src || el.data || null };

            if (!imgs.imgSRC_o && el.localName === "image") {
                imgs.imgSRC_o = el.getAttributeNS(
                    "http://www.w3.org/1999/xlink",
                    "href"
                );

                if (imgs.imgSRC_o) {
                    imgs.imgSRC_o = PVI.normalizeURL(imgs.imgSRC_o);
                } else {
                    delete imgs.imgSRC_o;
                }
            }

            if (imgs.imgSRC_o) {
                if (!isHTMLElement) {
                    imgs.imgSRC_o = PVI.normalizeURL(imgs.imgSRC_o);
                    // Ignore "spacer.gif"
                } else if (
                    (el.naturalWidth > 0 && el.naturalWidth < 3) ||
                    (el.naturalHeight > 0 && el.naturalHeight < 3)
                ) {
                    imgs.imgSRC_o = null;
                }

                if (imgs.imgSRC_o) {
                    imgs.imgSRC = imgs.imgSRC_o.replace(PVI.rgxHTTPs, "");
                }
            }

            if (!isHTMLElement) {
                return imgs.imgSRC ? imgs : null;
            }

            if (el.style.backgroundImage[0] === "u") {
                imgs.imgBG_o = el.style.backgroundImage;
            } else if (el.parentNode) {
                p = el.parentNode;

                if (
                    p.offsetParent === el.offsetParent &&
                    p.style &&
                    p.style.backgroundImage[0] === "u"
                ) {
                    if (
                        Math.abs(p.offsetLeft - el.offsetLeft) <= 10 &&
                        Math.abs(p.offsetTop - el.offsetTop) <= 10 &&
                        Math.abs(p.clientWidth - el.clientWidth) <= 30 &&
                        Math.abs(p.clientHeight - el.clientHeight) <= 30
                    ) {
                        imgs.imgBG_o = p.style.backgroundImage;
                    }
                }
            }

            if (!imgs.imgBG_o) {
                return imgs.imgSRC ? imgs : null;
            }

            // ("...\"") - Gecko, Blink
            // ("...&quot;") - Presto
            // (...) or ('...)') - WebKit
            imgs.imgBG_o = imgs.imgBG_o.match(
                /\burl\(([^'"\)][^\)]*|"[^"\\]+(?:\\.[^"\\]*)*|'[^'\\]+(?:\\.[^'\\]*)*)(?=['"]?\))/g
            );

            if (!imgs.imgBG_o || imgs.imgBG_o.length !== 1) {
                return imgs.imgSRC ? imgs : null;
            }

            el = imgs.imgBG_o[0];
            imgs.imgBG_o = PVI.normalizeURL(
                el.slice(/'|"/.test(el[4]) ? 5 : 4)
            );
            imgs.imgBG = imgs.imgBG_o.replace(PVI.rgxHTTPs, "");
            return imgs;
        },
        _replace: function (rule, addr, http, param, to, trg) {
            var ret, i;

            // Make the target node available for the rule
            if (typeof to === "function") {
                PVI.node = trg;
            }

            var r = to ? addr.replace(rule[param], to) : addr;

            if (typeof to === "function") {
                // with empty string the rule explicitly says that there is no match
                if (r === "") {
                    return 2;
                }
                // the rule explicitly says that it will resolve something
                else if (r === "null") {
                    return null;
                }

                if (r.indexOf("\n", 7) > -1) {
                    var prefixSuffix = addr
                        .replace(rule[param], "\r")
                        .split("\r");
                    r = r.trim().split(/[\n\r]+/g);
                    ret = [];

                    for (i = 0; i < r.length; ++i) {
                        if (i > 0) {
                            r[i] = prefixSuffix[0] + r[i];
                        }

                        if (i !== r.length - 1) {
                            r[i] += prefixSuffix[1];
                        }

                        r[i] = PVI._replace(rule, r[i], http, param, "", trg);

                        if (Array.isArray(r[i])) {
                            ret = ret.concat(r[i]);
                        } else {
                            ret.push(r[i]);
                        }
                    }

                    return ret.length > 1 ? ret : ret[0];
                }
            }

            if (
                rule.dc &&
                ((param === "link" && rule.dc !== 2) ||
                    (param === "img" && rule.dc > 1))
            ) {
                r = decodeURIComponent(decodeURIComponent(r));
            }

            if (to[0] === "#" && r[0] !== "#") {
                r = "#" + r.replace("#", "");
            }

            r = PVI.httpPrepend(r, http);
            ret = r.indexOf("#", 1);

            if (ret > 1 && (ret = [ret, r.indexOf("#", ret + 1)])[1] > 1) {
                ret = r.slice(ret[0], ret[1] + 1);
                r = r.split(ret).join("#");
                ret = ret.slice(1, -1).split(/ |%20/);
            } else {
                ret = false;
            }

            /*if (r && /^#?\/\//.test(r)) {
			r = r.replace(/^(#)?/, '$1http' + (win.location.protocol === 'https:' ? 's:' : ':'))
		}*/

            if (ret) {
                if (r[0] === "#") {
                    r = r.slice(1);
                    addr = "#";
                } else {
                    addr = "";
                }

                for (i = 0; i < ret.length; ++i) {
                    ret[i] = addr + r.replace("#", ret[i]);
                }

                r = ret.length > 1 ? ret : ret[0];
            }

            return r;
        },
        replace: function (rule, addr, http, param, trg) {
            var ret, i, j;

            if (PVI.toFunction(rule, "to") === false) {
                return 1;
            }

            if (trg.IMGS_TRG) {
                trg = trg.IMGS_TRG;
            }

            http = http.slice(0, http.length - addr.length);

            if (Array.isArray(rule.to)) {
                ret = [];

                for (i = 0; i < rule.to.length; ++i) {
                    j = PVI._replace(rule, addr, http, param, rule.to[i], trg);

                    if (Array.isArray(j)) {
                        ret = ret.concat(j);
                    } else {
                        ret.push(j);
                    }
                }
            } else if (rule.to) {
                ret = PVI._replace(rule, addr, http, param, rule.to, trg);
            } else {
                ret = PVI.httpPrepend(addr, http);
            }

            return ret;
        },
        toFunction: function (rule, param, inline) {
            if (
                typeof rule[param] !== "function" &&
                (inline ? /^:\s*\S/ : /^:\n\s*\S/).test(rule[param])
            ) {
                try {
                    rule[param] = Function(
                        "var $ = arguments; " +
                            (inline ? "return " : "") +
                            rule[param].slice(1)
                    ).bind(PVI);
                } catch (ex) {
                    console.error(app.name + ": " + param + " - " + ex.message);
                    return false;
                }
            }
        },
        httpPrepend: function (url, preDomain) {
            if (preDomain) {
                // $1 should be escaped, but since it's rare...
                url = url.replace(
                    /^(?!#?(?:https?:|\/\/|data:)|$)(#?)/,
                    "$1" + preDomain
                );
            }

            // URLs that start with // won't work on protocols other than http or https
            // for example on file:// the image won't be loaded, so default to http
            // also always add the protocol to be able to properly compare URLs later
            if (url[1] === "/") {
                if (url[0] === "/") {
                    url = PVI.pageProtocol + url;
                } else if (url[0] === "#" && url[2] === "/") {
                    url = "#" + PVI.pageProtocol + url.slice(1);
                }
            }

            return url;
        },
        normalizeURL: function (url) {
            // Add protocol if missing
            if (url[1] === "/" && url[0] === "/") {
                url = PVI.pageProtocol + url;
            }

            // Fix domain case, make the url absolute
            PVI.HLP.href = url;
            return PVI.HLP.href;
        },
        resolve: function (URL, rule, trg, nowait) {
            if (!trg || trg.IMGS_c) {
                return false;
            }

            if (
                trg.IMGS_c_resolved &&
                typeof trg.IMGS_c_resolved.URL !== "string"
            ) {
                return false;
            }

            URL = URL.replace(rgxHash, "");

            if (PVI.stack[URL]) {
                trg.IMGS_album = URL;
                URL = PVI.stack[URL];
                return URL[URL[0]][0];
            }

            var params, i;

            // when rule is actually params from IMGS_c_resolved
            if (rule.rule) {
                params = rule;
                rule = params.rule;
            } else {
                params = {};
                i = 0;

                // transfer the matched groups to the root object which will be passed to "res"
                // so the groups will be accessible inside it like this: $[0], $[1] ...
                while (i < rule.$.length) {
                    params[i] = rule.$[i++];
                }

                params.length = rule.$.length;
                delete rule.$;
                params.rule = rule;
            }

            // if the function body is not sent to the content script yet, then request it
            if (cfg.sieve[rule.id].res === 1) {
                rule.req_res = true;
            }
            // when the "url" function returns "", then there is no need to resolve the page
            else if (rule.skip_resolve) {
                // if the function is already compiled
                if (typeof cfg.sieve[rule.id].res === "function") {
                    params.url = [URL];

                    return PVI.onMessage({
                        cmd: "resolved",
                        id: -1,
                        m: false,
                        return_url: true,
                        params: params,
                    });
                }
                // this could only happen when the "res" is not a function
                // in that case skip_resolve is not valid
                else {
                    delete rule.skip_resolve;
                }
            }

            if (
                !cfg.hz.waitHide &&
                ((PVI.fireHide && PVI.state > 2) ||
                    PVI.state === 2 ||
                    (PVI.hideTime && Date.now() - PVI.hideTime < 200))
            ) {
                nowait = true;
            }

            if (!PVI.resolve_delay) {
                clearTimeout(PVI.timers.resolver);
            }

            trg.IMGS_c_resolved = { URL: URL, params: params };
            PVI.timers.resolver = setTimeout(function () {
                PVI.timers.resolver = null;
                Port.send({
                    cmd: "resolve",
                    url: URL,
                    params: params,
                    id: PVI.resolving.push(trg) - 1,
                });
            }, PVI.resolve_delay || (nowait ? 50 : Math.max(50, cfg.hz.delay)));

            return null;
        },
        find: function (trg, x, y) {
            var i = 0,
                n = trg,
                ret = false,
                URL,
                rule,
                imgs,
                use_img,
                tmp_el,
                attrModNode;

            do {
                // trg could be a simple object too, in which case
                // it should already have a 'href' or 'src' property
                if (n.nodeType !== void 0) {
                    if (n.nodeType !== 1 || n === doc.body) {
                        break;
                    } else if (n.localName !== "a") {
                        continue;
                    }
                }

                if (!n.href) {
                    // When 'href' is set dynamically via mouseover
                    if (n.href === "") {
                        PVI.listen_attr_changes(n);
                    }

                    break;
                }

                if (n instanceof win.HTMLElement) {
                    if (
                        n.childElementCount &&
                        n.querySelector("iframe, object, embed")
                    ) {
                        break;
                    }

                    if (platform.opera) {
                        if (
                            trg.childElementCount &&
                            (((tmp_el = doc.evaluate(
                                './/*[self::img[@src] or self::*[contains(@style, "background-image:")]] | preceding-sibling::img[@src][1] | following-sibling::img[@src][1]',
                                trg,
                                null,
                                8,
                                null
                            ).singleNodeValue) &&
                                (tmp_el.src !== void 0 ||
                                    !/\S/.test(trg.textContent))) ||
                                (n.parentNode.style.backgroundImage[0] ===
                                    "u" &&
                                    (tmp_el = n.parentNode) &&
                                    tmp_el.childElementCount < 3) ||
                                (n.style.backgroundImage[0] === "u" &&
                                    (tmp_el = n))) &&
                            Math.abs(trg.offsetWidth - tmp_el.offsetWidth) <=
                                25 &&
                            Math.abs(trg.offsetHeight - tmp_el.offsetHeight) <=
                                25
                        ) {
                            // TODO: tmp_el may be used as fake trg, to check if it's downscaled
                            imgs = PVI.getImages(tmp_el);
                        }
                    } else if (typeof x === "number" && typeof y === "number") {
                        tmp_el = doc.elementsFromPoint(x, y);

                        for (i = 0; i < 5; ++i) {
                            if (tmp_el[i] === doc.body) {
                                break;
                            }

                            if (
                                !tmp_el[i].currentSrc &&
                                tmp_el[i].style.backgroundImage.lastIndexOf(
                                    "url(",
                                    0
                                ) !== 0
                            ) {
                                continue;
                            }

                            var elRect = tmp_el[i].getBoundingClientRect();

                            if (
                                x >= elRect.left &&
                                x < elRect.right &&
                                y >= elRect.top &&
                                y < elRect.bottom
                            ) {
                                var trgRect = trg.getBoundingClientRect();

                                if (
                                    trgRect.left - 10 <= elRect.left &&
                                    trgRect.right + 10 >= elRect.right &&
                                    trgRect.top - 10 <= elRect.top &&
                                    trgRect.bottom + 10 >= elRect.bottom
                                ) {
                                    imgs = PVI.getImages(tmp_el[i], true);
                                }
                            }

                            break;
                        }
                    }

                    if (tmp_el) {
                        tmp_el = null;
                    }

                    attrModNode = n;
                } else {
                    if (n.getAttributeNS) {
                        tmp_el = n.getAttributeNS(
                            "http://www.w3.org/1999/xlink",
                            "href"
                        );

                        if (!tmp_el) {
                            continue;
                        }

                        n = { href: tmp_el };
                    }

                    n.href = PVI.normalizeURL(n.href);
                }

                URL = n.href.replace(PVI.rgxHTTPs, "");

                if (imgs && (URL === imgs.imgSRC || URL === imgs.imgBG)) {
                    break;
                }

                for (i = 0; (rule = cfg.sieve[i]); ++i) {
                    if (!(rule.link && rule.link.test(URL))) {
                        if (!rule.img) {
                            continue;
                        }

                        tmp_el = rule.img.test(URL);

                        if (tmp_el) {
                            use_img = true;
                        } else {
                            continue;
                        }
                    }

                    if (rule.useimg && rule.img) {
                        if (!imgs) {
                            imgs = PVI.getImages(trg);
                        }

                        if (imgs) {
                            if (imgs.imgSRC && rule.img.test(imgs.imgSRC)) {
                                use_img = [i, false];
                                break;
                            }

                            if (imgs.imgBG) {
                                use_img = rule.img.test(imgs.imgBG);

                                if (use_img) {
                                    use_img = [i, use_img];
                                    break;
                                }
                            }
                        }
                    }

                    if (rule.res && (!tmp_el || (!rule.to && rule.url))) {
                        if (
                            win.location.href.replace(rgxHash, "") ===
                            n.href.replace(rgxHash, "")
                        ) {
                            break;
                        }

                        if (PVI.toFunction(rule, "url", true) === false) {
                            return 1;
                        }

                        if (typeof rule.url === "function") {
                            PVI.node = trg;
                        }

                        ret = rule.url
                            ? URL.replace(
                                  rule[tmp_el ? "img" : "link"],
                                  rule.url
                              )
                            : URL;

                        ret = PVI.resolve(
                            PVI.httpPrepend(
                                ret || URL,
                                n.href.slice(0, n.href.length - URL.length)
                            ),
                            {
                                id: i,
                                $: [n.href].concat(
                                    (
                                        URL.match(
                                            rule[tmp_el ? "img" : "link"]
                                        ) || []
                                    ).slice(1)
                                ),
                                loop_param: tmp_el ? "img" : "link",
                                skip_resolve: ret === "",
                            },
                            trg.IMGS_TRG || trg
                        );
                    } else {
                        ret = PVI.replace(
                            rule,
                            URL,
                            n.href,
                            tmp_el ? "img" : "link",
                            trg
                        );
                    }

                    // if PVI.toFunction failed to compile the function
                    if (ret === 1) {
                        return 1;
                    }
                    // empty string returned,
                    // which explicitly says to not show the pop-up,
                    // but if the target is an img, that could be still zoomable
                    else if (ret === 2) {
                        ret = false;
                    }

                    // The target is not strictly the image.
                    // hasAttribute should be used, since some scripts overwrite the src property,
                    // in some cases it could equal to the link's href property.
                    if (
                        typeof ret === "string" &&
                        n !== trg &&
                        trg.hasAttribute("src") &&
                        trg.src.replace(/^https?:\/\//, "") ===
                            ret.replace(/^#?(https?:)?\/\//, "")
                    ) {
                        ret = false;
                    }

                    break;
                }

                break;
            } while (++i < 5 && (n = n.parentNode));

            if (!ret && ret !== null) {
                imgs = PVI.getImages(trg) || imgs;

                if (imgs && (imgs.imgSRC || imgs.imgBG)) {
                    if (typeof use_img === "object") {
                        i = use_img[0];
                        use_img[0] = true;
                    } else {
                        i = 0;
                        use_img = [];
                    }

                    for (; (rule = cfg.sieve[i]); ++i) {
                        if (
                            use_img[0] ||
                            (rule.img &&
                                ((imgs.imgSRC && rule.img.test(imgs.imgSRC)) ||
                                    (imgs.imgBG &&
                                        (use_img[1] = rule.img.test(
                                            imgs.imgBG
                                        )))))
                        ) {
                            if (!use_img[1] && imgs.imgSRC) {
                                use_img = 1;
                                URL = imgs.imgSRC;
                                imgs = imgs.imgSRC_o;
                            } else {
                                use_img = 2;
                                URL = imgs.imgBG;
                                imgs = imgs.imgBG_o;
                            }

                            if (!rule.to && rule.res && rule.url) {
                                if (
                                    PVI.toFunction(rule, "url", true) === false
                                ) {
                                    return 1;
                                }

                                if (typeof rule.url === "function") {
                                    PVI.node = trg;
                                }

                                ret = URL.replace(rule.img, rule.url);
                                ret = PVI.resolve(
                                    PVI.httpPrepend(
                                        ret,
                                        imgs.slice(0, imgs.length - URL.length)
                                    ),
                                    {
                                        id: i,
                                        $: [imgs].concat(
                                            (URL.match(rule.img) || []).slice(1)
                                        ),
                                        loop_param: "img",
                                        skip_resolve: ret === "",
                                    },
                                    trg.IMGS_TRG || trg
                                );
                            } else {
                                ret = PVI.replace(rule, URL, imgs, "img", trg);
                            }

                            if (ret === 1) {
                                return 1;
                            } else if (ret === 2) {
                                return false;
                            }

                            if (trg.nodeType === 1) {
                                attrModNode = trg;

                                if (cfg.hz.history) {
                                    trg.IMGS_nohistory = true;
                                }
                            }

                            break;
                        }
                    }
                }
            }

            if (
                rule &&
                rule.loop &&
                typeof ret === "string" &&
                rule.loop & (use_img ? 2 : 1)
            ) {
                // protection from infinite loop
                if (
                    (trg.nodeType !== 1 && ret === trg.href) ||
                    trg.IMGS_loop_count > 5
                ) {
                    return false;
                }

                rule = ret;
                ret = PVI.find({
                    href: ret,
                    IMGS_TRG: trg.IMGS_TRG || trg,
                    IMGS_loop_count: 1 + (trg.IMGS_loop_count || 0),
                });

                if (ret) {
                    ret = Array.isArray(ret) ? ret.concat(rule) : [ret, rule];
                } else if (ret !== null) {
                    ret = rule;
                }
            }

            // If it was matched by "img" on the link,
            // then fallback to the original link, since the generated URLs may fail.
            if (tmp_el === true) {
                trg.IMGS_fallback_zoom = n.href;
            }

            if (ret && (typeof ret === "string" || Array.isArray(ret))) {
                URL = /^https?:\/\//;
                URL = [
                    n && n.href && n.href.replace(URL, ""),
                    trg.nodeType === 1 &&
                        trg.src &&
                        trg.hasAttribute("src") &&
                        (trg.currentSrc || trg.src).replace(URL, ""),
                ];

                if (typeof ret === "string") {
                    ret = [ret];
                }

                for (i = 0; i < ret.length; ++i) {
                    var url = ret[i].replace(/^#?(https?:)?\/\//, "");

                    if (URL[1] === url) {
                        if (ret[i][0] === "#") {
                            use_img = ret = false;
                            break;
                        }
                    } else if (URL[0] === url) {
                        continue;
                    }

                    // keep the first one
                    if (tmp_el === true) {
                        tmp_el = 1;
                        // remove the rest if there are
                    } else if (tmp_el === 1) {
                        ret.splice(i--, 1);
                    }
                }

                if (!ret.length) {
                    if (trg.IMGS_fallback_zoom) {
                        ret = trg.IMGS_fallback_zoom;
                        delete trg.IMGS_fallback_zoom;
                    } else {
                        ret = false;
                    }
                } else if (ret.length === 1) {
                    ret = ret[0][0] === "#" ? ret[0].slice(1) : ret[0];
                }
            }

            if (trg.nodeType !== 1) {
                return ret;
            }

            imgFallbackCheck: if (
                trg.localName === "img" &&
                trg.hasAttribute("src")
            ) {
                if (ret) {
                    if (
                        ret === (trg.currentSrc || trg.src) &&
                        (!n || !n.href || n !== trg)
                    ) {
                        use_img = ret = false;
                        // If the address was matched by the 'img' parameter,
                        // then consider it as thumbnail
                        // so it can be checked if it's enlargeable
                    } else if (typeof use_img === "number") {
                        use_img = 3;
                    }
                }

                if (rgxIsSVG.test(trg.currentSrc || trg.src)) {
                    break imgFallbackCheck;
                }

                if (trg.parentNode.localName === "picture") {
                    tmp_el = trg.parentNode.querySelectorAll("[srcset]");
                } else if (trg.hasAttribute("srcset")) {
                    tmp_el = [trg];
                } else {
                    tmp_el = [];
                }

                rule = {
                    naturalWidth: trg.naturalWidth,
                    naturalHeight: trg.naturalHeight,
                    src: null,
                };

                for (i = 0; i < tmp_el.length; ++i) {
                    URL = tmp_el[i]
                        .getAttribute("srcset")
                        .trim()
                        .split(/\s*,\s*/);
                    var j = URL.length;

                    while (j--) {
                        var srcItem = URL[j].split(/\s+/);

                        if (srcItem.length !== 2) {
                            continue;
                        }

                        var descriptor = srcItem[1].slice(-1);

                        if (descriptor === "x") {
                            srcItem[1] =
                                trg.naturalWidth * srcItem[1].slice(0, -1);
                        } else if (descriptor === "w") {
                            srcItem[1] = parseInt(srcItem[1], 10);
                        } else {
                            continue;
                        }

                        if (srcItem[1] > rule.naturalWidth) {
                            rule.naturalWidth = srcItem[1];
                            PVI.HLP.href = srcItem[0];
                            rule.src = PVI.HLP.href;
                        }
                    }
                }

                if (rule.src) {
                    rule.naturalHeight *= rule.naturalWidth / trg.naturalWidth;
                }

                if (rule.src && PVI.isEnlargeable(trg, rule)) {
                    rule = rule.src;
                } else if (PVI.isEnlargeable(trg)) {
                    rule = trg.currentSrc || trg.src;
                } else {
                    rule = null;
                }

                // Check if parents have overflow !== visible
                var oParent = trg;
                i = 0;

                do {
                    if (oParent === doc.body || oParent.nodeType !== 1) {
                        break;
                    }

                    tmp_el = win.getComputedStyle(oParent);

                    if (tmp_el.position === "fixed") {
                        break;
                    }

                    if (i === 0) {
                        continue;
                    }

                    if (
                        tmp_el.overflowY === "visible" &&
                        tmp_el.overflowX === "visible"
                    ) {
                        continue;
                    }

                    switch (tmp_el.display) {
                        case "block":
                        case "inline-block":
                        case "flex":
                        case "inline-flex":
                        case "list-item":
                        case "table-caption":
                            break;
                        default:
                            continue;
                    }

                    if (rule) {
                        if (typeof rule !== "string") {
                            rule = null;
                        }

                        trg.IMGS_overflowParent = oParent;
                        break;
                    }

                    if (
                        oParent.offsetWidth <= 32 ||
                        oParent.offsetHeight <= 32
                    ) {
                        continue;
                    }

                    if (!PVI.isEnlargeable(oParent, trg, true)) {
                        continue;
                    }

                    rule = trg.currentSrc || trg.src;
                    trg.IMGS_fallback_zoom = trg.IMGS_fallback_zoom
                        ? [trg.IMGS_fallback_zoom, rule]
                        : rule;
                    break;
                    // Further parents may have overflow,
                    // but hopefully it's rare
                } while (++i < 5 && (oParent = oParent.parentNode));

                if (!rule) {
                    break imgFallbackCheck;
                }

                attrModNode = trg;

                // null || Array.isArray(ret) || Object
                if (typeof ret === "object") {
                    // Can't add to the array,
                    // because if there are low-hi res images
                    // then it would be considered as low-res,
                    // and if the last low-res image is not available,
                    // then it will jump to the thumbnail,
                    // however hi-res is maybe available
                    if (trg.IMGS_fallback_zoom !== rule) {
                        trg.IMGS_fallback_zoom = trg.IMGS_fallback_zoom
                            ? [trg.IMGS_fallback_zoom, rule]
                            : rule;
                    }
                } else if (ret) {
                    if (ret !== rule) {
                        ret = [ret, rule];
                    }
                } else {
                    ret = rule;

                    if (cfg.hz.history) {
                        trg.IMGS_nohistory = true;
                    }
                }
            }

            if (!ret && ret !== null) {
                if (attrModNode) {
                    PVI.listen_attr_changes(attrModNode);
                }

                return ret;
            }

            if (use_img && imgs) {
                if (use_img === 2) {
                    trg.IMGS_thumb_ok = true;
                }

                trg.IMGS_thumb = imgs;
            } else if (use_img === 3) {
                trg.IMGS_thumb = true;
            }

            tmp_el = n && n.href ? (n.textContent || "").trim() : null;

            if (tmp_el === n.href) {
                tmp_el = null;
            }

            i = 0;
            n = trg;

            do {
                if (
                    n.IMGS_caption ||
                    (n.title &&
                        (!trg.hasAttribute("src") || trg.src !== n.title))
                ) {
                    trg.IMGS_caption = n.IMGS_caption || n.title;
                }

                // For other browsers it's enough to set an empty title on the target
                if (i === 0 && !cfg.hz.capNoSBar) {
                    trg.title = "";
                }

                if (trg.IMGS_caption) {
                    break;
                }
            } while (++i <= 5 && (n = n.parentNode) && n.nodeType === 1);

            if (!trg.IMGS_caption) {
                if (trg.alt && trg.alt !== trg.src && trg.alt !== imgs) {
                    trg.IMGS_caption = trg.alt;
                } else if (tmp_el && cfg.hz.capLinkText) {
                    trg.IMGS_caption = tmp_el;
                }
            }

            if (trg.IMGS_caption) {
                if (
                    (!cfg.hz.capLinkText && trg.IMGS_caption === tmp_el) ||
                    trg.IMGS_caption === trg.href
                ) {
                    delete trg.IMGS_caption;
                } else {
                    PVI.prepareCaption(trg, trg.IMGS_caption);
                }
            }

            if (attrModNode) {
                PVI.listen_attr_changes(attrModNode);
            }

            return ret;
        },
        delayed_loader: function () {
            if (PVI.TRG && PVI.state < 4) {
                PVI.show(PVI.LDR_msg, true);
            }
        },
        show: function (msg, delayed) {
            if (PVI.iFrame) {
                win.parent.postMessage(
                    {
                        vdfDpshPtdhhd: "from_frame",
                        msg: msg,
                    },
                    "*"
                );
                return;
            }

            if (!delayed && typeof msg === "string") {
                PVI.DIV.style.display = "none";
                PVI.HD_cursor(true);
                PVI.BOX = PVI.LDR;
                PVI.LDR.style.backgroundColor =
                    cfg.hz.LDRbgOpacity < 100
                        ? PVI.palette[msg].replace(
                              /\(([^\)]+)/,
                              "a($1, " + cfg.hz.LDRbgOpacity / 100
                          )
                        : PVI.palette[msg];

                if (cfg.hz.LDRdelay > 20) {
                    clearTimeout(PVI.timers.delayed_loader);

                    // Errors (msg starting with capital R) shouldn't be delayed,
                    // only loader that actually indicates loading
                    if (msg[0] !== "R" && PVI.state !== 3 && !PVI.fullZm) {
                        PVI.state = 3;
                        PVI.LDR_msg = msg;
                        PVI.timers.delayed_loader = setTimeout(
                            PVI.delayed_loader,
                            cfg.hz.LDRdelay
                        );
                        return;
                    }
                }
            }

            var box;

            if (msg) {
                if (PVI.state === 2 && cfg.hz.waitHide) {
                    return;
                }

                viewportDimensions();

                // Fixes sizing and positioning when HTML has different CSS zoom
                /*if ( !platform.firefox && !platform.opera ) {
				box = win.getComputedStyle(doc.documentElement).zoom;

				if ( box !== '1' ) {
					PVI.DIV.style.zoom = 1 / box;
				} else if ( PVI.DIV.style.zoom ) {
					PVI.DIV.style.zoom = '';
				}
			}*/

                // LDR_msg is present with delayedLoader,
                // which is not exactly state 3
                if (PVI.state < 3 || PVI.LDR_msg) {
                    PVI.LDR_msg = null;
                    win.addEventListener(platform["wheel"], PVI.wheeler, {
                        capture: true,
                        passive: false,
                    });
                }

                if (msg === true) {
                    PVI.BOX = PVI.DIV;
                    PVI.LDR.style.display = "none";

                    if (cfg.hz.LDRanimate) {
                        PVI.LDR.style.opacity = "0";
                    }

                    PVI.CNT.style.display = "block";
                    (PVI.CNT === PVI.IMG ? PVI.VID : PVI.IMG).style.display =
                        "none";

                    if (typeof PVI.DIV.cursor_hide === "function") {
                        PVI.DIV.cursor_hide();
                    }
                } else if (PVI.state < 4) {
                    if (PVI.anim.left || PVI.anim.top) {
                        PVI.DIV.style.left = PVI.x + "px";
                        PVI.DIV.style.top = PVI.y + "px";
                    }

                    if (PVI.anim.width || PVI.anim.height) {
                        PVI.DIV.style.width = PVI.DIV.style.height = "0";
                    }
                }

                box = PVI.BOX.style;

                if (
                    (PVI.state < 3 || PVI.BOX === PVI.LDR) &&
                    box.display === "none" &&
                    (((PVI.anim.left || PVI.anim.top) && PVI.BOX === PVI.DIV) ||
                        (cfg.hz.LDRanimate && PVI.BOX === PVI.LDR))
                ) {
                    PVI.show(null);
                }

                box.display = "block";

                if (
                    box.opacity === "0" &&
                    ((PVI.BOX === PVI.DIV && PVI.anim.opacity) ||
                        (PVI.BOX === PVI.LDR && cfg.hz.LDRanimate))
                ) {
                    if (PVI.state === 2) {
                        PVI.anim.opacityTransition();
                    } else {
                        setTimeout(PVI.anim.opacityTransition, 0);
                    }
                }

                PVI.state = PVI.BOX === PVI.LDR ? 3 : 4;
                /*box = doc.activeElement;

			if (box !== PVI.INP && !box.isContentEditable &&
				!(((box = box.nodeName.toUpperCase()) && (box[2] === 'X' || box === 'INPUT')))
				&& win.getSelection().isCollapsed) {
				if (!PVI.INP.parentNode) {
					doc.body.appendChild(PVI.INP);
				}

				PVI.INP.focus();
			}*/
            }

            var x = PVI.x;
            var y = PVI.y;
            var rSide = winW - x;
            var bSide = winH - y;
            var left, top, rot, w, h, ratio;

            if ((msg === void 0 && PVI.state === 4) || msg === true) {
                msg = false;

                if (PVI.TRG.IMGS_SVG) {
                    h = PVI.stack[PVI.IMG.src];
                    w = h[0];
                    h = h[1];
                }
                // Opera 12.?? gives 0 here, even if there was a value in the caller function
                else if ((w = PVI.CNT.naturalWidth)) {
                    h = PVI.CNT.naturalHeight;
                } else {
                    msg = true;
                }
            }

            if (PVI.fullZm) {
                if (!PVI.BOX) {
                    PVI.BOX = PVI.LDR;
                }

                if (msg === false) {
                    box = PVI.DIV.style;
                    box.visibility = "hidden";
                    PVI.resize(0);
                    PVI.m_move();
                    box.visibility = "visible";
                    PVI.updateCaption();
                } else {
                    PVI.m_move();
                }

                return;
            }

            if (msg === false) {
                rot = PVI.DIV.curdeg % 180 !== 0;

                if (rot) {
                    ratio = w;
                    w = h;
                    h = ratio;
                }

                if (cfg.hz.placement === 3) {
                    box = PVI.TBOX;
                    x = box.left;
                    y = box.top;
                    rSide = winW - box.right;
                    bSide = winH - box.bottom;
                }

                box = PVI.DBOX;
                ratio = w / h;

                var fs = cfg.hz.fullspace || cfg.hz.placement === 2,
                    cap_size =
                        PVI.CAP &&
                        PVI.CAP.overhead &&
                        !(PVI.DIV.curdeg % 360) &&
                        PVI.CAP.state !== 0 &&
                        (PVI.CAP.state === 2 ||
                            (PVI.TRG.IMGS_caption && cfg.hz.capText) ||
                            PVI.TRG.IMGS_album ||
                            cfg.hz.capWH)
                            ? PVI.CAP.overhead
                            : 0,
                    vH = box["wm"] + (rot ? box["hpb"] : box["wpb"]),
                    hH = box["hm"] + (rot ? box["wpb"] : box["hpb"]) + cap_size,
                    vW = Math.min(
                        cfg.hz.maxw != -1 ? cfg.hz.maxw : w,
                        (fs ? winW : x < rSide ? rSide : x) - vH
                    ),
                    hW = Math.min(
                        cfg.hz.maxw != -1 ? cfg.hz.maxw : w,
                        winW - vH
                    );

                vH = Math.min(cfg.hz.maxh != -1 ? cfg.hz.maxh : h, winH - hH);
                hH = Math.min(
                    cfg.hz.maxh != -1 ? cfg.hz.maxh : h,
                    (fs ? winH : y < bSide ? bSide : y) - hH
                );

                if ((fs = vW / ratio) > vH) {
                    vW = vH * ratio;
                } else {
                    vH = fs;
                }

                if ((fs = hH * ratio) > hW) {
                    hH = hW / ratio;
                } else {
                    hW = fs;
                }

                if (hW > vW) {
                    w = Math.round(hW);
                    h = Math.round(hH);
                } else {
                    w = Math.round(vW);
                    h = Math.round(vH);
                }

                vW = w + box["wm"] + (rot ? box["hpb"] : box["wpb"]);
                vH = h + box["hm"] + (rot ? box["wpb"] : box["hpb"]) + cap_size;

                hW = PVI.TRG !== PVI.HLP && cfg.hz.minPopupDistance;

                switch (cfg.hz.placement) {
                    case 1: // cursor at side of the image
                        // is in horizontal area? (prefer vertical)
                        hH = (x < rSide ? rSide : x) < vW;

                        // with full-space prefer vertical if there is more or enough space than in horizontal
                        if (
                            hH &&
                            cfg.hz.fullspace &&
                            (winH - vH <= winW - vW ||
                                vW <= (x < rSide ? rSide : x))
                        ) {
                            hH = false;
                        }

                        left = x - (hH ? vW / 2 : x < rSide ? 0 : vW);
                        top = y - (hH ? (y < bSide ? 0 : vH) : vH / 2);
                        break;
                    case 2: // pop-up at center
                        left = (winW - vW) / 2;
                        top = (winH - vH) / 2;
                        hW = false;
                        break;
                    case 3: // no cover
                        // use the larger available space, except if the cursor lays on the image,
                        // and there is enough space on the other side, then move to that side
                        left =
                            x < rSide || (vW >= PVI.x && winW - PVI.x >= vW)
                                ? PVI.TBOX.right
                                : x - vW;
                        top =
                            y < bSide || (vH >= PVI.y && winH - PVI.y >= vH)
                                ? PVI.TBOX.bottom
                                : y - vH;

                        // determine if it fits into horizontal area, however prefer vertical
                        hH =
                            (x < rSide ? rSide : x) < vW ||
                            // if vertical was chosen, but it fits into horizontal area
                            ((y < bSide ? bSide : y) >= vH &&
                                winW >= vW &&
                                // then prefer horizontal, if the width of target element is larger than half of the screen
                                // or if the image (or to be correct; the space left to the image (right not checked))
                                // is too far from the cursor, which is screen width / ?
                                (PVI.TBOX.width >= winW / 2 ||
                                    Math.abs(PVI.x - left) >= winW / 3.5));

                        if (
                            !cfg.hz.fullspace ||
                            (hH
                                ? vH <= (y < bSide ? bSide : y)
                                : vW <= (x < rSide ? rSide : x))
                        ) {
                            fs = PVI.TBOX.width / PVI.TBOX.height;

                            if (hH) {
                                left =
                                    (PVI.TBOX.left + PVI.TBOX.right - vW) / 2;

                                if (fs > 10) {
                                    left =
                                        x < rSide
                                            ? Math.max(left, PVI.TBOX.left)
                                            : Math.min(
                                                  left,
                                                  PVI.TBOX.right - vW
                                              );
                                }
                            } else {
                                top = (PVI.TBOX.top + PVI.TBOX.bottom - vH) / 2;

                                if (fs < 0.1) {
                                    top =
                                        y < bSide
                                            ? Math.min(top, PVI.TBOX.top)
                                            : Math.min(
                                                  top,
                                                  PVI.TBOX.bottom - vH
                                              );
                                }
                            }
                        }
                        break;
                    case 4: // cursor at pop-up center
                        left = x - vW / 2;
                        top = y - vH / 2;
                        hW = false;
                        break;
                    default: // cursor at corner of the image
                        hH = null;
                        left = x - (x < rSide ? Math.max(0, vW - rSide) : vW);
                        top = y - (y < bSide ? Math.max(0, vH - bSide) : vH);
                }

                if (hW) {
                    if (hH || (x < rSide ? rSide : x) < vW || winH < vH) {
                        hH = y < bSide ? box["mt"] : box["mb"];

                        if (hW > hH) {
                            hW -= hH;
                            top += y < bSide ? hW : -hW;
                        }
                    } else {
                        hH = x < rSide ? box["ml"] : box["mr"];

                        if (hW > hH) {
                            hW -= hH;
                            left += x < rSide ? hW : -hW;
                        }
                    }
                }

                left = left < 0 ? 0 : left > winW - vW ? winW - vW : left;
                top = top < 0 ? 0 : top > winH - vH ? winH - vH : top;

                if (cap_size && !cfg.hz.capPos) {
                    top += cap_size;
                }

                if (rot) {
                    rot = w;
                    w = h;
                    h = rot;

                    rot = (vW - vH) / 2;
                    left += rot;
                    top -= rot;
                }

                PVI.DIV.style.width = w + "px";
                PVI.DIV.style.height = h + "px";
                PVI.updateCaption();
            } else {
                if (cfg.hz.placement === 1) {
                    left = cfg.hz.minPopupDistance;
                    top = PVI.LDR.wh[1] / 2;
                } else {
                    left = 13;
                    top = y < bSide ? -13 : PVI.LDR.wh[1] + 13;
                }

                left = x - (x < rSide ? -left : PVI.LDR.wh[0] + left);
                top = y - top;
            }

            if (left !== void 0) {
                PVI.BOX.style.left = left + "px";
                PVI.BOX.style.top = top + "px";
            }
        },
        album: function (idx, manual) {
            var s, i;

            if (!PVI.TRG || !PVI.TRG.IMGS_album) {
                return;
            }

            var album = PVI.stack[PVI.TRG.IMGS_album];

            if (!album || album.length < 2) {
                return;
            }

            if (!PVI.fullZm && PVI.timers.no_anim_in_album) {
                clearInterval(PVI.timers.no_anim_in_album);
                PVI.timers.no_anim_in_album = null;
                PVI.DIV.style[platform["transition"]] = "all 0s";
            }

            switch (typeof idx) {
                case "boolean":
                    idx = idx ? 1 : album.length - 1;
                    break;
                case "number":
                    idx = album[0] + (idx || 0);
                    break;
                default:
                    if (/^[+-]?\d+$/.test(idx)) {
                        i = parseInt(idx, 10);
                        idx =
                            idx[0] === "+" || idx[0] === "-"
                                ? album[0] + i
                                : i || 1;
                    } else {
                        idx = idx.trim();

                        if (!idx) {
                            return;
                        }

                        idx = RegExp(idx, "i");
                        s = album[0];
                        i = s + 1;

                        for (
                            i = i < album.length ? i : 1;
                            i !== s;
                            ++i < album.length ? 0 : (i = 1)
                        ) {
                            // if the caption has a HTML entity, and the search is a number,
                            // then it may match it, without actually seeing any number in the caption
                            if (album[i][1] && idx.test(album[i][1])) {
                                idx = i;
                                break;
                            }
                        }

                        if (typeof idx !== "number") {
                            return;
                        }
                    }
            }

            if (cfg.hz.pileCycle) {
                s = album.length - 1;
                idx = idx % s || s;
                idx = idx < 0 ? s + idx : idx;
            } else {
                idx = Math.max(1, Math.min(idx, album.length - 1));
            }

            s = album[0];

            if (s === idx && manual && PVI.state > 3) {
                return;
            }

            album[0] = idx;

            PVI.resetNode(PVI.TRG, true);

            PVI.CAP.style.display = "none";
            PVI.CAP.firstChild.textContent = idx + " / " + (album.length - 1);

            if (cfg.hz.capText) {
                PVI.prepareCaption(PVI.TRG, album[idx][1]);
            }

            PVI.set(album[idx][0]);

            // preload direction
            s =
                (s <= idx && !(s === 1 && idx === album.length - 1)) ||
                (s === album.length - 1 && idx === 1)
                    ? 1
                    : -1;
            i = 0;

            // pre-loading next few images depending on the pre-load setting
            // no pre-load and minimal - next 2 image, the rest - next 4 images ...
            var until = cfg.hz.preload < 3 ? 1 : 3;

            while (i++ <= until) {
                if (!album[idx + i * s] || idx + i * s < 1) {
                    return;
                }

                PVI._preload(album[idx + i * s][0]);
            }
        },
        set: function (src) {
            var i, src_left, src_HD;

            if (!src) {
                return;
            }

            if (PVI.iFrame) {
                i = PVI.TRG;
                win.parent.postMessage(
                    {
                        vdfDpshPtdhhd: "from_frame",
                        src: src,
                        thumb: i.IMGS_thumb
                            ? [i.IMGS_thumb, i.IMGS_thumb_ok]
                            : null,
                        album: i.IMGS_album
                            ? {
                                  id: i.IMGS_album,
                                  list: PVI.stack[i.IMGS_album],
                              }
                            : null,
                        caption: i.IMGS_caption,
                    },
                    "*"
                );

                return;
            }

            clearInterval(PVI.timers.onReady);
            PVI.create();

            if (Array.isArray(src)) {
                if (!src.length) {
                    PVI.show("R_load");
                    return;
                }

                src_left = [];
                src_HD = [];

                for (i = 0; i < src.length; ++i) {
                    if (!src[i]) {
                        continue;
                    }

                    if (src[i][0] === "#") {
                        src_HD.push(PVI.httpPrepend(src[i].slice(1)));
                    } else {
                        src_left.push(PVI.httpPrepend(src[i]));
                    }
                }

                if (!src_left.length) {
                    src_left = src_HD;
                } else if (src_HD.length) {
                    PVI.TRG.IMGS_HD = cfg.hz.hiRes;
                    i = cfg.hz.hiRes ? src_left : src_HD;
                    PVI.TRG.IMGS_HD_stack = i.length > 1 ? i : i[0];
                    src_left = cfg.hz.hiRes ? src_HD : src_left;
                }

                PVI.TRG.IMGS_c_resolved = src_left;
                src = src_left[0];
            } else if (src[0] === "#") {
                src = src.slice(1);
            }

            if (src[1] === "/") {
                src = PVI.httpPrepend(src);
            }

            // Resolved URLs may contain &amp;
            if (src.indexOf("&amp;") !== -1) {
                src = src.replace(/&amp;/g, "&");
            }

            if (rgxIsSVG.test(src)) {
                PVI.TRG.IMGS_SVG = true;
            } else {
                delete PVI.TRG.IMGS_SVG;
            }

            if (src === PVI.CNT.src) {
                PVI.checkContentRediness(src);
                return;
            }

            if (
                /^[^?#]+\.(?:m(?:4[abprv]|p[34g]|ov)|og[agv]|webm|3gp|avi|asf|flv|mkv|mpeg|rm|ts|wmv)(?:$|[?#])/.test(
                    src
                ) ||
                /#(mp[34]|og[gv]|webm|mov|3gp|avi|asf|flv|mkv|mpeg|mpg|rm|ts|wmv)$/.test(
                    src
                )
            ) {
                PVI.CNT = PVI.VID;
                PVI.show("load");
                PVI.VID.naturalWidth = 0;
                PVI.VID.naturalHeight = 0;
                PVI.VID.src = src;
                PVI.VID.load();
                return;
            }

            if (PVI.CNT !== PVI.IMG) {
                PVI.CNT = PVI.IMG;
                PVI.VID.removeAttribute("src");
                PVI.VID.load();
            }

            if (cfg.hz.thumbAsBG) {
                if (PVI.interlacer) {
                    PVI.interlacer.style.display = "none";
                }

                PVI.CNT.loaded = PVI.TRG.IMGS_SVG || PVI.stack[src] === 1;
            }

            if (!PVI.TRG.IMGS_SVG && !PVI.stack[src] && cfg.hz.preload === 1) {
                new Image().src = src;
            }

            PVI.CNT.removeAttribute("src");

            if (PVI.TRG.IMGS_SVG && !PVI.stack[src]) {
                var svg = doc.createElement("img");
                svg.style.cssText = [
                    "position: fixed",
                    "visibility: hidden",
                    "max-width: 500px",
                    "",
                ].join(" !important;");
                svg.onerror = PVI.content_onerror;
                svg.src = src;
                svg.counter = 0;

                PVI.timers.onReady = setInterval(function () {
                    if (svg.width || svg.counter++ > 300) {
                        var ratio = svg.width / svg.height;
                        clearInterval(PVI.timers.onReady);
                        doc.body.removeChild(svg);
                        svg = null;

                        if (ratio) {
                            PVI.stack[src] = [
                                win.screen.width,
                                Math.round(win.screen.width / ratio),
                            ];
                            PVI.IMG.src = src;
                            PVI.assign_src();
                        } else {
                            PVI.show("Rload");
                        }
                    }
                }, 100);
                doc.body.appendChild(svg);
                PVI.show("load");
                return;
            }

            PVI.CNT.src = src;
            PVI.checkContentRediness(src, true);
        },
        checkContentRediness: function (src, showLoader) {
            if (PVI.CNT.naturalWidth || (PVI.TRG.IMGS_SVG && PVI.stack[src])) {
                PVI.assign_src();
                return;
            }

            if (showLoader) {
                PVI.show("load");
            }

            PVI.timers.onReady = setInterval(
                PVI.content_onready,
                PVI.CNT === PVI.IMG ? 100 : 300
            );
        },
        content_onready: function () {
            if (!PVI.CNT || !PVI.fireHide) {
                clearInterval(PVI.timers.onReady);

                // in Firefox sometimes the media started playing
                // even if the showing of the pop-up was canceled
                if (!PVI.fireHide) {
                    PVI.reset();
                }

                return;
            }

            if (PVI.CNT === PVI.VID) {
                // NaN if duration is not avaialble
                if (!PVI.VID.duration) {
                    if (PVI.VID.readyState > PVI.VID.HAVE_NOTHING) {
                        PVI.content_onerror.call(PVI.VID);
                    }
                    return;
                }

                PVI.VID.naturalWidth = PVI.VID.videoWidth || 300;
                PVI.VID.naturalHeight = PVI.VID.videoHeight || 40;
                PVI.VID.audio = !PVI.VID.videoHeight;
                PVI.VID.loop = !PVI.VID.duration || PVI.VID.duration <= 60;

                if (PVI.VID.audio) {
                    PVI.VID._controls = PVI.VID.controls;
                    PVI.VID.controls = true;
                } else {
                    PVI.VID.controls = PVI.fullZm ? true : PVI.VID._controls;
                }

                var autoplay = PVI.VID.autoplay;

                // Starts the video if media.autoplay.enabled is set to false in Firefox
                if (autoplay && PVI.VID.paused) {
                    PVI.VID.play();
                }

                // Helps Opera to make the controls visible on audio,
                // also in some cases the media fails to start, so give it a push
                if (autoplay && platform.opera) {
                    setTimeout(function () {
                        if (PVI.VID.paused) {
                            return;
                        }

                        if (!PVI.VID.audio && PVI.VID.currentTime >= 0.5) {
                            return;
                        }

                        PVI.VID.pause();
                        PVI.VID.play();
                    }, 1500);
                }
            } else if (!PVI.IMG.naturalWidth) {
                return;
            }

            clearInterval(PVI.timers.onReady);
            PVI.assign_src();
        },
        content_onerror: function () {
            clearInterval(PVI.timers.onReady);

            if (!PVI.TRG || this !== PVI.CNT) {
                return;
            }

            var src_left;
            var t = PVI.TRG;
            var src_res_arr = t.IMGS_c_resolved;
            var src = this.src;

            if (!src) {
                return;
            }

            this.removeAttribute("src");

            do {
                src_left = Array.isArray(src_res_arr)
                    ? src_res_arr.shift()
                    : null;
            } while (src_left === src);

            if (!src_res_arr || !src_res_arr.length) {
                if (src_left) {
                    t.IMGS_c_resolved = src_left;
                } else {
                    delete t.IMGS_c_resolved;
                }
            }

            if (src_left && !src_left.URL) {
                PVI.set(src_left);
            } else if (t.IMGS_HD_stack) {
                src_left = t.IMGS_HD_stack;
                delete t.IMGS_HD_stack;
                delete t.IMGS_HD;
                PVI.set(src_left);
            } else if (t.IMGS_fallback_zoom) {
                PVI.set(t.IMGS_fallback_zoom);
                delete t.IMGS_fallback_zoom;
            } else {
                if (PVI.CAP) {
                    PVI.CAP.style.display = "none";
                }

                delete t.IMGS_c_resolved;
                PVI.show("R_load");
            }

            console.info(
                app.name +
                    ": [" +
                    (this.audio ? "AUDIO" : this.nodeName) +
                    "] Load error > " +
                    src
            );
        },
        content_onload: function (e) {
            if (cfg.hz.thumbAsBG) {
                this.loaded = true;
            }

            if (PVI.TRG) {
                delete PVI.TRG.IMGS_c_resolved;
            }

            if (PVI.stack[this.src] && !(PVI.TRG || e).IMGS_SVG) {
                PVI.stack[this.src] = 1;
            }

            if (PVI.interlacer) {
                PVI.interlacer.style.display = "none";
            }
        },
        history: function (manual) {
            var url, i, n;

            if (
                !PVI.CNT ||
                !PVI.TRG ||
                (platform.crx && chrome.extension.inIncognitoContext) ||
                platform.maxthon
            ) {
                return;
            }

            if (manual) {
                cfg.hz.history = !cfg.hz.history;
                return;
            }

            manual = manual !== void 0;

            if (!manual && PVI.TRG.IMGS_nohistory) {
                return;
            }

            if (PVI.TRG.IMGS_album) {
                url = PVI.stack[PVI.TRG.IMGS_album];

                if (
                    !manual &&
                    (url.in_history || (url.length > 4 && url[0] === 1))
                ) {
                    return;
                }

                url.in_history = !url.in_history;
            }

            n = PVI.TRG;
            i = 0;

            do {
                if (n.localName !== "a") {
                    continue;
                }

                url = n.href;

                if (url && url.baseVal) {
                    url = url.baseVal;
                }

                break;
            } while (++i < 5 && (n = n.parentNode) && n.nodeType === 1);

            if (!url) {
                return;
            }

            if (!platform.opera && !platform.safari) {
                Port.send({
                    cmd: "history",
                    url: url,
                    manual: manual,
                });
                return;
            }

            n = function () {
                var i = doc.createElement("iframe");
                i.style.cssText = [
                    "position: fixed",
                    "visibility: hidden",
                    "height: 1px",
                    "",
                ].join("!important;");
                i.onload = function () {
                    this.onload = null;

                    if (platform.opera) {
                        this.parentNode.removeChild(this);
                        return;
                    }

                    setTimeout(function () {
                        i.parentNode.removeChild(i);
                    }, 800);
                };
                doc.body.appendChild(i);
                i.src = url;
            };

            if (platform.safari) {
                n();
                return;
            }

            setTimeout(n, Math.min(PVI.anim.maxDelay, 500));
        },
        HD_cursor: function (reset) {
            if (
                !PVI.TRG ||
                (!reset && (cfg.hz.capWH || PVI.TRG.IMGS_HD === void 0))
            ) {
                return;
            }

            if (reset) {
                if (PVI.DIV) {
                    PVI.DIV.style.cursor = "";
                }

                if (PVI.lastTRGStyle.cursor !== null) {
                    PVI.TRG.style.cursor = PVI.lastTRGStyle.cursor;
                    PVI.lastTRGStyle.cursor = null;
                }
            } else {
                if (PVI.lastTRGStyle.cursor === null) {
                    PVI.lastTRGStyle.cursor = PVI.TRG.style.cursor;
                }

                PVI.DIV.style.cursor = PVI.TRG.style.cursor = "crosshair";
            }
        },
        isEnlargeable: function (img, oImg, isOverflow) {
            if (PVI.CNT && PVI.CNT !== PVI.IMG) {
                return true;
            }

            if (!oImg) {
                oImg = img;
            }

            var w = img.clientWidth;
            var h = img.clientHeight;
            var ow = oImg.naturalWidth;
            var oh = oImg.naturalHeight;

            if ((ow <= 64 && oh <= 64 && !isOverflow) || ow <= 1 || oh <= 1) {
                return false;
            }

            if (isOverflow) {
                w = img.getBoundingClientRect();
                ow = oImg.getBoundingClientRect();

                if (
                    ow.right - 10 > w.right ||
                    ow.bottom - 10 > w.bottom ||
                    ow.left + 10 < w.left ||
                    ow.top + 10 < w.top
                ) {
                    return true;
                }

                return false;
            }

            if (img === oImg) {
                // Ignore downscaled images which size is half of the original
                // These are usually design elements for high resolution screens
                if (
                    ow < 600 &&
                    oh < 600 &&
                    Math.abs(ow / 2 - (img.width || w)) < 8 &&
                    Math.abs(oh / 2 - (img.height || h)) < 8
                ) {
                    return false;
                }
                // Since the original image might be animated,
                // always zoom GIFs and APNGs,
                // even if the original image isn't larger than the thumbnail
            } else if (/^[^?#]+\.(?:gif|apng)(?:$|[?#])/.test(oImg.src)) {
                return true;
            }

            if ((w >= ow || h >= oh) && Math.abs(ow / oh - w / h) <= 0.2) {
                return false;
            }

            return (
                (w < topWinW * 0.9 &&
                    100 - (w * 100) / ow >= cfg.hz.zoomresized) ||
                (h < topWinH * 0.9 &&
                    100 - (h * 100) / oh >= cfg.hz.zoomresized)
            );
        },
        not_enlargeable: function () {
            PVI.resetNode(PVI.TRG);
            PVI.TRG.IMGS_c = true;
            PVI.reset();

            if (!cfg.hz.markOnHover) {
                return;
            }

            if (cfg.hz.markOnHover === "cr") {
                PVI.lastTRGStyle.cursor = PVI.TRG.style.cursor;
                PVI.TRG.style.cursor = "not-allowed";
                return;
            }

            if (PVI.lastTRGStyle.outline === null) {
                PVI.lastTRGStyle.outline = PVI.TRG.style.outline;
            }

            PVI.lastScrollTRG = PVI.TRG;
            PVI.TRG.style.outline = "1px solid purple";
        },
        keytab: function (e) {
            if (PVI.TRG.IMGS_HD_stack) {
                if (PVI.CAP) {
                    PVI.CAP.style.display = "none";
                }

                PVI.TRG.IMGS_HD = !PVI.TRG.IMGS_HD;
                var key = PVI.TRG.IMGS_c || PVI.TRG.IMGS_c_resolved;
                delete PVI.TRG.IMGS_c;
                PVI.set(PVI.TRG.IMGS_HD_stack);
                PVI.TRG.IMGS_HD_stack = key;
            }

            if (e.shiftKey) {
                cfg.hz.hiRes = !cfg.hz.hiRes;
            }
        },
        assign_src: function () {
            if (!PVI.TRG || PVI.switchToHiResInFZ()) {
                return;
            }

            if (PVI.TRG.IMGS_album) {
                delete PVI.TRG.IMGS_thumb;
                delete PVI.TRG.IMGS_thumb_ok;

                if (PVI.interlacer) {
                    PVI.interlacer.style.display = "none";
                }
            } else if (!PVI.TRG.IMGS_SVG) {
                if (
                    PVI.TRG !== PVI.HLP &&
                    PVI.TRG.IMGS_thumb &&
                    !PVI.isEnlargeable(PVI.TRG, PVI.IMG)
                ) {
                    if (PVI.TRG.IMGS_HD_stack && !PVI.TRG.IMGS_HD) {
                        PVI.show("load");
                        PVI.keytab();
                        return;
                    }

                    if (!PVI.TRG.IMGS_fallback_zoom) {
                        PVI.not_enlargeable();
                        return;
                    }

                    PVI.TRG.IMGS_thumb = false;
                }

                if (
                    PVI.CNT === PVI.IMG &&
                    !PVI.IMG.loaded &&
                    cfg.hz.thumbAsBG &&
                    PVI.TRG.IMGS_thumb !== false &&
                    !PVI.TRG.IMGS_album
                ) {
                    var inner_thumb, w, h;

                    if (typeof PVI.TRG.IMGS_thumb !== "string") {
                        PVI.TRG.IMGS_thumb = null;

                        if (PVI.TRG.hasAttribute("src")) {
                            PVI.TRG.IMGS_thumb = PVI.TRG.src;
                        } else if (PVI.TRG.childElementCount) {
                            inner_thumb = PVI.TRG.querySelector("img[src]");

                            if (inner_thumb) {
                                PVI.TRG.IMGS_thumb = inner_thumb.src;
                            }
                        }
                    }

                    if (PVI.TRG.IMGS_thumb === PVI.IMG.src) {
                        delete PVI.TRG.IMGS_thumb;
                        delete PVI.TRG.IMGS_thumb_ok;
                    } else if (PVI.TRG.IMGS_thumb) {
                        w = true;

                        if (!PVI.TRG.IMGS_thumb_ok) {
                            w = (inner_thumb || PVI.TRG).clientWidth;
                            h = (inner_thumb || PVI.TRG).clientHeight;
                            PVI.TRG.IMGS_thumb_ok =
                                Math.abs(
                                    PVI.IMG.naturalWidth /
                                        PVI.IMG.naturalHeight -
                                        w / h
                                ) <= 0.2;

                            w =
                                w < 1024 &&
                                h < 1024 &&
                                w < PVI.IMG.naturalWidth &&
                                h < PVI.IMG.naturalHeight;
                        }

                        if (w && PVI.TRG.IMGS_thumb_ok) {
                            if (PVI.interlacer) {
                                w = PVI.interlacer.style;
                            } else {
                                PVI.interlacer = doc.createElement("div");
                                h = PVI.interlacer;

                                if (cfg.hz.thumbAsBGOpacity > 0) {
                                    w = parseInt(
                                        cfg.hz.thumbAsBGColor.slice(1),
                                        16
                                    );
                                    h.appendChild(
                                        doc.createElement("div")
                                    ).style.cssText =
                                        "width: 100%; height: 100%; background-color: rgba(" +
                                        (w >> 16) +
                                        "," +
                                        ((w >> 8) & 0xff) +
                                        "," +
                                        (w & 0xff) +
                                        "," +
                                        parseFloat(cfg.hz.thumbAsBGOpacity) +
                                        ")";
                                }

                                w = h.style;
                                w.cssText =
                                    "position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-size: 100% 100%; background-repeat: no-repeat";
                                PVI.DIV.insertBefore(h, PVI.IMG);
                            }

                            w.backgroundImage =
                                "url(" + PVI.TRG.IMGS_thumb + ")";
                            w.display = "block";
                        }

                        delete PVI.TRG.IMGS_thumb;
                        delete PVI.TRG.IMGS_thumb_ok;
                    }
                }
            }

            delete PVI.TRG.IMGS_c_resolved;
            PVI.TRG.IMGS_c = PVI.CNT.src;

            // Opera would always show the SVG that was first loaded
            if (platform.opera && PVI.TRG.IMGS_SVG) {
                PVI.DIV.replaceChild(PVI.IMG, PVI.IMG);
            }

            if (!PVI.TRG.IMGS_SVG) {
                PVI.stack[PVI.IMG.src] = true;
            }

            PVI.show(true);
            PVI.HD_cursor(PVI.TRG.IMGS_HD !== false);

            if (cfg.hz.history) {
                PVI.history();
            }

            if (!PVI.fullZm && PVI.anim.maxDelay && PVI.TRG.IMGS_album) {
                PVI.timers.no_anim_in_album = setTimeout(function () {
                    PVI.DIV.style[platform["transition"]] = PVI.anim.css;
                }, 100);
            }
        },
        hide: function (e) {
            PVI.HD_cursor(true);
            PVI.fireHide = false;

            if (PVI.iFrame) {
                win.parent.postMessage(
                    {
                        vdfDpshPtdhhd: "from_frame",
                        hide: true,
                    },
                    "*"
                );
                return;
            } else {
                win.removeEventListener("mousemove", PVI.m_move, true);
            }

            if (PVI.state < 3 || PVI.LDR_msg || PVI.state === null) {
                if (PVI.state >= 2) {
                    PVI.reset();
                }

                return;
            }

            var animDIV = PVI.BOX === PVI.DIV && PVI.anim.maxDelay;
            var animLDR = PVI.BOX === PVI.LDR && cfg.hz.LDRanimate;

            if ((!animDIV && !animLDR) || PVI.fullZm) {
                if (!cfg.hz.waitHide) {
                    PVI.hideTime = Date.now();
                }

                PVI.reset();
                return;
            }

            PVI.state = 2;

            if (PVI.CAP) {
                PVI.HLP.textContent = "";
                PVI.CAP.style.display = "none";
            }

            if ((animDIV && PVI.anim.left) || animLDR) {
                PVI.BOX.style.left =
                    (cfg.hz.follow
                        ? e.clientX || PVI.x
                        : parseInt(PVI.BOX.style.left, 10) +
                          PVI.BOX.offsetWidth / 2) + "px";
            }

            if ((animDIV && PVI.anim.top) || animLDR) {
                PVI.BOX.style.top =
                    (cfg.hz.follow
                        ? e.clientY || PVI.y
                        : parseInt(PVI.BOX.style.top, 10) +
                          PVI.BOX.offsetHeight / 2) + "px";
            }

            if (animDIV) {
                if (PVI.anim.width) {
                    PVI.DIV.style.width = "0";
                }

                if (PVI.anim.height) {
                    PVI.DIV.style.height = "0";
                }
            }

            if ((animDIV && PVI.anim.opacity) || animLDR) {
                PVI.BOX.style.opacity = "0";
            }

            PVI.timers.anim_end = setTimeout(PVI.reset, PVI.anim.maxDelay);
        },
        reset: function (preventImmediateHover) {
            if (!PVI.DIV) {
                return;
            }

            if (PVI.iFrame) {
                win.parent.postMessage(
                    {
                        vdfDpshPtdhhd: "from_frame",
                        reset: true,
                    },
                    "*"
                );
            }

            if (PVI.state) {
                win.removeEventListener("mousemove", PVI.m_move, true);
            }

            PVI.node = null;
            clearTimeout(PVI.timers.delayed_loader);
            win.removeEventListener(platform["wheel"], PVI.wheeler, true);

            PVI.DIV.style.display = PVI.LDR.style.display = "none";
            PVI.DIV.style.width = PVI.DIV.style.height = "0";

            PVI.CNT.removeAttribute("src");

            if (PVI.CNT === PVI.VID) {
                // reset the video element
                PVI.VID.load();
            }

            if (PVI.anim.left || PVI.anim.top) {
                PVI.DIV.style.left = PVI.DIV.style.top = "auto";
            }

            if (PVI.anim.opacity) {
                PVI.DIV.style.opacity = "0";
            }

            if (cfg.hz.LDRanimate) {
                PVI.LDR.style.left = "auto";
                PVI.LDR.style.top = "auto";
                PVI.LDR.style.opacity = "0";
            }

            if (PVI.CAP) {
                PVI.CAP.firstChild.style.display = PVI.CAP.style.display =
                    "none";
            }

            /*if (PVI.INP.parentNode) {
			PVI.INP.parentNode.removeChild(PVI.INP);
		}*/

            if (PVI.IMG.scale) {
                delete PVI.IMG.scale;
                PVI.IMG.style[platform["transform"]] = "";
            }

            if (PVI.VID.scale) {
                delete PVI.VID.scale;
                PVI.VID.style[platform["transform"]] = "";
            }

            PVI.DIV.curdeg = 0;
            PVI.DIV.style[platform["transform"]] = "";

            PVI.HD_cursor(true);

            if (PVI.fullZm) {
                PVI.fullZm = false;
                PVI.hideTime = null;

                if (PVI.anim.maxDelay) {
                    PVI.DIV.style[platform["transition"]] = PVI.anim.css;
                }

                win.removeEventListener("click", PVI.fzClickAct, true);
                win.addEventListener("mouseover", PVI.m_over, true);
                doc.addEventListener(platform.wheel, PVI.scroller, {
                    capture: true,
                    passive: true,
                });
                doc.documentElement.addEventListener("mouseleave", PVI.m_leave);
            }

            // The thumbnail under the cursor won't zoom immidiately after
            // the popup is hidden via Esc for example
            if (preventImmediateHover) {
                PVI.lastScrollTRG = PVI.TRG;
                PVI.scroller();
            }

            PVI.state = 1;
        },
        onVisibilityChange: function (e) {
            if (PVI.fullZm) {
                return;
            }

            if (doc.hidden) {
                if (PVI.fireHide) {
                    PVI.m_over({ relatedTarget: PVI.TRG });
                }
            } else {
                // https://crbug.com/
                // It applies to other browsers too, so use it always
                releaseFreeze(e);
            }
        },
        keyup_freeze: function (e) {
            if (!e || e.key === cfg.hz.actTrigger) {
                PVI.freeze = !cfg.hz.deactivate;
                PVI.keyup_freeze_on = false;
                win.removeEventListener("keyup", PVI.keyup_freeze, true);
            }
        },
        key_action: function (e) {
            var pv, key;

            if (!cfg.keys) {
                return;
            }

            if (
                !PVI.keyup_freeze_on &&
                typeof PVI.freeze !== "number" &&
                !e.repeat &&
                e.key === cfg.hz.actTrigger
            ) {
                // If the cursor is over an element
                if (PVI.fireHide && PVI.state < 3) {
                    // but not zoomed yet, cancel the zoom
                    if (cfg.hz.deactivate) {
                        PVI.m_over({ relatedTarget: PVI.TRG });
                    }
                    // or show the pop-up on key-press
                    else {
                        PVI.load(
                            PVI.SRC === null ? PVI.TRG.IMGS_c_resolved : PVI.SRC
                        );
                    }

                    pdsp(e);
                }

                PVI.freeze = !!cfg.hz.deactivate;
                PVI.keyup_freeze_on = true;
                win.addEventListener("keyup", PVI.keyup_freeze, true);

                return;
            }

            if (!e.repeat) {
                // release freeze key
                if (PVI.keyup_freeze_on) {
                    PVI.keyup_freeze();
                }
                // invalidate freeze after scrolling
                else if (
                    PVI.freeze === false &&
                    !PVI.fullZm &&
                    PVI.lastScrollTRG
                ) {
                    PVI.mover({ target: PVI.lastScrollTRG });
                }
            }

            key = parseHotkey(e, cfg.hz.numpad);
            var keywos = key.replace("Shift+", "");

            // pressing Escape before the delay is elapsed
            if (PVI.state < 3 && PVI.fireHide && key === cfg.keys.hz_reset) {
                PVI.m_over({ relatedTarget: PVI.TRG });
            }

            pv = e.target;
            if (
                cfg.hz.scOffInInput &&
                pv &&
                /*pv !== PVI.INP && */ (pv.isContentEditable ||
                    ((pv = pv.nodeName.toUpperCase()) &&
                        (pv[2] === "X" || // teXtarea
                            pv === "INPUT")))
            ) {
                return;
            }
            //if(pv)prevent default etc
            pv = true;
            if (key === cfg.keys.hz_preload) {
                win.top.postMessage({ vdfDpshPtdhhd: "preload" }, "*");
            } else if (keywos === cfg.keys.hz_grants) {
                var grants = cfg.grants || [];
                grants = grants.filter((e) => e.url !== location.hostname);
                var val = { url: location.hostname };
                if (!e.shiftKey) val.op = "!";
                else val.op = "~";
                grants.push(val);
                Port.send({
                    cmd: "savePrefs",
                    prefs: { grants: grants },
                });
                setTimeout(() => {
                    Port.send({ cmd: "hello" });
                }, 1000);
            } else if (key === cfg.keys.hz_toggle) {
                if (win.sessionStorage.IMGS_suspend) {
                    delete win.sessionStorage.IMGS_suspend;
                } else {
                    win.sessionStorage.IMGS_suspend = "1";
                }
                win.top.postMessage({ vdfDpshPtdhhd: "toggle" }, "*");
                Port.send({
                    cmd: "toggle",
                    value: win.sessionStorage.IMGS_suspend,
                });
            } else if (PVI.state > 2 || PVI.LDR_msg) {
                if (PVI.state === 4) {
                    if (key === cfg.keys.hz_copy) {
                        if ("oncopy" in doc) {
                            if (Date.now() - PVI.timers.copy < 500) {
                                key = PVI.TRG.IMGS_caption;
                            } else {
                                key = PVI.CNT.src;
                            }

                            var oncopy = function (ev) {
                                this.removeEventListener(ev.type, oncopy);
                                ev.clipboardData.setData("text/plain", key);
                                ev.preventDefault();
                            };
                            doc.addEventListener("copy", oncopy);
                            doc.execCommand("copy");
                            PVI.timers.copy = Date.now();
                        }
                    } else if (key === cfg.keys.hz_save) {
                        if (!e.repeat && PVI.CNT.src) {
                            if (
                                platform.xpi ||
                                (platform.crx && !platform.edge)
                            ) {
                                var msg = {
                                    cmd: "download",
                                    url: PVI.CNT.src,
                                    priorityExt: cfg.hz.ext,
                                    mimetoext: JSON.stringify(
                                        JSON.parse(
                                            cfg.hz.ext2.replaceAll(
                                                /\w*\/\/.*/g,
                                                ""
                                            )
                                        )
                                    ),
                                    ext: JSON.parse(cfg.hz.ext3)[
                                        PVI.CNT.audio
                                            ? "audio"
                                            : PVI.CNT.localName
                                    ],
                                };
                                if (PVI.CNT.filename)
                                    msg.filename = PVI.CNT.filename;
                                if (cfg.hz.save) msg.path = cfg.hz.save;
                                Port.listen(function (x) {
                                    Port.listen(PVI.onMessage);
                                    if (!x)
                                        console.warn(
                                            "Imagus Mod doesn't have the permission to download, please turn it on. Ignore this message if you're doing something else with this hotkey."
                                        );
                                });
                                Port.send(msg);
                            } else if (PVI.HLP.download !== void 0) {
                                PVI.HLP.href = PVI.CNT.src;
                                PVI.HLP.download = "";
                                PVI.HLP.dispatchEvent(new MouseEvent("click"));
                            }
                        }
                    } else if (keywos === "Ctrl+" + cfg.keys.hz_open) {
                        key = {};
                        (
                            (PVI.TRG.IMGS_caption || "").match(
                                /\b((?:www\.[\w-]+(\.\S{2,7}){1,4}|https?:\/\/)\S+)/g
                            ) || []
                        ).forEach(function (el) {
                            key[el[0] === "w" ? "http://" + el : el] = 1;
                        });
                        key = Object.keys(key);

                        if (key.length) {
                            Port.send({
                                cmd: "open",
                                url: key,
                                nf: e.shiftKey,
                            });

                            if (!e.shiftKey && !PVI.fullZm) {
                                PVI.reset();
                            }
                        }
                    } else pv = false;
                } else pv = false;
                if (!pv && PVI.CNT === PVI.VID) {
                    pv = true;

                    // chaos from here:
                    if (key === cfg.keys.pl) {
                        if (PVI.VID.paused) {
                            PVI.VID.play();
                        } else {
                            PVI.VID.pause();
                        }
                    } else if (key === cfg.keys.controls) {
                        if (!PVI.VID.audio) {
                            PVI.VID.controls = PVI.VID._controls =
                                !PVI.VID._controls;
                        }
                    } else if (
                        keywos === cfg.keys.vfw ||
                        keywos === cfg.keys.vb
                    ) {
                        key = keywos === cfg.keys.vb ? -5 : 5;
                        PVI.VID.currentTime += key * (e.shiftKey ? 3 : 1);
                    } else if (
                        keywos === cfg.keys.up ||
                        keywos === cfg.keys.down
                    ) {
                        if (e.shiftKey) {
                            PVI.VID.playbackRate *=
                                keywos === cfg.keys.up ? 4 / 3 : 0.75;
                        } else {
                            PVI.VID.volume *=
                                keywos === cfg.keys.up ? 4 / 3 : 0.75;
                        }
                    } else if (
                        key === cfg.keys.stepup ||
                        key === cfg.keys.stepdown
                    ) {
                        if (PVI.VID.audio) {
                            PVI.VID.currentTime +=
                                key === cfg.keys.stepdown ? 4 : -4;
                        } else {
                            PVI.VID.pause();
                            PVI.VID.currentTime =
                                (PVI.VID.currentTime * 60 +
                                    (key === cfg.keys.stepdown ? 1 : -1)) /
                                    60 +
                                0.00001;
                        }
                    } else {
                        pv = null;
                    }
                }
                if (!pv && PVI.TRG.IMGS_album) {
                    switch (key) {
                        case cfg.keys.end:
                            if (
                                e.shiftKey &&
                                (pv =
                                    prompt(
                                        "#",
                                        PVI.stack[PVI.TRG.IMGS_album].search ||
                                            ""
                                    ) || null)
                            ) {
                                PVI.stack[PVI.TRG.IMGS_album].search = pv;
                            } else {
                                pv = false;
                            }
                            break;
                        case cfg.keys.start:
                            pv = true;
                            break;
                        default:
                            pv =
                                ((keywos === cfg.keys.fw1 ||
                                keywos === cfg.keys.fw2 ||
                                keywos === cfg.keys.fw3
                                    ? 1
                                    : 0) +
                                    (keywos === cfg.keys.back1 ||
                                    keywos === cfg.keys.back2 ||
                                    keywos === cfg.keys.back3
                                        ? -1
                                        : 0)) *
                                (e.shiftKey ? 5 : 1);
                            if (pv === 0) pv = null;
                    }

                    if (pv !== null) {
                        PVI.album(pv, true);
                        pv = true;
                    }
                }
                if (!pv) {
                    pv = true;
                    if (
                        key === cfg.keys.hz_zoomout ||
                        key === cfg.keys.hz_zoomin
                    ) {
                        PVI.resize(key === cfg.keys.hz_zoomout ? "-" : "+");
                    } else if (keywos === cfg.keys.hz_switchres) {
                        PVI.keytab({ shiftKey: e.shiftKey });
                    } else if (key === cfg.keys.hz_reset) {
                        if (
                            PVI.CNT === PVI.VID &&
                            (win.fullScreen ||
                                doc.fullscreenElement ||
                                (topWinW === win.screen.width &&
                                    topWinH === win.screen.height))
                        ) {
                            pv = false;
                        } else {
                            pv = true;
                            PVI.reset(true);
                        }
                    } else if (
                        keywos === cfg.keys.hz_fullZm ||
                        keywos === cfg.keys.hz_fullZm2
                    ) {
                        PVI.fullzmtoggle(e.shiftKey);
                    } else if (
                        key === cfg.keys.mOrig ||
                        key === cfg.keys.mFit ||
                        key === cfg.keys.mFitW ||
                        key === cfg.keys.mFitH
                    ) {
                        PVI.resize(key);
                    } else if (key === cfg.keys.hz_fullSpace) {
                        cfg.hz.fullspace = !cfg.hz.fullspace;
                        PVI.show();
                    } else if (key === cfg.keys.flipH) {
                        flip(PVI.CNT, 0);
                    } else if (key === cfg.keys.flipV) {
                        flip(PVI.CNT, 1);
                    } else if (key === cfg.keys.rotL || key === cfg.keys.rotR) {
                        PVI.DIV.curdeg += key === cfg.keys.rotR ? 90 : -90;

                        if (
                            PVI.CAP &&
                            PVI.CAP.textContent &&
                            PVI.CAP.state !== 0
                        ) {
                            PVI.CAP.style.display =
                                PVI.DIV.curdeg % 360 ? "none" : "block";
                        }

                        PVI.DIV.style[platform["transform"]] = PVI.DIV.curdeg
                            ? "rotate(" + PVI.DIV.curdeg + "deg)"
                            : "";

                        if (PVI.fullZm) {
                            PVI.m_move();
                        } else {
                            PVI.show();
                        }
                    } else if (keywos === cfg.keys.hz_caption) {
                        if (e.shiftKey) {
                            PVI.createCAP();

                            switch (PVI.CAP.state) {
                                case 0:
                                    key =
                                        cfg.hz.capWH || cfg.hz.capText ? 1 : 2;
                                    break;
                                case 2:
                                    key = 0;
                                    break;
                                default:
                                    key =
                                        cfg.hz.capWH && cfg.hz.capText ? 0 : 2;
                            }

                            PVI.CAP.state = key;
                            PVI.CAP.style.display = "none";
                            PVI.updateCaption();
                            PVI.show();
                        } else if (PVI.CAP) {
                            PVI.CAP.style.whiteSpace =
                                PVI.CAP.style.whiteSpace === "nowrap"
                                    ? "normal"
                                    : "nowrap";
                        }
                    } else if (keywos === cfg.keys.hz_history) {
                        PVI.history(e.shiftKey);
                    } else if (keywos === cfg.keys.send) {
                        if (PVI.CNT === PVI.IMG) {
                            imageSendTo({
                                url: PVI.CNT.src,
                                nf: e.shiftKey,
                            });
                        }
                    } else if (keywos === cfg.keys.hz_open) {
                        if (PVI.CNT.src) {
                            Port.send({
                                cmd: "open",
                                url: PVI.CNT.src.replace(rgxHash, ""),
                                nf: e.shiftKey,
                            });

                            if (!e.shiftKey && !PVI.fullZm) {
                                PVI.reset();
                            }
                        }
                    } else if (key === cfg.keys.prefs) {
                        Port.send({
                            cmd: "open",
                            url: "options.html#settings",
                        });

                        if (!PVI.fullZm) {
                            PVI.reset();
                        }
                    } else {
                        pv = false;
                    }
                }
            } else {
                pv = false;
            }
            if (pv) {
                pdsp(e);
            }
            /*else if (!PVI.fullZm && (e.which === 38 || e.which === 40)
			&& PVI.x && !e.ctrlKey && !e.shiftKey && !e.altKey) {
			win.addEventListener('scroll', PVI.onScrollEnd, false);
		}*/
        },
        /*onScrollEnd: function() {
		win.removeEventListener('scroll', PVI.onScrollEnd, false);
		clearTimeout(PVI.timers.keyscrollend);
		PVI.timers.keyscrollend = setTimeout(function() {
			PVI.m_over({
				'target': doc.elementFromPoint(PVI.x, PVI.y),
				'clientX': PVI.x,
				'clientY': PVI.y
			});
		}, 100);
	},
	switchToHiRes: function() {
		var ratio;

		if (PVI.TRG.IMGS_HD === false) {
			if (PVI.fullZm && cfg.hz.hiResOnFZ
				&& (PVI.IMG.naturalWidth >= 800 || PVI.IMG.naturalHeight >= 800)) {
				var ratio = PVI.IMG.naturalWidth / PVI.IMG.naturalHeight;
				ratio = (ratio < 1 ? 1 / ratio : ratio) >= cfg.hz.hiResOnFZ;
			} else if (PVI.IMG.naturalWidth < 800 && PVI.IMG.naturalHeight < 800) {
				ratio = true;
			}
		}

		if (ratio) {
			PVI.show('load');
			PVI.key_action({'which': 9});
			return true;
		}
	},*/
        switchToHiResInFZ: function () {
            if (!PVI.fullZm || !PVI.TRG || cfg.hz.hiResOnFZ < 1) {
                return false;
            }

            if (PVI.TRG.IMGS_HD !== false) {
                return false;
            }

            if (PVI.IMG.naturalWidth < 800 && PVI.IMG.naturalHeight < 800) {
                return false;
            }

            var ratio = PVI.IMG.naturalWidth / PVI.IMG.naturalHeight;

            if ((ratio < 1 ? 1 / ratio : ratio) < cfg.hz.hiResOnFZ) {
                return false;
            }

            PVI.show("load");
            PVI.keytab();
            return true;
        },
        fzDragEnd: function () {
            PVI.fullZm = PVI.fullZm > 1 ? 2 : 1;
            win.removeEventListener("mouseup", PVI.fzDragEnd, true);
        },
        fzClickAct: function (e) {
            if (e.button !== 0) {
                return;
            }

            // check if mouse moved in full-zoom
            // TODO: should be replaced with mouse coordinates instead (PVI.md_x PVI.md_y)
            if (mdownstart === false) {
                mdownstart = null;
                pdsp(e);
                return;
            }

            if (
                e.target === PVI.CAP ||
                (e.target.parentNode && e.target.parentNode === PVI.CAP)
            ) {
                if (PVI.TRG.IMGS_HD_stack) {
                    PVI.keytab();
                }
            } else if (e.target === PVI.VID) {
                if (
                    (e.offsetY || e.layerY || 0) <
                    Math.min(
                        PVI.CNT.clientHeight - 40,
                        (2 * PVI.CNT.clientHeight) / 3
                    )
                ) {
                    PVI.reset(true);
                } else if (
                    (e.offsetY || e.layerY || 0) < PVI.CNT.clientHeight - 40 &&
                    (e.offsetY || e.layerY || 0) >
                        (2 * PVI.CNT.clientHeight) / 3
                ) {
                    if (PVI.VID.paused) {
                        PVI.VID.play();
                    } else {
                        PVI.VID.pause();
                    }
                }
            } else {
                pdsp(e);
                PVI.reset(true);
            }

            if (e.target.IMGS_) {
                pdsp(e, false);
            }
        },
        scroller: function (e) {
            if (e) {
                if (PVI.fullZm) {
                    return;
                }

                if (!e.target.IMGS_) {
                    if (PVI.lastScrollTRG && PVI.lastScrollTRG !== e.target) {
                        // Prevent canceling the zoom
                        // when we scroll over a new target more than once,
                        // since it won't be the same to e.target in mover
                        PVI.lastScrollTRG = false;
                    } else if (PVI.lastScrollTRG !== false) {
                        PVI.lastScrollTRG = e.target;
                    }
                }
            }

            if (PVI.freeze || PVI.keyup_freeze_on) {
                return;
            }

            if (e) {
                if (PVI.fireHide) {
                    PVI.m_over({ relatedTarget: PVI.TRG });
                }

                PVI.x = e.clientX;
                PVI.y = e.clientY;
            }

            PVI.freeze = true;
            win.addEventListener("mousemove", PVI.mover, true);
        },
        mover: function (e) {
            if (PVI.x === e.clientX && PVI.y === e.clientY) {
                return;
            }

            win.removeEventListener("mousemove", PVI.mover, true);

            // If the suppress key is being held, then keep it frozen
            if (PVI.keyup_freeze_on) {
                PVI.lastScrollTRG = null;
                return;
            }

            if (PVI.freeze === true) {
                PVI.freeze = !cfg.hz.deactivate;
            }

            if (PVI.hideTime && PVI.lastScrollTRG !== e.target) {
                PVI.hideTime -= 1000;
                PVI.m_over(e);
            }

            PVI.lastScrollTRG = null;
        },
        wheeler: function (e) {
            // Firefox registers mouse events on scrollbars too
            if (e.clientX >= winW || e.clientY >= winH) {
                return;
            }

            var d = cfg.hz.scrollDelay;

            if (PVI.state > 2 && d >= 20) {
                if (e.timeStamp - (PVI.lastScrollTime || 0) < d) {
                    d = null;
                } else {
                    PVI.lastScrollTime = e.timeStamp;
                }
            }

            if (
                PVI.TRG &&
                PVI.TRG.IMGS_album &&
                cfg.hz.pileWheel &&
                // Scroll in the top left corner
                (!PVI.fullZm ||
                    (e.clientX < 50 && e.clientY < 50) ||
                    // or over the caption
                    (PVI.CAP && e.target === PVI.CAP.firstChild))
            ) {
                if (d !== null) {
                    if (cfg.hz.pileWheel === 2) {
                        if (!e.deltaX && !e.wheelDeltaX) {
                            return;
                        }

                        d = (e.deltaX || -e.wheelDeltaX) > 0;
                    } else {
                        d = (e.deltaY || -e.wheelDelta) > 0;
                    }

                    PVI.album(d ? 1 : -1, true);
                }

                pdsp(e);
                return;
            }

            if (PVI.fullZm && PVI.fullZm < 4) {
                if (d !== null) {
                    PVI.resize(
                        (e.deltaY || -e.wheelDelta) > 0 ? "-" : "+",
                        PVI.fullZm > 1
                            ? e.target === PVI.CNT
                                ? [
                                      e.offsetX || e.layerX || 0,
                                      e.offsetY || e.layerY || 0,
                                  ]
                                : []
                            : null
                    );
                }

                pdsp(e);
                return;
            }

            PVI.lastScrollTRG = PVI.TRG;
            PVI.reset();
        },
        resize: function (x, xy_img) {
            /*if (PVI.state !== 4 || !PVI.fullZm) {
                return;
            }*/

            var s = PVI.TRG.IMGS_SVG
                ? PVI.stack[PVI.IMG.src].slice()
                : [PVI.CNT.naturalWidth, PVI.CNT.naturalHeight];
            var k = cfg.keys;
            var rot = PVI.DIV.curdeg % 180;

            viewportDimensions();

            if (rot) {
                s.reverse();
            }

            if (x === k.mFit) {
                if (winW / winH < s[0] / s[1]) {
                    x = winW > s[0] ? 0 : k.mFitW;
                } else {
                    x = winH > s[1] ? 0 : k.mFitH;
                }
            }

            switch (x) {
                case k.mFitW:
                    winW -= PVI.DBOX["wpb"];
                    s[1] *= winW / s[0];
                    s[0] = winW;

                    if (PVI.fullZm > 1) {
                        PVI.y = 0;
                    }
                    break;
                case k.mFitH:
                    winH -= PVI.DBOX["hpb"];
                    s[0] *= winH / s[1];
                    s[1] = winH;

                    if (PVI.fullZm > 1) {
                        PVI.y = 0;
                    }
                    break;
                case "+":
                case "-":
                    k = [parseInt(PVI.DIV.style.width, 10), 0];
                    k[1] = (k[0] * s[rot ? 0 : 1]) / s[rot ? 1 : 0];

                    if (xy_img) {
                        if (xy_img[1] === void 0 || rot) {
                            xy_img[0] = k[0] / 2;
                            xy_img[1] = k[1] / 2;
                        } else if (PVI.DIV.curdeg % 360) {
                            /*if (!(PVI.DIV.curdeg % 270)) {
							xy_img = [xy_img[1], k[1] - xy_img[0]]
						} else */ if (!(PVI.DIV.curdeg % 180)) {
                                xy_img[0] = k[0] - xy_img[0];
                                xy_img[1] = k[1] - xy_img[1];
                            } /*
						else if (!(PVI.DIV.curdeg % 90)) {
							xy_img = [k[0] - xy_img[1], xy_img[0]];
						}*/
                        }

                        xy_img[0] /= k[rot ? 1 : 0];
                        xy_img[1] /= k[rot ? 0 : 1];
                    }

                    x = x === "+" ? cfg.hz.zoomin : cfg.hz.zoomout;
                    s[0] = x * Math.max(16, k[rot ? 1 : 0]);
                    s[1] = x * Math.max(16, k[rot ? 0 : 1]);

                    if (xy_img) {
                        xy_img[0] *= k[rot ? 1 : 0] - s[0];
                        xy_img[1] *= k[rot ? 0 : 1] - s[1];
                    }
            }

            if (!xy_img) {
                xy_img = [true, null];
            }

            // PVI.DIV.style.width = s[rot ? 1 : 0] + 'px';
            // PVI.DIV.style.height = s[rot ? 0 : 1] + 'px';
            xy_img.push(s[rot ? 1 : 0], s[rot ? 0 : 1]);
            PVI.m_move(xy_img);
        },
        m_leave: function (e) {
            if (!PVI.fireHide || e.relatedTarget) {
                return;
            }

            // Zooming from frame in Firefox constantly flashes the image without this
            // onmouseleave is fired in Chrome when the contextmenu is being shown
            if (PVI.x === e.clientX && PVI.y === e.clientY) {
                return;
            }

            PVI.m_over({
                relatedTarget: PVI.TRG,
                clientX: e.clientX,
                clientY: e.clientY,
            });
        },
        m_over: function (e) {
            var src, trg, cache;

            if (
                cfg.hz.deactivate &&
                (PVI.freeze || e[cfg._freezeTriggerEventKey])
            ) {
                return;
            }

            if (PVI.fireHide) {
                if (
                    e.target &&
                    (e.target.IMGS_ ||
                        ((e.relatedTarget || e).IMGS_ && e.target === PVI.TRG))
                ) {
                    if (cfg.hz.capNoSBar) {
                        e.preventDefault();
                    }

                    return;
                }

                if (PVI.CAP) {
                    PVI.CAP.style.display = "none";
                    PVI.CAP.firstChild.style.display = "none";
                }

                clearTimeout(PVI.timers.preview);
                clearInterval(PVI.timers.onReady);

                if (PVI.timers.resolver) {
                    clearTimeout(PVI.timers.resolver);
                    PVI.timers.resolver = null;
                }

                if (e.relatedTarget) {
                    trg = PVI.lastTRGStyle;

                    if (trg.outline !== null) {
                        e.relatedTarget.style.outline = trg.outline;
                        trg.outline = null;
                    }

                    if (trg.cursor !== null) {
                        e.relatedTarget.style.cursor = trg.cursor;
                        trg.cursor = null;
                    }
                }

                if (PVI.nodeToReset) {
                    PVI.resetNode(PVI.nodeToReset);
                    PVI.nodeToReset = null;
                }

                if (PVI.TRG) {
                    if (PVI.DIV) {
                        if (PVI.timers.no_anim_in_album) {
                            PVI.timers.no_anim_in_album = null;
                            PVI.DIV.style[platform["transition"]] =
                                PVI.anim.css;
                        }
                    }

                    PVI.TRG = null;
                }

                if (PVI.hideTime === 0 && PVI.state < 3) {
                    PVI.hideTime = Date.now();
                }

                // came from m_leave
                if (!e.target) {
                    PVI.hide(e);
                    return;
                }
            }

            if (e.target.IMGS_c === true) {
                if (PVI.fireHide) {
                    PVI.hide(e);
                }

                return;
            }
            //win.focus();
            trg = e.target;
            cache = trg.IMGS_c;

            if (!cache) {
                if (trg.IMGS_c_resolved) {
                    src = trg.IMGS_c_resolved;
                } else {
                    PVI.TRG = trg;
                }
            }

            // var t = win.performance.now();

            if (
                cache ||
                src ||
                (src = PVI.find(trg, e.clientX, e.clientY)) ||
                src === null
            ) {
                // console.info(win.performance.now() - t);
                if (src === 1) {
                    src = false;
                }

                if (cfg.hz.capNoSBar) {
                    e.preventDefault();
                }

                clearTimeout(PVI.timers.preview);

                if (!cfg.hz.waitHide) {
                    clearTimeout(PVI.timers.anim_end);
                }

                if (!PVI.iFrame) {
                    win.addEventListener("mousemove", PVI.m_move, true);
                }

                if (!cache && src && !trg.IMGS_c_resolved) {
                    if (cfg.hz.preload === 2 && !PVI.stack[src]) {
                        PVI._preload(src);
                    }

                    trg.IMGS_c_resolved = src;
                }

                PVI.TRG = trg;
                PVI.SRC = cache || src;
                PVI.x = e.clientX;
                PVI.y = e.clientY;
                var isFrozen =
                    PVI.freeze &&
                    !cfg.hz.deactivate &&
                    !e[cfg._freezeTriggerEventKey];

                if (
                    !isFrozen &&
                    (!cfg.hz.waitHide || cfg.hz.delay < 15) &&
                    ((PVI.fireHide && PVI.state > 2) ||
                        PVI.state === 2 ||
                        (PVI.hideTime && Date.now() - PVI.hideTime < 200))
                ) {
                    if (PVI.hideTime) {
                        PVI.hideTime = 0;
                    }

                    // set to 1, so in m_move we can check if delayOnIdle should be used
                    PVI.fireHide = 1;
                    PVI.load(PVI.SRC);
                    return;
                }

                if (
                    PVI.fireHide &&
                    PVI.state > 2 &&
                    (cfg.hz.waitHide || !cfg.hz.deactivate)
                ) {
                    PVI.hide(e);

                    // since PVI.hide removed it if animations are disabled
                    if (!PVI.anim.maxDelay && !PVI.iFrame) {
                        win.addEventListener("mousemove", PVI.m_move, true);
                    }

                    // when settings are changed this may have a value,
                    // so the pop-up would always appear instantly
                    if (PVI.hideTime) {
                        PVI.hideTime = 0;
                    }
                }

                PVI.fireHide = true;

                if (cfg.hz.markOnHover && (isFrozen || cfg.hz.delay >= 25)) {
                    if (cfg.hz.markOnHover === "cr") {
                        PVI.lastTRGStyle.cursor = trg.style.cursor;
                        trg.style.cursor = platform["zoom-in"];
                    } else {
                        PVI.lastTRGStyle.outline = trg.style.outline;
                        trg.style.outline =
                            "1px " + cfg.hz.markOnHover + " red";
                    }
                }

                if (isFrozen) {
                    clearTimeout(PVI.timers.resolver);
                    return;
                }

                var delay =
                    (PVI.state === 2 || PVI.hideTime) && cfg.hz.waitHide
                        ? PVI.anim.maxDelay
                        : cfg.hz.delay;

                if (delay) {
                    PVI.timers.preview = setTimeout(PVI.load, delay);
                } else {
                    PVI.load(PVI.SRC);
                }
            } else {
                trg.IMGS_c = true;
                PVI.TRG = null;

                if (PVI.fireHide) {
                    PVI.hide(e);
                }
            }
        },
        load: function (src) {
            if (
                (cfg.hz.waitHide || !cfg.hz.deactivate) &&
                PVI.anim.maxDelay &&
                !PVI.iFrame
            ) {
                win.addEventListener("mousemove", PVI.m_move, true);
            }

            if (!PVI.TRG) {
                return;
            }

            if (src === void 0) {
                src =
                    (cfg.hz.delayOnIdle && PVI.TRG.IMGS_c_resolved) || PVI.SRC;
            }

            if (PVI.SRC !== void 0) {
                PVI.SRC = void 0;
            }

            PVI.TBOX = (
                PVI.TRG.IMGS_overflowParent || PVI.TRG
            ).getBoundingClientRect();
            // absolute positions
            PVI.TBOX.Left = PVI.TBOX.left + win.pageXOffset;
            PVI.TBOX.Right = PVI.TBOX.Left + PVI.TBOX.width;
            PVI.TBOX.Top = PVI.TBOX.top + win.pageYOffset;
            PVI.TBOX.Bottom = PVI.TBOX.Top + PVI.TBOX.height;

            if (cfg.hz.markOnHover !== "cr") {
                PVI.TRG.style.outline = PVI.lastTRGStyle.outline;
                PVI.lastTRGStyle.outline = null;
            } else if (PVI.lastTRGStyle.cursor !== null) {
                if (PVI.DIV) {
                    PVI.DIV.style.cursor = "";
                }

                PVI.TRG.style.cursor = PVI.lastTRGStyle.cursor;
                PVI.lastTRGStyle.cursor = null;
            }

            if (src === null || (src && src.params) || src === false) {
                if (
                    src === false ||
                    (src &&
                        (src = PVI.resolve(src.URL, src.params, PVI.TRG)) === 1)
                ) {
                    PVI.create();
                    PVI.show("R_js");
                    return;
                }

                if (src === false) {
                    PVI.reset();
                    return;
                }

                if (src === null) {
                    if (PVI.state < 4 || !PVI.TRG.IMGS_c) {
                        if (PVI.state > 3) {
                            PVI.IMG.removeAttribute("src");
                        }

                        PVI.create();
                        PVI.show("res");
                    }

                    return;
                }
            }

            if (PVI.TRG.IMGS_album) {
                PVI.createCAP();
                PVI.album("" + PVI.stack[PVI.TRG.IMGS_album][0]);
                return;
            }

            PVI.set(src);
        },
        m_move: function (e) {
            if (e && PVI.x === e.clientX && PVI.y === e.clientY) {
                return;
            }

            if (PVI.fullZm) {
                var x = PVI.x,
                    y = PVI.y,
                    w,
                    h;

                if (!e) {
                    e = {};
                }

                // indicates the prevention of click when mouse moved
                if (mdownstart === true) {
                    mdownstart = false;
                }

                // resizing happens if e.target is not present
                if (e.target) {
                    PVI.x = e.clientX;
                    PVI.y = e.clientY;
                }

                if (PVI.fullZm > 1 && e[0] !== true) {
                    w = PVI.BOX.style;

                    // dragging the image
                    if (PVI.fullZm === 3 && e.target) {
                        x = parseInt(w.left, 10) - x + e.clientX;
                        y = parseInt(w.top, 10) - y + e.clientY;
                    }
                    // zooming on the image
                    else if (e[1] !== void 0) {
                        x = parseInt(w.left, 10) + e[0];
                        y = parseInt(w.top, 10) + e[1];
                    }
                    // just moving the mouse
                    else {
                        x = null;
                    }
                } else {
                    var rot = PVI.state === 4 && PVI.DIV.curdeg % 180;

                    if (PVI.BOX === PVI.DIV) {
                        if (PVI.TRG.IMGS_SVG) {
                            h = PVI.stack[PVI.IMG.src];
                            h = h[1] / h[0];
                        }

                        w = e[2] || parseInt(PVI.DIV.style.width, 10);
                        h = parseInt(
                            w *
                                (h ||
                                    PVI.CNT.naturalHeight /
                                        PVI.CNT.naturalWidth) +
                                PVI.DBOX["hpb"],
                            10
                        );
                        w += PVI.DBOX["wpb"];
                    } else {
                        w = PVI.LDR.wh[0];
                        h = PVI.LDR.wh[1];
                    }

                    if (rot) {
                        rot = w;
                        w = h;
                        h = rot;
                        rot = (w - h) / 2;
                    } else {
                        rot = 0;
                    }

                    x =
                        (w - PVI.DBOX["wpb"] > winW
                            ? -((PVI.x * (w - winW + 80)) / winW) + 40
                            : (winW - w) / 2) +
                        rot -
                        PVI.DBOX["ml"];
                    y =
                        (h - PVI.DBOX["hpb"] > winH
                            ? -((PVI.y * (h - winH + 80)) / winH) + 40
                            : (winH - h) / 2) -
                        rot -
                        PVI.DBOX["mt"];
                }

                if (e[2] !== void 0) {
                    PVI.BOX.style.width = e[2] + "px";
                    PVI.BOX.style.height = e[3] + "px";
                }

                if (x !== null) {
                    PVI.BOX.style.left = x + "px";
                    PVI.BOX.style.top = y + "px";
                }
                return;
            } else if (!e.target) {
                var rot = PVI.state === 4 && PVI.DIV.curdeg % 180;
                if (PVI.BOX === PVI.DIV) {
                    if (PVI.TRG.IMGS_SVG) {
                        h = PVI.stack[PVI.IMG.src];
                        h = h[1] / h[0];
                    }

                    w = e[2] || parseInt(PVI.DIV.style.width, 10);
                    h = parseInt(
                        w *
                            (h ||
                                PVI.CNT.naturalHeight / PVI.CNT.naturalWidth) +
                            PVI.DBOX["hpb"],
                        10
                    );
                    w += PVI.DBOX["wpb"];
                } else {
                    w = PVI.LDR.wh[0];
                    h = PVI.LDR.wh[1];
                }

                if (rot) {
                    rot = w;
                    w = h;
                    h = rot;
                    rot = (w - h) / 2;
                } else {
                    rot = 0;
                }

                if (e[2] !== void 0) {
                    PVI.BOX.style.width = e[2] + "px";
                    PVI.BOX.style.height = e[3] + "px";
                }

                return;
            }

            PVI.x = e.clientX;
            PVI.y = e.clientY;

            if (
                PVI.freeze &&
                !cfg.hz.deactivate &&
                !e[cfg._freezeTriggerEventKey]
            ) {
                return;
            }

            if (PVI.state < 3) {
                if (cfg.hz.delayOnIdle && PVI.fireHide !== 1 && PVI.state < 2) {
                    if (PVI.timers.resolver) {
                        clearTimeout(PVI.timers.resolver);
                    }

                    clearTimeout(PVI.timers.preview);
                    PVI.timers.preview = setTimeout(PVI.load, cfg.hz.delay);
                }
            } else if (
                (e.target.IMGS_ &&
                    PVI.TBOX &&
                    (PVI.TBOX.Left > e.pageX ||
                        PVI.TBOX.Right < e.pageX ||
                        PVI.TBOX.Top > e.pageY ||
                        PVI.TBOX.Bottom < e.pageY)) ||
                (!e.target.IMGS_ && PVI.TRG !== e.target)
            ) {
                PVI.m_over({
                    relatedTarget: PVI.TRG,
                    clientX: e.clientX,
                    clientY: e.clientY,
                });
            } else if (
                cfg.hz.move &&
                PVI.state > 2 &&
                !PVI.timers.m_move &&
                (PVI.state === 3 ||
                    cfg.hz.placement < 2 ||
                    cfg.hz.placement > 3)
            ) {
                PVI.timers.m_move = win.requestAnimationFrame(PVI.m_move_show);
            }
        },
        m_move_show: function () {
            if (PVI.state > 2) {
                PVI.show();
            }

            PVI.timers.m_move = null;
        },
        _preload: function (srcs) {
            if (!Array.isArray(srcs)) {
                if (typeof srcs !== "string") {
                    return;
                }

                srcs = [srcs];
            }

            for (var i = 0, lastIdx = srcs.length - 1; i <= lastIdx; ++i) {
                var url = srcs[i];
                var isHDUrl = url[0] === "#";

                if (
                    !((cfg.hz.hiRes && isHDUrl) || (!cfg.hz.hiRes && !isHDUrl))
                ) {
                    if (i !== lastIdx) {
                        continue;
                    }

                    if (i !== 0) {
                        url = srcs[0];
                        isHDUrl = url[0] === "#";
                    }
                }

                if (isHDUrl) {
                    url = url.slice(1);
                }

                // Resolved URLs may contain &amp;
                if (url.indexOf("&amp;") !== -1) {
                    url = url.replace(/&amp;/g, "&");
                }

                new Image().src = url[1] === "/" ? PVI.httpPrepend(url) : url;
                return;
            }
        },
        preload: function (e) {
            if (PVI.preloading) {
                if (!e || e.type !== "DOMNodeInserted") {
                    if (e === false) {
                        delete PVI.preloading;
                        doc.body.removeEventListener(
                            "DOMNodeInserted",
                            PVI.preload,
                            true
                        );
                    }

                    return;
                }
            } else {
                e = null;
                PVI.preloading = [];
                doc.body.addEventListener("DOMNodeInserted", PVI.preload, true);
            }

            var nodes = (e && e.target) || doc.body;

            if (
                !nodes ||
                nodes.IMGS_ ||
                nodes.nodeType !== 1 ||
                !(nodes = nodes.querySelectorAll(
                    'img[src], :not(img)[style*="background-image"], a[href]'
                )) ||
                !nodes.length
            ) {
                return;
            }

            nodes = [].slice.call(nodes);
            PVI.preloading = PVI.preloading
                ? PVI.preloading.concat(nodes)
                : PVI.preloading;

            nodes = function () {
                var node, src;
                var process_amount = 50;
                var onImgError = function () {
                    this.src = this.IMGS_src_arr.shift().replace(/^#/, "");

                    if (!this.IMGS_src_arr.length) {
                        this.onerror = null;
                    }
                };

                PVI.resolve_delay = 200;

                while ((node = PVI.preloading.shift())) {
                    if (
                        (node.nodeName.toUpperCase() === "A" &&
                            node.childElementCount) ||
                        node.IMGS_c_resolved ||
                        node.IMGS_c ||
                        typeof node.IMGS_caption === "string" ||
                        node.IMGS_thumb
                    ) {
                        continue;
                    }

                    if ((src = PVI.find(node))) {
                        node.IMGS_c_resolved = src;

                        if (Array.isArray(src)) {
                            var i,
                                img = new Image();

                            img.IMGS_src_arr = [];

                            for (i = 0; i < src.length; ++i) {
                                if (cfg.hz.hiRes && src[i][0] === "#") {
                                    img.IMGS_src_arr.push(src[i].slice(1));
                                } else if (src[i][0] !== "#") {
                                    img.IMGS_src_arr.push(src[i]);
                                }
                            }

                            if (!img.IMGS_src_arr.length) {
                                return;
                            }

                            img.onerror = onImgError;
                            img.onerror();
                        } else if (
                            typeof src === "string" &&
                            !rgxIsSVG.test(src)
                        ) {
                            new Image().src = src;
                        }

                        break;
                    }

                    if (src === null || process_amount-- < 1) {
                        break;
                    }
                }

                PVI.resolve_delay = 0;

                if (PVI.preloading.length) {
                    PVI.timers.preload = setTimeout(nodes, 300);
                } else {
                    delete PVI.timers.preload;
                }
            };

            if (PVI.timers.preload) {
                clearTimeout(PVI.timers.preload);
                PVI.timers.preload = setTimeout(nodes, 300);
            } else {
                nodes();
            }
        },
        toggle: function (disable) {
            if (PVI.state || disable === true) {
                PVI.init(null, true);
            } else if (cfg) {
                PVI.init();
            } else {
                Port.send({ cmd: "hello", no_grants: true });
            }
        },
        fullzmtoggle: function (shiftKey) {
            if (PVI.fullZm) {
                if (shiftKey) {
                    PVI.fullZm = PVI.fullZm === 1 ? 2 : 1;
                } else {
                    PVI.reset(false);
                    PVI.load(PVI.TRG.IMGS_c);
                }
            } else {
                win.removeEventListener("mouseover", PVI.m_over, true);
                doc.removeEventListener(platform["wheel"], PVI.scroller, true);
                doc.documentElement.removeEventListener(
                    "mouseleave",
                    PVI.m_leave,
                    false
                );

                PVI.fullZm = (cfg.hz.fzMode !== 1) !== !shiftKey ? 1 : 2; // xor
                PVI.switchToHiResInFZ();

                if (PVI.anim.maxDelay) {
                    setTimeout(function () {
                        if (PVI.fullZm) {
                            PVI.DIV.style[platform["transition"]] = "all 0s";
                        }
                    }, PVI.anim.maxDelay);
                }

                if (PVI.CNT === PVI.VID) {
                    PVI.VID.controls = true;
                }

                if (PVI.state > 2 && PVI.fullZm !== 2) {
                    PVI.DIV.style.visibility = "hidden";
                    PVI.resize(0);
                    PVI.m_move();
                    PVI.DIV.style.visibility = "visible";
                }

                if (!PVI.iFrame) {
                    win.addEventListener("mousemove", PVI.m_move, true);
                }

                win.addEventListener("click", PVI.fzClickAct, true);
            }
        },
        onWinResize: function () {
            viewportDimensions();

            if (PVI.state < 3) {
                return;
            }

            if (!PVI.fullZm) {
                PVI.show();
            } else if (PVI.fullZm === 1) {
                PVI.m_move();
            }
        },
        winOnMessage: function (e) {
            var d = e.data;
            var cmd = d && d.vdfDpshPtdhhd;

            if (cmd === "toggle" || cmd === "preload" || cmd === "isFrame") {
                var frms = win.frames;

                if (!frms) {
                    return;
                }

                var i = frms.length;

                while (i--) {
                    if (!frms[i] || !frms[i].postMessage) {
                        continue;
                    }

                    // Don't message about: frames (for now)
                    try {
                        if (
                            frms[i].location.href.lastIndexOf("about:", 0) === 0
                        ) {
                            continue;
                        }
                    } catch (ex) {}

                    frms[i].postMessage(
                        {
                            vdfDpshPtdhhd: cmd,
                            parent: doc.body.nodeName.toUpperCase(),
                        },
                        "*"
                    );
                }

                if (cmd === "isFrame") {
                    PVI.iFrame = d.parent === "BODY";

                    if (!PVI.iFrame) {
                        win.addEventListener("resize", PVI.onWinResize, true);
                    }
                } else {
                    PVI[cmd](d);
                }
            } else if (cmd === "from_frame") {
                if (PVI.iFrame) {
                    win.parent.postMessage(d, "*");
                    return;
                }

                if (PVI.fullZm) {
                    return;
                }

                if (d.reset) {
                    PVI.reset();
                    return;
                }

                PVI.create();
                PVI.fireHide = true;
                PVI.TRG = PVI.HLP;
                PVI.resetNode(PVI.TRG);

                if (d.hide) {
                    PVI.hide({
                        target: PVI.TRG,
                        clientX: PVI.DIV.offsetWidth / 2 + cfg.hz.margin,
                        clientY: PVI.DIV.offsetHeight / 2 + cfg.hz.margin,
                    });

                    return;
                }

                PVI.x = PVI.y = 0;

                if (typeof d.msg === "string") {
                    // PVI.reset();
                    PVI.show(d.msg);
                    return;
                }

                if (!d.src) {
                    return;
                }

                PVI.TRG.IMGS_caption = d.caption;

                if (d.album) {
                    PVI.TRG.IMGS_album = d.album.id;

                    if (!PVI.stack[d.album.id]) {
                        PVI.stack[d.album.id] = d.album.list;
                    }

                    d.album = "" + PVI.stack[d.album.id][0];
                }

                if (d.thumb && d.thumb[0]) {
                    PVI.TRG.IMGS_thumb = d.thumb[0];
                    PVI.TRG.IMGS_thumb_ok = d.thumb[1];
                }

                if (d.album) {
                    PVI.album(d.album);
                } else {
                    PVI.set(d.src);
                }
            }
        },
        onMessage: function (d) {
            if (!d) {
                return;
            }
            if (d === "disable") {
                if (win.sessionStorage.IMGS_suspend) {
                    delete win.sessionStorage.IMGS_suspend;
                } else {
                    win.sessionStorage.IMGS_suspend = "1";
                }
                win.top.postMessage({ vdfDpshPtdhhd: "toggle" }, "*");
                Port.send({
                    cmd: "toggle",
                    value: win.sessionStorage.IMGS_suspend,
                });
                return;
            }
            if (d.cmd === "resolved") {
                // id can be -1
                var trg = PVI.resolving[d.id] || PVI.TRG;
                var rule = cfg.sieve[d.params.rule.id];

                delete PVI.resolving[d.id];

                if (!d.return_url) {
                    PVI.create();
                }

                if (!d.cache && (d.m === true || d.params.rule.skip_resolve)) {
                    try {
                        if (
                            rule.res === 1 &&
                            typeof d.params.rule.req_res === "string"
                        ) {
                            rule.res = Function("$", d.params.rule.req_res);
                        }

                        PVI.node = trg;
                        d.m = rule.res.call(PVI, d.params);
                    } catch (ex) {
                        console.error(
                            app.name +
                                ": [rule " +
                                d.params.rule.id +
                                "] " +
                                ex.message
                        );

                        if (!d.return_url && trg === PVI.TRG) {
                            PVI.show("R_js");
                        }

                        return 1;
                    }

                    if (d.params.url) {
                        d.params.url = d.params.url.join("");
                    }

                    if (
                        cfg.tls.sieveCacheRes &&
                        !d.params.rule.skip_resolve &&
                        d.m
                    ) {
                        Port.send({
                            cmd: "resolve_cache",
                            url: d.params.url,
                            cache: JSON.stringify(d.m),
                            rule_id: d.params.rule.id,
                        });
                    }
                }

                if (d.m && !Array.isArray(d.m) && typeof d.m === "object") {
                    if (d.m[""]) {
                        if (typeof d.m.idx === "number") {
                            d.idx = d.m.idx + 1;
                        }

                        d.m = d.m[""];
                    } else if (typeof d.m.loop === "string") {
                        d.loop = true;
                        d.m = d.m.loop;
                    }
                }

                if (Array.isArray(d.m)) {
                    if (d.m.length) {
                        if (Array.isArray(d.m[0])) {
                            // if the entry has an array with only one URL, then change the array to a string URL
                            d.m.forEach(function (el) {
                                if (
                                    Array.isArray(el[0]) &&
                                    el[0].length === 1
                                ) {
                                    el[0] = el[0][0];
                                }
                            });

                            if (d.m.length > 1) {
                                trg.IMGS_album = d.params.url;

                                if (PVI.stack[d.params.url]) {
                                    d.m = PVI.stack[d.params.url];
                                    d.m = d.m[d.m[0]];
                                } else {
                                    PVI.createCAP();
                                    d.idx =
                                        Math.max(
                                            1,
                                            Math.min(d.idx, d.m.length)
                                        ) || 1;
                                    d.m.unshift(d.idx);
                                    PVI.stack[d.params.url] = d.m;
                                    d.m = d.m[d.idx];
                                    d.idx += "";
                                }
                            } else {
                                d.m = d.m[0];
                            }
                        }

                        if (cfg.hz.capText && d.m[0]) {
                            if (d.m[1]) {
                                PVI.prepareCaption(trg, d.m[1]);
                            } else if (cfg.hz.capLinkText && trg.IMGS_caption) {
                                d.m[1] = trg.IMGS_caption;
                            }
                        }

                        d.m = d.m[0];
                    } else {
                        d.m = null;
                    }
                } else if (typeof d.m !== "object" && typeof d.m !== "string") {
                    d.m = false;
                }

                if (d.m) {
                    if (
                        !d.noloop &&
                        !trg.IMGS_album &&
                        typeof d.m === "string" &&
                        (d.loop ||
                            (rule.loop &&
                                rule.loop &
                                    (d.params.rule.loop_param === "img"
                                        ? 2
                                        : 1)))
                    ) {
                        d.m = PVI.find({ href: d.m, IMGS_TRG: trg });

                        if (d.m === null || d.m === 1) {
                            return d.m;
                        } else if (d.m === false) {
                            if (!d.return_url) {
                                PVI.show("R_res");
                            }

                            return d.m;
                        }
                    }

                    if (d.return_url) {
                        return d.m;
                    }

                    if (trg === PVI.TRG) {
                        if (trg.IMGS_album) {
                            PVI.album(d.idx || "1");
                        } else {
                            PVI.set(d.m);
                        }
                    } else {
                        if (cfg.hz.preload > 1 || PVI.preloading) {
                            PVI._preload(d.m);
                        }

                        trg.IMGS_c_resolved = d.m;
                    }
                } else if (d.return_url) {
                    delete PVI.TRG.IMGS_c_resolved;
                    return d.m;
                } else if (trg === PVI.TRG) {
                    if (trg.IMGS_fallback_zoom) {
                        PVI.set(trg.IMGS_fallback_zoom);
                        delete trg.IMGS_fallback_zoom;
                        return;
                    }

                    // false says explicitly that the loader must be hidden
                    if (d.m === false) {
                        // TODO: test in full-zoom
                        PVI.m_over({ relatedTarget: trg });
                        trg.IMGS_c = true;
                        delete trg.IMGS_c_resolved;
                    } else {
                        PVI.show("R_res");
                    }
                }
            } else if (d.cmd === "toggle" || d.cmd === "preload") {
                win.top.postMessage({ vdfDpshPtdhhd: d.cmd }, "*");
            } else if (d.cmd === "hello") {
                var e = !!PVI.DIV;
                PVI.init(null, true);
                PVI.init(d);

                if (e) {
                    PVI.create();
                }
            }
        },
        enable: function (e) {
            if (e.repeat) return;
            var keywos = parseHotkey(e, cfg.numpad).replace("Shift+", "");
            if (keywos === cfg.key && e.shiftKey) {
                var grants = cfg.grants || [];
                grants = grants.filter((e) => e.url !== location.hostname);
                grants.push({ op: "~", url: location.hostname });
                Port.send({
                    cmd: "savePrefs",
                    prefs: { grants: grants },
                });
                setTimeout(() => {
                    Port.send({ cmd: "hello" });
                }, 1000);
            }
        },
        init: function (e, deinit) {
            if (deinit) {
                try {
                    PVI.reset();
                } catch (ex) {}
                PVI.state = 0;

                if (!PVI.iFrame) {
                    win.removeEventListener("resize", PVI.onWinResize, true);
                }

                if (PVI.DIV) {
                    try {
                        doc.documentElement.removeChild(PVI.DIV);
                        doc.documentElement.removeChild(PVI.LDR);
                    } catch (ex) {}
                    PVI.BOX =
                        PVI.DIV =
                        PVI.CNT =
                        PVI.VID =
                        PVI.IMG =
                        PVI.CAP =
                        PVI.TRG =
                        PVI.interlacer =
                            null;
                }

                PVI.lastScrollTRG = null;
            } else {
                if (e.allow) {
                    if (!e) {
                        PVI.initOnMouseMoveEnd();
                        return;
                    }

                    cfg = e.prefs;

                    if (
                        cfg &&
                        !cfg.hz.deactivate &&
                        cfg.hz.actTrigger === "0"
                    ) {
                        cfg = null;
                    }

                    if (!cfg) {
                        PVI.init(null, true);
                        return;
                    }

                    PVI.freeze = !cfg.hz.deactivate;
                    cfg._freezeTriggerEventKey =
                        cfg.hz.actTrigger.toLowerCase() + "Key";
                    PVI.convertSieveRegexes();

                    var pageLoaded = function () {
                        doc.removeEventListener("DOMContentLoaded", pageLoaded);

                        if (doc.body) {
                            doc.body.IMGS_c = true;
                        }

                        if (cfg.hz.preload === 3) {
                            PVI.preload();
                        }
                    };

                    if (doc.readyState === "loading") {
                        doc.addEventListener("DOMContentLoaded", pageLoaded);
                    } else {
                        pageLoaded();
                    }
                } else {
                    PVI.initOnMouseMoveEnd();
                    cfg = e.prefs;
                    var date;
                    ({ date, ...cfg.sieve } = cfg.sieve);
                    win.addEventListener("keydown", PVI.enable);

                    Port.listen(PVI.onMessage);
                    return;
                }

                viewportDimensions();
                Port.listen(PVI.onMessage);
                platform.onkeydown = PVI.key_action;
                platform.onmessage = PVI.winOnMessage;
            }

            e = (deinit ? "remove" : "add") + "EventListener";
            // scroller must be on a parent of wheeler
            doc[e](platform.wheel, PVI.scroller, {
                capture: true,
                passive: true,
            });
            doc.documentElement[e]("mouseleave", PVI.m_leave, false);
            doc[e]("visibilitychange", PVI.onVisibilityChange, true);
            win[e]("contextmenu", onContextMenu, true);
            win[e]("mouseover", PVI.m_over, true);
            win[e]("mousedown", onMouseDown, true);
            win[e]("mouseup", releaseFreeze, true);
            win[e]("dragend", releaseFreeze, true);
            // doesn't fire on document in Firefox and on window in Chrome

            try {
                if (!deinit && win.sessionStorage.IMGS_suspend === "1") {
                    PVI.toggle(true);
                }
            } catch (ex) {}

            PVI.initOnMouseMoveEnd(!!PVI.capturedMoveEvent);

            if (!win.MutationObserver) {
                PVI.attrObserver = null;
                return;
            }

            PVI.onAttrChange = null;

            if (PVI.mutObserver) {
                PVI.mutObserver.disconnect();
                PVI.mutObserver = null;
            }

            if (deinit) {
                win.removeEventListener("keydown", PVI.enable);
                return;
            }

            PVI.mutObserver = new win.MutationObserver(function (muts) {
                var i = muts.length;

                while (i--) {
                    var m = muts[i];
                    var trg = m.target;
                    var attr = m.attributeName;

                    notTRG: if (trg !== PVI.TRG) {
                        if (PVI.TRG) {
                            if (
                                trg.contains(PVI.TRG) ||
                                PVI.TRG.contains(trg)
                            ) {
                                break notTRG;
                            }
                        }

                        PVI.attrObserver(trg, attr === "style", m.oldValue);
                        continue;
                    }

                    if (attr === "title" || attr === "alt") {
                        if (trg[attr] === "") {
                            continue;
                        }
                    } else if (attr === "style") {
                        var bgImg = trg.style.backgroundImage;

                        if (!bgImg) {
                            continue;
                        }

                        if (m.oldValue.indexOf(bgImg) !== -1) {
                            continue;
                        }
                    }

                    PVI.nodeToReset = trg;
                }
            });

            PVI.mutObserverConf = {
                attributes: true,
                attributeOldValue: true,
                attributeFilter: ["href", "src", "style", "alt", "title"],
            };
        },
        _: function (varName) {
            var value;
            var evName = Math.random().toString(36).slice(2);
            var callback = function (e) {
                this.removeEventListener(e.type, callback);
                value = e.detail;
            };
            win.addEventListener(evName, callback);
            var script = doc.createElement("script");
            script.textContent =
                "dispatchEvent(new CustomEvent('" +
                evName +
                "', {" +
                "bubbles: false, detail: window['" +
                varName +
                "']}" +
                "))";
            doc.body.appendChild(script).parentNode.removeChild(script);
            return value;
        },
    };

    PVI.capturedMoveEvent = null;
    PVI.onInitMouseMove = function (e) {
        if (PVI.capturedMoveEvent) {
            PVI.capturedMoveEvent = e;
            return;
        }

        PVI.capturedMoveEvent = e;
        win.top.postMessage({ vdfDpshPtdhhd: "isFrame" }, "*");
        Port.listen(PVI.init);
        Port.send({ cmd: "hello" });
    };

    PVI.initOnMouseMoveEnd = function (triggerMouseover) {
        window.removeEventListener("mousemove", PVI.onInitMouseMove, true);

        if (cfg && triggerMouseover && (!PVI.x || PVI.state !== null)) {
            PVI.m_over(PVI.capturedMoveEvent);
        }

        delete PVI.onInitMouseMove;
        delete PVI.capturedMoveEvent;
        PVI.initOnMouseMoveEnd = function () {};
    };

    window.addEventListener("mousemove", PVI.onInitMouseMove, true);
    platform.onmessage = PVI.winOnMessage;
})(window, document);
