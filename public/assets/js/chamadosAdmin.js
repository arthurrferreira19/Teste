const STATUS = [
  "Pendente",
  "Em Andamento",
  "Aguardando Solicitante",
  "Aguardando Fornecedor",
  "Concluído",
  "Pausado"
];

let modalTicket, modalDetails, modalDelete;
let currentDetailsId = null;

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
  if (!msg) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <div class="alert alert-${type} fade-in" role="alert" style="border-radius:16px;">
      ${msg}
    </div>
  `;
}

function setSaving(v) {
  const btn = document.getElementById("btnSave");
  const spin = document.getElementById("btnSaveSpin");
  const text = document.getElementById("btnSaveText");
  btn.disabled = v;
  spin.classList.toggle("d-none", !v);
  text.textContent = v ? "Salvando..." : "Salvar";
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

function fillStatusSelect(selectId, includeAll = false) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = (includeAll ? `<option value="">Todos</option>` : "") + STATUS.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadSectorsFilter() {
  const sel = document.getElementById("filterSetor");
  try {
    const sectors = await API.request("/api/sectors?ativo=true", { method: "GET" });
    sel.innerHTML = `<option value="">Todos</option>` + sectors.map(s => `<option value="${s._id}">${esc(s.nome)}</option>`).join("");
  } catch {
    sel.innerHTML = `<option value="">Todos</option>`;
  }
}

async function loadRespFilter() {
  // Usa /api/users com filtro role. Juntamos ADMIN + RESPONSAVEL.
  const sel = document.getElementById("filterResp");
  try {
    const r1 = await API.request("/api/users?role=RESPONSAVEL", { method: "GET" });
    const r2 = await API.request("/api/users?role=ADMIN", { method: "GET" });
    const all = [...r1, ...r2].filter(u => u.ativo);

    sel.innerHTML = `<option value="">Todos</option>` + all.map(u => `<option value="${u._id}">${esc(u.nome)} • ${esc(u.role)}</option>`).join("");
  } catch {
    sel.innerHTML = `<option value="">Todos</option>`;
  }
}

async function loadModalOptions() {
  // responsável
  const selR = document.getElementById("responsavel");
  // setores
  const selS = document.getElementById("setor");

  const [r1, r2, sectors] = await Promise.all([
    API.request("/api/users?role=RESPONSAVEL", { method: "GET" }).catch(() => []),
    API.request("/api/users?role=ADMIN", { method: "GET" }).catch(() => []),
    API.request("/api/sectors?ativo=true", { method: "GET" }).catch(() => [])
  ]);

  const responsaveis = [...r1, ...r2].filter(u => u.ativo);

  selR.innerHTML = `<option value="">Selecione...</option>` + responsaveis.map(u => `
    <option value="${u._id}" data-setor="${u.setor?._id || ""}">
      ${esc(u.nome)} • ${esc(u.role)} • ${esc(u.email)}
    </option>
  `).join("");

  selS.innerHTML = `<option value="">Selecione...</option>` + sectors.map(s => `<option value="${s._id}">${esc(s.nome)}</option>`).join("");

  // auto-fill setor se responsável tiver setor
  selR.addEventListener("change", () => {
    const opt = selR.selectedOptions?.[0];
    const setorId = opt?.getAttribute("data-setor") || "";
    if (setorId) selS.value = setorId;
  }, { once: true });
}

function resetTicketModal() {
  document.getElementById("ticketId").value = "";
  document.getElementById("modalTitle").textContent = "Abrir chamado";
  document.getElementById("titulo").value = "";
  document.getElementById("descricao").value = "";
  document.getElementById("prioridade").value = "Média";
  document.getElementById("urgente").value = "false";
  document.getElementById("dataInicio").value = todayISO();
  document.getElementById("dataFim").value = todayISO();
  document.getElementById("responsavel").value = "";
  document.getElementById("setor").value = "";
  document.getElementById("status").value = "Pendente";
  showAlert("modalAlert", "", "");
}

async function loadTable() {
  const tbody = document.getElementById("tblBody");
  tbody.innerHTML = `<tr><td colspan="7" style="color:var(--muted);">Carregando...</td></tr>`;

  const search = document.getElementById("search").value.trim();
  const status = document.getElementById("filterStatus").value;
  const urgente = document.getElementById("filterUrgente").value;
  const setor = document.getElementById("filterSetor").value;
  const responsavel = document.getElementById("filterResp").value;

  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (status) qs.set("status", status);
  if (urgente !== "") qs.set("urgente", urgente);
  if (setor) qs.set("setor", setor);
  if (responsavel) qs.set("responsavel", responsavel);

  try {
    const tickets = await API.request(`/api/tickets?${qs.toString()}`, { method: "GET" });

    if (!tickets.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--muted);">Nenhum chamado encontrado</td></tr>`;
      return;
    }

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
        <td>${esc(t.responsavel?.nome || "—")}</td>
        <td>${esc(t.setor?.nome || "—")}</td>
        <td class="text-end">
          <div class="d-flex justify-content-end gap-2 flex-wrap">

            <button class="btn btn-outline-secondary btn-sm" style="border-radius:12px;"
              data-action="details" data-id="${t._id}">
              <i data-lucide="maximize-2" style="width:16px;height:16px;"></i>
            </button>

            <button class="btn btn-outline-secondary btn-sm" style="border-radius:12px;"
              data-action="edit" data-id="${t._id}">
              <i data-lucide="pencil" style="width:16px;height:16px;"></i>
            </button>

            <div class="dropdown">
              <button class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown" style="border-radius:12px;">
                Status
              </button>
              <ul class="dropdown-menu">
                ${STATUS.map(s => `
                  <li><a class="dropdown-item" href="#" data-action="quickStatus" data-id="${t._id}" data-status="${esc(s)}">${esc(s)}</a></li>
                `).join("")}
              </ul>
            </div>

            <button class="btn btn-outline-danger btn-sm" style="border-radius:12px;"
              data-action="delete" data-id="${t._id}" data-name="${esc(t.titulo)}">
              <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join("");

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      API.clearAuth();
      window.location.href = "/admin/login.html";
      return;
    }
    showAlert("pageAlert", "danger", `<strong>Erro:</strong> ${esc(err.message || "Falha ao carregar")}`);
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--muted);">Erro ao carregar</td></tr>`;
  }
}

async function fetchTicket(id) {
  return API.request(`/api/tickets/${id}`, { method: "GET" });
}

async function openEdit(id) {
  const t = await fetchTicket(id);
  document.getElementById("ticketId").value = t._id;
  document.getElementById("modalTitle").textContent = "Editar chamado";
  document.getElementById("titulo").value = t.titulo || "";
  document.getElementById("descricao").value = t.descricao || "";
  document.getElementById("prioridade").value = t.prioridade || "Média";
  document.getElementById("urgente").value = String(!!t.urgente);
  document.getElementById("status").value = t.status || "Pendente";
  document.getElementById("dataInicio").value = new Date(t.dataInicio).toISOString().slice(0,10);
  document.getElementById("dataFim").value = new Date(t.dataFim).toISOString().slice(0,10);
  document.getElementById("responsavel").value = t.responsavel?._id || "";
  document.getElementById("setor").value = t.setor?._id || "";
  showAlert("modalAlert", "", "");
  modalTicket.show();
}

async function saveTicket() {
  const id = document.getElementById("ticketId").value;
  const titulo = document.getElementById("titulo").value.trim();
  const descricao = document.getElementById("descricao").value.trim();
  const prioridade = document.getElementById("prioridade").value;
  const status = document.getElementById("status").value;
  const urgente = document.getElementById("urgente").value === "true";
  const dataInicio = document.getElementById("dataInicio").value;
  const dataFim = document.getElementById("dataFim").value;
  const responsavel = document.getElementById("responsavel").value;
  const setor = document.getElementById("setor").value || null;

  if (!titulo) return showAlert("modalAlert", "warning", "Informe o <strong>título</strong>.");
  if (!descricao) return showAlert("modalAlert", "warning", "Informe a <strong>descrição</strong>.");
  if (!responsavel) return showAlert("modalAlert", "warning", "Selecione o <strong>responsável</strong>.");
  if (!dataInicio || !dataFim) return showAlert("modalAlert", "warning", "Informe as <strong>datas</strong>.");

  setSaving(true);
  try {
    const body = { titulo, descricao, prioridade, status, urgente, dataInicio, dataFim, responsavel, setor };

    if (!id) {
      await API.request("/api/tickets", { method: "POST", body });
      showAlert("pageAlert", "success", "Chamado criado com sucesso.");
    } else {
      await API.request(`/api/tickets/${id}`, { method: "PUT", body });
      showAlert("pageAlert", "success", "Chamado atualizado com sucesso.");
    }

    modalTicket.hide();
    await loadTable();
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      API.clearAuth();
      window.location.href = "/admin/login.html";
      return;
    }
    showAlert("modalAlert", "danger", esc(err.message || "Erro ao salvar"));
  } finally {
    setSaving(false);
  }
}

async function quickStatus(id, status) {
  try {
    await API.request(`/api/tickets/${id}/status`, { method: "PATCH", body: { status } });
    await loadTable();
  } catch (err) {
    showAlert("pageAlert", "danger", esc(err.message || "Erro ao alterar status"));
  }
}

function openDelete(id, name) {
  document.getElementById("delId").value = id;
  document.getElementById("delName").textContent = name || "—";
  modalDelete.show();
}

async function confirmDelete() {
  const id = document.getElementById("delId").value;
  try {
    await API.request(`/api/tickets/${id}`, { method: "DELETE" });
    modalDelete.hide();
    showAlert("pageAlert", "success", "Chamado excluído com sucesso.");
    await loadTable();
  } catch (err) {
    showAlert("pageAlert", "danger", esc(err.message || "Erro ao excluir"));
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
    const anexo = u.anexo ? `<div style="margin-top:6px; font-size:12px;"><strong>Anexo:</strong> ${esc(u.anexo)}</div>` : "";
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

async function openDetails(id) {
  currentDetailsId = id;
  const t = await fetchTicket(id);

  document.getElementById("detailsTitle").textContent = t.titulo || "Detalhes do chamado";
  document.getElementById("detailsMeta").textContent =
    `Status: ${t.status} • Prioridade: ${t.prioridade} • Urgente: ${t.urgente ? "Sim" : "Não"}`;

  document.getElementById("detailsInfo").innerHTML = `
    <div><strong>Descrição:</strong> ${esc(t.descricao)}</div>
    <div class="mt-2"><strong>Responsável:</strong> ${esc(t.responsavel?.nome || "—")} (${esc(t.responsavel?.email || "")})</div>
    <div class="mt-1"><strong>Setor:</strong> ${esc(t.setor?.nome || "—")}</div>
    <div class="mt-1"><strong>Início:</strong> ${new Date(t.dataInicio).toLocaleDateString()} • <strong>Fim:</strong> ${new Date(t.dataFim).toLocaleDateString()}</div>
  `;

  // quick status
  const qs = document.getElementById("quickStatus");
  qs.innerHTML = STATUS.map(s => `<option value="${esc(s)}" ${s===t.status?"selected":""}>${esc(s)}</option>`).join("");

  renderChat(t);

  document.getElementById("msg").value = "";
  document.getElementById("anexo").value = "";

  showAlert("detailsAlert", "", "");
  modalDetails.show();

  if (window.lucide) window.lucide.createIcons();
}

async function sendUpdate() {
  const msg = document.getElementById("msg").value.trim();
  const anexo = document.getElementById("anexo").value.trim();
  if (!msg) return showAlert("detailsAlert", "warning", "Escreva uma mensagem.");

  try {
    const t = await API.request(`/api/tickets/${currentDetailsId}/updates`, {
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
  validateTokenOrRedirect();
  mountSidebar("chamados");
  showTopbarModule("Chamados");
  setupSidebarToggle();

  modalTicket = new bootstrap.Modal(document.getElementById("modalTicket"));
  modalDetails = new bootstrap.Modal(document.getElementById("modalDetails"));
  modalDelete = new bootstrap.Modal(document.getElementById("modalDelete"));

  // selects
  fillStatusSelect("filterStatus", true);
  fillStatusSelect("status", false);

  // quick status button in details
  document.getElementById("btnQuickStatus").addEventListener("click", async () => {
    const status = document.getElementById("quickStatus").value;
    await quickStatus(currentDetailsId, status);
    // recarrega detalhes
    await openDetails(currentDetailsId);
  });

  document.getElementById("btnSendUpdate").addEventListener("click", sendUpdate);

  document.getElementById("btnOpenCreate").addEventListener("click", async () => {
    resetTicketModal();
    await loadModalOptions();
    if (window.lucide) window.lucide.createIcons();
  });

  document.getElementById("btnSave").addEventListener("click", saveTicket);
  document.getElementById("btnConfirmDelete").addEventListener("click", confirmDelete);

  document.getElementById("btnApply").addEventListener("click", loadTable);
  document.getElementById("btnRefresh").addEventListener("click", loadTable);
  document.getElementById("btnClear").addEventListener("click", () => {
    document.getElementById("search").value = "";
    document.getElementById("filterStatus").value = "";
    document.getElementById("filterUrgente").value = "";
    document.getElementById("filterSetor").value = "";
    document.getElementById("filterResp").value = "";
    loadTable();
  });

  // ações da tabela
  document.getElementById("tblBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");

    if (action === "details") return openDetails(id);
    if (action === "edit") {
      await loadModalOptions();
      return openEdit(id);
    }
    if (action === "delete") return openDelete(id, btn.getAttribute("data-name"));
    if (action === "quickStatus") {
      e.preventDefault();
      const status = btn.getAttribute("data-status");
      return quickStatus(id, status);
    }
  });

  // filtros opções
  loadSectorsFilter();
  loadRespFilter();

  loadTable();

  // se veio do chat com ?open=<ticketId>, abre detalhes automaticamente
  try {
    const params = new URLSearchParams(window.location.search);
    const openId = params.get("open");
    if (openId) setTimeout(() => openDetails(openId).catch(() => {}), 250);
  } catch {}
  if (window.lucide) window.lucide.createIcons();
})();
