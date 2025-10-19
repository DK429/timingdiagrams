// Signal Plan Checker v2.6.1h - File I/O Module
// Save and load functionality

// Get UK local time string (GMT/BST aware)
function getUKLocalTimeString(){
  const now = new Date();
  // Format as ISO-like string but in UK timezone
  const ukDate = now.toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  // Convert from "DD/MM/YYYY, HH:MM:SS" to "YYYY-MM-DDTHH:MM:SS"
  const parts = ukDate.split(', ');
  const dateParts = parts[0].split('/'); // DD/MM/YYYY
  const timePart = parts[1]; // HH:MM:SS
  const isoLike = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${timePart}`;

  // Add timezone offset (GMT or BST)
  const offset = -now.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offset) / 60);
  const offsetMins = Math.abs(offset) % 60;
  const offsetSign = offset >= 0 ? '+' : '-';
  const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

  return isoLike + offsetStr;
}

function buildExportObject(){
  const main = { mainCycle: App.state.mainCycle, viewCycles: App.state.viewCycles };
  const junctions = (App.state.junctions||[]).map(j=>({
    id: j.id,
    name: j.name,
    doubleCycle: !!j.doubleCycle,
    travelPrev: j.travelPrev|0,
    travelNext: j.travelNext|0,
    stages: (j.stages||[]).map(s=>({ label:s.label, minGreenSec: s.minGreenSec|0, dir: (s.dir||'none') })),
    intergreen: (j.intergreen||[]).map(row=> row.slice()),
    utcPlan: (j.utcPlan||[]).map(r=>({ to:r.to, at: r.at|0 }))
  }));
  const overlays = Array.isArray(App.state._overlays)? App.state._overlays.slice() : [];
  const temp = { offsets: {...(App.state.temp&&App.state.temp.offsets||{})}, boundary: {...(App.state.temp&&App.state.temp.boundary||{})} };
  return { version: '2.6.1h', exportedAt: getUKLocalTimeString(), main, junctions, overlays, temp };
}

function makeHumanReadableText(obj){
  const header = [
    '# Signal Plan Checker export',
    '# Version: '+(obj.version||'unknown'),
    '# Exported: '+(obj.exportedAt||getUKLocalTimeString()),
    '#',
    '# The JSON below contains:',
    '#  - main: mainCycle, viewCycles',
    '#  - junctions: per-junction config (stages, intergreens, utcPlan)',
    '#  - overlays: any saved overlays',
    '#  - temp: uncommitted adjustments (offsets, boundary)',
    '#',
    ''
  ].join('\n');
  return header + JSON.stringify(obj, null, 2) + '\n';
}

function parseHumanReadableText(text){
  // Strip comment lines starting with #, then parse JSON
  const json = text.split(/\r?\n/).filter(line=> !/^\s*#/.test(line)).join('\n');
  return JSON.parse(json);
}

// Enable drag-to-move on a modal by id (e.g., 'ovlModal' or 'adjModal')


  // === Save/Load (human-readable) ===
  const saveBtn = document.getElementById('saveAllBtn');
  const loadBtn = document.getElementById('loadAllBtn');
  const fileInp = document.getElementById('loadFileInput');

if(saveBtn){
  saveBtn.addEventListener('click', ()=>{
    try{
      // Ask the user for a name (default from current fileName or a timestamped suggestion)
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      const suggested = (App.state.fileName ? App.state.fileName.replace(/\.td2$/i,'') : `Signal-Plan-${ts}`);
      const nameInput = prompt('Enter a file name (no extension):', suggested);
      if(nameInput === null){
        setStatus('Save cancelled.');
        return;
      }
      const finalName = ensureTD2(nameInput);

      const data = buildExportObject();
      const text = makeHumanReadableText(data);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = finalName;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);

      // Remember & display the filename
      App.state.fileName = finalName;
      setFileNameLabel(App.state.fileName);
      setStatus('💾 Saved: ' + finalName);
    }catch(err){
      console.error(err);
      setStatus('❌ Save failed: ' + (err && err.message ? err.message : err));
    }
  });
}

  // Duplicate saveBtn click handler removed

  if(loadBtn && fileInp){
    loadBtn.addEventListener('click', ()=> fileInp.click());
    fileInp.addEventListener('change', async ()=>{
      const f = fileInp.files && fileInp.files[0];
      if(!f){ setStatus('No file selected.'); return; }
      try{
        const text = await f.text();
        const obj  = parseHumanReadableText(text);

        // Apply main settings
        if(obj.main){
          if(typeof obj.main.mainCycle === 'number'){
            App.state.mainCycle = obj.main.mainCycle;
            const mc = document.getElementById('mainCycle'); if(mc) mc.value = App.state.mainCycle;
          }
          if(typeof obj.main.viewCycles === 'number'){
            App.state.viewCycles = obj.main.viewCycles;
            const vc = document.getElementById('viewCycles'); if(vc) vc.value = String(App.state.viewCycles);
          }
        }

        // Apply junctions
        // (4)
        if(Array.isArray(obj.junctions)){
          App.state.junctions = obj.junctions.map(j=>({
            id: j.id,
            name: j.name,
            doubleCycle: !!j.doubleCycle,
            travelPrev: j.travelPrev|0,
            travelNext: j.travelNext|0,
            stages: (j.stages||[]).map(s=>({ label: s.label, minGreenSec: s.minGreenSec|0, dir: (s.dir||'none') })),
            intergreen: (j.intergreen||[]).map(row => row.slice()),
            utcPlan: (j.utcPlan||[]).map(r => ({ to: r.to, at: r.at|0 }))
          }));
        }

        // Apply overlays and uncommitted adjustments
        App.state._overlays = Array.isArray(obj.overlays) ? obj.overlays.slice() : [];
        App.state.temp = obj.temp ? {
          offsets:  {...(obj.temp.offsets  || {})},
          boundary: {...(obj.temp.boundary || {})}
        } : { offsets:{}, boundary:{} };

        // Refresh UI
        rebuildTabs();
        setDirty();
        runValidation({silent:true});
        if(App.state.readyToPlot && App.state.validOk){ drawHidden(); drawLabels(); }
        setStatus('📂 Loaded data from file.');
        App.state.fileName = (f && f.name) ? f.name : App.state.fileName;
        setFileNameLabel(App.state.fileName);
      }catch(err){
        console.error(err);
        setStatus('❌ Load failed: ' + (err && err.message ? err.message : err));
        alert('Load failed: ' + (err && err.message ? err.message : err));
      }finally{
        fileInp.value = '';
      }
    });
  }

  document.getElementById('validateBtn').addEventListener('click', ()=>{ runValidation({silent:false}); });


