// v3 repeat + shade: repeating overlays each occurrence + hop shading @15%, stage-end points, 5s ticks, auto horizon
const MAX_JUNCTIONS = 4;
const DEFAULT_IDS = ['A','B','C','D'];
const svg = () => document.getElementById('diagram');
const readoutEl = () => document.getElementById('readout');
const legendEl = () => document.getElementById('legend');
function $(id){ return document.getElementById(id); }
function elNS(tag){ return document.createElementNS('http://www.w3.org/2000/svg', tag); }
function setAttrs(ele, attrs){ for(const k in attrs) ele.setAttribute(k, attrs[k]); return ele; }
const sum = (arr, f=x=>x) => arr.reduce((a,b)=>a+f(b),0);

const state = {
  junctions: [], journeys: {}, horizonSec: 600, overlays: [],
  rowOrder: ['A','B','C','D'], showMainGrid: true, overrunMode: 'skip',
};

// Tabs
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tabPanel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Helpers
function getJ(id){ return state.junctions.find(j=>j.id===id); }
function presentRowOrder(){ return state.rowOrder.filter(id => !!getJ(id)); }
function maxCycle(){ return Math.max(...state.junctions.map(j=>j.cycleTimeSec||0), 0); }
function setDefaultHorizon(){ const def = Math.max(60, 3 * maxCycle()); const inp=$('horizon'); if(inp && !inp.value) inp.value = String(def); }

// Data tab
function addJunction(id){
  if(state.junctions.length >= MAX_JUNCTIONS) return;
  const j = { id, name:`Junction ${id}`, cycleTimeSec:90, startTimeSec:0,
    stages:[{label:`${id}1`,durationSec:30},{label:`${id}2`,durationSec:40},{label:`${id}3`,durationSec:10}],
    intergreens:[{durationSec:5},{durationSec:3},{durationSec:2}] };
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
  const container = $('junctionList'); container.innerHTML='';
  state.junctions.forEach((j)=>{
    const card = document.createElement('div'); card.className='junctionCard';
    card.innerHTML = `
      <div class="junctionRow">
        <label>Id <input value="${j.id}" disabled/></label>
        <label>Name <input data-bind="name" data-id="${j.id}" value="${j.name}"/></label>
        <label>Start offset (s) <input data-bind="start" data-id="${j.id}" type="number" value="${j.startTimeSec}"/></label>
      </div>
      <div class="junctionRow">
        <label>Cycle time (s) <input data-bind="cycle" data-id="${j.id}" type="number" min="1" value="${j.cycleTimeSec}"/></label>
      </div>
      <h4>Stages</h4>
      <table class="stagesTable">
        <thead><tr><th>Label</th><th>Duration (s)</th><th>Intergreen after (s)</th><th></th></tr></thead>
        <tbody id="stBody_${j.id}"></tbody>
      </table>
      <div class="stageBtns">
        <button class="small" data-add-stage="${j.id}">+ Add stage</button>
        ${state.junctions.length>2 ? `<button class="small" data-remove-j="${j.id}">Remove junction</button>` : ''}
      </div>`;
    container.appendChild(card);
    const tbody = card.querySelector(`#stBody_${j.id}`);
    j.stages.forEach((s,i)=>{
      const tr = document.createElement('tr');
      const ig = j.intergreens[i]?.durationSec ?? 0;
      tr.innerHTML = `<td><input data-st="label" data-id="${j.id}" data-idx="${i}" value="${s.label}"/></td>
                      <td><input type="number" min="1" data-st="dur" data-id="${j.id}" data-idx="${i}" value="${s.durationSec}"/></td>
                      <td><input type="number" min="0" data-st="ig" data-id="${j.id}" data-idx="${i}" value="${ig}"/></td>
                      <td><button class="small" data-del-stage="${j.id}" data-idx="${i}">✕</button></td>`;
      tbody.appendChild(tr);
    });
  });
  container.querySelectorAll('input[data-bind]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const j = getJ(inp.dataset.id); if(!j) return;
      if(inp.dataset.bind==='name') j.name = inp.value;
      if(inp.dataset.bind==='start') j.startTimeSec = Number(inp.value);
      if(inp.dataset.bind==='cycle') j.cycleTimeSec = Number(inp.value);
      rebuildJourneyMatrix(); refreshOverlayPickers(); setDefaultHorizon(); render();
    });
  });
  container.querySelectorAll('input[data-st]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const j = getJ(inp.dataset.id); const idx = Number(inp.dataset.idx);
      if(inp.dataset.st==='label') j.stages[idx].label = inp.value;
      if(inp.dataset.st==='dur') j.stages[idx].durationSec = Number(inp.value);
      if(inp.dataset.st==='ig') j.intergreens[idx].durationSec = Number(inp.value);
      refreshOverlayPickers(); render();
    });
  });
  container.querySelectorAll('[data-add-stage]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const j = getJ(btn.dataset.addStage);
      const n = j.stages.length+1;
      j.stages.push({label:`${j.id}${n}`, durationSec:10});
      j.intergreens.push({durationSec:2});
      renderJunctionList();
    });
  });
  container.querySelectorAll('[data-del-stage]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const j = getJ(btn.dataset.delStage); const idx = Number(btn.dataset.idx);
      j.stages.splice(idx,1); j.intergreens.splice(idx,1);
      renderJunctionList(); refreshOverlayPickers(); render();
    });
  });
  container.querySelectorAll('[data-remove-j]').forEach(btn=>{
    btn.addEventListener('click', ()=> removeJunction(btn.dataset.removeJ));
  });
}
$('addJunctionBtn').addEventListener('click', ()=>{
  const next = DEFAULT_IDS.find(id => !getJ(id));
  if(next) addJunction(next);
});

function rebuildJourneyMatrix(){
  const cont = $('journeyMatrix'); cont.innerHTML = '';
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
        row += `<td><input data-journey="${key}" type="number" min="0" value="${val}" /></td>`;
      }
    });
    tr.innerHTML = row; tbody.appendChild(tr);
  });
  table.appendChild(tbody); cont.appendChild(table);
  cont.querySelectorAll('input[data-journey]').forEach(inp=>{
    inp.addEventListener('input', ()=>{ state.journeys[inp.dataset.journey] = Number(inp.value); render(); });
  });
}

// Validation
function validate(){
  const errors = [];
  if(state.junctions.length<2) errors.push('Add at least two junctions.');
  state.junctions.forEach(j=>{
    if(j.stages.length===0) errors.push(`${j.name}: add at least one stage.`);
    if(j.intergreens.length!==j.stages.length) errors.push(`${j.name}: intergreens count must match stages count.`);
    if(j.cycleTimeSec<=0) errors.push(`${j.name}: cycle time must be > 0.`);
    const total = sum(j.stages, s=>s.durationSec) + sum(j.intergreens, ig=>ig.durationSec);
    if(total !== j.cycleTimeSec) errors.push(`${j.name}: stages + intergreens (${total}s) must equal cycle (${j.cycleTimeSec}s).`);
  });
  return errors;
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
  while(cycleStart<end){ const bands=bandsOneCycle(j); for(const b of bands){ tiles.push({type:b.type,label:b.label,startAbs:cycleStart+b.start,endAbs:cycleStart+b.end}); } cycleStart+=cycle; }
  return tiles.filter(b=>b.endAbs>=start && b.startAbs<=end);
}

// Plot geometry
const MARGIN_LEFT=60, MARGIN_TOP=20, BAND_HEIGHT=30, ROW_GAP=120, ROW_LABEL_YOFF=18;
function rowY(index){ return MARGIN_TOP + index*(BAND_HEIGHT + ROW_GAP); }
function channelBox(i){
  const yTop = rowY(i) + 10 + BAND_HEIGHT + 10;
  const yBot = rowY(i+1) - 10;
  return {y0:yTop, y1:yBot, mid:(yTop+yBot)/2};
}

// Overlays
function refreshOverlayPickers(){
  const o = $('ovOrigin'), d = $('ovDest'), s = $('ovStage');
  if(!o || !d || !s) return;
  o.innerHTML=''; d.innerHTML=''; s.innerHTML='';
  presentRowOrder().forEach(id=>{
    const j = getJ(id); if(!j) return;
    const o1=document.createElement('option'); o1.value=id; o1.textContent=j.name; o.appendChild(o1);
    const d1=document.createElement('option'); d1.value=id; d1.textContent=j.name; d.appendChild(d1);
  });
  const j0 = getJ(presentRowOrder()[0]);
  j0?.stages.forEach((st,i)=>{
    const opt=document.createElement('option'); opt.value=String(i); opt.textContent=st.label; s.appendChild(opt);
  });
}
$('ovOrigin').addEventListener('change', ()=>{
  const s = $('ovStage'); s.innerHTML='';
  const j = getJ($('ovOrigin').value);
  j?.stages.forEach((st,i)=>{ const opt=document.createElement('option'); opt.value=String(i); opt.textContent=st.label; s.appendChild(opt); });
});

$('addOverlayBtn').addEventListener('click', ()=>{
  const origin = $('ovOrigin').value;
  const dest = $('ovDest').value;
  const stageIndex = Number($('ovStage').value);
  const mode = $('ovMode').value;
  const color = $('ovColor').value;
  const opacity = Number(document.getElementById('ovOpacity').value || 0.8);
  if(origin===dest){ readoutEl().innerHTML = '<div class="bad">Origin and destination must differ.</div>'; return; }
  const id = `ov${Date.now()}${Math.floor(Math.random()*1000)}`;
  state.overlays.push({ id, origin:{ junc: origin, stageIndex, mode }, dest:{ junc: dest }, color, opacity, showFrontBack:true, showArrivalWindow:true, laneOffset:0 });
  renderLegend(); render();
});

function renderLegend(){
  const el = legendEl(); el.innerHTML='';
  state.overlays.forEach(ov=>{
    const item=document.createElement('div'); item.className='item';
    const sw=document.createElement('span'); sw.className='swatch'; sw.style.background=ov.color;
    const path = channelPath(ov.origin.junc, ov.dest.junc); const pathTag = path.length? ` (${path.join(', ')})` : '';
    const lbl=document.createElement('span'); lbl.textContent = `${getJ(ov.origin.junc)?.name}:${getJ(ov.origin.junc)?.stages[ov.origin.stageIndex]?.label} → ${getJ(ov.dest.junc)?.name}${pathTag}`;
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

// Channels
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

// TD save/load
function buildTdPayload(){
  return { version:'v3-td-1', junctions:state.junctions, journeys:state.journeys, horizonSec:state.horizonSec, rowOrder:state.rowOrder, overlays:state.overlays, showMainGrid:state.showMainGrid };
}
function loadTdPayload(obj){
  if(!obj || typeof obj!=='object') throw new Error('Invalid TD file.');
  state.junctions = obj.junctions ?? state.junctions;
  state.journeys = obj.journeys ?? state.journeys;
  state.horizonSec = obj.horizonSec ?? state.horizonSec;
  state.rowOrder = obj.rowOrder ?? state.rowOrder;
  state.overlays = obj.overlays ?? state.overlays;
  state.showMainGrid = obj.showMainGrid ?? state.showMainGrid;
  renderJunctionList(); rebuildJourneyMatrix(); refreshOverlayPickers(); setDefaultHorizon(); renderLegend(); render();
}
document.getElementById('saveTdBtn').addEventListener('click', ()=>{
  const payload = JSON.stringify(buildTdPayload(), null, 2);
  const blob = new Blob([payload], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'timing-diagram.td'; a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
});
document.getElementById('loadTdInput').addEventListener('change', (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{ try{ const obj = JSON.parse(r.result); loadTdPayload(obj); } catch(err){ readoutEl().innerHTML = `<div class="bad">TD load failed: ${err.message}</div>`; } };
  r.readAsText(f);
});

// Draw
function render(){
  const s = svg(); s.innerHTML='';
  setDefaultHorizon();
  const horizon = state.horizonSec = Number($('horizon').value) || Math.max(60, 3*maxCycle());
  const showMainGrid = state.showMainGrid = $('showMainGrid').checked;
  const width = s.clientWidth || s.parentElement.clientWidth || 960;
  const HEIGHT = rowY(presentRowOrder().length - 1) + BAND_HEIGHT + 80;
  s.setAttribute('height', String(HEIGHT));
  const xScale = t => MARGIN_LEFT + (t/horizon)*(width - MARGIN_LEFT - 10);

  // Main grid
  if(showMainGrid){
    for(let t=0;t<=horizon;t+=10){
      const ln=elNS('line'); setAttrs(ln,{x1:xScale(t),y1:MARGIN_TOP/2,x2:xScale(t),y2:HEIGHT-MARGIN_TOP/2,class:'gridLine'}); s.appendChild(ln);
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
    const yTop = rowY(rowIndex);
    const yBandTop = yTop+10, yBandBot = yBandTop+BAND_HEIGHT;
    const lbl = elNS('text'); setAttrs(lbl,{x:10,y:yTop+ROW_LABEL_YOFF,class:'rowLabel'}); lbl.textContent=j.name; s.appendChild(lbl);

    // 5s ticks above and below the band (black)
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
      setAttrs(rect,{x:x,y:yBandTop,width:w,height:BAND_HEIGHT,class:b.type==='stage'?'stageRect':'intergreenRect'}); s.appendChild(rect);
      if(b.label && b.type==='stage' && w>24){
        const t=elNS('text'); setAttrs(t,{x:x+w/2,y:yBandTop+BAND_HEIGHT/2,class:'stageLabel'}); t.textContent=b.label; s.appendChild(t);
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

  // Overlays — repeat for all occurrences; shade interval area per hop (15%)
  state.overlays.forEach(ov=>{
    const origin = getJ(ov.origin.junc), dest = getJ(ov.dest.junc);
    if(!origin || !dest) return;
    const path = channelPath(origin.id, dest.id); if(path.length===0) return;
    const tiles = (state.overrunMode==='skip')
      ? tileBands(origin, horizon).filter(b=>b.type==='stage' && b.label===origin.stages[ov.origin.stageIndex]?.label && b.startAbs>=0 && b.endAbs<=horizon)
      : tileBands(origin, horizon).filter(b=>b.type==='stage' && b.label===origin.stages[ov.origin.stageIndex]?.label && b.endAbs>0 && b.startAbs<horizon);
    const mode = ov.origin.mode;

    const hopDraw = (t0, fromId, hopId, color, isBack=false) => {
      const toId = otherEndOf(hopId, fromId);
      const key = `${fromId}->${toId}`;
      if(!(key in state.journeys)) return {t1:t0, yStart:null, yEnd:null};
      const t1 = t0 + state.journeys[key];
      const order = presentRowOrder();
      const [hA,hB] = hopId.split('-');
      const i = Math.min(order.indexOf(hA), order.indexOf(hB));
      const ch = channelBox(i);
      const fromAbove = order.indexOf(fromId) < order.indexOf(toId);
      const offset = (typeof (ov.laneOffset||0) === 'number') ? (ov.laneOffset||0) : 0;
      const yStart = fromAbove ? (ch.y0 + offset) : (ch.y1 + offset);
      const yEnd   = fromAbove ? (ch.y1 + offset) : (ch.y0 + offset);
      const line = elNS('line');
      setAttrs(line,{x1:xScale(t0),y1:yStart,x2:xScale(t1),y2:yEnd,class:`coordLine ${isBack?'back':''}`});
      line.style.stroke = ov.color; line.style.opacity = (typeof ov.opacity==='number'? ov.opacity : 0.8);
      s.appendChild(line);
      return {t1, yStart, yEnd};
    };

    tiles.forEach(match => {
      const tFront = Math.max(0, match.startAbs);
      const tBack  = Math.min(horizon, match.endAbs);
      if(mode==='point' || mode==='pointEnd'){
        const tStartOrEnd = (mode==='point') ? tFront : tBack;
        let t = tStartOrEnd, from = origin.id;
        for(const hop of path){
          const res = hopDraw(t, from, hop, ov.color, false);
          t = res.t1; from = otherEndOf(hop, from);
        }
      }else{ // interval with shading per hop
        let tf = tFront, tb = tBack, fromF = origin.id, fromB = origin.id;
        const quads = [];
        for(const hop of path){
          const resF = hopDraw(tf, fromF, hop, ov.color, false);
          const resB = hopDraw(tb, fromB, hop, ov.color, true);
          if(resF.yStart!==null && resB.yStart!==null){
            quads.push({ x1:xScale(tf), y1:resF.yStart, x2:xScale(resF.t1), y2:resF.yEnd,
                         x3:xScale(resB.t1), y3:resB.yEnd, x4:xScale(tb), y4:resB.yStart });
          }
          tf = resF.t1; tb = resB.t1;
          fromF = otherEndOf(hop, fromF); fromB = otherEndOf(hop, fromB);
        }
        quads.forEach(q=>{
          const poly = elNS('polygon');
          const pts = `${q.x1},${q.y1} ${q.x2},${q.y2} ${q.x3},${q.y3} ${q.x4},${q.y4}`;
          setAttrs(poly,{points:pts}); poly.setAttribute('fill', ov.color); poly.setAttribute('opacity','0.15'); s.appendChild(poly);
        });
        // Destination arrival window (kept)
        const rowIndex = presentRowOrder().indexOf(dest.id);
        const yTop = rowY(rowIndex)+10;
        const x0Abs = Math.max(0, Math.min(tf,tb));
        const x1Abs = Math.min(horizon, Math.max(tf,tb));
        const rect = elNS('rect');
        setAttrs(rect,{x:xScale(x0Abs),y:yTop,width:Math.max(0,xScale(x1Abs)-xScale(x0Abs)),height:BAND_HEIGHT,class:'arrivalHighlight'});
        rect.style.fill = ov.color; rect.style.opacity = Math.max(0.05, 0.35 * (typeof ov.opacity==='number'? ov.opacity : 0.8));
        s.appendChild(rect);
      }
    });
  });

  readoutEl().innerHTML = state.overlays.length
    ? `<div>${state.overlays.length} overlay(s) rendered across all occurrences.</div>`
    : `<div>Tip: add overlays to draw journey lines in the channels. Horizon defaults to 3×max(cycle).</div>`;
}

// Buttons
$('plotBtn').addEventListener('click', ()=>{
  const errors = validate();
  if(errors.length){
    readoutEl().innerHTML = `<div class="bad"><strong>Fix these first:</strong><ul>${errors.map(e=>`<li>${e}</li>`).join('')}</ul></div>`;
    return;
  }
  render();
});
$('validateBtn').addEventListener('click', ()=>{
  const errors = validate();
  if(errors.length) readoutEl().innerHTML = `<div class="bad"><strong>Fix these first:</strong><ul>${errors.map(e=>`<li>${e}</li>`).join('')}</ul></div>`;
  else readoutEl().innerHTML = `<div class="good">Config looks valid ✔️</div>`;
});
$('exportBtn').addEventListener('click', ()=>{
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'signals-config-v3.json'; a.click();
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
      renderJunctionList(); rebuildJourneyMatrix(); refreshOverlayPickers(); setDefaultHorizon(); renderLegend(); render();
      readoutEl().innerHTML = `<div>Imported config.</div>`;
    }catch(err){
      readoutEl().innerHTML = `<div class="bad">Import failed: ${err.message}</div>`;
    }
  };
  r.readAsText(f);
});
$('showMainGrid').addEventListener('change', render);
$('overrunMode').addEventListener('change', ()=>{ state.overrunMode = $('overrunMode').value; render(); });

// Seed A..D and adjacent journeys
function seed(){
  ['A','B','C','D'].forEach(id=> addJunction(id));
  // Adjust B to 88s
  const JB = getJ('B'); JB.startTimeSec = 12; JB.cycleTimeSec = 88;
  JB.stages = [{label:'B1',durationSec:25},{label:'B2',durationSec:45},{label:'B3',durationSec:10}];
  JB.intergreens = [{durationSec:4},{durationSec:2},{durationSec:2}];
  // D timings (92)
  const JD = getJ('D'); JD.startTimeSec = 6; JD.cycleTimeSec = 92;
  JD.stages = [{label:'D1',durationSec:30},{label:'D2',durationSec:44},{label:'D3',durationSec:10}];
  JD.intergreens = [{durationSec:3},{durationSec:3},{durationSec:2}];
  // Journeys
  state.journeys['A->B']=22; state.journeys['B->A']=24;
  state.journeys['B->C']=26; state.journeys['C->B']=23;
  state.journeys['C->D']=28; state.journeys['D->C']=29;
  // Demo overlays (include interval to show shading)
  state.overlays.push({ id:'demo1', origin:{junc:'A',stageIndex:0,mode:'interval'}, dest:{junc:'B'}, color:'#ff5722', opacity:0.8, showFrontBack:true, showArrivalWindow:true });
  state.overlays.push({ id:'demo2', origin:{junc:'B',stageIndex:1,mode:'point'}, dest:{junc:'A'}, color:'#1e88e5', opacity:0.9, showFrontBack:true, showArrivalWindow:true });
  state.overlays.push({ id:'demo3', origin:{junc:'C',stageIndex:0,mode:'pointEnd'}, dest:{junc:'B'}, color:'#43a047', opacity:0.85, showFrontBack:true, showArrivalWindow:true });
  setDefaultHorizon(); renderLegend(); render();
}
seed();
