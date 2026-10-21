'use strict';
/* Extras v7: línea roja arrastrable, proyectos (borrador/exportado/borrar), cuenta en la nube e imágenes con IA. */
(function () {
  const CFG = window.EDITOR_CONFIG || {}, CLOUD = !!(CFG.supabaseUrl && CFG.supabaseKey && window.supabase);
  let sb = null, USER = null, pushT = 0;
  const ls = (k, d = '') => { try { return localStorage.getItem(k) || d } catch (e) { return d } };
  const ss = (k, v) => { try { localStorage.setItem(k, v) } catch (e) {} };
  const MB = (n) => ((n || 0) / 1e6).toFixed(1) + ' MB';
  const H = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const el = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild };
  const st = document.createElement('style');
  st.textContent = '.mdl{position:fixed;inset:0;background:#000b;z-index:50;display:flex;align-items:center;justify-content:center;padding:12px}.mc{background:var(--p2,#22262d);color:var(--tx,#eee);border-radius:10px;padding:16px;max-width:560px;width:100%;max-height:90vh;overflow:auto}.mc input,.mc textarea,.mc select{width:100%;box-sizing:border-box}.mc img{max-width:100%;border-radius:6px;margin-top:8px}';
  document.head.appendChild(st);
  function modal(html, cls) {
    const m = el(`<div class="mdl ${cls || ''}"><div class="mc">${html}<div style="text-align:right;margin-top:10px"><button class="mx">Cerrar</button></div></div></div>`);
    m.querySelector('.mx').onclick = () => m.remove();
    m.onclick = (e) => { if (e.target === m && !cls) m.remove() };
    document.body.appendChild(m); return m;
  }

  /* ---------- 1) Línea roja arrastrable + atajos ---------- */
  const tl = $('tl'), ph = $('ph'), ruler = $('ruler');
  const tAt = (x) => { const r = tl.getBoundingClientRect(); return clamp((x - r.left + tl.scrollLeft - 90) / S.PX, 0, total()) };
  const go = (t) => { stop(); S.t = t; syncVideos(S.t, false); render(S.t); setTimeout(() => render(S.t), 60); ui() };
  const drag = (ev) => {
    ev.preventDefault(); ev.stopPropagation(); go(tAt(ev.clientX));
    const mv = (e) => go(tAt(e.clientX)), up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up) };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };
  ruler.addEventListener('pointerdown', drag); ph.addEventListener('pointerdown', drag);
  addEventListener('keydown', (e) => {
    const tag = document.activeElement.tagName;
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.ctrlKey || e.metaKey) return;
    if (e.key === ' ' && tag !== 'BUTTON') { e.preventDefault(); $('bPlay').click() }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); go(clamp(S.t + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : .1), 0, total())) }
  });

  /* ---------- 2) Proyectos: borrador / exportado / borrar ---------- */
  const getIdx = async () => (await kvGet('projects')) || [];
  const saveIdx = (a) => kvSet('projects', a);
  async function touchProject(status) {
    const idx = await getIdx(); let p = idx.find((x) => x.id === PID);
    if (!p) { p = { id: PID, name: 'Proyecto ' + (idx.length + 1), status: 'borrador' }; idx.push(p) }
    p.updated = Date.now(); if (status) p.status = status; if (USER) p.owner = USER.id;
    p.size = [...S.files.values()].reduce((n, f) => n + (f.size || 0), 0);
    await saveIdx(idx); return p;
  }
  window.onProjectSaved = () => { touchProject('borrador'); clearTimeout(pushT); pushT = setTimeout(cloudPush, 3000) };
  window.newProject = () => { ss('curProj', 'p' + Date.now().toString(36)); location.reload() };
  async function delProject(id) {
    const r = await kvGet('proj:' + id);
    if (r && r.state) for (const l of r.state.lib) { await kvDel(FK(l.id, id)) }
    await kvDel('proj:' + id); await kvDel('up:' + id);
    await saveIdx((await getIdx()).filter((p) => p.id !== id));
    if (USER) { try {
      const paths = r && r.state ? r.state.lib.map((l) => `${USER.id}/${id}/${l.id}`) : [];
      if (paths.length) await sb.storage.from('media').remove(paths);
      await sb.from('projects').delete().eq('id', id);
    } catch (e) {} }
  }
  window.onExported = async () => {
    const p = await touchProject('exportado'); cloudPush();
    const d = $('dl'); let btn = $('bDelP'); if (!btn) { btn = document.createElement('button'); btn.id = 'bDelP'; d.appendChild(btn) }
    btn.textContent = '🗑 Borrar proyecto (libera ' + MB(p.size) + ')';
    btn.onclick = async () => { if (confirm('¿Borrar este proyecto para liberar espacio?\n\nHazlo solo si ya guardaste el video (Guardar en Fotos / Descargar MP4). Después no podrás volver a editarlo.')) { await delProject(PID); window.newProject() } };
  };
  async function openProjects() {
    const m = modal('<h3>📂 Mis proyectos</h3><div id="pl">Cargando…</div><div class="row" style="margin-top:8px"><button class="pri" id="pn">+ Proyecto nuevo</button></div><small id="pu" style="color:var(--mu)"></small>');
    m.querySelector('#pn').onclick = () => window.newProject();
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then((e) => { m.querySelector('#pu').textContent = 'Espacio usado por el editor en este navegador: ' + MB(e.usage) + ' de ' + MB(e.quota) });
    const idx = (await getIdx()).filter((p) => !CLOUD || !p.owner || (USER && p.owner === USER.id));
    let cloud = [];
    if (USER) { try { const { data } = await sb.from('projects').select('id,name,status,size,updated_at');
      cloud = (data || []).filter((c) => !idx.some((p) => p.id === c.id)).map((c) => ({ id: c.id, name: c.name, status: c.status, size: c.size, updated: Date.parse(c.updated_at), cloudOnly: true })) } catch (e) {} }
    const all = [...idx, ...cloud].sort((a, b) => (b.updated || 0) - (a.updated || 0)), box = m.querySelector('#pl');
    box.innerHTML = all.length ? '' : '<small>Aún no tienes proyectos guardados.</small>';
    all.forEach((p) => {
      const r = el(`<div class="sc"><b>${H(p.name)}</b> ${p.id === PID ? '<small>(abierto)</small>' : ''}<br><small>${p.status === 'exportado' ? '✅ Exportado' : '📝 Borrador'}${p.cloudOnly ? ' · ☁ solo en la nube' : ''} · ${MB(p.size)} · ${new Date(p.updated || Date.now()).toLocaleDateString()}</small><div class="row" style="margin-top:4px"><button class="o">Abrir</button><button class="rn">Renombrar</button><button class="d">🗑 Borrar</button></div></div>`);
      r.querySelector('.o').onclick = async () => { try { if (p.cloudOnly) await pullProject(p.id); ss('curProj', p.id); location.reload() } catch (e) { alert('No se pudo abrir: ' + (e.message || e)) } };
      r.querySelector('.rn').onclick = async () => { const n = prompt('Nombre del proyecto', p.name); if (!n) return; const a = await getIdx(), q = a.find((x) => x.id === p.id); if (q) { q.name = n; await saveIdx(a); cloudPush() } m.remove(); openProjects() };
      r.querySelector('.d').onclick = async () => { if (!confirm(`¿Borrar "${p.name}" y todos sus archivos guardados (${MB(p.size)})? No se puede deshacer.`)) return; await delProject(p.id); if (p.id === PID) window.newProject(); else { m.remove(); openProjects() } };
      box.appendChild(r);
    });
  }
  $('bProj').onclick = openProjects;

  /* ---------- 3) Cuenta y nube (Supabase) ---------- */
  async function cloudPush() {
    if (!USER) return;
    try {
      const r = await kvGet('proj:' + PID); if (!r) return; const p = await touchProject();
      $('saved').textContent = '☁ Guardando en la nube…';
      const up = (await kvGet('up:' + PID)) || [];
      for (const l of r.state.lib) {
        if (up.includes(l.id)) continue; const f = await kvGet(FK(l.id)); if (!f) continue;
        const { error } = await sb.storage.from('media').upload(`${USER.id}/${PID}/${l.id}`, f, { upsert: true, contentType: f.type });
        if (error) throw error; up.push(l.id); await kvSet('up:' + PID, up);
      }
      const { error } = await sb.from('projects').upsert({ id: PID, user_id: USER.id, name: p.name, status: p.status, state: r.state, inputs: r.inputs, size: p.size, updated_at: new Date().toISOString() }, { onConflict: 'user_id,id' });
      if (error) throw error; $('saved').textContent = '☁ Guardado en la nube';
    } catch (e) { $('saved').textContent = '⚠ No se pudo guardar en la nube: ' + (e.message || e) }
  }
  async function pullProject(id) {
    const { data, error } = await sb.from('projects').select('*').eq('id', id).single(); if (error) throw error;
    await kvSet('proj:' + id, { state: data.state, inputs: data.inputs });
    for (const l of data.state.lib) { const { data: b } = await sb.storage.from('media').download(`${USER.id}/${id}/${l.id}`); if (b) await kvSet(FK(l.id, id), new File([b], l.name, { type: b.type })) }
    await kvSet('up:' + id, data.state.lib.map((l) => l.id));
    const idx = await getIdx(); idx.push({ id, name: data.name, status: data.status, size: data.size, updated: Date.parse(data.updated_at), owner: USER.id }); await saveIdx(idx);
  }
  function acct() {
    const a = $('acct'); a.innerHTML = USER ? `<small style="color:var(--mu)">👤 ${H(USER.email)}</small> <button id="bOut">Salir</button>` : '';
    if (USER) $('bOut').onclick = () => sb.auth.signOut();
  }
  function loginUI() {
    if (document.querySelector('.mdl.login')) return;
    const m = modal(`<h2>🎬 Editor de video</h2><p>Inicia sesión para guardar tus proyectos en la nube.</p><label>Correo</label><input id="le" type="email" autocomplete="email"><label>Contraseña (mínimo 6 caracteres)</label><input id="lp" type="password" autocomplete="current-password"><div class="row" style="margin-top:8px"><button class="pri" id="li">Entrar</button><button id="lu">Crear cuenta</button></div><div id="lm" class="warn"></div>`, 'login');
    m.querySelector('.mx').remove(); const say = (t) => { m.querySelector('#lm').textContent = t };
    const run = async (up) => {
      const email = m.querySelector('#le').value.trim(), password = m.querySelector('#lp').value; say('');
      const r = up ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
      if (r.error) return say(r.error.message); if (up && !r.data.session) say('Cuenta creada. Revisa tu correo para confirmarla y luego entra.');
    };
    m.querySelector('#li').onclick = () => run(false); m.querySelector('#lu').onclick = () => run(true);
  }
  (async function initAuth() {
    if (!CLOUD) return;
    try {
      sb = supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
      const { data } = await sb.auth.getSession(); USER = data.session ? data.session.user : null; acct(); if (!USER) loginUI(); else cloudPush();
      sb.auth.onAuthStateChange((_e, s) => { const had = !!USER; USER = s ? s.user : null; acct();
        if (USER && !had) { const l = document.querySelector('.mdl.login'); if (l) l.remove(); cloudPush() } if (!USER && had) loginUI() });
    } catch (e) { USER = null }
  })();

  /* ---------- 4) Generar imágenes con IA (Pollinations + Flux, gratis, directo desde el navegador) ---------- */
  const polUrl = (prompt, W, H, seed) => 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
    '?model=flux&width=' + W + '&height=' + H + '&seed=' + seed + '&nologo=true&enhance=false' +
    (location.hostname && location.hostname !== 'localhost' ? '&referrer=' + encodeURIComponent(location.hostname) : '');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  /* Descarga la imagen como Blob (para poder agregarla al proyecto). Reintenta si Pollinations pide esperar (límite anónimo: 1 petición cada ~15 s). */
  async function polBlob(prompt, W, H, say) {
    let last = 'Pollinations no devolvió una imagen.';
    for (let n = 0; n < 4; n++) {
      const url = polUrl(prompt, W, H, Math.floor(Math.random() * 1e6));
      try {
        const r = await fetch(url);
        if (r.ok) { const b = await r.blob(); if (/^image/.test(b.type)) return { blob: b, url }; last = 'Pollinations no devolvió una imagen.' }
        else if (r.status === 429 || r.status >= 500) { last = 'Pollinations está ocupado (HTTP ' + r.status + ').'; say('Pollinations pide esperar (es gratis y tiene límite). Reintentando… (' + (n + 1) + '/4)'); await wait(8000 + n * 6000); continue }
        else throw new Error('Pollinations respondió ' + r.status + '. Prueba con otra descripción o más tarde.')
      } catch (e) {
        if (/Pollinations respondió/.test(e.message)) throw e;
        /* si el navegador bloquea la lectura (CORS) probamos cargarla como <img> y la dibujamos en un canvas */
        try { const b = await imgToBlob(url, W, H); return { blob: b, url } } catch (e2) { last = 'No se pudo conectar con Pollinations: revisa tu internet.' }
      }
      await wait(1500);
    }
    throw new Error(last + ' Intenta de nuevo en unos segundos.');
  }
  function imgToBlob(url, W, H) {
    return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { try { const c = document.createElement('canvas'); c.width = im.naturalWidth || W; c.height = im.naturalHeight || H; c.getContext('2d').drawImage(im, 0, 0); c.toBlob((b) => b ? res(b) : rej(new Error('canvas')), 'image/jpeg', .95) } catch (e) { rej(e) } };
      im.onerror = () => rej(new Error('img')); im.src = url });
  }
  function openGen() {
    const fmt = $('fmt').value, [W, Hh] = fmt === '16:9' ? [1280, 720] : [720, 1280]; let blob = null, added = false;
    const m = modal(`<h3>🖼 Generar imagen con IA</h3><label>Describe la imagen</label><textarea id="gp" style="height:90px" placeholder="Un muñeco 3D de cabeza blanca y traje negro señalando una pantalla en una oficina moderna"></textarea>
      <small style="display:block;color:var(--mu)">Motor: Pollinations · modelo Flux · gratis y sin clave. Tamaño: ${W}×${Hh}.</small>
      <div class="row" style="margin-top:8px"><button class="pri" id="gg">Generar</button></div><div id="gs" class="warn"></div><div id="gr"></div>`);
    const q = (s) => m.querySelector(s);
    q('#gg').onclick = async () => {
      const p = q('#gp').value.trim(), say = (t) => { q('#gs').textContent = t }; if (!p) return say('Escribe qué imagen quieres.');
      q('#gg').disabled = true; say('Generando con Flux… puede tardar unos segundos.'); q('#gr').innerHTML = ''; added = false;
      try {
        const o = await polBlob(p, W, Hh, say); blob = o.blob;
        const url = URL.createObjectURL(blob), ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        q('#gr').innerHTML = `<img src="${url}" alt="Imagen generada" style="max-width:100%;border-radius:8px"><div class="row" style="margin-top:8px"><button class="pri" id="gu">➕ Agregar al proyecto (5 s)</button><button id="gd">⬇ Descargar imagen</button></div><small style="color:var(--mu)">Si no te gusta, cambia la descripción y pulsa Generar otra vez.</small>`; say('');
        q('#gu').onclick = async () => { if (added) return say('Esta imagen ya está en tu video.'); q('#gu').disabled = true;
          await addFiles([new File([blob], 'ia-' + Date.now() + '.' + ext, { type: blob.type })]); added = true; sched(); say('✅ Agregada al final de tu video (y a tu biblioteca). Puedes generar otra o cerrar esta ventana.'); q('#gu').textContent = '✅ Agregada' };
        q('#gd').onclick = () => { const a = document.createElement('a'); a.href = url; a.download = 'imagen-ia.' + ext; document.body.appendChild(a); a.click(); a.remove() };
      } catch (e) { say(e.message || String(e)) }
      q('#gg').disabled = false;
    };
  }
  $('bGen').onclick = openGen;
})();
