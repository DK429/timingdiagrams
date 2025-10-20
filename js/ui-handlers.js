// Signal Plan Checker v2.6.1h - UI Handlers Module
// UI rendering, modals, and event handling

function enableDragModal(modalId){
  const backdrop = document.getElementById(modalId);
  if(!backdrop) return;
  const card = backdrop.querySelector('.modal-card');
  if(!card) return;

  // Only init once per modal
  if(card.__dragInit) return; 
  card.__dragInit = true;

  // Ensure absolute positioning (CSS also sets this)
  card.style.position = 'absolute';

  // Center once on first open if no left/top set
  function centerOnce(){
    const br = backdrop.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    if(!card.style.left && !card.style.top){
      const left = Math.max(8, (br.width  - cr.width )/2);
      const top  = Math.max(8, (br.height - cr.height)/2);
      card.style.left = left + 'px';
      card.style.top  = top  + 'px';
    }
  }
  centerOnce();

  const header = card.querySelector('header') || card; // drag by header if present
  let dragging=false, startX=0, startY=0, baseLeft=0, baseTop=0;

  header.addEventListener('pointerdown', (e)=>{
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    const cs = getComputedStyle(card);
    baseLeft = parseFloat(cs.left)||0; baseTop = parseFloat(cs.top)||0;
    try{ header.setPointerCapture(e.pointerId); }catch(_){}
    document.body.style.userSelect = 'none';
  });
  header.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    const dx = e.clientX - startX; const dy = e.clientY - startY;
    const br = backdrop.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    let nl = baseLeft + dx; let nt = baseTop + dy;
    // clamp within viewport with 8px margin
    nl = Math.max(8, Math.min(br.width  - cr.width  - 8, nl));
    nt = Math.max(8, Math.min(br.height - cr.height - 8, nt));
    card.style.left = nl + 'px';
    card.style.top  = nt + 'px';
  });
  function endDrag(){ dragging=false; document.body.style.userSelect=''; }
  header.addEventListener('pointerup', endDrag);
  header.addEventListener('pointercancel', endDrag);
}

window.addEventListener('error', e=>log('ERROR: '+(e.message||e.error),'err'));
window.addEventListener('unhandledrejection', e=>log('PROMISE: '+(e.reason&&e.reason.message?e.reason.message:e.reason),'err'));

function renderUTCEditor(j){
  let rows=''; (j.utcPlan||[]).forEach((r,i)=>{
    rows += `<tr>
      <td><select data-t="planTo" data-id="${j.id}" data-idx="${i}">
        ${j.stages.map(s=>`<option value="${s.label}" ${r.to===s.label?'selected':''}>${s.label}</option>`).join('')}
      </select></td>
      <td><input type="number" min="0" step="1" value="${r.at}" data-t="planAt" data-id="${j.id}" data-idx="${i}"></td>
      <td><button data-t="planDel" data-id="${j.id}" data-idx="${i}">Delete</button></td>
    </tr>`;
  });
  return `<div class="utc-plan-section">
  <div class="section-title"><h4>UTC Plan</h4><button data-t="planAdd" data-id="${j.id}">Add change</button></div>
  <table class="grid compact auto"><thead><tr><th>To stage</th><th>Force Stage at<br/>(s)</th><th></th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
}

// Helper to parse old direction format to new format
function parseDirectionData(dir){
  // Convert old simple string format to new object format
  if(!dir || dir === 'none') return {primary: 'none', primaryMoves: [], secondary: 'none', secondaryMoves: []};
  if(dir === 'P') return {primary: 'P', primaryMoves: [], secondary: 'none', secondaryMoves: []};

  // For old single directions, default to 'A' (ahead)
  if(dir === 'N') return {primary: 'N', primaryMoves: ['A'], secondary: 'none', secondaryMoves: []};
  if(dir === 'E') return {primary: 'E', primaryMoves: ['A'], secondary: 'none', secondaryMoves: []};
  if(dir === 'S') return {primary: 'S', primaryMoves: ['A'], secondary: 'none', secondaryMoves: []};
  if(dir === 'W') return {primary: 'W', primaryMoves: ['A'], secondary: 'none', secondaryMoves: []};

  // For old bi-directional
  if(dir === 'EW') return {primary: 'E', primaryMoves: ['A'], secondary: 'W', secondaryMoves: ['A']};
  if(dir === 'NS') return {primary: 'N', primaryMoves: ['A'], secondary: 'S', secondaryMoves: ['A']};

  // If already in new format (object), return as-is
  if(typeof dir === 'object') return dir;

  // Default fallback
  return {primary: 'none', primaryMoves: [], secondary: 'none', secondaryMoves: []};
}

function renderJunctionPanel(j){
  const cfg = App.initCfg; const N=j.stages.length;
  let rows = '';
  for(let i=0;i<N;i++){
    const dirData = parseDirectionData(j.stages[i].dir);
    const isPed = dirData.primary === 'P';

  rows += `<tr>
    <td><input data-t="stageLabel" data-id="${j.id}" data-idx="${i}" value="${j.stages[i].label}"></td>
    <td><input type="number" min="${cfg.stage.minGreen.min}" value="${j.stages[i].minGreenSec}" data-t="minGreen" data-id="${j.id}" data-idx="${i}"></td>
    <td>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:11px">
        <div style="display:flex;gap:4px;align-items:center">
          <select data-t="dirPrimary" data-id="${j.id}" data-idx="${i}" style="width:60px">
            <option value="none" ${dirData.primary==='none'?'selected':''}>—</option>
            <option value="N" ${dirData.primary==='N'?'selected':''}>N ↑</option>
            <option value="E" ${dirData.primary==='E'?'selected':''}>E →</option>
            <option value="S" ${dirData.primary==='S'?'selected':''}>S ↓</option>
            <option value="W" ${dirData.primary==='W'?'selected':''}>W ←</option>
            <option value="P" ${dirData.primary==='P'?'selected':''}>Ped</option>
          </select>
          <div class="dir-moves" data-id="${j.id}" data-idx="${i}" data-which="primary" data-compass="${dirData.primary}" style="display:${isPed||dirData.primary==='none'?'none':'flex'};flex-direction:${(dirData.primary==='E'||dirData.primary==='W')?'column':'row'};gap:4px">
            <label style="font-size:10px"><input type="checkbox" data-move="L" ${dirData.primaryMoves.includes('L')?'checked':''}> <span class="move-label-l"></span></label>
            <label style="font-size:10px"><input type="checkbox" data-move="A" ${dirData.primaryMoves.includes('A')?'checked':''}> <span class="move-label-a"></span></label>
            <label style="font-size:10px"><input type="checkbox" data-move="R" ${dirData.primaryMoves.includes('R')?'checked':''}> <span class="move-label-r"></span></label>
          </div>
        </div>
        <div style="display:flex;gap:4px;align-items:center;${isPed?'display:none':''}">
          <select data-t="dirSecondary" data-id="${j.id}" data-idx="${i}" style="width:60px">
            <option value="none" ${dirData.secondary==='none'?'selected':''}>—</option>
            <option value="N" ${dirData.secondary==='N'?'selected':''}>N ↑</option>
            <option value="E" ${dirData.secondary==='E'?'selected':''}>E →</option>
            <option value="S" ${dirData.secondary==='S'?'selected':''}>S ↓</option>
            <option value="W" ${dirData.secondary==='W'?'selected':''}>W ←</option>
          </select>
          <div class="dir-moves" data-id="${j.id}" data-idx="${i}" data-which="secondary" data-compass="${dirData.secondary}" style="display:${dirData.secondary==='none'?'none':'flex'};flex-direction:${(dirData.secondary==='E'||dirData.secondary==='W')?'column':'row'};gap:4px">
            <label style="font-size:10px"><input type="checkbox" data-move="L" ${dirData.secondaryMoves.includes('L')?'checked':''}> <span class="move-label-l"></span></label>
            <label style="font-size:10px"><input type="checkbox" data-move="A" ${dirData.secondaryMoves.includes('A')?'checked':''}> <span class="move-label-a"></span></label>
            <label style="font-size:10px"><input type="checkbox" data-move="R" ${dirData.secondaryMoves.includes('R')?'checked':''}> <span class="move-label-r"></span></label>
          </div>
        </div>
      </div>
    </td>
  </tr>`;
  }
  let ig = '<table class="grid compact auto"><thead><tr><th>From \\ To</th>';
  for(let c=0;c<N;c++){ ig += `<th>${j.stages[c].label}</th>`; }
  ig += '</tr></thead><tbody>';
  for(let r=0;r<N;r++){
    ig += `<tr><th>${j.stages[r].label}</th>`;
    for(let c=0;c<N;c++){
      if(r===c){ ig += `<td><input class="ig-lock" value="${cfg.intergreen.diagonalLockedValue}" disabled></td>`; }
      else{ ig += `<td><input type="number" step="1" min="-1" max="${cfg.intergreen.domain.max}" value="${j.intergreen[r][c]}" data-t="ig" data-id="${j.id}" data-r="${r}" data-c="${c}"></td>`; }
    }
    ig += '</tr>';
  }
  ig += '</tbody></table>';
// (5)
return `
  <div class="row">
    <label>Name
      <input data-t="jName" data-id="${j.id}" value="${j.name}">
    </label>
    <label>Double cycle <input type="checkbox" data-t="double" data-id="${j.id}" ${j.doubleCycle?'checked':''}></label>
    <label>To previous (↑)<input type="number" min="${App.initCfg.journeyTime.min}" max="${App.initCfg.journeyTime.max}" value="${j.travelPrev}" data-t="travelPrev" data-id="${j.id}"></label>
    <label>To next (↓)<input type="number" min="${App.initCfg.journeyTime.min}" max="${App.initCfg.journeyTime.max}" value="${j.travelNext}" data-t="travelNext" data-id="${j.id}"></label>
    <label>Stage count<input type="number" min="${App.initCfg.stageCount.min}" max="8" value="${j.stages.length}" data-t="stageCount" data-id="${j.id}"></label>
  </div>

  <div class="stage-ig">
    <div>
      <h4>Stages</h4>
      <table class="grid compact auto">
        <thead><tr><th>Label</th><th>Min green (s)</th><th>Dir</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="ig-col">
      <h4>Intergreen matrix (leading intergreen; -1 = not permitted)</h4>
      ${ig}
    </div>
  </div>

  ${renderUTCEditor(j)}
`;





  
  
  









  
}



function rebuildTabs(){
  // Remember which tab was active before rebuild
  const activeTab = document.querySelector('.tab.active');
  const activeJunctionId = activeTab ? activeTab.dataset.id : null;

  const tabs = document.getElementById('jtabs'); const panels = document.getElementById('tabpanels'); tabs.innerHTML=''; panels.innerHTML='';
  App.state.junctions.forEach((j, idx)=>{
    // Set active based on previously active junction, or default to first tab
    const isActive = activeJunctionId ? (j.id === activeJunctionId) : (idx === 0);
    const t=document.createElement('button'); t.className='tab'+(isActive?' active':''); t.textContent=j.name; t.dataset.id=j.id;
    t.addEventListener('click', ()=>{ document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active')); t.classList.add('active');
      document.querySelectorAll('.tabpanel').forEach(p=>p.classList.remove('active')); document.getElementById('tp_'+j.id).classList.add('active'); });
    tabs.appendChild(t);
    const tp=document.createElement('div'); tp.id='tp_'+j.id; tp.className='tabpanel'+(isActive?' active':'');
    tp.innerHTML = renderJunctionPanel(j);
    panels.appendChild(tp);
  });
  wirePanelInputs();
  log('Junction tabs rendered','info');
}



function wirePanelInputs(){
  document.querySelectorAll('[data-t]').forEach(inp=>{
    const t=inp.getAttribute('data-t');
    if(t==='planAdd' || t==='planDel'){ inp.addEventListener('click', (e)=>{ onUTCEdit(e); setDirty(); }); }
    else{
      inp.addEventListener('change', (e)=>{ onPanelChange(e); setDirty(); });
      inp.addEventListener('blur',   (e)=>{ onPanelChange(e); setDirty(); });
    }
  });

  // Wire up direction move checkboxes
  document.querySelectorAll('.dir-moves input[type="checkbox"]').forEach(cb=>{
    cb.addEventListener('change', (e)=>{ onDirectionMoveChange(e); setDirty(); });
  });

  // Update checkbox labels based on compass direction
  updateDirectionLabels();
}

// Update checkbox labels dynamically based on compass direction
function updateDirectionLabels(){
  document.querySelectorAll('.dir-moves').forEach(container => {
    const compass = container.getAttribute('data-compass');
    if(!compass || compass === 'none') return;

    // Get label spans
    const labelL = container.querySelector('.move-label-l');
    const labelA = container.querySelector('.move-label-a');
    const labelR = container.querySelector('.move-label-r');

    if(!labelL || !labelA || !labelR) return;

    // Set labels to match visual arrow order in the diagram
    // Labels show the visual position reading left-to-right (or top-to-bottom for E/W)
    if(compass === 'N'){
      // N: heading North (bottom row, arrows point up)
      // Visual order left-to-right: L-A-R
      labelL.textContent = 'L'; // Leftmost arrow
      labelA.textContent = 'A'; // Middle arrow
      labelR.textContent = 'R'; // Rightmost arrow
    }else if(compass === 'S'){
      // S: heading South (top row, arrows point down)
      // Visual order left-to-right: R-A-L (checkbox position matches arrow on screen)
      labelL.textContent = 'R'; // Leftmost checkbox plots rightmost arrow
      labelA.textContent = 'A'; // Middle checkbox plots middle arrow
      labelR.textContent = 'L'; // Rightmost checkbox plots leftmost arrow
    }else if(compass === 'E'){
      // E: heading East (left column, arrows point right)
      // Visual order top-to-bottom: L-A-R (checkbox position matches arrow on screen)
      labelL.textContent = 'L'; // Top checkbox plots top arrow
      labelA.textContent = 'A'; // Middle checkbox plots middle arrow
      labelR.textContent = 'R'; // Bottom checkbox plots bottom arrow
    }else if(compass === 'W'){
      // W: heading West (right column, arrows point left)
      // Visual order top-to-bottom: R-A-L (checkbox position matches arrow on screen)
      labelL.textContent = 'R'; // Top checkbox plots top arrow
      labelA.textContent = 'A'; // Middle checkbox plots middle arrow
      labelR.textContent = 'L'; // Bottom checkbox plots bottom arrow
    }
  });
}
function findJ(id){ return App.state.junctions.find(x=>x.id===id); }

function onDirectionMoveChange(e){
  const parent = e.target.closest('.dir-moves');
  if(!parent) return;

  const id = parent.getAttribute('data-id');
  const idx = parseInt(parent.getAttribute('data-idx'), 10);
  const which = parent.getAttribute('data-which'); // 'primary' or 'secondary'

  const j = findJ(id);
  if(!j) return;

  // Get current direction data
  let dirData = parseDirectionData(j.stages[idx].dir);

  // Get all checked moves for this direction
  const moves = [];
  parent.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
    if(cb.checked){
      moves.push(cb.getAttribute('data-move'));
    }
  });

  // Update the appropriate moves array
  if(which === 'primary'){
    dirData.primaryMoves = moves;
  }else{
    dirData.secondaryMoves = moves;
  }

  j.stages[idx].dir = dirData;
}

function onUTCEdit(e){
  const t = e.target.getAttribute('data-t'); const id=e.target.getAttribute('data-id'); const j=findJ(id); if(!j) return;
  if(t==='planAdd'){ j.utcPlan.push({to:(j.stages[0]&&j.stages[0].label)||'S1', at:0}); rebuildTabs(); return; }
  if(t==='planDel'){ const idx=parseInt(e.target.getAttribute('data-idx'),10); j.utcPlan.splice(idx,1); rebuildTabs(); return; }
}

function onPanelChange(e){
  const t=e.target.getAttribute('data-t'); const id=e.target.getAttribute('data-id');
  const j=findJ(id); if(!j) return;
  if(t==='jName'){
    const v = (e.target.value || '').toString().slice(0,14).trim();
    j.name = v || j.name; // keep old if blank
    e.target.value = j.name;
    rebuildTabs();
    return;
  }
  if(t==='double'){ j.doubleCycle = e.target.checked; }
  if(t==='travelPrev'){ j.travelPrev = clampInt(e.target.value, App.initCfg.journeyTime.min, App.initCfg.journeyTime.max); e.target.value=j.travelPrev; }
  if(t==='travelNext'){ j.travelNext = clampInt(e.target.value, App.initCfg.journeyTime.min, App.initCfg.journeyTime.max); e.target.value=j.travelNext; }
  if(t==='stageCount'){ const n = Math.max(App.initCfg.stageCount.min, Math.min(8, parseInt(e.target.value||2,10))); resizeStages(j, n); rebuildTabs(); }
  if(t==='stageLabel'){ const idx=parseInt(e.target.getAttribute('data-idx'),10); j.stages[idx].label = e.target.value|| ('S'+(idx+1)); rebuildTabs(); }
  if(t==='minGreen'){ const idx=parseInt(e.target.getAttribute('data-idx'),10); j.stages[idx].minGreenSec = Math.max(App.initCfg.stage.minGreen.min, parseInt(e.target.value||App.initCfg.stage.minGreen.default,10)); e.target.value=j.stages[idx].minGreenSec; }
// (6) Handle direction controls
  if(t==='dirPrimary' || t==='dirSecondary'){
    const idx=parseInt(e.target.getAttribute('data-idx'),10);
    const isPrimary = t === 'dirPrimary';
    const value = e.target.value;

    // Get current direction data
    let dirData = parseDirectionData(j.stages[idx].dir);

    if(isPrimary){
      dirData.primary = value;
      if(value === 'P' || value === 'none'){
        dirData.primaryMoves = [];
        dirData.secondary = 'none';
        dirData.secondaryMoves = [];
      }
    }else{
      dirData.secondary = value;
      if(value === 'none'){
        dirData.secondaryMoves = [];
      }
    }

    j.stages[idx].dir = dirData;
    rebuildTabs();
    return;
  }
 
  if(t==='ig'){ const r=parseInt(e.target.getAttribute('data-r'),10), c=parseInt(e.target.getAttribute('data-c'),10);
    let v = parseInt(e.target.value||0,10); if(v!==-1) v = Math.max(App.initCfg.intergreen.domain.min, Math.min(App.initCfg.intergreen.domain.max, v));
    j.intergreen[r][c] = v; e.target.value = v; }
  if(t==='planTo'){ const idx=parseInt(e.target.getAttribute('data-idx'),10); j.utcPlan[idx].to = e.target.value; }
  if(t==='planAt'){ const idx=parseInt(e.target.getAttribute('data-idx'),10); j.utcPlan[idx].at = Math.max(0, parseInt(e.target.value||0,10)); }
}

function resizeStages(j, n){
  const minG = App.initCfg.stage.minGreen.default;
  while(j.stages.length < n){ j.stages.push({label:'S'+(j.stages.length+1), minGreenSec:minG}); }
  while(j.stages.length > n){ j.stages.pop(); }
  // (7)
  // Ensure every stage has a dir property
  j.stages.forEach(s => { if(!('dir' in s)) s.dir = 'none'; });
    const N = j.stages.length;
    const igNew = [];
    for(let r=0;r<N;r++){ const row=[]; for(let c=0;c<N;c++){ row.push(r===c ? App.initCfg.intergreen.diagonalLockedValue : (j.intergreen[r] && typeof j.intergreen[r][c]==='number' ? j.intergreen[r][c] : App.initCfg.intergreen.defaults.offDiagonal)); } igNew.push(row); }
      j.intergreen = igNew;
      j.utcPlan.forEach(p=>{ if(!j.stages.find(s=>s.label===p.to)) p.to = j.stages[0].label; });
  }



function stripStrayScriptText(){
  const needles = [
    '// --- Scale Plans button definitions',
    '// --- Scale Plans button event handler (modal wiring)'
  ];
  function walk(node){
    if(!node) return;
    // If this is a text node, scrub it if it contains any needle
    if(node.nodeType === Node.TEXT_NODE){
      const s = node.nodeValue || '';
      for(const n of needles){
        if(s.includes(n)){
          node.nodeValue = '';
          return; // cleaned
        }
      }
      return;
    }
    // Recurse into element children
    const kids = node.childNodes;
    for(let i=0;i<kids.length;i++) walk(kids[i]);
  }
  walk(document.body);
}



  // --- Adjust modal wiring ---
  function wireAdjustModal(){
    const btn = document.getElementById('adjustBtn');
    log('wireAdjustModal: btn = ' + (btn ? 'FOUND' : 'NULL'), btn ? 'info' : 'err');

    let wired = false; // modal wired after first open
    // element refs
    let modal, closeBtn, applyBtn, clearBtn, clearAllBtn, commitBtn, selJ, off, listBox;

    function getBoxB(){ return document.getElementById('adjBoundaries'); }

    function fillJ(){
      selJ = document.getElementById('adjJunc');
      if(!selJ) return;
      const juncs = App.state.junctions||[]; selJ.innerHTML='';
      juncs.forEach((j)=>{ const o=document.createElement('option'); o.value=j.id; o.textContent=j.name; selJ.appendChild(o); });
    }
    function renderB(){
      const boxB = getBoxB(); if(!boxB) return;
      const sel = document.getElementById('adjJunc');
      const j = (App.state.junctions||[]).find(x=>x.id=== (sel && sel.value));
      if(!j){ boxB.innerHTML=''; return; }
      const plan = getAdjustedPlan(j);
      const list = plan.map(p=>p.to);
      const bmap = (App.state.temp.boundary[j.id]||{});
      let html = '<table class="grid"><thead><tr><th>Boundary</th><th>Δ (s)</th></tr></thead><tbody>';
      for(let i=0;i<list.length;i++){
        const cur = list[i]; const nxt = list[(i+1)%list.length];
        const key = String(i);
        const val = (typeof bmap[key]==='number') ? bmap[key] : 0;
        html += `<tr><td>${cur} → ${nxt}</td><td><input type="number" step="1" value="${val}" data-bidx="${key}"></td></tr>`;
      }
      html += '</tbody></table>';
      boxB.innerHTML = html;
    }

    // Populate stage transfer dropdowns
    function populateStageTransferDropdowns(){
      const selJ = document.getElementById('adjJunc');
      const j = (App.state.junctions||[]).find(x=>x.id=== (selJ && selJ.value));
      if(!j) return;

      const plan = getAdjustedPlan(j);
      const stages = plan.map(p => p.to);

      const donorSel = document.getElementById('adjDonorStage');
      const recipientSel = document.getElementById('adjRecipientStage');

      if(donorSel){
        donorSel.innerHTML = stages.map(s => `<option value="${s}">${s}</option>`).join('');
      }
      if(recipientSel){
        recipientSel.innerHTML = stages.map(s => `<option value="${s}">${s}</option>`).join('');
        if(recipientSel.options.length > 1) recipientSel.selectedIndex = 1; // Default to second stage
      }
    }

    // Handle add transfer - immediately add as temporary adjustment
    function handleAddTransfer(){
      const selJ = document.getElementById('adjJunc');
      const j = (App.state.junctions||[]).find(x=>x.id=== (selJ && selJ.value));
      if(!j) return;

      const donorSel = document.getElementById('adjDonorStage');
      const recipientSel = document.getElementById('adjRecipientStage');
      const fixedPointSel = document.getElementById('adjFixedPoint');
      const transferInp = document.getElementById('adjTransferTime');

      const donor = donorSel ? donorSel.value : '';
      const recipient = recipientSel ? recipientSel.value : '';
      const fixedPoint = fixedPointSel ? fixedPointSel.value : 'eog';
      const transferTime = parseInt(transferInp ? transferInp.value : '0', 10) || 0;

      if(!donor || !recipient || transferTime <= 0){
        setStatus('❌ Please select stages and enter a positive transfer amount.');
        return;
      }

      // Validate the transfer
      const result = calculateStageTimeTransfer(j, null, donor, recipient, transferTime, fixedPoint);
      if(!result.ok){
        setStatus('❌ ' + result.err);
        return;
      }

      const id = selJ.value;

      // Store the transfer as a temporary adjustment
      App.state.temp.transfers = App.state.temp.transfers || {};
      App.state.temp.transfers[id] = App.state.temp.transfers[id] || [];

      App.state.temp.transfers[id].push({
        donor: donor,
        recipient: recipient,
        fixedPoint: fixedPoint,
        amount: transferTime
      });

      // Clear transfer form
      if(transferInp) transferInp.value = '5';

      // Redraw plot if already plotted (will apply temporary transfers)
      if(App.state.readyToPlot && App.state.validOk){
        drawHidden();
      }

      setStatus('Transfer added (temporary).');
      renderAdjustList();
    }
function readDraftAdjustments(){
  const out = [];
  const id = (document.getElementById('adjJunc')||{}).value;
  if(!id) return out;

  const offInp = document.getElementById('adjOffset');
  const offVal = parseInt(offInp && offInp.value || '0', 10) || 0;
  if(offVal) out.push({ kind:'offset', id, value: offVal });

  const boxB = document.getElementById('adjBoundaries');
  if(boxB){
    boxB.querySelectorAll('input[data-bidx]').forEach(inp=>{
      const v = parseInt(inp.value||'0',10) || 0;
      if(v) out.push({ kind:'boundary', id, bidx: inp.getAttribute('data-bidx'), value: v });
    });
  }
  return out;
}
function renderAdjustList(){
  if(!listBox) listBox = document.getElementById('adjList');
  const sel = document.getElementById('adjJunc');
  const j = (App.state.junctions||[]).find(x=>x.id=== (sel && sel.value));
  if(!listBox || !j){ if(listBox) listBox.innerHTML=''; return; }

  const id = j.id;
  const plan = getAdjustedPlan(j);
  const labels = plan.map(p=>p.to);
  const allRows = [];

  // Add offset adjustments
  const draftAdj = readDraftAdjustments();
  draftAdj.forEach(a=>{
    if(a.kind==='offset'){
      allRows.push(`<tr>
        <td>Offset</td>
        <td>${a.value>0?('+'+a.value):a.value}s</td>
        <td style="white-space:nowrap">
          <button data-edit-adj="offset">Edit</button>
          <button data-del-adj="offset">Delete</button>
        </td>
      </tr>`);
    }else{
      const i = parseInt(a.bidx,10) || 0;
      const cur = labels[i] || `S${i+1}`;
      const nxt = labels[(i+1)%labels.length] || `S${(i+1)%labels.length+1}`;
      allRows.push(`<tr>
        <td>${cur} → ${nxt}</td>
        <td>${a.value>0?('+'+a.value):a.value}s</td>
        <td style="white-space:nowrap">
          <button data-edit-adj="${i}">Edit</button>
          <button data-del-adj="${i}">Delete</button>
        </td>
      </tr>`);
    }
  });

  // Add transfer adjustments
  const transfers = (App.state.temp && App.state.temp.transfers && App.state.temp.transfers[id]) || [];
  transfers.forEach((t, idx)=>{
    const fixedLabel = t.fixedPoint === 'eog' ? 'EoG' : 'SoG';
    allRows.push(`<tr>
      <td>Transfer: ${t.donor}→${t.recipient} (${fixedLabel})</td>
      <td>${t.amount}s</td>
      <td style="white-space:nowrap">
        <button data-del-transfer="${idx}">Delete</button>
      </td>
    </tr>`);
  });

  listBox.innerHTML = allRows.length > 0
    ? `<table class="grid compact auto"><thead><tr><th>Adjustment</th><th>Δ (s)</th><th>Actions</th></tr></thead><tbody>${allRows.join('')}</tbody></table>`
    : '<div class="muted" style="font-size:12px">No adjustments yet.</div>';
}
    function wireModalElements(){
      modal    = document.getElementById('adjModal');
      closeBtn = document.getElementById('adjCloseBtn');
      applyBtn = document.getElementById('adjApply');
      clearBtn = document.getElementById('adjClear');
      selJ     = document.getElementById('adjJunc');
      off      = document.getElementById('adjOffset');
      clearAllBtn = document.getElementById('adjClearAll');
      listBox = document.getElementById('adjList');
      commitBtn = document.getElementById('adjCommit');

if(listBox){
  listBox.addEventListener('click', (ev)=>{
    const editKey = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-edit-adj');
    const delKey  = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-del-adj');
    const delTransferKey = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-del-transfer');

    if(editKey != null){
      if(editKey === 'offset'){
        const offInp = document.getElementById('adjOffset');
        if(offInp){ offInp.focus(); offInp.select && offInp.select(); }
      }else{
        const bidx = String(parseInt(editKey,10));
        const boxB = document.getElementById('adjBoundaries');
        if(boxB){
          const target = boxB.querySelector(`input[data-bidx="${bidx}"]`);
          if(target){ target.focus(); target.select && target.select(); }
        }
      }
      return; // don't fall through to delete
    }

    if(delKey != null){
      if(delKey === 'offset'){
        const offInp = document.getElementById('adjOffset');
        if(offInp){ offInp.value = '0'; }
        renderAdjustList();
        setStatus('Adjustment removed.');
      }else{
        const bidx = String(parseInt(delKey,10));
        const boxB = document.getElementById('adjBoundaries');
        if(boxB){
          const target = boxB.querySelector(`input[data-bidx="${bidx}"]`);
          if(target){ target.value = '0'; }
        }
        renderAdjustList();
        setStatus('Adjustment removed.');
      }
    }

    if(delTransferKey != null){
      const idx = parseInt(delTransferKey, 10);
      const selJ = document.getElementById('adjJunc');
      const id = selJ ? selJ.value : null;
      if(id && App.state.temp.transfers && App.state.temp.transfers[id]){
        App.state.temp.transfers[id].splice(idx, 1);
        if(App.state.temp.transfers[id].length === 0){
          delete App.state.temp.transfers[id];
        }
        renderAdjustList();
        if(App.state.readyToPlot && App.state.validOk){ drawHidden(); }
        setStatus('Transfer removed.');
      }
    }
  });
}

if(clearAllBtn){
  clearAllBtn.addEventListener('click', ()=>{
    const offInp = document.getElementById('adjOffset');
    if(offInp) offInp.value = '0';
    const boxB = document.getElementById('adjBoundaries');
    if(boxB){ boxB.querySelectorAll('input[data-bidx]').forEach(inp => inp.value = '0'); }
    renderAdjustList();
    setStatus('All adjustments cleared.');
  });
}


      if(!modal || wired) return !!modal;

      if(closeBtn) closeBtn.addEventListener('click', close);
      if(modal) modal.addEventListener('click', (e)=>{ if(e.target===modal) close(); });
      if(selJ) selJ.addEventListener('change', ()=>{
        const id = selJ.value; const v = (App.state.temp.offsets[id]||0); const offInp = document.getElementById('adjOffset'); if(offInp) offInp.value=String(v);
        renderB();
        renderAdjustList();
        populateStageTransferDropdowns();
      });

      // Wire up stage transfer UI
      const addTransferBtn = document.getElementById('adjAddTransfer');

      if(addTransferBtn){
        addTransferBtn.addEventListener('click', handleAddTransfer);
      }
    
    
      if(applyBtn) applyBtn.addEventListener('click', ()=>{
        const id = (document.getElementById('adjJunc')||{}).value; if(!id) return;
        const offInp = document.getElementById('adjOffset');
        App.state.temp.offsets[id] = parseInt(offInp && offInp.value || 0,10) || 0;
        if(App.state.readyToPlot && App.state.validOk){ drawHidden(); }
        setStatus('Offset applied (temporary).');
        renderAdjustList();
      });
      if(clearBtn) clearBtn.addEventListener('click', ()=>{
        const id = (document.getElementById('adjJunc')||{}).value; if(!id) return;
        if(App.state.temp.offsets) delete App.state.temp.offsets[id];
        if(App.state.temp.boundary) delete App.state.temp.boundary[id];
        if(App.state.temp.transfers) delete App.state.temp.transfers[id];
        const offInp = document.getElementById('adjOffset'); if(offInp) offInp.value='0';
        renderB();
        renderAdjustList();
        if(App.state.readyToPlot && App.state.validOk){ drawHidden(); }
        setStatus('Adjustments cleared for this junction.');
      });

      if(commitBtn){
  commitBtn.addEventListener('click', ()=>{
    try{
      // Apply current temporary adjustments to ALL junctions' UTC plans
      (App.state.junctions||[]).forEach((j)=>{
        // Build adjusted plan using current offsets/boundary tweaks/transfers
        const adj = getAdjustedPlan(j);

        // Persist adjusted times back into the real plan (whole seconds)
        j.utcPlan = adj.map(r=>({ to: r.to, at: Math.round(r.at) }));

        // Clear temporary adjustments for this junction
        if(App.state.temp && App.state.temp.offsets)  delete App.state.temp.offsets[j.id];
        if(App.state.temp && App.state.temp.boundary) delete App.state.temp.boundary[j.id];
        if(App.state.temp && App.state.temp.transfers) delete App.state.temp.transfers[j.id];
      });

      // Refresh UI and mark data as changed (forces re-Validate)
      rebuildTabs();
      setDirty();

      // Redraw plot if already plotted
      if(App.state.readyToPlot && App.state.validOk){
        drawHidden();
        drawLabels();
      }

      // Update status bar + refresh the modal’s lists
      setStatus('UTC plans updated from adjustments.');
      close();
      renderB();
      renderAdjustList();
    }catch(err){
  console.error(err);
  setStatus('❌ Update failed: ' + (err && err.message ? err.message : err));
}
    
    
  
  });
}

      wired = true;
      return true;
    }

    function open(){
      log('Adjust button clicked! Opening modal...', 'info');
      if(!wireModalElements()) return;
      fillJ();
      if(selJ && !selJ.value && selJ.options.length){ selJ.value = selJ.options[0].value; }
      const id = selJ ? selJ.value : null;
      const offInp = document.getElementById('adjOffset');
      if(offInp) offInp.value = String((id && App.state.temp.offsets[id]) || 0);
      renderB();
      renderAdjustList();
      populateStageTransferDropdowns();
      const m = document.getElementById('adjModal');
      if(m){ m.classList.add('show'); m.setAttribute('aria-hidden','false'); }
      if(m){ enableDragModal('adjModal'); }
    }
    function close(){ const m=document.getElementById('adjModal'); if(m){ m.classList.remove('show'); m.setAttribute('aria-hidden','true'); } }

    if(btn) {
      log('Adding click listener to adjustBtn', 'info');
      btn.addEventListener('click', open);
    } else {
      log('adjustBtn not found, cannot add listener', 'err');
    }
  }
  // --- Overlays modal wiring ---


  // --- Overlays modal wiring ---
  function wireOverlaysModal(){
    const btn = document.getElementById('overlayBtn');

    // Modal-scoped refs are lazily assigned when the modal is first opened
    let modalWired = false;
    let editingIndex = -1; // -1 => creating, >=0 => editing existing overlay

    // element refs (assigned in wireModalElements)
    let modal, closeBtn, cancelBtn, saveBtn, selFrom, selTo, modeSel, s, e, col, a, selStage, stageGroup, timeGroup, stageToStageGroup, selFromStage, selFromEdge, selToStage, selToEdge, listBox;

    function updateModeVisibility(){
      if(!modeSel || !stageGroup || !timeGroup || !stageToStageGroup) return;
      const m = (modeSel && modeSel.value) || 'stage';
      stageGroup.style.display = (m==='stage') ? '' : 'none';
      stageToStageGroup.style.display = (m==='stage-to-stage') ? '' : 'none';
      timeGroup.style.display  = (m==='time')  ? '' : 'none';
    }

    function populateStages(){
      if(!selStage || !selFrom) return;
      selStage.innerHTML='';
      const fromIdx = parseInt(selFrom && selFrom.value || '0',10) || 0;
      const J = (App.state.junctions||[])[fromIdx];
      const stages = (J && Array.isArray(J.stages)) ? J.stages : [];
      stages.forEach(st=>{
        const opt=document.createElement('option');
        opt.value = st.label;       // value is stage label
        opt.textContent = st.label; // display label
        selStage.appendChild(opt);
      });
    }

    function populateStageToStageDropdowns(){
      if(!selFromStage || !selToStage || !selFrom) return;
      const fromIdx = parseInt(selFrom && selFrom.value || '0',10) || 0;
      const J = (App.state.junctions||[])[fromIdx];
      const stages = (J && Array.isArray(J.stages)) ? J.stages : [];

      // Populate both from-stage and to-stage with the same stages from origin junction
      [selFromStage, selToStage].forEach(sel => {
        sel.innerHTML = '';
        stages.forEach(st=>{
          const opt=document.createElement('option');
          opt.value = st.label;
          opt.textContent = st.label;
          sel.appendChild(opt);
        });
      });
    }

    function populateJunctions(){
      const juncs = (App.state.junctions||[]);
      function fillJ(sel){
        if(!sel) return; sel.innerHTML='';
        juncs.forEach((j,idx)=>{
          const opt=document.createElement('option');
          opt.value=String(idx);
          opt.textContent=j.name; // show junction name
          sel.appendChild(opt);
        });
      }
      fillJ(selFrom);
      populateToJunctions(); // Fill "To" based on "From" selection
      populateStages();
      populateStageToStageDropdowns();
      updateModeVisibility();
    }

    function populateToJunctions(){
      if(!selTo || !selFrom) return;
      const juncs = (App.state.junctions||[]);
      const fromIdx = parseInt(selFrom.value || '0', 10);

      selTo.innerHTML = '';

      // Add only adjacent junctions
      const adjacent = [];
      if(fromIdx > 0){
        adjacent.push(fromIdx - 1); // Previous junction
      }
      if(fromIdx < juncs.length - 1){
        adjacent.push(fromIdx + 1); // Next junction
      }

      adjacent.forEach(idx=>{
        const j = juncs[idx];
        if(j){
          const opt = document.createElement('option');
          opt.value = String(idx);
          opt.textContent = j.name;
          selTo.appendChild(opt);
        }
      });

      // Select the first adjacent junction by default
      if(selTo.options.length > 0){
        selTo.selectedIndex = 0;
      }
    }

    function prefillOverlayForm(ovl){
      try{
        if(!ovl) return;
        if(selFrom){ selFrom.value = String(ovl.from||0); }
        populateToJunctions(); // Update "To" options based on "From"
        if(selTo){   selTo.value   = String(ovl.to||0); }
        populateStages();
        populateStageToStageDropdowns();
        if(modeSel){ modeSel.value = ovl.mode || 'stage'; }
        updateModeVisibility();
        if((ovl.mode||'stage') === 'stage'){
          if(selStage && ovl.stage){ selStage.value = ovl.stage; }
        }else if(ovl.mode === 'stage-to-stage'){
          if(selFromStage && ovl.fromStage){ selFromStage.value = ovl.fromStage; }
          if(selFromEdge && ovl.fromEdge){ selFromEdge.value = ovl.fromEdge; }
          if(selToStage && ovl.toStage){ selToStage.value = ovl.toStage; }
          if(selToEdge && ovl.toEdge){ selToEdge.value = ovl.toEdge; }
        }else{
          if(s){ s.value = String(Math.max(0, ovl.start||0)); }
          if(e){ e.value = String(Math.max(0, ovl.end||0)); }
        }
        if(col){ col.value = ovl.color || '#ffa500'; }
        if(a){ a.value = String(typeof ovl.alpha==='number' ? ovl.alpha : 0.3); }
      }catch(_){/* ignore */}
    }

    function renderOverlayList(){
      const box = document.getElementById('ovlList');
      if(!box) return;
      const list = Array.isArray(App.state._overlays) ? App.state._overlays : [];
      if(list.length === 0){
        box.innerHTML = '<div class="muted" style="font-size:12px">No overlays yet.</div>';
        return;
      }
      const juncs = App.state.junctions||[];
      const rows = list.map((o,idx)=>{
        const jf = juncs[o.from] ? juncs[o.from].name : ('J'+o.from);
        const jt = juncs[o.to]   ? juncs[o.to].name   : ('J'+o.to);
        const mode = o.mode || 'stage';
        let detail = '—';
        if(mode === 'stage'){
          detail = o.stage || '—';
        }else if(mode === 'stage-to-stage'){
          const fs = o.fromStage || '?';
          const fe = o.fromEdge === 'end' ? 'end' : 'start';
          const ts = o.toStage || '?';
          const te = o.toEdge === 'end' ? 'end' : 'start';
          detail = `${fs}(${fe}) → ${ts}(${te})`;
        }else{
          detail = `${o.start||0}–${o.end||0}s`;
        }
        const swatch = `<span style="display:inline-block;width:10px;height:10px;background:${o.color||'#ffa500'};border:1px solid #ccc;border-radius:2px;vertical-align:middle;margin-right:6px"></span>`;
        return `<tr>
          <td style="text-align:left">${swatch}${jf} → ${jt}</td>
          <td>${mode}</td>
          <td>${detail}</td>
          <td style="white-space:nowrap">
            <button data-edit-ovl="${idx}">Edit</button>
            <button data-del-ovl="${idx}">Delete</button>
          </td>
        </tr>`;
      }).join('');
      box.innerHTML = `<table class="grid"><thead><tr><th>Route</th><th>Mode</th><th>Stage / Time</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>
        <div style="margin-top:8px;display:flex;justify-content:flex-end"><button data-clear-all>Clear all</button></div>`;
    }

    function wireModalElements(){
      if(modalWired) return true;
      // query elements now that modal exists in DOM
      modal     = document.getElementById('ovlModal');
      closeBtn  = document.getElementById('ovlCloseBtn');
      cancelBtn = document.getElementById('ovlCancel');
      saveBtn   = document.getElementById('ovlSave');
      selFrom   = document.getElementById('ovlFrom');
      selTo     = document.getElementById('ovlTo');
      modeSel   = document.getElementById('ovlMode');
      s         = document.getElementById('ovlStart');
      e         = document.getElementById('ovlEnd');
      col       = document.getElementById('ovlColor');
      a         = document.getElementById('ovlAlpha');
      selStage  = document.getElementById('ovlStage');
      stageGroup= document.getElementById('stageGroup');
      stageToStageGroup = document.getElementById('stageToStageGroup');
      selFromStage = document.getElementById('ovlFromStage');
      selFromEdge = document.getElementById('ovlFromEdge');
      selToStage = document.getElementById('ovlToStage');
      selToEdge = document.getElementById('ovlToEdge');
      timeGroup = document.getElementById('timeGroup');
      listBox   = document.getElementById('ovlList');

// Quick colour presets click handler
(function(){
  const quick = document.getElementById('ovlColorQuick');
  if(!quick) return;
  quick.addEventListener('click', (ev)=>{
    const btn = ev.target.closest && ev.target.closest('.swatch-btn');
    if(!btn) return;
    const v = btn.getAttribute('data-color');
    if(v && col){
      col.value = v;
    }
  });
})();

      if(!modal) return false;

      if(modeSel){ modeSel.addEventListener('change', updateModeVisibility); }
      if(selFrom){
        selFrom.addEventListener('change', ()=>{
          populateToJunctions();
          populateStages();
          populateStageToStageDropdowns();
        });
      }

      if(listBox){
        listBox.addEventListener('click', (ev)=>{
          const editIdx = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-edit-ovl');
          if(editIdx!=null){
            const i = parseInt(editIdx,10);
            if(Array.isArray(App.state._overlays) && i>=0 && i < App.state._overlays.length){
              editingIndex = i;
              if(saveBtn) saveBtn.textContent = 'Update overlay';
              if(!modal.classList.contains('show')){
                modal.classList.add('show');
                modal.setAttribute('aria-hidden','false');
              }
              populateJunctions();
              prefillOverlayForm(App.state._overlays[i]);
            }
            return; // don't fall through
          }
          const delIdx = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-del-ovl');
          if(delIdx!=null){
            const i = parseInt(delIdx,10);
            if(Array.isArray(App.state._overlays) && i>=0 && i < App.state._overlays.length){
              App.state._overlays.splice(i,1);
              renderOverlayList();
              if(App.state.readyToPlot && App.state.validOk){ drawHidden(); }
            setStatus('Overlay deleted.');
            }
          }
          
          if(ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-clear-all')){
            if(Array.isArray(App.state._overlays) && App.state._overlays.length){
              App.state._overlays.length = 0;
              renderOverlayList();
              if(App.state.readyToPlot && App.state.validOk){ drawHidden(); }
              setStatus('All overlays cleared.');
            }
          }
        });
      }

      if(closeBtn){ closeBtn.addEventListener('click', closeModal); }
      if(cancelBtn){ cancelBtn.addEventListener('click', closeModal); }
      if(modal){ modal.addEventListener('click', (ev)=>{ if(ev.target===modal) closeModal(); }); }

      // Save / Update overlay
      if(saveBtn){
        saveBtn.addEventListener('click', ()=>{
          try{
            App.state._overlays = App.state._overlays || [];
            const mode = (modeSel && modeSel.value) || 'stage';
            const ovl = {
              from: parseInt(selFrom.value||'0',10) || 0,
              to:   parseInt(selTo.value||'0',10)   || 0,
              mode,
              color: (col && col.value) || '#ffa500',
              alpha: Math.max(0, Math.min(1, parseFloat((a && a.value) || '0.3') || 0.3))
            };
            if(mode === 'stage'){
              ovl.stage = (selStage && selStage.value) || null;
            }else if(mode === 'stage-to-stage'){
              ovl.fromStage = (selFromStage && selFromStage.value) || null;
              ovl.fromEdge = (selFromEdge && selFromEdge.value) || 'start';
              ovl.toStage = (selToStage && selToStage.value) || null;
              ovl.toEdge = (selToEdge && selToEdge.value) || 'start';
            }else{
              ovl.start = Math.max(0, parseFloat((s && s.value) || '0') || 0);
              ovl.end   = Math.max(ovl.start, Math.max(0, parseFloat((e && e.value) || '0') || 0));
            }

            if(editingIndex >= 0){
              App.state._overlays[editingIndex] = ovl;
              setStatus('Overlay updated.');
            }else{
              App.state._overlays.push(ovl);
              setStatus('Overlay saved.');
            }

            renderOverlayList();
            if(App.state.readyToPlot && App.state.validOk){ drawHidden(); }
            closeModal();
          }catch(err){
            console.error(err);
            setStatus('❌ Save overlay failed: ' + (err && err.message ? err.message : err));
          }
        });
      }

      // Escape to close (query modal each time to avoid stale refs)
      document.addEventListener('keydown', (ev)=>{ const m=document.getElementById('ovlModal'); if(ev.key==='Escape' && m && m.classList.contains('show')) closeModal(); });

      modalWired = true;
      return true;
    }

    function openModal(){
      log('Overlays button clicked! Opening modal...', 'info');
      editingIndex = -1;
      if(!modalWired){ if(!wireModalElements()) return; }
      if(saveBtn) saveBtn.textContent = 'Save overlay';
      populateJunctions();
      renderOverlayList();
      modal.classList.add('show');
      modal.setAttribute('aria-hidden','false');
      enableDragModal('ovlModal');
    }

    function closeModal(){
      editingIndex = -1;
      if(saveBtn) saveBtn.textContent = 'Save overlay';
      const m = document.getElementById('ovlModal');
      if(m){ m.classList.remove('show'); m.setAttribute('aria-hidden','true'); }
    }

    if(btn){ btn.addEventListener('click', openModal); }
  }

  // View Plans modal
  function wirePlansModal(){
    const btn = document.getElementById('viewPlansBtn');
    let modal, closeBtn1, closeBtn2, copyBtn, printBtn, content;
    let modalWired = false;

    function wireModalElements(){
      modal = document.getElementById('plansModal');
      closeBtn1 = document.getElementById('plansCloseBtn');
      closeBtn2 = document.getElementById('plansClose');
      copyBtn = document.getElementById('plansCopy');
      printBtn = document.getElementById('plansPrint');
      content = document.getElementById('plansContent');
      if(!(modal && closeBtn1 && closeBtn2 && copyBtn && printBtn && content)) return false;
      closeBtn1.addEventListener('click', closeModal);
      closeBtn2.addEventListener('click', closeModal);
      copyBtn.addEventListener('click', handleCopy);
      printBtn.addEventListener('click', handlePrint);
      modal.addEventListener('click', (e)=>{ if(e.target === modal) closeModal(); });
      document.addEventListener('keydown', (ev)=>{
        const m = document.getElementById('plansModal');
        if(ev.key==='Escape' && m && m.classList.contains('show')) closeModal();
      });
      modalWired = true;
      return true;
    }

    function renderPlans(){
      const junctions = App.state.junctions || [];
      if(junctions.length === 0){
        content.innerHTML = '<p class="muted">No junctions defined.</p>';
        return;
      }

      // Create columns for each junction
      let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;">';

      junctions.forEach(j => {
        const cycleTime = j.doubleCycle ? App.state.mainCycle / 2 : App.state.mainCycle;
        const offset = j.offset || 0;
        const plan = getAdjustedPlan(j);

        html += `<div style="border:1px solid var(--line);border-radius:8px;padding:12px;font-family:monospace;">`;
        html += `<div style="margin-bottom:8px;"><strong>Junction: ${j.name}</strong></div>`;

        // Single grid for all rows with aligned colons and right-aligned values
        html += `<div style="display:grid;grid-template-columns:auto auto auto;gap:0 8px;width:fit-content;">`;
        html += `<div style="text-align:right;">Cycle</div><div>:</div><div style="text-align:right;">${cycleTime}s</div>`;
        html += `<div style="text-align:right;">Offset</div><div>:</div><div style="text-align:right;">${offset}s</div>`;

        if(plan && plan.length > 0){
          // Group by stage number
          const stageMap = new Map();
          plan.forEach(p => {
            const stageNum = j.stages.findIndex(s => s.label === p.to) + 1;
            if(!stageMap.has(stageNum)){
              stageMap.set(stageNum, []);
            }
            stageMap.get(stageNum).push(p.at);
          });

          // Add separator row
          html += `<div style="grid-column:1/-1;border-top:1px solid var(--line);margin:4px 0;"></div>`;

          // Force stage times - continue in same grid
          const sortedStages = Array.from(stageMap.keys()).sort((a,b) => a-b);
          sortedStages.forEach(stageNum => {
            const times = stageMap.get(stageNum).sort((a,b) => a-b);
            times.forEach(time => {
              html += `<div style="text-align:right;">F${stageNum}</div><div>:</div><div style="text-align:right;">${time}s</div>`;
            });
          });
        } else {
          // Add separator row
          html += `<div style="grid-column:1/-1;border-top:1px solid var(--line);margin:4px 0;"></div>`;
          html += `<div style="grid-column:1/-1;" class="muted">No plan defined</div>`;
        }

        html += `</div></div>`;
      });

      html += '</div>';
      content.innerHTML = html;
    }

    function openModal(){
      if(!modalWired){ if(!wireModalElements()) return; }
      renderPlans();
      modal.classList.add('show');
      modal.setAttribute('aria-hidden','false');
      enableDragModal('plansModal');
    }

    function closeModal(){
      const m = document.getElementById('plansModal');
      if(m){ m.classList.remove('show'); m.setAttribute('aria-hidden','true'); }
    }

    function handleCopy(){
      const junctions = App.state.junctions || [];
      if(junctions.length === 0) return;

      let text = 'UTC Plans\n\n';

      junctions.forEach(j => {
        const cycleTime = j.doubleCycle ? App.state.mainCycle / 2 : App.state.mainCycle;
        const offset = j.offset || 0;
        const plan = getAdjustedPlan(j);

        text += `Junction: ${j.name}\n`;
        text += `Cycle  : ${cycleTime}s\n`;
        text += `Offset : ${offset}s\n`;

        if(plan && plan.length > 0){
          const stageMap = new Map();
          plan.forEach(p => {
            const stageNum = j.stages.findIndex(s => s.label === p.to) + 1;
            if(!stageMap.has(stageNum)){
              stageMap.set(stageNum, []);
            }
            stageMap.get(stageNum).push(p.at);
          });

          const sortedStages = Array.from(stageMap.keys()).sort((a,b) => a-b);
          sortedStages.forEach(stageNum => {
            const times = stageMap.get(stageNum).sort((a,b) => a-b);
            times.forEach(time => {
              text += `F${stageNum}     : ${time}s\n`;
            });
          });
        } else {
          text += 'No plan defined\n';
        }

        text += '\n';
      });

      navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
      }).catch(err => {
        alert('Failed to copy to clipboard');
        console.error('Copy failed:', err);
      });
    }

    function handlePrint(){
      const junctions = App.state.junctions || [];
      if(junctions.length === 0) return;

      // Create a print-friendly version
      let printContent = '<html><head><title>UTC Plans</title>';
      printContent += '<style>body{font-family:monospace;padding:20px;}';
      printContent += '.junction{page-break-inside:avoid;margin-bottom:30px;border:1px solid #ccc;padding:15px;border-radius:8px;}';
      printContent += '.header{font-weight:bold;margin-bottom:10px;}';
      printContent += '.grid{display:grid;grid-template-columns:auto auto auto;gap:0 8px;width:fit-content;}';
      printContent += '.grid div{text-align:right;}';
      printContent += '.separator{border-top:1px solid #ccc;margin:8px 0;grid-column:1/-1;}';
      printContent += '@media print{.junction{page-break-inside:avoid;}}</style></head><body>';

      printContent += '<h1>UTC Plans</h1>';

      junctions.forEach(j => {
        const cycleTime = j.doubleCycle ? App.state.mainCycle / 2 : App.state.mainCycle;
        const offset = j.offset || 0;
        const plan = getAdjustedPlan(j);

        printContent += '<div class="junction">';
        printContent += `<div class="header">Junction: ${j.name}</div>`;
        printContent += '<div class="grid">';
        printContent += `<div>Cycle</div><div>:</div><div>${cycleTime}s</div>`;
        printContent += `<div>Offset</div><div>:</div><div>${offset}s</div>`;

        if(plan && plan.length > 0){
          const stageMap = new Map();
          plan.forEach(p => {
            const stageNum = j.stages.findIndex(s => s.label === p.to) + 1;
            if(!stageMap.has(stageNum)){
              stageMap.set(stageNum, []);
            }
            stageMap.get(stageNum).push(p.at);
          });

          printContent += '<div class="separator"></div>';

          const sortedStages = Array.from(stageMap.keys()).sort((a,b) => a-b);
          sortedStages.forEach(stageNum => {
            const times = stageMap.get(stageNum).sort((a,b) => a-b);
            times.forEach(time => {
              printContent += `<div>F${stageNum}</div><div>:</div><div>${time}s</div>`;
            });
          });
        } else {
          printContent += '<div class="separator"></div>';
          printContent += '<div style="grid-column:1/-1;">No plan defined</div>';
        }

        printContent += '</div></div>';
      });

      printContent += '</body></html>';

      // Open print window
      const printWindow = window.open('', '_blank');
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }

    if(btn){ btn.addEventListener('click', openModal); }
  }
