const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const ticketService = require("../services/ticketService");

function isAdmin(user) {
    return user?.role === "ADMIN";
}
function isUser(user) {
    return user?.role === "USER";
}
function isResponsavel(user) {
    return user?.role === "RESPONSAVEL";
}

const list = asyncHandler(async (req, res) => {
    const me = req.user;

    // ADMIN: lista tudo com filtros normais
    if (isAdmin(me)) {
        const data = await ticketService.list(req.query);
        return res.json(data);
    }

    // USER: lista somente os próprios
    if (isUser(me)) {
        const data = await ticketService.listBySolicitante(me._id, req.query);
        return res.json(data);
    }

    // RESPONSAVEL: lista somente atribuídos a ele
    if (isResponsavel(me)) {
        const data = await ticketService.listByResponsavel(me._id, req.query);
        return res.json(data);
    }

    throw new HttpError(403, "Permissão insuficiente");
});

const getById = asyncHandler(async (req, res) => {
    const me = req.user;
    const t = await ticketService.getById(req.params.id);

    if (isAdmin(me)) return res.json(t);

    // USER pode ver se for solicitante
    if (isUser(me) && String(t.solicitante?._id || t.solicitante) === String(me._id)) {
        return res.json(t);
    }

    // RESPONSAVEL pode ver se for responsável
    if (isResponsavel(me) && String(t.responsavel?._id || t.responsavel) === String(me._id)) {
        return res.json(t);
    }

    throw new HttpError(403, "Você não tem acesso a esse chamado");
});

const create = asyncHandler(async (req, res) => {
    const me = req.user;
    const payload = req.body || {};

    // ✅ USER: solicitante e responsável = ele mesmo
    if (me.role === "USER") {
        payload.solicitante = me._id;
        payload.responsavel = me._id;

        if (!payload.dataInicio) payload.dataInicio = new Date().toISOString().slice(0, 10);
        if (!payload.status) payload.status = "Pendente";

        const created = await ticketService.create(payload);
        return res.status(201).json(created);
    }

    // ADMIN: pode criar como quiser
    if (me.role === "ADMIN") {
        if (!payload.solicitante) payload.solicitante = me._id;
        if (!payload.responsavel) payload.responsavel = me._id; // opcional: padrão
        const created = await ticketService.create(payload);
        return res.status(201).json(created);
    }

    // RESPONSAVEL por enquanto não cria
    throw new HttpError(403, "Somente USER ou ADMIN pode abrir chamado nesta fase");
});


const update = asyncHandler(async (req, res) => {
    const me = req.user;

    // Somente ADMIN por enquanto
    if (!isAdmin(me)) throw new HttpError(403, "Somente ADMIN pode editar chamados nesta fase");

    const updated = await ticketService.update(req.params.id, req.body || {});
    res.json(updated);
});

const updateStatus = asyncHandler(async (req, res) => {
    const me = req.user;
    const { status } = req.body || {};
    if (!status) throw new HttpError(400, "Informe o status");

    // ADMIN (e opcional: RESPONSAVEL)
    if (!isAdmin(me) && !isResponsavel(me)) {
        throw new HttpError(403, "Você não pode alterar status nesta fase");
    }

    // se RESPONSAVEL, só pode alterar se o ticket for dele
    if (isResponsavel(me)) {
        const t = await ticketService.getById(req.params.id);
        const isMine = String(t.responsavel?._id || t.responsavel) === String(me._id);
        if (!isMine) throw new HttpError(403, "Você não pode alterar status desse chamado");
    }

    const updated = await ticketService.updateStatus(req.params.id, status);
    res.json(updated);
});

const remove = asyncHandler(async (req, res) => {
    const me = req.user;
    if (!isAdmin(me)) throw new HttpError(403, "Somente ADMIN pode excluir chamados");
    await ticketService.remove(req.params.id);
    res.status(204).send();
});

const addUpdate = asyncHandler(async (req, res) => {
    const me = req.user;
    const { mensagem, anexo } = req.body || {};
    if (!mensagem) throw new HttpError(400, "Informe a mensagem");

    // precisa ter acesso ao ticket para comentar
    const t = await ticketService.getById(req.params.id);

    if (isAdmin(me)) {
        const updated = await ticketService.addUpdate(req.params.id, { autor: me._id, mensagem, anexo: anexo || null });
        return res.json(updated);
    }

    if (isUser(me)) {
        const isMine = String(t.solicitante?._id || t.solicitante) === String(me._id);
        if (!isMine) throw new HttpError(403, "Você não pode comentar nesse chamado");
        const updated = await ticketService.addUpdate(req.params.id, { autor: me._id, mensagem, anexo: anexo || null });
        return res.json(updated);
    }

    if (isResponsavel(me)) {
        const isMine = String(t.responsavel?._id || t.responsavel) === String(me._id);
        if (!isMine) throw new HttpError(403, "Você não pode comentar nesse chamado");
        const updated = await ticketService.addUpdate(req.params.id, { autor: me._id, mensagem, anexo: anexo || null });
        return res.json(updated);
    }

    throw new HttpError(403, "Permissão insuficiente");
});

module.exports = { list, getById, create, update, updateStatus, remove, addUpdate };
