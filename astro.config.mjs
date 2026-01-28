// @ts-check
import starlight from "@astrojs/starlight";
import starlightUtils from "@lorenzo_lewis/starlight-utils";
import { defineConfig } from "astro/config";
import starlightGiscus from "starlight-giscus";
import starlightObsidian, { obsidianSidebarGroup } from "starlight-obsidian";
import starlightUiTweaks from "starlight-ui-tweaks";
import llmTranslator from "astro-llm-translator";
import starlightTranslator from 'astro-llm-translator/starlight'; // Import the plugin

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
        {
          icon: "telegram",
          label: "Telegram",
          href: "https://t.me/noa_virellia",
        },
      ],
      plugins: [
        // Generate the Obsidian vault pages.
        starlightObsidian({
          vault: "./Herbarium",
          sidebar: {
            label: {
              'zh-CN': '知识库',
              en: 'Notes'
            },
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
                  href: "/en/aboutme",
                },
                {
                  label: "Friends",
                  href: "/en/friends",
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
        starlightUtils({
          multiSidebar: {
            switcherStyle: "horizontalList",
          },
        }),
        starlightTranslator(),
      ],
      sidebar: [
        obsidianSidebarGroup,
        {
          label: "作品",
          translations: {
            'en': 'Works'
          },
          autogenerate: { directory: "/works" },
        },
      ]
      ,
      customCss: ["./src/custom.css", "./src/fonts/font-face.css"],
      pagination: false,
    }),
    llmTranslator({
      sourceLang: "root",
      customInstructions: `
        You are translating content for Requiem Garden.

        Requiem Garden is a quiet, personal digital garden:
        a place for systems, memories, and gentle existence.

        Tone & Style
        Calm, soft, and restrained
        Clear and readable, never flashy
        Slightly poetic when appropriate, but never ornamental
        Prefer warmth over cleverness
        Avoid marketing language, hype, or dramatic exaggeration

        Voice
        Introspective, steady, and sincere
        Respects boundaries and emotional distance
        Treats both people and systems with care

        Technical Content
        Preserve accuracy and structure
        Keep explanations clean and precise
        Do not oversimplify; trust the reader’s intelligence
        When unsure, prefer clarity over flourish

        Language Refinement
        Avoid academic or textbook-style transitions (e.g. “Firstly”, “Secondly”, “Two questions arise here”)
        Prefer natural reasoning flow over formal exposition
        Break long explanatory sentences into shorter, calmer ones when possible
        Write as if explaining to a peer during a quiet debugging session, not presenting a report
        If the original phrasing feels structurally correct but emotionally stiff, soften it slightly while preserving technical accuracy.
      `,
      targetLangs: ["en"],
      contentDir: "src/content/docs",
      banner: {
        en: "This content is translated by an LLM and may contain inaccuracies."
      }
    }),
  ],
});
