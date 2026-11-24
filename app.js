/* MV MODS — site completo em um arquivo só */
const SUPABASE_URL = "https://c--f82a93d6-e727-44a0-9668-016ddfcb53de-prod.lovable.cloud";
const SUPABASE_KEY = "sb_publishable_WAZS0KKE_4vIrJVJRVvVEA_o_e3F5Hn";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CATS = [{ v: "jogo", l: "Jogos", i: "🎮" }, { v: "skin", l: "Skins", i: "🎨" }, { v: "xite", l: "Xite", i: "🔥" }];
const catLabel = (v) => ({ jogo: "Jogo", skin: "Skin", xite: "Xite" }[v] || v);
const COLORS = {
  roxo: ["#a855f7", "#3b82f6"], azul: ["#3b82f6", "#22d3ee"], verde: ["#22c55e", "#14b8a6"],
  vermelho: ["#ef4444", "#f97316"], rosa: ["#ec4899", "#a855f7"], ciano: ["#06b6d4", "#8b5cf6"],
  dourado: ["#f59e0b", "#ef4444"], laranja: ["#f97316", "#facc15"], mono: ["#e5e7eb", "#6b7280"],
};
const colorsOf = (v) => (String(v || "").includes("|") ? v.split("|") : COLORS[v] || COLORS.roxo);
const slugify = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const cmpV = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
const fdate = (d) => new Date(d).toLocaleDateString("pt-BR");

function toast(msg, bad) {
  const d = document.createElement("div"); d.textContent = msg; if (bad) d.className = "bad";
  $("#toast").appendChild(d); setTimeout(() => d.remove(), 3500);
}

/* ---------- estado ---------- */
const S = { user: null, profile: null, isAdmin: false, settings: null, ready: false };
let renderToken = 0;

async function loadUser(session) {
  S.user = session?.user ?? null; S.profile = null; S.isAdmin = false;
  if (S.user) {
    const [p, r] = await Promise.all([
      sb.from("profiles").select("*").eq("id", S.user.id).maybeSingle(),
      sb.from("user_roles").select("role").eq("user_id", S.user.id),
    ]);
    S.profile = p.data; S.isAdmin = !!r.data?.some((x) => x.role === "admin");
  }
}
async function loadSettings() {
  const { data } = await sb.from("site_settings").select("*").eq("id", 1).maybeSingle();
  S.settings = data; applySettings();
}
function applySettings() {
  const s = S.settings; if (!s) return;
  const c = colorsOf(s.primary_color), r = document.documentElement.style;
  r.setProperty("--pri", c[0]); r.setProperty("--sec", c[1]);
  r.setProperty("--r", s.button_style === "reto" ? "3px" : "14px");
  document.body.classList.toggle("light", s.theme === "claro");
  document.body.classList.toggle("amoled", s.theme === "preto");
  document.body.style.backgroundImage = s.background_url ? `linear-gradient(color-mix(in srgb,var(--bg) 85%,transparent),var(--bg)),url(${s.background_url})` : "";
}

/* ---------- peças de tela ---------- */
const logo = `<a href="#/" class="logo"><b>MV</b><span>MV MODS</span></a>`;
function header() {
  return `<header><div class="wrap">${logo}<nav>
    ${S.isAdmin ? `<a class="btn sm" href="#/admin">⚙ ADM</a>` : ""}
    ${S.user ? `<a class="btn pri sm" href="#/conta">👤 ${esc(S.profile?.username || "Conta")}</a>`
      : `<a class="btn sm" href="#/auth/entrar">Entrar</a><a class="btn pri sm" href="#/auth/cadastro">Cadastrar</a>`}
  </nav></div></header>`;
}
const footer = () => `<footer>${logo.replace('class="logo"', 'class="logo" style="justify-content:center"')}<p>Catálogo de jogos, skins e conteúdos autorizados.</p><p>© ${new Date().getFullYear()} MV MODS</p></footer>`;
const page = (inner) => `${header()}${inner}${footer()}`;
const cardHtml = (c, compact) => `<a class="card" href="#/c/${esc(c.slug)}"><div class="im">${c.cover_url ? `<img loading="lazy" src="${esc(c.cover_url)}" alt="">` : "MV"}
  <span class="badge l">${catLabel(c.category)}</span>${c.status === "atualizado" ? `<span class="badge ok r">Atualizado</span>` : ""}</div>
  <div class="inf"><h3>${esc(c.name)}</h3><small>${catLabel(c.category)} · v${esc(c.current_version)}</small></div></a>`;

function resizeImage(file, max, q) {
  return new Promise((res) => {
    if (!file.type.startsWith("image/") || /gif|svg/.test(file.type)) return res(file);
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => { URL.revokeObjectURL(u); res(b ? new File([b], "foto.jpg", { type: "image/jpeg" }) : file); }, "image/jpeg", q);
    };
    img.onerror = () => { URL.revokeObjectURL(u); res(file); };
    img.src = u;
  });
}
const toDataUrl = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
async function uploadImage(file, folder) {
  const big = await resizeImage(file, 1600, 0.85);
  const ext = big.type === "image/jpeg" ? "jpg" : (big.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, big, { contentType: big.type });
  if (!error) return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
  if (/row-level|policy|not authorized|permission|jwt/i.test(error.message))
    throw new Error("abra o painel pelo botão ADM do perfil");
  /* se a pasta de fotos não existir, guarda a foto direto no banco (menor) */
  const small = await resizeImage(file, 900, 0.7);
  if (small.size > 600000) throw new Error(error.message);
  return toDataUrl(small);
}
/* abre a galeria; o input fica na tela até escolher (senão o Android perde a foto) */
function pickImage(folder, onPick) {
  const i = document.createElement("input"); i.type = "file"; i.accept = "image/*";
  i.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  document.body.appendChild(i);
  i.onchange = async () => {
    const f = i.files[0]; i.remove(); if (!f) return;
    toast("Enviando foto...");
    try { onPick(await uploadImage(f, folder)); toast("Foto enviada ✅"); } catch (e) { toast("Falha no envio: " + e.message, true); }
  };
  i.oncancel = () => i.remove();
  i.click();
}
const pickerHtml = (url, label, onclick, wide) => `<div class="pick ${wide ? "wide" : ""}" onclick="${onclick}">${url ? `<img src="${esc(url)}" alt="">` : ""}<span>${url ? "Trocar foto" : "📷 " + label}</span></div>`;

/* ---------- PÁGINA INICIAL ---------- */
const H = { list: [], q: "", cat: null };
async function pHome() {
  const { data } = await sb.from("contents").select("*").eq("published", true).order("created_at", { ascending: false });
  H.list = data || []; H.q = ""; H.cat = null;
  const s = S.settings || {};
  const feat = H.list.find((c) => c.featured);
  const updates = [...H.list].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 4);
  return page(`
  <section class="hero">${s.hero_banner_url ? `<img class="bg" src="${esc(s.hero_banner_url)}" alt="">` : ""}
    <span class="pill">🎮 CATÁLOGO OFICIAL</span><h1><span class="neon">${esc(s.hero_title || "SEU CATÁLOGO GAMER")}</span></h1>
    <p>${esc(s.hero_subtitle || "Encontre jogos, skins e conteúdos.")}</p>
    <div class="search"><span>🔍</span><input id="q" placeholder="Pesquisar jogos, skins, xite..." oninput="H.q=this.value;drawHome()"></div>
  </section>
  <main class="wrap">
    <h2 class="t">CATEGORIAS</h2>
    <div class="cats">${CATS.map((c) => `<button class="cat" id="cat-${c.v}" onclick="setCat('${c.v}')"><i>${c.i}</i>${c.l}</button>`).join("")}</div>
    <div id="featBox">${feat ? `<h2 class="t">EM DESTAQUE</h2><div class="feat">${feat.banner_url || feat.cover_url ? `<img src="${esc(feat.banner_url || feat.cover_url)}" alt="">` : ""}
      <div class="in"><span class="badge pri">DESTAQUE</span><h3>${esc(feat.featured_title || feat.name)}</h3>
      <p class="muted">${esc(feat.featured_description || `Versão ${feat.current_version} · ${feat.status === "atualizado" ? "Atualizado" : "Antigo"}`)}</p>
      <a class="btn pri" href="#/c/${esc(feat.slug)}">Ver conteúdo</a></div></div>` : ""}</div>
    <h2 class="t">ÚLTIMOS CONTEÚDOS</h2><div id="grid"></div>
    <div id="updBox">${updates.length ? `<h2 class="t">ATUALIZAÇÕES RECENTES</h2><div class="list">${updates.map((c) => `<a href="#/c/${esc(c.slug)}"><b>${esc(c.name)}</b><span class="muted">v${esc(c.current_version)} · ${fdate(c.updated_at)}</span></a>`).join("")}</div>` : ""}</div>
  </main>`);
}
function setCat(v) { H.cat = H.cat === v ? null : v; drawHome(); }
function drawHome() {
  if (!$("#grid")) return;
  const s = S.settings || {}, compact = s.card_size === "compacto";
  let list = H.list.filter((c) => (!H.cat || c.category === H.cat) && c.name.toLowerCase().includes(H.q.toLowerCase()));
  if (s.sort_order === "destaques") list = [...list].sort((a, b) => Number(b.featured) - Number(a.featured));
  $("#grid").innerHTML = list.length ? `<div class="grid ${compact ? "compact" : ""}">${list.map((c) => cardHtml(c, compact)).join("")}</div>` : `<p class="muted">Nenhum conteúdo encontrado.</p>`;
  CATS.forEach((c) => $("#cat-" + c.v)?.classList.toggle("on", H.cat === c.v));
  const filtering = H.q || H.cat;
  $("#featBox")?.classList.toggle("hide", !!filtering); $("#updBox")?.classList.toggle("hide", !!filtering);
}

/* ---------- DETALHES ---------- */
const D = { c: null, versions: [], sel: null, fav: false };
async function pDetail(slug) {
  const { data: c } = await sb.from("contents").select("*").eq("slug", slug).maybeSingle();
  if (!c) return page(`<p class="wrap" style="padding:40px 0;text-align:center">Conteúdo não encontrado. <a href="#/" style="color:var(--pri)">Voltar</a></p>`);
  const { data: v } = await sb.from("versions").select("*").eq("content_id", c.id).eq("archived", false);
  D.c = c; D.versions = (v || []).sort((a, b) => cmpV(a.version, b.version)); D.sel = null;
  D.fav = S.user ? !!(await sb.from("favorites").select("content_id").eq("content_id", c.id).eq("user_id", S.user.id).maybeSingle()).data : false;
  return page(`<div class="banner">${c.banner_url || c.cover_url ? `<img src="${esc(c.banner_url || c.cover_url)}" alt="">` : ""}</div>
  <main class="wrap" style="max-width:860px">
    <div class="dhead">${c.cover_url ? `<img src="${esc(c.cover_url)}" alt="">` : ""}<div><h1>${esc(c.name)}</h1>
      <span class="badge pri">${catLabel(c.category)}</span> <span class="badge ${c.status === "atualizado" ? "ok" : ""}">${c.status === "atualizado" ? "Atualizado" : "Antigo"}</span></div></div>
    <p class="muted" style="white-space:pre-line;font-size:17px;margin-top:20px">${esc(c.description)}</p>
    ${c.gallery?.length ? `<div class="gal">${c.gallery.map((g) => `<img src="${esc(g)}" alt="">`).join("")}</div>` : ""}
    <div id="verBox"></div>
    <div style="margin-top:24px;display:flex;gap:10px;flex-wrap:wrap" id="actBox"></div>
    <p class="muted" style="font-size:13px;margin-top:16px">Publicado em ${fdate(c.created_at)}. Apenas conteúdos próprios, autorizados e seguros.</p>
  </main>`);
}
function curVersion() { return D.versions.find((v) => v.version === D.sel) || D.versions.find((v) => v.is_current) || D.versions.at(-1); }
function drawVersions() {
  const cur = curVersion(); if (!$("#verBox")) return;
  $("#verBox").innerHTML = D.versions.length ? `<h2 class="t">VERSÕES DISPONÍVEIS</h2><div class="vers">${D.versions.map((v) =>
    `<button class="btn ${cur?.id === v.id ? "on" : ""}" onclick="D.sel='${esc(v.version)}';drawVersions()">v${esc(v.version)}${v.is_current ? " ★" : ""}</button>`).join("")}</div>
    ${cur ? `<div class="box"><b>O QUE TEM NA VERSÃO ${esc(cur.version)}</b>${cur.description ? `<p class="muted">${esc(cur.description)}</p>` : ""}
    <ul>${(cur.features || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>` : ""}` : "";
  $("#actBox").innerHTML = S.user ? `<button class="btn pri" onclick="doDownload()">⬇ Baixar v${esc(cur?.version || "")}</button>
    <button class="btn" onclick="toggleFav()">${D.fav ? "💜 Favoritado" : "🤍 Favoritar"}</button>`
    : `<a class="btn pri" href="#/auth/entrar">🔒 Entrar para acessar</a>`;
}
async function doDownload() {
  const cur = curVersion(); if (!cur || !S.user) return;
  if (S.profile?.blocked) return toast("Sua conta está bloqueada.", true);
  const { data } = await sb.from("downloads").select("url").eq("version_id", cur.id).maybeSingle();
  if (!data?.url) return toast("Download indisponível para esta versão.", true);
  await sb.from("download_history").insert({ user_id: S.user.id, content_id: D.c.id, version: cur.version });
  window.open(data.url, "_blank", "noopener");
}
async function toggleFav() {
  if (D.fav) await sb.from("favorites").delete().eq("content_id", D.c.id).eq("user_id", S.user.id);
  else await sb.from("favorites").insert({ user_id: S.user.id, content_id: D.c.id });
  D.fav = !D.fav; drawVersions();
}

/* ---------- LOGIN / CADASTRO ---------- */
function pAuth(modo) {
  modo = ["entrar", "cadastro", "recuperar"].includes(modo) ? modo : "entrar";
  const t = { entrar: "ENTRAR", cadastro: "CRIAR CONTA", recuperar: "RECUPERAR SENHA" }[modo];
  return `<div class="center"><div class="auth"><div style="display:flex;justify-content:center">${logo}</div>
    <h1 style="text-align:center;font-size:20px;margin:16px 0 0">${t}</h1>
    <form id="authForm" onsubmit="return submitAuth(event,'${modo}')">
      ${modo === "cadastro" ? `<label class="f">NOME DE USUÁRIO</label><input id="a_user" required>` : ""}
      <label class="f">E-MAIL</label><input id="a_email" type="email" required placeholder="Digite seu e-mail">
      ${modo !== "recuperar" ? `<label class="f">SENHA</label><input id="a_pass" type="password" required placeholder="Digite sua senha">` : ""}
      ${modo === "cadastro" ? `<label class="f">CONFIRMAR SENHA</label><input id="a_conf" type="password" required>` : ""}
      <button class="btn pri block" style="margin-top:18px" id="a_btn">${{ entrar: "Entrar", cadastro: "Cadastrar", recuperar: "Enviar link" }[modo]}</button>
    </form><p id="a_msg" style="text-align:center;color:var(--ok)"></p>
    <p style="text-align:center;font-size:14px" class="muted">
      ${modo !== "entrar" ? `<a href="#/auth/entrar">Já tem conta? Entrar</a><br>` : ""}
      ${modo !== "cadastro" ? `<a href="#/auth/cadastro">Não tem conta? Cadastre-se</a><br>` : ""}
      ${modo === "entrar" ? `<a href="#/auth/recuperar">Esqueci minha senha</a>` : ""}</p></div></div>`;
}
async function submitAuth(e, modo) {
  e.preventDefault(); const btn = $("#a_btn"); btn.disabled = true;
  const v = (id) => $("#" + id)?.value.trim(); const email = v("a_email"), pass = $("#a_pass")?.value;
  const back = location.origin + location.pathname;
  try {
    if (modo === "entrar") {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw new Error("E-mail ou senha incorretos.");
      toast("Bem-vindo!"); location.hash = "#/";
    } else if (modo === "cadastro") {
      if (v("a_user").length < 3) throw new Error("Nome de usuário muito curto.");
      if (pass.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      if (pass !== $("#a_conf").value) throw new Error("As senhas não coincidem.");
      const { data: ex } = await sb.rpc("email_exists", { _email: email });
      if (ex) throw new Error("Este e-mail já está cadastrado.");
      const { data: su, error } = await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: back, data: { username: v("a_user") } } });
      if (error) throw error;
      let ok = !!su.session;
      if (!ok) ok = !(await sb.auth.signInWithPassword({ email, password: pass })).error; /* sem verificar e-mail: já entra direto */
      if (ok) { toast("Conta criada! Bem-vindo!"); location.hash = "#/"; }
      else { $("#authForm").classList.add("hide"); $("#a_msg").textContent = "Conta criada! Agora é só entrar."; }
    } else {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: back });
      if (error) throw error;
      $("#authForm").classList.add("hide"); $("#a_msg").textContent = "Enviamos um link de recuperação para o seu e-mail.";
    }
  } catch (err) { toast(err.message, true); btn.disabled = false; }
  return false;
}
function pReset() {
  return `<div class="center"><div class="auth"><h1 style="text-align:center;font-size:20px">NOVA SENHA</h1>
    <label class="f">NOVA SENHA</label><input id="n_pass" type="password">
    <button class="btn pri block" style="margin-top:18px" onclick="saveNewPass()">Salvar senha</button></div></div>`;
}
async function saveNewPass() {
  const p = $("#n_pass").value; if (p.length < 6) return toast("A senha precisa ter pelo menos 6 caracteres.", true);
  const { error } = await sb.auth.updateUser({ password: p });
  if (error) return toast(error.message, true);
  toast("Senha alterada!"); location.hash = "#/";
}

/* ---------- MINHA CONTA ---------- */
async function pConta() {
  if (!S.user) return page(`<p class="wrap" style="padding:40px 0;text-align:center">Você precisa <a href="#/auth/entrar" style="color:var(--pri)">entrar</a>.</p>`);
  const { data: h } = await sb.from("download_history").select("*, contents(name, slug)").eq("user_id", S.user.id).order("created_at", { ascending: false });
  const p = S.profile || {};
  return page(`<main class="wrap" style="max-width:640px;padding-top:24px">
    <div class="box row" style="margin:0"><div style="flex:none;width:96px">${pickerHtml(p.avatar_url, "Foto", "changeAvatar()")}</div>
      <div style="min-width:0"><h1 style="margin:0">${esc(p.username)}</h1><div class="muted">${esc(S.user.email)}</div>
      <small class="muted">Membro desde ${fdate(S.user.created_at)}</small>${p.blocked ? `<div style="color:var(--bad)">Conta bloqueada pelo ADM</div>` : ""}</div></div>
    ${S.isAdmin ? `<a class="btn pri block" href="#/admin" style="margin-top:16px;padding:16px;font-size:16px">⚙ ABRIR PAINEL ADM</a>`
      : `<button class="btn pri block" style="margin-top:16px;padding:16px;font-size:16px" onclick="$('#admPass').classList.toggle('hide');$('#admPw').focus()">⚙ ADM</button>
         <div id="admPass" class="box hide"><label class="f" style="margin-top:0">SENHA DO ADM</label>
         <input id="admPw" type="password" placeholder="Digite a senha" onkeydown="if(event.key==='Enter')claimAdmin()">
         <p><button class="btn pri sm" onclick="claimAdmin()">Abrir painel</button></p></div>`}
    <h2 class="t">HISTÓRICO DE DOWNLOADS</h2>
    <div class="list">${h?.length ? h.map((x) => `<a href="#/c/${esc(x.contents?.slug || "")}"><b>${esc(x.contents?.name)} v${esc(x.version)}</b><span class="muted">${fdate(x.created_at)}</span></a>`).join("") : `<div class="muted">Nenhum download ainda.</div>`}</div>
    <p><button class="btn" onclick="logout()">Sair</button></p></main>`);
}
async function claimAdmin() {
  const pw = $("#admPw").value; if (!pw) return;
  const { data, error } = await sb.rpc("claim_admin", { _pass: pw });
  if (error) return toast(/bloqueado/.test(error.message) ? "Muitas tentativas erradas. Tente de novo mais tarde." : /claim_admin|function|schema cache/.test(error.message) ? "Falta rodar o banco.sql de novo no Supabase." : "Erro: " + error.message, true);
  if (!data) { $("#admPw").value = ""; return toast("Senha incorreta", true); }
  await loadUser({ user: S.user }); toast("Painel ADM liberado ✅"); location.hash = "#/admin";
}
async function releaseAdmin() {
  if (!confirm("Sair do modo ADM? Para voltar vai precisar da senha de novo.")) return;
  await sb.rpc("release_admin"); await loadUser({ user: S.user }); location.hash = "#/conta";
}
function changeAvatar() {
  pickImage("avatars", async (url) => { await sb.from("profiles").update({ avatar_url: url }).eq("id", S.user.id); await loadUser({ user: S.user }); render(); });
}
async function logout() { await sb.auth.signOut(); location.hash = "#/"; }

/* ---------- PAINEL ADM ---------- */
const A = { tab: "cards", edit: null, list: [] };
const emptyDraft = () => ({ name: "", category: "jogo", description: "", cover_url: null, banner_url: null, gallery: [], current_version: "1.0", status: "atualizado", published: true, featured: false, featured_title: "", featured_description: "" });

async function pAdmin() {
  if (!S.user) return page(`<p class="wrap" style="padding:40px 0;text-align:center">Entre na sua conta primeiro: <a href="#/auth/entrar" style="color:var(--pri)">entrar</a>.</p>`);
  if (!S.isAdmin) return page(`<p class="wrap" style="padding:40px 0;text-align:center">Para abrir o painel, vá no seu <a href="#/conta" style="color:var(--pri)">perfil</a> e toque no botão ADM.</p>`);
  A.edit = null; A.tab = "cards";
  return page(`<main class="wrap" style="max-width:760px;padding-top:20px"><div id="admBox"></div></main>`);
}
async function admDraw() {
  const box = $("#admBox"); if (!box) return;
  if (A.edit) return admEditor();
  const tabs = `<div class="tabs">${[["cards", "📦 Cards"], ["users", "👥 Usuários"], ["visual", "🎨 Visual"]].map(([k, l]) => `<button class="btn ${A.tab === k ? "on" : ""}" onclick="A.tab='${k}';admDraw()">${l}</button>`).join("")}<button class="btn sm bad" onclick="releaseAdmin()" style="margin-left:auto;flex:none">Sair do ADM</button></div>`;
  box.innerHTML = `<h1 style="margin:0">Painel ADM</h1>${tabs}<p class="muted">Carregando...</p>`;
  let body = "";
  if (A.tab === "cards") {
    const { data } = await sb.from("contents").select("*").order("created_at", { ascending: false });
    A.list = data || [];
    body = `<button class="btn pri" onclick="admNew()">+ Novo card</button><div style="margin-top:14px">${A.list.map((c) => `
      <div class="item"><div class="th">${c.cover_url ? `<img src="${esc(c.cover_url)}" alt="">` : ""}</div>
      <div class="tx"><b>${esc(c.name)}</b><small class="muted">${catLabel(c.category)} · v${esc(c.current_version)} · ${c.published ? "✅ Publicado" : "📝 Rascunho"}${c.featured ? " · ⭐ Destaque" : ""}</small></div>
      <button class="btn sm" title="Publicar/Despublicar" onclick="admPublish('${c.id}')">${c.published ? "👁" : "🚫"}</button>
      <button class="btn sm" title="Editar" onclick="admEdit('${c.id}')">✏️</button>
      <button class="btn bad sm" title="Excluir" onclick="admDelete('${c.id}')">🗑</button></div>`).join("") || `<p class="muted">Nenhum card ainda. Toque em “Novo card”.</p>`}</div>`;
  } else if (A.tab === "users") {
    const { data } = await sb.from("profiles").select("*").order("created_at", { ascending: false });
    body = `<div style="margin-top:6px">${(data || []).map((u) => `<div class="item"><div class="tx"><b>${esc(u.username)}</b><small class="muted">Desde ${fdate(u.created_at)}${u.blocked ? " · 🚫 Bloqueado" : ""}</small></div>
      ${u.id === S.user.id ? `<span class="badge">Você</span>` : `<button class="btn sm ${u.blocked ? "" : "bad"}" onclick="admBlock('${u.id}',${!u.blocked})">${u.blocked ? "Desbloquear" : "Bloquear"}</button>`}</div>`).join("")}</div>`;
  } else {
    const s = S.settings || {};
    const sel = (id, opts, val) => `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}" ${v === val ? "selected" : ""}>${l}</option>`).join("")}</select>`;
    body = `<label class="f">TÍTULO DA PÁGINA INICIAL</label><input id="s_title" value="${esc(s.hero_title)}">
      <label class="f">SUBTÍTULO</label><input id="s_sub" value="${esc(s.hero_subtitle)}">
      <div class="g2"><div><label class="f">TEMA</label>${sel("s_theme", [["dark", "Escuro"], ["preto", "Preto total"], ["claro", "Claro"]], s.theme)}</div>
            <div><label class="f">BOTÕES</label>${sel("s_btn", [["arredondado", "Arredondados"], ["reto", "Retos"]], s.button_style)}</div>
      <div><label class="f">CARDS</label>${sel("s_size", [["grande", "Grandes"], ["compacto", "Compactos"]], s.card_size)}</div>
      <div style="grid-column:1/3"><label class="f">ORGANIZAÇÃO</label>${sel("s_sort", [["recentes", "Mais recentes"], ["destaques", "Destaques primeiro"]], s.sort_order)}</div></div>
      <label class="f">COR DO SITE (toque para ver na hora)</label>
      <div class="swatches">${Object.entries(COLORS).map(([k, c]) => `<button type="button" class="sw ${s.primary_color === k ? "on" : ""}" data-k="${k}" title="${k}" style="background:linear-gradient(135deg,${c[0]},${c[1]})" onclick="setColor('${k}')"></button>`).join("")}</div>
      <div class="g2"><div><label class="f">COR PERSONALIZADA 1</label><input type="color" id="s_c1" value="${colorsOf(s.primary_color)[0]}" oninput="customColor()" style="height:48px;padding:4px"></div>
      <div><label class="f">COR PERSONALIZADA 2</label><input type="color" id="s_c2" value="${colorsOf(s.primary_color)[1]}" oninput="customColor()" style="height:48px;padding:4px"></div></div>
      <input type="hidden" id="s_color" value="${esc(s.primary_color || "roxo")}">
      <label class="f">BANNER DA PÁGINA INICIAL</label>${pickerHtml(s.hero_banner_url, "Selecionar banner", "admSetting('hero_banner_url')", true)}
      <label class="f">IMAGEM DE FUNDO</label>${pickerHtml(s.background_url, "Selecionar fundo", "admSetting('background_url')", true)}
      <p><button class="btn pri" onclick="admSaveSettings()">Salvar visual</button></p>`;
  }
  box.innerHTML = `<h1 style="margin:0">Painel ADM</h1>${tabs}${body}`;
}
async function admPublish(id) { const c = A.list.find((x) => x.id === id); const { error } = await sb.from("contents").update({ published: !c.published, updated_at: new Date().toISOString() }).eq("id", id); if (error) toast(error.message, true); admDraw(); }
async function admDelete(id) {
  const c = A.list.find((x) => x.id === id);
  if (!confirm(`Excluir o card "${c.name}"? Isso apaga também as versões e downloads dele.`)) return;
  const { error } = await sb.from("contents").delete().eq("id", id);
  if (error) return toast("Erro ao excluir: " + error.message, true);
  toast("Card excluído"); admDraw();
}
async function admBlock(id, blocked) { const { error } = await sb.from("profiles").update({ blocked }).eq("id", id); if (error) toast(error.message, true); admDraw(); }
function admSetting(field) { pickImage("site", async (url) => { await sb.from("site_settings").update({ [field]: url }).eq("id", 1); await loadSettings(); admDraw(); }); }
function setColor(v) {
  $("#s_color").value = v; S.settings = S.settings || {}; S.settings.primary_color = v; applySettings();
  document.querySelectorAll(".sw").forEach((b) => b.classList.toggle("on", b.dataset.k === v));
  const c = colorsOf(v); $("#s_c1").value = c[0]; $("#s_c2").value = c[1];
}
function customColor() { setColor($("#s_c1").value + "|" + $("#s_c2").value); }
async function admSaveSettings() {
  const v = (id) => $("#" + id).value;
  const { error } = await sb.from("site_settings").update({ hero_title: v("s_title"), hero_subtitle: v("s_sub"), theme: v("s_theme"), primary_color: v("s_color"), button_style: v("s_btn"), card_size: v("s_size"), sort_order: v("s_sort") }).eq("id", 1);
  if (error) return toast(error.message, true);
  await loadSettings(); toast("Visual salvo");
}

/* editor de card */
function admNew() { A.edit = { id: null, d: emptyDraft() }; admDraw(); }
function admEdit(id) {
  const c = A.list.find((x) => x.id === id);
  A.edit = { id, d: { name: c.name, category: c.category, description: c.description, cover_url: c.cover_url, banner_url: c.banner_url, gallery: [...(c.gallery || [])], current_version: c.current_version, status: c.status, published: c.published, featured: c.featured, featured_title: c.featured_title || "", featured_description: c.featured_description || "" } };
  admDraw();
}
function admEditor() {
  const d = A.edit.d, id = A.edit.id;
  $("#admBox").innerHTML = `
  <div class="row" style="justify-content:space-between"><button class="btn" onclick="A.edit=null;admDraw()">← Voltar</button><button class="btn pri" id="saveBtn" onclick="admSave()">${id ? "Salvar" : "Criar card"}</button></div>
  <h2>${id ? "Editar card" : "Novo card"}</h2>
  <label class="f">NOME</label><input data-k="name" value="${esc(d.name)}" placeholder="Ex.: Skin Carioca">
  <label class="f">CATEGORIA</label><div class="cats">${CATS.map((c) => `<button type="button" class="cat ${d.category === c.v ? "on" : ""}" onclick="A.edit.d.category='${c.v}';admEditor()"><i>${c.i}</i>${c.l}</button>`).join("")}</div>
  <div class="g2"><div><label class="f">FOTO DE CAPA</label>${pickerHtml(d.cover_url, "Capa", "admImg('cover_url','covers')")}</div>
  <div><label class="f">BANNER</label>${pickerHtml(d.banner_url, "Banner", "admImg('banner_url','banners')")}</div></div>
  <label class="f">DESCRIÇÃO</label><textarea data-k="description" rows="5" placeholder="Escreva a descrição do conteúdo...">${esc(d.description)}</textarea>
  <label class="f">IMAGENS ADICIONAIS</label><div class="chips">${d.gallery.map((g, i) => `<div class="x"><img src="${esc(g)}" alt=""><button onclick="A.edit.d.gallery.splice(${i},1);admEditor()">✕</button></div>`).join("")}
    <div class="x">${pickerHtml(null, "Adicionar", "admGal()")}</div></div>
  <div class="g2"><div><label class="f">VERSÃO ATUAL</label><input data-k="current_version" value="${esc(d.current_version)}"></div>
  <div><label class="f">STATUS</label><select data-k="status"><option value="atualizado" ${d.status === "atualizado" ? "selected" : ""}>Atualizado</option><option value="antigo" ${d.status === "antigo" ? "selected" : ""}>Antigo</option></select></div></div>
  <p><label><input type="checkbox" style="width:auto" data-k="published" ${d.published ? "checked" : ""}> Publicado</label> &nbsp;
  <label><input type="checkbox" style="width:auto" data-k="featured" ${d.featured ? "checked" : ""}> Em destaque na página inicial</label></p>
  ${d.featured ? `<div class="box"><label class="f">TÍTULO DO DESTAQUE</label><input data-k="featured_title" value="${esc(d.featured_title)}"><label class="f">DESCRIÇÃO DO DESTAQUE</label><input data-k="featured_description" value="${esc(d.featured_description)}"></div>` : ""}
  <div id="verSection">${id ? "" : `<p class="box muted" style="border-style:dashed">Crie o card primeiro para adicionar versões e links de download.</p>`}</div>`;
  $("#admBox").querySelectorAll("[data-k]").forEach((el) => { el.oninput = el.onchange = () => { A.edit.d[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; if (el.dataset.k === "featured") admEditor(); }; });
  if (id) admVersions();
}
function admImg(field, folder) { pickImage(folder, (url) => { A.edit.d[field] = url; admEditor(); }); }
function admGal() { pickImage("gallery", (url) => { A.edit.d.gallery.push(url); admEditor(); }); }
async function admSave() {
  const d = A.edit.d; let id = A.edit.id;
  if (!d.name.trim()) return toast("Digite o nome do card.", true);
  $("#saveBtn").disabled = true;
  try {
    if (d.featured) { let q = sb.from("contents").update({ featured: false }).eq("featured", true); if (id) q = q.neq("id", id); await q; }
    const payload = { name: d.name.trim(), category: d.category, description: d.description, cover_url: d.cover_url, banner_url: d.banner_url, gallery: d.gallery, current_version: d.current_version.trim() || "1.0", status: d.status, published: d.published, featured: d.featured, featured_title: d.featured_title.trim() || null, featured_description: d.featured_description.trim() || null, updated_at: new Date().toISOString() };
    if (id) {
      const { error } = await sb.from("contents").update(payload).eq("id", id); if (error) throw error;
      toast("Card salvo");
    } else {
      let slug = slugify(d.name) || "conteudo";
      if ((await sb.from("contents").select("id").eq("slug", slug).maybeSingle()).data) slug += "-" + Math.random().toString(36).slice(2, 6);
      const { data, error } = await sb.from("contents").insert({ ...payload, slug }).select("id").single(); if (error) throw error;
      await sb.from("versions").insert({ content_id: data.id, version: payload.current_version, description: "Lançamento inicial.", features: [], is_current: true });
      A.edit.id = data.id; toast("Card criado — agora adicione versões e o link de download");
    }
    admEditor();
  } catch (e) { toast("Erro ao salvar: " + e.message, true); $("#saveBtn").disabled = false; }
}
async function admVersions() {
  const id = A.edit.id, box = $("#verSection"); if (!box) return;
  const { data: v } = await sb.from("versions").select("*").eq("content_id", id);
  const { data: dl } = await sb.from("downloads").select("*").in("version_id", (v || []).map((x) => x.id));
  const urls = new Map((dl || []).map((x) => [x.version_id, x.url]));
  const cur = A.edit.d.current_version;
  box.innerHTML = `<section class="box"><b class="muted" style="letter-spacing:.15em;font-size:13px">VERSÕES E DOWNLOADS</b>
    ${(v || []).sort((a, b) => cmpV(b.version, a.version)).map((x) => `<div class="box" style="background:var(--bg)"><div class="row" style="flex-wrap:wrap">
      <b style="flex:none">v${esc(x.version)}</b>${x.version === cur ? `<span class="badge pri" style="flex:none">Atual</span>` : ""}${x.archived ? `<span class="badge" style="flex:none">Arquivada</span>` : ""}
      <span style="flex:1"></span>${x.version !== cur ? `<button class="btn sm" onclick="verCurrent('${x.id}')">Marcar atual</button>` : ""}
      <button class="btn sm" onclick="verArchive('${x.id}',${!x.archived})">${x.archived ? "Desarquivar" : "Arquivar"}</button><button class="btn bad sm" onclick="verDelete('${x.id}')">🗑</button></div>
      <div class="row" style="margin-top:8px"><input id="u-${x.id}" value="${esc(urls.get(x.id) || "")}" placeholder="Link de download"><button class="btn sm" onclick="verUrl('${x.id}')">Salvar</button></div></div>`).join("")}
    <div class="box" style="border-style:dashed"><b>Adicionar versão</b>
      <input id="nv_v" placeholder="Versão (ex.: 1.3)" style="margin-top:8px"><input id="nv_d" placeholder="Descrição da atualização" style="margin-top:8px">
      <textarea id="nv_f" rows="3" placeholder="Novidades (uma por linha)" style="margin-top:8px"></textarea><input id="nv_u" placeholder="Link de download autorizado (opcional)" style="margin-top:8px">
      <p><button class="btn pri" onclick="verAdd()">+ Adicionar</button></p></div></section>`;
}
async function verAdd() {
  const ver = $("#nv_v").value.trim(); if (!ver) return toast("Digite o número da versão.", true);
  const { data, error } = await sb.from("versions").insert({ content_id: A.edit.id, version: ver, description: $("#nv_d").value, features: $("#nv_f").value.split("\n").map((s) => s.trim()).filter(Boolean) }).select("id").single();
  if (error) return toast(error.message, true);
  const u = $("#nv_u").value.trim(); if (u) await sb.from("downloads").upsert({ version_id: data.id, url: u });
  toast("Versão adicionada"); admVersions();
}
async function verCurrent(vid) {
  const { data: v } = await sb.from("versions").select("version").eq("id", vid).single();
  await sb.from("versions").update({ is_current: false }).eq("content_id", A.edit.id);
  await sb.from("versions").update({ is_current: true, archived: false }).eq("id", vid);
  await sb.from("contents").update({ current_version: v.version, status: "atualizado", updated_at: new Date().toISOString() }).eq("id", A.edit.id);
  A.edit.d.current_version = v.version; toast(`v${v.version} é a versão atual`); admEditor();
}
async function verUrl(vid) {
  const u = $("#u-" + vid).value.trim();
  const r = u ? await sb.from("downloads").upsert({ version_id: vid, url: u }) : await sb.from("downloads").delete().eq("version_id", vid);
  r.error ? toast(r.error.message, true) : toast("Link salvo");
}
async function verArchive(vid, a) { await sb.from("versions").update({ archived: a }).eq("id", vid); admVersions(); }
async function verDelete(vid) { if (!confirm("Excluir esta versão?")) return; const { error } = await sb.from("versions").delete().eq("id", vid); if (error) return toast(error.message, true); admVersions(); }

/* ---------- ROTAS ---------- */
async function render() {
  const my = ++renderToken, h = location.hash;
  const [, r, p] = h.startsWith("#/") ? h.split("/") : ["", "", ""];
  if (!S.ready) return;
  let html;
  try {
    if (r === "c" && p) html = await pDetail(decodeURIComponent(p));
    else if (r === "auth") html = pAuth(p);
    else if (r === "reset") html = pReset();
    else if (r === "conta") html = await pConta();
    else if (r === "admin") html = await pAdmin();
    else html = await pHome();
  } catch (e) { html = page(`<p class="wrap" style="padding:40px 0">Erro ao carregar: ${esc(e.message)}</p>`); }
  if (my !== renderToken) return;
  $("#app").innerHTML = html; window.scrollTo(0, 0);
  if (r === "c" && D.c) drawVersions();
  else if (r === "admin") admDraw();
  else if (!r || !["auth", "reset", "conta"].includes(r)) drawHome();
}
window.addEventListener("hashchange", render);

sb.auth.onAuthStateChange((event, session) => {
  setTimeout(async () => {
    await loadUser(session);
    if (event === "PASSWORD_RECOVERY") location.hash = "#/reset";
    if (S.ready && event !== "TOKEN_REFRESHED") render();
  });
});
(async () => {
  const { data } = await sb.auth.getSession();
  await Promise.all([loadUser(data.session), loadSettings()]);
  S.ready = true; render();
})();
