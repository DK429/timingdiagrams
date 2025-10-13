// Minimal, dependency-free implementation with coordination check

const svg = () => document.getElementById('diagram');
const readoutEl = () => document.getElementById('readout');

function $(id){ return document.getElementById(id); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function mod(n, m){ return ((n % m) + m) % m; }
function sum(arr, f = x=>x){ return arr.reduce((a,b)=>a+f(b),0); }
function elNS(tag){ return document.createElementNS('http://www.w3.org/2000/svg', tag); }
function setAttrs(ele, attrs){ for(const k in attrs) ele.setAttribute(k, attrs[k]); return ele; }

function readJunction(which){
  const prefix = which === 'A' ? 'A' : 'B';
  const name = $(`${prefix}_name`).value.trim() || `Junction ${which}`;
  const cycleTimeSec = Number($(`${prefix}_cycle`).value);
  const startTimeSec = Number($(`${prefix}_start`).value);
  const rows = document.querySelectorAll(`#${which}_stage_rows tr`);
  const stages = [];
  const intergreens = [];
  rows.forEach(r=>{
    const label = r.querySelector('.st_label').value || `${which}${stages.length+1}`;
    const dur = Number(r.querySelector('.st_dur').value);
    const ig = Number(r.querySelector('.ig_dur').value);
    stages.push({label, durationSec: dur});
    intergreens.push({durationSec: ig});
  });
  return { id: which, name, cycleTimeSec, startTimeSec, stages, intergreens };
}

function readConfig(){
  return {
    junctionA: readJunction('A'),
    junctionB: readJunction('B'),
    journeys: [
      { from: 'A', to: 'B', travelTimeSec: Number($('AB_travel').value) },
      { from: 'B', to: 'A', travelTimeSec: Number($('BA_travel').value) }
    ],
    diagram: { horizonSec: Number($('horizon').value) }
  };
}

function applyConfig(cfg){
  $('A_name').value = cfg.junctionA.name;
  $('A_cycle').value = cfg.junctionA.cycleTimeSec;
  $('A_start').value = cfg.junctionA.startTimeSec;
  setRows('A', cfg.junctionA.stages.length);
  cfg.junctionA.stages.forEach((s,i)=>{
    document.querySelectorAll('#A_stage_rows tr')[i].querySelector('.st_label').value = s.label;
    document.querySelectorAll('#A_stage_rows tr')[i].querySelector('.st_dur').value = s.durationSec;
    document.querySelectorAll('#A_stage_rows tr')[i].querySelector('.ig_dur').value = cfg.junctionA.intergreens[i].durationSec;
  });
  $('B_name').value = cfg.junctionB.name;
  $('B_cycle').value = cfg.junctionB.cycleTimeSec;
  $('B_start').value = cfg.junctionB.startTimeSec;
  setRows('B', cfg.junctionB.stages.length);
  cfg.junctionB.stages.forEach((s,i)=>{
    document.querySelectorAll('#B_stage_rows tr')[i].querySelector('.st_label').value = s.label;
    document.querySelectorAll('#B_stage_rows tr')[i].querySelector('.st_dur').value = s.durationSec;
    document.querySelectorAll('#B_stage_rows tr')[i].querySelector('.ig_dur').value = cfg.junctionB.intergreens[i].durationSec;
  });
  $('AB_travel').value = cfg.journeys.find(j=>j.from==='A'&&j.to==='B')?.travelTimeSec ?? 0;
  $('BA_travel').value = cfg.journeys.find(j=>j.from==='B'&&j.to==='A')?.travelTimeSec ?? 0;
  $('horizon').value = cfg.diagram?.horizonSec ?? 600;
  populateCoordStages();
}

function addStageRow(which, label='S', dur=10, ig=2){
  const tbody = document.getElementById(`${which}_stage_rows`);
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><input class="st_label" value="${label}"/></td>
                  <td><input type="number" class="st_dur" min="1" value="${dur}"/></td>
                  <td><input type="number" class="ig_dur" min="0" value="${ig}"/></td>
                  <td><button class="small danger">✕</button></td>`;
  tr.querySelector('button').addEventListener('click', ()=> { tr.remove(); populateCoordStages(); });
  tbody.appendChild(tr);
}
function setRows(which, count){
  const tbody = document.getElementById(`${which}_stage_rows`);
  tbody.innerHTML = '';
  for(let i=0;i<count;i++) addStageRow(which, `${which}${i+1}`, 10, 2);
}

setRows('A', 3);
setRows('B', 3);

function validateConfig(cfg){
  const errors = [];
  ['junctionA','junctionB'].forEach(key=>{
    const j = cfg[key];
    if(j.stages.length === 0) errors.push(`${j.name}: add at least one stage.`);
    if(j.intergreens.length !== j.stages.length) errors.push(`${j.name}: intergreens count must match stages count.`);
    if(j.cycleTimeSec <= 0) errors.push(`${j.name}: cycle time must be > 0.`);
    j.stages.forEach((s, i)=>{
      if(s.durationSec <= 0) errors.push(`${j.name}: Stage ${s.label} must have duration > 0.`);
      if(j.intergreens[i].durationSec < 0) errors.push(`${j.name}: Intergreen after ${s.label} must be ≥ 0.`);
    });
    const total = sum(j.stages, s=>s.durationSec) + sum(j.intergreens, ig=>ig.durationSec);
    if(total !== j.cycleTimeSec){
      errors.push(`${j.name}: stages + intergreens (${total}s) must equal cycle (${j.cycleTimeSec}s).`);
    }
  });
  const hasAB = cfg.journeys.find(j=>j.from==='A'&&j.to==='B');
  const hasBA = cfg.journeys.find(j=>j.from==='B'&&j.to==='A');
  if(!hasAB || !hasBA) errors.push('Provide both A→B and B→A journey times.');
  return errors;
}

function bandsOneCycle(j){
  const out = [];
  let t = 0;
  for(let i=0;i<j.stages.length;i++){
    const s = j.stages[i];
    out.push({type:'stage', label:s.label, start:t, end:t+s.durationSec, index:i});
    t += s.durationSec;
    const ig = j.intergreens[i]?.durationSec ?? 0;
    out.push({type:'intergreen', start:t, end:t+ig, index:i});
    t += ig;
  }
  return out;
}

function phaseAt(j, tAbs){
  const tCycle = mod(tAbs - j.startTimeSec, j.cycleTimeSec);
  const bands = bandsOneCycle(j);
  for(const b of bands){
    if(tCycle >= b.start && tCycle < b.end){
      return {
        which: b.type,
        index: b.index,
        label: b.label ?? null,
        tInto: tCycle - b.start,
        tRemaining: b.end - tCycle
      };
    }
  }
  const b0 = bands[0];
  return { which:b0.type, index:b0.index, label:b0.label??null, tInto:0, tRemaining:b0.end-b0.start };
}

function buildTiles(j, horizonSec, startAbs=0){
  const tiles = [];
  const firstCycleStart = j.startTimeSec;
  const cycle = j.cycleTimeSec;
  const start = 0;
  const end = horizonSec;
  let cycleStart = firstCycleStart;
  while(cycleStart > start) cycleStart -= cycle;
  while(cycleStart + cycle < start) cycleStart += cycle;
  while(cycleStart < end){
    const bands = bandsOneCycle(j);
    for(const b of bands){
      tiles.push({ type:b.type, label:b.label, startAbs: cycleStart + b.start, endAbs: cycleStart + b.end });
    }
    cycleStart += cycle;
  }
  return tiles.filter(b => b.endAbs >= start && b.startAbs <= end);
}

const MARGIN_LEFT = 60;
const MARGIN_TOP = 20;
const ROW_HEIGHT = 130;
const ROW_GAP = 30;
const HEIGHT = ROW_HEIGHT*2 + ROW_GAP + MARGIN_TOP*2;

function renderDiagram(cfg, selection){
  const s = svg();
  s.innerHTML = '';
  s.setAttribute('height', HEIGHT.toString());

  const horizon = cfg.diagram.horizonSec;
  const width = s.clientWidth || s.parentElement.clientWidth || 960;
  const xScale = t => MARGIN_LEFT + (t/horizon) * (width - MARGIN_LEFT - 10);

  for(let t=0;t<=horizon;t+=10){
    const line = elNS('line');
    setAttrs(line, { x1:xScale(t), y1:MARGIN_TOP, x2:xScale(t), y2:HEIGHT-MARGIN_TOP, class:'gridLine'});
    s.appendChild(line);
    if(t % 30 === 0){
      const label = elNS('text');
      setAttrs(label, {x:xScale(t)+2, y:15, class:'axisLabel'});
      label.textContent = `${t}s`;
      s.appendChild(label);
    }
  }

  function drawRow(j, rowIndex){
    const yTop = MARGIN_TOP + rowIndex*(ROW_HEIGHT + ROW_GAP);
    const lbl = elNS('text');
    setAttrs(lbl, {x:10, y:yTop+20, class:'rowLabel'});
    lbl.textContent = j.name;
    s.appendChild(lbl);

    const tiles = buildTiles(j, horizon, 0);
    for(const b of tiles){
      const rect = elNS('rect');
      const x = xScale(Math.max(0,b.startAbs));
      const x2 = xScale(Math.min(horizon,b.endAbs));
      const w = Math.max(0, x2-x);
      setAttrs(rect, {x:x, y:yTop+30, width:w, height:ROW_HEIGHT-40, class: b.type==='stage'?'stageRect':'intergreenRect'});
      s.appendChild(rect);
      if(b.label && b.type==='stage' && w>24){
        const t = elNS('text');
        setAttrs(t, {x:x + w/2, y:yTop + (ROW_HEIGHT-40)/2 + 30, class:'stageLabel'});
        t.textContent = b.label;
        s.appendChild(t);
      }
    }
    const hit = elNS('rect');
    setAttrs(hit, {x:MARGIN_LEFT, y:yTop+30, width:width-MARGIN_LEFT-10, height:ROW_HEIGHT-40, fill:'transparent'});
    hit.style.cursor = 'crosshair';
    if((rowIndex===0 && currentDir()==='AtoB') || (rowIndex===0 && currentDir()==='BtoA')){
      hit.addEventListener('mousedown', onMouseDown);
      s.addEventListener('mouseup', onMouseUp);
      s.addEventListener('mousemove', onMouseMove);
    }
    s.appendChild(hit);
  }

  drawRow(originJunction(cfg), 0);
  drawRow(destJunction(cfg), 1);

  if(selection){
    const y0 = MARGIN_TOP+30;
    const y1 = y0 + ROW_HEIGHT-40;
    const x0 = xScale(selection.t0);
    const x1 = xScale(selection.t1 ?? selection.t0);
    const vline = elNS('line');
    setAttrs(vline, {x1:x0, y1:y0, x2:x0, y2:y1, class:'clickLine'});
    s.appendChild(vline);
    if(selection.t1 && selection.t1>selection.t0){
      const rect = elNS('rect');
      setAttrs(rect, {x:x0, y:y0, width:x1-x0, height:y1-y0, class:'arrivalHighlight'});
      s.appendChild(rect);
    }
    if(selection.arrivals){
      selection.arrivals.forEach(a=>{
        const yTop = MARGIN_TOP + (ROW_HEIGHT + ROW_GAP);
        const ax = xScale(a.t);
        const aline = elNS('line');
        setAttrs(aline, {x1:x0, y1:y0, x2:ax, y2:yTop+30, class:'traceLine'});
        s.appendChild(aline);
        const mark = elNS('rect');
        setAttrs(mark, {x:ax-2, y:yTop+28, width:4, height:ROW_HEIGHT-36, fill:'#ff6'});
        s.appendChild(mark);
      });
    }
  }
}

let dragging = false;
let dragStart = null;
let selectionState = null;

function currentDir(){
  return document.querySelector('input[name="dir"]:checked').value;
}
function originJunction(cfg){
  return currentDir()==='AtoB' ? cfg.junctionA : cfg.junctionB;
}
function destJunction(cfg){
  return currentDir()==='AtoB' ? cfg.junctionB : cfg.junctionA;
}
function travelTime(cfg){
  return currentDir()==='AtoB'
    ? cfg.journeys.find(j=>j.from==='A'&&j.to==='B').travelTimeSec
    : cfg.journeys.find(j=>j.from==='B'&&j.to==='A').travelTimeSec;
}

function onMouseDown(ev){
  const cfg = readConfig();
  const errors = validateConfig(cfg);
  if(errors.length){ renderErrors(errors); return; }
  dragging = ev.shiftKey;
  const t = eventToTime(ev, cfg);
  dragStart = t;
  if(!dragging){
    selectionState = { t0:t };
    computeArrivalReadout(cfg, selectionState);
    renderDiagram(cfg, selectionState);
  }
}
function onMouseMove(ev){
  if(!dragging || dragStart==null) return;
  const cfg = readConfig();
  const t = eventToTime(ev, cfg);
  selectionState = { t0:Math.min(dragStart, t), t1:Math.max(dragStart, t) };
  computeArrivalReadout(cfg, selectionState);
  renderDiagram(cfg, selectionState);
}
function onMouseUp(ev){
  dragging = false;
  dragStart = null;
}

function eventToTime(ev, cfg){
  const s = svg();
  const horizon = cfg.diagram.horizonSec;
  const width = s.clientWidth || s.parentElement.clientWidth || 960;
  const x = clamp(ev.offsetX, MARGIN_LEFT, width-10);
  const t = ( (x - MARGIN_LEFT) / (width - MARGIN_LEFT - 10) ) * horizon;
  return clamp(Math.round(t), 0, horizon);
}

function computeArrivalReadout(cfg, sel){
  const origin = originJunction(cfg);
  const dest = destJunction(cfg);
  const tt = travelTime(cfg);
  const lines = [];
  function bandAt(j, t){ return phaseAt(j, t); }

  if(sel.t1 && sel.t1>sel.t0){
    const arrivals = [{t: sel.t0 + tt}, {t: sel.t1 + tt}];
    sel.arrivals = arrivals;
    const a0 = bandAt(origin, sel.t0);
    const a1 = bandAt(origin, sel.t1);
    const b0 = bandAt(dest, sel.t0 + tt);
    const b1 = bandAt(dest, sel.t1 + tt);
    lines.push(`Interval at origin: [${sel.t0}s → ${sel.t1}s]`);
    lines.push(`${origin.name} bands: start in ${a0.which} ${a0.label ?? ''}, end in ${a1.which} ${a1.label ?? ''}`);
    lines.push(`Travel time ${tt}s → arrival window [${sel.t0+tt}s → ${sel.t1+tt}s] at ${dest.name}`);
    lines.push(`Arrive starts in ${b0.which} ${b0.label ?? ''} (+${b0.tInto.toFixed(0)}s), ends in ${b1.which} ${b1.label ?? ''}`);
  }else{
    const tDep = sel.t0;
    const a = bandAt(origin, tDep);
    const tArr = tDep + tt;
    const b = bandAt(dest, tArr);
    sel.arrivals = [{t: tArr}];
    lines.push(`Depart ${origin.name} at t=${tDep}s → ${a.which}${a.label?(' '+a.label):''}, +${a.tInto.toFixed(0)}s into band`);
    lines.push(`Travel ${tt}s → arrive ${dest.name} at t=${tArr}s → ${b.which}${b.label?(' '+b.label):''}, +${b.tInto.toFixed(0)}s into band`);
    if(b.which==='intergreen'){
      const bands = bandsOneCycle(dest);
      const cyclePos = mod(tArr - dest.startTimeSec, dest.cycleTimeSec);
      let idx = -1; for(let i=0;i<bands.length;i++){ if(cyclePos>=bands[i].start && cyclePos<bands[i].end){ idx=i; break; } }
      let wait = 0;
      let k = idx;
      while(true){
        if(bands[k].type==='stage'){ wait = 0; break; }
        const next = (k+1)%bands.length;
        const from = (k===idx) ? (bands[k].end - cyclePos) : (bands[k].end - bands[k].start);
        wait += from;
        if(bands[next].type==='stage'){ break; }
        k = next;
      }
      lines.push(`Est. wait until next stage: ~${Math.round(wait)}s`);
    }
  }
  readoutEl().innerHTML = lines.map(l=>`<div>${l}</div>`).join('');
}

function renderErrors(errors){
  readoutEl().innerHTML = `<div class="bad"><strong>Fix these first:</strong><ul>${errors.map(e=>`<li>${e}</li>`).join('')}</ul></div>`;
}

// --- Coordination Check ---
function populateCoordStages(){
  const cfg = readConfig();
  const from = $('coordFrom').value;
  const j = from==='A' ? cfg.junctionA : cfg.junctionB;
  const sel = $('coordStage');
  if(!sel) return;
  sel.innerHTML = '';
  j.stages.forEach((st, i)=>{
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = st.label;
    sel.appendChild(opt);
  });
}
document.addEventListener('DOMContentLoaded', populateCoordStages);
document.addEventListener('input', (e)=>{
  if(e.target && (e.target.id.startsWith('A_') || e.target.id.startsWith('B_'))) {
    populateCoordStages();
  }
});
document.getElementById('coordFrom').addEventListener('change', ()=>{
  const from = $('coordFrom').value;
  const dirVal = from==='A' ? 'AtoB' : 'BtoA';
  document.querySelector(`input[name="dir"][value="${dirVal}"]`).checked = true;
  populateCoordStages();
  const cfg = readConfig();
  const errors = validateConfig(cfg);
  if(!errors.length) renderDiagram(cfg, selectionState);
});
$('coordBtn').addEventListener('click', ()=>{
  const cfg = readConfig();
  const errors = validateConfig(cfg);
  if(errors.length){ renderErrors(errors); return; }
  renderDiagram(cfg, selectionState);
  const from = $('coordFrom').value;
  const stageIndex = Number($('coordStage').value);
  const origin = from==='A' ? cfg.junctionA : cfg.junctionB;
  const dest   = from==='A' ? cfg.junctionB : cfg.junctionA;
  const tt = from==='A'
    ? cfg.journeys.find(j=>j.from==='A'&&j.to==='B').travelTimeSec
    : cfg.journeys.find(j=>j.from==='B'&&j.to==='A').travelTimeSec;

  const tiles = buildTiles(origin, cfg.diagram.horizonSec, 0).filter(b=>b.type==='stage');
  const match = tiles.find(b => b.label === origin.stages[stageIndex].label && b.endAbs>0);
  if(!match){
    renderErrors([`Could not find stage ${origin.stages[stageIndex].label} within the current horizon.`]);
    return;
  }
  const tFront = Math.max(0, match.startAbs);
  const tBack  = Math.min(cfg.diagram.horizonSec, match.endAbs);
  const aFront = tFront + tt;
  const aBack  = tBack  + tt;

  const sEl = svg();
  const width = sEl.clientWidth || sEl.parentElement.clientWidth || 960;
  const horizon = cfg.diagram.horizonSec;
  const xScale = t => MARGIN_LEFT + (t/horizon) * (width - MARGIN_LEFT - 10);
  const y0 = MARGIN_TOP+30;
  const yTopDest = MARGIN_TOP + (ROW_HEIGHT + ROW_GAP);

  function addLine(x1,y1_,x2,y2_, cls){
    const ln = elNS('line'); setAttrs(ln, {x1:x1,y1:y1_,x2:x2,y2:y2_, class:cls}); sEl.appendChild(ln);
  }

  addLine(xScale(tFront), y0, xScale(aFront), yTopDest+30, 'coordLine');
  addLine(xScale(tBack ), y0, xScale(aBack ), yTopDest+30, 'coordLine');

  const a0 = Math.max(0, Math.min(aFront, aBack));
  const a1 = Math.min(horizon, Math.max(aFront, aBack));
  if(a1 > a0){
    const rect = elNS('rect');
    setAttrs(rect, {x:xScale(a0), y:yTopDest+30, width:xScale(a1)-xScale(a0), height:ROW_HEIGHT-40, class:'arrivalHighlight'});
    sEl.appendChild(rect);
  }

  const bFront = phaseAt(dest, aFront);
  const bBack  = phaseAt(dest, aBack);
  readoutEl().innerHTML = [
    `<div><strong>Coordination check:</strong> ${origin.name} Stage <em>${origin.stages[stageIndex].label}</em> (${Math.round(tFront)}s→${Math.round(tBack)}s)</div>`,
    `<div>Travel time = ${tt}s → arrivals at ${dest.name}: [${Math.round(aFront)}s → ${Math.round(aBack)}s]</div>`,
    `<div>Arrive starts in ${bFront.which}${bFront.label?(' '+bFront.label):''}; ends in ${bBack.which}${bBack.label?(' '+bBack.label):''}</div>`
  ].join('');
});

// Buttons
document.querySelectorAll('[data-add-stage]').forEach(btn=>{
  btn.addEventListener('click', ()=> { addStageRow(btn.getAttribute('data-add-stage')); populateCoordStages(); });
});
$('validateBtn').addEventListener('click', ()=>{
  const cfg = readConfig();
  const errors = validateConfig(cfg);
  if(errors.length) renderErrors(errors);
  else readoutEl().innerHTML = `<div class="good">Config looks valid ✔️</div>`;
});
$('plotBtn').addEventListener('click', ()=>{
  const cfg = readConfig();
  const errors = validateConfig(cfg);
  if(errors.length){ renderErrors(errors); return; }
  selectionState = null;
  renderDiagram(cfg, selectionState);
});
$('exportBtn').addEventListener('click', ()=>{
  const cfg = readConfig();
  const blob = new Blob([JSON.stringify(cfg, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'signals-config.json';
  a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
});
$('importInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const cfg = JSON.parse(reader.result);
      applyConfig(cfg);
      readoutEl().innerHTML = `<div>Imported config.</div>`;
    }catch(err){
      renderErrors([`Import failed: ${err.message}`]);
    }
  };
  reader.readAsText(file);
});

// Initial demo config
applyConfig({
  junctionA:{
    id:'A', name:'Junction A', cycleTimeSec:90, startTimeSec:0,
    stages:[{label:'A1',durationSec:30},{label:'A2',durationSec:40},{label:'A3',durationSec:10}],
    intergreens:[{durationSec:5},{durationSec:3},{durationSec:2}]
  },
  junctionB:{
    id:'B', name:'Junction B', cycleTimeSec:88, startTimeSec:12,
    stages:[{label:'B1',durationSec:25},{label:'B2',durationSec:45},{label:'B3',durationSec:10}],
    intergreens:[{durationSec:4},{durationSec:2},{durationSec:2}]
  },
  journeys:[{from:'A',to:'B',travelTimeSec:22},{from:'B',to:'A',travelTimeSec:24}],
  diagram:{horizonSec:600}
});

document.addEventListener('DOMContentLoaded', ()=>{
  const cfg = readConfig();
  const errors = validateConfig(cfg);
  if(!errors.length) renderDiagram(cfg, null);
});
