const T0 = Date.parse("2020-12-31"), T2023 = Date.parse("2023-12-31"), T1 = Date.parse("2024-12-31"), T2 = Date.parse("2026-06-15"), DAY = 86400000;
const TABS = [["ALL","전체","🌐"],["US","미국","🇺🇸"],["KR","한국","🇰🇷"]];
const SORTS = [["rank","현재 순위"],["climb","순위 급상승"],["pct","시총 상승률"]];
const YEAR_MARKS = [["2020",T0],["2021",Date.parse("2021-12-31")],["2022",Date.parse("2022-12-31")],["2023",T2023],["2024",T1],["2025",Date.parse("2025-12-31")],["현재",T2]];
const PRESETS = YEAR_MARKS.map(([label, ts]) => [label === "현재" ? "현재" : `${label}년`, ts]);
const FLAG = { US:"🇺🇸",KR:"🇰🇷",CN:"🇨🇳",TW:"🇹🇼",SR:"🇸🇦",NL:"🇳🇱",UK:"🇬🇧",CH:"🇨🇭",JP:"🇯🇵" };
const C = { ink:"#0E1726",sub:"#5B6472",faint:"#8A93A2",border:"#E7EAF0",borderStrong:"#D5DAE3",up:"#E23B3E",down:"#1F6FE5",upBg:"#FCEAEB",downBg:"#E9F1FD",chip:"#EEF0F4" };
const FLOW_LIMIT = 20;
let FX = 1513;  // USD→KRW 환율 (서버 /api/rankings 의 fx_krw_per_usd 로 갱신)
const Y2020 = {
  AAPL:2250, MSFT:1680, AMZN:1630, GOOG:1180, META:778, TSLA:669, NVDA:323, TSM:489, "BRK-B":540,
  JPM:387, V:444, WMT:408, JNJ:434, MA:337, PG:342, XOM:175, LLY:168, COST:160, ASML:210,
  "005930.KS":487, "000660.KS":76, TCEHY:686, BABA:648, PDD:164, "600519.SS":321, "300750.SZ":123,
  "002594.SZ":81, NFLX:239, KO:235, BAC:262, CVX:164, ORCL:173, CSCO:189, INTC:204, AMD:111
};
const Y2020_FACTOR = { US:1.28, KR:1.12, CN:0.92, TW:1.25, SR:0.95, NL:1.32, UK:1.1, CH:1.08, JP:1.12, WW:1.2 };
const NASDAQ = new Set(["AAPL","GOOG","MSFT","AMZN","TSLA","META","NVDA","AVGO","MU","AMD","INTC","CSCO","COST","LRCX","AMAT","NFLX","KLAC","SNDK","MRVL","PDD","NTES"]);
const NYSE = new Set(["TSM","BABA","BRK-B","LLY","WMT","JPM","ORCL","ASML","V","XOM","JNJ","MA","CAT","ABBV","ARM","PLTR","BAC","CVX","UNH","KO","GE","PG","MS","HSBC","HD","GS","MRK","PM","TXN","DELL","WFC","IBM","GEV","RTX","C","KB","SHG","PKX","KEP","SKM","WF"]);
const INVESTING = {
  AAPL:"apple-computer-inc", MSFT:"microsoft-corp", GOOG:"alphabet-c", AMZN:"amazon-com-inc", TSLA:"tesla-motors", META:"meta-platforms",
  NVDA:"nvidia-corp", AVGO:"broadcom-ltd", TSM:"taiwan-semicond.manufacturing-co", "2222.SR":"saudi-aramco", ASML:"asml-holdings",
  "BRK-B":"berkshire-hathaway", LLY:"eli-lilly-and-co", WMT:"wal-mart-stores", JPM:"jp-morgan-chase", ORCL:"oracle-corp",
  V:"visa-inc", XOM:"exxon-mobil", JNJ:"johnson-johnson", TCEHY:"tencent-holdings", CSCO:"cisco-sys-inc", MA:"mastercard-cl-a",
  COST:"costco-whsl-corp-new", CAT:"caterpillar", ABBV:"abbvie-inc", ARM:"arm-holdings", PLTR:"palantir-technologies",
  BAC:"bank-of-america", CVX:"chevron", NFLX:"netflix,-inc.", AMAT:"applied-materials", UNH:"united-health-group",
  KO:"coca-cola-co", GE:"gen-elec-co", PG:"procter-gamble", MS:"morgan-stanley", HSBC:"hsbc-holdings-plc", HD:"home-depot",
  GS:"goldman-sachs-group", BABA:"alibaba", PDD:"pdd-holdings", AMD:"advanced-micro-devices", INTC:"intel-corp", MU:"micron-tech",
  "005930.KS":"samsung-electronics-co-ltd", "000660.KS":"sk-hynix-inc"
};

const state = { tab:"ALL", cache:{}, loading:false, selTs:T0, sort:"rank", open:null };
const root = document.getElementById("root");
let dragRenderTimer = null;
let draggingDate = false;

function esc(v) { return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function ticker(s) { return s.split(".")[0].replace("-", "."); }
function fmtCap(v) {
  const jo = v * FX / 1000;  // v: 10억 USD -> 조원
  if (jo >= 10000) return `${(jo/10000).toLocaleString("ko-KR",{maximumFractionDigits:2})}경원`;
  if (jo >= 100) return `${Math.round(jo).toLocaleString("ko-KR")}조원`;
  if (jo >= 1) return `${jo.toFixed(1)}조원`;
  return `${Math.round(jo*10000).toLocaleString("ko-KR")}억원`;
}
function fmtPct(p) { return `${p > 0 ? "+" : ""}${p.toFixed(Math.abs(p) >= 100 ? 0 : 1)}%`; }
function fmtDate(ts) { const d = new Date(ts); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`; }
function toISO(ts) { return new Date(ts).toISOString().slice(0,10); }
function histPoints(c) {
  const pts = [], h = c.hist || {};
  for (const y in h) { const Y = +y; pts.push([Y >= 2026 ? T2 : Date.parse(`${Y}-12-31`), h[y]]); }
  if (!pts.length) pts.push([T2, c.now]);
  return pts.sort((a, b) => a[0] - b[0]);
}
function capAt(c, ts) {                       // 연도별 실측(hist) 선형 보간
  const pts = c._pts || (c._pts = histPoints(c));
  if (ts < pts[0][0]) return null;            // 그 시점엔 cmc 데이터 없음 → 미존재
  if (ts >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    if (ts <= pts[i][0]) {
      const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
      return v0 + (v1 - v0) * ((ts - t0) / (t1 - t0));
    }
  }
  return pts[pts.length - 1][1];
}
function rankMap(list, ts) {
  const m = {};
  list.filter(c => capAt(c, ts) != null).sort((a, b) => capAt(b, ts) - capAt(a, ts)).forEach((d, i) => m[d.sym] = i + 1);
  return m;
}
function rankOf(list, sym, ts) { return rankMap(list, ts)[sym]; }
function naverSymbol(sym) {
  const [base, suffix] = sym.split(".");
  if (suffix === "KS" || suffix === "KQ") return { kind:"domestic", code:base };
  if (suffix) return { kind:"worldstock", code:sym };
  if (NASDAQ.has(sym)) return { kind:"worldstock", code:`${sym}.O` };
  if (NYSE.has(sym)) return { kind:"worldstock", code:`${sym.replace("-", ".")}.N` };
  return { kind:"worldstock", code:sym.replace("-", ".") };
}
function naverUrl(sym) { const n = naverSymbol(sym); return n.kind === "domestic" ? `https://m.stock.naver.com/domestic/stock/${n.code}/total` : `https://m.stock.naver.com/worldstock/stock/${encodeURIComponent(n.code)}/total`; }
function investingUrl(sym, name) { return INVESTING[sym] ? `https://kr.investing.com/equities/${INVESTING[sym]}` : `https://kr.investing.com/search/?q=${encodeURIComponent(name || ticker(sym))}`; }
function briefNames(items, n=3) { return items.length <= n ? items.map(d=>d.name).join(", ") : `${items.slice(0,n).map(d=>d.name).join(", ")} 외 ${items.length-n}개`; }
function logo(sym, name) { return `<img class="logo" src="/api/logo/${encodeURIComponent(sym)}" alt="${esc(name)}" loading="lazy">`; }
const imgCache = new Map();
function logoSlot(ctx, sym, name) {
  return `<span class="logo logo-skel" data-logo-ctx="${esc(ctx)}" data-logo-sym="${esc(sym)}" data-logo-name="${esc(name)}"></span>`;
}
function hydrateLogos(scope) {
  scope.querySelectorAll(".logo-skel[data-logo-sym]").forEach((slot) => {
    const ctx = slot.dataset.logoCtx, sym = slot.dataset.logoSym, name = slot.dataset.logoName || sym;
    const key = ctx + "|" + sym;
    let img = imgCache.get(key);
    if (!img) {
      img = new Image();
      img.className = "logo";
      img.alt = name;
      img.src = "/api/logo/" + encodeURIComponent(sym);
      imgCache.set(key, img);
    }
    slot.replaceWith(img);
  });
}
function rangeBg(ts) {
  const pct = ((ts - T0) / (T2 - T0)) * 100;
  return `linear-gradient(to right, ${C.borderStrong} 0%, ${C.borderStrong} ${pct}%, ${C.ink} ${pct}%, ${C.ink} 100%)`;
}
function syncDateControls(ts) {
  const label = document.getElementById("selectedDateLabel");
  const range = document.getElementById("dateRange");
  const input = document.getElementById("dateInput");
  if (label) label.textContent = fmtDate(ts);
  if (range) {
    range.value = ts;
    range.style.background = rangeBg(ts);
  }
  if (input) input.value = toISO(ts);
  document.querySelectorAll("[data-date]").forEach((btn) => {
    btn.classList.toggle("on", Math.abs(ts - Number(btn.dataset.date)) < DAY);
  });
}
function scheduleDragRender() {
  clearTimeout(dragRenderTimer);
  dragRenderTimer = setTimeout(() => {
    dragRenderTimer = null;
    render();
  }, 120);
}
function finishDateDrag() {
  if (!draggingDate) return;
  draggingDate = false;
  if (flowRaf) { cancelAnimationFrame(flowRaf); flowRaf = null; }
  clearTimeout(dragRenderTimer);
  dragRenderTimer = null;
  render();
}

async function loadTab(tab) {
  if (state.cache[tab]) return;
  state.loading = true; render();
  try {
    const r = await fetch(`/api/rankings?group=${tab}`);
    const d = await r.json();
    if (d.fx_krw_per_usd) FX = d.fx_krw_per_usd;
    state.cache[tab] = d.companies || [];
  } catch {
    state.cache[tab] = [];
  }
  state.loading = false; render();
}

function getRows(list) {
  const selRank = rankMap(list, state.selTs), nowRank = rankMap(list, T2);
  const rows = list.map((c) => {
    const oldCap = capAt(c, state.selTs);
    const oldRank = selRank[c.sym], newRank = nowRank[c.sym];
    const isNewEntry = oldRank == null;            // 선택 시점엔 데이터 없음 → 신규 진입
    const pct = isNewEntry ? null : ((c.now - oldCap) / oldCap) * 100;
    const delta = isNewEntry ? null : oldRank - newRank;
    return { ...c, oldRank, newRank, oldCap, pct, delta, isNewEntry };
  });
  const k = (v) => (v == null ? -1e9 : v);
  return rows.sort((a,b) => state.sort === "climb" ? (k(b.delta)-k(a.delta) || a.newRank-b.newRank) : state.sort === "pct" ? k(b.pct)-k(a.pct) : a.newRank-b.newRank);
}

function card(label, main, sub, badge, accent=C.ink) {
  return `<div class="card"><div class="card-label">${esc(label)}</div><div class="card-row"><b>${esc(main)}</b><span style="color:${accent}">${esc(badge)}</span></div><div class="card-sub">${esc(sub)}</div></div>`;
}

function statsHtml(rows) {
  if (!rows.length) return "";
  const climber = [...rows].filter(r=>r.delta!=null).sort((a,b)=>b.delta-a.delta)[0];
  const gainer = [...rows].filter(r=>r.pct!=null).sort((a,b)=>b.pct-a.pct)[0];
  const enter = rows.filter(d=>d.newRank<=FLOW_LIMIT && (d.isNewEntry || d.oldRank>FLOW_LIMIT)).sort((a,b)=>a.newRank-b.newRank);
  return `<div class="stats">
    ${climber ? card("순위 최대 상승", climber.name, `${climber.oldRank}위 → ${climber.newRank}위`, climber.delta>0?`▲ ${climber.delta}계단`:"-", C.up) : card("순위 최대 상승","-","변동 없음","-")}
    ${gainer ? card("시총 최대 상승률", gainer.name, `${fmtCap(gainer.oldCap)} → ${fmtCap(gainer.now)}`, fmtPct(gainer.pct), C.up) : card("시총 최대 상승률","-","변동 없음","-")}
    ${card("TOP 20 신규 진입", enter.length?briefNames(enter):"없음", enter.length?`${enter.length}개 종목이 새로 진입`:"변동 없음", `${enter.length}개`, C.ink)}
  </div>`;
}

function flowRow(item, side, index, limit, showFlag) {
  const isPast = side === "past";
  const rank = isPast ? item.oldRank : item.newRank;
  const cap = isPast ? item.oldCap : item.now;
  const isNew = !isPast && (item.isNewEntry || item.oldRank > limit);
  const badge = isNew ? `<span class="mini new">NEW</span>` : "";
  const up = item.delta > 0, down = item.delta < 0;
  const move = item.isNewEntry ? "NEW" : up ? `▲ ${item.delta}` : down ? `▼ ${Math.abs(item.delta)}` : "-";
  const subRank = isPast ? `현재 ${item.newRank}위` : item.isNewEntry ? "신규 진입" : item.oldRank > limit ? `이전 TOP ${limit} 밖` : `${item.oldRank}위 → ${item.newRank}위`;
  return `<div class="flow-row ${isNew?"is-new":""}" data-flow-key="${side}-${esc(item.sym)}" style="transform:translateY(${index*60}px)">
    <div class="flow-rank">${rank}</div>${logoSlot("flow-"+side,item.sym,item.name)}
    <div class="flow-main"><div class="flow-name"><span>${esc(item.name)}</span>${badge}</div><div class="muted">${showFlag?(FLAG[item.cc]||"🌐")+" ":""}${esc(ticker(item.sym))} · ${fmtCap(cap)}</div></div>
    <div class="flow-move ${up?"up":down?"down":""}"><b>${move}</b><span>${esc(subRank)}</span></div>
  </div>`;
}

function rankFlow(list) {
  const limit = Math.min(FLOW_LIMIT, list.length), showFlag = state.tab === "ALL";
  const rows = getRows(list);
  const pastTop = rows.filter(r=>r.oldRank!=null).sort((a,b)=>a.oldRank-b.oldRank).slice(0, limit);
  const nowTop = [...rows].sort((a,b)=>a.newRank-b.newRank).slice(0, limit);
  const syms = [...new Set([...pastTop, ...nowTop].map(d=>d.sym))];
  const rowH = 52, step = 60, svgH = limit*step-8;
  const y = (idx) => idx*step+rowH/2;
  const lines = syms.map((sym) => {
    const p = pastTop.findIndex(d=>d.sym===sym), n = nowTop.findIndex(d=>d.sym===sym);
    const item = rows.find(d=>d.sym===sym);
    const status = p < 0 ? "new" : n < 0 ? "out" : "stay";
    return { sym, p, n, item, status, both:p>=0&&n>=0 };
  }).filter(line=>line.both);
  const paths = lines.map(line => {
    return `<path d="M0 ${y(line.p).toFixed(1)} C35 ${y(line.p).toFixed(1)} 83 ${y(line.n).toFixed(1)} 118 ${y(line.n).toFixed(1)}" fill="none" stroke="${C.borderStrong}" stroke-width="2.1" stroke-opacity=".54" stroke-linecap="round"/>`;
  }).join("");
  return `<section class="panel">
    <div class="panel-head"><div><div class="eyebrow">순위 이동</div><h2>선택 시점 시총 순위 → 현재 시총 순위</h2></div><span>${fmtDate(state.selTs)} 기준 비교</span></div>
    <div class="flow-wrap"><div class="flow-grid">
      <div><div class="flow-title"><b>선택 시점</b><span>TOP ${limit}</span><em>${fmtDate(state.selTs)}</em></div><div class="flow-board" style="height:${limit*step-8}px">${pastTop.map((d,i)=>flowRow(d,"past",i,limit,showFlag)).join("")}</div></div>
      <div class="flow-svg" style="height:${svgH+50}px"><svg viewBox="0 0 118 ${svgH}" preserveAspectRatio="none">${paths}</svg></div>
      <div><div class="flow-title"><b>현재</b><span>TOP ${limit}</span><em>${fmtDate(T2)}</em></div><div class="flow-board" style="height:${limit*step-8}px">${nowTop.map((d,i)=>flowRow(d,"now",i,limit,showFlag)).join("")}</div></div>
    </div></div>
  </section>`;
}

function liveComparisonHtml(list) {
  const rows = getRows(list);
  return `${statsHtml(rows)}${list.length?rankFlow(list):""}`;
}

let flowRaf = null;
function refreshLiveComparison(animate=false) {
  if (flowRaf) return;
  flowRaf = requestAnimationFrame(() => { flowRaf = null; applyLiveComparison(animate); });
}
function applyLiveComparison(animate=false) {
  const list = state.cache[state.tab] || [];
  const live = document.getElementById("liveComparison");
  if (!live) return;
  const previous = new Map();
  if (animate) {
    live.querySelectorAll("[data-flow-key]").forEach((el) => {
      previous.set(el.dataset.flowKey, el.getBoundingClientRect().top);
    });
  }
  live.innerHTML = liveComparisonHtml(list);
  hydrateLogos(live);
  if (!animate) return;
  live.querySelectorAll("[data-flow-key]").forEach((el) => {
    const oldTop = previous.get(el.dataset.flowKey);
    if (oldTop == null) return;
    const finalTransform = el.style.transform || "translateY(0px)";
    const finalY = Number((finalTransform.match(/translateY\((-?[\d.]+)px\)/) || [0, 0])[1]);
    const deltaY = oldTop - el.getBoundingClientRect().top;
    if (Math.abs(deltaY) < 1) return;
    el.animate(
      [{ transform:`translateY(${finalY + deltaY}px)` }, { transform:finalTransform }],
      { duration:260, easing:"cubic-bezier(.2,.75,.2,1)" }
    );
  });
}

function detail(r, list) {
  const r2 = r.newRank, rSel = r.oldRank, pct = r.pct;
  const moveColor = r.delta > 0 ? C.up : r.delta < 0 ? C.down : C.faint;
  const moveText = r.isNewEntry ? "신규 진입" : r.delta > 0 ? `▲ ${r.delta}계단 상승` : r.delta < 0 ? `▼ ${Math.abs(r.delta)}계단 하락` : "순위 변동 없음";
  const graphMarks = [["2020",T0],["2021",Date.parse("2021-12-31")],["2022",Date.parse("2022-12-31")],["2023",T2023],["2024",T1],["2025",Date.parse("2025-12-31")],["현재",T2]];
  const points = graphMarks.map(([label, ts], i) => ({ label, ts, rank:ts===T2?r2:rankOf(list,r.sym,ts), cap:ts===T2?r.now:capAt(r,ts), x:28+i*(304/6) }));
  const valid = points.filter(p=>p.rank!=null);
  const min = Math.min(...valid.map(p=>p.rank)), max = Math.max(...valid.map(p=>p.rank)), span = Math.max(1, max-min);
  const y = rank => 34 + ((rank-min)/span)*82;
  let path = "", started = false;
  points.forEach(p => { if (p.rank==null) { started=false; return; } path += (started?"L":"M")+`${p.x} ${y(p.rank).toFixed(1)} `; started=true; });
  return `<div class="detail">
    <div class="detail-head">${logoSlot("detail",r.sym,r.name)}<div><h3>${esc(r.name)} <span>${r.real_history?"실제 시총 기준":"데이터 제한"}</span></h3><p>${esc(ticker(r.sym))} · 그룹 내 순위 변화</p></div><strong>현재<br>${r2}위</strong></div>
    <div class="market-links"><a href="${naverUrl(r.sym)}" target="_blank" rel="noreferrer">네이버 증권</a><a href="${investingUrl(r.sym,r.name)}" target="_blank" rel="noreferrer">Investing.com</a></div>
    <div class="chart"><div class="chart-head"><div><b>순위 흐름</b><p>위쪽일수록 높은 순위 · 각 점의 숫자가 그룹 내 순위입니다</p></div><div><span style="color:${moveColor}">${moveText}</span>${pct!=null?`<span>시총 ${fmtPct(pct)}</span>`:""}</div></div>
      <svg viewBox="0 0 360 154" preserveAspectRatio="none">
        <rect x="0" y="0" width="360" height="154" fill="#FBFCFD"/>
        ${[34,75,116].map(gy=>`<line x1="16" y1="${gy}" x2="344" y2="${gy}" stroke="${C.border}"/>`).join("")}
        ${points.map(p=>`<line x1="${p.x}" y1="24" x2="${p.x}" y2="126" stroke="${C.border}"/>`).join("")}
        <path d="${path}" fill="none" stroke="${moveColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        ${points.map(p=>`<g>${p.rank!=null?`<circle cx="${p.x}" cy="${y(p.rank)}" r="11.5" fill="#fff" stroke="${C.borderStrong}" stroke-width="2"/><text x="${p.x}" y="${y(p.rank)+4.2}" text-anchor="middle" font-size="12" font-weight="800">${p.rank}</text>`:`<text x="${p.x}" y="79" text-anchor="middle" font-size="11" fill="${C.faint}">—</text>`}<text x="${p.x}" y="145" text-anchor="middle" font-size="9.2" font-weight="800" fill="${C.faint}">${p.label}</text></g>`).join("")}
      </svg>
      <div class="rank-points">${points.map(p=>`<div><span>${p.label}</span><b>${p.rank!=null?p.rank+"위":"—"}</b><em>${p.cap!=null?fmtCap(p.cap):"데이터 없음"}</em></div>`).join("")}</div>
      <div class="notes"><div><span>2020년 기준</span><b>${points[0].rank!=null?points[0].rank+"위":"—"}</b><em>${points[0].cap!=null?fmtCap(points[0].cap)+" · 2020년 말":"데이터 없음"}</em></div><div><span>2025년 기준</span><b>${points[5].rank!=null?points[5].rank+"위":"—"}</b><em>${points[5].cap!=null?fmtCap(points[5].cap)+" · 2025년 말":"데이터 없음"}</em></div><div><span>선택 → 현재</span><b style="color:${moveColor}">${r.isNewEntry?"신규":rSel+"위"} → ${r2}위</b><em>${moveText}${pct!=null?" · 시총 "+fmtPct(pct):""}</em></div></div>
    </div>
  </div>`;
}

function listHtml(rows, list) {
  const maxAbsPct = Math.max(1, ...rows.filter(r=>r.pct!=null).map(r=>Math.abs(r.pct)));
  return `<div class="list">${state.loading?`<div class="loading">불러오는 중...</div>`:rows.map((r,i)=>{
    const up=r.delta>0, down=r.delta<0, pColor=r.isNewEntry?C.up:r.pct>0?C.up:r.pct<0?C.down:C.faint;
    const deltaBadge=r.isNewEntry?"NEW":`${up?"▲":down?"▼":"-"}${r.delta?Math.abs(r.delta):""}`;
    const barW=r.pct==null?0:Math.min(100,Math.abs(r.pct)/maxAbsPct*100);
    return `<div class="row" data-sym="${esc(r.sym)}">
      <div class="rank">${r.newRank}</div><div class="delta ${r.isNewEntry||up?"up":down?"down":""}">${deltaBadge}</div>
      ${logoSlot("list",r.sym,r.name)}<div class="co"><b>${esc(r.name)}</b><span>${state.tab==="ALL"?(FLAG[r.cc]||"🌐")+" ":""}${esc(ticker(r.sym))} · ${r.isNewEntry?"신규":r.oldRank+"위"} → ${r.newRank}위</span></div>
      <div class="cap"><b>${fmtCap(r.now)}</b><span style="color:${pColor}"><i><i style="width:${barW}%;background:${pColor}"></i></i>${r.pct==null?"신규":fmtPct(r.pct)}</span></div>
    </div>${state.open===r.sym?detail(r,list):""}`;
  }).join("")}</div>`;
}

function render() {
  const list = state.cache[state.tab] || [];
  const rows = getRows(list);
  root.innerHTML = `<main>
    <header><div class="topline">시총 TOP 50 · 순위 변화 추적</div><h1>지금 몇 위로 올라왔나</h1><p>전체 또는 나라를 고르고, 과거 시점을 선택해 순위가 몇 계단 움직였는지·시총이 몇 % 변했는지 확인하세요.</p></header>
    <nav>${TABS.map(([code,label,flag])=>`<button class="${state.tab===code?"on":""}" data-tab="${code}"><span>${flag}</span>${label}</button>`).join("")}</nav>
    <section class="datebox"><div><span>비교 시점</span><b id="selectedDateLabel">${fmtDate(state.selTs)}</b><em>→ 현재 (${fmtDate(T2)})</em></div>
      <input class="rank-range" id="dateRange" type="range" min="${T0}" max="${T2}" step="${DAY}" value="${state.selTs}" style="background:${rangeBg(state.selTs)}">
      <div class="range-labels"><span>2020.12</span><span>2023.12</span><span>2026.06</span></div>
      <div class="presets"><input id="dateInput" type="date" min="2020-12-31" max="2026-06-15" value="${toISO(state.selTs)}">${PRESETS.map(([label,ts])=>`<button class="${Math.abs(state.selTs-ts)<DAY?"on":""}" data-date="${ts}">${label}</button>`).join("")}</div>
    </section>
    <div id="liveComparison">${liveComparisonHtml(list)}</div>
    <section class="sorts">${SORTS.map(([k,l])=>`<button class="${state.sort===k?"on":""}" data-sort="${k}">${l}</button>`).join("")}</section>
    <div class="legend"><span style="color:${C.up}">▲</span> 상승 <span style="color:${C.down}">▼</span> 하락 <em>· 국내 증시 색상 기준</em></div>
    ${listHtml(rows,list)}
    <footer>
      <p><b>시가총액 순위 추적기</b> — 전 세계·미국·한국 시가총액 상위 50개 기업의 순위가 과거 시점 대비 어떻게 변했는지 원화로 보여주는 서비스입니다.</p>
      <p>데이터 제공: <a href="https://companiesmarketcap.com" target="_blank" rel="noopener noreferrer">companiesmarketcap.com</a> · 1$≈${Math.round(FX).toLocaleString("ko-KR")}원 환산 · 환율·시총 매일 오전 7시(KST) 자동 갱신 · 로고는 각 기업의 상표이며 식별 목적으로 표시합니다.</p>
    </footer>
  </main>`;
  hydrateLogos(root);
}

root.addEventListener("click", (e) => {
  const tab = e.target.closest("[data-tab]"); if (tab) { state.tab = tab.dataset.tab; state.open = null; loadTab(state.tab); return; }
  const date = e.target.closest("[data-date]"); if (date) { state.selTs = Number(date.dataset.date); render(); return; }
  const sort = e.target.closest("[data-sort]"); if (sort) { state.sort = sort.dataset.sort; render(); return; }
  const row = e.target.closest(".row"); if (row && !e.target.closest("a")) { state.open = state.open === row.dataset.sym ? null : row.dataset.sym; render(); }
});
root.addEventListener("input", (e) => {
  if (e.target.id === "dateRange") { state.selTs = Number(e.target.value); syncDateControls(state.selTs); refreshLiveComparison(true); if (!draggingDate) scheduleDragRender(); }
  if (e.target.id === "dateInput") { const t = Date.parse(e.target.value); if (!isNaN(t)) { state.selTs = Math.min(T2, Math.max(T0, t)); render(); } }
});
root.addEventListener("pointerdown", (e) => {
  if (e.target.id === "dateRange") draggingDate = true;
});
root.addEventListener("change", (e) => {
  if (e.target.id === "dateRange") { state.selTs = Number(e.target.value); finishDateDrag(); }
});
window.addEventListener("pointerup", finishDateDrag);

function injectStyle() {
  const style = document.createElement("style");
  style.textContent = `
  main{max-width:760px;margin:0 auto;padding:20px 14px 40px;color:${C.ink};font-variant-numeric:tabular-nums} .topline{font-size:12px;font-weight:700;letter-spacing:1.4px;color:${C.faint};margin-bottom:8px} h1{font-size:26px;margin:0 0 8px;font-weight:850} header p{font-size:14px;color:${C.sub};line-height:1.55;margin:0 0 16px}
  nav{display:flex;gap:7px;margin-bottom:16px}button{font-family:inherit}nav button{flex:1;border:1px solid ${C.border};background:#fff;border-radius:12px;padding:11px 6px;font-weight:850;font-size:14px;cursor:pointer}nav button.on{background:${C.ink};color:#fff;border-color:${C.ink}}nav span{margin-right:5px}
  .datebox,.panel,.card{background:#fff;border:1px solid ${C.border};border-radius:14px}.datebox{padding:16px;margin-bottom:18px}.datebox>div:first-child{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:14px}.datebox span{font-size:13px;color:${C.sub};font-weight:700}.datebox b{font-size:22px}.datebox em{font-style:normal;color:${C.faint};font-size:13px}.rank-range{width:100%;cursor:pointer}.range-labels{display:flex;justify-content:space-between;font-size:11px;color:${C.faint};margin-top:6px}.presets{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.presets input{padding:8px 11px;border:1px solid ${C.border};border-radius:9px;font:inherit}.presets button,.sorts button{border:1px solid transparent;border-radius:999px;padding:8px 13px;background:${C.chip};font-weight:800;color:${C.sub};cursor:pointer}.presets button.on{background:#fff;color:${C.ink};border-color:${C.borderStrong};box-shadow:0 1px 4px rgba(14,23,38,.08)}.sorts button.on{background:${C.ink};color:#fff}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:18px}.card{padding:13px 14px}.card-label{font-size:11.5px;color:${C.faint};font-weight:800}.card-row{display:flex;justify-content:space-between;gap:8px;margin-top:7px}.card-row b{font-size:15px;line-height:1.25}.card-row span{font-size:13.5px;font-weight:900;white-space:nowrap}.card-sub{font-size:12px;color:${C.sub};margin-top:4px}
  .panel{padding:15px 16px 17px;margin-bottom:18px;overflow:hidden}.panel-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:13px}.eyebrow{font-size:12px;font-weight:800;color:${C.faint}}.panel h2{font-size:17px;margin:3px 0 0}.panel-head>span{font-size:12px;color:${C.sub};white-space:nowrap}.flow-wrap{overflow-x:auto}.flow-grid{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) 88px minmax(0,1fr);gap:10px}.flow-title{height:50px;display:flex;align-items:flex-start;justify-content:space-between;position:relative}.flow-title b{font-size:12px}.flow-title span{font-size:11px;background:${C.chip};border-radius:999px;padding:4px 8px;font-weight:900;color:${C.sub}}.flow-title em{position:absolute;left:0;top:20px;font-style:normal;font-size:11.5px;color:${C.faint}}.flow-board{position:relative}.flow-row{position:absolute;left:0;right:0;height:52px;display:flex;align-items:center;gap:8px;border:1px solid ${C.border};border-radius:9px;background:#fff;padding:7px 9px;box-sizing:border-box}.flow-row.is-new{border-left:4px solid ${C.up};padding-left:6px;background:linear-gradient(90deg,rgba(226,59,62,.055),#FBFCFD 26%)}.flow-rank{width:24px;text-align:center;font-size:15px;font-weight:900}.logo{width:38px;height:38px;border-radius:6px;object-fit:contain;background:#fff;padding:2px;flex-shrink:0}.logo-skel{display:inline-block}.flow-main{min-width:0;flex:1}.flow-name{display:flex;align-items:center;gap:5px;min-width:0}.flow-name span:first-child{font-size:13.5px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.muted{font-size:11.5px;color:${C.faint};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mini{font-size:9.5px;font-weight:900;border-radius:999px;padding:2px 5px;line-height:1}.mini.new{background:${C.up};color:#fff}.flow-move{text-align:right;flex-shrink:0;min-width:46px}.flow-move b{display:block;font-size:11.5px;background:${C.chip};border-radius:7px;padding:3px 6px}.flow-move.up b{color:${C.up};background:${C.upBg}}.flow-move.down b{color:${C.down};background:${C.downBg}}.flow-move span{font-size:10.5px;color:${C.faint};font-weight:800}.flow-svg{position:relative}.flow-svg svg{width:100%;height:calc(100% - 50px);display:block;margin-top:50px;overflow:visible}
  .sorts{display:flex;justify-content:flex-end;margin-bottom:14px;gap:3px}.legend{font-size:12px;color:${C.sub};margin-bottom:8px}.legend em{color:${C.faint};font-style:normal;margin-left:8px}.list{background:#fff;border:1px solid ${C.border};border-radius:14px;overflow:hidden}.row{display:flex;align-items:center;gap:11px;padding:12px 14px;border-top:1px solid ${C.border};cursor:pointer}.row:first-child{border-top:0}.rank{width:26px;text-align:center;font-size:18px;font-weight:900}.delta{min-width:40px;text-align:center;border-radius:7px;background:${C.chip};font-size:12.5px;font-weight:900;padding:4px 7px}.delta.up{color:${C.up};background:${C.upBg}}.delta.down{color:${C.down};background:${C.downBg}}.co{flex:1;min-width:0}.co b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.co span{font-size:12px;color:${C.faint};white-space:nowrap}.cap{text-align:right;min-width:84px}.cap>b{font-size:14.5px}.cap span{display:flex;align-items:center;gap:5px;justify-content:flex-end;font-size:12.5px;font-weight:900}.cap i{display:inline-block;width:28px;height:4px;background:${C.chip};border-radius:3px;overflow:hidden}.cap i i{display:block;height:100%;width:0}.loading{padding:40px;text-align:center;color:${C.faint}}
  .detail{background:#F8FAFC;border-top:1px solid ${C.border};padding:16px}.detail-head{display:flex;align-items:center;gap:11px;margin-bottom:14px}.detail h3{margin:0;font-size:16px}.detail h3 span{font-size:11px;background:${C.chip};color:${C.sub};border-radius:999px;padding:3px 8px}.detail p{margin:3px 0 0;font-size:12px;color:${C.faint}}.detail-head>div{flex:1}.detail-head strong{text-align:right;font-size:20px}.market-links{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.market-links a{display:flex;align-items:center;justify-content:center;min-height:42px;border:1px solid ${C.borderStrong};border-radius:12px;text-decoration:none;color:${C.ink};font-size:14px;font-weight:900;background:#fff}.chart{background:#fff;border:1px solid ${C.border};border-radius:12px;padding:13px}.chart-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.chart-head p{margin:2px 0 0}.chart-head span{font-size:11.5px;font-weight:900;background:${C.chip};border-radius:999px;padding:5px 8px;margin-left:6px}.chart svg{width:100%;height:190px;background:#FBFCFD;border-radius:10px;display:block}.rank-points,.notes{display:grid;gap:8px;margin-top:10px}.rank-points{grid-template-columns:repeat(auto-fit,minmax(86px,1fr))}.notes{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}.rank-points div,.notes div{background:#FBFCFD;border:1px solid ${C.border};border-radius:10px;padding:8px}.rank-points span,.notes span{display:block;font-size:10.5px;color:${C.faint};font-weight:900}.rank-points b,.notes b{display:block;font-size:15px;margin-top:3px}.rank-points em,.notes em{display:block;font-style:normal;font-size:11px;color:${C.sub};font-weight:800;margin-top:1px}footer{font-size:11.5px;color:${C.faint};line-height:1.6;margin-top:16px}footer p{margin:5px 0}footer a{color:${C.sub}}
  `;
  document.head.appendChild(style);
}

injectStyle();
render();
loadTab(state.tab);
