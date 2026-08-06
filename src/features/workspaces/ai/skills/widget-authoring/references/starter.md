# Widget starter

Use this as the starting structure for a new widget. ThinkEx supplies the outer title, border, background, gutter, type, form controls, and these helpers:

- `.tx-stack`: vertical layout with standard spacing
- `.tx-row`: wrapping control or action row
- `.tx-panel`: bordered internal region
- `.tx-muted`: supporting text
- `.tx-visual`: clipped positioning region for a chart, diagram, or simulation

Buttons are neutral by default. Put `data-variant="primary"` on the single main action when the widget has one. Elements with `role="tablist"` and `role="tab"` receive a compact tab treatment. Authored styles load after this foundation and may override it when the requested experience needs a distinctive visual language.

Adapt this skeleton rather than recreating its structural CSS. Replace or remove every commented region; never leave an empty region or placeholder in the finished source.

```html
<style>
	/* Add only styles specific to the requested experience. */
</style>
<div class="tx-stack">
	<div class="tx-row">
		<!-- Controls for the primary interaction. -->
	</div>
	<div class="tx-panel tx-visual">
		<!-- The dominant diagram, simulation, result, chart, game, or activity. -->
	</div>
	<p class="tx-muted"><!-- Optional short guidance. --></p>
</div>
<script>
	/* Read elements, define state, render from state, and wire every control. */
</script>
```

Keep the root unframed. Before writing the block, remove unused regions, wire every visible control, and HTML-escape the complete fragment inside the widget element.
