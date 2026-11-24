const SUPABASE_URL = "https://c--f82a93d6-e727-44a0-9668-016ddfcb53de-prod.lovable.cloud";
const SUPABASE_KEY = "sb_publishable_WAZS0KKE_4vIrJVJRVvVEA_o_e3F5Hn";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_PASSWORD = "360";
const input = document.querySelector("#fileInput");
const uploadArea = document.querySelector("#uploadArea");
const uploadButton = document.querySelector("#uploadButton");
const dialog = document.querySelector("#adminDialog");
let selectedFile = null;
let isAdmin = false;

const $ = (s) => document.querySelector(s);
document.querySelector("#year").textContent = new Date().getFullYear();

function toast(message) {
  const el = document.createElement("div"); el.textContent = message;
  $("#toast").appendChild(el); setTimeout(() => el.remove(), 3500);
}

function formatSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

input.addEventListener("change", () => {
  selectedFile = input.files[0] || null;
  uploadButton.disabled = !selectedFile;
  if (selectedFile) uploadArea.querySelector("label strong").textContent = selectedFile.name;
});

["dragenter", "dragover"].forEach((name) => uploadArea.addEventListener(name, (event) => {
  event.preventDefault(); uploadArea.classList.add("drag");
}));
["dragleave", "drop"].forEach((name) => uploadArea.addEventListener(name, (event) => {
  event.preventDefault(); uploadArea.classList.remove("drag");
}));
uploadArea.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) return;
  selectedFile = file;
  uploadButton.disabled = false;
  uploadArea.querySelector("label strong").textContent = file.name;
});

$("#adminButton").addEventListener("click", () => {
  $("#adminPassword").value = "";
  $("#adminMessage").textContent = "";
  dialog.showModal();
  $("#adminPassword").focus();
});

$("#adminSubmit").addEventListener("click", (event) => {
  event.preventDefault();
  if ($("#adminPassword").value === ADMIN_PASSWORD) {
    isAdmin = true; dialog.close();
    toast("Modo administrativo ativado");
  } else {
    $("#adminMessage").textContent = "Senha incorreta";
  }
});

function safeName(name) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9._-]/g,"-").replace(/-+/g,"-");
}

async function loadFiles() {
  if (!isAdmin) return;
  const { data, error } = await sb
    .from("upload_files")
    .select("id,name,size,type,url,created_at")
    .order("created_at", { ascending: false });

  if (error) return;
  $("#filesSection").hidden = false;

  $("#filesList").innerHTML = (data || []).map((file) => `
    <div class="file-row">
      <div class="file-info">
        <strong>${file.name}</strong>
        <small>${formatSize(file.size)} · ${new Date(file.created_at).toLocaleString("pt-BR")}</small>
      </div>
      <a class="button small" href="${file.url}" target="_blank" rel="noopener">Abrir</a>
      <button class="button small" onclick="copySavedLink('${file.url}')">Copiar</button>
    </div>
  `).join("") || '<p class="subtitle">Nenhum arquivo enviado.</p>';
}

async function copySavedLink(url) {
  await navigator.clipboard.writeText(url);
  toast("Link copiado");
}

uploadButton.addEventListener("click", async () => {
  if (!selectedFile) return;
  if (!isAdmin) {
    dialog.showModal();
    $("#adminPassword").focus();
    toast("Entre no modo ADM para enviar");
    return;
  }

  uploadButton.disabled = true;
  $("#progressWrap").hidden = false;
  $("#progressBar").style.width = "8%";
  $("#progressText").textContent = "8%";

  const id = crypto.randomUUID();
  const path = `${id}/${safeName(selectedFile.name) || "arquivo"}`;

  const { error } = await sb.storage.from("uploads").upload(path, selectedFile, {
    cacheControl: "31536000",
    upsert: false,
    contentType: selectedFile.type || "application/octet-stream"
  });

  if (error) {
    $("#progressWrap").hidden = true;
    uploadButton.disabled = false;
    toast("Falha no envio: " + error.message);
    return;
  }

  $("#progressBar").style.width = "100%";
  $("#progressText").textContent = "100%";
  const url = sb.storage.from("uploads").getPublicUrl(path).data.publicUrl;

  const { error: databaseError } = await sb.from("upload_files").insert({
    id,
    name: selectedFile.name,
    path,
    type: selectedFile.type || "application/octet-stream",
    size: selectedFile.size,
    url
  });

  $("#linkOutput").value = url;
  $("#openButton").href = url;
  $("#result").hidden = false;

  if (databaseError) toast("Arquivo enviado, mas não pôde ser registrado no banco: " + databaseError.message);
  else toast("Arquivo enviado e registrado no banco");

  await loadFiles();
  setTimeout(() => $("#progressWrap").hidden = true, 700);
  uploadButton.disabled = false;
});

$("#copyButton").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("#linkOutput").value);
  $("#copyButton").textContent = "Copiado!";
  setTimeout(() => $("#copyButton").textContent = "Copiar", 1800);
});
