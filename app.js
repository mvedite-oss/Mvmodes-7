const SUPABASE_URL = "https://c--f82a93d6-e727-44a0-9668-016ddfcb53de-prod.lovable.cloud";
const SUPABASE_KEY = "sb_publishable_WAZS0KKE_4vIrJVJRVvVEA_o_e3F5Hn";
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
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[char]);
}

function toast(message, isError = false) {
  const el = document.createElement("div");
  el.textContent = message;
  if (isError) el.style.borderColor = "#ff5c7a";
  $("#toast").appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function formatSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function safeName(name) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120) || "arquivo";
}

function selectFile(file) {
  if (!file) return;
  selectedFile = file;
  uploadButton.disabled = false;
  uploadArea.querySelector("label strong").textContent = file.name;
  uploadArea.querySelector("label small").textContent = formatSize(file.size);
  $("#result").hidden = true;
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

uploadArea.addEventListener("drop", (event) => {
  selectFile(event.dataTransfer.files[0]);
});

$("#adminButton").addEventListener("click", () => {
  $("#adminPassword").value = "";
  $("#adminMessage").textContent = "";
  dialog.showModal();
  $("#adminPassword").focus();
});

$("#adminPassword").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    $("#adminSubmit").click();
  }
});

$("#adminSubmit").addEventListener("click", async (event) => {
  event.preventDefault();
  if ($("#adminPassword").value === ADMIN_PASSWORD) {
    isAdmin = true;
    dialog.close();
    toast("Modo administrativo ativado");
    await loadFiles();
  } else {
    $("#adminMessage").textContent = "Senha incorreta";
  }
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
  $("#filesList").innerHTML = '<p class="subtitle">Carregando arquivos...</p>';

  const { data, error } = await sb
    .from("upload_files")
    .select("id,name,size,type,url,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    $("#filesList").innerHTML = '<p class="subtitle">Banco ainda não configurado. Execute banco.sql no Supabase.</p>';
    return;
  }

  $("#filesList").innerHTML = (data || []).map((file) => `
    <div class="file-row">
      <div class="file-info">
        <strong>${esc(file.name)}</strong>
        <small>${formatSize(file.size)} · ${file.created_at ? new Date(file.created_at).toLocaleString("pt-BR") : "Data indisponível"}</small>
      </div>
      <a class="button small" href="${esc(file.url)}" target="_blank" rel="noopener">Abrir</a>
      <button class="button small" data-copy-url="${esc(file.url)}">Copiar</button>
    </div>
  `).join("") || '<p class="subtitle">Nenhum arquivo enviado.</p>';

  $("#filesList").querySelectorAll("[data-copy-url]").forEach((button) => {
    button.addEventListener("click", async () => {
      await copyText(button.dataset.copyUrl);
      toast("Link copiado");
    });
  });
}

function uploadWithProgress(file, path, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const url = `${SUPABASE_URL}/storage/v1/object/uploads/${encodedPath}`;

    xhr.open("POST", url);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("Authorization", `Bearer ${SUPABASE_KEY}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("Cache-Control", "31536000");
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.max(1, Math.min(99, Math.floor((event.loaded / event.total) * 100)));
      onProgress(percent, event.loaded, event.total);
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100, file.size, file.size);
        resolve();
        return;
      }

      let detail = xhr.responseText;
      try {
        const body = JSON.parse(xhr.responseText);
        detail = body.message || body.error || body.error_description || detail;
      } catch {}

      reject(new Error(detail || `Erro HTTP ${xhr.status}`));
    });

    xhr.addEventListener("error", () => reject(new Error("Falha de rede durante o envio. Verifique sua conexão.")));
    xhr.addEventListener("abort", () => reject(new Error("Envio cancelado.")));
    xhr.send(file);
  });
}

uploadButton.addEventListener("click", async () => {
  if (!selectedFile) return;

  if (!isAdmin) {
    dialog.showModal();
    $("#adminPassword").focus();
    toast("Digite 360 no botão ADM para enviar", true);
    return;
  }

  uploadButton.disabled = true;
  $("#progressWrap").hidden = false;
  $("#progressBar").style.width = "0%";
  $("#progressText").textContent = `0% · ${formatSize(selectedFile.size)}`;

  const id = crypto.randomUUID();
  const path = `${id}/${safeName(selectedFile.name)}`;

  try {
    await uploadWithProgress(selectedFile, path, (percent, loaded, total) => {
      $("#progressBar").style.width = `${percent}%`;
      $("#progressText").textContent = `${percent}% · ${formatSize(loaded)} / ${formatSize(total)}`;
    });
  } catch (error) {
    $("#progressWrap").hidden = true;
    uploadButton.disabled = false;

    let message = error.message;
    if (/bucket.*not found|bucket not found/i.test(message)) {
      message = "Bucket uploads não encontrado. Execute banco.sql no Supabase.";
    } else if (/row-level security|not authorized|policy|permission/i.test(message)) {
      message = "Permissão negada. Execute banco.sql no Supabase.";
    }

    toast("Falha no envio: " + message, true);
    return;
  }

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

  $("#progressBar").style.width = "100%";
  $("#progressText").textContent = "100% · Concluído";

  if (databaseError) {
    toast("Arquivo enviado, mas o banco não foi configurado: " + databaseError.message, true);
  } else {
    toast("Arquivo enviado e registrado no banco");
  }

  await loadFiles();
  setTimeout(() => $("#progressWrap").hidden = true, 1200);
  uploadButton.disabled = false;
});

$("#copyButton").addEventListener("click", async () => {
  await copyText($("#linkOutput").value);
  $("#copyButton").textContent = "Copiado!";
  setTimeout(() => $("#copyButton").textContent = "Copiar", 1800);
});
