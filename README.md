# Imagus mod(hkpd's edition)

Forked from [TheFantasticWarrior](https://github.com/TheFantasticWarrior/chrome-extension-imagus/)

The only thing I have changed is the cursor when you hover over an image because the default one was ugly.

The rest of this text comes from TheFantasticWarrior's readme

## Install Instructions

### **_chrome_**

Simple method(may have issues that the extension gets removed randomly):  
Enable developer mode in chrome://extensions and drag the [release](https://github.com/TheFantasticWarrior/chrome-extension-imagus/releases) zip in.

Other method:  
Unzip to a place you won't delete, click "load unpacked", then select the folder.

### **_firefox_**

use the [official add-ons page](https://addons.mozilla.org/en-US/firefox/addon/imagus-mod/) for download and more info about this mod.  
If you want to test versions on github go to about:debugging#/runtime/this-firefox and install temporary add-on.

For site support checkout [r/imagus](https://www.reddit.com/r/imagus/), for bug report you can visit the subreddit [FAQ](http://forum.ru-board.com/topic.cgi?forum=5&topic=50874&start=0&limit=1&m=7#1) to confirm the bug is on my end before submitting issues

To test unreleased changes, compress src contents into a zip and import with methods above.

# Imagus (Community Edition)

This repository is a "Mirror" of the [official Imagus source hosted on Google Drive](https://drive.google.com/drive/folders/0Bx8fnUCX4W2IUTNPT0s2eUFDQms).

This `community` branch is a [minor] fork of Imagus. It applies the following patches:

-   [Remove the "update_url"](https://github.com/Zren/chrome-extension-imagus/commit/3974d88844ce044c0162e67247ac173f6cd488c9) so it doesn't auto update.
-   Load the unminified `*.js` + `*.html` files instead of the minified ones for easier development.
-   [Ignore "Local Extension Settings" folder](https://github.com/Zren/chrome-extension-imagus/commit/7ed81835b490fa0997a8accea95a442348e19cee) which is created when loaded as an unpacked developer extension.
-   Add null check ([Pull Request #2](https://github.com/Zren/chrome-extension-imagus/pull/2))
-   Compare the `master` with the `community` branch to see most changes:  
    https://github.com/Zren/chrome-extension-imagus/compare/master...community

Please note that the primary purpose of this repository is to audit the code. While I will merge pull requests, I won't be actively developing the extension / updating the sieves.

See README.txt for the original readme, including build/minifying instructions.

## Auditing

difference-to-chrome-store.diff contains the differences between what is in src
and what is actually published on the chrome store (extracted from the .crx).

## Updating the sieve

To just update the sieve, which is what describes how to extract images from
various sources, run the `update_sieve.sh` shell script.

If the version info in the sieve isn't up to date for some reason (look at the
dates in the Drive linked above), use `update_sieve.sh --force`.
