/**
 * Theme entry: slidev-theme-dracula
 *
 * Exports layout overrides + imports theme CSS.
 * Loaded dynamically by the shell based on frontmatter `theme` field.
 */
import type { Component } from 'vue'

// Theme styles as inline string
import css from './css/dracula.css?inline'

// Theme layout overrides
import Author from 'slidev-theme-dracula/layouts/author.vue'
import Cover from 'slidev-theme-dracula/layouts/cover.vue'
import Fact from 'slidev-theme-dracula/layouts/fact.vue'
import ImageLeft from 'slidev-theme-dracula/layouts/image-left.vue'
import ImageRight from 'slidev-theme-dracula/layouts/image-right.vue'
import Intro from 'slidev-theme-dracula/layouts/intro.vue'
import Quote from 'slidev-theme-dracula/layouts/quote.vue'
import Section from 'slidev-theme-dracula/layouts/section.vue'
import Statement from 'slidev-theme-dracula/layouts/statement.vue'

export const layouts: Record<string, Component> = {
  author: Author,
  cover: Cover,
  fact: Fact,
  'image-left': ImageLeft,
  'image-right': ImageRight,
  intro: Intro,
  quote: Quote,
  section: Section,
  statement: Statement,
}

export { css }

export const fonts = {
  sans: 'Nunito Sans',
  mono: 'JetBrains Mono',
}

export const colorSchema = 'dark'
