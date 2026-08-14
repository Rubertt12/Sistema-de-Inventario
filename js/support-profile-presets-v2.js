(() => {
  'use strict';
  if (window.__RRN_SUPPORT_PROFILE_PRESETS_V2__) return;
  window.__RRN_SUPPORT_PROFILE_PRESETS_V2__ = true;

  const PRESETS = [
    ['/img/avatars/robot.svg','Robô'],
    ['/img/avatars/flower.svg','Flor'],
    ['/img/avatars/guitar.svg','Violão'],
    ['/img/avatars/planet.svg','Planeta'],
    ['/img/avatars/cat.svg','Gato'],
    ['/img/avatars/mountain.svg','Paisagem']
  ];

  function ensureStyle(){
    if(document.getElementById('rrnSupportProfilePresetsStyle')) return;
    const s=document.createElement('style');
    s.id='rrnSupportProfilePresetsStyle';
    s.textContent=`.rrn-support-preset-wrap{margin-top:8px;padding:12px;border:1px solid var(--rrn-border,rgba(22,58,77,.12));border-radius:12px}.rrn-support-preset-wrap strong,.rrn-support-preset-wrap small{display:block}.rrn-support-preset-wrap strong{font-size:.76rem;margin-bottom:3px}.rrn-support-preset-wrap small{font-size:.64rem;color:var(--rrn-muted,#66757f);margin-bottom:10px}.rrn-support-preset-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.rrn-support-preset{aspect-ratio:1;border:2px solid transparent;border-radius:12px;padding:3px;background:transparent;cursor:pointer}.rrn-support-preset:hover,.rrn-support-preset.active{border-color:var(--rrn-secondary,#2f7d78)}.rrn-support-preset img{width:100%;height:100%;object-fit:cover;border-radius:8px}@media(max-width:560px){.rrn-support-preset-grid{grid-template-columns:repeat(3,1fr)}}`;
    document.head.appendChild(s);
  }

  async function presetToPngFile(src,label){
    const response=await fetch(src,{cache:'force-cache'});
    if(!response.ok) throw new Error('Não foi possível carregar o avatar.');
    const svgText=await response.text();
    const blob=new Blob([svgText],{type:'image/svg+xml'});
    const url=URL.createObjectURL(blob);
    try{
      const img=new Image();
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
      const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,512,512);
      const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',.92));
      return new File([png],`${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'avatar'}.png`,{type:'image/png'});
    } finally { URL.revokeObjectURL(url); }
  }

  async function choose(btn){
    const input=document.getElementById('rrnProfileFile');
    const preview=document.getElementById('rrnProfilePreview');
    if(!input||!preview) return;
    btn.disabled=true;
    try{
      const file=await presetToPngFile(btn.dataset.src,btn.dataset.label);
      const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
      document.querySelectorAll('.rrn-support-preset').forEach(x=>x.classList.toggle('active',x===btn));
    }catch(error){alert(error.message||'Não foi possível selecionar este avatar.');}
    finally{btn.disabled=false;}
  }

  function install(){
    ensureStyle();
    const form=document.getElementById('rrnProfileForm');
    if(!form||document.getElementById('rrnSupportPresetWrap')) return;
    const actions=form.querySelector('.rrn-profile-actions');
    const wrap=document.createElement('div');wrap.id='rrnSupportPresetWrap';wrap.className='rrn-support-preset-wrap';
    wrap.innerHTML=`<strong>Imagens prontas</strong><small>Escolha uma imagem ou envie a sua.</small><div class="rrn-support-preset-grid">${PRESETS.map(([src,label])=>`<button type="button" class="rrn-support-preset" data-src="${src}" data-label="${label}" title="${label}"><img src="${src}" alt="${label}"></button>`).join('')}</div>`;
    form.insertBefore(wrap,actions);
    wrap.querySelectorAll('.rrn-support-preset').forEach(btn=>btn.addEventListener('click',()=>choose(btn)));
  }

  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
