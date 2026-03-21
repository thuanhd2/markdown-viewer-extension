/**
 * Theme entry: @slidev/theme-bricks
 *
 * Exports layout overrides + imports theme CSS.
 * Loaded dynamically by the shell based on frontmatter `theme` field.
 */
import type { Component } from 'vue'

// Theme styles as inline string
import css from './css/bricks.css?inline'

// Theme layout overrides
import Blank from '@slidev/theme-bricks/layouts/blank.vue'
import Cover from '@slidev/theme-bricks/layouts/cover.vue'
import Default from '@slidev/theme-bricks/layouts/default.vue'
import Fact from '@slidev/theme-bricks/layouts/fact.vue'
import Intro from '@slidev/theme-bricks/layouts/intro.vue'
import Items from '@slidev/theme-bricks/layouts/items.vue'
import Quote from '@slidev/theme-bricks/layouts/quote.vue'
import Section from '@slidev/theme-bricks/layouts/section.vue'
import Statement from '@slidev/theme-bricks/layouts/statement.vue'

export const layouts: Record<string, Component> = {
  blank: Blank,
  cover: Cover,
  default: Default,
  fact: Fact,
  intro: Intro,
  items: Items,
  quote: Quote,
  section: Section,
  statement: Statement,
}

export { css }

export const fonts = {
  sans: 'Signika Negative',
  serif: 'Sigmar One',
  mono: 'Fira Code',
}

export const colorSchema = 'light'
