// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightGiscus from "starlight-giscus";
import starlightObsidian, { obsidianSidebarGroup } from "starlight-obsidian";
import starlightUiTweaks from "starlight-ui-tweaks";

export default defineConfig({
  integrations: [
    starlight({
      title: "Herbarium.Requiem.Garden",
      defaultLocale: "root",
      locales: {
        root: {
          label: "简体中文",
          lang: "zh-CN",
        },
        en: {
          label: "English",
        },
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/AsterisMono/herbarium.requiem.garden",
        },
      ],
      plugins: [
        // Generate the Obsidian vault pages.
        starlightObsidian({
          vault: "./Herbarium",
          sidebar: {
            label: "知识库",
            collapsedFolders: true,
          },
          copyFrontmatter: "starlight",
        }),
        starlightUiTweaks({
          navbarLinks: [
            {
              label: "关于我",
              href: "/aboutme",
            },
            {
              label: "朋友们",
              href: "/friends",
            },
          ],
          locales: {
            en: {
              navbarLinks: [
                {
                  label: "About Me",
                  href: "/aboutme",
                },
                {
                  label: "Friends",
                  href: "/friends",
                },
              ],
            },
          },
        }),
        starlightGiscus({
          repo: "AsterisMono/herbarium.requiem.garden",
          repoId: "R_kgDOQ7tNcA",
          category: "Announcements",
          categoryId: "DIC_kwDOQ7tNcM4C1Ib-",
        }),
      ],
      sidebar: [obsidianSidebarGroup],
      customCss: ["./src/custom.css", "./src/fonts/font-face.css"],
      pagination: false,
    }),
  ],
});
