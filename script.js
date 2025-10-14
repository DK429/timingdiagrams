// Signal Plan Checker v1.0.3
const APP_NAME = 'Signal Plan Checker';
const APP_VERSION = '1.0.3';

const MAX_JUNCTIONS = 4;
const DEFAULT_IDS = ['A','B','C','D'];
const svgEl = () => document.getElementById('diagram');
const readoutEl = () => document.getElementById('readout');
const legendEl = () => document.getElementById('legend');
function $(id){ return document.getElementById(id); }
function elNS(tag){ return document.createElementNS('http://www.w3.org/2000/svg', tag); }
function setAttrs(ele, attrs){ for(const k in attrs) ele.setAttribute(k, attrs[k]); return ele; }
const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
const num = v => { const n = Number(String(v||'').replace(/[^0-9]/g,'')); return Number.isFinite(n)? n : 0; };
function posMod(a,m){ return ((a % m) + m) % m; }

const state = {
  junctions: [], journeys: {}, horizonSec: 0, horizonIsDefault: true, overlays: [],
  rowOrder: ['A','B','C','D'], showMainGrid: true, overrunMode: 'clip'
};

// Tabs
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tabPanel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    if(btn.dataset.tab==='plotTab'){ requestAnimationFrame(()=> render()); }
  });
});

// Helpers
function getJ(id){ return state.junctions.find(j=>j.id===id); }
function presentRowOrder(){ return state.rowOrder.filter(id => !!getJ(id)); }
function maxCycle(){ return Math.max(...state.junctions.map(j=>j.cycleTimeSec||0), 0); }
function setDefaultHorizon(){ const def = Math.max(60, maxCycle() + 20); const inp=$('horizon'); if(!inp) return; if(state.horizonIsDefault || !num(inp.value)){ inp.value = String(def); state.horizonSec = def; state.horizonIsDefault = true; } }
function stageFill(idx){
  const shades=['#1b5e20','#2e7d32','#388e3c','#43a047','#4caf50','#66bb6a','#7cb342','#8bc34a'];
  return shades[idx % shades.length];
}
function alignIntergreens(j){
  if(!j) return; const n=(j.stages||[]).length; j.intergreens = Array.isArray(j.intergreens)? j.intergreens : [];
  while(j.intergreens.length < n) j.intergreens.push({durationSec:0});
  if(j.intergreens.length > n) j.intergreens = j.intergreens.slice(0,n);
}
function sanitizeNumericInput(el){
  const cleaned = (el.value||'').replace(/[^0-9]/g,'');
  if(el.value !== cleaned) el.value = cleaned;
}
function attachSanitizers(root=document){
  root.querySelectorAll('input[type="text"][inputmode="numeric"]').forEach(inp=>{
    inp.addEventListener('input', ()=> sanitizeNumericInput(inp), {passive:true});
  });
}

// Data tab

function updateTotalsForJunction(id){
  const j = getJ(id); if(!j) return;
  const stSum = (j.stages||[]).reduce((a,b)=> a + (num(b.durationSec)), 0);
  const igSum = (j.intergreens||[]).reduce((a,b)=> a + (num(b.durationSec)), 0);
  const totEl = document.getElementById('tot_'+id);
  if(totEl){ totEl.textContent = `Total used: ${stSum + igSum}s (stages ${stSum}s + intergreens ${igSum}s) / cycle ${j.cycleTimeSec}s`; }
}

function addJunction(id){
  if(state.junctions.length >= MAX_JUNCTIONS) return;
  // Default: valid 90s cycles
  const j = { id, name:`Junction ${id}`, cycleTimeSec:60, startTimeSec:0,
    stages:[{label:`${id}1`,durationSec:15},{label:`${id}2`,durationSec:15},{label:`${id}3`,durationSec:15}],
    intergreens:[{durationSec:5},{durationSec:5},{durationSec:5}] };
  state.junctions.push(j);
  renderJunctionList(); rebuildJourneyMatrix(); refreshOverlayPickers(); setDefaultHorizon(); render();
}
function removeJunction(id){
  state.junctions = state.junctions.filter(j=>j.id!==id);
  Object.keys(state.journeys).forEach(k=>{ if(k.startsWith(id+'->')||k.endsWith('->'+id)) delete state.journeys[k]; });
  state.overlays = state.overlays.filter(ov => ov.origin.junc!==id && ov.dest.junc!==id);
  renderJunctionList(); rebuildJourneyMatrix(); refreshOverlayPickers(); setDefaultHorizon(); render();
}

function renderJunctionList(){
  const container = $('junctionList'); if(!container) return; container.innerHTML='';
  state.junctions.forEach((j)=>{
    alignIntergreens(j);
    const card = document.createElement('div'); card.className='junctionCard';
    card.innerHTML = `
      <div class="junctionRow">
        <label>Id <input value="${j.id}" disabled/></label>
        <label>Name <input data-bind="name" data-id="${j.id}" value="${j.name}"/></label>
        <label>Start offset (s) <input data-bind="start" data-id="${j.id}" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${j.startTimeSec}"/></label>
      </div>
      <div class="junctionRow">
        <label>Cycle time (s) <input data-bind="cycle" data-id="${j.id}" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${j.cycleTimeSec}"/></label>
      </div>
      <h4>Stages</h4>
      <table class="stagesTable">
        <thead><tr><th>Label</th><th>Duration (s)</th><th>Intergreen after (s)</th><th></th></tr></thead>
        <tbody id="stBody_${j.id}"></tbody>
      </table>
      <div class="stageBtns">
        <button type="button" class="small" data-add-stage="${j.id}">+ Add stage</button>
        ${state.junctions.length>2 ? `<button type="button" class="small" data-remove-j="${j.id}">Remove junction</button>` : ''}
      </div>
      <div class="totalsRow" id="tot_${j.id}" style="margin-top:6px;font-size:12px;color:#555"></div>`;
    container.appendChild(card);
    const tbody = card.querySelector(`#stBody_${j.id}`);
    j.stages.forEach((s,i)=>{
      const ig = j.intergreens[i]?.durationSec ?? 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><input data-st="label" data-id="${j.id}" data-idx="${i}" value="${s.label}"/></td>
                      <td><input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-st="dur" data-id="${j.id}" data-idx="${i}" value="${s.durationSec}"/></td>
                      <td><input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-st="ig" data-id="${j.id}" data-idx="${i}" value="${ig}"/></td>
                      <td><button type="button" class="small" data-del-stage="${j.id}" data-idx="${i}">✕</button></td>`;
      tbody.appendChild(tr);
    });
  });
  attachSanitizers(container);

  // Commit-on-blur/change only
  container.querySelectorAll('input[data-bind]').forEach(inp=>{
    const commit = ()=>{
      const j = getJ(inp.dataset.id); if(!j) return;
      if(inp.dataset.bind==='name') j.name = inp.value;
      if(inp.dataset.bind==='start') j.startTimeSec = num(inp.value);
      if(inp.dataset.bind==='cycle') { j.cycleTimeSec = num(inp.value); if(state.horizonIsDefault){ setDefaultHorizon(); } }
      rebuildJourneyMatrix(); refreshOverlayPickers(); setDefaultHorizon(); render();
      updateDataValidation();
    };
    inp.addEventListener('blur', commit);
    inp.addEventListener('change', commit);
  });
  container.querySelectorAll('input[data-st]').forEach(inp=>{
    const commit = ()=>{
      const j = getJ(inp.dataset.id); const idx = Number(inp.dataset.idx);
      if(inp.dataset.st==='label') j.stages[idx].label = inp.value;
      if(inp.dataset.st==='dur') j.stages[idx].durationSec = num(inp.value);
      if(inp.dataset.st==='ig') j.intergreens[idx].durationSec = num(inp.value);
      refreshOverlayPickers(); render(); updateDataValidation(); updateTotalsForJunction(j.id); renderJunctionListTotals && renderJunctionListTotals();
    };
    inp.addEventListener('blur', commit);
    inp.addEventListener('change', commit);
  });
  container.querySelectorAll('[data-add-stage]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const j = getJ(btn.dataset.addStage);
      const n = j.stages.length+1;
      j.stages.push({label:`${j.id}{n}`, durationSec:10});
      j.intergreens.push({durationSec:2});
      renderJunctionList();
    });
  });
  container.querySelectorAll('[data-del-stage]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const j = getJ(btn.dataset.delStage); const idx = Number(btn.dataset.idx);
      j.stages.splice(idx,1); j.intergreens.splice(idx,1);
      renderJunctionList(); refreshOverlayPickers(); render(); updateDataValidation(); updateTotalsForJunction(j.id); renderJunctionListTotals && renderJunctionListTotals();
    });
  });
  container.querySelectorAll('[data-remove-j]').forEach(btn=>{
    btn.addEventListener('click', ()=> { removeJunction(btn.dataset.removeJ); updateDataValidation(); });
  })
  // Update totals rows
  state.junctions.forEach(j=>{
    const stSum = (j.stages||[]).reduce((a,b)=> a + (num(b.durationSec)), 0);
    const igSum = (j.intergreens||[]).reduce((a,b)=> a + (num(b.durationSec)), 0);
    const totEl = document.getElementById('tot_'+j.id);
    if(totEl){ totEl.textContent = `Total used: ${stSum + igSum}s (stages ${stSum}s + intergreens ${igSum}s) / cycle ${j.cycleTimeSec}s`; }
  });
;

  // init totals for all
  state.junctions.forEach(j=> updateTotalsForJunction(j.id));
}
$('addJunctionBtn').addEventListener('click', ()=>{
  const next = DEFAULT_IDS.find(id => !getJ(id));
  if(next) addJunction(next);
});

function rebuildJourneyMatrix(){
  const cont = $('journeyMatrix'); if(!cont) return; cont.innerHTML = '';
  const n = state.junctions.length; if(n<2){ cont.textContent='Add at least two junctions.'; return; }
  const table = document.createElement('table'); table.className='stagesTable';
  const thead = document.createElement('thead');
  let hrow = '<tr><th>From \\ To</th>'; state.junctions.forEach(j=> hrow+=`<th>${j.name}</th>`); hrow+='</tr>';
  thead.innerHTML = hrow; table.appendChild(thead);
  const tbody = document.createElement('tbody');
  state.junctions.forEach(fromJ=>{
    const tr = document.createElement('tr'); let row = `<td><strong>${fromJ.name}</strong></td>`;
    state.junctions.forEach(toJ=>{
      if(fromJ.id===toJ.id) row += `<td style="text-align:center;color:#888">—</td>`;
      else{
        const key = `${fromJ.id}->${toJ.id}`; const val = state.journeys[key] ?? 20;
        row += `<td><input data-journey="${key}" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${val}" /></td>`;
      }
    });
    tr.innerHTML = row; tbody.appendChild(tr);
  });
  table.appendChild(tbody); cont.appendChild(table);
  cont.querySelectorAll('input[data-journey]').forEach(inp=>{
    const commit = ()=>{ state.journeys[inp.dataset.journey] = num(inp.value); render(); };
    inp.addEventListener('blur', commit);
    inp.addEventListener('change', commit);
  });
}

// Validation
function validate(){
  const errors = [];
  if(state.junctions.length<2) errors.push('Add at least two junctions.');
  state.junctions.forEach(j=>{
    alignIntergreens(j);
    if(j.stages.length===0) errors.push(`${j.name}: add at least one stage.`);
    if(j.intergreens.length!==j.stages.length) errors.push(`${j.name}: intergreens count must match stages count.`);
    if(j.cycleTimeSec<=0) errors.push(`${j.name}: cycle time must be > 0.`);
    const stSum = (j.stages||[]).reduce((a,b)=> a + (num(b.durationSec)), 0);
    const igSum = (j.intergreens||[]).reduce((a,b)=> a + (num(b.durationSec)), 0);
    const total = stSum + igSum;
    if(Number.isFinite(j.cycleTimeSec) && total !== j.cycleTimeSec){
      errors.push(`${j.name}: stages + intergreens (${total}s = ${stSum}s + ${igSum}s) must equal cycle (${j.cycleTimeSec}s).`);
    }
  });
  return errors;
}
function updateDataValidation(){
  const out = document.getElementById('dataValidation');
  const errors = validate();
  if(!out) return;
  if(errors.length){
    out.innerHTML = `<div class="bad"><strong>Fix these first:</strong><ul>${errors.map(e=>`<li>${e}</li>`).join('')}</ul></div>`;
  }else{
    out.innerHTML = `<div class="good">Config looks valid ✔️</div>`;
  }
}

// Timing helpers
function bandsOneCycle(j){
  const out=[]; let t=0;
  for(let i=0;i<j.stages.length;i++){
    const s=j.stages[i]; out.push({type:'stage',label:s.label,start:t,end:t+s.durationSec,index:i}); t+=s.durationSec;
    const ig=j.intergreens[i]?.durationSec ?? 0; out.push({type:'intergreen',start:t,end:t+ig,index:i}); t+=ig;
  } return out;
}
function tileBands(j, horizon){
  const tiles=[]; let cycleStart=j.startTimeSec; const cycle=j.cycleTimeSec; const start=0,end=horizon;
  while(cycleStart>start) cycleStart-=cycle; while(cycleStart+cycle<start) cycleStart+=cycle;
  while(cycleStart<end){ const bands=bandsOneCycle(j); for(const b of bands){ tiles.push({type:b.type,label:b.label,index:b.index,startAbs:cycleStart+b.start,endAbs:cycleStart+b.end}); } cycleStart+=cycle; }
  return tiles.filter(b=>b.endAbs>=start && b.startAbs<=end);
}

// Plot geometry
const MARGIN_LEFT=60, MARGIN_TOP=20, BAND_HEIGHT=30, ROW_GAP=120, ROW_LABEL_YOFF=4;
function rowY(index){ return MARGIN_TOP + index*(BAND_HEIGHT + ROW_GAP); }
function channelBox(i){
  const yTop = rowY(i) + 10 + BAND_HEIGHT + 10;
  const yBot = rowY(i+1) - 10;
  return {y0:yTop, y1:yBot, mid:(yTop+yBot)/2};
}

// Overlays pickers
function refreshOverlayPickers(){
  const o = $('ovOrigin'), d = $('ovDest'), s = $('ovStage');
  const coO=$('coOrigin'), coD=$('coDest');
  if(o) o.innerHTML=''; if(d) d.innerHTML=''; if(s) s.innerHTML='';
  if(coO) coO.innerHTML=''; if(coD) coD.innerHTML='';
  presentRowOrder().forEach(id=>{
    const j = getJ(id); if(!j) return;
    if(o){ const o1=document.createElement('option'); o1.value=id; o1.textContent=j.name; o.appendChild(o1); }
    if(d){ const d1=document.createElement('option'); d1.value=id; d1.textContent=j.name; d.appendChild(d1); }
    if(coO){ const o2=document.createElement('option'); o2.value=id; o2.textContent=j.name; coO.appendChild(o2); }
    if(coD){ const d2=document.createElement('option'); d2.value=id; d2.textContent=j.name; coD.appendChild(d2); }
  });
  const j0 = getJ(presentRowOrder()[0]);
  if(s && j0){ s.innerHTML=''; j0.stages.forEach((st,i)=>{ const opt=document.createElement('option'); opt.value=String(i); opt.textContent=st.label; s.appendChild(opt); }); }
}
$('ovOrigin')?.addEventListener('change', ()=>{
  const s = $('ovStage'); if(!s) return; s.innerHTML='';
  const j = getJ($('ovOrigin').value);
  j?.stages.forEach((st,i)=>{ const opt=document.createElement('option'); opt.value=String(i); opt.textContent=st.label; s.appendChild(opt); });
});

// Overlays add
$('addOverlayBtn')?.addEventListener('click', ()=>{
  const origin = $('ovOrigin').value;
  const dest = $('ovDest').value;
  const stageIndex = Number($('ovStage').value);
  const mode = $('ovMode').value;
  const color = $('ovColor').value;
  const opacity = Number(document.getElementById('ovOpacity').value || 0.8);
  if(origin===dest){ readoutEl().innerHTML = '<div class="bad">Origin and destination must differ.</div>'; return; }
  const id = `ov${Date.now()}${Math.floor(Math.random()*1000)}`;
  state.overlays.push({ id, type:'stage', origin:{ junc: origin, stageIndex, mode }, dest:{ junc: dest }, color, opacity });
  renderLegend(); render();
});
$('addCustomOverlayBtn')?.addEventListener('click', ()=>{
  const origin = $('coOrigin').value;
  const dest = $('coDest').value;
  let tStart = num($('coStart').value||0);
  let tEnd = num($('coEnd').value||0);
  if(origin===dest){ readoutEl().innerHTML = '<div class="bad">Origin and destination must differ.</div>'; return; }
  if(tEnd < tStart){ const tmp=tStart; tStart=tEnd; tEnd=tmp; }
  const color = $('coColor').value || '#9c27b0';
  const opacity = Number($('coOpacity').value || 0.8);
  const repeat = !!document.getElementById('coRepeat')?.checked;
  const id = `cov${Date.now()}${Math.floor(Math.random()*1000)}`;
  state.overlays.push({ id, type:'custom', origin:{ junc: origin, tStart, tEnd }, dest:{ junc: dest }, color, opacity, repeatCycle: repeat });
  renderLegend(); render();
});

function renderLegend(){
  const el = legendEl(); if(!el) return; el.innerHTML='';
  state.overlays.forEach(ov=>{
    const item=document.createElement('div'); item.className='item';
    const sw=document.createElement('span'); sw.className='swatch'; sw.style.background=ov.color;
    const path = channelPath(ov.origin.junc, ov.dest.junc); const pathTag = path.length? ` (${path.join(', ')})` : '';
    const lbl=document.createElement('span');
    if(ov.type==='custom'){
      lbl.textContent = `${getJ(ov.origin.junc)?.name} [${ov.origin.tStart}–${ov.origin.tEnd}s${ov.repeatCycle?' ×':''}] → ${getJ(ov.dest.junc)?.name}${pathTag}`;
    }else{
      lbl.textContent = `${getJ(ov.origin.junc)?.name}:${getJ(ov.origin.junc)?.stages[ov.origin.stageIndex]?.label} → ${getJ(ov.dest.junc)?.name}${pathTag}`;
    }
    const op=document.createElement('input'); op.type='range'; op.min='0.1'; op.max='1'; op.step='0.05'; op.value=String(typeof ov.opacity==='number'? ov.opacity : 0.8);
    const opVal=document.createElement('span'); opVal.textContent = ` ${Math.round((typeof ov.opacity==='number'? ov.opacity : 0.8)*100)}%`;
    op.addEventListener('input', ()=>{ ov.opacity = Number(op.value); opVal.textContent = ` ${Math.round(ov.opacity*100)}%`; render(); });
    const del=document.createElement('button'); del.className='small'; del.textContent='Remove'; del.addEventListener('click', ()=>{
      state.overlays = state.overlays.filter(x=>x.id!==ov.id); renderLegend(); render();
    });
    item.appendChild(sw); item.appendChild(lbl); item.appendChild(op); item.appendChild(opVal); item.appendChild(del);
    el.appendChild(item);
  });
}

// Channels helpers
function channelPath(aId, bId){
  const order = presentRowOrder();
  const ai = order.indexOf(aId), bi = order.indexOf(bId);
  if(ai===-1 || bi===-1) return [];
  const path = []; const step = ai < bi ? 1 : -1;
  for(let i=ai; i!==bi; i+=step){
    const id1 = order[i], id2 = order[i+step];
    const top = order.indexOf(id1) < order.indexOf(id2) ? id1 : id2;
    const bottom = (top===id1) ? id2 : id1;
    path.push(`${top}-${bottom}`);
  }
  return path;
}
function otherEndOf(channelId, current){ const [x,y] = channelId.split('-'); return current===x ? y : x; }

// Draw
function ensureArrowDefs(s){
  if(s.querySelector('defs#arrowDefs')) return;
  const defs = elNS('defs'); defs.id='arrowDefs';
  const marker = elNS('marker');
  marker.setAttribute('id','arrow');
  marker.setAttribute('viewBox','0 0 10 10');
  marker.setAttribute('refX','8');
  marker.setAttribute('refY','5');
  marker.setAttribute('markerWidth','6');
  marker.setAttribute('markerHeight','6');
  marker.setAttribute('orient','auto');
  const path = elNS('path');
  path.setAttribute('d','M 0 0 L 10 5 L 0 10 z');
  path.setAttribute('fill','context-stroke');
  marker.appendChild(path);
  defs.appendChild(marker);
  s.appendChild(defs);
}

function render(){
  const s = svgEl(); if(!s) return; s.innerHTML='';
  const horizon = state.horizonSec = num($('horizon').value) || Math.max(60, maxCycle()+20);
  if(!$('horizon').value) $('horizon').value = String(horizon);
  const showMainGrid = state.showMainGrid = $('showMainGrid').checked;
  const width = s.clientWidth || s.parentElement.clientWidth || document.body.clientWidth || 960;
  const HEIGHT = rowY(presentRowOrder().length - 1) + BAND_HEIGHT + 80;
  s.setAttribute('height', String(HEIGHT));
  const xScale = t => 60 + (t/horizon)*(width - 60 - 10);

  ensureArrowDefs(s);

  // Main grid
  if(showMainGrid){
    for(let t=0;t<=horizon;t+=10){
      const ln=elNS('line'); setAttrs(ln,{x1:xScale(t),y1:8,x2:xScale(t),y2:HEIGHT-8,class:'gridLine'}); s.appendChild(ln);
      if(t%30===0){ const tx=elNS('text'); setAttrs(tx,{x:xScale(t)+2,y:12,class:'axisLabel'}); tx.textContent=`${t}s`; s.appendChild(tx); }
    }
  }else{
    for(let t=0;t<=horizon;t+=30){
      const tx=elNS('text'); setAttrs(tx,{x:xScale(t)+2,y:12,class:'axisLabel'}); tx.textContent=`${t}s`; s.appendChild(tx);
    }
  }

  const order = presentRowOrder();
  // Rows
  order.forEach((id, rowIndex)=>{
    const j = getJ(id);
    alignIntergreens(j);
    const yTop = rowY(rowIndex);
    const yBandTop = yTop+10, yBandBot = yBandTop+BAND_HEIGHT;
    const lbl = elNS('text'); setAttrs(lbl,{x:10,y:yTop+ROW_LABEL_YOFF,class:'rowLabel'}); lbl.textContent=j.name; s.appendChild(lbl);
    // Offset under label
    const offlbl = elNS('text'); setAttrs(offlbl,{x:10,y:yTop+ROW_LABEL_YOFF+12,class:'offsetLabel'}); offlbl.textContent = `Offset: ${j.startTimeSec||0}s`; s.appendChild(offlbl);

    // 1s ticks
    for(let t=0;t<=horizon;t+=1){
      const x = xScale(t);
      const s1=elNS('line'); setAttrs(s1,{x1:x,y1:yBandTop-3,x2:x,y2:yBandTop,class:'tick1'}); s.appendChild(s1);
      const s2=elNS('line'); setAttrs(s2,{x1:x,y1:yBandBot,x2:x,y2:yBandBot+3,class:'tick1'}); s.appendChild(s2);
    }
    // 5s ticks
    for(let t=0;t<=horizon;t+=5){
      const x = xScale(t);
      const t1=elNS('line'); setAttrs(t1,{x1:x,y1:yBandTop-6,x2:x,y2:yBandTop,class:'tick5'}); s.appendChild(t1);
      const t2=elNS('line'); setAttrs(t2,{x1:x,y1:yBandBot,x2:x,y2:yBandBot+6,class:'tick5'}); s.appendChild(t2);
    }

    // Stage tiles
    const tiles = tileBands(j, horizon);
    for(const b of tiles){
      const rect = elNS('rect');
      const x = xScale(Math.max(0,b.startAbs));
      const x2 = xScale(Math.min(horizon,b.endAbs));
      const w = Math.max(0,x2-x);
      if(b.type==='stage'){
        setAttrs(rect,{x:x,y:yBandTop,width:w,height:BAND_HEIGHT,class:'stageRect'});
        rect.setAttribute('fill', stageFill(b.index||0));
      }else{
        setAttrs(rect,{x:x,y:yBandTop,width:w,height:BAND_HEIGHT,class:'intergreenRect'});
      }
      s.appendChild(rect);
      if(b.label && b.type==='stage' && w>24){
        const t=elNS('text'); setAttrs(t,{x:x+w/2,y:yBandTop+BAND_HEIGHT/2,class:'stageLabel'}); t.textContent=b.label; s.appendChild(t);
      }
    }

    // Stage start/end labels (local clock)
    if(j.cycleTimeSec && j.cycleTimeSec>0){
      const Cj=j.cycleTimeSec, t0=j.startTimeSec||0;
      const tTiles = tileBands(j, horizon).filter(b=>b.type==='stage');
      for(const b of tTiles){
        const xStart = xScale(Math.max(0,b.startAbs));
        const xEnd   = xScale(Math.min(horizon,b.endAbs));
        const startLocal = posMod(b.startAbs - t0, Cj);
        const endLocal   = posMod(b.endAbs   - t0, Cj);
        const ty = yBandTop-8;
        const tS=elNS('text'); setAttrs(tS,{x:xStart,y:ty,class:'stageTimeLabel'}); tS.textContent=`${startLocal}s`; s.appendChild(tS);
        const tE=elNS('text'); setAttrs(tE,{x:xEnd,y:ty,class:'stageTimeLabel'}); tE.textContent=`${endLocal}s`; s.appendChild(tE);
      }
    }

    // Per-row cycle markers & bottom labels aligned to start offset
    if(j.cycleTimeSec && j.cycleTimeSec > 0){
      const Cj = j.cycleTimeSec;
      const t0 = j.startTimeSec || 0;
      let first = t0;
      while(first < 0) first += Cj;
      while(first - Cj >= 0) first -= Cj;
      for(let tt=first; tt<=horizon; tt+=Cj){
        if(tt <= 0) continue;
        const xl = xScale(tt);
        const ln = elNS('line');
        setAttrs(ln,{x1:xl,y1:yBandTop-6,x2:xl,y2:yBandBot+6,class:'gridLine'});
        ln.setAttribute('stroke','#e53935');
        ln.setAttribute('stroke-width','2');
        s.appendChild(ln);
      }
      const yBottomLbl = yBandBot + 16;
      let lab = t0;
      while(lab < 0) lab += 5;
      while(lab - 5 >= 0) lab -= 5;
      for(let tt=lab; tt<=horizon; tt+=5){
        const tx = elNS('text'); setAttrs(tx,{x:xScale(tt)+2,y:yBottomLbl,class:'axisLabel'});
        tx.textContent = String(posMod(tt - t0, Cj)) + 's';
        s.appendChild(tx);
      }
    }
  });

  // Channel 10s grids
  for(let i=0;i<order.length-1;i++){
    const ch = channelBox(i);
    for(let t=0;t<=horizon;t+=10){
      const ln=elNS('line'); setAttrs(ln,{x1:xScale(t),y1:ch.y0,x2:xScale(t),y2:ch.y1,class:'channelGrid'}); s.appendChild(ln);
    }
  }

  // Overlays — stage + custom; custom aligned to origin cycle
  state.overlays.forEach(ov=>{
    const origin = getJ(ov.origin.junc), dest = getJ(ov.dest.junc);
    if(!origin || !dest) return;
    const path = channelPath(origin.id, dest.id); if(path.length===0) return;

    const tilesCustom = () => {
      const j = origin;
      let tiles=[];
      if(!j) return tiles;
      if(ov.repeatCycle){
        const C = j.cycleTimeSec||0; const H = state.horizonSec;
        if(C>0){
          let cStart = j.startTimeSec||0;
          while(cStart>0) cStart -= C; while(cStart + C < 0) cStart += C;
          while(cStart < H){
            tiles.push({startAbs:cStart + ov.origin.tStart, endAbs:cStart + ov.origin.tEnd});
            cStart += C;
          }
        }else{
          tiles=[{startAbs:ov.origin.tStart, endAbs:ov.origin.tEnd}];
        }
      }else{
        tiles=[{startAbs:ov.origin.tStart, endAbs:ov.origin.tEnd}];
      }
      return tiles;
    };

    let tiles;
    if(ov.type==='custom'){
      tiles = tilesCustom();
    }else{
      tiles = tileBands(origin, horizon).filter(b=>b.type==='stage' && b.label===origin.stages[ov.origin.stageIndex]?.label)
              .map(b=>({startAbs:b.startAbs, endAbs:b.endAbs}));
    }

    // Overrun handling
    if(state.overrunMode==='skip'){
      tiles = tiles.filter(b=>b.startAbs>=0 && b.endAbs<=horizon);
    }else{
      tiles = tiles.filter(b=>b.endAbs>0 && b.startAbs<horizon);
    }

    const xScaleLocal = (t)=> 60 + (t/horizon)*(svgEl().clientWidth - 60 - 10);

    const hopDraw = (t0, fromId, hopId, color, opacity, isBack=false) => {
      const toId = otherEndOf(hopId, fromId);
      const key = `${fromId}->${toId}`;
      if(!(key in state.journeys)) return {t1:t0, yStart:null, yEnd:null};
      const t1 = t0 + state.journeys[key];
      const orderList = presentRowOrder();
      const [hA,hB] = hopId.split('-');
      const i = Math.min(orderList.indexOf(hA), orderList.indexOf(hB));
      const ch = channelBox(i);
      const fromAbove = orderList.indexOf(fromId) < orderList.indexOf(toId);
      const yStart = fromAbove ? ch.y0 : ch.y1;
      const yEnd   = fromAbove ? ch.y1 : ch.y0;
      const x1 = xScaleLocal(clamp(t0,0,horizon));
      const x2 = xScaleLocal(clamp(t1,0,horizon));
      const line = elNS('line');
      setAttrs(line,{x1:x1,y1:yStart,x2:x2,y2:yEnd,class:`coordLine ${isBack?'back':''}`});
      line.style.stroke = color; line.style.opacity = (typeof opacity==='number'? opacity : 0.8);
      line.setAttribute('marker-end','url(#arrow)');
      s.appendChild(line);
      return {t1, yStart, yEnd};
    };

    tiles.forEach(seg => {
      const tFront = clamp(seg.startAbs, 0, horizon);
      const tBack  = clamp(seg.endAbs,   0, horizon);

      // interval shading + back/front lines
      let tf = tFront, tb = tBack, fromF = origin.id, fromB = origin.id;
      const quads = [];
      for(const hop of path){
        const resF = hopDraw(tf, fromF, hop, ov.color, ov.opacity, false);
        const resB = hopDraw(tb, fromB, hop, ov.color, ov.opacity, true);
        if(resF.yStart!==null && resB.yStart!==null){
          quads.push({ x1:xScaleLocal(tf), y1:resF.yStart, x2:xScaleLocal(resF.t1), y2:resF.yEnd,
                       x3:xScaleLocal(resB.t1), y3:resB.yEnd, x4:xScaleLocal(tb), y4:resB.yStart });
        }
        tf = resF.t1; tb = resB.t1;
        fromF = otherEndOf(hop, fromF); fromB = otherEndOf(hop, fromB);
      }
      quads.forEach(q=>{
        const poly = elNS('polygon');
        const pts = `${q.x1},${q.y1} ${q.x2},${q.y2} ${q.x3},${q.y3} ${q.x4},${q.y4}`;
        setAttrs(poly,{points:pts}); poly.setAttribute('fill', ov.color); poly.setAttribute('opacity','0.18'); svgEl().appendChild(poly);
      });

      // Arrival window band on destination
      const destRowIdx = presentRowOrder().indexOf(dest.id);
      const yTop = rowY(destRowIdx)+10;
      const x0Abs = Math.min(tf,tb), x1Abs = Math.max(tf,tb);
      const rect = elNS('rect');
      setAttrs(rect,{x:xScaleLocal(x0Abs),y:yTop,width:Math.max(0,xScaleLocal(x1Abs)-xScaleLocal(x0Abs)),height:BAND_HEIGHT,class:'arrivalHighlight'});
      rect.style.fill = ov.color; rect.style.opacity = Math.max(0.05, 0.35 * (typeof ov.opacity==='number'? ov.opacity : 0.8));
      svgEl().appendChild(rect);
    });
  });

  // Travel-time indicators per channel
  for(let i=0;i<order.length-1;i++){
    const from = order[i], to = order[i+1];
    const ch = channelBox(i);
    const midY = ch.mid;
    const leftX = 48;
    const rightX = (svgEl().clientWidth || 960) - 16;
    const keyF = `${from}->${to}`;
    const keyR = `${to}->${from}`;
    if(state.journeys[keyF] != null){
      const t=elNS('text'); setAttrs(t,{x:leftX,y:midY,class:'channelTT'});
      t.textContent = `${from}↓${to} ${state.journeys[keyF]}s`; s.appendChild(t);
    }
    if(state.journeys[keyR] != null){
      const t=elNS('text'); setAttrs(t,{x:rightX,y:midY,class:'channelTT'});
      t.setAttribute('text-anchor','end');
      t.textContent = `${state.journeys[keyR]}s ${to}↑${from}`; s.appendChild(t);
    }
  }

  // Data tab

function updateTotalsForJunction(id){
  const j = getJ(id); if(!j) return;
  const stSum = (j.stages||[]).reduce((a,b)=> a + (num(b.durationSec)), 0);
  const igSum = (j.intergreens||[]).reduce((a,b)=> a + (num(b.durationSec)), 0);
  const totEl = document.getElementById('tot_'+id);
  if(totEl){ totEl.textContent = `Total used: ${stSum + igSum}s (stages ${stSum}s + intergreens ${igSum}s) / cycle ${j.cycleTimeSec}s`; }
}
 validation hint
  updateDataValidation();
}

// Validate button (on Data tab)
$('validateBtn').addEventListener('click', updateDataValidation);

// Export/Import/TD
$('exportBtn').addEventListener('click', ()=>{
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'signals-config-v1.json'; a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
});
$('importInput').addEventListener('change', (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    try{
      const obj = JSON.parse(r.result);
      state.junctions = obj.junctions ?? state.junctions;
      state.journeys = obj.journeys ?? state.journeys;
      state.horizonSec = obj.horizonSec ?? state.horizonSec;
      state.overlays = obj.overlays ?? state.overlays;
      state.overrunMode = obj.overrunMode ?? state.overrunMode;
      renderJunctionList(); rebuildJourneyMatrix(); refreshOverlayPickers(); setDefaultHorizon(); renderLegend(); render();
      updateDataValidation();
      document.querySelector('[data-tab=\"plotTab\"]')?.click();
    }catch(err){
      const out = document.getElementById('dataValidation');
      if(out) out.innerHTML = `<div class="bad">Import failed: ${err.message}</div>`;
    }
  };
  r.readAsText(f);
});
$('saveTdBtn').addEventListener('click', ()=>{
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'signal-plan-checker.td'; a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
});
$('loadTdInput').addEventListener('change', (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    try{
      const obj = JSON.parse(r.result);
      state.junctions = obj.junctions ?? state.junctions;
      state.journeys = obj.journeys ?? state.journeys;
      state.horizonSec = obj.horizonSec ?? state.horizonSec;
      state.overlays = obj.overlays ?? state.overlays;
      state.overrunMode = obj.overrunMode ?? state.overrunMode;
      renderJunctionList(); rebuildJourneyMatrix(); refreshOverlayPickers(); setDefaultHorizon(); renderLegend(); render();
      updateDataValidation();
      document.querySelector('[data-tab=\"plotTab\"]')?.click();
    }catch(err){
      const out = document.getElementById('dataValidation');
      if(out) out.innerHTML = `<div class="bad">TD load failed: ${err.message}</div>`;
    }
  };
  r.readAsText(f);
});

// iPad/Safari guards
window.addEventListener('keydown', (e)=>{
  const t = e.target;
  if(e.key === 'Enter' && (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'))){
    e.preventDefault();
  }
}, {capture:true});
document.addEventListener('keydown', function(e){
  const t = e.target;
  const inEditable = t && (t.tagName==='INPUT' || t.tagName==='TEXTAREA' || t.isContentEditable);
  if((e.key==='Backspace' || e.key==='Delete')){
    e.stopPropagation();
    if(!inEditable){ e.preventDefault(); }
  }
}, {capture:true});

// Print preview
function paperSizeMm(paper){
  switch(paper){
    case 'A3': return {w: 297, h: 420};
    case 'A4': return {w: 210, h: 297};
    case 'Legal': return {w: 215.9, h: 355.6};
    case 'Letter': default: return {w: 215.9, h: 279.4};
  }
}
function openPreview(){
  const paper = document.getElementById('printPaper').value;
  const orient = document.getElementById('printOrientation').value;
  const margins = document.getElementById('printMargins').value;
  const legendOn = document.getElementById('printLegend').checked;
  const readoutOn = document.getElementById('printReadout').checked;
  const scalePct = Number(document.getElementById('printScale').value||'100');
  const title = (document.getElementById('printTitle').value||'').trim();
  const notes = (document.getElementById('printNotes').value||'').trim();

  const mm = paperSizeMm(paper);
  const pageWmm = orient==='landscape' ? mm.h : mm.w;
  const pageHmm = orient==='landscape' ? mm.w : mm.h;
  const marginMap = { default: 10, none: 0, narrow: 6, wide: 20 };
  const marginMm = marginMap[margins] ?? 10;

  const s = svgEl().cloneNode(true);
  const w = window.open('', '_blank');
  const css = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
    #page{{width:${{pageWmm}}mm;height:${{pageHmm}}mm;margin:0 auto;display:flex;align-items:stretch;justify-content:center;padding:${{marginMm}}mm}}
    #sheet{{width:100%;height:100%;display:flex;flex-direction:column}}
    #plotHolder{{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden}}
    svg{{max-width:100%;max-height:100%}}
    @page {{ size: ${paper} ${orient}; margin: 0; }}
    @media print{{ body{{-webkit-print-color-adjust:exact; print-color-adjust:exact}} }}`.replaceAll('{{','{').replaceAll('}}','}');

  const manualScale = Math.max(0.5, Math.min(2.0, scalePct/100));
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Print Preview</title><style>${css}</style></head><body>
    <div id="page"><div id="sheet"><div id="plotHolder"></div></div></div>
    <script>
      (function(){ const holder=document.getElementById('plotHolder'); const svg=${JSON.stringify('')};
        holder.appendChild(window.opener.document.getElementById('diagram').cloneNode(true));
        const s=holder.querySelector('svg');
        function fit(){ const bw=holder.clientWidth,bh=holder.clientHeight;
          const bb=s.getBBox? s.getBBox(): null; const sw=(bb&&bb.width)?bb.width:s.getBoundingClientRect().width||bw;
          const sh=(bb&&bb.height)?bb.height:s.getBoundingClientRect().height||bh; const k=Math.min(bw/sw, bh/sh)*${manualScale};
          s.style.transformOrigin='center center'; s.style.transform='scale('+k+')'; }
        window.addEventListener('load', fit); window.addEventListener('resize', fit); setTimeout(fit,80); setTimeout(()=>window.print(), 140);
      })();
    </script></body></html>`;
  w.document.open(); w.document.write(html); w.document.close();
}
document.getElementById('previewBtn')?.addEventListener('click', openPreview);

// Seed: valid by default
function seed(){
  ['A','B','C','D'].forEach(id=> addJunction(id));
  // Sample journey times both ways
  state.journeys['A->B']=22; state.journeys['B->A']=24;
  state.journeys['B->C']=26; state.journeys['C->B']=23;
  state.journeys['C->D']=28; state.journeys['D->C']=29;
  setDefaultHorizon(); refreshOverlayPickers(); renderLegend(); updateDataValidation();
  // Render after layout settles to ensure full-width
  requestAnimationFrame(()=> render());
  window.addEventListener('resize', ()=> requestAnimationFrame(()=> render()));
}
document.addEventListener('DOMContentLoaded', ()=>{
  attachSanitizers();
  seed();
});
// Track manual horizon edits (render on blur/change and while typing if desired)
(function(){
  const h = document.getElementById('horizon');
  if(!h) return;
  const commit = ()=>{ state.horizonIsDefault = false; state.horizonSec = num(h.value)||Math.max(60, maxCycle()+20); render(); };
  h.addEventListener('blur', commit);
  h.addEventListener('change', commit);
})();        


// Plot button: validate and render
document.getElementById('plotBtn')?.addEventListener('click', ()=>{
  const errs = validate();
  const dataOut = document.getElementById('dataValidation');
  if(errs.length){
    if(dataOut) dataOut.innerHTML = `<div class="bad"><strong>Fix these first:</strong><ul>${errs.map(e=>`<li>${e}</li>`).join('')}</ul></div>`;
  }
  render();
});
