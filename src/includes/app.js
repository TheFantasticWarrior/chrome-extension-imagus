/* global addMessageListener, removeMessageListener, sendAsyncMessage */
/* exported buildNodes, cfg */

"use strict";

var platform = {},
    app,
    Port,
    cfg,
    _;

app = {
    name: /*~APP_NAME~*/ "Imagus mod",
    version: /*~APP_VERSION~*/ "0.10.14.6",
};

if (document instanceof window.HTMLDocument) {
    platform =
        document.documentElement ||
        document.createElementNS("http://www.w3.org/1999/xhtml", "div");

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function (cb) {
            return window.setTimeout(cb, 25);
        };

        window.cancelAnimationFrame = function (tid) {
            return window.clearTimeout(tid);
        };
    }

    if (platform.style) {
        _ = platform.style;

        platform = {
            wheel: "onwheel" in platform ? "wheel" : "mousewheel",
            transition:
                ("webkitTransition" in _ ? "webkitT" : "t") + "ransition",
            transition_css:
                ("webkitTransition" in _ ? "-webkit-" : "") + "transition",
            transform: ("webkitTransform" in _ ? "webkitT" : "t") + "ransform",
            transform_css:
                ("webkitTransform" in _ ? "-webkit-" : "") + "transform",
            "zoom-in":
                (this.chrome && !this.browser) || this.mx || this.safari
                    ? "-webkit-zoom-in"
                    : "zoom-in",
        };
        _ = null;
    }
}

function buildNodes(host, nodes) {
    if (!host || !Array.isArray(nodes)) {
        return;
    }

    if (!nodes.length) {
        return host;
    }

    var doc = host.ownerDocument;
    var fragment = doc.createDocumentFragment();

    for (var i = 0, l = nodes.length; i < l; i++) {
        if (!nodes[i]) {
            continue;
        }

        if (typeof nodes[i] === "string") {
            fragment.appendChild(doc.createTextNode(nodes[i]));
            continue;
        }

        var node = doc.createElement(nodes[i].tag);

        if (nodes[i].attrs) {
            for (var attr in nodes[i].attrs) {
                // bypass CSP
                if (attr === "style") {
                    node.style.cssText = nodes[i].attrs[attr];
                } else {
                    node.setAttribute(attr, nodes[i].attrs[attr]);
                }
            }
        }

        if (nodes[i].nodes) {
            buildNodes(node, nodes[i].nodes);
        } else if (nodes[i].text) {
            node.textContent = nodes[i].text;
        }

        fragment.appendChild(node);
    }

    if (fragment.childNodes.length) {
        host.appendChild(fragment);
    }

    return host;
}

// this script runs before the DOM is ready, so using these proxy listeners
// is our best chance to prevent listeners from web-pages or other extensions

window.addEventListener(
    "message",
    function (e) {
        if (!e.data.hasOwnProperty("vdfDpshPtdhhd")) {
            return;
        }

        e.stopImmediatePropagation();

        if (platform.onmessage) {
            platform.onmessage(e);
        }
    },
    true
);

window.addEventListener(
    "keydown",
    function (e) {
        if (platform.onkeydown) {
            platform.onkeydown(e);
        }
    },
    true
);

try {
    void chrome.storage.local;
    platform[this.browser ? "firefox" : "chrome"] = true;
} catch (ex) {
    platform.edge = true;
    this.chrome = this.browser;

    if (typeof Element.prototype.matches !== "function") {
        Element.prototype.matches = Element.prototype.webkitMatchesSelector;
    }
}

platform.crx = true;

Port = {
    listen: function (listener) {
        if (this.listener) {
            chrome.runtime.onMessage.removeListener(this.listener);
        }

        if (typeof listener !== "function") {
            this.listener = null;
            return;
        }

        if (_) {
            // Skip messages in extension pages
            // from content scripts (Edge, Firefox)
            this.listener = function (message, sender) {
                if (!sender) {
                    listener(message);
                }
            };
        } else {
            this.listener = listener;
        }

        chrome.runtime.onMessage.addListener(this.listener);
    },
    send: function (message) {
        if (Port.listener) {
            chrome.runtime.sendMessage(message, Port.listener);
        } else {
            chrome.runtime.sendMessage(message);
        }
    },
};

if (/^(chrome|ms-browser|moz)-extension:/.test(location.protocol)) {
    _ = function (s) {
        try {
            return chrome.i18n.getMessage(s) || s;
        } catch (ex) {
            return s;
        }
    };

    platform.insertHTML = function (node, str) {
        var allowedTags =
            /^([apbiusq]|d(iv|el)|em|h[1-6]|i(mg|ns)|s((pan|mall)|u[bp])|[bh]r|pre|code|blockquote|[ou]l|li|d[ltd]|t([rhd]|able|head|body|foot)|svg|symbol|line|path)$/i;
        var allowedAttrs =
            /^(data-|stroke-|(class|style|xmlns|viewBox|i?d|fill|line(cap|join)|transform|[xy][12])$)/i;
        var safeContainer = document.implementation.createHTMLDocument("").body;

        var cleanContainer = function (container) {
            var i = container.childElementCount;
            // Edge doesn't have children on SVG elements
            var children = container.children || container.childNodes;

            while (i--) {
                var n = children[i];

                if (n.nodeType === Node.TEXT_NODE) {
                    continue;
                }

                if (!allowedTags.test(n.nodeName)) {
                    n.parentNode.removeChild(n);
                    continue;
                }

                var j = n.attributes.length;

                while (j--) {
                    if (!allowedAttrs.test(n.attributes[j].name)) {
                        n.removeAttribute(n.attributes[j].name);
                    }
                }

                if (n.childElementCount) {
                    cleanContainer(n);
                }
            }
        };

        platform.insertHTML = function (node, str) {
            if (!node || typeof str !== "string") {
                return;
            }

            if (str.indexOf("<") === -1) {
                node.insertAdjacentText("beforeend", str);
                return;
            }

            safeContainer.innerHTML = str;
            cleanContainer(safeContainer);

            var nodeDoc = node.ownerDocument;
            var frag = nodeDoc.createDocumentFragment();

            while (safeContainer.firstChild) {
                frag.appendChild(nodeDoc.adoptNode(safeContainer.firstChild));
            }

            node.appendChild(frag);
        };

        platform.insertHTML(node, str);
    };
}
var parseHotkey = function (e, numpad) {
    var m = e.button;
    if (m) {
        var k = "Mouse" + m;
    } else if (numpad) {
        switch (e.code) {
            case "Numpad1":
                var k = "End";
                break;
            case "Numpad2":
                var k = "ArrowDown";
                break;
            case "Numpad3":
                var k = "PageDown";
                break;
            case "Numpad4":
                var k = "ArrowLeft";
                break;
            case "Numpad0":
                var k = "Insert";
                break;
            case "Numpad6":
                var k = "ArrowRight";
                break;
            case "Numpad7":
                var k = "Home";
                break;
            case "Numpad8":
                var k = "ArrowUp";
                break;
            case "Numpad9":
                var k = "PageUp";
                break;
            case "NumpadDecimal":
                var k = "Delete";
                break;
            default:
                var k = e.code
                    .replace("Key", "")
                    .replace("Digit", "")
                    .replace("Numpad", "")
                    .replace(/Add$/, "Equal(Add)")
                    .replace(/Equal$/, "Equal(Add)")
                    .replace("Subtract", "Minus")
                    .replace("Divide", "Slash")
                    .replace("Decimal", "Period")
                    .replace(/(?<!Arrow)Right/, "")
                    .replace(/(?<!Arrow)Left/, "");
        }
    } else {
        var k = e.code
            .replace("Key", "")
            .replace("Digit", "")
            .replace("Numpad", "")
            .replace(/Add$/, "Equal(Add)")
            .replace(/Equal$/, "Equal(Add)")
            .replace("Subtract", "Minus")
            .replace("Divide", "Slash")
            .replace("Decimal", "Period")
            .replace(/(?<!Arrow)Right/, "")
            .replace(/(?<!Arrow)Left/, "");
    }
    var hotkey = "";

    if (e.shiftKey && (k == "Control" || k == "Alt" || k == "")) {
        k = "Shift";
    } else if (e.altKey && k == "Control") {
        k = "Alt";
    }
    if (e.ctrlKey && k != "Control") {
        hotkey += "Ctrl+";
    }
    if (e.altKey && k != "Alt") {
        hotkey += "Alt+";
    }
    if (e.shiftKey && k != "Shift" && k != "") {
        hotkey += "Shift+";
    }

    hotkey += k;
    return hotkey;
};
