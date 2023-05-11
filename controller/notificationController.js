const {
    updateToken,
    removeToken,
} = require("../firebase/fcm/fcmCore");
const updateUserToken = async (req, res) => {
    const userId = req.kauth.grant.access_token.content.sub;
    const token = req.body.token;
    if (!token) {
        return res.status(404).json({ message: "token not found" });
    }
    try {
        await updateToken(token, userId);
    } catch (error) {
        return res.status(404).json({ message: "error" });
    }
    res.status(200).json({
        message: "done",
    });
};
const removeUserToken = async (req, res) => {
    const userId = req.kauth.grant.access_token.content.sub;
    const token = req.body.token;
    if (!token) {
        return res.status(404).json({ message: "token not found" });
    }
    try {
        await removeToken(token, userId);
    } catch (error) {
        return res.status(404).json({ message: "error" });
    }
    res.status(200).json({
        message: "done",
    });
};
module.exports = {
    updateUserToken,
    removeUserToken,
};
