// Signal Plan Checker v2.6.1h - Canvas Renderer Module
// All canvas drawing and rendering logic

// Compute vertical layout for hidden/label canvas: expand to fill, distribute rows/gaps
function computeVerticalLayout(){
  const plotCard = document.getElementById('plotPanel');
  const toolbar  = document.getElementById('plotToolbar');
  const wrap     = document.getElementById('hiddenWrap');
  const topPad   = App.initCfg.plot.topMargin || 24;
  const bottomPad= 20;
  const n        = (App.state && App.state.junctions ? App.state.junctions.length : 0) || 1;
  const minRow   = Math.max(24, App.initCfg.plot.rowHeight || 48);
  const minGap   = Math.max(8,  App.initCfg.plot.rowGap || 18);

  // Cap the canvas area to a fraction of the viewport height (configurable, default 65%)
  const vhFrac   = (App.initCfg.plot && App.initCfg.plot.maxHeightVH ? App.initCfg.plot.maxHeightVH : 0.65);
  const maxPx    = Math.floor(window.innerHeight * Math.max(0.3, Math.min(0.95, vhFrac)));

  // Measure the visible space inside the Plot card, below the toolbar
  const panelH   = plotCard ? Math.floor(plotCard.getBoundingClientRect().height) : window.innerHeight;
  const toolH    = toolbar ? Math.floor(toolbar.getBoundingClientRect().height) : 0;
  const padH     = 24; // internal padding/margins within the card

  // Usable height is min(panel content area, viewport cap)
  // Don't use wrapper height as it creates a circular dependency
  const contentH = Math.max(120, Math.min(maxPx, panelH - toolH - padH));

  let rowH = minRow, gap = minGap;
  const avail = Math.max(50, contentH - topPad - bottomPad);

  if(avail >= n * minRow){
    // keep bars at configured height, distribute extra into the gaps evenly
    gap = Math.max(minGap, Math.floor((avail - n*minRow) / Math.max(1,(n-1))));
  }else{
    // not enough space: keep a minimum gap and shrink rows uniformly
    gap = minGap;
    rowH = Math.max(16, Math.floor((avail - (n-1)*gap) / n));
  }

  const totalH = topPad + n*rowH + Math.max(0,(n-1))*gap + bottomPad;

  // Debug logging
  if (window.__debugLayout) {
    console.log('🔍 computeVerticalLayout:', { n, topPad, bottomPad, rowH, gap, totalH });
  }

  return { top: topPad, rowH, gap, totalH };
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
function drawHidden(){
  if(!(App.state.validOk && App.state.readyToPlot)){
    log('Draw suppressed (requires Validate OK + Plot)','warn');
    return;
  }

  const scroller = document.getElementById('timelineScroll');
  const C = document.getElementById('hiddenCanvas');
  const ctx = C.getContext('2d');

  const M = App.state.mainCycle;                                 // main cycle seconds (e.g., 60)
  const mult = (App.initCfg.plot && App.initCfg.plot.hiddenWindowMultiplier) || 5;
  const T = M * (mult + 1);                                      // total world seconds (+1 for warmup cycle)
  let pps = App.state.pxPerSec || 4;                           // pixels per second

  // Use dynamic vertical layout
  const { top, rowH, gap, totalH } = computeVerticalLayout();

  // Viewport width is the visible width of the scroll container — canvas does NOT grow with zoom
  const viewportPx = measureViewportPx();
  const height = totalH;

  // Use sizeCanvasHiDPI to match label canvas (ensures same DPR scaling)
  const dpr = Math.max(1, (window.devicePixelRatio || 1));
  C.style.width = viewportPx + 'px';
  C.style.height = height + 'px';
  C.width = Math.round(viewportPx * dpr);
  C.height = Math.round(height * dpr);

  // Scale context so 1 unit = 1 CSS pixel (matching label canvas approach)
  if (ctx && typeof ctx.setTransform === 'function') {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // If the panel is still hidden or we measured an implausibly small viewport, defer draw
  if (!viewportPx || viewportPx < 80) {
    scheduleRedraw('defer: tiny viewport ('+viewportPx+'px)');
    return;
  }

  // If requested, set px/sec so the viewport spans exactly (mainCycle * viewCycles)
  if (App.state.forceViewCyclesOnce) {
    const desiredSec = (App.state.mainCycle||60) * (App.state.viewCycles||2);
    if (desiredSec > 0) {
      App.state.pxPerSec = Math.max(1, viewportPx / desiredSec);
      pps = App.state.pxPerSec;
    }
    App.state.forceViewCyclesOnce = false;
  }

  // Compute visible window [v0, v1] in seconds and clamp to the time horizon [0, T]
  let viewDurSec = viewportPx / pps;                             // how many seconds fit in the viewport

  // If the viewport can show more than the total horizon, rescale px/sec so that the window exactly fits T
  if (T > 0 && viewDurSec > T) {
    App.state.pxPerSec = Math.max(1, viewportPx / T);
    pps = App.state.pxPerSec;
    viewDurSec = viewportPx / App.state.pxPerSec;
    setViewStart(0); // start at the left edge
  } else {
    // Otherwise just clamp the start to the available range [0, T - viewDurSec]
    setViewStart(App.state.viewStartSec);
  }

  let v0 = App.state.viewStartSec;                               // left edge time (s)
  let v1 = v0 + viewDurSec;                                      // right edge time (s)

  // Final guard: never render past the horizon
  if (v1 > T) {
    v1 = T;
    v0 = Math.max(0, T - viewDurSec);
    App.state.viewStartSec = v0;                                 // keep state consistent
  }

  // Background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,C.width,C.height);

  // Grid + tick marks anchored to the main cycle (so 5s/10s are relative to cycle 0)
  const yTop    = top;           // top edge of rows
  const yTopTickBase = top;      // where ticks attach on top
  const yBot    = height - 10;   // bottom guideline
  const yBotTickBase = height - 10;

  const firstCycle = Math.floor(v0 / M);
  const lastCycle  = Math.floor((v1 - 1e-9) / M);

  for (let k = firstCycle; k <= lastCycle; k++){
    const base = k * M; // absolute time at the start of this cycle
    // Clamp local seconds to the portion of this cycle that is visible
    const tStart = Math.max(0, Math.ceil(v0 - base));
    const tEnd   = Math.min(M, Math.floor(v1 - base));

    for (let t = tStart; t <= tEnd; t++){
      const x = (base + t - v0) * pps;

      // subtle vertical gridlines at 5s (lighter than 10s main grid), relative to cycle
      if (App.state.showGuides && t % 5 === 0 && t % 10 !== 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.06)'; // very light
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x, yBot); ctx.stroke();
        ctx.restore();
      }

      if (t % 10 === 0){
        // 10s: full vertical grid + longest ticks (cycle‑relative)
        ctx.strokeStyle = '#d0d0d0'; // slightly darker grid line
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, yTop-8); ctx.lineTo(x, yBot); ctx.stroke();

        // long ticks
        ctx.strokeStyle = '#000';
        ctx.beginPath(); ctx.moveTo(x, yTopTickBase); ctx.lineTo(x, yTopTickBase - 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, yBotTickBase); ctx.lineTo(x, yBotTickBase + 10); ctx.stroke();

        // top labels show seconds within the current cycle [0..M)
        // Skip the cycle boundary (M) as it's the same as 0 of the next cycle
        if (t < M) {
          ctx.fillStyle='#000'; ctx.font='10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
          ctx.fillText(String(t), x, yTop-12);
        }
      } else if (t % 5 === 0){
        // 5s: medium ticks, no full grid line
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, yTopTickBase); ctx.lineTo(x, yTopTickBase - 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, yBotTickBase); ctx.lineTo(x, yBotTickBase + 6); ctx.stroke();
      } else {
        // 1s: short ticks
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, yTopTickBase); ctx.lineTo(x, yTopTickBase - 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, yBotTickBase); ctx.lineTo(x, yBotTickBase + 3); ctx.stroke();
      }
    }
  }

  // Red cycle markers at every multiple of mainCycle
  (function(){
    const Cj = App.state.mainCycle || 60;
    if(!Cj) return;
    const kStart = Math.ceil(v0 / Cj);
    const kEnd   = Math.floor(v1 / Cj);
    ctx.save();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    for(let k=kStart; k<=kEnd; k++){
      const t = k * Cj;
      const x = (t - v0) * pps;
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yBot);
      ctx.stroke();
    }
    ctx.restore();
  })();

  // Bottom labels (cycle‑relative 10s)
  (function(){
    try{
      const y = height - 6;
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

      const firstCycle = Math.floor(v0 / M);
      const lastCycle  = Math.floor((v1 - 1e-9) / M);
      for (let k = firstCycle; k <= lastCycle; k++){
        const base = k * M;
        const tStart = Math.max(0, Math.ceil(v0 - base));
        const tEnd   = Math.min(M, Math.floor(v1 - base));
        const firstTen = Math.ceil(tStart / 10) * 10;
        for (let t = firstTen; t <= tEnd; t += 10) {
          // Skip the cycle boundary (M) as it's the same as 0 of the next cycle
          if (t < M) {
            const x = (base + t - v0) * pps; ctx.fillText(String(t), x, y - 3);
          }
        }
      }
      ctx.restore();
    }catch(e){}
  })();

  const greens = ['rgba(60,180,75,0.9)','rgba(90,205,105,0.9)','rgba(120,220,135,0.9)','rgba(150,235,165,0.9)'];
  const ambers = ['rgba(255,165,0,0.9)','rgba(255,180,30,0.9)','rgba(255,195,60,0.9)','rgba(255,210,90,0.9)'];

  // Draw rows clipped to viewport [v0, v1]
  App.state.junctions.forEach((j, idx)=>{
    const y0 = top + idx*(rowH+gap);
    ctx.strokeStyle = '#ddd'; ctx.strokeRect(0, y0, viewportPx, rowH);
    // Row-level tick bar (replicates the top time ticks for each junction row)
    if (App.state.showGuides) (function(){
      const firstCycle = Math.floor(v0 / M);
      const lastCycle  = Math.floor((v1 - 1e-9) / M);
      for (let k = firstCycle; k <= lastCycle; k++){
        const base = k * M;
        const tStart = Math.max(0, Math.ceil(v0 - base));
        const tEnd   = Math.min(M, Math.floor(v1 - base));
        for (let t = tStart; t <= tEnd; t++){
          const xx = (base + t - v0) * pps;
          if (t % 10 === 0){
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y0 - 10); ctx.stroke();
          } else if (t % 5 === 0){
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y0 - 6); ctx.stroke();
          } else {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y0 - 3); ctx.stroke();
          }
        }
      }
    })();

    // For the top junction (A), draw a mirrored tick bar below the green bar
    if (App.state.showGuides) (function(){
      if (idx !== 0) return; // only for the very first (top) junction row
      const firstCycle = Math.floor(v0 / M);
      const lastCycle  = Math.floor((v1 - 1e-9) / M);
      const yBase = y0 + rowH; // bottom edge of the row's bar area
      for (let k = firstCycle; k <= lastCycle; k++){
        const base = k * M;
        const tStart = Math.max(0, Math.ceil(v0 - base));
        const tEnd   = Math.min(M, Math.floor(v1 - base));
        for (let t = tStart; t <= tEnd; t++){
          const xx = (base + t - v0) * pps;
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          if (t % 10 === 0){
            ctx.beginPath(); ctx.moveTo(xx, yBase); ctx.lineTo(xx, yBase + 10); ctx.stroke();
          } else if (t % 5 === 0){
            ctx.beginPath(); ctx.moveTo(xx, yBase); ctx.lineTo(xx, yBase + 6); ctx.stroke();
          } else {
            ctx.beginPath(); ctx.moveTo(xx, yBase); ctx.lineTo(xx, yBase + 3); ctx.stroke();
          }
        }
      }
    })();

    const rc = computeRealisedCycleAdj(j);
    if(!rc.ok){ ctx.fillStyle = '#b00020'; ctx.fillText('ERR: '+rc.err.join(' | '), 8, y0+14); return; }

    const Cj = rc.Cj; const N = rc.plan.length; const cycles = Math.ceil(T / Cj);

    for(let k=0;k<cycles;k++){
      const base = k*Cj;
      // Requested change markers
      if(App.initCfg.utcPlan.markRequestsBlue){
        for(let i=0;i<N;i++){
          const rqAbs = base + rc.plan[i].at;
          if(rqAbs < v0 || rqAbs > v1) continue;                  // outside viewport
          const x= (rqAbs - v0) * pps;

          // Check if this request violates minimum green constraint
          // We need to check if the stage that's CURRENTLY running can end at the requested time
          // The stage currently running is the one from the PREVIOUS marker (i-1)
          const prevIdx = (i - 1 + N) % N;
          const prevDetail = rc.details[prevIdx];
          const requestTime = rc.plan[i].at; // requested change time within this cycle
          const earliestPossible = prevDetail.earliestMG % Cj; // normalize to cycle time

          // Special case: if request is at time 0 (cycle boundary), don't flag it
          // The cycle boundary is natural, not a forced early change
          const isCycleBoundary = requestTime === 0;

          // Check if stage can complete before next request
          let isTooEarly = false;
          if(!isCycleBoundary){
            const prevRequestTime = rc.plan[prevIdx].at;
            const isWrapAround = requestTime < prevRequestTime;

            if(isWrapAround){
              // Wrapping to next cycle - need to use un-normalized earliestMG
              // to properly compare across cycle boundary
              const earliestMG_abs = prevDetail.earliestMG;
              const nextRequestAbs = requestTime + Cj;
              isTooEarly = earliestMG_abs > nextRequestAbs;
            }else{
              // Both in same cycle - direct comparison using normalized values
              isTooEarly = earliestPossible > requestTime;
            }
          }

          // Choose color: RED if too early, CYAN if OK
          const markerColor = isTooEarly ? '#ff0000' : '#00d4ff';
          const shadowColor = isTooEarly ? 'rgba(255,0,0,0.6)' : 'rgba(0,200,255,0.6)';

          ctx.save();

          // For red markers, draw white outline first for better visibility
          if(isTooEarly){
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(x,y0);
            ctx.lineTo(x,y0+rowH);
            ctx.stroke();
          }

          // Glow effect
          ctx.shadowColor = shadowColor;
          ctx.shadowBlur = isTooEarly ? 6 : 4;
          ctx.strokeStyle = markerColor;
          ctx.lineWidth = isTooEarly ? 4 : 3;
          ctx.beginPath();
          ctx.moveTo(x,y0);
          ctx.lineTo(x,y0+rowH);
          ctx.stroke();

          // Add small triangle marker at top
          ctx.fillStyle = markerColor;
          ctx.shadowBlur = isTooEarly ? 8 : 6;
          const triSize = isTooEarly ? 7 : 6;
          ctx.beginPath();
          ctx.moveTo(x, y0 - 2); // apex pointing up
          ctx.lineTo(x - triSize*0.7, y0 - 2 - triSize);
          ctx.lineTo(x + triSize*0.7, y0 - 2 - triSize);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      for(let i=0;i<N;i++){
        const curIdx = rc.toIdx[i];
        const prevIdx = rc.toIdx[(i-1+N)%N];
        const nextIdx = rc.toIdx[(i+1)%N];

        const igPrev = Math.max(0, j.intergreen[prevIdx][curIdx]);
        const RCi = rc.RC[i];
        const RCn = rc.RC[i+1];

        const segStartAbs = base + (RCi + igPrev);
        const segEndAbs   = base + RCn;
        const s = Math.max(v0, segStartAbs);
        const e = Math.min(v1, segEndAbs);
        if(e > s){
          // Calculate actual green duration and compare to minimum green
          const actualGreenDuration = segEndAbs - segStartAbs;
          const minGreen = j.stages[curIdx].minGreenSec || 0;
          const isAtMinimum = Math.abs(actualGreenDuration - minGreen) < 0.5; // tolerance for rounding

          // Use amber if at minimum green, otherwise use green
          ctx.fillStyle = isAtMinimum ? ambers[curIdx % ambers.length] : greens[curIdx % greens.length];
          ctx.fillRect((s - v0)*pps, y0+6, (e - s)*pps, rowH-12);

// (9)
const wpx = (e - s) * pps;
if(wpx >= 28){
  const xMid = ((s + e)/2 - v0) * pps;
  const yMid = y0 + rowH/2;
  const fs = Math.min(14, Math.max(10, Math.floor(rowH * 0.36)));

  // If a direction icon is set, nudge the text left a little to make room
  const hasDir = !!(j.stages[curIdx] && j.stages[curIdx].dir && j.stages[curIdx].dir!=='none');
  const textX = hasDir ? (xMid - 10) : xMid;

  ctx.save();
  ctx.textAlign = 'center';
  // subtle shadow for contrast on green backgrounds
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 3;

  // Stage label (white, above center)
  ctx.font = fs + 'px system-ui';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(j.stages[curIdx].label, textX, yMid - 1);

  // Duration text (small black, below stage label)
  const durationSec = Math.round(actualGreenDuration);
  ctx.font = Math.max(9, Math.floor(fs * 0.7)) + 'px system-ui';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000000';
  ctx.fillText(durationSec + 's', textX, yMid + 1);

  ctx.restore();

  // draw the small direction icon to the right of the label if present
  if(hasDir){
    drawStageDirIcon(ctx, j.stages[curIdx].dir, xMid + 12, yMid);
  }
}


          // Start/End time labels (relative to junction cycle Cj)
          // Start is (RCi + igPrev) modulo Cj; End is RCn modulo Cj
          const tStartC = ((RCi + igPrev) % Cj + Cj) % Cj; // normalized into [0, Cj)
          const tEndC   = ((RCn) % Cj + Cj) % Cj;

          ctx.save();
          ctx.fillStyle = '#000';
          ctx.font = '10px system-ui';
          // Place labels above the per-row tick marks for most rows,
          // but for the TOP junction row (idx === 0) place them *below* the bar
          // so they don't clash with the main timing bar at the very top.
          const isTopRow = (idx === 0);
          const yLabel = isTopRow ? (y0 + rowH + 12) : (y0 - 12);
          ctx.textBaseline = isTopRow ? 'top' : 'bottom';
          ctx.textAlign = 'center';

          // Draw start label if the start tick is within the viewport
          if(segStartAbs >= v0 && segStartAbs <= v1){
            const xStart = (segStartAbs - v0) * pps;
            ctx.fillText(String(Math.round(tStartC)), xStart, yLabel);
          }
          // Draw end label if the end tick is within the viewport
          if(segEndAbs >= v0 && segEndAbs <= v1){
            const xEnd = (segEndAbs - v0) * pps;
            ctx.fillText(String(Math.round(tEndC)), xEnd, yLabel);
          }
          ctx.restore();
        }

        // --- tiny blue triangle indicators on nearest tick to start/end (pointing toward the green bar)
        if (App.state.showGuides) (function(){
          // Skip if segment is completely outside viewport
          if(!(segEndAbs >= v0 && segStartAbs <= v1)) return;

          // Round to nearest second to align with tick marks
          const tStartTick = Math.round(segStartAbs);
          const tEndTick   = Math.round(segEndAbs);

          // Compute x positions (only draw if inside viewport)
          const xStartTick = (tStartTick - v0) * pps;
          const xEndTick   = (tEndTick   - v0) * pps;

          // Triangle size
          const tri = 6;

          const isTopRow = (idx === 0);
          // Triangle apex sits exactly on the tick base line
          //  • non-top rows: ticks are drawn upward from y0, so base = y0
          //  • top row (A): mirrored ticks are drawn downward from y0+rowH, so base = y0 + rowH
          const yBase = isTopRow ? (y0 + rowH) : y0;

          ctx.save();
          ctx.fillStyle = '#1e88ff';   // blue
          ctx.strokeStyle = '#1e88ff';

          // Helper to draw an isosceles triangle pointing up or down
          function drawTriangle(xc, yBase, dirDown){
            ctx.beginPath();
            if (dirDown){
              // point DOWN: apex at yBase, base above
              ctx.moveTo(xc, yBase);
              ctx.lineTo(xc - tri*0.7, yBase - tri);
              ctx.lineTo(xc + tri*0.7, yBase - tri);
            } else {
              // point UP: apex at yBase, base below
              ctx.moveTo(xc, yBase);
              ctx.lineTo(xc - tri*0.7, yBase + tri);
              ctx.lineTo(xc + tri*0.7, yBase + tri);
            }
            ctx.closePath();
            ctx.fill();
          }

          // Start triangle
          if (tStartTick >= Math.floor(v0) && tStartTick <= Math.ceil(v1)) {
            drawTriangle(xStartTick, yBase, /*dirDown=*/ !isTopRow);
          }
          // End triangle
          if (tEndTick >= Math.floor(v0) && tEndTick <= Math.ceil(v1)) {
            drawTriangle(xEndTick, yBase, /*dirDown=*/ !isTopRow);
          }

          ctx.restore();
        })();

        // queued change delay marker (clipped)
        const nextReqAbs = base + rc.details[i].rqNext;
        const delay = rc.details[i].delay;
        if(App.initCfg.utcPlan.showQueuedChangeMarkers && delay>0){
          const x1s = Math.max(v0, nextReqAbs), x2s = Math.max(v0, Math.min(v1, base + RCn));
          if(x2s > x1s){
            ctx.strokeStyle='rgba(74,161,255,0.7)'; ctx.setLineDash([4,3]);
            const x1=(x1s - v0)*pps, x2=(x2s - v0)*pps; ctx.beginPath(); ctx.moveTo(x1, y0+4); ctx.lineTo(x2, y0+4); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle='rgba(74,161,255,0.9)'; ctx.beginPath(); ctx.moveTo(x2, y0+4); ctx.lineTo(x2-5, y0-4); ctx.lineTo(x2+5, y0-4); ctx.closePath(); ctx.fill();
          }
        }

        // intergreen shading (clipped)
        const igNext = Math.max(0, j.intergreen[curIdx][nextIdx]);
        if(igNext>0){
          const igStartAbs = base + RCn, igEndAbs = igStartAbs + igNext;
          const is = Math.max(v0, igStartAbs), ie = Math.min(v1, igEndAbs);
          if(ie>is){ ctx.fillStyle = 'rgba(150,150,150,0.35)'; ctx.fillRect((is-v0)*pps, y0+6, (ie-is)*pps, rowH-12); }
        }
      }
    }
  });
  // ---- Journey overlays (shaded polygons + direction arrows) ----
  if(Array.isArray(App.state._overlays)){
    App.state._overlays.forEach(ovl=>{
      const fromIdx = ovl.from, toIdx = ovl.to;
      if(fromIdx==null || toIdx==null) return;
      const Jfrom = App.state.junctions[fromIdx];
      const rcFrom = computeRealisedCycleAdj(Jfrom);
      if(!rcFrom.ok) return;
      const travel = travelTimeBetween(fromIdx, toIdx);

      // Edge-to-edge: use inner top/bottom edges of the green bars (avoid tick clutter)
      const yFrom = rowY(top, rowH, gap, fromIdx);
      const yTo   = rowY(top, rowH, gap, toIdx);
      const yFromTop = yFrom + 6, yFromBot = yFrom + rowH - 6;
      const yToTop   = yTo   + 6, yToBot   = yTo   + rowH - 6;
      const yMidFrom = (yFromTop + yFromBot)/2;
      const yMidTo   = (yToTop + yToBot)/2;
      const dir = (toIdx>fromIdx) ? +1 : (toIdx<fromIdx ? -1 : 0);

      const Cj = rcFrom.Cj;
      // Determine which cycles to evaluate so that either upstream or downstream windows intersect the viewport
      const kMin = Math.floor((v0 - travel)/Cj) - 1;
      const kMax = Math.ceil((v1)/Cj) + 1;

      for(let k=kMin; k<=kMax; k++){
        const base = k*Cj;

        for(let i=0;i<rcFrom.details.length;i++){
          if(ovl.mode === 'time' && i > 0) continue; // time-based: single window per cycle
          const d = rcFrom.details[i];
          let tStartAbs, tEndAbs;
          if(ovl.mode === 'time'){
            tStartAbs = base + (ovl.start||0);
            tEndAbs   = base + Math.max(ovl.start||0, ovl.end||0);
          }else if(ovl.mode === 'stage-to-stage'){
            // Stage-to-stage: find the time points for fromStage/fromEdge and toStage/toEdge
            // Both stages are at the origin junction
            const fromStageLabel = ovl.fromStage;
            const toStageLabel = ovl.toStage;

            // Find the detail entries for both stages in this cycle
            let fromDetail = null, toDetail = null;
            for(let j=0; j<rcFrom.details.length; j++){
              if(rcFrom.details[j].curStage === fromStageLabel) fromDetail = rcFrom.details[j];
              if(rcFrom.details[j].curStage === toStageLabel) toDetail = rcFrom.details[j];
            }

            if(!fromDetail || !toDetail) continue; // Skip if stages not found

            // Determine start time based on fromEdge
            if(ovl.fromEdge === 'end'){
              tStartAbs = base + rcFrom.RC[rcFrom.details.indexOf(fromDetail) + 1]; // end of green
            }else{
              tStartAbs = base + fromDetail.stageStart; // start of green
            }

            // Determine end time based on toEdge
            if(ovl.toEdge === 'end'){
              tEndAbs = base + rcFrom.RC[rcFrom.details.indexOf(toDetail) + 1]; // end of green
            }else{
              tEndAbs = base + toDetail.stageStart; // start of green
            }

            // Only draw once per cycle (not for every stage)
            if(i > 0) continue;
          }else{ // stage-based (default)
            if(ovl.stage && d.curStage !== ovl.stage) continue;
            tStartAbs = base + d.stageStart;      // at(s) + preceding intergreen
            tEndAbs   = base + rcFrom.RC[i+1];    // max(next request, start + minGreen)
          }
          if(!(tEndAbs > tStartAbs)) continue;

          // Downstream arrival window = upstream window shifted by travel time
          const aStart = tStartAbs + travel;
          const aEnd   = tEndAbs + travel;

          // Cull if completely out of viewport
          if(aStart > v1+5 || tEndAbs < v0-5) continue;

          const xS  = (tStartAbs - v0) * pps;
          const xE  = (tEndAbs   - v0) * pps;
          const xAS = (aStart    - v0) * pps;
          const xAE = (aEnd      - v0) * pps;

          // Decide line heights based on direction (downward uses bottom of from-row to top of to-row)
          const yFromLine = (toIdx>fromIdx) ? yFromBot : yFromTop;
          const yToLine   = (toIdx>fromIdx) ? yToTop   : yToBot;

          ctx.save();
          // Shaded polygon connecting the chosen edges of upstream and downstream windows
          ctx.globalAlpha = Math.max(0.05, Math.min(0.95, ovl.alpha || App.initCfg.overlays.shadeAlpha || 0.3));
          ctx.fillStyle = ovl.color || 'rgba(255,165,0,0.25)';
          ctx.beginPath();
          ctx.moveTo(xS,  yFromLine);
          ctx.lineTo(xAS, yToLine);
          ctx.lineTo(xAE, yToLine);
          ctx.lineTo(xE,  yFromLine);
          ctx.closePath();
          ctx.fill();

          // Dashed horizontal windows drawn on those edges
          ctx.globalAlpha = 1;
          ctx.strokeStyle = ovl.color || '#ffa500';
          ctx.lineWidth = 2;
          ctx.setLineDash([6,4]);
          // Upstream release window (horizontal)
          ctx.beginPath(); ctx.moveTo(xS,  yFromLine); ctx.lineTo(xE,  yFromLine); ctx.stroke();
          // Downstream arrival window (horizontal)
          ctx.beginPath(); ctx.moveTo(xAS, yToLine);   ctx.lineTo(xAE, yToLine);   ctx.stroke();
          ctx.setLineDash([]);

          // choose upstream/downstream edges nearest in time to tighten the diagonal endpoints
          const aMid = (aStart + aEnd) / 2;
          const tMid = (tStartAbs + tEndAbs) / 2;
          const upEdgeT   = (Math.abs(tStartAbs - aMid) <= Math.abs(tEndAbs - aMid)) ? tStartAbs : tEndAbs;
          const downEdgeT = (Math.abs(aStart   - tMid) <= Math.abs(aEnd    - tMid)) ? aStart   : aEnd;
          const xUpEdge   = (upEdgeT   - v0) * pps;
          const xDownEdge = (downEdgeT - v0) * pps;

          // Timeline arrows at the right ends of the windows (always forward in time)
          drawArrowHeadRight(ctx, xE,  yFromLine);
          drawArrowHeadRight(ctx, xAE, yToLine);

          // (Label removed)
          ctx.restore();
        }
      }
    });
  }
  const info = document.getElementById('info');
  if(info) info.textContent = `View ${viewDurSec.toFixed(1)}s @ ${pps}px/s · t=[${v0.toFixed(1)}, ${v1.toFixed(1)}] · canvas ${C.width}×${C.height}`;

  // Prevent infinite redraw loops
  if (C.width < 120) {
    if (!C.__narrowCount) C.__narrowCount = 0;
    C.__narrowCount++;
    if (C.__narrowCount < 3) {
      // Occasionally first paint happens before layout; schedule a second pass
      scheduleRedraw('post-draw width<120');
    } else {
      C.__narrowCount = 0; // Reset after 3 attempts to prevent infinite loop
    }
  } else {
    C.__narrowCount = 0; // Reset counter when width is valid
  }

  log('Hidden canvas redrawn (viewport-fixed)','info');
}

// (1) Keep this


function sizeCanvasHiDPI(canvas, cssW, cssH) {
  if (!canvas) return { ctx: null, dpr: 1 };
  const dpr = Math.max(1, (window.devicePixelRatio || 1));
  
  // Set the CSS display size
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  
  // Set the backing store size (actual pixel buffer)
  const bw = Math.max(1, Math.round(cssW * dpr));
  const bh = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== bw) canvas.width = bw;
  if (canvas.height !== bh) canvas.height = bh;

  const ctx = canvas.getContext('2d');
  if (ctx && typeof ctx.setTransform === 'function') {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 1 unit = 1 CSS pixel
  }
  return { ctx, dpr };
}

// (2) -- Keep
function drawLabels() {
  const label = document.getElementById('labelCanvas');
  const scroller = document.getElementById('timelineScroll');
  if (!label || !scroller) return;

  const fallbackW = App.initCfg.plot.leftMargin || 120;
  const { top, rowH, gap, totalH } = computeVerticalLayout();
  const height = totalH;
  if (height < 50) { scheduleRedraw('labels: tiny height'); return; }

  // Use the actual computed CSS width of the label area to avoid first-open stretch
  const r = label.getBoundingClientRect();
  // Guard: if label column is still hidden or too narrow, defer (but prevent infinite loops)
  if (!r || !r.width || r.width < 20) {
    // Only defer if we haven't already tried multiple times (prevent infinite loop)
    if (!label.__deferCount) label.__deferCount = 0;
    label.__deferCount++;
    if (label.__deferCount <= 3) {
      ensureRedrawSoon('labels: hidden or tiny width');
      return;
    }
    // After 3 attempts, stop deferring and use fallback width
    // Don't reset counter - keep it high to prevent future loops
  } else {
    label.__deferCount = 0; // Reset counter when we get valid width
  }

  const cssW = Math.max(1, Math.round((r && r.width) ? r.width : fallbackW));

  // HiDPI-safe sizing so 1 canvas unit = 1 CSS pixel
  const { ctx: lctx } = sizeCanvasHiDPI(label, cssW, height);
  if (!lctx) return;
  if (lctx.imageSmoothingEnabled !== undefined) lctx.imageSmoothingEnabled = false;

  // Background
  lctx.fillStyle = '#fff';
  lctx.fillRect(0, 0, cssW, height);

  // Junction names
  lctx.fillStyle = '#111';
  lctx.font = '12px system-ui';
  App.state.junctions.forEach((j, idx) => {
    const y0 = top + idx * (rowH + gap);
    lctx.fillText(j.name, 12, y0 + rowH * 0.6);
  });

  // Between-junction journey times in the left margin (A→B down, B→A up)
  try {
    const juncs = App.state.junctions || [];
    lctx.save();
    lctx.font = '11px system-ui';
    lctx.textAlign = 'right';
    lctx.textBaseline = 'middle';
    lctx.fillStyle = '#333';
    const xRight = cssW - 8; // right edge inside the gutter

    for (let i = 0; i < juncs.length - 1; i++) {
      const a = juncs[i], b = juncs[i + 1];
      const y0 = top + i * (rowH + gap);
      const midY = y0 + rowH + (gap / 2);
      const downSec = (a && typeof a.travelNext === 'number') ? a.travelNext : 0; // A→B
      const upSec   = (b && typeof b.travelPrev === 'number') ? b.travelPrev : 0; // B→A

      // Two stacked lines: up above, down below
      const dy = Math.min(10, Math.max(6, Math.floor(gap * 0.3)));
      lctx.fillText(`↑ ${upSec}s`,   xRight, midY - dy);
      lctx.fillText(`↓ ${downSec}s`, xRight, midY + dy);
    }
    lctx.restore();
  } catch (_) { /* ignore */ }
}




