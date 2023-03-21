const { result, sortedUniq } = require("lodash");
const User = require("../models/userModel");
const mongoose = require("mongoose");
require("dotenv").config();
const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
function emitError(socket, message) {
    socket.emit("error", {
        error: message,
    });
}
module.exports = async (io, socket) => {
    const userId = socket.userDetails.sub;
    const isUserExisted = await User.checkUser(userId);
    if (!isUserExisted) {
        try {
            await User.createUser({
                _id: userId,
                sockets: [socket.id],
            });
        } catch (error) {
            console.log(error.message);
            emitError(socket, error.message);
            socket.disconnect(true);
        }
    } else {
        try {
            await User.updateOne(
                {
                    _id: userId,
                },
                {
                    $push: {
                        sockets: socket.id,
                    },
                },
            );
        } catch (e) {
            emitError(socket, error.message);
            socket.disconnect(true);
        }
    }
    socket.on("disconnect", async () => {
        try {
            await User.updateOne(
                {
                    _id: userId,
                },
                {
                    $pull: { sockets: socket.id },
                },
            );
        } catch (e) {
            emitError(error.message);
            socket.disconnect(true);
        }
    });
};
