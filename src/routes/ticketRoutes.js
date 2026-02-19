const router = require("express").Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const ticketController = require("../controllers/ticketController");

router.use(authMiddleware);

// Listar / buscar / criar
router.get("/", ticketController.list);
router.get("/:id", ticketController.getById);
router.post("/", ticketController.create);

// Admin/Responsável (ainda assim controlado no controller)
router.put("/:id", ticketController.update);
router.patch("/:id/status", ticketController.updateStatus);
router.delete("/:id", ticketController.remove);

// Atualizações (chat) - USER também pode, desde que seja do ticket dele
router.post("/:id/updates", ticketController.addUpdate);

module.exports = router;
