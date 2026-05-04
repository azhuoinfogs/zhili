<script setup>
import { ref, onMounted, onBeforeUnmount, shallowRef } from 'vue';
import { apiJson } from '../api.js';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, Filler);

const today = ref(null);
const trend = ref({ days: [] });
const err = ref('');
const canvasRef = shallowRef(null);
let chart;

function pad7Days(days) {
  const out = [];
  const todayD = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayD);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const hit = days.find((x) => String(x.date).slice(0, 10) === key);
    out.push(
      hit || {
        date: key,
        dau: 0,
        impressions: 0,
        clicks: 0,
        ctr: null,
      }
    );
  }
  return out;
}

async function load() {
  err.value = '';
  try {
    const [t, tr] = await Promise.all([apiJson('/admin/stats/today'), apiJson('/admin/stats/trend7d')]);
    today.value = t;
    trend.value = tr;
    const series = pad7Days(tr.days || []);
    const labels = series.map((x) => String(x.date).slice(5));
    if (chart) chart.destroy();
    if (!canvasRef.value) return;
    chart = new Chart(canvasRef.value, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'DAU',
            data: series.map((x) => x.dau),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.1)',
            fill: true,
            tension: 0.2,
            yAxisID: 'y',
            spanGaps: true,
          },
          {
            label: 'CTR',
            data: series.map((x) => (x.ctr == null ? null : x.ctr * 100)),
            borderColor: '#16a34a',
            tension: 0.2,
            yAxisID: 'y1',
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { type: 'linear', position: 'left', title: { display: true, text: 'DAU' } },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'CTR ×100 (%)' },
          },
        },
        plugins: {
          title: { display: true, text: '近 7 日 DAU / CTR（与 event 表一致）' },
          tooltip: {
            callbacks: {
              label(ctx) {
                if (ctx.dataset.label === 'CTR') {
                  const v = ctx.parsed.y;
                  return v == null ? 'CTR: —' : `CTR: ${(v / 100).toFixed(4)}`;
                }
                return `${ctx.dataset.label}: ${ctx.parsed.y}`;
              },
            },
          },
        },
      },
    });
  } catch (e) {
    err.value = e.message;
  }
}

onMounted(load);
onBeforeUnmount(() => {
  if (chart) chart.destroy();
});
</script>

<template>
  <div>
    <div v-if="today" class="card metrics">
      <h2>今日核心指标</h2>
      <p class="sub">统计口径与 MySQL <code>event</code> 表一致（服务器 <code>CURDATE()</code>）</p>
      <div class="grid">
        <div class="cell">
          <div class="num">{{ today.eventCount }}</div>
          <div class="lbl">事件量</div>
        </div>
        <div class="cell">
          <div class="num">{{ today.dau }}</div>
          <div class="lbl">DAU</div>
        </div>
        <div class="cell">
          <div class="num">{{ today.impressions }}</div>
          <div class="lbl">曝光 impression</div>
        </div>
        <div class="cell">
          <div class="num">{{ today.clicks }}</div>
          <div class="lbl">点击 click + purchase_click</div>
        </div>
        <div class="cell">
          <div class="num">{{ today.ctr == null ? '—' : (today.ctr * 100).toFixed(2) + '%' }}</div>
          <div class="lbl">CTR（点击/曝光）</div>
        </div>
      </div>
    </div>
    <p v-if="err" class="err">{{ err }}</p>
    <div class="card" style="margin-top: 16px">
      <canvas ref="canvasRef" height="120"></canvas>
    </div>
  </div>
</template>

<style scoped>
.metrics h2 {
  margin-top: 0;
}
.sub {
  color: #666;
  font-size: 13px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
  margin-top: 16px;
}
.cell {
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}
.num {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111;
}
.lbl {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}
</style>
