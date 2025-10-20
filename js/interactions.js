// Signal Plan Checker v2.6.2 - Interactions Module
// Drag, pan, zoom, and gesture handling

// === Drag-to-pan (pointer drag on the timeline) ===
(function addDragPan(){
  const area = document.getElementById('timelineScroll');
  if(!area) return;
  let dragging = false, startX = 0, startV0 = 0;

  area.addEventListener('pointerdown', (e)=>{
    dragging = true;
    startX = e.clientX;
    startV0 = App.state.viewStartSec;
    try{ area.setPointerCapture(e.pointerId); }catch(_){/* noop */}
  });
  area.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    const dx = e.clientX - startX;
    const secDelta = -dx / (App.state.pxPerSec || 1);
    setViewStart(startV0 + secDelta);
    drawHidden();
  });
  ['pointerup','pointercancel','pointerleave'].forEach(type=>{
    area.addEventListener(type, ()=>{
      dragging = false;
    });
  });
})();

// === Arrow keys to pan (Shift for fine pan) ===
(function addKeyPan(){
  function stepSec(){
    const C = document.getElementById('hiddenCanvas');
    const px = (C && C.width) || 600;
    return Math.max(1, Math.round((px / (App.state.pxPerSec||1)) * 0.1));
  }
  document.addEventListener('keydown', (e)=>{
    if(document.activeElement && ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) return;
    if(e.key==='ArrowLeft' || e.key==='ArrowRight'){
      e.preventDefault();
      const fine = e.shiftKey ? 0.25 : 1;
      const deltaSec = stepSec() * (e.key==='ArrowLeft' ? -1 : 1) * fine;
      setViewStart(App.state.viewStartSec + deltaSec);
      drawHidden();
    }
  });
})();

// === Redraw on window resize (keep viewport width in sync) ===
(function addResizeRedraw(){
  let t=null;
  window.addEventListener('resize', ()=>{
    clearTimeout(t);
    t = setTimeout(()=>{
      const vp = measureViewportPx();
      if(App.state.readyToPlot && App.state.validOk){
        drawHidden();
        drawLabels();
      }else{
        // Before first plot: choose px/s so [C, C*N] fits the viewport
        const Cj = App.state.mainCycle; const N = App.state.viewCycles || 2;
        if(Cj){
          const vp2 = measureViewportPx();
          if(vp2>0){
            App.state.pxPerSec = Math.max(1, vp2 / Math.max(1, N*Cj));
            setViewStart(Cj);
            const zoom = document.getElementById('zoom');
            if(zoom){ const zmin=1,zmax=12; zoom.value = String(Math.max(zmin, Math.min(zmax, zmax - (Math.round(App.state.pxPerSec) - zmin)))); }
          }
        }
      }
    }, 120);
  });
})();

// === Pinch/Trackpad zoom with pointer anchor ===
(function addWheelPinchZoom(){
  const area = document.getElementById('timelineScroll');
  if(!area) return;
  const zoomSlider = document.getElementById('zoom');
  const zmin = 1, zmax = 12;

  area.addEventListener('wheel', (e)=>{
    if(!e.ctrlKey) return; // only treat ctrl+wheel as zoom (trackpad pinch)
    e.preventDefault();
    const rect = area.getBoundingClientRect();
    const oldPps = App.state.pxPerSec || 4;
    const x = e.clientX - rect.left;              // px from left edge in viewport
    const anchorSec = App.state.viewStartSec + (x / oldPps);

    // deltaY > 0 => zoom out; < 0 => zoom in. Pick a gentle factor.
    const factor = Math.exp(-e.deltaY * 0.0015);
    let newPps = oldPps * factor;
    newPps = Math.max(1, Math.min(200, newPps)); // clamp sane range
    App.state.pxPerSec = newPps;

    // Keep the same timeline second under the pointer after zoom
    const newV0 = anchorSec - (x / newPps);
    setViewStart(newV0);

    // Sync slider (inverted mapping)
    if(zoomSlider){ zoomSlider.value = String(zmax - (Math.round(App.state.pxPerSec) - zmin)); }

    drawHidden();
    drawLabels();
  }, {passive:false});
})();

// === Touch pinch-to-zoom (two fingers) with midpoint anchor ===
(function addTouchPinchZoom(){
  const area = document.getElementById('timelineScroll');
  if(!area) return;
  const zoomSlider = document.getElementById('zoom');
  const zmin = 1, zmax = 12;
  let tracking = false;
  let startDist = 0;
  let startPps = 0;
  let anchorX = 0; // viewport px from left
  let anchorSec = 0;

  function getTouches(e){ return e.touches ? Array.from(e.touches) : []; }
  function dist(a,b){ const dx=a.clientX-b.clientX, dy=a.clientY-b.clientY; return Math.hypot(dx,dy); }
  function mid(a,b){ return { x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2 }; }

  area.addEventListener('touchstart', (e)=>{
    const ts = getTouches(e);
    if(ts.length===2){
      const rect = area.getBoundingClientRect();
      startDist = dist(ts[0], ts[1]);
      startPps = App.state.pxPerSec || 4;
      const m = mid(ts[0], ts[1]);
      anchorX = m.x - rect.left;
      anchorSec = App.state.viewStartSec + (anchorX / startPps);
      tracking = true;
      e.preventDefault();
    }
  }, {passive:false});

  area.addEventListener('touchmove', (e)=>{
    if(!tracking) return;
    const ts = getTouches(e);
    if(ts.length!==2){ tracking=false; return; }
    const d = dist(ts[0], ts[1]);
    if(startDist <= 0) return;
    const factor = d / startDist; // >1 zoom in, <1 zoom out
    let newPps = startPps * factor;
    newPps = Math.max(1, Math.min(200, newPps));
    App.state.pxPerSec = newPps;

    const newV0 = anchorSec - (anchorX / newPps);
    setViewStart(newV0);

    if(zoomSlider){ zoomSlider.value = String(zmax - (Math.round(App.state.pxPerSec) - zmin)); }
    drawHidden();
    drawLabels();
    e.preventDefault();
  }, {passive:false});

  area.addEventListener('touchend', ()=>{ tracking=false; }, {passive:true});
  area.addEventListener('touchcancel', ()=>{ tracking=false; }, {passive:true});
})();

// === iOS Safari gesture events fallback (gesturestart/gesturechange/gestureend) ===
(function addWebkitGestureZoom(){
  const area = document.getElementById('timelineScroll');
  if(!area) return;
  const zoomSlider = document.getElementById('zoom');
  const zmin = 1, zmax = 12;
  let startPps = 0;
  let anchorX = 0; // px from left in the viewport
  let anchorSec = 0;

  function clampPps(v){ return Math.max(1, Math.min(200, v)); }

  area.addEventListener('gesturestart', (e)=>{
    // Prevent page zoom and initialize anchor under gesture center
    e.preventDefault();
    const rect = area.getBoundingClientRect();
    startPps = App.state.pxPerSec || 4;
    // Safari provides clientX/clientY as the gesture center
    anchorX = (typeof e.clientX === 'number' ? (e.clientX - rect.left) : (rect.width/2));
    anchorSec = App.state.viewStartSec + (anchorX / startPps);
  }, {passive:false});

  area.addEventListener('gesturechange', (e)=>{
    e.preventDefault();
    const newPps = clampPps(startPps * (e.scale || 1));
    App.state.pxPerSec = newPps;
    const newV0 = anchorSec - (anchorX / newPps);
    setViewStart(newV0);
    if(zoomSlider){ zoomSlider.value = String(zmax - (Math.round(App.state.pxPerSec) - zmin)); }
    drawHidden();
    drawLabels();
  }, {passive:false});

  area.addEventListener('gestureend', (e)=>{
    // no-op; keep final zoom
    if(e && e.preventDefault) e.preventDefault();
  }, {passive:false});
})();


