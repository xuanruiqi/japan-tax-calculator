<script setup lang="ts">
import { computed } from 'vue';

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
</style>
