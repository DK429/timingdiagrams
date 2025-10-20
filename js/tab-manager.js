// Signal Plan Checker v2.6.2 - Tab Manager Module
// Master tab switching (Data/Plot/Debug)

// Master Data / Plot / Debug tab handling..
(function(){
function el(id){ return document.getElementById(id); }

function setActive(btnId){
  ['tabDataBtn','tabPlotBtn','tabDebugBtn'].forEach(id=>{
    const btn = el(id);
    if(btn){ btn.classList.toggle('active', id===btnId); }
  });
}

function showPanel(which){
  // hide all
  const dataCard = el('bootAlert') && el('bootAlert').parentElement;
  if(dataCard) dataCard.style.display='none';
  const plot = el('plotPanel'); if(plot){ plot.style.display='none'; plot.setAttribute('aria-hidden','true'); }
  const dbg  = el('debugPanel'); if(dbg){ dbg.style.display='none'; dbg.setAttribute('aria-hidden','true'); }

  // show requested
  if(which==='data'){
    setActive('tabDataBtn');
    if(dataCard) dataCard.style.display='';
  }else if(which==='plot'){
    setActive('tabPlotBtn');
    if(plot){ plot.style.display=''; plot.setAttribute('aria-hidden','false'); }
    // After becoming visible, measure and redraw on next frame to avoid blurry oversize canvas
    requestAnimationFrame(()=>{
      if(typeof drawLabels === 'function') drawLabels();
      if(typeof drawHidden === 'function' && App.state && App.state.validOk && App.state.readyToPlot){
        drawHidden();
        // One-shot auto-fit on first time Plot becomes visible after plotting
        if(!App.state.didAutoFit){
          const Cj = App.state.mainCycle; const N = App.state.viewCycles || 2;
          const viewportPx = measureViewportPx();
          if(viewportPx > 0 && Cj){
            // choose px/s so [C, C*N] fills the viewport exactly and set left edge at C
            App.state.pxPerSec = Math.max(1, viewportPx / Math.max(1, N*Cj));
            setViewStart(Cj);
            const zoom = document.getElementById('zoom');
            if(zoom){ const zmin=1,zmax=12; zoom.value = String(Math.max(zmin, Math.min(zmax, zmax - (Math.round(App.state.pxPerSec) - zmin)))); }
            drawHidden();
            drawLabels();
            App.state.didAutoFit = true;
          }
        }
      }
    });
  }else if(which==='debug'){
    setActive('tabDebugBtn');
    if(dbg){ dbg.style.display=''; dbg.setAttribute('aria-hidden','false'); }
  }
}

// Expose showPanel for boot-time use
window.__showPanel = showPanel;

document.addEventListener('DOMContentLoaded', ()=>{
  el('tabDataBtn')  && el('tabDataBtn').addEventListener('click', ()=> showPanel('data'));
  el('tabPlotBtn')  && el('tabPlotBtn').addEventListener('click', ()=> showPanel('plot'));
  el('tabDebugBtn') && el('tabDebugBtn').addEventListener('click', ()=> showPanel('debug'));
  // initial state
  showPanel('data');
});
})();



