const mongoose = require("mongoose");
const { TICKET_STATUS, TICKET_PRIORITIES } = require("../utils/validators");

const updateSchema = new mongoose.Schema(
  {
    autor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    mensagem: { type: String, required: true, trim: true },
    anexo: { type: String, default: null }
  },
  { timestamps: true }
);

const ticketSchema = new mongoose.Schema(
  {
    titulo: { type: String, required: true, trim: true },
    descricao: { type: String, required: true, trim: true },
    prioridade: { type: String, enum: TICKET_PRIORITIES, default: "Média" },
    urgente: { type: Boolean, default: false },
    status: { type: String, enum: TICKET_STATUS, default: "Pendente" },

    dataInicio: { type: Date, required: true },
    dataFim: { type: Date, required: true },

    solicitante: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    responsavel: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    setor: { type: mongoose.Schema.Types.ObjectId, ref: "Sector", required: true },

    atualizacoes: [updateSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema);
