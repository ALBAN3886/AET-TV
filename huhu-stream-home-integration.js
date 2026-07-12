/* AET ALBAN ELOH TECHNOLOGIE — Huhu Quick Launcher v4 */
(function(){
  'use strict';
  const ID='aet-alban-fab-v4';
  if(document.getElementById(ID)) return;
  const style=document.createElement('style');
  style.textContent=`
    #${ID}{position:fixed;right:14px;bottom:14px;z-index:999999;font-family:Inter,system-ui,sans-serif}
    #${ID} .fab{width:60px;height:60px;border:none;border-radius:18px;cursor:pointer;background:linear-gradient(135deg,#4f8ef7,#7c3aed);color:#fff;font-weight:900;box-shadow:0 18px 40px rgba(0,0,0,.35)}
    #${ID} .panel{position:absolute;right:0;bottom:74px;width:min(92vw,370px);display:none;padding:14px;border-radius:18px;background:rgba(8,14,28,.96);color:#eef4ff;border:1px solid rgba(148,163,184,.18);box-shadow:0 24px 60px rgba(0,0,0,.4);backdrop-filter:blur(12px)}
    #${ID}.open .panel{display:block}
    #${ID} .title{font-weight:900;font-size:14px;margin-bottom:10px}
    #${ID} .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    #${ID} .btn{min-height:40px;border:none;border-radius:12px;padding:0 12px;font-weight:800;cursor:pointer}
    #${ID} .primary{background:linear-gradient(135deg,#4f8ef7,#7c3aed);color:#fff}
    #${ID} .ghost{background:rgba(255,255,255,.06);color:#eef4ff;border:1px solid rgba(148,163,184,.18)}
    #${ID} .field{margin:10px 0 8px} #${ID} input{width:100%;min-height:42px;border-radius:12px;border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.05);color:#fff;padding:0 12px;outline:none}
    #${ID} .note{margin-top:8px;font-size:12px;color:#9aa7c7}
  `;
  document.head.appendChild(style);
  const box=document.createElement('div'); box.id=ID;
  box.innerHTML=`<div class="panel"><div class="title">AET ALBAN ELOH TECHNOLOGIE</div><div class="grid"><button class="btn primary" data-go="https://huhu.to/live">TV Live</button><button class="btn ghost" data-go="https://huhu.to/movies">Films</button><button class="btn ghost" data-go="https://huhu.to/series">Séries</button><button class="btn ghost" data-copy="1">Copier URL</button></div><div class="field"><input id="aetInput" type="url" placeholder="Coller une URL huhu / HLS / MP4" /></div><div class="grid"><button class="btn primary" data-open-input="1">Ouvrir</button><button class="btn ghost" data-open-home="1">Accueil Huhu</button></div><div class="note">Lanceur rapide flottant signé AET</div></div><button class="fab">AET</button>`;
  document.body.appendChild(box);
  box.querySelector('.fab').addEventListener('click',()=>box.classList.toggle('open'));
  box.addEventListener('click',async(e)=>{
    const route=e.target.closest('[data-go]')?.dataset.go;
    if(route) location.href=route;
    if(e.target.closest('[data-copy]')){ try{ await navigator.clipboard.writeText(location.href); }catch{} }
    if(e.target.closest('[data-open-input]')){ const v=box.querySelector('#aetInput').value.trim(); if(v) location.href=v; }
    if(e.target.closest('[data-open-home]')) location.href='https://huhu.to/';
  });
})();