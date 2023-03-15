const mongoose = require("mongoose");
require("dotenv").config();
const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
const chatWithSchema = new mongoose.Schema({
    info: {
        type: mongoose.Schema.Types.String,
        ref: "users",
        index: true,
    },
    message: {
        type: String,
    },
    unRead: {
        type: Number,
        default: 0,
    },
    lastTimeCommunicate: {
        type: Date,
        default: Date.now(),
    },
});
const userSchema = new mongoose.Schema({
    _id: { type: String },
    email: {
        type: String,
    },
    firstName: {
        type: String,
    },
    lastName: {
        type: String,
    },
    image: {
        type: String,
    },
    chatWith: [chatWithSchema],
    sockets: [String],
});
userSchema.statics.checkUser = async function (userId) {
    const user = await this.findOne({
        _id: userId,
    });
    if (!user) {
        return false;
    }
    return true;
};
userSchema.statics.createUser = async function createUser(user) {
    const userId = user._id;
    const response = await fetch(process.env.SERVER_URL + userId);
    const status = response.status;
    try {
        if (status === 200) {
            const userDetails = await response.json();
            if (!user.image) {
                user.image = userDetails.image;
            }
            user.email = userDetails.email;
            user.firstName = userDetails.firstName;
            user.lastName = userDetails.lastName;
            await this.create(user);
        } else {
            throw new Error("Error while creating user");
        }
    } catch (error) {
        console.log(error.message);
        return false;
    }
    return true;
};
const User = mongoose.model("users", userSchema);
module.exports = User;
