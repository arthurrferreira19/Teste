let modalTicket, modalDetails;
let currentId = null;

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showAlert(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!msg) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <div class="alert alert-${type} fade-in" role="alert" style="border-radius:16px;">
      ${msg}
    </div>
  `;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function badgeStatus(status) {
  const map = {
    "Concluído": "text-bg-success",
    "Em Andamento": "text-bg-primary",
    "Pendente": "text-bg-secondary",
    "Pausado": "text-bg-warning",
    "Aguardando Solicitante": "text-bg-dark",
    "Aguardando Fornecedor": "text-bg-info"
  };
  return `<span class="badge ${map[status] || "text-bg-secondary"}" style="border-radius:999px;">${esc(status)}</span>`;
}

function badgeUrgente(u) {
  return u
    ? `<span class="badge text-bg-danger" style="border-radius:999px;">Sim</span>`
    : `<span class="badge text-bg-secondary" style="border-radius:999px;">Não</span>`;
}

function resetCreateModal() {
  document.getElementById("titulo").value = "";
  document.getElementById("descricao").value = "";
  document.getElementById("prioridade").value = "Média";
  document.getElementById("urgente").value = "false";
  document.getElementById("dataInicio").value = todayISO();
  document.getElementById("dataFim").value = todayISO();
  showAlert("modalAlert", "", "");
}

function setCreating(v) {
  document.getElementById("btnCreate").disabled = v;
  document.getElementById("btnCreateSpin").classList.toggle("d-none", !v);
  document.getElementById("btnCreateText").textContent = v ? "Abrindo..." : "Abrir chamado";
}

async function loadTable() {
  const tbody = document.getElementById("tblBody");
  tbody.innerHTML = `<tr><td colspan="7" style="color:var(--muted);">Carregando...</td></tr>`;

  const search = document.getElementById("search").value.trim();
  const status = document.getElementById("filterStatus").value;

  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (status) qs.set("status", status);

  try {
    // ✅ backend deve retornar apenas os tickets do USER (solicitante = user)
    const tickets = await API.request(`/api/tickets?${qs.toString()}`, { method: "GET" });

    if (!tickets.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--muted);">Nenhum chamado encontrado</td></tr>`;
      return;
    }

    const me = API.getUser();
    const myName = me?.nome || "Você";

    // ✅ Tabela: remove dependência de responsável
    tbody.innerHTML = tickets.map(t => `
      <tr>
        <td>
          <div style="font-weight:900;">${esc(t.titulo)}</div>
          <div style="color:var(--muted); font-size:12px;">
            Início: ${new Date(t.dataInicio).toLocaleDateString()} • Fim: ${new Date(t.dataFim).toLocaleDateString()}
          </div>
        </td>
        <td>${badgeStatus(t.status)}</td>
        <td>${esc(t.prioridade)}</td>
        <td>${badgeUrgente(!!t.urgente)}</td>
        <td>${esc(myName)}</td>
        <td>${new Date(t.dataFim).toLocaleDateString()}</td>
        <td class="text-end">
          <button class="btn btn-outline-secondary btn-sm" style="border-radius:12px;"
            data-action="details" data-id="${t._id}">
            <i data-lucide="maximize-2" style="width:16px;height:16px;"></i>
          </button>
        </td>
      </tr>
    `).join("");

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    if (err.status === 401) {
      API.clearAuth();
      window.location.href = "/user/login.html";
      return;
    }
    showAlert("pageAlert", "danger", `<strong>Erro:</strong> ${esc(err.message || "Falha ao carregar")}`);
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--muted);">Erro ao carregar</td></tr>`;
  }
}

async function createTicket() {
  const titulo = document.getElementById("titulo").value.trim();
  const descricao = document.getElementById("descricao").value.trim();
  const prioridade = document.getElementById("prioridade").value;
  const urgente = document.getElementById("urgente").value === "true";
  const dataInicio = document.getElementById("dataInicio").value;
  const dataFim = document.getElementById("dataFim").value;

  if (!titulo) return showAlert("modalAlert", "warning", "Informe o <strong>título</strong>.");
  if (!descricao) return showAlert("modalAlert", "warning", "Informe a <strong>descrição</strong>.");
  if (!dataFim) return showAlert("modalAlert", "warning", "Informe a <strong>data fim</strong> (prazo).");

  setCreating(true);
  try {
    await API.request("/api/tickets", {
      method: "POST",
      body: {
        titulo,
        descricao,
        prioridade,
        urgente,
        status: "Pendente",
        dataInicio,
        dataFim
        // ✅ sem responsavel: backend seta responsavel = user logado
      }
    });

    modalTicket.hide();
    showAlert("pageAlert", "success", "Chamado aberto com sucesso.");
    await loadTable();
  } catch (err) {
    if (err.status === 401) {
      API.clearAuth();
      window.location.href = "/user/login.html";
      return;
    }
    showAlert("modalAlert", "danger", esc(err.message || "Erro ao abrir chamado"));
  } finally {
    setCreating(false);
  }
}

async function openDetails(id) {
  currentId = id;
  try {
    const t = await API.request(`/api/tickets/${id}`, { method: "GET" });

    document.getElementById("detailsTitle").textContent = t.titulo || "Detalhes";
    document.getElementById("detailsMeta").textContent =
      `Status: ${t.status} • Prioridade: ${t.prioridade} • Urgente: ${t.urgente ? "Sim" : "Não"}`;

    const me = API.getUser();
    const myName = me?.nome || "Você";

    document.getElementById("detailsInfo").innerHTML = `
      <div><strong>Descrição:</strong> ${esc(t.descricao)}</div>
      <div class="mt-2"><strong>Solicitante/Responsável:</strong> ${esc(myName)}</div>
      <div class="mt-1"><strong>Setor:</strong> ${esc(t.setor?.nome || "—")}</div>
      <div class="mt-1"><strong>Início:</strong> ${new Date(t.dataInicio).toLocaleDateString()} • <strong>Fim:</strong> ${new Date(t.dataFim).toLocaleDateString()}</div>
    `;

    renderChat(t);
    document.getElementById("msg").value = "";
    document.getElementById("anexo").value = "";
    showAlert("detailsAlert", "", "");

    modalDetails.show();
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    showAlert("pageAlert", "danger", esc(err.message || "Erro ao abrir detalhes"));
  }
}

function renderChat(t) {
  const box = document.getElementById("chatBox");
  const updates = t.atualizacoes || [];

  if (!updates.length) {
    box.innerHTML = `<div style="color:var(--muted); font-size:13px;">Nenhuma atualização ainda.</div>`;
    return;
  }

  box.innerHTML = updates.map(u => {
    const dt = new Date(u.createdAt).toLocaleString();
    const autor = u.autor?.nome || "—";
    const anexo = u.anexo
      ? `<div style="margin-top:6px; font-size:12px;"><strong>Anexo:</strong> ${esc(u.anexo)}</div>`
      : "";

    return `
      <div class="soft-card-sm p-2 mb-2">
        <div style="display:flex; justify-content:space-between; gap:10px;">
          <div style="font-weight:800;">${esc(autor)}</div>
          <div style="color:var(--muted); font-size:12px;">${esc(dt)}</div>
        </div>
        <div style="margin-top:6px;">${esc(u.mensagem)}</div>
        ${anexo}
      </div>
    `;
  }).join("");

  box.scrollTop = box.scrollHeight;
}

async function sendUpdate() {
  const msg = document.getElementById("msg").value.trim();
  const anexo = document.getElementById("anexo").value.trim();
  if (!msg) return showAlert("detailsAlert", "warning", "Escreva uma mensagem.");

  try {
    const t = await API.request(`/api/tickets/${currentId}/updates`, {
      method: "POST",
      body: { mensagem: msg, anexo: anexo || null }
    });
    document.getElementById("msg").value = "";
    document.getElementById("anexo").value = "";
    renderChat(t);
  } catch (err) {
    showAlert("detailsAlert", "danger", esc(err.message || "Erro ao enviar atualização"));
  }
}

(function init() {
  if (!userValidateTokenOrRedirect()) return;

  userMountSidebar("chamados");
  userSetupSidebarToggle();

  modalTicket = new bootstrap.Modal(document.getElementById("modalTicket"));
  modalDetails = new bootstrap.Modal(document.getElementById("modalDetails"));

  document.getElementById("btnRefresh").addEventListener("click", loadTable);
  document.getElementById("btnApply").addEventListener("click", loadTable);
  document.getElementById("btnClear").addEventListener("click", () => {
    document.getElementById("search").value = "";
    document.getElementById("filterStatus").value = "";
    loadTable();
  });

  document.getElementById("btnOpenCreate").addEventListener("click", async () => {
    resetCreateModal();
    if (window.lucide) window.lucide.createIcons();
  });

  document.getElementById("btnCreate").addEventListener("click", createTicket);
  document.getElementById("btnSendUpdate").addEventListener("click", sendUpdate);

  document.getElementById("tblBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (action === "details") return openDetails(id);
  });

  loadTable();
  if (window.lucide) window.lucide.createIcons();
})();
