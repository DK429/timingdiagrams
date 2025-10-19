// Signal Plan Checker v2.6.1h - Core Module
// App state, utilities, and core UI functions

function runSanityChecks(){
  const requiredIds = [
    // Top-level controls
    'validateBtn','plotBtn','saveAllBtn','loadAllBtn','helpBtn','loadFileInput',
    // Help modal
    'helpModal','helpViewer','helpObject','helpFallback','helpCloseBtn','helpCloseBtn2','helpOpenNew',
    // Data & plot containers
    'dataPanel','plotPanel','jtabs','tabpanels',
    // Canvases / scroller
    'labelCanvas','hiddenCanvas','timelineScroll',
    // Status chips
    'statusChip','fileNameLabel',
    // Scale Plans modal + fields
    'scaleBtn','scaleModal','scCur','scTarget','scPreview','scDiag',
    'scRemoveDouble','scPreviewBtn','scApplyBtn','scExportBtn','scCancelBtn','scCloseBtn','scSuggestBtn','scSuggestMsg'
  ];
  const missing = [];
  for(const id of requiredIds){ if(!document.getElementById(id)) missing.push(id); }
  if(missing.length){
    const msg = 'Missing elements: ' + missing.join(', ');
    try{ setStatus('⚠️ UI check: ' + msg); }catch(_){/* noop */}
    try{ console.warn('[SanityChecks]', msg); }catch(_){/* noop */}
  } else {
    try{ setStatus('UI check passed'); }catch(_){/* noop */}
  }
}
// Run after DOM is ready (does not interfere with boot)
document.addEventListener('DOMContentLoaded', runSanityChecks);


const App = { initCfg:null, state:{ validOk:false, readyToPlot:false, pxPerSec:8, viewStartSec:0, didAutoFit:false, fileName:null, showGuides:true, temp:{ offsets:{}, boundary:{} }, __loadingFromFile:false } };

// --- Redraw scheduler (double-RAF to let layout settle) ---
App.__redrawToken = 0;
function scheduleRedraw(reason){
  try{ if(reason) log('scheduleRedraw: '+reason,'info'); }catch(_){/* noop */}
  const token = ++App.__redrawToken;
  requestAnimationFrame(()=>{
    // if another redraw was scheduled, skip this one
    if(token !== App.__redrawToken) return;
    requestAnimationFrame(()=>{
      if(token !== App.__redrawToken) return;
      try{ drawLabels(); drawHidden(); }catch(e){ try{ log('Redraw error: '+(e&&e.message?e.message:e),'err'); }catch(_){}}
    });
  });
}

// Observe Plot panel visibility and container size to trigger correct first draw
(function wirePlotObservers(){
  if (window.__plotObserversWired) return; // idempotent
  window.__plotObserversWired = true;
  document.addEventListener('DOMContentLoaded', ()=>{
    const plotPanel = document.getElementById('plotPanel');
    const timeline  = document.getElementById('timelineScroll');
    const plotBtn   = document.getElementById('tabPlotBtn');

    // If plot tab button exists, trigger a redraw soon after it is clicked
    if(plotBtn && !plotBtn.__redrawHook){
      plotBtn.__redrawHook = true;
      plotBtn.addEventListener('click', ()=> scheduleRedraw('tabPlotBtn click'));
    }

    // Ensure next draw uses viewCycles width when switching to Plot tab
    if(plotBtn){
      plotBtn.addEventListener('click', ()=> { App.state.forceViewCyclesOnce = true; }, { passive:true });
    }

    // IntersectionObserver: when Plot panel becomes visible, redraw
    if(plotPanel && !plotPanel.__io){
      const io = new IntersectionObserver((entries)=>{
        const vis = entries.some(e=> e.isIntersecting && e.intersectionRatio > 0);
        if(vis){ scheduleRedraw('plotPanel visible'); }
      }, { root: null, threshold: [0, 0.01, 0.1] });
      io.observe(plotPanel);
      plotPanel.__io = io;
    }

    // ResizeObserver: when the scroll container width changes, redraw
    if(timeline && !timeline.__ro){
      let pending = false;
      const ro = new ResizeObserver(()=>{
        if(pending) return; pending = true;
        requestAnimationFrame(()=>{ pending = false; scheduleRedraw('timelineScroll resized'); });
      });
      ro.observe(timeline);
      timeline.__ro = ro;
    }

    // Also set the flag when the Data panel's Plot button is clicked
    const mainPlotBtn = document.getElementById('plotBtn');
    if(mainPlotBtn && !mainPlotBtn.__zoomHook){
      mainPlotBtn.__zoomHook = true;
      mainPlotBtn.addEventListener('click', ()=> { App.state.forceViewCyclesOnce = true; }, { passive:true });
    }
  });
})();

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function setViewStart(newStart){
  const M = App.state.mainCycle;
  const mult = (App.initCfg.plot && App.initCfg.plot.hiddenWindowMultiplier) || 5;
  const T = M * (mult + 1); // total seconds (+1 for warmup cycle)
  const C = document.getElementById('hiddenCanvas');
  const viewportSec = (C && C.width ? (C.width / (App.state.pxPerSec||1)) : 0);
  // Prevent scrolling back to warmup cycle (first mainCycle seconds are warmup)
  const minViewStart = M;
  App.state.viewStartSec = clamp(newStart, minViewStart, Math.max(minViewStart, T - viewportSec));
}

// Helper: measure the viewport width (px) excluding the label gutter
function measureViewportPx(){
  const ts = document.getElementById('timelineScroll');
  const w = ts ? Math.max(0, Math.floor(ts.getBoundingClientRect().width)) : 0;
  return Math.max(100, w);
}

function setDirty(){
  const v=document.getElementById('validateBtn');
  const p=document.getElementById('plotBtn');
  const x=document.getElementById('transferBtn');
  // --- Scale Plans button definitions (grab handle)
  const s=document.getElementById('scaleBtn');
  const plotTab=document.getElementById('tabPlotBtn');
  const dataTab=document.getElementById('tabDataBtn');
  const plotPanel=document.getElementById('plotPanel');
  const dataPanel=document.getElementById('dataPanel');

  if(v) v.classList.add('dirty');
  if(p){ p.classList.add('dirty'); p.disabled = true; }
  if(x){ x.disabled = true; }
  if(s){ s.classList.add('dirty'); s.disabled = true; }

  // Disable Plot tab when data changes
  if(plotTab){
    plotTab.disabled = true;
    // If currently on Plot tab, switch back to Data tab
    if(plotTab.classList.contains('active')){
      plotTab.classList.remove('active');
      if(dataTab) dataTab.classList.add('active');
      if(plotPanel){ plotPanel.style.display='none'; plotPanel.classList.remove('active'); }
      if(dataPanel){ dataPanel.style.display=''; dataPanel.classList.add('active'); }
    }
  }

  App.state.validOk=false;
  App.state.readyToPlot=false;
  setStatus('Changes detected — Validate required before viewing Plot');
}

// Reset state after loading new data, switch to Data tab, and require re-validation
function switchToDataAndResetAfterLoad(){
  try{
    // Reset flags
    App.state.validOk = false;
    App.state.readyToPlot = false;
    App.state.didAutoFit = false;
    // UI: disable Plot button and tab
    const plotBtn   = document.getElementById('plotBtn');
    if (plotBtn) plotBtn.disabled = true;
    const plotTab   = document.getElementById('tabPlotBtn');
    if (plotTab) plotTab.disabled = true;

    // Switch visible panel to Data
    const dataTab   = document.getElementById('tabDataBtn');
    const debugTab  = document.getElementById('tabDebugBtn');
    const dataPanel = document.getElementById('dataPanel');
    const plotPanel = document.getElementById('plotPanel');
    if (dataTab)  dataTab.classList.add('active');
    if (plotTab)  plotTab.classList.remove('active');
    if (debugTab) debugTab.classList.remove('active');
    if (dataPanel){ dataPanel.style.display=''; dataPanel.classList.add('active'); }
    if (plotPanel){ plotPanel.style.display='none'; plotPanel.classList.remove('active'); }

    // Mark dirty (disables features and updates message), then override status with a clearer hint
    setDirty();
    setStatus('New data loaded — please Validate, then Plot to render the diagram.');
  }catch(e){ try{ log('switchToDataAndResetAfterLoad failed: '+(e&&e.message?e.message:e),'err'); }catch(_){}}
}

function log(msg, level){
  try{
    const box=document.getElementById('log'); if(!box) return;
    const d=document.createElement('div'); d.className='logline '+(level||'info'); d.textContent='['+new Date().toLocaleTimeString()+'] '+msg;
    box.appendChild(d); box.scrollTop=box.scrollHeight;
  }catch(e){}
}

function setStatus(msg){
  try{
    const chip = document.getElementById('statusChip');
    if(chip){
      chip.textContent = 'Status Message: ' + msg;
      // quick visual pulse (optional)
      chip.style.transition = 'background-color .25s';
      const old = chip.style.backgroundColor;
      chip.style.backgroundColor = '#eef9ee';
      setTimeout(()=>{ chip.style.backgroundColor = old || '#fff'; }, 250);
    }
  }catch(_){/* noop */}
}

function setFileNameLabel(name){
  const el = document.getElementById('fileNameLabel');
  if(!el) return;
  const base = (name && name.trim()) ? name.trim() : 'file unsaved';
  let suffix = '';
  if (name && name.trim()){
    try{
      const t = new Date();
      const hh = String(t.getHours()).padStart(2,'0');
      const mm = String(t.getMinutes()).padStart(2,'0');
      suffix = ' • Last saved: ' + hh + ':' + mm;
    }catch(_){/* noop */}
  }
  el.textContent = 'Filename: ' + base + suffix;

  // If this rename came from a file load, force user to Validate + Plot before opening Plot
  if (App.state && App.state.__loadingFromFile){
    App.state.__loadingFromFile = false; // clear the one-shot marker
    setTimeout(switchToDataAndResetAfterLoad, 0);
    setTimeout(switchToDataAndResetAfterLoad, 200);
  }
}
// Mark that a file-based load is starting when the visible Load button is clicked
document.addEventListener('DOMContentLoaded', function(){
  const loadBtn = document.getElementById('loadAllBtn');
  if(loadBtn && !loadBtn.__markLoad){
    loadBtn.__markLoad = true;
    // Use capture so our marker runs before other click handlers that open dialogs
    loadBtn.addEventListener('click', function(){
      if(App && App.state) App.state.__loadingFromFile = true;
    }, { capture: true });
  }
});

// Help button: open the PDF manual in an in-app modal (idempotent)
document.addEventListener('DOMContentLoaded', function(){
  const helpBtn     = document.getElementById('helpBtn');
  const helpModal   = document.getElementById('helpModal');
  const helpObject  = document.getElementById('helpObject');
  const helpClose   = document.getElementById('helpCloseBtn');
  const helpClose2  = document.getElementById('helpCloseBtn2');
  const helpOpenNew = document.getElementById('helpOpenNew');

  function openHelp(){
    try{
      if (helpObject) {
        // Set every time in case the previous attempt failed or the file moved
        helpObject.data = 'TD2_User_Manual.pdf#toolbar=1&navpanes=0&zoom=page-fit';
      }
      if (helpModal) {
        helpModal.classList.add('show');
        enableDragModal('helpModal');
        setStatus('📖 User manual is open.');
      }
    }catch(e){ setStatus('Error opening manual: ' + (e && e.message ? e.message : String(e))); }
  }
  function closeHelp(){ if(helpModal) helpModal.classList.remove('show'); }

  if(helpBtn && !helpBtn.__wired){ helpBtn.__wired = true; helpBtn.addEventListener('click', openHelp); }
  if(helpClose && !helpClose.__wired){ helpClose.__wired = true; helpClose.addEventListener('click', closeHelp); }
  if(helpClose2 && !helpClose2.__wired){ helpClose2.__wired = true; helpClose2.addEventListener('click', closeHelp); }
  if(helpOpenNew && !helpOpenNew.__wired){
    helpOpenNew.__wired = true;
    helpOpenNew.addEventListener('click', function(){
      const url = 'TD2_User_Manual.pdf';
      const win = window.open(url, '_blank', 'noopener');
      if(!win) setStatus('⚠️ Please allow pop-ups to view the manual.');
    });
  }

  // close when clicking on the backdrop (not inside the card)
  if(helpModal && !helpModal.__backdrop){
    helpModal.__backdrop = true;
    helpModal.addEventListener('click', (e)=>{ if(e.target === helpModal) closeHelp(); });
  }
  // close on Escape
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && helpModal && helpModal.classList.contains('show')) closeHelp();
  });
});

// --- Guard Plot tab from opening until Validate + Plot (idempotent)
document.addEventListener('DOMContentLoaded', function(){
  const plotTab = document.getElementById('tabPlotBtn');
  const dataTab = document.getElementById('tabDataBtn');
  const plotPanel = document.getElementById('plotPanel');
  const dataPanel = document.getElementById('dataPanel');
  if(plotTab && !plotTab.__guarded){
    plotTab.__guarded = true;
    plotTab.addEventListener('click', function(e){
      const blocked = plotTab.disabled || !App.state.validOk || !App.state.readyToPlot;
      if(blocked){
        if(e && e.preventDefault) e.preventDefault();
        // Provide specific feedback based on state
        if(!App.state.validOk && !App.state.readyToPlot){
          setStatus('Plot tab disabled — Data has changed. Please Validate, then Plot to view diagram.');
        }else if(!App.state.validOk){
          setStatus('Plot tab disabled — Please Validate your data first.');
        }else if(!App.state.readyToPlot){
          setStatus('Plot tab disabled — Please click Plot button to generate diagram.');
        }else{
          setStatus('Plot tab disabled — Please Validate and Plot before viewing diagram.');
        }
        if(dataTab) dataTab.classList.add('active');
        plotTab.classList.remove('active');
        if(plotPanel){ plotPanel.style.display='none'; plotPanel.classList.remove('active'); }
        if(dataPanel){ dataPanel.style.display=''; dataPanel.classList.add('active'); }
      }
    });
  }
});
