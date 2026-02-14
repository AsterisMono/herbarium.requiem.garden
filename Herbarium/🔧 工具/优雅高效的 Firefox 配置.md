---
lastUpdated: 2026-02-14
slug: elegant-firefox
draft: false
---

首先上效果图：

![[Pasted image 20260214200441.png]]

## 亮点

- Sidebery 驱动的侧边标签栏
- 隐藏界面上大多数无用元素（横向标签栏、新标签页 Feed、书签栏、标签栏头部等）
- 关闭自带密码管理器（使用 1Password）
- 自带精选浏览器扩展：
	- uBlock Origin：屏蔽广告
	- SponsorBlock：屏蔽 Youtube 视频 sponsor 段
	- PrivacyBadger：屏蔽追踪器
	- Vimium：Vim 键位控制
	- Refined GitHub：GitHub 界面翻新
	- DecentralEyes：从本地替换 CDN 资源（似乎已失效）
	- ClearURLs：清除 URL 中的追踪参数
	- Chrome Mask：伪装浏览器是 Chrome（解决一些神秘问题）
	- NixOS Packages/Options Search + Redirect NixOS Wiki：Nix 生态拓展
	- Tab Session Manager：保存和同步 Tab Sessions
	- 1Password：密码管理器

## 如果你使用 Nix + Home Manager...

参考这里的 [配置文件](https://github.com/AsterisMono/flake/blob/main/homeModules/apps/firefox/default.nix)

## 常规配置

使用 [Firefox Policies](https://mozilla.github.io/policy-templates/) 配置扩展，或者自行安装

在 `about:config` 中设置以下 flags 为 true：

```
toolkit.legacyUserProfileCustomizations.stylesheets
browser.newtabpage.activity-stream.feeds.topsites
browser.ctrlTab.sortByRecentlyUsed
media.ffmpeg.vaapi.enabled
gfx.webrender.all
media.hardware-video-decoding.force-enabled
```

写入 `userChrome.css`：

```
 #TabsToolbar {
  display: none;
}
#sidebar-header {
  display: none;
}
```