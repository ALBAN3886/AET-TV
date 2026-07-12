/* AET ALBAN ELOH TECHNOLOGIE — huhu live helper */
(function(){
  'use strict';
  const SID='aet-live-helper-style';
  function isLive(){ return location.pathname==='/watch' && new URLSearchParams(location.search).has('live'); }
  function inject(){
    if(document.getElementById(SID)) return;
    const s=document.createElement('style'); s.id=SID;
    s.textContent=`
      @media (min-width:1100px){
        .view-watch-live{padding-right:380px!important}
        .lc{position:absolute!important;inset:0!important;pointer-events:none!important;z-index:5!important}
        .lc-bar{pointer-events:auto!important;z-index:6!important}
        .lc-backdrop{display:none!important}
        .lc-panel{position:absolute!important;top:0!important;right:0!important;bottom:0!important;width:360px!important;transform:translateX(0)!important;pointer-events:auto!important;z-index:7!important;box-shadow:-10px 0 28px rgba(0,0,0,.36)!important}
        .lc-close{display:none!important}
      }
    `;
    document.head.appendChild(s);
  }
  function openPanel(){
    const btn=document.querySelector('.lc-bar-btn,[data-open="live-channels"],.live-channels-toggle');
    if(btn) try{btn.click()}catch{}
    document.querySelectorAll('.lc-panel').forEach(p=>{p.classList.add('open');p.setAttribute('data-open','true')})
  }
  function apply(){ if(!isLive()) return; inject(); document.body.classList.add('view-watch-live'); openPanel(); }
  let last=location.href;
  const check=()=>{ if(location.href!==last){ last=location.href; if(!isLive()) document.body.classList.remove('view-watch-live'); } apply(); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply); else apply();
  new MutationObserver(check).observe(document.body,{childList:true,subtree:true});
  ['pushState','replaceState'].forEach(fn=>{ const orig=history[fn]; history[fn]=function(){ const r=orig.apply(this,arguments); setTimeout(check,60); return r; }; });
  window.addEventListener('popstate',()=>setTimeout(check,60));
})();