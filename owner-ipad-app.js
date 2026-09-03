(async function(){
  const U=DPRO_UI,app=document.getElementById('app');
  document.getElementById('nav').innerHTML=U.nav();
  U.setModeBanner('物件・Zone・Trapを現場で確認・編集');
  if(U.demo){renderDemo();return}
  await U.protect(['owner','staff','dpro_admin'],async()=>loadLive());

  function renderDemo(){
    const s=DproDemo.load(),p=s.properties.find(x=>x.id==='p-shop'),tr=s.traps.filter(t=>t.propertyId===p.id);
    app.innerHTML=`<section class="hero"><span class="badge">定期防除</span><h1>${U.esc(p.name)}</h1><p>${U.esc(p.address)}</p></section>
      <section class="card" style="margin-top:18px"><h2>図面 / PIN DEMO</h2><p>Productionでは図面画像を保存し、Trap PINをドラッグして位置を保存できます。</p></section>
      <section class="grid grid-3" style="margin-top:18px">${tr.map(t=>{const z=s.zones.find(z=>z.id===t.zoneId),caps=s.captures.filter(c=>c.trapId===t.id);return `<div class="card"><h2>${U.esc(t.label)}</h2><p>${U.esc(z.name)} / ${U.esc(t.type)}</p><div class="metric">${caps.reduce((n,c)=>n+c.count,0)}</div><div class="muted">捕獲数</div></div>`}).join('')}</section>`;
  }

  async function loadLive(){
    try{
      const j=await U.api('/api/pest/v1/properties'),ps=j.properties||[];
      document.getElementById('nav').innerHTML=U.nav();
      app.innerHTML=`<section class="hero"><span class="badge">FIELD MAP</span><h1>物件・地点</h1>
        <p>図面とTrap PINを同じ画面で管理します。PIN位置は端末サイズに依存しない比率座標で保存されます。</p>
        <div class="field"><select id="property">${ps.map(p=>`<option value="${p.id}">${U.esc(p.name)}</option>`).join('')}</select></div>
      </section><section id="map" style="margin-top:18px"></section>`;
      if(!ps.length){document.getElementById('map').innerHTML='<div class="card">表示できる物件がありません。</div>';return}
      document.getElementById('property').onchange=()=>show(document.getElementById('property').value);
      show(ps[0].id);
    }catch(e){
      app.innerHTML=`<section class="card"><h2>読み込めませんでした</h2><p>${U.esc(U.errText(e))}</p></section>`;
    }
  }

  async function show(id){
    const el=document.getElementById('map');el.innerHTML='<div class="card">読み込み中…</div>';
    try{
      const j=await U.api(`/api/pest/v1/properties/${id}/field-map`),zones=j.zones||[],traps=j.traps||[];
      el.innerHTML=`
        <section class="hero">
          <h2>${U.esc(j.property.name)}</h2><p>${U.esc(j.property.address||'')}</p>
          <div class="row" style="margin-top:12px;align-items:flex-end;flex-wrap:wrap">
            <label class="field" style="min-width:260px;flex:1"><span>図面画像（JPEG / PNG / WebP、10MB以下）</span><input type="file" id="floor-file" accept="image/jpeg,image/png,image/webp"></label>
            <button class="btn" id="floor-upload">図面を保存 / 差し替え</button>
          </div>
          <p class="muted" id="map-msg"></p>
        </section>

        <section class="card" style="margin-top:18px">
          <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap">
            <div><h2 style="margin-bottom:4px">図面 / PIN</h2><div class="muted">PINを指やマウスでドラッグすると、離した位置を本番DBへ保存します。</div></div>
            <div class="badge">${traps.length} Trap</div>
          </div>
          <div id="pin-board" style="position:relative;width:100%;aspect-ratio:4/3;margin-top:16px;border:1px solid #cbd8cf;border-radius:14px;overflow:hidden;background-color:#f7faf7;background-image:linear-gradient(#e7efe9 1px,transparent 1px),linear-gradient(90deg,#e7efe9 1px,transparent 1px);background-size:32px 32px;user-select:none">
            ${j.floorplan_signed_url?`<img id="floor-img" src="${U.esc(j.floorplan_signed_url)}" alt="物件図面" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none">`:`
              <div style="position:absolute;inset:0;display:grid;place-items:center;color:#6d7b71;pointer-events:none"><div style="text-align:center"><b>図面未登録</b><br><span class="muted">上の「図面を保存 / 差し替え」から登録できます</span></div></div>`}
            ${traps.map(t=>pinHtml(t,zones)).join('')}
          </div>
          <div class="muted" style="margin-top:10px">PIN座標は0〜1の正規化座標で保存されるため、PC / iPad / スマホで同じ地点を再現します。</div>
        </section>

        <section class="grid grid-2" style="margin-top:18px">
          <div class="card">
            <h2>Zone追加</h2>
            <div class="field"><label>Zone名</label><input id="zone-name" placeholder="例：厨房"></div>
            <div class="field"><label>安定コード（任意）</label><input id="zone-code" placeholder="例：KITCHEN-01"></div>
            <button class="btn secondary" id="zone-add">Zoneを追加</button>
          </div>
          <div class="card">
            <h2>Trap / PIN追加</h2>
            <div class="field"><label>Zone</label><select id="trap-zone">${zones.map(z=>`<option value="${z.id}">${U.esc(z.name)} / ${U.esc(z.stable_code||'')}</option>`).join('')}</select></div>
            <div class="field"><label>Trap名</label><input id="trap-label" placeholder="例：T-02"></div>
            <div class="field"><label>種類</label><input id="trap-type" placeholder="例：粘着トラップ"></div>
            <button class="btn secondary" id="trap-add" ${zones.length?'':'disabled'}>中央にPINを追加</button>
          </div>
        </section>

        <section class="grid grid-3" style="margin-top:18px">
          ${traps.map(t=>{const z=zones.find(x=>x.id===t.zone_id);return `<div class="card"><span class="badge">${U.esc(z?.name||'Zone未設定')}</span><h2>${U.esc(t.label)}</h2><p>${U.esc(t.type||'Trap')}</p><div class="metric">${Number(t.capture_total||0)}</div><div class="muted">累計捕獲数</div><div class="muted">PIN: ${pct(t.pin_x)} / ${pct(t.pin_y)}</div></div>`}).join('')||'<div class="card">Trap地点はまだありません。</div>'}
        </section>`;

      const img=document.getElementById('floor-img'),board=document.getElementById('pin-board');
      if(img){img.onload=()=>{if(img.naturalWidth&&img.naturalHeight)board.style.aspectRatio=`${img.naturalWidth}/${img.naturalHeight}`}}
      bindPinDrag(id);
      document.getElementById('floor-upload').onclick=()=>uploadFloor(id);
      document.getElementById('zone-add').onclick=()=>addZone(id);
      document.getElementById('trap-add').onclick=()=>addTrap(id);
    }catch(e){
      el.innerHTML=`<div class="card"><p>${U.esc(U.errText(e))}</p></div>`;
    }
  }

  function pinHtml(t,zones){
    const x=Number.isFinite(Number(t.pin_x))?Number(t.pin_x):0.5,y=Number.isFinite(Number(t.pin_y))?Number(t.pin_y):0.5,z=zones.find(v=>v.id===t.zone_id);
    return `<button type="button" class="map-pin" data-id="${t.id}" title="${U.esc(t.label)} / ${U.esc(z?.name||'')}"
      style="position:absolute;left:${x*100}%;top:${y*100}%;transform:translate(-50%,-50%);z-index:4;border:0;background:#0d6b3d;color:white;border-radius:999px;min-width:44px;height:44px;padding:0 10px;font-weight:800;box-shadow:0 3px 12px rgba(0,0,0,.22);cursor:grab;touch-action:none">
      ${U.esc(t.label)}<span style="display:block;font-size:10px;line-height:10px">${Number(t.capture_total||0)}</span>
    </button>`;
  }

  function pct(v){return Number.isFinite(Number(v))?`${Math.round(Number(v)*100)}%`:'未配置'}

  function bindPinDrag(propertyId){
    const board=document.getElementById('pin-board'),msg=document.getElementById('map-msg');
    document.querySelectorAll('.map-pin').forEach(pin=>{
      let active=false,last=null;
      const move=e=>{
        if(!active)return;
        const r=board.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
        last={x,y};pin.style.left=`${x*100}%`;pin.style.top=`${y*100}%`;
      };
      pin.onpointerdown=e=>{active=true;last=null;pin.setPointerCapture?.(e.pointerId);pin.style.cursor='grabbing';e.preventDefault()};
      pin.onpointermove=move;
      pin.onpointerup=async e=>{
        if(!active)return;active=false;pin.style.cursor='grab';pin.releasePointerCapture?.(e.pointerId);
        if(!last)return;
        msg.textContent='PIN位置を保存中…';
        try{
          await U.api(`/api/pest/v1/properties/${propertyId}/traps/${pin.dataset.id}/pin`,{method:'PATCH',body:JSON.stringify({pin_x:last.x,pin_y:last.y})});
          msg.textContent=`PIN位置を保存しました（${Math.round(last.x*100)}% / ${Math.round(last.y*100)}%）`;
        }catch(err){msg.textContent='PIN位置を保存できません: '+U.errText(err);show(propertyId)}
      };
      pin.onpointercancel=()=>{active=false;pin.style.cursor='grab'};
    });
  }

  async function uploadFloor(id){
    const input=document.getElementById('floor-file'),msg=document.getElementById('map-msg'),file=input.files?.[0];
    if(!file){msg.textContent='図面画像を選択してください';return}
    const fd=new FormData();fd.set('file',file);msg.textContent='図面を保存中…';
    try{await U.api(`/api/pest/v1/properties/${id}/floorplan`,{method:'POST',body:fd});msg.textContent='図面を保存しました';show(id)}
    catch(e){msg.textContent='図面を保存できません: '+U.errText(e)}
  }

  async function addZone(id){
    const msg=document.getElementById('map-msg'),name=document.getElementById('zone-name').value,stable_code=document.getElementById('zone-code').value;
    if(!name.trim()){msg.textContent='Zone名を入力してください';return}
    msg.textContent='Zoneを追加中…';
    try{await U.api(`/api/pest/v1/properties/${id}/zones`,{method:'POST',body:JSON.stringify({name,stable_code})});msg.textContent='Zoneを追加しました';show(id)}
    catch(e){msg.textContent='Zoneを追加できません: '+U.errText(e)}
  }

  async function addTrap(id){
    const msg=document.getElementById('map-msg'),zone_id=document.getElementById('trap-zone').value,label=document.getElementById('trap-label').value,type=document.getElementById('trap-type').value;
    if(!zone_id||!label.trim()){msg.textContent='ZoneとTrap名を入力してください';return}
    msg.textContent='Trap/PINを追加中…';
    try{await U.api(`/api/pest/v1/properties/${id}/traps`,{method:'POST',body:JSON.stringify({zone_id,label,type,pin_x:.5,pin_y:.5})});msg.textContent='Trap/PINを追加しました';show(id)}
    catch(e){msg.textContent='Trap/PINを追加できません: '+U.errText(e)}
  }
})();
