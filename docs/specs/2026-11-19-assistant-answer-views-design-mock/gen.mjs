// Writes design.html: the catalog of answer views, concept A (one anatomy per view) and concept C
// (the current answer block extended per kind). Every figure is fixed here so views agree.
import { writeFileSync } from "node:fs";

const svg = (paths, cls = "glyph") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const I = {
  open: svg('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>'),
  copy: svg('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
  arrow: svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', "arrow"),
  check: svg('<path d="M20 6 9 17l-5-5"/>', "check"),
  sort: svg('<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>'),
  chart: svg('<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16h8"/><path d="M7 11h12"/><path d="M7 6h3"/>'),
  table: svg('<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>'),
  reply: svg('<polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>'),
  chev: svg('<path d="m6 9 6 6 6-6"/>', "glyph chev"),
  wallet: svg('<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'),
  trend: svg('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
  card: svg('<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>'),
  cal: svg('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'),
  target: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  receipt: svg('<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>'),
  bank: svg('<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>'),
  file: svg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>'),
  wand: svg('<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/>'),
  book: svg('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'),
  repeat: svg('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  shield: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'),
  calc: svg('<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>'),
  x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  clip: svg('<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'),
  layers: svg('<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>'),
  search: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
  scale: svg('<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>'),
  pulse: svg('<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>'),
  split: svg('<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
  swap: svg('<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>'),
  pen: svg('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>'),
  pie: svg('<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>'),
  coins: svg('<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>'),
  plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
};

const brl = (v) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const c = (n) => `var(--equori-slot-${n})`;
const neutral = "color-mix(in oklab, var(--slotted-text) 34%, transparent)";

function table(head, rows) {
  const th = head.map((h, i) => `<th${i ? ' class="r"' : ""}>${h}</th>`).join("");
  const tr = rows
    .map((r) => `<tr>${r.map((v, i) => `<td${i ? ' class="r"' : ""}>${v}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="dataTable"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

// Every view carries one footer: the record's screen, the chart/table switch, copy.
let vid = 0;
function foot(id, open, data) {
  const link = open ? `<a class="act" href="#">${open} ${I.open}</a>` : "";
  const mode = data
    ? `<span class="mode" role="radiogroup" aria-label="Forma da visão"><label title="Gráfico"><input type="radio" name="${id}m" value="g" checked>${I.chart}<span class="sr">Gráfico</span></label><label title="Tabela"><input type="radio" name="${id}m" value="t">${I.table}<span class="sr">Tabela</span></label></span>`
    : "";
  return `<footer class="viewFoot">${link}<span class="footEnd">${mode}<button class="tool" type="button" aria-label="Copiar como texto" title="Copiar como texto">${I.copy}</button></span></footer>`;
}

const unitToggle = (id) =>
  `<span class="unit" role="radiogroup" aria-label="Unidade"><label><input type="radio" name="${id}u" value="a" checked>R$</label><label><input type="radio" name="${id}u" value="p">%</label></span>`;

const chips = (items) =>
  `<ul class="next" aria-label="Perguntas seguintes">${items.map((q) => `<li><button class="chip" type="button">${I.reply}<span>${q}</span></button></li>`).join("")}</ul>`;

function view({ icon, title, window, verdict, body, open, data, label, prov, next, unit, tone }) {
  const id = `v${++vid}`;
  const kind = icon ? `<span class="kind${tone ? ` ${tone}` : ""}">${I[icon]}</span>` : "";
  const main = data ? `<div class="viewBody">${body}</div><div class="viewTable">${data}</div>` : body;
  const section = `<section class="view" aria-label="${label ?? title}">
  <header class="viewHead">${kind}<span class="viewTitle">${title}</span><span class="viewWindow">${window}</span>${unit ? unitToggle(id) : ""}</header>
  ${verdict ? `<p class="verdict" data-wrap-ok>${verdict}</p>` : ""}
  ${main}
  ${prov ? `<p class="prov">${I.info}<span>${prov}</span></p>` : ""}
  ${foot(id, open, data)}
</section>`;
  return next ? `<div class="answer">${section}${chips(next)}</div>` : section;
}

const ask = (q) => `<p class="ask" data-wrap-ok>${q}</p>`;
const group = (title, items) =>
  `<div class="group"><h3 class="groupTitle">${title}</h3>${items.join("\n")}</div>`;

// ---------- Read views ----------

const sparkPts = [
  184.5, 184.1, 184.9, 185.2, 184.8, 185.6, 185.1, 185.9, 186.2, 185.7, 185.4, 186.1, 186.6,
  186.0, 186.3, 186.9, 186.4, 186.8, 187.1, 186.7, 186.9, 187.3, 186.9, 187.0, 187.6, 187.2,
  187.0, 187.5, 187.2, 187.43,
];
const spark = (() => {
  const min = 184, max = 188;
  const d = sparkPts
    .map((v, i) => `${i ? "L" : "M"}${((i / 29) * 120).toFixed(1)} ${(44 - ((v - min) / (max - min)) * 44).toFixed(1)}`)
    .join(" ");
  const last = 44 - ((187.43 - min) / (max - min)) * 44;
  return `<svg class="spark" viewBox="0 0 120 44" preserveAspectRatio="none" role="img" aria-label="Patrimônio em 30 dias, de R$ 184.514,18 a R$ 187.432,18"><path pathLength="1" d="${d}"/><circle cx="120" cy="${last.toFixed(1)}" r="4"/></svg>`;
})();

const figure = view({
  icon: "wallet", prov: "Saldos de 7 contas e cotações de 18/11", next: ["Como evoluiu no ano?", "Quanto está em renda fixa?"],
  title: "Patrimônio líquido",
  window: "hoje, 19/11",
  verdict: 'Cresceu <strong class="up">R$ 2.918,00 (1,6%)</strong> em 30 dias, puxado pelos investimentos.',
  body: `<div class="figure"><div><span class="figureValue">R$ 187.432,18</span><span class="figureDelta up">+R$ 2.918,00 em 30 dias</span></div>${spark}</div>
  <div class="parts">
    <div class="part" style="--part-color:${c(1)}"><span class="partKey">Contas</span><span class="partValue">R$ 14.210,40</span></div>
    <div class="part" style="--part-color:${c(2)}"><span class="partKey">Investimentos</span><span class="partValue">R$ 176.981,78</span></div>
    <div class="part" style="--part-color:${c(3)}"><span class="partKey">Fatura aberta</span><span class="partValue">−R$ 3.760,00</span></div>
  </div>`,
  open: "Visão geral",
  data: table(["Parte", "Valor"], [["Contas", "R$ 14.210,40"], ["Investimentos", "R$ 176.981,78"], ["Fatura aberta", "−R$ 3.760,00"]]),
});

function pairRow(name, ref, sub, refW, subW, delta) {
  return `<li class="row pair"><span class="rowKey">${name}</span><span class="rowValue">${sub}<small>${delta}</small></span>
  <span class="track"><i class="fill ref" style="width:${refW}%"></i></span>
  <span class="track"><i class="fill" style="width:${subW}%"></i></span></li>`;
}
const compare = view({
  icon: "chart", prov: "184 despesas de 3 contas; transferências fora", next: ["O que mais subiu no Mercado?", "E no ano todo?"],
  title: "Setembro × outubro por categoria",
  window: "set e out 2026",
  verdict: 'Outubro gastou <strong>R$ 363,25 a mais</strong> nestas 4 categorias; Mercado responde por R$ 312,40.',
  body: `<ul class="legend"><li><i class="key ref"></i>Setembro</li><li><i class="key"></i>Outubro</li></ul>
  <ul class="bars">
    ${pairRow("Mercado", "R$ 1.184,60", "R$ 1.497,00", 79.1, 100, "+312,40")}
    ${pairRow("Restaurantes", "R$ 610,20", "R$ 864,30", 40.8, 57.7, "+254,10")}
    ${pairRow("Transporte", "R$ 398,00", "R$ 412,75", 26.6, 27.6, "+14,75")}
    ${pairRow("Lazer", "R$ 520,00", "R$ 302,00", 34.7, 20.2, "−218,00")}
  </ul>`,
  open: "Relatórios",
  data: table(["Categoria", "Setembro", "Outubro"], [["Mercado", "R$ 1.184,60", "R$ 1.497,00"], ["Restaurantes", "R$ 610,20", "R$ 864,30"], ["Transporte", "R$ 398,00", "R$ 412,75"], ["Lazer", "R$ 520,00", "R$ 302,00"]]),
});

const vals = (value, pct) =>
  `<span class="vA">${value}<small>${pct}</small></span><span class="vP">${pct}<small>${value}</small></span>`;

function rankRow(n, name, value, pct, w, fill) {
  return `<li><a class="row" href="#" aria-label="${name}, ${value}, ${pct} — abrir transações"><span class="rowKey"><span class="rank">${n}</span><span class="rowName">${name}</span></span><span class="rowValue">${vals(value, pct)}</span><span class="track"><i class="fill" style="width:${w}%${fill ? `;--fill:${fill}` : ""}"></i></span></a></li>`;
}

// A row that opens in place to show what makes it up (payees of a category).
let xid = 0;
function rankRowX(n, name, value, pct, w, subs) {
  const id = `x${++xid}`;
  const max = subs[0][1];
  return `<li class="xrow"><input class="xToggle" type="checkbox" id="${id}"><label class="row" for="${id}" aria-label="${name}, ${value}, ${pct} — mostrar estabelecimentos"><span class="rowKey"><span class="rank">${n}</span><span class="rowName">${name}</span>${I.chev}</span><span class="rowValue">${vals(value, pct)}</span><span class="track"><i class="fill" style="width:${w}%"></i></span></label>
  <ul class="sub">${subs.map(([p, v, t]) => `<li><a class="subRow" href="#"><span class="rowName">${p}</span><span class="subBar"><i style="width:${((v / max) * 100).toFixed(1)}%"></i></span><span class="num">${t}</span></a></li>`).join("")}</ul></li>`;
}
const ranking = view({
  icon: "pie", unit: true, prov: "96 despesas de 3 contas em outubro", next: ["Mostrar como mapa do ano", "Comparar com setembro"],
  title: "Onde foi o dinheiro",
  window: "outubro 2026",
  verdict: 'Moradia leva <strong>39%</strong> dos <strong>R$ 8.191,05</strong> gastos em outubro.',
  body: `<ul class="bars">
    ${rankRowX(1, "Moradia", "R$ 3.200,00", "39%", 100, [["Aluguel", 2650, "R$ 2.650,00"], ["Condomínio", 412, "R$ 412,00"], ["Gás e água", 138, "R$ 138,00"]])}
    ${rankRowX(2, "Mercado", "R$ 1.497,00", "18%", 46.8, [["Pão de Açúcar", 812.4, "R$ 812,40"], ["Hortifruti", 398.1, "R$ 398,10"], ["Outros 4", 286.5, "R$ 286,50"]])}
    ${rankRow(3, "Restaurantes", "R$ 864,30", "11%", 27)}
    ${rankRow(4, "Transporte", "R$ 412,75", "5%", 12.9)}
    ${rankRow(5, "Assinaturas", "R$ 289,40", "4%", 9)}
    ${rankRow("", "Outras 6 categorias", "R$ 1.927,60", "24%", 60.2, neutral)}
  </ul>`,
  open: "Transações de outubro",
  data: table(["Categoria", "Total"], [["Moradia", "R$ 3.200,00"], ["Mercado", "R$ 1.497,00"], ["Restaurantes", "R$ 864,30"], ["Transporte", "R$ 412,75"], ["Assinaturas", "R$ 289,40"], ["Outras 6", "R$ 1.927,60"]]),
});

function hits(tips) {
  return `<div class="hits">${tips.map((t) => `<span class="hit" tabindex="0" aria-label="${t}"><span class="tip">${t}</span></span>`).join("")}</div>`;
}

// Several values per column: one readout above the plot instead of a floating tip.
function readout(tips) {
  const n = tips.length;
  return `<div class="hits readout">${tips.map((t, i) => `<span class="hit" tabindex="0" aria-label="${t}"><i class="guide" style="left:${(((i + 0.5) / n) * 100).toFixed(2)}%"></i><span class="tip">${t}</span></span>`).join("")}</div>`;
}
const balance = view({
  icon: "trend", prov: "Lançamentos até hoje e 9 agendamentos até 31/12", next: ["O que puxa o saldo em 5/12?", "Simular sem a escola"],
  title: "Saldo · Itaú conta corrente",
  window: "nov a dez, com agendados",
  verdict: 'O saldo chega ao mínimo de <strong>R$ 412,30 em 5/12</strong>, depois do aluguel, e não fica negativo.',
  body: `<div><div class="plot"><div class="canvas">
    <svg class="line" viewBox="0 0 300 120" preserveAspectRatio="none" role="img" aria-label="Saldo de 1/11 a 31/12; hoje R$ 2.034,10; mínimo previsto R$ 412,30 em 5/12">
      <g class="grid"><line x1="0" x2="300" y1="0" y2="0"/><line x1="0" x2="300" y1="60" y2="60"/><line class="zero" x1="0" x2="300" y1="120" y2="120"/></g>
      <path class="area" d="M0 62.2 H20 V8.2 H45 V106.6 H70 V90.2 H90 V95.6 V120 H0 Z"/>
      <path class="subject" pathLength="1" d="M0 62.2 H20 V8.2 H45 V106.6 H70 V90.2 H90 V95.6"/>
      <path class="proj" d="M90 95.6 H105 V17.6 H120 V52.6 H150 V76.6 H170 V115.05 H245 V37.05 H300"/>
      <line class="today" x1="90" x2="90" y1="0" y2="120"/>
    </svg>
    <span class="mark" style="left:30%;top:95.6px"></span>
    <span class="mark" style="left:56.7%;top:115px;--mark:var(--slotted-tone-warning-solid)"></span>
    <span class="markLabel" style="left:56.7%;top:115px">mínimo R$ 412,30</span>
    ${hits(["01/11 · R$ 4.820,00", "05/11 · R$ 9.320,00", "10/11 · R$ 1.120,00", "19/11 · R$ 2.034,10 hoje", "22/11 · R$ 8.534,10 previsto", "25/11 · R$ 5.615,72 previsto", "01/12 · R$ 3.612,30 previsto", "05/12 · R$ 412,30 previsto", "20/12 · R$ 6.912,30 previsto"])}
  </div><div class="yAxis"><span>R$ 10 mil</span><span>R$ 5 mil</span><span>R$ 0</span></div></div>
  <div class="xAxis withY"><span>01/11</span><span>19/11 hoje</span><span>31/12</span></div></div>
  <ul class="legend"><li><i class="key"></i>Realizado</li><li><i class="key dash"></i>Previsto pelos agendamentos</li></ul>`,
  open: "Projeção",
  data: table(["Dia", "Saldo"], [["05/11", "R$ 9.320,00"], ["10/11", "R$ 1.120,00"], ["19/11", "R$ 2.034,10"], ["05/12", "R$ 412,30"], ["20/12", "R$ 6.912,30"]]),
});

const shares = [
  ["Restaurantes", "R$ 1.428,80", 38, c(1)],
  ["Mercado", "R$ 1.015,20", 27, c(2)],
  ["Transporte", "R$ 714,40", 19, c(3)],
  ["Assinaturas", "R$ 338,40", 9, c(4)],
  ["Outros", "R$ 263,20", 7, neutral],
];
const composition = view({
  icon: "card", unit: true, prov: "41 lançamentos da fatura aberta", next: ["O que já está na fatura de dezembro?", "Maiores compras da fatura"],
  title: "Fatura de novembro",
  window: "Itaú · fecha 25/11",
  verdict: 'Restaurantes ocupa <strong>38%</strong> da fatura de <strong>R$ 3.760,00</strong>.',
  body: `<div class="stack" role="img" aria-label="${shares.map((s) => `${s[0]} ${s[2]}%`).join(", ")}">${shares
    .map((s) => `<span class="seg" tabindex="0" style="--share:${s[2]};--fill:${s[3]}"><span class="tip">${s[0]} · ${s[1]} · ${s[2]}%</span></span>`)
    .join("")}</div>
  <ul class="shares">${shares
    .map((s) => `<li class="share"><i class="key" style="--fill:${s[3]}"></i><span class="shareName">${s[0]}</span><span class="num"><span class="vA">${s[1]}</span><span class="vP">${s[2]}%</span></span><span class="sharePct"><span class="vA">${s[2]}%</span><span class="vP">${s[1]}</span></span></li>`)
    .join("")}</ul>`,
  open: "Fatura",
});

// The pace mark: where spending would be on this day of the month at an even rate.
const PACE = 19 / 30;
function budgetRow(name, actual, limit, w, tick, over) {
  const fills = over
    ? `<i class="fill" style="width:${tick}%"></i><i class="fill overFill" style="left:${tick}%;width:${w - tick}%;border-radius:0 999px 999px 0"></i>`
    : `<i class="fill" style="width:${w}%"></i>`;
  const pace = `<i class="pace" style="left:${(tick * PACE).toFixed(1)}%"></i>`;
  return `<li class="row"><span class="rowKey">${name}${over ? ` <span class="over">acima ${over}</span>` : ""}</span><span class="rowValue">${actual}<small>de ${limit}</small></span><span class="track">${fills}${pace}<i class="tick" style="left:${tick}%"></i></span></li>`;
}
const budget = view({
  icon: "target", prov: "Orçamentos de novembro e 63 despesas até hoje", next: ["Onde cortar em Restaurantes?", "Ajustar o limite do Mercado"],
  title: "Orçamento de novembro",
  window: "dia 19 de 30",
  verdict: '<span class="over">2 categorias acima do limite.</span> Restaurantes passou <strong>R$ 118,90</strong>; Mercado, R$ 112,30.',
  body: `<ul class="bars">
    ${budgetRow("Mercado", "R$ 1.512,30", "1.400", 94.5, 87.5, "R$ 112,30")}
    ${budgetRow("Restaurantes", "R$ 718,90", "600", 44.9, 37.5, "R$ 118,90")}
    ${budgetRow("Transporte", "R$ 212,40", "500", 13.3, 31.25)}
    ${budgetRow("Lazer", "R$ 95,00", "400", 5.9, 25)}
  </ul>
  <ul class="legend"><li><i class="key"></i>Gasto</li><li><i class="key" style="--fill:var(--slotted-tone-danger-solid)"></i>Acima do limite</li><li><i class="key" style="--fill:var(--slotted-text);inline-size:2px"></i>Limite</li><li><i class="key paceKey"></i>Ritmo do dia 19</li></ul>`,
  open: "Orçamentos",
});

// Goal path: saved so far, the path the deadline needs, the path the current pace gives.
// x: one step of 15 per month from mar/26; y: R$ 16 mil at the top.
const gy = (v) => (120 - v * 0.0075).toFixed(2);
const saved = [0, 700, 1500, 2100, 2900, 3600, 4400, 5250, 6200];
const gMonths = ["mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out"];
const goalChart = `<div><div class="plot"><div class="canvas">
  <svg class="line goalLine" viewBox="0 0 300 120" preserveAspectRatio="none" role="img" aria-label="Guardado R$ 6.200,00 em novembro de 2026; prazo julho de 2027; no ritmo atual, R$ 15.000,00 em setembro de 2027">
    <g class="grid"><line x1="0" x2="300" y1="60" y2="60"/><line class="zero" x1="0" x2="300" y1="120" y2="120"/></g>
    <line class="goalTarget" x1="0" x2="300" y1="${gy(15000)}" y2="${gy(15000)}"/>
    <line class="today" x1="240" x2="240" y1="0" y2="120"/>
    <path class="area" d="M0 120 ${saved.map((v, i) => `L${i * 15} ${gy(v)}`).join(" ")} L120 120 Z"/>
    <path class="subject" pathLength="1" d="${saved.map((v, i) => `${i ? "L" : "M"}${i * 15} ${gy(v)}`).join(" ")}"/>
    <path class="need" d="M120 ${gy(6200)} L240 ${gy(15000)}"/>
    <path class="proj" d="M120 ${gy(6200)} L258.9 ${gy(15000)}"/>
  </svg>
  <span class="mark" style="left:40%;top:${gy(6200)}px"></span>
  <span class="mark" style="left:86.3%;top:${gy(15000)}px;--mark:var(--slotted-tone-warning-solid)"></span>
  <span class="markLabel below" style="left:86.3%;top:${gy(15000)}px">set/27</span>
  ${readout(gMonths.map((m, i) => (i <= 8 ? `${m} · guardado ${brl(saved[i])}` : `${m} · necessário ${brl(Math.min(6200 + 1100 * (i - 8), 15000))} · ritmo ${brl(Math.min(6200 + 950 * (i - 8), 15000))}`)))}
</div><div class="yAxis"><span>R$ 15 mil</span><span>R$ 8 mil</span><span>R$ 0</span></div></div>
<div class="xAxis withY"><span>mar/26</span><span>nov hoje</span><span>jul/27 prazo</span></div></div>
<ul class="legend"><li><i class="key"></i>Guardado</li><li><i class="key dash"></i>Ritmo atual</li><li><i class="key needKey"></i>Necessário para o prazo</li></ul>`;

const goal = view({
  icon: "target", prov: "Aportes na meta desde março", next: ["Quanto guardar para chegar em julho?", "Mudar o prazo para setembro"],
  title: "Meta · Viagem Japão",
  window: "prazo 31/07/2027",
  verdict: 'Faltam <strong>R$ 8.800,00</strong>. No ritmo atual a meta fecha em <span class="over">setembro de 2027</span>, 2 meses depois do prazo.',
  body: `${goalChart}
  <ul class="bars">
    <li class="row pair"><span class="rowKey">Por mês até o prazo</span><span class="rowValue">R$ 1.100,00</span><span class="track"><i class="fill ref" style="width:100%"></i></span><span class="track" style="visibility:hidden"></span></li>
    <li class="row pair"><span class="rowKey">Média dos últimos 3 meses</span><span class="rowValue">R$ 950,00</span><span class="track" style="visibility:hidden"></span><span class="track"><i class="fill" style="width:86.4%"></i></span></li>
  </ul>`,
  open: "Metas",
});

const falls = [
  ["Início", "R$ 4.820", 0, 24.1, "total"],
  ["Receitas", "+12.400", 24.1, 62, "gain"],
  ["Moradia", "−3.200", 70.1, 16, "loss neg"],
  ["Mercado", "−1.497", 62.6, 7.5, "loss neg"],
  ["Outras", "−3.494", 45.15, 17.47, "loss neg"],
  ["Final", "R$ 9.029", 0, 45.15, "total"],
];
const waterfall = view({
  icon: "layers", prov: "Todas as contas; transferências entre contas fora", next: ["Qual foi a taxa de poupança?", "E em setembro?"],
  title: "Resultado de outubro",
  window: "todas as contas",
  verdict: 'Sobraram <strong class="up">R$ 4.208,95</strong>: receitas de R$ 12.400,00 menos R$ 8.191,05 de despesas.',
  body: `<div><div class="fall" style="--n:6" role="img" aria-label="Saldo inicial R$ 4.820,00, receitas R$ 12.400,00, moradia R$ 3.200,00, mercado R$ 1.497,00, outras R$ 3.494,05, saldo final R$ 9.028,95">${falls
    .map((f) => `<span class="step ${f[4]}" style="--from:${f[2]}%;--h:${f[3]}%"><i></i><b>${f[1]}</b></span>`)
    .join("")}</div>
  <div class="colAxis" style="--n:6">${falls.map((f) => `<span>${f[0]}</span>`).join("")}</div></div>`,
  open: "Fluxo de caixa",
  data: table(["Etapa", "Valor"], [["Saldo inicial", "R$ 4.820,00"], ["Receitas", "R$ 12.400,00"], ["Moradia", "−R$ 3.200,00"], ["Mercado", "−R$ 1.497,00"], ["Outras despesas", "−R$ 3.494,05"], ["Saldo final", "R$ 9.028,95"]]),
});

const months = [
  ["dez", 9850], ["jan", 7120], ["fev", 6980], ["mar", 7450], ["abr", 6890], ["mai", 7210],
  ["jun", 8420], ["jul", 7050], ["ago", 6640], ["set", 7320], ["out", 8191.05], ["nov", 5115],
];
const series = view({
  icon: "chart", prov: "Despesas de 3 contas; novembro até hoje", next: ["Por que dezembro foi tão alto?", "Separar fixos e variáveis"],
  title: "Gastos por mês",
  window: "dez 2025 a nov 2026",
  verdict: 'Outubro foi o <strong>3º maior mês</strong> do período; a média dos meses fechados é <strong>R$ 7.556,46</strong>.',
  body: `<div><div class="cols" style="--n:12">${months
    .map(([m, v], i) => `<span class="col${i === 10 ? " current" : ""}${i === 11 ? " partial" : ""}" tabindex="0" style="--h:${(v / 100).toFixed(1)}%"><i></i><span class="tip">${m} · ${brl(v)}${i === 11 ? " até 19/11" : ""}</span></span>`)
    .join("")}<span class="avg" style="bottom:75.6%"><span class="avgLabel">média R$ 7.556</span></span></div>
  <div class="colAxis" style="--n:12">${months.map(([m]) => `<span>${m}</span>`).join("")}</div></div>
  <ul class="legend"><li><i class="key"></i>Outubro</li><li><i class="key" style="--fill:repeating-linear-gradient(135deg,var(--slotted-tone-accent-solid) 0 2px,transparent 2px 4px)"></i>Novembro até dia 19</li></ul>`,
  open: "Relatórios",
  data: table(["Mês", "Gastos"], months.map(([m, v]) => [m, brl(v)])),
});

function event(d, mon, soon, name, meta, value) {
  return `<li><a class="event" href="#"><span class="day${soon ? " soon" : ""}"><b>${d}</b>${mon}</span><span class="eventText"><span class="eventName">${name}</span><span class="eventMeta">${meta}</span></span><span class="num">${value}</span></a></li>`;
}
const agenda = view({
  icon: "cal", prov: "11 agendamentos ativos", next: ["O saldo cobre tudo?", "Quais são assinaturas?"],
  title: "Próximos 30 dias",
  window: "20/11 a 19/12",
  verdict: '<strong>R$ 9.037,90</strong> em 7 compromissos; a semana de 1/12 concentra R$ 5.333,32.',
  body: `<ul class="agenda">
    <li class="week"><span>Semana de 23/11</span><span>R$ 3.105,68</span></li>
    ${event(25, "nov", true, "Fatura Cartão Itaú", "Itaú · pagamento agendado", "−R$ 2.918,38")}
    ${event(28, "nov", false, "Conta de luz", "Itaú · agendamento mensal", "−R$ 187,30")}
    <li class="week"><span>Semana de 30/11</span><span>R$ 5.333,32</span></li>
    ${event(1, "dez", false, "Escola", "Itaú · agendamento mensal", "−R$ 2.003,42")}
    ${event(5, "dez", false, "Aluguel", "Itaú · agendamento mensal", "−R$ 3.200,00")}
    ${event(6, "dez", false, "Internet", "Nubank · débito automático", "−R$ 129,90")}
    <li class="week"><span>Semana de 7/12</span><span>R$ 598,90</span></li>
    ${event(10, "dez", false, "Notebook Dell · parcela 7 de 10", "Cartão Itaú", "−R$ 479,00")}
    ${event(12, "dez", false, "Academia", "Nubank · agendamento mensal", "−R$ 119,90")}
  </ul>`,
  open: "Planejamento",
});

const txs = view({
  icon: "search", prov: "Busca por iFood em novembro, 2 contas", next: ["E nos meses anteriores?", "Criar orçamento para delivery"],
  title: "Compras no iFood",
  window: "novembro 2026",
  verdict: '<strong>8 pedidos</strong> somam <strong>R$ 412,60</strong>; média de R$ 51,58 por pedido.',
  body: `<ul class="agenda">
    ${event(14, "nov", false, "iFood *Padaria", "Nubank · Restaurantes", "−R$ 28,50")}
    ${event(12, "nov", false, "iFood *Burger King", "Nubank · Restaurantes", "−R$ 45,90")}
    ${event(9, "nov", false, "iFood *Sushi Leblon", "Cartão Itaú · Restaurantes", "−R$ 112,00")}
    ${event(6, "nov", false, "iFood *Pizzaria Bráz", "Nubank · Restaurantes", "−R$ 38,40")}
    ${event(2, "nov", false, "iFood *Madero", "Cartão Itaú · Restaurantes", "−R$ 64,90")}
  </ul>`,
  open: "Ver os 8 pedidos",
});

function hold(t, fill, pos, res, up, w) {
  return `<tr><td><span class="ticker"><i style="--fill:${fill}"></i>${t}</span></td><td>${pos}</td><td class="${up ? "up" : "down"}">${res}</td><td><span class="alloc"><i style="--w:${w}%;--fill:${fill}"></i></span></td></tr>`;
}
const holdings = view({
  icon: "coins", prov: "Posições de 18/11 e preço médio de compra", next: ["Ver PETR4 desde a compra", "Quanto pago de IR se vender?"],
  title: "Carteira de ações",
  window: "fechamento 18/11",
  verdict: 'A carteira rende <strong class="up">+9,3%</strong> sobre o custo; BBAS3 é a única posição no negativo.',
  body: `<table class="tbl"><thead><tr><th>Ativo</th><th><button class="sort" type="button" aria-sort="descending">Posição ${I.sort}</button></th><th><button class="sort" type="button">Resultado ${I.sort}</button></th><th>Peso</th></tr></thead><tbody>
    ${hold("PETR4", c(1), "R$ 3.892,00", "+13,8%", true, 46)}
    ${hold("ITSA4", c(2), "R$ 2.104,00", "+6,9%", true, 25)}
    ${hold("BBAS3", c(3), "R$ 1.418,50", "−4,2%", false, 17)}
    ${hold("WEGE3", c(4), "R$ 976,00", "+21,3%", true, 12)}
  </tbody><tfoot><tr><td>Total</td><td>R$ 8.390,50</td><td class="up">+9,3%</td><td></td></tr></tfoot></table>`,
  open: "Carteira",
});

const bench = view({
  icon: "trend", prov: "Rentabilidade mensal ponderada pelo patrimônio", next: ["Comparar com o Ibovespa", "Qual ativo puxou a alta?"],
  title: "Carteira × CDI",
  window: "12 meses, base 100",
  verdict: 'A carteira rendeu <strong>14,29%</strong> contra 14,10% do CDI: <strong class="up">0,19 p.p. acima</strong>.',
  body: `<div><div class="plot"><div class="canvas">
    <svg class="bench" viewBox="0 0 300 120" preserveAspectRatio="none" role="img" aria-label="Carteira 114,29; CDI 114,10">
      <g class="grid"><line x1="0" x2="300" y1="0" y2="0"/><line x1="0" x2="300" y1="60" y2="60"/><line class="zero" x1="0" x2="300" y1="120" y2="120"/></g>
      <path style="stroke:${neutral};stroke-dasharray:4 4;animation:none" d="M0 110 L27 101.7 L55 93.5 L82 85.3 L109 77 L136 68.8 L164 60.5 L191 52.3 L218 44 L245 35.8 L273 27.5 L300 19.5"/>
      <path pathLength="1" style="stroke:var(--slotted-tone-accent-solid)" d="M0 110 L27 104 L55 92 L82 97 L109 80 L136 74 L164 66 L191 58 L218 41 L245 46 L273 29 L300 18.6"/>
    </svg>
    ${hits(["dez · 100,00 / 100,00", "jan · 101,8 / 101,1", "fev · 104,5 / 102,3", "mar · 103,4 / 103,4", "abr · 107,1 / 104,6", "mai · 108,5 / 105,7", "jun · 110,2 / 106,9", "jul · 112,0 / 108,1", "ago · 115,7 / 109,3", "set · 114,6 / 110,5", "out · 118,3 / 111,6", "nov · 114,29 / 114,10"])}
  </div><div class="yAxis"><span>120</span><span>110</span><span>100</span></div></div>
  <div class="xAxis withY"><span>dez 2025</span><span>nov 2026</span></div></div>
  <ul class="legend"><li><i class="key"></i>Carteira 114,29</li><li><i class="key dash"></i>CDI 114,10</li></ul>`,
  open: "Rentabilidade",
});

function dv(name, now, target, diff) {
  const w = Math.min(Math.abs(diff) * 10, 100);
  const left = diff < 0 ? `<i style="--w:${w}%"></i>` : "";
  const right = diff > 0 ? `<i style="--w:${w}%"></i>` : "";
  const label = diff === 0 ? "no alvo" : `${diff > 0 ? "+" : "−"}${Math.abs(diff)} p.p.`;
  return `<li class="dvRow" aria-label="${name}: ${now}% contra alvo ${target}%, ${label}" title="alvo ${target}%"><span class="dvName">${name} <span class="muted">${now}%</span></span><span class="dvLeft">${left}</span><span class="dvAxis"></span><span class="dvRight">${right}</span><span class="dvValue">${label}</span></li>`;
}
const allocation = view({
  icon: "pie", prov: "Plano de aportes salvo em 02/09", next: ["Onde aplico 5 mil este mês?", "Mudar o alvo de ações"],
  title: "Alocação × alvo",
  window: "carteira toda",
  verdict: 'Ações estão <strong>6 p.p. acima</strong> do alvo; renda fixa, <strong>8 p.p. abaixo</strong>.',
  body: `<ul class="diverge">${dv("Renda fixa", 52, 60, -8)}${dv("Ações", 31, 25, 6)}${dv("FIIs", 12, 10, 2)}${dv("Exterior", 5, 5, 0)}</ul>
  <ul class="legend"><li><i class="key" style="--fill:${c(2)}"></i>Abaixo do alvo</li><li><i class="key" style="--fill:${c(1)}"></i>Acima do alvo</li></ul>`,
  open: "Plano de aportes",
});

const fx = view({
  icon: "coins", prov: "Cotações PTAX de 19/11", next: ["Como o dólar mexeu no total?"],
  title: "Saldos por moeda",
  window: "cotações de 19/11",
  verdict: 'Em reais, o total é <strong>R$ 21.816,60</strong>; 44% está fora do real.',
  body: `<ul class="fx">
    <li class="fxRow"><span>Itaú <span class="muted">BRL</span></span><span class="fxRate"></span><span class="fxBase">R$ 12.300,00</span></li>
    <li class="fxRow"><span>Wise <span class="muted">US$ 1.240,00</span></span><span class="fxRate">× 5,79</span><span class="fxBase">R$ 7.179,60</span></li>
    <li class="fxRow"><span>Revolut <span class="muted">€ 380,00</span></span><span class="fxRate">× 6,15</span><span class="fxBase">R$ 2.337,00</span></li>
    <li class="fxRow sum"><span>Total</span><span></span><span class="fxBase">R$ 21.816,60</span></li>
  </ul>`,
  open: "Contas",
});

const heatVals = { 1: 18, 2: 42, 3: 12, 4: 30, 5: 8, 6: 26, 7: 70, 8: 100, 9: 34, 10: 14, 11: 20, 12: 38, 13: 10, 14: 64, 15: 82, 16: 22, 17: 16, 18: 28, 19: 12 };
const heatAmt = (d) => brl((heatVals[d] ?? 0) * 6.124);
const heat = view({
  icon: "cal", prov: "Despesas de novembro até hoje", next: ["O que acontece aos sábados?"],
  title: "Gastos por dia",
  window: "novembro 2026",
  verdict: 'Os <strong>sábados</strong> concentram 34% dos gastos do mês; o pico foi <strong>8/11</strong>, R$ 612,40.',
  body: `<div class="heat">${["D", "S", "T", "Q", "Q", "S", "S"].map((d) => `<span class="heatHead">${d}</span>`).join("")}${Array.from({ length: 30 }, (_, i) => i + 1)
    .map((d) => (d > 19 ? `<span class="cell future">${d}</span>` : `<span class="cell${heatVals[d] >= 60 ? " hi" : ""}" tabindex="0" style="--v:${heatVals[d]}%">${d}<span class="tip">${d}/11 · ${heatAmt(d)}</span></span>`))
    .join("")}${Array.from({ length: 5 }, () => '<span class="cell blank"></span>').join("")}</div>
  <div class="ramp"><span>menos</span><i style="--v:10%"></i><i style="--v:35%"></i><i style="--v:65%"></i><i style="--v:100%"></i><span>mais</span></div>`,
  open: "Transações",
});

const explain = view({
  icon: "wand", prov: "Regra criada em 12/08, prioridade 3", next: ["Mudar a regra para Casa", "Ver as 13 compras"],
  title: "Por que Eletrônicos",
  window: "compra de 16/11",
  verdict: 'A regra <strong>Mercado Livre</strong> classificou esta compra e outras 13 desde 12/08.',
  body: `<div class="flow">
    <span class="node"><span class="nodeKey">Descrição</span><span class="nodeValue"><code>MERCADOLIVRE*FONE</code></span></span>${I.arrow}
    <span class="node hot"><span class="nodeKey">Regra</span><span class="nodeValue"><code>MERCADOLIVRE*</code></span></span>${I.arrow}
    <span class="node"><span class="nodeKey">Categoria</span><span class="nodeValue">Eletrônicos</span></span>
  </div>`,
  open: "Regra",
});

// ---------- New proposal bodies ----------

// A proposal sheet: one decision, its own body, one confirm row.
function sheet(title, body, note, o = {}) {
  const n = o.n ?? 1;
  const noun = n > 1 ? "alterações" : "alteração";
  const tone = o.danger ? " danger" : "";
  const op = o.items ? "" : `<div class="opHead">${I.check}<span>${title}</span></div>`;
  return `<section class="view sheet${tone}" aria-label="${title}">
  <header class="viewHead"><span class="kind${tone}">${I[o.icon ?? "pen"]}</span><span class="viewTitle">${n} ${noun} para revisar</span><span class="viewWindow">${I.clock}até 10:15</span></header>
  ${op}
  ${body}
  ${note ? `<p class="verdict" data-wrap-ok>${note}</p>` : ""}
  <div class="confirm"><span class="confirmText"><b>${n} de ${n} ${n > 1 ? "marcadas" : "marcada"}</b>${o.danger ? "Não entra mais nos saldos" : "Será aplicada ao confirmar"}</span><button class="btn" type="button">Rejeitar</button><button class="btn primary${tone}" type="button">${o.confirm ?? `Confirmar ${n}`}</button></div>
</section>`;
}

const wInstall = sheet(
  "Compra parcelada · Geladeira Brastemp",
  `<div class="eq"><b>R$ 3.024,00</b><span class="muted">=</span><b>12 × R$ 252,00</b><span class="muted">no Cartão Itaú</span></div>
  <div class="plan" role="img" aria-label="12 parcelas de dezembro de 2026 a novembro de 2027">${"<i></i>".repeat(12)}</div>
  <div class="planAxis"><span>fatura dez/26</span><span>fatura nov/27</span></div>`,
  'Cada fatura dos próximos 12 meses recebe <strong>R$ 252,00</strong>; o limite livre cai para R$ 5.216,00 hoje.',
  { icon: "card" },
);

const wChange = sheet(
  "Corrigir transação · Pão de Açúcar",
  `<div class="diff"><span class="diffKey">Valor</span><span class="was">−R$ 21,24</span>${I.arrow}<span class="is">−R$ 212,40</span>
  <span class="diffKey">Saldo Nubank</span><span class="was">R$ 2.225,26</span>${I.arrow}<span class="is">R$ 2.034,10</span></div>`,
  "Lançada em 18/11 no Nubank, categoria Mercado.",
  { icon: "pen" },
);

const wReconcile = sheet(
  "Conferir saldo · Itaú",
  `<div class="gapAxis" role="img" aria-label="equori R$ 2.034,10, banco R$ 2.100,00, diferença R$ 65,90">
    <span class="rail"></span><span class="span" style="left:30%;width:40%"></span>
    <span class="pin" style="left:30%"><span>equori R$ 2.034,10</span></span>
    <span class="pin" style="left:70%"><span>banco R$ 2.100,00</span></span>
  </div>`,
  'Um ajuste de <strong>+R$ 65,90</strong> em 19/11 iguala o equori ao banco.',
  { icon: "scale" },
);

const wGoal = sheet(
  "Criar meta · Viagem Japão",
  `<div class="eq"><b>R$ 15.000,00</b><span class="muted">até 31/07/2027</span><span class="muted">=</span><b>8 × R$ 1.875,00</b><span class="muted">por mês</span></div>
  <ul class="bars"><li class="row"><span class="rowKey">Sobra média dos últimos 3 meses</span><span class="rowValue">R$ 3.410,00</span><span class="track"><i class="fill" style="width:55%"></i><i class="tick" style="left:55%"></i></span></li></ul>`,
  "A meta usa 55% da sobra mensal média.",
  { icon: "target" },
);

const wFixed = sheet(
  "Aplicação · CDB Banco Inter",
  `<div class="eq"><b>R$ 10.000,00</b><span class="muted">a</span><b>110% do CDI</b><span class="muted">saindo do Inter</span></div>
  <div class="term"><span>19/11/2026</span><span class="termBar"></span><span>19/11/2028</span></div>`,
  "Vencimento em 2 anos; o resgate antes do prazo segue as regras do título.",
  { icon: "coins" },
);

const wCustody = sheet(
  "Transferir custódia · ITSA4",
  `<div class="flow">
    <span class="node"><span class="nodeKey">De</span><span class="nodeValue">Clear</span></span>${I.arrow}
    <span class="node hot"><span class="nodeKey">200 ITSA4</span><span class="nodeValue">PM R$ 9,84</span></span>${I.arrow}
    <span class="node"><span class="nodeKey">Para</span><span class="nodeValue">XP</span></span>
  </div>`,
  "O preço médio e as datas de compra seguem com as ações.",
  { icon: "swap" },
);

// ---------- Round 2: more read views ----------

// Small multiples of the month's indicators.
function miniSpark(v) {
  const lo = Math.min(...v), hi = Math.max(...v);
  const d = v.map((x, i) => `${i ? "L" : "M"}${((i / (v.length - 1)) * 100).toFixed(1)} ${(22 - ((x - lo) / (hi - lo || 1)) * 20).toFixed(1)}`).join(" ");
  return `<svg class="mini" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
}
const tile = (key, value, note, tone, v) =>
  `<div class="tile" tabindex="0"><span class="tileKey">${key}</span><span class="tileValue">${value}</span>${miniSpark(v)}<span class="tileNote ${tone}">${note}</span></div>`;
const indicators = view({
  icon: "pulse",
  title: "Indicadores do mês",
  window: "outubro 2026",
  verdict: 'A poupança de outubro, <strong class="up">34%</strong>, é a maior do ano; a reserva cobre <strong>4,2 meses</strong>, abaixo dos 6 planejados.',
  body: `<div class="tiles">
    ${tile("Poupança", "34%", "acima de 20%", "up", [18, 22, 15, 26, 21, 24, 19, 28, 23, 30, 27, 34])}
    ${tile("Gastos fixos", "48%", "da renda", "muted", [52, 51, 50, 52, 49, 50, 48, 49, 48, 47, 49, 48])}
    ${tile("Reserva", "4,2 meses", "meta 6 meses", "warn", [2.8, 3.0, 3.1, 3.3, 3.4, 3.5, 3.6, 3.8, 3.9, 4.0, 4.1, 4.2])}
  </div>`,
  open: "Indicadores",
  prov: "12 meses fechados, visão de caixa",
  next: ["Como chego a 6 meses de reserva?", "O que entra em gastos fixos?"],
  data: table(["Indicador", "Out", "Média 12m"], [["Poupança", "34%", "24%"], ["Gastos fixos", "48%", "49%"], ["Reserva", "4,2 meses", "3,6 meses"]]),
});

// What changed between two months: diverging bars of the difference.
function mdv(name, delta, max) {
  const w = ((Math.abs(delta) / max) * 100).toFixed(1);
  const bar = `<i style="--w:${w}%"></i>`;
  const label = `${delta > 0 ? "+" : "−"}${brl(Math.abs(delta)).replace("R$ ", "")}`;
  return `<li class="dvRow" tabindex="0" aria-label="${name}: ${label}"><span class="dvName">${name}</span><span class="dvLeft">${delta < 0 ? bar : ""}</span><span class="dvAxis"></span><span class="dvRight">${delta > 0 ? bar : ""}</span><span class="dvValue">${label}</span></li>`;
}
const changes = view({
  icon: "swap",
  title: "O que mudou",
  window: "out contra set",
  verdict: 'Outubro gastou <strong>R$ 454,95 a mais</strong>; Mercado e Restaurantes somam R$ 566,50 do aumento.',
  body: `<ul class="diverge money">${mdv("Mercado", 312.4, 312.4)}${mdv("Restaurantes", 254.1, 312.4)}${mdv("Viagens", 188, 312.4)}${mdv("Transporte", 14.75, 312.4)}${mdv("Saúde", -96.3, 312.4)}${mdv("Lazer", -218, 312.4)}</ul>
  <ul class="legend"><li><i class="key" style="--fill:${c(2)}"></i>Gastou menos</li><li><i class="key" style="--fill:${c(1)}"></i>Gastou mais</li></ul>`,
  open: "Relatórios",
  prov: "Mesmas 3 contas nos dois meses",
  next: ["Por que Viagens subiu?", "Ver setembro × outubro lado a lado"],
});

// Treemap of the year: area = share of spending (squarified in a 400 × 176 box).
function squarify(items, x, y, w, h) {
  const out = [];
  let rest = items.slice();
  while (rest.length) {
    const total = rest.reduce((s, i) => s + i.v, 0);
    const horiz = w >= h;
    const side = horiz ? h : w;
    let row = [], best = Infinity;
    for (const it of rest) {
      const cand = [...row, it];
      const s = cand.reduce((a, b) => a + b.v, 0);
      const thick = (s / total) * (horiz ? w : h);
      const worst = Math.max(...cand.map((k) => { const len = (k.v / s) * side; return Math.max(thick / len, len / thick); }));
      if (worst > best) break;
      best = worst;
      row = cand;
    }
    const s = row.reduce((a, b) => a + b.v, 0);
    const thick = (s / total) * (horiz ? w : h);
    let off = 0;
    for (const it of row) {
      const len = (it.v / s) * side;
      out.push(horiz ? { ...it, x, y: y + off, w: thick, h: len } : { ...it, x: x + off, y, w: len, h: thick });
      off += len;
    }
    if (horiz) { x += thick; w -= thick; } else { y += thick; h -= thick; }
    rest = rest.slice(row.length);
  }
  return out;
}
const yearCats = [
  { n: "Moradia", v: 35200, f: c(1) }, { n: "Educação", v: 22040, f: c(2) }, { n: "Mercado", v: 16430, f: c(3) },
  { n: "Restaurantes", v: 9120, f: c(4) }, { n: "Saúde", v: 6240, f: c(5) }, { n: "Transporte", v: 4870, f: c(6) },
  { n: "Assinaturas", v: 3180, f: c(7) }, { n: "Outras 9", v: 7040, f: neutral },
];
const yearTotal = yearCats.reduce((s, k) => s + k.v, 0);
// "Outras" sits last whatever its size, so it is laid out with the rest in order.
const treeAll = squarify([...yearCats.slice(0, 7), yearCats[7]], 0, 0, 400, 176);
const treemap = view({
  icon: "layers",
  title: "Mapa dos gastos do ano",
  window: "jan a nov 2026",
  verdict: `Moradia e Educação levam <strong>55%</strong> dos <strong>${brl(yearTotal)}</strong> do ano.`,
  body: `<div class="tree" role="img" aria-label="${yearCats.map((k) => `${k.n} ${Math.round((k.v / yearTotal) * 100)}%`).join(", ")}">${treeAll
    .map((k) => {
      const pct = Math.round((k.v / yearTotal) * 100);
      const big = k.w > 96 && k.h > 44;
      const mid = k.w > 36 && k.h > 24;
      const label = big ? `<span class="tName">${k.n}</span><span class="tVal">${brl(k.v)}</span><span class="tPct">${pct}%</span>` : mid ? `<span class="tPct">${pct}%</span>` : "";
      return `<a class="tCell${k.x + k.w / 2 > 200 ? " tR" : ""}" href="#" style="left:${(k.x / 4).toFixed(2)}%;top:${((k.y / 176) * 100).toFixed(2)}%;width:${(k.w / 4).toFixed(2)}%;height:${((k.h / 176) * 100).toFixed(2)}%;--fill:${k.f}">${label}<span class="tip">${k.n} · ${brl(k.v)} · ${pct}%</span></a>`;
    })
    .join("")}</div>`,
  open: "Relatórios",
  prov: "1.042 despesas de 3 contas",
  next: ["O que tem em Outras 9?", "Educação subiu em relação a 2025?"],
  data: table(["Categoria", "Total", "%"], yearCats.map((k) => [k.n, brl(k.v), `${Math.round((k.v / yearTotal) * 100)}%`])),
});

// Strip plot: every purchase of the month as a dot, in multiples of its category's median.
const pos = (r) => Math.max(0, Math.min(100, ((Math.log10(r) + 1) / 2.3) * 100)).toFixed(1);
function stripRow(name, values, median, outlier) {
  // Beeswarm: a dot closer than 3% to the last dot of its lane moves to the next lane.
  const lanes = [-Infinity, -Infinity, -Infinity];
  const laneY = [0, -7, 7];
  const dots = values
    .map((v) => {
      const r = v / median;
      const x = Number(pos(r));
      let lane = lanes.findIndex((last) => x - last >= 3);
      if (lane < 0) lane = 0;
      lanes[lane] = x;
      const isOut = outlier && v === outlier[1];
      return `<span class="dot${isOut ? " out" : ""}${pos(r) > 60 ? " tR" : pos(r) < 40 ? " tL" : ""}" tabindex="0" style="left:${pos(r)}%;margin-block-start:${laneY[lane] - (isOut ? 6 : 4)}px"><span class="tip">${isOut ? `${outlier[0]} · ` : ""}${brl(v)} · ${r.toFixed(1).replace(".", ",")}×</span></span>`;
    })
    .join("");
  const max = Math.max(...values) / median;
  return `<li class="strip"><span class="stripName">${name}<small>mediana ${brl(median).replace("R$ ", "")}</small></span><span class="stripTrack"><i class="med" style="left:${pos(1)}%"></i>${dots}${outlier ? `<span class="outLabel" style="left:${pos(outlier[1] / median)}%">${outlier[0]}</span>` : ""}</span><span class="stripMax${outlier ? " hot" : ""}">${max.toFixed(1).replace(".", ",")}×</span></li>`;
}
const outliers = view({
  icon: "search",
  title: "Compras fora do padrão",
  window: "novembro 2026",
  verdict: '<strong>Fast Shop, R$ 2.399,00</strong> em 03/11, é <strong>10,7×</strong> a mediana de Eletrônicos; as outras compras ficam abaixo de 3×.',
  body: `<ul class="strips">
    ${stripRow("Mercado", [18.9, 32.4, 45.1, 62, 88.3, 97.5, 112.4, 134, 156.2, 212.4, 248, 301.7], 104.95)}
    ${stripRow("Restaurantes", [22, 28.5, 34, 38.4, 45.9, 52, 64.9, 71, 88, 112, 145], 52)}
    ${stripRow("Eletrônicos", [89.9, 129, 199, 249, 349, 2399], 224, ["Fast Shop", 2399])}
  </ul>
  <div class="stripAxis"><span style="left:0%">0,1×</span><span style="left:${pos(1)}%">mediana</span><span style="left:${pos(10)}%">10×</span></div>`,
  open: "Transação",
  prov: "29 compras de novembro em 3 categorias",
  next: ["Parcelar a Fast Shop", "Ver as compras de Eletrônicos"],
});

// One transaction in full: header, facts, double-entry postings, history, attachment.
const txDetail = view({
  icon: "receipt",
  title: "Transação",
  window: "18/11/2026 19:42",
  verdict: 'Compra corrigida hoje de R$ 21,24 para <strong>R$ 212,40</strong>; a nota fiscal está anexada.',
  body: `<div class="rcpt">
    <div class="rcptHead"><span class="mono" style="--fill:${c(3)}">PA</span><span class="rcptWho"><b>Pão de Açúcar</b><small>Nubank · Mercado · casa</small></span><span class="rcptAmt">−R$ 212,40</span></div>
    <ul class="ledger" aria-label="Lançamentos">
      <li><span>Nubank <small>ativo</small></span><span class="num down">−212,40</span></li>
      <li><span>Mercado <small>despesa</small></span><span class="num">+212,40</span></li>
      <li class="sum"><span>Soma</span><span class="num">0,00</span></li>
    </ul>
    <ol class="trail">
      <li><span class="trailDot"></span><span>Valor corrigido de R$ 21,24</span><span class="muted num">19/11 09:58</span></li>
      <li><span class="trailDot"></span><span>Categoria Mercado pelo histórico</span><span class="muted num">18/11 19:43</span></li>
      <li><span class="trailDot"></span><span>Importada do Nubank</span><span class="muted num">18/11 19:43</span></li>
    </ol>
    <a class="attach" href="#">${I.clip}<span>nota-fiscal-pao-de-acucar.pdf</span><span class="muted">84 KB</span></a>
  </div>`,
  open: "Abrir transação",
  next: ["Por que caiu em Mercado?", "Dividir entre Mercado e Casa"],
});

// Recurring charges: one dot per month a charge happened.
const cadMonths = ["D", "J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N"];
function cadRow(name, meta, months, annual) {
  return `<li><a class="cadRow" href="#"><span class="eventText"><span class="eventName">${name}</span><span class="eventMeta">${meta}</span></span><span class="cadDots">${cadMonths.map((m, i) => `<i class="${months.includes(i) ? "on" : ""}" title="${m}"></i>`).join("")}</span><span class="num">${annual}</span></a></li>`;
}
const all12 = [...Array(12).keys()];
const recurring = view({
  icon: "repeat",
  title: "Cobranças recorrentes",
  window: "dez 2025 a nov 2026",
  verdict: '6 cobranças somam <strong>R$ 3.369,20 por ano</strong>; Academia ficou sem cobrar em julho e agosto.',
  body: `<div class="cadHead"><span>Cobrança</span><span class="cadDots">${cadMonths.map((m) => `<b>${m}</b>`).join("")}</span><span>Por ano</span></div>
  <ul class="agenda">
    ${cadRow("Academia Smart", "mensal · R$ 119,90", all12.filter((i) => i !== 7 && i !== 8), "R$ 1.199,00")}
    ${cadRow("Adobe", "mensal · R$ 99,00", all12.slice(3), "R$ 891,00")}
    ${cadRow("Netflix", "mensal · R$ 55,90", all12, "R$ 670,80")}
    ${cadRow("Spotify", "mensal · R$ 21,90", all12, "R$ 262,80")}
    ${cadRow("iCloud", "mensal · R$ 14,90", all12, "R$ 178,80")}
    ${cadRow("Amazon Prime", "anual · março", [3], "R$ 166,80")}
  </ul>`,
  open: "Agendamentos",
  prov: "Mesmo valor e estabelecimento, 3 contas",
  next: ["Criar agendamentos para as 6", "Quanto custa a Adobe no ano?"],
  data: table(["Cobrança", "Valor", "Por ano"], [["Academia Smart", "R$ 119,90", "R$ 1.199,00"], ["Adobe", "R$ 99,00", "R$ 891,00"], ["Netflix", "R$ 55,90", "R$ 670,80"], ["Spotify", "R$ 21,90", "R$ 262,80"], ["iCloud", "R$ 14,90", "R$ 178,80"], ["Amazon Prime", "R$ 166,80", "R$ 166,80"]]),
});

// What the next statements already carry: installments and subscriptions, stacked.
const nextStm = [["dez", 1240], ["jan", 1240], ["fev", 980], ["mar", 980], ["abr", 731], ["mai", 479]];
const commitments = view({
  icon: "card",
  title: "Já comprometido nas faturas",
  window: "Cartão Itaú · dez a mai",
  verdict: '<strong>R$ 1.529,40</strong> já estão na fatura de dezembro antes de qualquer compra: R$ 1.240,00 de 5 parcelamentos e R$ 289,40 de assinaturas.',
  body: `<div><div class="cols stk" style="--n:6">${nextStm
    .map(([m, p]) => {
      const t = p + 289.4;
      return `<span class="col" tabindex="0" style="--h:${(t / 16).toFixed(1)}%"><i style="--h:${(p / 16).toFixed(1)}%;--fill:${c(1)}"></i><i style="--h:${(289.4 / 16).toFixed(1)}%;--fill:${c(2)}"></i><span class="tip">${m} · ${brl(t)} · parcelas ${brl(p)}</span></span>`;
    })
    .join("")}</div>
  <div class="colAxis" style="--n:6">${nextStm.map(([m]) => `<span>${m}</span>`).join("")}</div></div>
  <ul class="legend"><li><i class="key" style="--fill:${c(1)}"></i>Parcelas</li><li><i class="key" style="--fill:${c(2)}"></i>Assinaturas no cartão</li></ul>`,
  open: "Faturas",
  prov: "5 compras parceladas e 4 assinaturas no Cartão Itaú",
  next: ["Quais são os 5 parcelamentos?", "Quando a fatura volta a R$ 500?"],
  data: table(["Fatura", "Parcelas", "Total"], nextStm.map(([m, p]) => [m, brl(p), brl(p + 289.4)])),
});

// Price since the first buy, with the average cost and each buy marked.
const px = [29.8, 30.9, 30.1, 31.4, 33.0, 32.2, 34.6, 35.9, 36.8, 38.4, 37.6, 38.92];
const pxm = ["dez", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov"];
const pxX = (i) => ((i * 300) / 11).toFixed(1);
const pxY = (p) => ((40 - p) * 10).toFixed(1);
const priceChart = view({
  icon: "trend",
  title: "PETR4 desde a primeira compra",
  window: "dez 2025 a nov 2026",
  verdict: 'PETR4 está <strong class="up">13,8% acima</strong> do preço médio de R$ 34,20; a compra de março, a R$ 31,40, rende 23,9%.',
  body: `<div><div class="plot"><div class="canvas">
    <svg class="line" viewBox="0 0 300 120" preserveAspectRatio="none" role="img" aria-label="PETR4 de R$ 29,80 a R$ 38,92; preço médio R$ 34,20">
      <g class="grid"><line x1="0" x2="300" y1="20" y2="20"/><line x1="0" x2="300" y1="70" y2="70"/><line class="zero" x1="0" x2="300" y1="120" y2="120"/></g>
      <line class="pm" x1="0" x2="300" y1="${pxY(34.2)}" y2="${pxY(34.2)}"/>
      <path class="subject" pathLength="1" d="${px.map((p, i) => `${i ? "L" : "M"}${pxX(i)} ${pxY(p)}`).join(" ")}"/>
    </svg>
    <span class="buy" style="left:${(3 / 11) * 100}%;top:${pxY(31.4)}px"><b>C 60</b></span>
    <span class="buy" style="left:${(9 / 11) * 100}%;top:${pxY(38.4)}px"><b>C 40</b></span>
    <span class="pmLabel" style="top:${pxY(34.2)}px">PM R$ 34,20</span>
    ${hits(px.map((p, i) => `${pxm[i]} · ${brl(p)}${i === 3 ? " · compra 60" : ""}${i === 9 ? " · compra 40" : ""}`))}
  </div><div class="yAxis"><span>R$ 38</span><span>R$ 33</span><span>R$ 28</span></div></div>
  <div class="xAxis withY"><span>dez</span><span>mar</span><span>set</span><span>nov</span></div></div>
  <ul class="legend"><li><i class="key"></i>Fechamento</li><li><i class="key dash"></i>Preço médio</li><li><i class="key buyKey"></i>Compra</li></ul>`,
  open: "Ativo",
  prov: "Fechamentos mensais da fonte de preços B3",
  next: ["Quanto pago de IR se vender tudo?", "Comparar com ITSA4"],
});

// Redemption estimate: the tax bracket by holding time and what reaches the account.
const redemption = view({
  icon: "calc",
  title: "Resgate · CDB Banco Aurora",
  window: "hoje, 403 dias",
  verdict: 'Resgatar hoje deixa <strong>R$ 11.171,50</strong> líquidos; o IR de 17,5% leva R$ 248,50. A partir de <strong>03/10/2027</strong> a alíquota cai para 15%.',
  body: `<ul class="ledger statement">
    <li><span>Valor bruto</span><span class="num">R$ 11.420,00</span></li>
    <li><span>Rendimento</span><span class="num">R$ 1.420,00</span></li>
    <li><span>IR 17,5% sobre o rendimento</span><span class="num down">−R$ 248,50</span></li>
    <li><span>IOF <small>acima de 30 dias</small></span><span class="num">R$ 0,00</span></li>
    <li class="sum"><span>Líquido na conta</span><span class="num">R$ 11.171,50</span></li>
  </ul>
  <div class="brackets" role="img" aria-label="Alíquota por prazo: até 180 dias 22,5%, até 360 20%, até 720 17,5%, acima 15%; hoje 403 dias">
    <span style="--w:20%">22,5%</span><span style="--w:20%">20%</span><span class="now" style="--w:40%">17,5%</span><span style="--w:20%">15%</span>
    <i class="bracketPin" style="left:44.8%"><b>hoje</b></i>
  </div>
  <div class="bAxis"><span style="left:0%">0</span><span style="left:20%">180</span><span style="left:40%">360</span><span style="left:80%">720 dias</span></div>`,
  open: "Simular na calculadora",
  prov: "Tabela regressiva de IR para renda fixa",
  next: ["E se eu esperar até outubro de 2027?", "Resgatar só R$ 5.000"],
});

// Prudential indicators of an issuer against the regulatory limit.
function bullet(name, value, note, w, tick, max) {
  const zone = max ? `<i class="zone" style="left:${tick}%;right:0"></i>` : `<i class="zone" style="left:0;width:${tick}%"></i>`;
  return `<li class="row"><span class="rowKey">${name}</span><span class="rowValue">${value}<small>${note}</small></span><span class="track bulletTrack">${zone}<i class="fill" style="width:${w}%"></i><i class="tick" style="left:${tick}%"></i></span></li>`;
}
const institution = view({
  icon: "shield",
  title: "Banco Aurora · indicadores",
  window: "base jun 2026",
  verdict: 'Os 3 índices cumprem o limite regulatório; a Basileia tem a menor folga, <strong>2,7 p.p.</strong> acima do mínimo.',
  body: `<ul class="bars">
    ${bullet("Basileia", "13,2%", "mín 10,5%", 66, 52.5)}
    ${bullet("Liquidez de curto prazo", "148%", "mín 100%", 49.3, 33.3)}
    ${bullet("Imobilização", "22%", "máx 50%", 22, 50, true)}
  </ul>
  <ul class="legend"><li><i class="key"></i>Índice</li><li><i class="key" style="--fill:var(--slotted-text);inline-size:2px"></i>Limite</li><li><i class="key zoneKey"></i>Fora do limite</li></ul>`,
  open: "Instituição",
  prov: "Banco Central, publicação trimestral",
  next: ["O que é o índice de Basileia?", "Quanto tenho no Banco Aurora?"],
});

// Tax year: monthly stock sales against the exemption line.
const sales = [8400, 0, 14200, 31500, 6100, 0, 12800, 9900, 26300, 4200, 18700];
const salesM = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov"];
const taxYear = view({
  icon: "bank",
  title: "Imposto de renda · ações",
  window: "2026 até nov",
  verdict: 'Abril e setembro passaram de <strong>R$ 20 mil</strong> em vendas: <strong>R$ 838,80</strong> de IR, os 2 DARFs pagos.',
  body: `<div><div class="cols tax" style="--n:11">${sales
    .map((v, i) => `<span class="col${v > 20000 ? " current" : ""}" tabindex="0" style="--h:${(v / 350).toFixed(1)}%"><i></i><span class="tip">${salesM[i]} · vendas ${brl(v)}${v > 20000 ? " · tributável" : " · isento"}</span></span>`)
    .join("")}<span class="avg" style="bottom:57.1%"><span class="avgLabel">isenção R$ 20 mil</span></span></div>
  <div class="colAxis" style="--n:11">${salesM.map((m) => `<span>${m.slice(0, 1).toUpperCase()}</span>`).join("")}</div></div>
  <ul class="agenda">
    <li><a class="event" href="#"><span class="day"><b>abr</b></span><span class="eventText"><span class="eventName">Lucro R$ 2.840,00 · IR R$ 426,00</span><span class="eventMeta">DARF pago em 29/05</span></span><span class="tag ok">pago</span></a></li>
    <li><a class="event" href="#"><span class="day"><b>set</b></span><span class="eventText"><span class="eventName">Lucro R$ 2.752,00 · IR R$ 412,80</span><span class="eventMeta">DARF pago em 30/10</span></span><span class="tag ok">pago</span></a></li>
  </ul>`,
  open: "Imposto de renda",
  prov: "Vendas a preço médio, operações comuns",
  next: ["Quanto posso vender em dezembro sem IR?", "Gerar o resumo para a declaração"],
  data: table(["Mês", "Vendas", "IR"], salesM.map((m, i) => [m, brl(sales[i]), i === 3 ? "R$ 426,00" : i === 8 ? "R$ 412,80" : "isento"])),
});

// Import coverage: which days of each account have statements.
const D = 322;
const p = (d) => ((d / D) * 100).toFixed(1);
function coverRow(name, meta, spans, status, tone) {
  const segs = spans.map(([a, b, k]) => `<i class="${k}" style="left:${p(a)}%;width:${p(b - a)}%"></i>`).join("");
  return `<li class="coverRow"><span class="eventText"><span class="eventName">${name}</span><span class="eventMeta">${meta}</span></span><span class="coverTrack">${segs}</span><span class="coverState ${tone}">${status}</span></li>`;
}
const coverage = view({
  icon: "file",
  title: "Extratos importados",
  window: "01/01 a 19/11",
  verdict: '<span class="warnText">Itaú está sem extrato desde 30/09</span> e o Nubank tem um buraco de 12/08 a 03/09; o Cartão Itaú está em dia pela conexão.',
  body: `<ul class="covers">
    ${coverRow("Itaú", "último 30/09 · OFX", [[0, 272, "on"], [272, D, "gap"]], "50 dias", "warn")}
    ${coverRow("Nubank", "último 18/11 · OFX", [[0, 223, "on"], [223, 245, "gap"], [245, 321, "on"]], "22 dias", "warn")}
    ${coverRow("Cartão Itaú", "conexão · hoje 06:00", [[0, D, "on"]], "em dia", "up")}
    ${coverRow("Inter", "aberta em 03/03", [[61, 303, "on"]], "19 dias", "muted")}
  </ul>
  <div class="coverAxis"><span style="left:0%">jan</span><span style="left:${p(90)}%">abr</span><span style="left:${p(181)}%">jul</span><span style="left:${p(273)}%">out</span></div>
  <ul class="legend"><li><i class="key"></i>Com extrato</li><li><i class="key gapKey"></i>Sem extrato</li></ul>`,
  open: "Importação",
  prov: "Lotes de importação e conexões de 4 contas",
  next: ["Importar o extrato do Itaú aqui", "O que falta de agosto no Nubank?"],
});

// A guide article: the steps, in order, with the screen they happen on.
const help = view({
  icon: "book",
  title: "Importar um extrato OFX",
  window: "guia · Importação",
  verdict: "O extrato entra pela tela Importação, na conta certa; as duplicadas são ignoradas.",
  body: `<ol class="steps">
    <li><span class="stepN">1</span><span>Abra Importação e escolha a conta</span></li>
    <li><span class="stepN">2</span><span>Arraste o arquivo .ofx do banco</span></li>
    <li><span class="stepN">3</span><span>Revise as transações sem categoria</span></li>
  </ol>`,
  open: "Abrir o artigo",
  next: ["Enviar o arquivo aqui na conversa", "Meu banco só exporta CSV"],
});

// Calculator: gross and net growth of a fixed income application.
const cdiYear = 0.149, rate = cdiYear * 1.1;
const fm = Math.pow(1 + rate, 1 / 12);
const ir = (m) => (m * 30.4 <= 180 ? 0.225 : m * 30.4 <= 360 ? 0.2 : m * 30.4 <= 720 ? 0.175 : 0.15);
const grossAt = (m) => 10000 * Math.pow(fm, m);
const netAt = (m) => 10000 + (grossAt(m) - 10000) * (1 - ir(m));
const gMax = grossAt(24);
const cy = (v) => (120 - ((v - 10000) / (gMax - 10000)) * 110).toFixed(1);
const calc = view({
  icon: "calc",
  title: "Simulação · CDB 110% do CDI",
  window: "24 meses",
  verdict: `Em 2 anos, R$ 10.000,00 viram <strong>${brl(grossAt(24))}</strong> brutos e <strong>${brl(netAt(24))}</strong> líquidos de IR.`,
  body: `<div class="inputs"><span class="inp"><small>Aplicação</small>R$ 10.000,00</span><span class="inp"><small>Taxa</small>110% do CDI</span><span class="inp"><small>CDI</small>14,90% a.a.</span></div>
  <div><div class="plot"><div class="canvas">
    <svg class="line" viewBox="0 0 300 120" preserveAspectRatio="none" role="img" aria-label="Bruto e líquido de 0 a 24 meses">
      <g class="grid"><line x1="0" x2="300" y1="10" y2="10"/><line x1="0" x2="300" y1="65" y2="65"/><line class="zero" x1="0" x2="300" y1="120" y2="120"/></g>
      <path class="subject" pathLength="1" d="${Array.from({ length: 25 }, (_, m) => `${m ? "L" : "M"}${(m * 12.5).toFixed(1)} ${cy(grossAt(m))}`).join(" ")}"/>
      <path class="net" d="${Array.from({ length: 25 }, (_, m) => `${m ? "L" : "M"}${(m * 12.5).toFixed(1)} ${cy(netAt(m))}`).join(" ")}"/>
    </svg>
    ${readout(Array.from({ length: 25 }, (_, m) => `${m} ${m === 1 ? "mês" : "meses"} · bruto ${brl(grossAt(m))} · líquido ${brl(netAt(m))}`))}
  </div><div class="yAxis"><span>R$ 13,5 mil</span><span>R$ 11,8 mil</span><span>R$ 10 mil</span></div></div>
  <div class="xAxis withY"><span>hoje</span><span>12 meses</span><span>24 meses</span></div></div>
  <ul class="legend"><li><i class="key"></i>Bruto</li><li><i class="key netKey"></i>Líquido de IR</li></ul>`,
  open: "Abrir na calculadora",
  next: ["Comparar com LCI de 92% do CDI", "Aplicar os R$ 10.000,00"],
});

// Next contribution: where the money goes so the classes approach their targets.
function aporteRow(name, now, after, target, amount) {
  const s = (v) => ((v / 70) * 100).toFixed(1);
  return `<li class="row pair"><span class="rowKey">${name} <span class="muted">alvo ${target}%</span></span><span class="rowValue">${amount}<small>${String(now).replace(".", ",")}% → ${String(after).replace(".", ",")}%</small></span>
  <span class="track"><i class="fill ref" style="width:${s(now)}%"></i><i class="tick" style="left:${s(target)}%"></i></span>
  <span class="track"><i class="fill" style="width:${s(after)}%"></i><i class="tick" style="left:${s(target)}%"></i></span></li>`;
}
const aporte = view({
  icon: "coins",
  title: "Próximo aporte · R$ 5.000,00",
  window: "plano de aportes",
  verdict: 'Tudo em <strong>renda fixa</strong>: é a única classe abaixo do alvo e sobe de 52,0% para 53,3%.',
  body: `<ul class="legend"><li><i class="key ref"></i>Hoje</li><li><i class="key"></i>Depois do aporte</li><li><i class="key" style="--fill:var(--slotted-text);inline-size:2px"></i>Alvo</li></ul>
  <ul class="bars">
    ${aporteRow("Renda fixa", 52.0, 53.3, 60, "R$ 5.000,00")}
    ${aporteRow("Ações", 31.0, 30.1, 25, "R$ 0,00")}
    ${aporteRow("FIIs", 12.0, 11.7, 10, "R$ 0,00")}
    ${aporteRow("Exterior", 5.0, 4.9, 5, "R$ 0,00")}
  </ul>`,
  open: "Plano de aportes",
  prov: "Carteira de R$ 176.981,78 em 18/11",
  next: ["Qual CDB tem a melhor taxa?", "Quanto falta para o alvo de renda fixa?"],
});

// ---------- Round 2: more proposal bodies ----------

const wRecord = sheet(
  "Registrar despesa · Padaria Real",
  `<ul class="agenda">${event(19, "nov", true, "Padaria Real", "Nubank · Padaria", "−R$ 48,00")}</ul>
  <div class="diff"><span class="diffKey">Saldo Nubank</span><span class="was">R$ 2.034,10</span>${I.arrow}<span class="is">R$ 1.986,10</span></div>`,
  "A categoria Padaria vem do histórico do estabelecimento.",
  { icon: "plus" },
);

function catItem(d, name, value) {
  return `<li class="pick"><span class="check sm">${I.check}</span><span class="day"><b>${d.slice(0,2)}</b>nov</span><span class="eventName">${name}</span><span class="num">${value}</span></li>`;
}
const wCategorize = sheet(
  "Categorizar 5 corridas",
  `<div class="diff"><span class="diffKey">Categoria</span><span class="was">Sem categoria</span>${I.arrow}<span class="is"><span class="chipCat is">Transporte</span></span></div>
  <ul class="picks">
    ${catItem("17/11", "Uber *Trip", "−23,40")}
    ${catItem("15/11", "Uber *Trip", "−18,90")}
    ${catItem("12/11", "Uber *Trip", "−31,20")}
    ${catItem("09/11", "Uber *Trip", "−27,60")}
    ${catItem("04/11", "Uber *Trip", "−19,80")}
  </ul>
  <label class="also"><input type="checkbox" checked><span>Criar a regra <code>UBER*</code> → Transporte para as próximas</span></label>`,
  'Os 5 somam <strong>R$ 120,90</strong>; Transporte de novembro passa de R$ 212,40 para R$ 333,30 de 500.',
  { icon: "wand", n: 5, items: true },
);

const wSplit = sheet(
  "Dividir compra · Carrefour R$ 420,00",
  `<div class="stack splitBar" role="img" aria-label="Mercado R$ 300,00, Casa R$ 120,00"><span class="seg" style="--share:71.4;--fill:${c(3)}"></span><span class="seg" style="--share:28.6;--fill:${c(5)}"></span></div>
  <ul class="shares"><li class="share"><i class="key" style="--fill:${c(3)}"></i><span class="shareName">Mercado</span><span class="num">R$ 300,00</span><span class="sharePct">71%</span></li><li class="share"><i class="key" style="--fill:${c(5)}"></i><span class="shareName">Casa</span><span class="num">R$ 120,00</span><span class="sharePct">29%</span></li><li class="share sum"><span></span><span class="shareName">Total da compra</span><span class="num">R$ 420,00</span><span class="sharePct up">confere</span></li></ul>`,
  "",
  { icon: "split" },
);

function acct(name, was, is, mono, fill) {
  return `<span class="acct"><span class="mono" style="--fill:${fill}">${mono}</span><span class="acctName">${name}</span><span class="was">${was}</span><span class="is">${is}</span></span>`;
}
const wTransfer = sheet(
  "Transferir R$ 2.000,00 · Itaú → Inter",
  `<div class="transfer">${acct("Itaú", "R$ 9.320,00", "R$ 7.320,00", "IT", c(1))}<span class="hop">${I.arrow}<b>R$ 2.000,00</b></span>${acct("Inter", "R$ 4.150,00", "R$ 6.150,00", "IN", c(2))}</div>`,
  "Transferência entre contas suas: não entra em gastos nem em orçamentos.",
  { icon: "swap" },
);

const wVoid = sheet(
  "Anular · iFood *Sushi Leblon R$ 112,00",
  `<div class="diff"><span class="diffKey">Fatura Cartão Itaú</span><span class="was">R$ 3.760,00</span>${I.arrow}<span class="is">R$ 3.648,00</span>
  <span class="diffKey">Restaurantes nov</span><span class="was">R$ 718,90</span>${I.arrow}<span class="is">R$ 606,90 <small class="muted">de 600</small></span></div>`,
  'Lançada 2 vezes em 09/11. A cópia anulada fica no histórico e volta com <strong>Desfazer</strong>.',
  { icon: "trash", danger: true, confirm: "Anular" },
);

const wAttach = sheet(
  "Anexar nota fiscal · Pão de Açúcar",
  `<div class="attachMatch"><span class="doc" aria-hidden="true"><i></i><i></i><i></i><i></i><b>PDF</b></span>
  <ul class="matches"><li>${I.check}Valor igual · R$ 212,40</li><li>${I.check}Mesmo dia · 18/11</li><li>${I.check}CNPJ do Pão de Açúcar</li></ul></div>`,
  "nota-fiscal-pao-de-acucar.pdf, 84 KB, enviado nesta conversa.",
  { icon: "clip" },
);

const wSettle = sheet(
  "Pagar fatura · Cartão Itaú",
  `<div class="eq"><b>R$ 3.760,00</b><span class="muted">do Itaú em 25/11, no vencimento</span></div>
  <div class="diff"><span class="diffKey">Saldo Itaú</span><span class="was">R$ 9.320,00</span>${I.arrow}<span class="is">R$ 5.560,00</span>
  <span class="diffKey">Fatura novembro</span><span class="was">R$ 3.760,00</span>${I.arrow}<span class="is">R$ 0,00 <small class="up">paga</small></span></div>`,
  "",
  { icon: "card" },
);

const wRefund = sheet(
  "Estorno parcial · Mercado Livre",
  `<div class="flow">
    <span class="node"><span class="nodeKey">Compra 02/11</span><span class="nodeValue">R$ 899,90</span></span>${I.arrow}
    <span class="node hot"><span class="nodeKey">Estorno</span><span class="nodeValue">−R$ 300,00</span></span>${I.arrow}
    <span class="node"><span class="nodeKey">Fica</span><span class="nodeValue">R$ 599,90</span></span>
  </div>`,
  "O estorno entra como crédito na fatura de dezembro do Cartão Itaú.",
  { icon: "undo" },
);

const cardFace = (cls, label) =>
  `<span class="cardFace ${cls}"><span class="cfBrand">Itaú</span><span class="cfChip"></span><span class="cfNum">•••• 4821</span><span class="cfName">${label}</span></span>`;
const wCardFace = sheet(
  "Aparência do cartão · Itaú Visa",
  `<div class="faces">${cardFace("plain", "atual")}${I.arrow}${cardFace("dark lines", "nova")}</div>`,
  "Só muda o desenho do cartão no app.",
  { icon: "card" },
);

const occ = ["10/12", "10/01", "10/02", "10/03", "10/04", "10/05"];
const wSchedule = sheet(
  "Novo agendamento · Inglês R$ 480,00",
  `<div class="eq"><b>R$ 480,00</b><span class="muted">todo dia 10, no Itaú, a partir de 10/12</span></div>
  <div class="occ" role="img" aria-label="Próximas 6 ocorrências de 10/12 a 10/05">${occ.map((d, i) => `<span class="occDot${i === 0 ? " first" : ""}"><i></i><small>${d}</small></span>`).join("")}</div>
  <div class="diff"><span class="diffKey">Saldo previsto 31/12</span><span class="was">R$ 6.912,30</span>${I.arrow}<span class="is">R$ 6.432,30</span></div>`,
  "",
  { icon: "cal" },
);

const deliv = [["jun", 298], ["jul", 341], ["ago", 389], ["set", 276], ["out", 402], ["nov", 412.6]];
const wBudget = sheet(
  "Criar orçamento · Delivery R$ 350,00",
  `<div><div class="cols" style="--n:6;block-size:88px">${deliv
    .map(([m, v], i) => `<span class="col${v > 350 ? " overCol" : ""}${i === 5 ? " partial" : ""}" tabindex="0" style="--h:${(v / 5).toFixed(1)}%"><i></i><span class="tip">${m} · ${brl(v)}${i === 5 ? " até 19/11" : ""}</span></span>`)
    .join("")}<span class="avg limitLine" style="bottom:70%"><span class="avgLabel">limite R$ 350</span></span></div>
  <div class="colAxis" style="--n:6">${deliv.map(([m]) => `<span>${m}</span>`).join("")}</div></div>`,
  'O limite teria sido passado em <strong>3 dos últimos 6 meses</strong>; novembro já está em R$ 412,60.',
  { icon: "target" },
);

const wNote = sheet(
  "Nota de corretagem · XP 19/11",
  `<table class="tbl"><thead><tr><th>Ordem</th><th>Qtd</th><th>Preço</th><th>Total</th></tr></thead><tbody>
    <tr><td><span class="ticker"><i style="--fill:${c(1)}"></i>C PETR4</span></td><td>50</td><td>38,90</td><td>1.945,00</td></tr>
    <tr><td><span class="ticker"><i style="--fill:${c(2)}"></i>C ITSA4</span></td><td>100</td><td>10,52</td><td>1.052,00</td></tr>
    <tr><td class="muted">Custos</td><td></td><td></td><td>1,65</td></tr>
  </tbody><tfoot><tr><td>Débito</td><td></td><td></td><td>2.998,65</td></tr></tfoot></table>
  <div class="diff"><span class="diffKey">PM PETR4</span><span class="was">R$ 34,20</span>${I.arrow}<span class="is">R$ 35,77</span>
  <span class="diffKey">PM ITSA4</span><span class="was">R$ 9,84</span>${I.arrow}<span class="is">R$ 10,07</span></div>`,
  "Os custos entram no preço médio de cada ordem, em proporção ao valor.",
  { icon: "receipt" },
);

const wCorp = sheet(
  "Desdobramento 1 para 2 · WEGE3",
  `<div class="diff"><span class="diffKey">Quantidade</span><span class="was">20</span>${I.arrow}<span class="is">40</span>
  <span class="diffKey">Preço médio</span><span class="was">R$ 40,24</span>${I.arrow}<span class="is">R$ 20,12</span>
  <span class="diffKey">Posição</span><span class="same">R$ 976,00</span>${I.arrow}<span class="is">R$ 976,00</span></div>`,
  "A posição não muda; só a quantidade e o preço médio.",
  { icon: "split" },
);

const wImport = sheet(
  "Importar extrato · Itaú outubro",
  `<div class="counts"><span class="count"><b>48</b>novas</span><span class="count muted"><b>3</b>já existiam</span><span class="count warn"><b>5</b>sem categoria</span></div>
  <div class="coverTrack single"><i class="on" style="left:0;width:84.5%"></i><i class="fill2" style="left:84.5%;width:9.6%"></i><i class="gap" style="left:94.1%;width:5.9%"></i></div>
  <div class="planAxis"><span>01/01</span><span>01/10 a 31/10</span><span>hoje</span></div>
  <p class="okLine">${I.check}Saldo final R$ 4.218,40 confere com o extrato</p>`,
  "",
  { icon: "file", n: 48, confirm: "Importar 48" },
);

const wRule = sheet(
  "Criar regra · UBER* → Transporte",
  `<div class="flow">
    <span class="node"><span class="nodeKey">Contém</span><span class="nodeValue"><code>UBER*</code></span></span>${I.arrow}
    <span class="node hot"><span class="nodeKey">Categoria</span><span class="nodeValue">Transporte</span></span>
  </div>
  <ul class="agenda">
    ${event(17, "nov", false, "Uber *Trip", "Nubank · Sem categoria", "−R$ 23,40")}
    ${event(28, "out", false, "Uber *Eats", "Nubank · Restaurantes", "−R$ 41,90")}
    <li class="week"><span>e outras 21 transações antigas</span><span>R$ 512,80</span></li>
  </ul>`,
  '<span class="warnText">Uber *Eats sai de Restaurantes.</span> Uma regra <code>UBER *TRIP</code> mantém as entregas onde estão.',
  { icon: "wand" },
);

const targetBar = (parts) =>
  `<div class="stack">${parts.map(([n, v, f]) => `<span class="seg" tabindex="0" style="--share:${v};--fill:${f}"><span class="tip">${n} · ${v}%</span></span>`).join("")}</div>`;
const wPlan = sheet(
  "Plano de aportes · novos alvos",
  `<div class="stackRow"><span class="diffKey">Atual</span>${targetBar([["Renda fixa", 60, c(1)], ["Ações", 25, c(2)], ["FIIs", 10, c(3)], ["Exterior", 5, c(4)]])}</div>
  <div class="stackRow"><span class="diffKey">Novo</span>${targetBar([["Renda fixa", 55, c(1)], ["Ações", 25, c(2)], ["FIIs", 10, c(3)], ["Exterior", 10, c(4)]])}</div>
  <ul class="legend"><li><i class="key" style="--fill:${c(1)}"></i>Renda fixa 60 → 55%</li><li><i class="key" style="--fill:${c(2)}"></i>Ações 25%</li><li><i class="key" style="--fill:${c(3)}"></i>FIIs 10%</li><li><i class="key" style="--fill:${c(4)}"></i>Exterior 5 → 10%</li></ul>`,
  "Com os novos alvos, o próximo aporte vai para Exterior e renda fixa.",
  { icon: "pie" },
);

// ---------- Outcomes: a result replaces its proposal ----------

const outcome = (tone, icon, title, meta, acts) =>
  `<div class="outcome ${tone}"><span class="kind ${tone}">${I[icon]}</span><span class="eventText"><span class="eventName">${title}</span><span class="eventMeta">${meta}</span></span>${acts}</div>`;
const outApplied = outcome("ok", "check", "Compra parcelada registrada", "12 × R$ 252,00 no Cartão Itaú · 10:03", `<a class="act" href="#">Abrir</a><button class="act" type="button">${I.undo}Desfazer</button>`);
const outRejected = outcome("muted", "x", "Correção rejeitada", "Nada mudou · 10:04", "");
const outExpired = outcome("muted", "clock", "Proposta expirada às 10:15", "Os saldos podem ter mudado desde então", `<button class="act" type="button">Propor de novo</button>`);
const outFailed = outcome("fail", "x", "Pagamento não aplicado", "A fatura de novembro já foi paga em 18/11", `<a class="act" href="#">Ver fatura</a>`);
const outPartial = outcome("ok", "check", "4 de 5 corridas categorizadas", "1 já tinha categoria; regra criada", `<a class="act" href="#">Abrir</a><button class="act" type="button">${I.undo}Desfazer</button>`);

// ---------- States of concept A ----------

const loadingA = `<div class="thread">${ask("Onde mais gastei em outubro?")}
<p class="working"><span class="spin" aria-hidden="true"></span>Somando as despesas de outubro em 3 contas</p>
<section class="view" aria-busy="true" aria-label="Montando a visão">
  <header class="viewHead"><span class="skel" style="inline-size:40%;block-size:12px"></span><span class="skel" style="inline-size:20%;block-size:10px;margin-inline-start:auto"></span></header>
  <span class="skel" style="inline-size:85%;block-size:12px"></span>
  ${Array.from({ length: 5 }, (_, i) => `<div style="display:grid;gap:6px"><span class="skel" style="inline-size:${60 - i * 8}%;block-size:10px"></span><span class="skel" style="inline-size:${100 - i * 15}%;block-size:8px"></span></div>`).join("")}
</section></div>`;

const emptyA = `<div class="thread">${ask("Como estão meus gastos de dezembro por dia?")}
${view({
  title: "Gastos por dia",
  window: "dezembro 2026",
  body: `<div class="empty"><span>Nenhuma despesa registrada em dezembro.</span><span class="muted" data-wrap-ok>O mês começa em 12 dias; os agendamentos aparecem em Próximos 30 dias.</span></div>`,
  open: "Planejamento",
})}</div>`;

const errorA = `<div class="thread">${ask("Como o saldo do Itaú andou em outubro?")}
${view({
  title: "Saldo · Itaú conta corrente",
  window: "outubro 2026",
  body: `<p class="failText">O histórico do Itaú termina em 30/09, na última importação.</p><p class="verdict" data-wrap-ok>Sem lançamentos de outubro, a linha do saldo não é desenhada. Importar o extrato de outubro completa o mês.</p>`,
  open: "Importar extrato",
})}</div>`;

const hardA = `<div class="thread">
${ask("Onde mais gastei no ano, incluindo a empresa?")}
${view({
  title: "Onde foi o dinheiro",
  window: "jan a nov 2026",
  verdict: 'Moradia e condomínio do apartamento da praia levam <strong>41%</strong> dos <strong>R$ 1.234.567,89</strong> do ano.',
  body: `<ul class="bars">
    ${rankRow(1, "Moradia e condomínio do apartamento da praia em Ubatuba", "R$ 506.172,83", "41%", 100)}
    ${rankRow(2, "Fornecedores da empresa", "R$ 298.104,00", "24%", 58.9)}
    ${rankRow(3, "Mercado", "R$ 18.402,10", "1%", 3.6)}
    ${rankRow(4, "Doações", "R$ 0,00", "0%", 0)}
    ${rankRow("", "Outras 14 categorias", "R$ 411.888,96", "33%", 81.4, neutral)}
  </ul>`,
  open: "Relatórios",
})}
${ask("Qual é o meu patrimônio hoje?")}
${view({
  title: "Patrimônio líquido",
  window: "hoje, 19/11",
  verdict: 'Caiu <strong class="down">R$ 41.203,77 (−18,2%)</strong> em 30 dias; a fatura aberta passou o saldo das contas.',
  body: `<div class="figure"><div><span class="figureValue">−R$ 1.284,90</span><span class="figureDelta down">−R$ 41.203,77 em 30 dias</span></div><svg class="spark" viewBox="0 0 120 44" preserveAspectRatio="none" role="img" aria-label="Patrimônio em queda em 30 dias"><path pathLength="1" d="M0 4 L30 10 L60 18 L90 30 L120 40"/><circle cx="120" cy="40" r="4"/></svg></div>
  <div class="parts">
    <div class="part" style="--part-color:${c(1)}"><span class="partKey">Contas</span><span class="partValue">R$ 2.475,10</span></div>
    <div class="part" style="--part-color:${c(2)}"><span class="partKey">Investimentos</span><span class="partValue">indisponível</span></div>
    <div class="part" style="--part-color:${c(3)}"><span class="partKey">Fatura aberta</span><span class="partValue">−R$ 3.760,00</span></div>
  </div>
  <p class="verdict" data-wrap-ok>Investimentos fora do total: a cotação de PETR4 falhou em 19/11.</p>`,
  open: "Visão geral",
})}
${ask("Como estou no orçamento de novembro?")}
${view({
  title: "Orçamento de novembro",
  window: "dia 19 de 30",
  verdict: '<span class="over">1 categoria acima do limite.</span> Viagens não tem orçamento.',
  body: `<ul class="bars">
    ${budgetRow("Restaurantes", "R$ 1.718,90", "600", 100, 34.9, "R$ 1.118,90")}
    ${budgetRow("Transporte", "R$ 0,00", "500", 0, 29.1)}
    <li class="row"><span class="rowKey">Viagens <span class="muted">sem orçamento</span></span><span class="rowValue">R$ 2.410,00</span><span class="track"><i class="fill ref" style="width:100%"></i></span></li>
  </ul>`,
  open: "Orçamentos",
})}
</div>`;

// ---------- Conversation: one full turn, from question to result ----------

const restMonths = [["dez", 812], ["jan", 640], ["fev", 598], ["mar", 702], ["abr", 655], ["mai", 731], ["jun", 820], ["jul", 690], ["ago", 610], ["set", 610.2], ["out", 864.3], ["nov", 718.9]];
const restaurants = view({
  icon: "chart",
  title: "Restaurantes por mês",
  window: "dez 2025 a nov 2026",
  verdict: 'Outubro, <strong>R$ 864,30</strong>, foi o maior mês do período e ficou <strong>23% acima</strong> da média de R$ 702,95.',
  body: `<div><div class="cols" style="--n:12">${restMonths
    .map(([m, v], i) => `<span class="col${i === 10 ? " current" : ""}${i === 11 ? " partial" : ""}" tabindex="0" style="--h:${(v / 9).toFixed(1)}%"><i></i><span class="tip">${m} · ${brl(v)}${i === 11 ? " até 19/11" : ""}</span></span>`)
    .join("")}<span class="avg" style="bottom:78.1%"><span class="avgLabel">média R$ 703</span></span></div>
  <div class="colAxis" style="--n:12">${restMonths.map(([m]) => `<span>${m}</span>`).join("")}</div></div>`,
  open: "Relatórios",
  prov: "Categoria Restaurantes, 3 contas, meses fechados na média",
  next: ["Onde mais gastei em restaurantes?", "Criar um orçamento de R$ 700"],
  data: table(["Mês", "Restaurantes"], restMonths.map(([m, v]) => [m, brl(v)])),
});

const steps = (n, text) =>
  `<details class="stepsLine"><summary>${I.search}<span>${n} consultas · ${text}</span>${I.chev}</summary><ol class="stepList"><li>Totais de categoria · outubro</li><li>Totais de categoria · 12 meses</li></ol></details>`;

const wBudgetRest = sheet(
  "Criar orçamento · Restaurantes R$ 700,00",
  `<div class="diff"><span class="diffKey">Limite mensal</span><span class="was">sem orçamento</span>${I.arrow}<span class="is">R$ 700,00</span>
  <span class="diffKey">Novembro até hoje</span><span class="same">R$ 718,90</span>${I.arrow}<span class="is over">acima R$ 18,90</span></div>`,
  "Vale a partir de novembro; o mês atual já passou do limite.",
  { icon: "target" },
);

const flow = `<div class="thread">
${ask("Quanto gastei com restaurante em outubro? Isso é normal?")}
${steps(2, "totais de categoria")}
<p class="lead" data-wrap-ok>Foram R$ 864,30, o maior mês do ano. Setembro e agosto ficaram em R$ 610; a diferença veio de 3 jantares acima de R$ 120.</p>
${restaurants}
${ask("Criar um orçamento de R$ 700")}
${wBudgetRest}
${ask("Pode confirmar")}
${outcome("ok", "check", "Orçamento criado · R$ 700,00", "Restaurantes, desde novembro · 10:06", `<a class="act" href="#">Abrir</a><button class="act" type="button">${I.undo}Desfazer</button>`)}
</div>`;

// ---------- Concept A data state: the catalog by area of the app ----------

const dataA = `<div class="thread">
${group("Patrimônio e contas", [ask("Qual é o meu patrimônio hoje?"), figure, ask("Como foi meu mês em números?"), indicators, ask("Quanto tenho em cada moeda?"), fx, ask("Meu saldo aguenta até o fim do ano?"), balance])}
${group("Gastos", [ask("Onde mais gastei em outubro?"), ranking, ask("Gastei mais em outubro ou em setembro?"), compare, ask("O que mudou de setembro para outubro?"), changes, ask("Como se divide meu gasto do ano?"), treemap, ask("Como meus gastos andaram no ano?"), series, ask("Em que dias eu gasto mais?"), heat, ask("Quanto sobrou em outubro?"), waterfall])}
${group("Transações", [ask("Quanto gastei no iFood este mês?"), txs, ask("Teve alguma compra fora do normal?"), outliers, ask("Me mostra a compra do Pão de Açúcar"), txDetail, ask("Por que essa compra caiu em Eletrônicos?"), explain, ask("Que assinaturas eu pago?"), recurring])}
${group("Cartão", [ask("Como está dividida a fatura de novembro?"), composition, ask("Quanto já está comprometido nas próximas faturas?"), commitments])}
${group("Planejamento, orçamento e metas", [ask("O que vence nos próximos 30 dias?"), agenda, ask("Como estou no orçamento de novembro?"), budget, ask("Vou bater a meta da viagem?"), goal])}
${group("Investimentos", [ask("Como estão minhas ações?"), holdings, ask("Como a PETR4 andou desde que comprei?"), priceChart, ask("Minha carteira bateu o CDI?"), bench, ask("Minha carteira está no alvo?"), allocation, ask("Onde aplico 5 mil este mês?"), aporte, ask("Quanto recebo se resgatar o CDB do Aurora hoje?"), redemption, ask("O Banco Aurora é seguro?"), institution, ask("Quanto rende 10 mil a 110% do CDI em 2 anos?"), calc])}
${group("Impostos, importação e ajuda", [ask("Devo imposto sobre as ações este ano?"), taxYear, ask("Falta importar algum extrato?"), coverage, ask("Como importo um extrato?"), help])}
${group("Escritas · transações", [
  ask("Gastei 48 na padaria agora no Nubank"), wRecord,
  ask("Essas corridas do Uber são transporte"), wCategorize,
  ask("O Carrefour de 420 foi 300 de mercado e 120 de casa"), wSplit,
  ask("O mercado de ontem foi 212,40, não 21,24"), wChange,
  ask("O sushi do dia 9 entrou duas vezes"), wVoid,
  ask("Anexa essa nota na compra do Pão de Açúcar"), wAttach,
  ask("Transfere 2 mil do Itaú para o Inter"), wTransfer,
  ask("Toda compra UBER é transporte"), wRule,
])}
${group("Escritas · contas e cartão", [
  ask("O app do banco diz 2.100,00 no Itaú"), wReconcile,
  ask("Importa esse extrato de outubro do Itaú"), wImport,
  ask("Comprei uma geladeira de 3.024 em 12x no cartão Itaú"), wInstall,
  ask("Paga a fatura do cartão com o Itaú"), wSettle,
  ask("O Mercado Livre estornou 300 da compra do fone"), wRefund,
  ask("Deixa o cartão Itaú escuro com linhas"), wCardFace,
])}
${group("Escritas · planejamento e investimentos", [
  ask("Vou pagar inglês, 480 todo dia 10"), wSchedule,
  ask("Quero um limite de 350 para delivery"), wBudget,
  ask("Quero juntar 15 mil para viajar até julho"), wGoal,
  ask("Apliquei 10 mil num CDB do Inter a 110% do CDI"), wFixed,
  ask("Registra a nota da XP de hoje"), wNote,
  ask("A WEGE3 desdobrou 1 para 2"), wCorp,
  ask("Transferi 200 ITSA4 da Clear para a XP"), wCustody,
  ask("Quero 10% em exterior, tirando de renda fixa"), wPlan,
])}
${group("Depois da decisão", [outApplied, outPartial, outRejected, outExpired, outFailed])}
</div>`;

const t = (concept, state, html) => `<template data-concept="${concept}" data-state="${state}">\n${html}\n</template>`;

writeFileSync(
  new URL("./design.html", import.meta.url),
  [
    "<!-- Generated by gen.mjs: edit the generator, not this file. -->",
    t("a", "data", dataA),
    t("a", "flow", flow),
    t("a", "loading", loadingA),
    t("a", "empty", emptyA),
    t("a", "error", errorA),
    t("a", "hard", hardA),
  ].join("\n\n") + "\n",
);
