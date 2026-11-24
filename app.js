const SUPABASE_URL = "https://c--f82a93d6-e727-44a0-9668-016ddfcb53de-prod.lovable.cloud";
const SUPABASE_KEY = "sb_publishable_WAZS0KKE_4vIrJVJRVvVEA_o_e3F5Hn";

if (!window.supabase) {
  document.body.innerHTML = '<p style="padding:40px;text-align:center">Erro: biblioteca Supabase não carregou. Verifique sua conexão.</p>';
  throw new Error("Supabase library not loaded");
}

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (selector) => document.querySelector(selector);
const ADMIN_PASSWORD = "360";
const input = $("#fileInput");
const uploadArea = $("#uploadArea");
const uploadButton = $("#uploadButton");
const dialog = $("#adminDialog");

let selectedFile = null;
let isAdmin = false;

$("#year").textContent = new Date().getFullYear();

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
}

function toast(message, error = false) {
  const element = document.createElement("div");
  element.textContent = message;
  if (error) element.style.borderColor = "#ff5c7a";
  $("#toast").appendChild(element);
  setTimeout(() => element.remove(), 4000);
}

function formatSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function safeName(name) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-").slice(0, 120) || "arquivo";
}

function selectFile(file) {
  if (!file) return;
  selectedFile = file;
  uploadButton.disabled = false;
  $("#result").hidden = true;
  uploadArea.querySelector("strong").textContent = file.name;
  uploadArea.querySelector("small").textContent = formatSize(file.size);
}

input.addEventListener("change", () => selectFile(input.files[0]));

["dragenter", "dragover"].forEach((name) => uploadArea.addEventListener(name, (event) => {
  event.preventDefault();
  uploadArea.classList.add("drag");
}));

["dragleave", "drop"].forEach((name) => uploadArea.addEventListener(name, (event) => {
  event.preventDefault();
  uploadArea.classList.remove("drag");
}));

uploadArea.addEventListener("drop", (event) => selectFile(event.dataTransfer.files[0]));

$("#adminButton").addEventListener("click", () => {
  $("#adminPassword").value = "";
  $("#adminMessage").textContent = "";
  dialog.showModal();
  $("#adminPassword").focus();
});

$("#adminPassword").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("#adminSubmit").click();
});

$("#adminSubmit").addEventListener("click", async () => {
  if ($("#adminPassword").value !== ADMIN_PASSWORD) {
    $("#adminMessage").textContent = "Senha incorreta";
    return;
  }
  isAdmin = true;
  dialog.close();
  toast("Modo administrativo ativado");
  await loadFiles();
});

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

async function loadFiles() {
  if (!isAdmin) return;
  $("#filesSection").hidden = false;

  const { data, error } = await sb.from("upload_files")
    .select("id,name,size,type,url,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    $("#filesList").innerHTML = '<p class="subtitle">Não foi possível carregar o banco: execute banco.sql no Supabase.</p>';
    return;
  }

  $("#filesList").innerHTML = (data || []).map((file) => `
    <div class="file-row">
      <div class="file-info">
        <strong>${esc(file.name)}</strong>
        <small>${formatSize(file.size)} · ${file.created_at ? new Date(file.created_at).toLocaleString("pt-BR") : ""}</small>
      </div>
      <a class="button small" href="${esc(file.url)}" target="_blank" rel="noopener">Abrir</a>
      <button class="button small copy-saved" data-url="${esc(file.url)}" type="button">Copiar</button>
    </div>`).join("") || '<p class="subtitle">Nenhum arquivo enviado.</p>';

  document.querySelectorAll(".copy-saved").forEach((button) => {
    button.addEventListener("click", async () => {
      await copyText(button.dataset.url);
      toast("Link copiado");
    });
  });
}

async function uploadWithRetry(file, path) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    $("#progressText").textContent = attempt === 1 ? "Enviando..." : `Tentando novamente (${attempt}/3)...`;
    $("#progressBar").style.width = attempt === 1 ? "25%" : `${25 + attempt * 20}%`;

    const { error } = await sb.storage.from("uploads").upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || "application/octet-stream"
    });

    if (!error) return;
    lastError = error;
    await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
  }
  throw lastError;
}

uploadButton.addEventListener("click", async () => {
  if (!selectedFile) return;

  if (!isAdmin) {
    dialog.showModal();
    $("#adminPassword").focus();
    toast("Digite 360 no botão ADM", true);
    return;
  }

  uploadButton.disabled = true;
  $("#progressWrap").hidden = false;
  $("#progressBar").style.width = "10%";
  $("#progressText").textContent = "Preparando...";

  const id = crypto.randomUUID();
  const path = `${id}/${safeName(selectedFile.name)}`;

  try {
    await uploadWithRetry(selectedFile, path);
  } catch (error) {
    $("#progressWrap").hidden = true;
    uploadButton.disabled = false;

    let message = error.message || "Falha de rede";
    if (/fetch|network|failed/i.test(message)) {
      message = "Sem conexão com o Supabase. Recarregue a página e tente novamente. Se estiver no GitHub Pages, aguarde a implantação terminar.";
    } else if (/bucket.*not found/i.test(message)) {
      message = "Bucket uploads não encontrado. Execute banco.sql no Supabase.";
    } else if (/row-level|policy|not authorized|permission/i.test(message)) {
      message = "Permissão negada. Execute banco.sql no Supabase.";
    }

    toast(message, true);
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

  if (databaseError) {
    toast("Arquivo enviado, mas não pôde ser registrado no banco: " + databaseError.message, true);
  } else {
    toast("Arquivo enviado e registrado");
  }

  await loadFiles();
  setTimeout(() => $("#progressWrap").hidden = true, 800);
  uploadButton.disabled = false;
});

$("#copyButton").addEventListener("click", async () => {
  await copyText($("#linkOutput").value);
  $("#copyButton").textContent = "Copiado!";
  setTimeout(() => $("#copyButton").textContent = "Copiar", 1800);
});
