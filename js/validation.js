// Signal Plan Checker v2.6.1h - Validation Module
// Junction and plan validation logic

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


