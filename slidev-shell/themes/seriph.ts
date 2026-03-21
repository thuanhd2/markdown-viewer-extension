/**
 * Theme entry: @slidev/theme-seriph
 *
 * Exports layout overrides + imports theme CSS.
 * Loaded dynamically by the shell based on frontmatter `theme` field.
 */
import type { Component } from 'vue'

// Theme styles as inline string
import css from './css/seriph.css?inline'

// Theme layout overrides
import Cover from '@slidev/theme-seriph/layouts/cover.vue'
import Fact from '@slidev/theme-seriph/layouts/fact.vue'
import Intro from '@slidev/theme-seriph/layouts/intro.vue'
import Quote from '@slidev/theme-seriph/layouts/quote.vue'
import Section from '@slidev/theme-seriph/layouts/section.vue'
import Statement from '@slidev/theme-seriph/layouts/statement.vue'

export const layouts: Record<string, Component> = {
  cover: Cover,
  fact: Fact,
  intro: Intro,
  quote: Quote,
  section: Section,
  statement: Statement,
}

export { css }

export const fonts = {
  sans: 'PT Serif',
  serif: 'PT Serif',
  mono: 'PT Mono',
}
