// Signal Plan Checker v2.6.2 - Plan Computation Module
// Business logic for cycle computation and scaling

// Get the active intergreen matrix for a junction (min or max)
function getActiveIntergreen(j){
  const useMax = (j.activeIntergreenSet === 'max');
  return useMax ? (j.intergreenMax || j.intergreen) : j.intergreen;
}

function ensureTD2(name){
  // Strip illegal path chars for safety and force .TD2 extension
  name = (name || '').trim().replace(/[\\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ');
  if(!name) return 'My Diagram.TD2';
  if(!/\.td2$/i.test(name)) name += '.TD2';
  return name;
}

// --- Scale Plans button helper
function openScalePlansDialog(){
  // Populate modal fields
  const cur = App.state.mainCycle|0;
  const modal = document.getElementById('scaleModal');
  const inpCur = document.getElementById('scCur');
  const inpTgt = document.getElementById('scTarget');
  const chkRem = document.getElementById('scRemoveDouble');
  const preview = document.getElementById('scPreview');
  const btnApply = document.getElementById('scApplyBtn');
  if(inpCur) inpCur.value = cur;
  if(inpTgt) inpTgt.value = String(cur);
  if(chkRem) chkRem.checked = (App.state.junctions||[]).some(j=>!!j.doubleCycle);
  if(preview) preview.innerHTML = '';
  if(btnApply) btnApply.disabled = true;
  const msgEl = document.getElementById('scSuggestMsg');
  if(msgEl) msgEl.innerHTML = '';

  // Show modal
  modal.classList.add('show');
  enableDragModal('scaleModal');
}

// --- Scale Plans modal helpers
function closeScalePlansDialog(){
  const modal = document.getElementById('scaleModal');
  if(modal) modal.classList.remove('show');
}

// --- Compute minimum feasible MAIN cycle across junctions (max of per-junction (sumMinGreens + sumIntergreens for used moves))
function computeMinCycleSuggestion(){
  const juncs = App.state.junctions || [];
  if(!juncs.length) return { error: 'No junctions available' };
  const perJ = [];
  let maxNeed = 0;
  for(const j of juncs){
    const rc = computeRealisedCycleAdj(j);
    if(!rc.ok){
      return { error: rc.err && rc.err[0] ? rc.err[0] : `Invalid UTC plan for ${j.name}` };
    }
    const N = rc.plan.length; const toIdx = rc.toIdx.slice();
    const activeIg = getActiveIntergreen(j);
    let sumIG = 0, sumMin = 0;
    for(let i=0;i<N;i++){
      const curIdx  = toIdx[i];
      const prevIdx = toIdx[(i-1+N)%N];
      const ig = activeIg[prevIdx][curIdx];
      sumIG  += Math.max(0, ig); // fixed intergreens for the **used** moves
      sumMin += (j.stages[curIdx] && (j.stages[curIdx].minGreenSec|0)) || 0;
    }
    const need = sumIG + sumMin;
    perJ.push({ id:j.id, name:j.name, sumIG, sumMin, minCycle: need });
    if(need > maxNeed) maxNeed = need;
  }
  const lo = App.initCfg.mainCycleTime.min||1;
  const hi = App.initCfg.mainCycleTime.max||240;
  const minMain = Math.max(lo, Math.min(hi, Math.ceil(maxNeed)));
  return { minMain, perJ };
}

// --- Scale Plans: wire Suggest Min button (idempotent)
document.addEventListener('DOMContentLoaded', function(){
  const btnSuggest = document.getElementById('scSuggestBtn');
  if(btnSuggest && !btnSuggest.__wired){
    btnSuggest.__wired = true;
    btnSuggest.addEventListener('click', function(){
      try{
        const res = computeMinCycleSuggestion();
        const msgEl = document.getElementById('scSuggestMsg');
        if(res && res.error){
          if(msgEl) msgEl.textContent = res.error;
          return;
        }
        const m = res.minMain;
        const inp = document.getElementById('scTarget');
        if(inp){ inp.value = String(m); }
        if(msgEl){
          const parts = res.perJ.map(p=>`${p.name}: ${p.minCycle}s`);
          msgEl.innerHTML = `<strong>Suggested main cycle:</strong> ${m}s &nbsp; <em>${parts.join(' · ')}</em>`;
        }
      }catch(err){
        const msgEl = document.getElementById('scSuggestMsg');
        if(msgEl) msgEl.textContent = 'Suggest min failed: ' + (err && err.message ? err.message : String(err));
      }
    });
  }
});



function parseTarget(){
  const inpTgt = document.getElementById('scTarget');
  if(!inpTgt) return null;
  let v = parseInt(inpTgt.value||'',10);
  if(!Number.isFinite(v)) { alert('Enter a target cycle in seconds.'); return null; }
  const lo = App.initCfg.mainCycleTime.min||1;
  const hi = App.initCfg.mainCycleTime.max||240;
  if(v < lo || v > hi){ alert(`Target must be between ${lo} and ${hi} seconds.`); return null; }
  return v|0;
}

// HTML-escape helper for error messages (escapes &, <, > only)
function __escHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

function renderScalePreview(result, target){
  const box = document.getElementById('scPreview');
  if(!box) return;
  if(!result){ box.innerHTML=''; return; }
  const rows = result.details.map(d=>{
    const ok = d.ok;
    const icon = ok ? '✅' : '❌';
    let summary = '';
    if(ok && d.metrics){
      const m = d.metrics;
      const slack = Math.max(0, (m.needGreen - m.scaledGreen));
      summary = ` • greens: ${m.curGreen}s → ${m.scaledGreen}s • IG: ${m.igTotal}s • need: ${m.needGreen}s • slack: ${slack}s`;
    }
    const msg = ok ? `OK${summary}` : __escHtml(d.err||'Failed');
    return `<div class=\"infochip\" style=\"display:block; margin:4px 0\">${icon} <strong>${d.name}</strong> — ${msg}</div>`;
  }).join('');
  const allOk = result.ok;
  try{
    box.innerHTML = `<div class="infobar">Preview for ${target}s</div>${rows}`;
  }catch(e){
    box.textContent = `Preview render error: ${e&&e.message?e.message:e}`;
  }
  // --- Cache for export and enable Export button if allOk
  App._scalePreviewCache = { result, target };
  const btnExport = document.getElementById('scExportBtn');
  if(btnExport) btnExport.disabled = !allOk;
  const btnApply = document.getElementById('scApplyBtn');
  if(btnApply) btnApply.disabled = !allOk;
  renderScaleDiagnostics(result, target);
}

// --- Scale Plans diagnostics renderer
function renderScaleDiagnostics(result, target){
  const host = document.getElementById('scDiag');
  const toggle = document.getElementById('scDiagToggle');
  if(!host) return;
  host.innerHTML = '';
  // If there's no explicit toggle element, render by default when container exists
  const show = toggle ? !!toggle.checked : true;
  if(!show) return;
  if(!result) return;
  const blocks = result.details.map(d=>{
    if(!d.ok || !d.perStage) {
      const msg = d.err ? __escHtml(d.err) : 'No diagnostics available';
      return `<div class="infochip" style="display:block; margin:4px 0">${d.name}: ${msg}</div>`;
    }
    const rows = d.perStage.map(ps =>
      `<tr><td>${ps.label}</td><td>${ps.igPrev}</td><td>${ps.minGreen}</td><td>${ps.greenOld}</td><td>${ps.greenNew}</td><td>${ps.requiredGap}</td><td>${ps.actualGap}</td></tr>`
    ).join('');
    return `
      <div class="card" style="padding:8px; margin:6px 0">
        <strong>${d.name}</strong>
        <table class="grid compact auto" style="margin-top:6px">
          <thead><tr><th>Stage</th><th>IG(prev→cur)</th><th>Min green</th><th>Old green</th><th>New green</th><th>Req gap</th><th>Actual gap</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');
  host.innerHTML = `<div class="infobar">Diagnostics for ${target}s</div>` + blocks;
}

// --- Scale Plans button helper (export)
function exportScalePreviewJSON(){
  const cache = App._scalePreviewCache;
  if(!cache || !cache.result){ alert('Please run Preview first.'); return; }
  const { result, target } = cache;
  if(!result.ok){ alert('Preview must be OK for all junctions before exporting.'); return; }
  const payload = {
    type: 'scaled-utc-plan',
    version: 'v2.6.2',
    targetCycle: target|0,
    generatedAt: new Date().toISOString(),
    main: { mainCycle: target|0 },
    junctions: result.details.map(d=>({ id:d.id, name:d.name, utcPlan: d.plan }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g,'-');
  a.href = url;
  a.download = `scaled-plans-${target}s-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function scalePreview(target, removeDouble){
  const details = [];
  const clones = JSON.parse(JSON.stringify(App.state.junctions||[]));
  // apply double-cycle removal on clones if requested
  if(removeDouble){ clones.forEach(j=> j.doubleCycle = false); }
  for(let i=0;i<clones.length;i++){
    const j = clones[i];
    const r = computeScaledPlanForJunction(j, target);
    if(r.ok){
      // stash plan for potential application
      details.push({ok:true, name:j.name, id:j.id, plan:r.plan, metrics:r.metrics});
    }else{
      details.push({ok:false, name:j.name, id:j.id, err:r.err});
    }
  }
  const ok = details.every(d=>d.ok);
  return {ok, details};
}

function applyScale(target, removeDouble){
  // Optional: remove double cycle on real state first
  if(removeDouble){ (App.state.junctions||[]).forEach(j=> j.doubleCycle=false); }

  // Compute with real objects to obtain plans; abort on first failure
  const updates = [];
  for(const j of (App.state.junctions||[])){
    const r = computeScaledPlanForJunction(j, target);
    if(!r.ok){ return {ok:false, err:r.err}; }
    updates.push({j, plan:r.plan});
  }
  // Apply
  updates.forEach(u=>{ u.j.utcPlan = u.plan; });
  App.state.mainCycle = target|0;
  const mc = document.getElementById('mainCycle'); if(mc) mc.value = App.state.mainCycle;
  rebuildTabs();
  setDirty();
  runValidation({silent:true});
  setStatus(`✅ Scaled plans to ${target}s and updated main cycle.`);
  return {ok:true};
}

// Compute a scaled UTC plan for one junction while keeping intergreens fixed and
// scaling only the actual green time proportionally. Returns {ok, plan, err, metrics}
function computeScaledPlanForJunction(j, targetMain){
  // Effective current/target cycles for this junction (respect double cycle flag)
  const curC = j.doubleCycle ? (App.state.mainCycle/2) : App.state.mainCycle;
  const tgtC = j.doubleCycle ? (targetMain/2) : targetMain;
  if(!(curC>0 && tgtC>0)) return {ok:false, err:`Invalid cycles for ${j.name}`};

  // Realised cycle under current timings (includes min greens + intergreens)
  const rc = computeRealisedCycleAdj(j);
  if(!rc.ok) return {ok:false, err: rc.err && rc.err[0] ? rc.err[0] : `Realised cycle error for ${j.name}`};

  const N = rc.plan.length;
  const toIdx = rc.toIdx.slice();
  const activeIg = getActiveIntergreen(j);

  // Fixed intergreens (preceding each stage)
  const igPrev = new Array(N).fill(0).map((_,i)=>{
    const curIdx  = toIdx[i];
    const prevIdx = toIdx[(i-1+N)%N];
    return Math.max(0, activeIg[prevIdx][curIdx]);
  });

  // Actual green durations per stage (current)
  const greens = new Array(N).fill(0).map((_,i)=>{
    const curIdx  = toIdx[i];
    const prevIdx = toIdx[(i-1+N)%N];
    const start   = rc.RC[i] + Math.max(0, activeIg[prevIdx][curIdx]);
    const end     = rc.RC[i+1];
    return Math.max(0, end - start);
  });

  const factor = tgtC / curC;
  let scaled = greens.map(g=> Math.max(0, Math.round(g * factor)));

  // Enforce per-stage min green constraints
  const mins = toIdx.map(idx => (j.stages[idx] && (j.stages[idx].minGreenSec|0)) || 0);
  for(let i=0;i<N;i++) if(scaled[i] < mins[i]) scaled[i] = mins[i];

  // Totals check against target: fixed IG + scaled greens must fit exactly tgtC
  const sum = arr=> arr.reduce((a,b)=>a+b,0);
  const totalIG = sum(igPrev);
  const totalG  = sum(scaled);
  const need    = tgtC - totalIG;

  if(totalG > need){
    // We need to reduce total green by `over` seconds but may not go below per-stage mins
    let over = totalG - need; // > 0
    const surplus = scaled.map((g,i)=> Math.max(0, g - mins[i]));
    const totalSurplus = surplus.reduce((a,b)=>a+b,0);
    if(totalSurplus < over){
      // Even if we squeeze all stages down to their min greens we still don't fit
      const minTotal = mins.reduce((a,b)=>a+b,0);
      return {ok:false, err:`${j.name}: min greens (${minTotal}s) + fixed intergreens (${totalIG}s) exceed ${tgtC}s (need ≤ ${need}s green).`};
    }
    // Proportional compression based on available surplus per stage
    // First pass: proportional integer reduction
    let removed = 0;
    for(let i=0;i<scaled.length;i++){
      if(surplus[i] <= 0) continue;
      const take = Math.min(surplus[i], Math.floor(over * (surplus[i] / totalSurplus)));
      if(take>0){ scaled[i] -= take; surplus[i] -= take; removed += take; }
    }
    over -= removed;
    // Second pass: round-robin any remaining seconds of `over`, never go below mins
    let i = 0; const Nrr = scaled.length; let guard = 10000;
    while(over > 0 && guard-- > 0){
      if(surplus[i % Nrr] > 0){ scaled[i % Nrr] -= 1; surplus[i % Nrr] -= 1; over -= 1; }
      i++;
    }
  }

  // Distribute slack proportionally to original greens (fallback to even if all zeros)
  let slack = need - totalG; // ≥ 0
  if(slack > 0){
    const base = sum(greens);
    if(base > 0){
      for(let i=0;i<N;i++){
        const add = Math.floor(slack * (greens[i]/base));
        scaled[i] += add; slack -= add;
      }
    }
    // Any remainder: add 1s round-robin to preserve order
    let k=0; while(slack>0){ scaled[k%N]++; slack--; k++; }
  }

  // Build per-stage diagnostics (after final scaling/compression)
  const perStage = new Array(N).fill(null).map((_,i)=>({
    label: j.stages[toIdx[i]].label,
    igPrev: igPrev[i],
    minGreen: mins[i],
    greenOld: greens[i],
    greenNew: scaled[i],
    requiredGap: igPrev[i] + mins[i],
    actualGap: igPrev[i] + scaled[i]
  }));

  // Build new realised change times RC' based on igPrev + scaled greens, anchored at 0
  const RCp = new Array(N+1).fill(0);
  RCp[0] = 0; // anchor start at 0 to avoid wrap artefacts during preview verification
  for(let i=0;i<N;i++){
    const inc = igPrev[i] + scaled[i];
    RCp[i+1] = RCp[i] + (inc < 1 ? 1 : inc);
  }
  // Total should equal target cycle for this junction
  const totalRC = RCp[N];
  if(totalRC !== tgtC){
    // minor rounding guard: adjust the last boundary to match exactly
    RCp[N] = tgtC;
  }

  // Convert realised boundaries into plan requests (request exactly at change times)
  const newPlan = new Array(N).fill(null).map((_,i)=>({
    to: j.stages[toIdx[i]].label,
    at: Math.round(RCp[i])
  })).sort((a,b)=> a.at - b.at);
  // Wrap into [0, tgtC)
  for(let i=0;i<newPlan.length;i++){ newPlan[i].at = ((newPlan[i].at % tgtC) + tgtC) % tgtC; }
  newPlan.sort((a,b)=> a.at - b.at);

  // Verify feasibility under the TARGET cycle time
  const jClone = JSON.parse(JSON.stringify(j));
  jClone.utcPlan = newPlan.map(r=>({to:r.to, at:r.at}));
  const __oldMain = App.state.mainCycle;
  let rcNew;
  try{
    App.state.mainCycle = targetMain|0;
    rcNew = computeRealisedCycle(jClone);
  }finally{
    App.state.mainCycle = __oldMain;
  }
  if(!rcNew.ok){
    return {ok:false, err:`${j.name}: ${rcNew.err && rcNew.err[0] ? rcNew.err[0] : 'realisation check failed'}`};
  }

  // Also ensure no stage is "missed": sequence length and labels preserved up to rotation
  const seqOldArr = rc.plan.map(p=>p.to);
  const seqNewArr = rcNew.plan.map(p=>p.to);
  function isRotation(a,b){
    if(a.length!==b.length) return false;
    const s = a.join('\u0001');
    const t = b.join('\u0001');
    return (s+s).includes(t);
  }
  if(!isRotation(seqOldArr, seqNewArr)){
    return {ok:false, err:`${j.name}: stage sequence changed unexpectedly (would miss or reorder a stage).`};
  }

  // Build metrics breakdown for preview
  const sum2 = arr=> arr.reduce((a,b)=>a+b,0);
  const metrics = {
    curCycle: curC|0,
    tgtCycle: tgtC|0,
    factor: +(tgtC/curC).toFixed(3),
    igTotal: sum2(igPrev),
    curGreen: sum2(greens),
    minGreenTotal: sum2(mins),
    scaledGreen: sum2(scaled),
    needGreen: tgtC - sum2(igPrev),
  };
  return {ok:true, plan:newPlan, metrics, perStage};
}





function mkDefaultUTCPlan(cfg){
  return (cfg.utcPlan && Array.isArray(cfg.utcPlan.defaults)) ? JSON.parse(JSON.stringify(cfg.utcPlan.defaults)) : [{to:'S1',at:0},{to:'S2',at:30}];
}

function mkJunction(id, cfg){
  const nStages = Math.max(cfg.stageCount.min, cfg.stageCount.default);
  const stages = [];
  const minG = cfg.stage.minGreen.default;
  for(let i=0;i<nStages;i++)
    {
      stages.push({ label: 'S'+(i+1), minGreenSec: minG, dir: 'none' });
    }
  const N = nStages; const ig = []; const igMax = [];
  for(let r=0;r<N;r++){
    const row=[];
    const rowMax=[];
    for(let c=0;c<N;c++){
      row.push(r===c ? cfg.intergreen.diagonalLockedValue : cfg.intergreen.defaults.offDiagonal);
      rowMax.push(r===c ? cfg.intergreen.diagonalLockedValue : cfg.intergreen.defaults.offDiagonal);
    }
    ig.push(row);
    igMax.push(rowMax);
  }
  return {
    id,
    name:'Junction '+id,
    doubleCycle:false,
    utcPlan: mkDefaultUTCPlan(cfg),
    stages,
    intergreen: ig,
    intergreenMax: igMax,
    activeIntergreenSet: 'min',
    travelPrev: cfg.journeyTime.default,
    travelNext: cfg.journeyTime.default
  };
}

function buildState(cfg){
  const count = Math.max(cfg.junctionCount.min, Math.min(cfg.junctionCount.max, cfg.junctionCount.default));
  const ids = ['A','B','C','D','E'].slice(0,count);
  const juncs = ids.map(id=>mkJunction(id, cfg));
  return { ...App.state, mainCycle: Math.max(cfg.mainCycleTime.min, Math.min(cfg.mainCycleTime.max, cfg.mainCycleTime.default)), viewCycles: (cfg.plot.viewCycles && cfg.plot.viewCycles.default)||2, junctions: juncs, pxPerSec: cfg.plot.pxPerSec||4 };
}

function effectiveCycle(j){ return j.doubleCycle ? (App.state.mainCycle/2) : App.state.mainCycle; }
function stageIndex(j, label){ const idx = j.stages.findIndex(s=>s.label===label); return (idx>=0? idx : 0); }
function clampInt(v, lo, hi){ v=parseInt(v||0,10); if(isNaN(v)) v=0; return Math.max(lo, Math.min(hi, v)); }

// --- Adjusted plan helpers (global) ---
function getAdjustedPlan(j){
  const Cj = effectiveCycle(j);
  const base = (j.utcPlan||[]).slice().sort((a,b)=>a.at-b.at).map(r=>({to:r.to, at:r.at}));
  const off = (App.state.temp && App.state.temp.offsets && App.state.temp.offsets[j.id]) || 0;
  // apply offset (wrap into [0,Cj))
  if(off){
    for(let i=0;i<base.length;i++){
      let t = base[i].at + off; t %= Cj; if(t<0) t += Cj; base[i].at = t;
    }
    base.sort((a,b)=>a.at-b.at);
  }
  // apply boundary nudges (delta seconds to the change between stage i and i+1)
  const bmap = (App.state.temp && App.state.temp.boundary && App.state.temp.boundary[j.id]) || {};
  Object.keys(bmap).forEach(k=>{
    const idx = parseInt(k,10); if(!isFinite(idx)) return;
    let t = (base[idx] && base[idx].at) || 0;
    t += bmap[k];
    t %= Cj; if(t<0) t += Cj;
    if(base[idx]) base[idx].at = t;
  });
  base.sort((a,b)=>a.at-b.at);
  return base;
}
function computeRealisedCycleAdj(j){
  const jClone = JSON.parse(JSON.stringify(j));
  jClone.utcPlan = getAdjustedPlan(j);
  return computeRealisedCycle(jClone);
}
// ---- min-green realised times (from v1.1.6-alpha) ----
function computeRealisedCycle(j){
  const Cj = effectiveCycle(j);
  const plan = (j.utcPlan||[]).slice().sort((a,b)=>a.at-b.at);
  const N = plan.length;
  if(N===0) return {ok:false, err:['UTC plan empty']};
  const toIdx = plan.map(p=>stageIndex(j,p.to));
  const activeIg = getActiveIntergreen(j);
  for(let i=0;i<N;i++){
    const from = toIdx[i];
    const to = toIdx[(i+1)%N];
    if(activeIg[from][to] === -1){
      const a=j.stages[from].label, b=j.stages[to].label;
      return {ok:false, err:[`${j.name}: Stage move not permitted ${a} → ${b}`]};
    }
  }
  // Extended horizon: add warmup cycle + validation cycle
  // This allows the system to stabilize before checking constraints
  const Rq = new Array(N*3);
  for(let i=0;i<N;i++){ Rq[i]=plan[i].at; }
  for(let i=0;i<N;i++){ Rq[i+N]=plan[i].at + Cj; }
  for(let i=0;i<N;i++){ Rq[i+N*2]=plan[i].at + Cj*2; }
  const RC = new Array(N*2+1).fill(0);
  RC[0] = Rq[0];
  // Run through 2 full cycles (warmup + validation)
  for(let i=0;i<N*2;i++){
    const curIdx = toIdx[i%N];
    const prevIdx = toIdx[(i-1+N)%N];
    const nextIdx = toIdx[(i+1)%N];
    const igPrev = Math.max(0, activeIg[prevIdx][curIdx]);
    const mgCur = j.stages[curIdx].minGreenSec|0;
    const nextReq = Rq[i+1];
    const nextNextReq = (i+2 < Rq.length) ? Rq[i+2] : (Rq[(i+2)%N] + Math.floor((i+2)/N)*Cj);
    const stageStart = RC[i] + igPrev;
    const earliestMG = stageStart + mgCur;
    const realisedNext = Math.max(nextReq, earliestMG);
    // Only validate constraints after first full cycle (warmup period)
    if(i >= N && realisedNext >= nextNextReq){
      const a = j.stages[curIdx].label, b=j.stages[nextIdx].label;
      return {ok:false, err:[`${j.name}: Stage change not achievable ${a} → ${b} before next request at t=${nextNextReq%Cj}s`]};
    }
    RC[i+1] = realisedNext;
  }
  // Extract stable cycle data (second cycle, indices N to N*2)
  // Return arrays indexed 0..N for rendering compatibility
  // Store as cycle-relative times (modulo Cj) so rendering works correctly
  // BUT: Keep RC[N] as-is (not modulo) so it represents the wrap to next cycle
  const RCstable = new Array(N+1);
  for(let i=0;i<N;i++){ RCstable[i] = RC[N+i] % Cj; }
  RCstable[N] = RC[N+N] % Cj + Cj; // Next cycle's first event = plan[0].at + Cj
  const RCmod = new Array(N+1);
  for(let i=0;i<=N;i++){ RCmod[i] = RCstable[i] % Cj; }
  // Build details array for stable cycle only
  const stableDetails = [];
  for(let i=0;i<N;i++){
    const curIdx = toIdx[i];
    const prevIdx = toIdx[(i-1+N)%N];
    const nextIdx = toIdx[(i+1)%N];
    const igPrev = Math.max(0, activeIg[prevIdx][curIdx]);
    const mgCur = j.stages[curIdx].minGreenSec|0;
    const rqCur = plan[i].at;
    const rqNext = (i+1 < N) ? plan[i+1].at : (plan[0].at + Cj);
    const rqNext2 = (i+2 < N) ? plan[i+2].at : (plan[(i+2)%N].at + Cj);
    const stageStart = RCstable[i] + igPrev;
    const earliestMG = stageStart + mgCur;
    const realisedNext = RCstable[i+1];
    stableDetails.push({i, rqCur, rqNext, rqNext2, igPrev, mgCur, stageStart, earliestMG, realisedNext, delay: realisedNext - rqNext, curStage:j.stages[curIdx].label, nextStage:j.stages[nextIdx].label});
  }
  return {ok:true, Cj, plan, toIdx, RC:RCstable, RCmod, details:stableDetails};
}
function travelTimeBetween(fromIdx, toIdx){
  const J = App.state.junctions;
  if(fromIdx===toIdx) return 0;
  let t = 0;
  if(toIdx>fromIdx){
    for(let i=fromIdx;i<toIdx;i++) t += (J[i].travelNext||0);
  }else{
    for(let i=fromIdx;i>toIdx;i--) t += (J[i].travelPrev||0);
  }
  return t;
}

function rowY(top, rowH, gap, idx){
  return top + idx*(rowH+gap);
}
