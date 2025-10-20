// Signal Plan Checker v2.6.2 - Boot Module
// Application initialization

async function loadBundledInit(){
  const DEFAULT_CFG = {"appName":"Signal Plan Checker","ui":{"debug":{"enabled":true,"dock":{"showOnLoad":false},"logLevel":"info","validationOnActions":false,"perfMarkers":true}},"mainCycleTime":{"default":60,"min":1,"max":240,"mustBeEvenWhenAnyDouble":true},"junctionCount":{"default":3,"min":2,"max":5},"doubleCycle":{"allowed":true,"requireAtLeastOneMainCycle":true},"stageCount":{"default":2,"min":2},"stage":{"minGreen":{"default":7,"min":1}},"intergreen":{"diagonalLockedValue":-1,"allowNotPermittedValue":-1,"defaults":{"offDiagonal":5},"domain":{"min":0,"max":60}},"journeyTime":{"default":20,"min":0,"max":60},"utcPlan":{"requireAtLeastOneChange":true,"markRequestsBlue":true,"showQueuedChangeMarkers":true,"warnOnDelay":true,"alertOnMissedChange":true,"defaults":[{"to":"S1","at":0},{"to":"S2","at":30}]},"plot":{"hiddenWindowMultiplier":5,"viewCycles":{"options":[1,2,3],"default":2},"grid10s":true,"ticks1s":true,"ticks5s":true,"rowHeight":48,"rowGap":18,"leftMargin":120,"topMargin":24,"pxPerSec":4},"overlays":{"adjacentOnly":true,"defaultOpacity":0.8,"shadeAlpha":0.15,"repeatByCycle":true,"allowCustomIntervals":true},"packaging":{"includeDocs":true}};
  try{
    // If running from file://, avoid fetch() CORS and use inline JSON if provided
    if (location && location.protocol === 'file:'){
      const node = document.getElementById('initCfg');
      if(node && node.textContent){
        try { return JSON.parse(node.textContent); } catch(_) { /* fall through to default */ }
      }
      return DEFAULT_CFG;
    }
    // Normal case when served over http/https
    const res = await fetch('init.config.json', { cache: 'no-store' });
    if(res.ok){ return await res.json(); }
    // As a fallback, try inline JSON if present
    const node = document.getElementById('initCfg');
    if(node && node.textContent){
      try { return JSON.parse(node.textContent); } catch(_) { /* fall through */ }
    }
    return DEFAULT_CFG;
  }catch(e){
    return DEFAULT_CFG;
  }
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

  // apply time transfers
  const transfers = (App.state.temp && App.state.temp.transfers && App.state.temp.transfers[j.id]) || [];
  if(transfers.length > 0){
    let workingPlan = base;
    for(let t of transfers){
      const result = calculateStageTimeTransfer(j, workingPlan, t.donor, t.recipient, t.amount, t.fixedPoint);
      if(result.ok){
        workingPlan = result.newPlan;
      }
    }
    return workingPlan.sort((a,b)=>a.at-b.at);
  }

  return base;
}

// Calculate time transfer between stages
// Takes a plan directly to avoid circular dependency with getAdjustedPlan
// Returns {ok: boolean, err?: string, newPlan?: array, affected?: array, preview?: string}
function calculateStageTimeTransfer(j, planOrNull, donorStageLabel, recipientStageLabel, transferSeconds, fixedPoint){
  const Cj = effectiveCycle(j);
  const plan = planOrNull || getAdjustedPlan(j); // Use provided plan, or get adjusted plan if null
  const N = plan.length;
  if(N === 0) return {ok: false, err: 'UTC plan is empty'};

  // Find donor and recipient indices
  const donorIdx = plan.findIndex(p => p.to === donorStageLabel);
  const recipientIdx = plan.findIndex(p => p.to === recipientStageLabel);

  if(donorIdx < 0) return {ok: false, err: `Donor stage "${donorStageLabel}" not found in UTC plan`};
  if(recipientIdx < 0) return {ok: false, err: `Recipient stage "${recipientStageLabel}" not found in UTC plan`};
  if(donorIdx === recipientIdx) return {ok: false, err: 'Donor and recipient must be different stages'};
  if(transferSeconds <= 0) return {ok: false, err: 'Transfer time must be positive'};

  // Calculate current stage durations
  const getStageDuration = (idx) => {
    const start = plan[idx].at;
    const end = plan[(idx + 1) % N].at;
    return end > start ? (end - start) : (end + Cj - start);
  };

  const donorDuration = getStageDuration(donorIdx);
  const donorMinGreen = j.stages[stageIndex(j, plan[donorIdx].to)].minGreenSec || 0;

  // Check if donor has enough time to give
  const maxTransfer = donorDuration - donorMinGreen;
  if(transferSeconds > maxTransfer){
    return {ok: false, err: `Cannot transfer ${transferSeconds}s: donor stage has ${donorDuration}s, needs minimum ${donorMinGreen}s (max transfer: ${maxTransfer}s)`};
  }

  // Build new plan with transferred time
  const newPlan = plan.map(p => ({...p}));
  const affected = [];

  // Determine direction (forward means recipient is later in the cycle than donor)
  const isForward = recipientIdx > donorIdx;

  if(fixedPoint === 'eog'){
    // End of Green fixed: donor's END stays at same position
    // The donor's end = the next stage's start (which is plan[donorIdx+1].at)
    // So we DON'T move plan[donorIdx+1], instead we move plan[donorIdx]

    // Move donor's START later by transferSeconds
    newPlan[donorIdx].at = (newPlan[donorIdx].at + transferSeconds) % Cj;
    if(newPlan[donorIdx].at < 0) newPlan[donorIdx].at += Cj;

    if(isForward){
      // Donor -> ... -> Recipient
      // Recipient's END needs to extend by transferSeconds
      // Recipient's end = next stage's start (wraps if at end of plan)
      const nextAfterRecipient = (recipientIdx + 1) % N;

      // Only move nextAfterRecipient if it's not the donor (avoid double-shift in 2-stage plans)
      if(nextAfterRecipient !== donorIdx){
        newPlan[nextAfterRecipient].at = (newPlan[nextAfterRecipient].at + transferSeconds) % Cj;
        if(newPlan[nextAfterRecipient].at < 0) newPlan[nextAfterRecipient].at += Cj;
      }

      // No intermediate stages need to move - they maintain their positions
      // But list them as affected since they're between donor and recipient
      for(let i = donorIdx + 1; i < recipientIdx; i++){
        affected.push(plan[i].to);
      }
    } else {
      // Recipient -> ... -> Donor (wraps around)
      const nextAfterRecipient = (recipientIdx + 1) % N;

      // Only move nextAfterRecipient if it's not the donor
      if(nextAfterRecipient !== donorIdx){
        newPlan[nextAfterRecipient].at = (newPlan[nextAfterRecipient].at + transferSeconds) % Cj;
        if(newPlan[nextAfterRecipient].at < 0) newPlan[nextAfterRecipient].at += Cj;
      }

      // List wrapped stages as affected
      for(let i = donorIdx + 1; i < N; i++) affected.push(plan[i].to);
      for(let i = 0; i < recipientIdx; i++) affected.push(plan[i].to);
    }
  } else { // sog
    // Start of Green fixed: donor's START stays at same position
    // Don't move plan[donorIdx]
    // Move donor's END earlier = move next stage's start earlier

    const nextAfterDonor = (donorIdx + 1) % N;

    if(isForward){
      // Donor -> ... -> Recipient
      // Move the stage immediately after donor
      newPlan[nextAfterDonor].at = (newPlan[nextAfterDonor].at - transferSeconds) % Cj;
      if(newPlan[nextAfterDonor].at < 0) newPlan[nextAfterDonor].at += Cj;

      // If there are intermediate stages between nextAfterDonor and recipient, they all shift earlier too
      for(let i = donorIdx + 2; i <= recipientIdx; i++){
        newPlan[i].at = (newPlan[i].at - transferSeconds) % Cj;
        if(newPlan[i].at < 0) newPlan[i].at += Cj;
        if(i < recipientIdx) affected.push(plan[i].to);
      }
    } else {
      // Recipient -> ... -> Donor (wraps around)
      // Move the stage immediately after donor
      newPlan[nextAfterDonor].at = (newPlan[nextAfterDonor].at - transferSeconds) % Cj;
      if(newPlan[nextAfterDonor].at < 0) newPlan[nextAfterDonor].at += Cj;

      // All stages from donorIdx+2 to end shift earlier (if any exist)
      for(let i = donorIdx + 2; i < N; i++){
        newPlan[i].at = (newPlan[i].at - transferSeconds) % Cj;
        if(newPlan[i].at < 0) newPlan[i].at += Cj;
        affected.push(plan[i].to);
      }

      // All stages from 0 to recipientIdx shift earlier (but only if not already moved)
      // Skip if nextAfterDonor wraps to 0 and recipientIdx is 0 (already moved above)
      const startIdx = (nextAfterDonor === 0) ? 1 : 0;
      for(let i = startIdx; i <= recipientIdx; i++){
        newPlan[i].at = (newPlan[i].at - transferSeconds) % Cj;
        if(newPlan[i].at < 0) newPlan[i].at += Cj;
        if(i < recipientIdx) affected.push(plan[i].to);
      }
    }
  }

  newPlan.sort((a,b) => a.at - b.at);

  // Build preview text
  const affectedText = affected.length > 0 ? ` Intermediate stages shifted: ${affected.join(', ')}.` : ' No intermediate stages affected.';
  const preview = `Transfer ${transferSeconds}s from ${donorStageLabel} to ${recipientStageLabel} (fixed: ${fixedPoint.toUpperCase()}).${affectedText}`;

  return {ok: true, newPlan, affected, preview};
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
  for(let i=0;i<N;i++){
    const from = toIdx[i];
    const to = toIdx[(i+1)%N];
    if(j.intergreen[from][to] === -1){
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
    const igPrev = Math.max(0, j.intergreen[prevIdx][curIdx]);
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
    const igPrev = Math.max(0, j.intergreen[prevIdx][curIdx]);
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

function drawArrowMarker(ctx, x, yMid, dir){
  // dir: +1 (down), -1 (up)
  const len = 8, hw = 6; // head width
  ctx.beginPath();
  if(dir>0){
    ctx.moveTo(x, yMid - len);
    ctx.lineTo(x, yMid + len);
    ctx.moveTo(x - hw/2, yMid + len - hw);
    ctx.lineTo(x, yMid + len);
    ctx.lineTo(x + hw/2, yMid + len - hw);
  }else{
    ctx.moveTo(x, yMid + len);
    ctx.lineTo(x, yMid - len);
    ctx.moveTo(x - hw/2, yMid - len + hw);
    ctx.lineTo(x, yMid - len);
    ctx.lineTo(x + hw/2, yMid - len + hw);
  }
  ctx.stroke();
}

function drawArrowMarkerH(ctx, xMid, y){
  // small right-pointing arrow centered at (xMid, y)
  const len = 10;
  ctx.beginPath();
  ctx.moveTo(xMid - len/2, y);
  ctx.lineTo(xMid + len/2, y);
  ctx.stroke();
  // arrow head to the right
  ctx.beginPath();
  ctx.moveTo(xMid + len/2, y);
  ctx.lineTo(xMid + len/2 - 6, y - 4);
  ctx.lineTo(xMid + len/2 - 6, y + 4);
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

function drawArrowHeadRight(ctx, x, y){
  // small filled triangle pointing right, with tip at (x,y)
  const size = 7;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size, y - size*0.6);
  ctx.lineTo(x - size, y + size*0.6);
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

function drawArrowLine(ctx, x1, y1, x2, y2){
  // diagonal line from (x1,y1) to (x2,y2) with an arrow head at end
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const size = 9;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size*Math.cos(ang - Math.PI/6), y2 - size*Math.sin(ang - Math.PI/6));
  ctx.lineTo(x2 - size*Math.cos(ang + Math.PI/6), y2 - size*Math.sin(ang + Math.PI/6));
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

//(8)
// Draw direction icons inside a green bar.
// dir can be: old string format ('E', 'W', etc.) or new object format {primary, primaryMoves, secondary, secondaryMoves}
function drawStageDirIcon(ctx, dir, x, y){
  if (!dir || dir === 'none') return;

  // Parse direction data to handle both old and new formats
  let dirData;
  if(typeof dir === 'string'){
    // Old format - convert to new format for rendering
    if(dir === 'P') dirData = {primary: 'P', primaryMoves: []};
    else if(dir === 'E') dirData = {primary: 'E', primaryMoves: ['A']};
    else if(dir === 'W') dirData = {primary: 'W', primaryMoves: ['A']};
    else if(dir === 'N') dirData = {primary: 'N', primaryMoves: ['A']};
    else if(dir === 'S') dirData = {primary: 'S', primaryMoves: ['A']};
    else if(dir === 'EW') dirData = {primary: 'E', primaryMoves: ['A'], secondary: 'W', secondaryMoves: ['A']};
    else if(dir === 'NS') dirData = {primary: 'N', primaryMoves: ['A'], secondary: 'S', secondaryMoves: ['A']};
    else return;
  }else if(typeof dir === 'object'){
    dirData = dir;
  }else{
    return;
  }

  // Handle pedestrian separately
  if(dirData.primary === 'P'){
    drawPedestrianIcon(ctx, x, y);
    return;
  }

  if(dirData.primary === 'none' || !dirData.primary) return;

  ctx.save();

  // Enhanced styling: bolder arrows with better visibility
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;

  // Draw arrows for primary and secondary directions
  drawDirectionArrows(ctx, dirData.primary, dirData.primaryMoves || [], x, y);
  if(dirData.secondary && dirData.secondary !== 'none'){
    drawDirectionArrows(ctx, dirData.secondary, dirData.secondaryMoves || [], x, y);
  }

  ctx.restore();
}

// Helper function to draw arrows for a specific direction and its moves
// 5x5 GRID APPROACH (UK left-hand traffic):
// - N (heading North from South): arrows point UP ↑, positioned at BOTTOM
// - S (heading South from North): arrows point DOWN ↓, positioned at TOP
// - E (heading East from West): arrows point RIGHT →, positioned at LEFT
// - W (heading West from East): arrows point LEFT ←, positioned at RIGHT
// Movement types (UK): A=ahead (straight), L=left turn, R=right turn
function drawDirectionArrows(ctx, compass, moves, x, y){
  if(!compass || compass === 'none' || !moves || moves.length === 0) return;

  // Compact sizing to fit in stage bars
  const shaftLen = 10;  // length of main shaft
  const turnLen = 4;    // length of turn indicator
  const headSize = 3;   // arrowhead size
  const spacing = 6;    // spacing between multiple arrows

  // Helper to draw arrowhead
  function drawHead(x, y, dir){
    ctx.beginPath();
    if(dir === 'up'){
      ctx.moveTo(x, y);
      ctx.lineTo(x - headSize, y + headSize);
      ctx.lineTo(x + headSize, y + headSize);
    }else if(dir === 'down'){
      ctx.moveTo(x, y);
      ctx.lineTo(x - headSize, y - headSize);
      ctx.lineTo(x + headSize, y - headSize);
    }else if(dir === 'left'){
      ctx.moveTo(x, y);
      ctx.lineTo(x + headSize, y - headSize);
      ctx.lineTo(x + headSize, y + headSize);
    }else if(dir === 'right'){
      ctx.moveTo(x, y);
      ctx.lineTo(x - headSize, y - headSize);
      ctx.lineTo(x - headSize, y + headSize);
    }
    ctx.closePath();
    ctx.fill();
  }

  if(compass === 'N'){
    // N (heading North from South): arrows point UP, at BOTTOM of grid
    const baseY = y + 12;
    const xPositions = moves.length === 1 ? [x] :
                       moves.length === 2 ? [x - spacing/2, x + spacing/2] :
                       [x - spacing, x, x + spacing];

    moves.forEach((move, idx) => {
      const cx = xPositions[idx];
      ctx.beginPath();
      ctx.moveTo(cx, baseY);
      ctx.lineTo(cx, baseY - shaftLen);
      ctx.stroke();

      if(move === 'A'){
        // Ahead: straight up (North)
        drawHead(cx, baseY - shaftLen, 'up');
      }else if(move === 'L'){
        // Left turn: heading North, turn left = West (UK left-hand)
        ctx.moveTo(cx, baseY - shaftLen);
        ctx.lineTo(cx - turnLen, baseY - shaftLen);
        ctx.stroke();
        drawHead(cx - turnLen, baseY - shaftLen, 'left');
      }else if(move === 'R'){
        // Right turn: heading North, turn right = East (UK left-hand)
        ctx.moveTo(cx, baseY - shaftLen);
        ctx.lineTo(cx + turnLen, baseY - shaftLen);
        ctx.stroke();
        drawHead(cx + turnLen, baseY - shaftLen, 'right');
      }
    });
  }else if(compass === 'S'){
    // S (heading South from North): arrows point DOWN, at TOP of grid
    const baseY = y - 12;
    const xPositions = moves.length === 1 ? [x] :
                       moves.length === 2 ? [x - spacing/2, x + spacing/2] :
                       [x - spacing, x, x + spacing];

    moves.forEach((move, idx) => {
      const cx = xPositions[idx];
      ctx.beginPath();
      ctx.moveTo(cx, baseY);
      ctx.lineTo(cx, baseY + shaftLen);
      ctx.stroke();

      if(move === 'A'){
        // Ahead: straight down (South)
        drawHead(cx, baseY + shaftLen, 'down');
      }else if(move === 'L'){
        // Left turn: heading South, turn left = East (UK left-hand) - appears LEFT on diagram
        ctx.moveTo(cx, baseY + shaftLen);
        ctx.lineTo(cx - turnLen, baseY + shaftLen);
        ctx.stroke();
        drawHead(cx - turnLen, baseY + shaftLen, 'left');
      }else if(move === 'R'){
        // Right turn: heading South, turn right = West (UK left-hand) - appears RIGHT on diagram
        ctx.moveTo(cx, baseY + shaftLen);
        ctx.lineTo(cx + turnLen, baseY + shaftLen);
        ctx.stroke();
        drawHead(cx + turnLen, baseY + shaftLen, 'right');
      }
    });
  }else if(compass === 'E'){
    // E (heading East from West): arrows point RIGHT, at LEFT of grid
    const baseX = x - 12;
    const yPositions = moves.length === 1 ? [y] :
                       moves.length === 2 ? [y - spacing/2, y + spacing/2] :
                       [y - spacing, y, y + spacing];

    moves.forEach((move, idx) => {
      const cy = yPositions[idx];
      ctx.beginPath();
      ctx.moveTo(baseX, cy);
      ctx.lineTo(baseX + shaftLen, cy);
      ctx.stroke();

      if(move === 'A'){
        // Ahead: straight right (East)
        drawHead(baseX + shaftLen, cy, 'right');
      }else if(move === 'L'){
        // Left turn: heading East, turn left = North (UK left-hand)
        ctx.moveTo(baseX + shaftLen, cy);
        ctx.lineTo(baseX + shaftLen, cy - turnLen);
        ctx.stroke();
        drawHead(baseX + shaftLen, cy - turnLen, 'up');
      }else if(move === 'R'){
        // Right turn: heading East, turn right = South (UK left-hand)
        ctx.moveTo(baseX + shaftLen, cy);
        ctx.lineTo(baseX + shaftLen, cy + turnLen);
        ctx.stroke();
        drawHead(baseX + shaftLen, cy + turnLen, 'down');
      }
    });
  }else if(compass === 'W'){
    // W (heading West from East): arrows point LEFT, at RIGHT of grid
    const baseX = x + 12;
    const yPositions = moves.length === 1 ? [y] :
                       moves.length === 2 ? [y - spacing/2, y + spacing/2] :
                       [y - spacing, y, y + spacing];

    moves.forEach((move, idx) => {
      const cy = yPositions[idx];
      ctx.beginPath();
      ctx.moveTo(baseX, cy);
      ctx.lineTo(baseX - shaftLen, cy);
      ctx.stroke();

      if(move === 'A'){
        // Ahead: straight left (West)
        drawHead(baseX - shaftLen, cy, 'left');
      }else if(move === 'L'){
        // Left turn: heading West, turn left = South (UK left-hand) - appears at TOP
        ctx.moveTo(baseX - shaftLen, cy);
        ctx.lineTo(baseX - shaftLen, cy - turnLen);
        ctx.stroke();
        drawHead(baseX - shaftLen, cy - turnLen, 'up');
      }else if(move === 'R'){
        // Right turn: heading West, turn right = North (UK left-hand) - appears at BOTTOM
        ctx.moveTo(baseX - shaftLen, cy);
        ctx.lineTo(baseX - shaftLen, cy + turnLen);
        ctx.stroke();
        drawHead(baseX - shaftLen, cy + turnLen, 'down');
      }
    });
  }
}

// Separate function for pedestrian icon
function drawPedestrianIcon(ctx, x, y){
  ctx.save();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 3;

  // Head
  ctx.beginPath();
  ctx.arc(x, y - 6, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.moveTo(x, y - 3);
  ctx.lineTo(x, y + 6);
  ctx.stroke();

  // Arms (angled)
  ctx.beginPath();
  ctx.moveTo(x - 5, y);
  ctx.lineTo(x + 5, y);
  ctx.stroke();

  // Legs (angled)
  ctx.beginPath();
  ctx.moveTo(x, y + 6);
  ctx.lineTo(x - 4, y + 12);
  ctx.moveTo(x, y + 6);
  ctx.lineTo(x + 4, y + 12);
  ctx.stroke();

  ctx.restore();
}

// ---- validation
function validateJunction(j){
  const errs=[];
  j.stages.forEach((s)=>{
    if(!(Number.isInteger(s.minGreenSec) || typeof s.minGreenSec==='number')) errs.push(`${j.name}: Stage ${s.label} minGreen not a number`);
    if(s.minGreenSec < App.initCfg.stage.minGreen.min) errs.push(`${j.name}: Stage ${s.label} minGreen < ${App.initCfg.stage.minGreen.min}`);
  });
  const Cj = effectiveCycle(j);
  if((j.utcPlan||[]).length===0) errs.push(`${j.name}: UTC plan empty`);
  (j.utcPlan||[]).forEach((p,i)=>{
    if(p.at>=Cj) errs.push(`${j.name}: Plan row #${i+1} at=${p.at} ≥ cycle (${Cj})`);
    if(!j.stages.find(s=>s.label===p.to)) errs.push(`${j.name}: Plan row #${i+1} stage '${p.to}' not found`);
  });
  if(errs.length) return errs;
  const rc = computeRealisedCycle(j);
  if(!rc.ok){ errs.push(...rc.err); }
  return errs;
}

function runValidation({silent}={silent:false}){
  if(!silent) log('Validate clicked','info');
  const errs=[];
  const anyDouble = App.state.junctions.some(j=>j.doubleCycle);
  if(anyDouble && (App.state.mainCycle % 2 !== 0)) errs.push(`Main cycle must be even when any junction is double-cycling.`);
  const anyMain = App.state.junctions.some(j=>!j.doubleCycle);
  if(!anyMain) errs.push(`At least one junction must run the main cycle (not double).`);
  App.state.junctions.forEach(j=>errs.push(...validateJunction(j)));
  const ok = errs.length===0;
  if(ok){
    App.state.validOk = true;
    const v=document.getElementById('validateBtn'); if(v) v.classList.remove('dirty');
    setStatus('Validated ✔ — press Plot to render');
    const plot=document.getElementById('plotBtn'); if(plot) plot.disabled=false;
    // --- Scale Plans button event handler (enable on validate OK)
    const scale=document.getElementById('scaleBtn'); if(scale) scale.disabled=false;
    const x=document.getElementById('transferBtn'); if(x) x.disabled=false;
    if(!silent) log('VALIDATION OK','info');
    const ba=document.getElementById('bootAlert'); if(ba){ ba.classList.remove('show'); ba.textContent=''; }
  }else{
    App.state.validOk = false;
    setStatus('Validation failed — see alerts');
    const plot=document.getElementById('plotBtn'); if(plot) plot.disabled=true;
    // --- Scale Plans button event handler (disable when invalid)
    const scale=document.getElementById('scaleBtn'); if(scale) scale.disabled=true;
    const x=document.getElementById('transferBtn'); if(x) x.disabled=true;
    const msg = 'Fix these first:\n - '+errs.join('\n - ');
    if(silent){
      const ba=document.getElementById('bootAlert'); if(ba){ ba.classList.add('show'); ba.textContent = msg; }
      log('BOOT VALIDATION FAIL: '+errs.join(' | '),'warn');
    }else{
      alert(msg);
      log('VALIDATION FAIL: '+errs.join(' | '),'warn');
    }
  }
  return ok;
}

// --- ensureRedrawSoon: double-RAF to let layout settle before drawing
function ensureRedrawSoon(reason){
  try{ if(reason) log('ensureRedrawSoon: '+reason,'info'); }catch(_){/* noop */}
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      try{ if(App.state.readyToPlot && App.state.validOk){ drawHidden(); } drawLabels(); }catch(e){ try{ log('Redraw error: '+(e&&e.message?e.message:e),'err'); }catch(_){} }
    });
  });
}

// Wire visibility/resize hooks for first-open correctness of labels + plot
(function wireFirstOpenObservers(){
  if (window.__firstOpenObserversWired) return; window.__firstOpenObserversWired = true;
  document.addEventListener('DOMContentLoaded', ()=>{
    const plotPanel = document.getElementById('plotPanel');
    const plotBtn   = document.getElementById('tabPlotBtn');
    const wrap      = document.getElementById('hiddenWrap');

    // Redraw when the Plot tab button is clicked
    if(plotBtn && !plotBtn.__hooked){
      plotBtn.__hooked = true;
      plotBtn.addEventListener('click', ()=> ensureRedrawSoon('tabPlotBtn click'));
    }

    // Redraw when the plot panel actually becomes visible
    if(plotPanel && !plotPanel.__io){
      const io = new IntersectionObserver((entries)=>{
        const vis = entries.some(e=> e.isIntersecting && e.intersectionRatio > 0);
        if(vis) ensureRedrawSoon('plotPanel visible');
      }, { root: null, threshold: [0, 0.01, 0.1] });
      io.observe(plotPanel);
      plotPanel.__io = io;
    }

    // Redraw labels when container height/width changes
    if(wrap && !wrap.__ro){
      let pending = false;
      const ro = new ResizeObserver(()=>{
        if(pending) return; pending = true;
        requestAnimationFrame(()=>{ pending = false; ensureRedrawSoon('hiddenWrap resized'); });
      });
      ro.observe(wrap);
      wrap.__ro = ro;
    }

    // Also respond to window resizes
    window.addEventListener('resize', ()=> ensureRedrawSoon('window resize'));
  });
})();
// ---- drawing hidden

// Helper function (also in ui-handlers.js but needed here for boot)
function stripStrayScriptText(){
  const needles = [
    '// --- Scale Plans button definitions',
    '// --- Scale Plans button event handler (modal wiring)'
  ];
  function walk(node){
    if(!node) return;
    if(node.nodeType === Node.TEXT_NODE){
      const s = node.nodeValue || '';
      for(const n of needles){
        if(s.includes(n)){
          node.nodeValue = '';
          return;
        }
      }
      return;
    }
    const kids = node.childNodes;
    for(let i=0;i<kids.length;i++) walk(kids[i]);
  }
  walk(document.body);
}

async function boot(){
  // Scrub any stray JS text nodes that might have been pasted into the HTML
  stripStrayScriptText();
  // --- Scale Plans button definitions
  const scaleBtn = document.getElementById('scaleBtn');
  // --- Scale Plans button event handler
  if (scaleBtn){
    scaleBtn.addEventListener('click', ()=>{
      if(!App.state.validOk){
        alert('Please Validate first.');
        return;
      }
      openScalePlansDialog();
    });
  }
  // --- Scale Plans button event handler (modal wiring)
  (function(){
    const modal   = document.getElementById('scaleModal');
    if(!modal) return;
    const btnPrev = document.getElementById('scPreviewBtn');
    const btnApply= document.getElementById('scApplyBtn');
    const btnCancel=document.getElementById('scCancelBtn');
    const btnClose =document.getElementById('scCloseBtn');
    const chkRem  = document.getElementById('scRemoveDouble');
    const btnExport = document.getElementById('scExportBtn');

    if(btnClose){ btnClose.addEventListener('click', closeScalePlansDialog); }
    if(btnCancel){ btnCancel.addEventListener('click', closeScalePlansDialog); }

    if(btnPrev){
      btnPrev.addEventListener('click', ()=>{
        const t = parseTarget(); if(t==null) return;
        btnPrev.disabled = true; if(btnApply) btnApply.disabled = true;
        const prevText = btnPrev.textContent; btnPrev.textContent = 'Previewing…';
        try{
          const res = scalePreview(t, !!(chkRem && chkRem.checked));
          renderScalePreview(res, t);
          if(!res.ok){
            const bad = res.details.find(d=>!d.ok);
            if(bad){ setStatus(`❌ Cycle ${t}s not possible: ${bad.err||'constraint violation'}`); }
          }else{
            setStatus(`Preview OK for ${t}s — ready to apply.`);
          }
        }catch(err){
          const msg = (err && err.message) ? err.message : String(err);
          setStatus('❌ Preview failed: '+msg);
          const box = document.getElementById('scPreview');
          if(box) box.textContent = 'Preview failed: '+msg;
        }finally{
          btnPrev.textContent = prevText;
          btnPrev.disabled = false;
        }
      });
    }

    if(btnApply){
      btnApply.addEventListener('click', ()=>{
        const t = parseTarget(); if(t==null) return;
        const res = applyScale(t, !!(chkRem && chkRem.checked));
        if(!res.ok){
          alert(res.err||'Apply failed');
        }else{
          closeScalePlansDialog();
        }
      });
    }

    if(btnExport){
      btnExport.addEventListener('click', ()=>{
        try{ exportScalePreviewJSON(); }
        catch(err){ alert((err&&err.message)||String(err)); }
      });
    }
  })();
  App.initCfg = await loadBundledInit();
  setFileNameLabel(App.state.fileName);
  const dbgPanel = document.getElementById('debugPanel');
  const debugTabBtn = document.getElementById('tabDebugBtn');
  const urlHasDebugFlag = /[?&]debug=1\b/.test(location.search);
  const debugTabVisible = !!(debugTabBtn && getComputedStyle(debugTabBtn).display !== 'none');
  const wantDebugOnLoad = urlHasDebugFlag && debugTabVisible;
  if (wantDebugOnLoad && window.__showPanel) { window.__showPanel('debug'); }
  document.getElementById('dbgClear').addEventListener('click', ()=>{ document.getElementById('log').textContent=''; });

  App.state = buildState(App.initCfg);
  // Pre-plot default: choose px/s so [mainCycle, mainCycle*viewCycles] fills the viewport
  (function(){
    const vp = measureViewportPx();
    const Cj = App.state.mainCycle;
    const N  = App.state.viewCycles || 2;
    if(vp > 0 && Cj){
      App.state.pxPerSec = Math.max(1, Math.round(vp / (N*Cj)));
      setViewStart(Cj);
      const zoom = document.getElementById('zoom');
      if(zoom){ const zmin=1,zmax=12; zoom.value = String(Math.max(zmin, Math.min(zmax, zmax - (Math.round(App.state.pxPerSec) - zmin)))); }
    }
  })();
  // Guides toggle (gridlines, row ticks, blue triangles)
  const guidesToggle = document.getElementById('guidesToggle');
  if (guidesToggle) {
    guidesToggle.checked = !!App.state.showGuides;
    guidesToggle.addEventListener('change', () => {
      App.state.showGuides = !!guidesToggle.checked;
      if (App.state.readyToPlot && App.state.validOk) { drawHidden(); }
      setStatus(App.state.showGuides ? 'Guides enabled' : 'Guides disabled');
    });
  }
  // Debug toggle: show/hide Debug tab (default OFF)
  const debugToggle = document.getElementById('debugToggle');
  // debugTabBtn already declared as const above; do not reassign.
  if (debugToggle && debugTabBtn) {
    // Default to OFF and ensure hidden
    debugToggle.checked = false;
    debugTabBtn.style.display = 'none';

    debugToggle.addEventListener('change', () => {
      if (debugToggle.checked) {
        debugTabBtn.style.display = 'inline-block';
        setStatus('Debug enabled');
      } else {
        debugTabBtn.style.display = 'none';
        // If debug panel is visible, hide it
        const debugPanel = document.getElementById('debugPanel');
        if (debugPanel) debugPanel.style.display = 'none';
        setStatus('Debug disabled');
      }
    });
  }
  document.getElementById('mainCycle').value = App.state.mainCycle;
  document.getElementById('jCount').value = App.state.junctions.length;
  document.getElementById('viewCycles').value = String(App.state.viewCycles);
  rebuildTabs();
  setDirty(); // force validation before any plot
  log('App booted — smoke-check…','info');

  // Boot-time smoke-check (silent)
  runValidation({silent:true});

  document.getElementById('mainCycle').addEventListener('change', (e)=>{
    const v=parseInt(e.target.value||60,10);
    const clamped=Math.max(App.initCfg.mainCycleTime.min, Math.min(App.initCfg.mainCycleTime.max, v));
    App.state.mainCycle=clamped; e.target.value=clamped; setDirty();
    // Pre-plot: choose px/s so [C, C*N] fits the viewport
    if(!App.state.readyToPlot){
      const vp = measureViewportPx();
      const N = App.state.viewCycles || 2;
      App.state.pxPerSec = Math.max(1, Math.round(vp / (N*App.state.mainCycle)));
      setViewStart(App.state.mainCycle);
      const zoom = document.getElementById('zoom');
      if(zoom){ const zmin=1,zmax=12; zoom.value = String(Math.max(zmin, Math.min(zmax, zmax - (Math.round(App.state.pxPerSec) - zmin)))); }
    }
  });
  document.getElementById('jCount').addEventListener('change', (e)=>{
    const v=parseInt(e.target.value||3,10);
    const c=Math.max(App.initCfg.junctionCount.min, Math.min(App.initCfg.junctionCount.max, v));
    const cur=App.state.junctions.length; const ids=['A','B','C','D','E'];
    if(c>cur){ for(let i=cur;i<c;i++) App.state.junctions.push(mkJunction(ids[i], App.initCfg)); }
    else if(c<cur){ App.state.junctions.splice(c); }
    e.target.value=c; rebuildTabs(); setDirty();
  });
  document.getElementById('viewCycles').addEventListener('change', (e)=>{
    App.state.viewCycles=parseFloat(e.target.value||2);
    // Trigger fit button if we're already on the plot tab
    if(App.state.readyToPlot){
      const fitBtn = document.getElementById('fitBtn');
      if(fitBtn) fitBtn.click();
    }
  });

  // Save/Load handlers moved to file-io.js to avoid duplication

  document.getElementById('validateBtn').addEventListener('click', ()=>{ runValidation({silent:false}); });
  document.getElementById('plotBtn').addEventListener('click', ()=>{
    if(!App.state.validOk){ alert('Please Validate first.'); return; }
    App.state.readyToPlot = true;
    const p=document.getElementById('plotBtn');
    if(p) p.classList.remove('dirty');
    setStatus('Plotted ✓');
    log('Plot clicked — drawing (viewport-fixed)','info');

    // Set initial view to start after warmup cycle (at mainCycle seconds)
    const M = App.state.mainCycle;
    if(App.state.viewStartSec < M){
      App.state.viewStartSec = M;
    }

    // ✅ Enable the Plot tab after first successful plot
    const plotTabBtn = document.getElementById('tabPlotBtn');
    if (plotTabBtn) plotTabBtn.disabled = false;

    // Switch to the plot tab (tab-manager will handle viewport measurement and drawing)
    if(typeof window.__showPanel === 'function'){
      window.__showPanel('plot');
    }
  });
  // (transferBtn block removed)

  const zoom = document.getElementById('zoom');
  if(zoom){
    const zmin = 1, zmax = 12; // slider range
    // initialise slider position from pxPerSec -> slider value (invert mapping)
    zoom.value = String(zmax - (App.state.pxPerSec - zmin));
    zoom.addEventListener('input', ()=>{
      const C = document.getElementById('hiddenCanvas');
      const oldPps = App.state.pxPerSec||4;
      const centerSec = App.state.viewStartSec + (C.width/oldPps)/2;
      const val = Math.max(zmin, Math.min(zmax, parseInt(zoom.value,10) || zmin));
      App.state.pxPerSec = Math.max(1, (zmax - val) + zmin); // LEFT = bigger spacing
      const newViewDur = C.width / App.state.pxPerSec;
      setViewStart(centerSec - newViewDur/2);
      drawHidden();
      drawLabels();
    });
  }
  const fit = document.getElementById('fitBtn');
  if(fit){ fit.addEventListener('click', ()=>{
    const Cj = App.state.mainCycle; const N = App.state.viewCycles || 2;
    const viewportPx = measureViewportPx();
    // Round up the visible timeframe to nearest second
    const targetSeconds = Math.ceil(N * Cj);
    const pps = Math.max(1, Math.floor(viewportPx / Math.max(1, targetSeconds)));
    App.state.pxPerSec = pps;
    if(zoom){ const zmin=1,zmax=12; zoom.value = String(zmax - (App.state.pxPerSec - zmin)); }
    const centerSec = 1*Cj + (N*Cj)/2; // focus cycles 1..N
    setViewStart(centerSec - (viewportPx/pps)/2);
    drawHidden(); drawLabels();
  }); }
  // Copy combined label+timeline canvas to clipboard
  const copyBtn = document.getElementById('copyBtn');
  if(copyBtn){
    copyBtn.addEventListener('click', async ()=>{
      try{
        const label = document.getElementById('labelCanvas');
        const plot  = document.getElementById('hiddenCanvas');
        if(!(label && plot)) throw new Error('Canvas not ready');

        // Ensure latest drawing (synchronous - no await to maintain user gesture context)
        if(App.state.readyToPlot && App.state.validOk){
          drawHidden();
          drawLabels();
        }

        // Get visible viewport area
        const timelineScroll = document.getElementById('timelineScroll');
        if(!timelineScroll) throw new Error('Timeline scroll container not found');

        const scrollLeft = timelineScroll.scrollLeft;
        const scrollTop = timelineScroll.scrollTop;
        const viewportWidth = timelineScroll.clientWidth;
        const viewportHeight = timelineScroll.clientHeight;

        // Get CSS dimensions (what's actually displayed on screen)
        const labelRect = label.getBoundingClientRect();
        const plotRect = plot.getBoundingClientRect();

        // Debug: Log dimensions to Debug tab
        const dpr = window.devicePixelRatio || 1;
        log('=== CANVAS COPY DEBUG ===', 'info');
        log(`Device Pixel Ratio: ${dpr}`, 'info');
        log(`Viewport: ${viewportWidth}×${viewportHeight}, scroll: ${scrollLeft},${scrollTop}`, 'info');
        log(`Label Canvas - CSS: ${Math.round(labelRect.width)}×${Math.round(labelRect.height)}`, 'info');
        log(`Label Canvas - Backing: ${label.width}×${label.height}`, 'info');
        log(`Plot Canvas - CSS: ${Math.round(plotRect.width)}×${Math.round(plotRect.height)}`, 'info');
        log(`Plot Canvas - Backing: ${plot.width}×${plot.height}`, 'info');

        // Calculate visible portion of plot canvas in backing store coordinates
        const scaleX = plot.width / plotRect.width;
        const scaleY = plot.height / plotRect.height;

        const srcX = scrollLeft * scaleX;
        const srcY = scrollTop * scaleY;
        const srcW = Math.min(viewportWidth * scaleX, plot.width - srcX);
        const srcH = Math.min(viewportHeight * scaleY, plot.height - srcY);

        // Use label's full height (it's always visible) but match plot's visible height
        const labelScaleY = label.height / labelRect.height;
        const labelSrcY = scrollTop * labelScaleY;
        const labelSrcH = Math.min(viewportHeight * labelScaleY, label.height - labelSrcY);

        // Output at 2x CSS size for good quality without being excessive
        const outputScale = 2;
        const outputLabelW = Math.round(labelRect.width * outputScale);
        const outputPlotW = Math.round(viewportWidth * outputScale);
        const outputH = Math.round(viewportHeight * outputScale);
        const outputW = outputLabelW + outputPlotW;

        log(`Output Canvas: ${outputW}×${outputH} (${outputScale}x CSS size)`, 'info');
        log(`Copying visible area - Plot source: ${Math.round(srcX)},${Math.round(srcY)} ${Math.round(srcW)}×${Math.round(srcH)}`, 'info');

        // Create output canvas at reasonable size
        const off = document.createElement('canvas');
        off.width = outputW;
        off.height = outputH;
        const octx = off.getContext('2d');

        // White background
        octx.fillStyle = '#fff';
        octx.fillRect(0, 0, outputW, outputH);

        // Draw visible portion of label canvas
        octx.drawImage(label,
          0, labelSrcY, label.width, labelSrcH,  // source
          0, 0, outputLabelW, outputH);           // destination

        // Draw visible portion of plot canvas
        octx.drawImage(plot,
          srcX, srcY, srcW, srcH,                     // source (visible area)
          outputLabelW, 0, outputPlotW, outputH);     // destination

        // Helper: convert dataURL to Blob without fetch() (Safari/Firefox robustness)
        function dataURLtoBlob(dataURL){
          const parts = dataURL.split(',');
          const mime = (parts[0].match(/:(.*?);/)||[])[1] || 'image/png';
          const bstr = atob(parts[1]);
          let n = bstr.length;
          const u8 = new Uint8Array(n);
          while(n--){ u8[n] = bstr.charCodeAt(n); }
          return new Blob([u8], {type:mime});
        }

        async function saveAsDownload(blob){
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'td-diagram.png';
          document.body.appendChild(a); a.click(); a.remove();
          URL.revokeObjectURL(url);
        }

        async function tryClipboard(blob){
          // Check feature support; some browsers (Safari/Firefox) may not support image writes.
          const canWrite = !!(navigator.clipboard && window.ClipboardItem);
          log(`Clipboard API available: ${canWrite}`, 'info');
          if(!canWrite){
            log('Clipboard API not supported - will download instead', 'warn');
            return false;
          }
          try{
            // Check if clipboard-write permission is granted
            if(navigator.permissions){
              try{
                const permissionStatus = await navigator.permissions.query({name: 'clipboard-write'});
                log(`Clipboard write permission: ${permissionStatus.state}`, 'info');
              }catch(e){
                log('Could not query clipboard-write permission (not critical)', 'info');
              }
            }

            const item = new ClipboardItem({ 'image/png': blob });
            log(`Attempting to write ${blob.size} bytes to clipboard`, 'info');
            await navigator.clipboard.write([item]);
            log('✅ TD Diagram copied to clipboard (PNG)', 'info');
            // Set status chip after successful copy
            setStatus('✅ Diagram copied to clipboard.');
            return true;
          }catch(err){
            log(`❌ Clipboard write failed: ${err.name} - ${err.message}`, 'err');
            console.warn('Clipboard write failed, falling back to download:', err);
            return false;
          }
        }

        // Use synchronous toDataURL to maintain user gesture context for clipboard API
        const dataURL = off.toDataURL('image/png');
        const blob = dataURLtoBlob(dataURL);

        if(!blob) throw new Error('Failed to create blob');

        const ok = await tryClipboard(blob);
        if(!ok){
          await saveAsDownload(blob);
          // Set status chip after download
          setStatus('📁 Diagram downloaded as PNG.');
          alert('Clipboard not available — downloaded PNG instead.');
        }
      }catch(err){
        console.error(err);
        alert('Copy failed: ' + (err && err.message ? err.message : err));
      }
    });
  }

  // Print TD Diagram
  const printBtn = document.getElementById('printBtn');
  if(printBtn){
    printBtn.addEventListener('click', ()=>{
      try{
        const label = document.getElementById('labelCanvas');
        const plot  = document.getElementById('hiddenCanvas');
        if(!(label && plot)) throw new Error('Canvas not ready');

        // Ensure latest drawing
        if(App.state.readyToPlot && App.state.validOk){
          drawHidden();
          drawLabels();
        }

        // Get visible viewport area
        const timelineScroll = document.getElementById('timelineScroll');
        if(!timelineScroll) throw new Error('Timeline scroll container not found');

        const scrollLeft = timelineScroll.scrollLeft;
        const scrollTop = timelineScroll.scrollTop;
        const viewportWidth = timelineScroll.clientWidth;
        const viewportHeight = timelineScroll.clientHeight;

        const labelRect = label.getBoundingClientRect();
        const plotRect = plot.getBoundingClientRect();

        // Calculate visible portion of plot canvas in backing store coordinates
        const scaleX = plot.width / plotRect.width;
        const scaleY = plot.height / plotRect.height;

        const srcX = scrollLeft * scaleX;
        const srcY = scrollTop * scaleY;
        const srcW = Math.min(viewportWidth * scaleX, plot.width - srcX);
        const srcH = Math.min(viewportHeight * scaleY, plot.height - srcY);

        // Use label's full height but match plot's visible height
        const labelScaleY = label.height / labelRect.height;
        const labelSrcY = scrollTop * labelScaleY;
        const labelSrcH = Math.min(viewportHeight * labelScaleY, label.height - labelSrcY);

        // Create canvas with visible area at good print resolution
        const printScale = 2;
        const outputLabelW = Math.round(labelRect.width * printScale);
        const outputPlotW = Math.round(viewportWidth * printScale);
        const outputH = Math.round(viewportHeight * printScale);
        const outputW = outputLabelW + outputPlotW;

        const off = document.createElement('canvas');
        off.width = outputW;
        off.height = outputH;
        const octx = off.getContext('2d');

        // White background
        octx.fillStyle = '#fff';
        octx.fillRect(0, 0, outputW, outputH);

        // Draw visible portion of label canvas
        octx.drawImage(label,
          0, labelSrcY, label.width, labelSrcH,
          0, 0, outputLabelW, outputH);

        // Draw visible portion of plot canvas
        octx.drawImage(plot,
          srcX, srcY, srcW, srcH,
          outputLabelW, 0, outputPlotW, outputH);

        // Convert to data URL
        const dataURL = off.toDataURL('image/png');

        // Create print window
        const printWindow = window.open('', '_blank');
        const printDoc = printWindow.document;

        printDoc.write('<html><head><title>TD Diagram</title>');
        printDoc.write('<style>');
        printDoc.write('body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: flex-start; }');
        printDoc.write('img { max-width: 100%; height: auto; display: block; }');
        printDoc.write('@media print { body { padding: 0; } img { max-width: 100%; page-break-inside: avoid; } }');
        printDoc.write('</style>');
        printDoc.write('</head><body>');
        printDoc.write('<img src="' + dataURL + '" alt="TD Diagram"/>');
        printDoc.write('</body></html>');
        printDoc.close();

        // Wait for image to load then print
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);

        log('Print dialog opened', 'info');
        setStatus('🖨️ Print dialog opened');

      }catch(err){
        console.error(err);
        alert('Print failed: ' + (err && err.message ? err.message : err));
      }
    });
  }

  // Add scroll event to timelineScroll to keep labels synced
  const scroller = document.getElementById('timelineScroll');
  if(scroller){
    scroller.addEventListener('wheel', (e)=>{
      e.preventDefault(); // keep the page still
      const scale = (e.shiftKey ? 0.25 : 1); // Shift for finer pan
      const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * scale;
      const secDelta = delta / (App.state.pxPerSec||1);
      setViewStart(App.state.viewStartSec + secDelta);
      drawHidden();
    }, {passive:false});
  }

  // Wire up modal buttons (must be called after DOM is ready)
  log('Wiring modals...', 'info');
  if (typeof wireAdjustModal === 'function') {
    log('wireAdjustModal found, calling...', 'info');
    wireAdjustModal();
  } else {
    log('ERROR: wireAdjustModal not found!', 'err');
  }
  if (typeof wireOverlaysModal === 'function') {
    log('wireOverlaysModal found, calling...', 'info');
    wireOverlaysModal();
  } else {
    log('ERROR: wireOverlaysModal not found!', 'err');
  }
  if (typeof wirePlansModal === 'function') {
    log('wirePlansModal found, calling...', 'info');
    wirePlansModal();
  } else {
    log('ERROR: wirePlansModal not found!', 'err');
  }
}
