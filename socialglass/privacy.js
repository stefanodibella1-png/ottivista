// dati del titolare nell'informativa (file a parte: la regola di sicurezza blocca gli script scritti dentro la pagina)
fetch("api/health",{cache:"no-store"}).then(function(r){return r.json()}).then(function(j){
  var t=j.titolare||{};
  document.querySelectorAll("[data-t]").forEach(function(e){var v=t[e.getAttribute("data-t")];if(v){e.textContent=v;if(e.hasAttribute("data-mail"))e.href="mailto:"+v;}});
  document.querySelectorAll("[data-opt]").forEach(function(e){if(!t[e.getAttribute("data-opt")])e.hidden=true;});
}).catch(function(){document.querySelectorAll("[data-opt]").forEach(function(e){e.hidden=true;});});
