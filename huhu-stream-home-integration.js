/* AET ALBAN ELOH TECHNOLOGIE — Huhu Floating Launcher v3 */
(function(){
  'use strict';
  const ID='aet-alban-floating-launcher';
  if(document.getElementById(ID)) return;
  const style=document.createElement('style');
  style.textContent=`
    #${ID}{position:fixed;right:14px;bottom:14px;z-index:999999;font-family:Inter,system-ui,sans-serif}
    #${ID} .fab{width:58px;height:58px;border:none;border-radius:18px;cursor:pointer;background:linear-gradient(135deg,#4f8ef7,#7c3aed);color:#fff;font-weight:900;box-shadow:0 18px 40px rgba(0,0,0,.35)}
    #${ID} .panel{position:absolute;right:0;bottom:72px;width:min(92vw,360px);background:rgba(9,16,31,.96);color:#eef4ff;border:1px solid rgba(148,163,184,.18);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.4);padding:14px;display:none;backdrop-filter:blur(12px)}
    #${ID}.open .panel{display:block}
    #${ID} .title{font-size:14px;font-weight:900;margin-bottom:10px}
    #${ID} .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    #${ID} .btn{min-height:40px;border:none;border-radius:12px;padding:0 12px;font-weight:800;cursor:pointer}
    #${ID} .primary{background:linear-gradient(135deg,#4f8ef7,#7c3aed);color:#fff}
    #${ID} .ghost{background:rgba(255,255,255,.06);color:#eef4ff;border:1px solid rgba(148,163,184,.18)}
    #${ID} .field{margin:10px 0 8px}
    #${ID} input{width:100%;min-height:42px;border-radius:12px;border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.05);color:#fff;padding:0 12px;outline:none}
    #${ID} .note{margin-top:8px;font-size:12px;color:#9aa7c7}
  `;
  document.head.appendChild(style);
  const box=document.createElement('div'); box.id=ID;
  box.innerHTML=`<div class="panel"><div class="title">AET ALBAN ELOH TECHNOLOGIE</div><div class="row"><button class="btn primary" data-go="/live">TV Live</button><button class="btn ghost" data-go="/movies">Films</button><button class="btn ghost" data-go="/series">Séries</button><button class="btn ghost" data-copy="1">Copier URL</button></div><div class="field"><input id="aetUrlInput" type="url" placeholder="Coller un flux HLS / MP4 / huhu.to/watch..." /></div><div class="row"><button class="btn primary" data-open-input="1">Ouvrir</button><button class="btn ghost" data-open-app="1">Lancer AET App</button></div><div class="note">Lanceur rapide flottant pour huhu.to</div></div><button class="fab">AET</button>`;
  document.body.appendChild(box);
  box.querySelector('.fab').addEventListener('click',()=>box.classList.toggle('open'));
  box.addEventListener('click',async(e)=>{
    const route=e.target.closest('[data-go]')?.dataset.go;
    if(route) location.href='https://huhu.to'+route;
    if(e.target.closest('[data-copy]')){ try{ await navigator.clipboard.writeText(location.href); }catch{} }
    if(e.target.closest('[data-open-input]')){ const v=box.querySelector('#aetUrlInput').value.trim(); if(v) location.href=v; }
    if(e.target.closest('[data-open-app]')){ try{ window.open('./index.html','_blank','noopener'); }catch{} }
  });
})();