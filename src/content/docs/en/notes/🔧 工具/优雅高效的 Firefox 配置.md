---
title: Elegant and Efficient Firefox Configuration
editUrl: false
slug: en/elegant-firefox
lastUpdated: 2026-02-14T00:00:00.000Z
draft: false
banner:
  content: This content is translated by an LLM and may contain inaccuracies.
---

First, here's the final look:

![Pasted image 20260214200441.png](../../../../../assets/notes/附件/pasted-image-20260214200441.png)

## Highlights

* Sidebery-driven sidebar
* Hide most useless elements on the interface (horizontal tab bar, new tab page Feed, bookmarks bar, tab bar header, etc.)
* Disable built-in password manager (use 1Password)
* Includes selected browser extensions:
  * uBlock Origin: Ad blocker
  * SponsorBlock: Block YouTube sponsor segments
  * PrivacyBadger: Block trackers
  * Vimium: Vim key bindings
  * Refined GitHub: GitHub interface enhancement
  * DecentralEyes: Replace CDN resources locally (seems broken now)
  * ClearURLs: Remove tracking parameters from URLs
  * Chrome Mask: Disguise browser as Chrome (solve some mysterious issues)
  * NixOS Packages/Options Search + Redirect NixOS Wiki: Nix ecosystem expansion
  * Tab Session Manager: Save and sync Tab Sessions
  * 1Password: Password manager

## If you use Nix + Home Manager...

Refer to the [configuration file](https://github.com/AsterisMono/flake/blob/main/homeModules/apps/firefox/default.nix)

## Regular Configuration

Use [Firefox Policies](https://mozilla.github.io/policy-templates/) to configure extensions, or install them manually

Set the following flags to true in `about:config`:

```
toolkit.legacyUserProfileCustomizations.stylesheets
browser.newtabpage.activity-stream.feeds.topsites
browser.ctrlTab.sortByRecentlyUsed
media.ffmpeg.vaapi.enabled
gfx.webrender.all
media.hardware-video-decoding.force-enabled
```

Write into `userChrome.css`:

```
 #TabsToolbar {
  display: none;
}
#sidebar-header {
  display: none;
}
```
