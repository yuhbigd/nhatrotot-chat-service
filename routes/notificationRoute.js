const { Router } = require("express");
const {
    updateUserToken,
    removeUserToken,
} = require("../controller/notificationController");
const router = Router();
router.post("/notification", updateUserToken);
router.delete("/notification", removeUserToken);
module.exports = { router };
