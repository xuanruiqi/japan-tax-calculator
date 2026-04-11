<script setup lang="ts">
import { computed, ref } from 'vue';

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

const props = defineProps<{
  slices: PieSlice[];
  centerLabel?: string;
  centerSub?: string;
}>();

const total = computed(() => props.slices.reduce((s, d) => s + d.value, 0));

const CX = 120;
const CY = 120;
const R_OUTER = 110;
const R_INNER = 66;

function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function donutPath(startDeg: number, endDeg: number): string {
  // Clamp to almost-full circle to avoid degenerate path when a single slice is 100%
  const sweep = Math.min(endDeg - startDeg, 359.9999);
  const end = startDeg + sweep;
  const oStart = polarToXY(startDeg, R_OUTER);
  const oEnd   = polarToXY(end, R_OUTER);
  const iStart = polarToXY(startDeg, R_INNER);
  const iEnd   = polarToXY(end, R_INNER);
  const large  = sweep > 180 ? 1 : 0;
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${iStart.x} ${iStart.y}`,
    'Z',
  ].join(' ');
}

interface Segment {
  path: string;
  color: string;
  label: string;
  value: number;
  pct: number;
  midX: number;
  midY: number;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  value: number;
  pct: number;
  color: string;
}

const tooltip = ref<TooltipState>({ visible: false, x: 0, y: 0, label: '', value: 0, pct: 0, color: '' });

function onSegmentEnter(seg: Segment, e: MouseEvent) {
  tooltip.value = { visible: true, x: e.clientX, y: e.clientY, label: seg.label, value: seg.value, pct: seg.pct, color: seg.color };
}
function onSegmentMove(e: MouseEvent) {
  tooltip.value.x = e.clientX;
  tooltip.value.y = e.clientY;
}
function onSegmentLeave() {
  tooltip.value.visible = false;
}

const formatValue = (v: number) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(v);

const segments = computed((): Segment[] => {
  if (!total.value) return [];
  let cursor = 0;
  return props.slices
    .filter(s => s.value > 0)
    .map(s => {
      const deg = (s.value / total.value) * 360;
      const start = cursor;
      cursor += deg;
      const mid = start + deg / 2;
      const midPt = polarToXY(mid, (R_OUTER + R_INNER) / 2);
      return {
        path: donutPath(start, cursor),
        color: s.color,
        label: s.label,
        value: s.value,
        pct: Math.round((s.value / total.value) * 1000) / 10,
        midX: midPt.x,
        midY: midPt.y,
      };
    });
});
</script>

<template>
  <div class="donut-chart">
    <svg :viewBox="`0 0 ${CX * 2} ${CY * 2}`" class="donut-svg">
      <path
        v-for="(seg, i) in segments"
        :key="i"
        :d="seg.path"
        :fill="seg.color"
        class="donut-segment"
        @mouseenter="onSegmentEnter(seg, $event)"
        @mousemove="onSegmentMove($event)"
        @mouseleave="onSegmentLeave()"
      />
      <!-- Center label -->
      <text :x="CX" :y="CY - 10" class="center-label" text-anchor="middle" dominant-baseline="middle">
        {{ centerLabel }}
      </text>
      <text :x="CX" :y="CY + 12" class="center-sub" text-anchor="middle" dominant-baseline="middle">
        {{ centerSub }}
      </text>
    </svg>

    <!-- Legend -->
    <ul class="donut-legend">
      <li v-for="(seg, i) in segments" :key="i" class="legend-item">
        <span class="legend-swatch" :style="{ background: seg.color }"></span>
        <span class="legend-label">{{ seg.label }}</span>
        <span class="legend-pct">{{ seg.pct }}%</span>
      </li>
    </ul>
  </div>

  <!-- Floating tooltip -->
  <Teleport to="body">
    <div
      v-if="tooltip.visible"
      class="donut-tooltip"
      :style="{ top: tooltip.y + 16 + 'px', left: tooltip.x + 12 + 'px' }"
    >
      <span class="donut-tooltip-swatch" :style="{ background: tooltip.color }"></span>
      <span class="donut-tooltip-label">{{ tooltip.label }}</span>
      <span class="donut-tooltip-value">{{ formatValue(tooltip.value) }}</span>
      <span class="donut-tooltip-pct">{{ tooltip.pct }}%</span>
    </div>
  </Teleport>
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
  filter: drop-shadow(0 4px 16px rgba(0,0,0,0.06));
}

.donut-segment {
  transition: opacity 0.2s;
}
.donut-segment:hover {
  opacity: 0.82;
}

.center-label {
  font-size: 11px;
  font-weight: 700;
  fill: #111;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.center-sub {
  font-size: 8px;
  font-weight: 400;
  fill: #888;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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

/* Floating segment tooltip — teleported to body, so not scoped */
</style>

<style>
.donut-tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  padding: 0.45rem 0.75rem;
  font-size: 0.82rem;
  white-space: nowrap;
  color: #111;
}

.donut-tooltip-swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.donut-tooltip-label {
  color: #555;
}

.donut-tooltip-value {
  font-weight: 600;
  color: #111;
}

.donut-tooltip-pct {
  color: #888;
}
</style>
