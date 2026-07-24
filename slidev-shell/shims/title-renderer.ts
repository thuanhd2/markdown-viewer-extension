/**
 * #slidev/title-renderer shim
 *
 * Renders a slide's title as plain text.
 * Used by internals/Goto.vue for the slide picker.
 */
import { defineComponent, h } from 'vue'

export default defineComponent({
  name: 'TitleRenderer',
  props: {
    no: { type: Number, required: true },
  },
  setup(props) {
    return () => {
      const slides: any[] = (window as any).__SLIDEV__?.slides ?? []
      const slide = slides.find((s: any) => s.no === props.no)
      const fallbackTitle = Number.isFinite(props.no) ? `Slide ${props.no}` : 'Slide'
      return h('span', slide?.title ?? fallbackTitle)
    }
  },
})
