const mongoose = require("mongoose");
const notificationTokensSchema = new mongoose.Schema({
    deviceToken: {
        type: String,
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.String,
        ref: "users",
        index: true,
        required: true,
    },
});
const NotificationToken = mongoose.model(
    "notification-tokens",
    notificationTokensSchema,
);

module.exports = NotificationToken;
