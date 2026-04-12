<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

export interface PieSlice {
  label: string
  value: number
  color: string
}

const props = defineProps<{
  slices: PieSlice[]
  centerLabel?: string
  centerSub?: string
}>()

const total = computed(() => props.slices.reduce((s, d) => s + d.value, 0))

const CX = 120
const CY = 120
const R_OUTER = 110
const R_INNER = 66

function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function donutPath(startDeg: number, endDeg: number): string {
  // Clamp to almost-full circle to avoid degenerate path when a single slice is 100%
  const sweep = Math.min(endDeg - startDeg, 359.9999)
  const end = startDeg + sweep
  const oStart = polarToXY(startDeg, R_OUTER)
  const oEnd = polarToXY(end, R_OUTER)
  const iStart = polarToXY(startDeg, R_INNER)
  const iEnd = polarToXY(end, R_INNER)
  const large = sweep > 180 ? 1 : 0
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${iStart.x} ${iStart.y}`,
    'Z',
  ].join(' ')
}

interface Segment {
  path: string
  color: string
  label: string
  value: number
  pct: number
}

interface TooltipState {
  visible: boolean
  x: number
  y: number
  label: string
  value: number
  pct: number
  color: string
}

const figureRef = ref<HTMLElement | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const tooltip = ref<TooltipState>({
  visible: false,
  x: 0,
  y: 0,
  label: '',
  value: 0,
  pct: 0,
  color: '',
})

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

async function positionTooltip(clientX: number, clientY: number) {
  await nextTick()
  const figure = figureRef.value
  const panel = tooltipRef.value
  if (!figure || !panel) return

  const figureRect = figure.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  const padding = 8
  const offset = 12

  const preferredX = clientX - figureRect.left + offset
  const preferredY = clientY - figureRect.top + offset

  const maxX = figureRect.width - panelRect.width - padding
  const maxY = figureRect.height - panelRect.height - padding

  tooltip.value.x = clamp(preferredX, padding, Math.max(padding, maxX))
  tooltip.value.y = clamp(preferredY, padding, Math.max(padding, maxY))
}

async function showTooltip(seg: Segment, event: MouseEvent | FocusEvent) {
  const target = event.currentTarget as SVGGraphicsElement | null
  const rect = target?.getBoundingClientRect()

  tooltip.value = {
    visible: true,
    x: tooltip.value.x,
    y: tooltip.value.y,
    label: seg.label,
    value: seg.value,
    pct: seg.pct,
    color: seg.color,
  }

  const clientX =
    event instanceof MouseEvent ? event.clientX : (rect?.left ?? 0) + (rect?.width ?? 0) / 2
  const clientY =
    event instanceof MouseEvent ? event.clientY : (rect?.top ?? 0) + (rect?.height ?? 0) / 2

  await positionTooltip(clientX, clientY)
}

async function moveTooltip(event: MouseEvent) {
  if (!tooltip.value.visible) return
  await positionTooltip(event.clientX, event.clientY)
}

function hideTooltip() {
  tooltip.value.visible = false
}

const formatValue = (v: number) =>
  new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(v)

const segments = computed((): Segment[] => {
  if (!total.value) return []
  let cursor = 0
  return props.slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const deg = (s.value / total.value) * 360
      const start = cursor
      cursor += deg
      return {
        path: donutPath(start, cursor),
        color: s.color,
        label: s.label,
        value: s.value,
        pct: Math.round((s.value / total.value) * 1000) / 10,
      }
    })
})
</script>

<template>
  <div class="donut-chart">
    <div ref="figureRef" class="donut-figure">
      <svg :viewBox="`0 0 ${CX * 2} ${CY * 2}`" class="donut-svg">
        <path
          v-for="(seg, i) in segments"
          :key="i"
          :d="seg.path"
          :fill="seg.color"
          class="donut-segment"
          tabindex="0"
          :aria-label="`${seg.label}: ${formatValue(seg.value)} (${seg.pct}%)`"
          @mouseenter="showTooltip(seg, $event)"
          @mousemove="moveTooltip($event)"
          @mouseleave="hideTooltip"
          @focus="showTooltip(seg, $event)"
          @blur="hideTooltip"
        />
        <!-- Center label -->
        <text
          :x="CX"
          :y="CY - 10"
          class="center-label"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {{ centerLabel }}
        </text>
        <text
          :x="CX"
          :y="CY + 12"
          class="center-sub"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {{ centerSub }}
        </text>
      </svg>

      <div
        v-if="tooltip.visible"
        ref="tooltipRef"
        class="donut-tooltip"
        :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
      >
        <div class="donut-tooltip-panel">
          <div class="donut-tooltip-heading">
            <span class="donut-tooltip-swatch" :style="{ background: tooltip.color }"></span>
            <span class="donut-tooltip-label">{{ tooltip.label }}</span>
          </div>
          <div class="donut-tooltip-metrics">
            <span class="donut-tooltip-value">{{ formatValue(tooltip.value) }}</span>
            <span class="donut-tooltip-pct">{{ tooltip.pct }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <ul class="donut-legend">
      <li v-for="(seg, i) in segments" :key="i" class="legend-item">
        <span class="legend-swatch" :style="{ background: seg.color }"></span>
        <span class="legend-label">{{ seg.label }}</span>
        <span class="legend-pct">{{ seg.pct }}%</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.donut-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
}

.donut-svg {
  width: 100%;
  max-width: 260px;
  overflow: visible;
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.06));
}

.donut-figure {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

.donut-segment {
  transition: opacity 0.2s;
  cursor: help;
  outline: none;
}
.donut-segment:hover,
.donut-segment:focus-visible {
  opacity: 0.82;
}

.donut-tooltip {
  position: absolute;
  z-index: 20;
  pointer-events: none;
  max-width: min(16rem, calc(100vw - 1.5rem));
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #fff;
  color: #111827;
  box-shadow: 0 10px 30px rgba(17, 24, 39, 0.12);
}

.center-label {
  font-size: 11px;
  font-weight: 700;
  fill: #111;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.center-sub {
  font-size: 8px;
  font-weight: 400;
  fill: #888;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.donut-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.82rem;
  color: #333;
}

.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-label {
  flex: 1;
  color: #555;
}

.legend-pct {
  font-weight: 600;
  color: #111;
  min-width: 3.5rem;
  text-align: right;
}

.donut-tooltip-swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.donut-tooltip-panel {
  display: grid;
  gap: 0.45rem;
  padding: 0.75rem 0.85rem;
}

.donut-tooltip-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.donut-tooltip-label {
  color: #555;
  font-size: 0.82rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.donut-tooltip-metrics {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.donut-tooltip-value {
  font-weight: 600;
  color: #111;
  font-size: 0.82rem;
  white-space: nowrap;
}

.donut-tooltip-pct {
  color: #888;
  font-size: 0.78rem;
  white-space: nowrap;
}

@media (max-width: 480px) {
  .donut-chart {
    gap: 1.1rem;
  }

  .donut-tooltip-panel {
    padding: 0.7rem 0.75rem;
  }

  .donut-tooltip-metrics {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
  }
}
</style>
