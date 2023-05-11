const Chat = require("../models/chatModel");
const User = require("../models/userModel");
const {
    generateMessage,
    sendNotificationToUser,
} = require("../firebase/fcm/fcmCore");
require("dotenv").config();

async function getTotalUnread(id) {
    const userTotalUnread = await User.aggregate([
        { $match: { _id: id } },
        {
            $unwind: "$chatWith",
        },
        {
            $group: {
                _id: id,
                totalUnread: { $sum: "$chatWith.unRead" },
            },
        },
        {
            $project: {
                totalUnread: 1,
            },
        },
    ]);
    if (userTotalUnread[0]) {
        return userTotalUnread[0].totalUnread;
    }
    return 0;
}
async function pushNewChatWith(fromId, toId, message, value) {
    const user = await User.findOneAndUpdate(
        {
            _id: fromId,
        },
        {
            $push: {
                chatWith: {
                    info: toId,
                    message: message,
                    unRead: value,
                },
            },
        },
        { upsert: true, new: true },
    );
    return user;
}
module.exports = (io, socket) => {
    socket.on("FE_send_message", async (message) => {
        try {
            const fromId = socket.userDetails.sub;
            const socketId = socket.id;
            const toId = message.to;
            if (!toId || !message.body || toId == fromId) {
                throw new Error("message request format is incorrect");
            }
            let roomId = "";
            let order = fromId.localeCompare(toId);
            if (order < 0) {
                roomId = fromId + "_" + toId;
            } else {
                roomId = toId + "_" + fromId;
            }
            const isToUserExisted = await User.checkUser(toId);
            if (!isToUserExisted) {
                const isCreatedSuccess = await User.createUser({
                    _id: toId,
                    chatWith: {
                        info: fromId,
                        message: message.body,
                        unRead: 0,
                    },
                });
                if (!isCreatedSuccess) {
                    socket.emit("error", "user id is incorrect");
                    return;
                }
            }
            //send to every socket outside box chat, update chat with
            let fromUser = await User.findOne({
                _id: fromId,
                "chatWith.info": toId,
            });
            if (fromUser == null) {
                fromUser = await pushNewChatWith(fromId, toId, message.body, 0);
            } else {
                fromUser = await User.findOneAndUpdate(
                    {
                        _id: fromId,
                        "chatWith.info": toId,
                    },
                    {
                        $set: {
                            "chatWith.$.message": message.body,
                            "chatWith.$.lastTimeCommunicate": Date.now(),
                            "chatWith.$.unRead": 0,
                        },
                    },
                    { upsert: true, new: true },
                );
            }
            let toUser = await User.findOne({
                _id: toId,
                "chatWith.info": fromId,
            });
            if (toUser == null) {
                toUser = await pushNewChatWith(toId, fromId, message.body, 1);
            } else {
                toUser = await User.findOneAndUpdate(
                    {
                        _id: toId,
                        "chatWith.info": fromId,
                    },
                    {
                        $set: {
                            "chatWith.$.message": message.body,
                            "chatWith.$.lastTimeCommunicate": Date.now(),
                        },
                        $inc: {
                            "chatWith.$.unRead": 1,
                        },
                    },
                    { upsert: true, new: true },
                );
            }

            let chat = await Chat.create({
                body: message.body,
                from: fromId,
                to: toId,
                roomId: roomId,
            });
            chat = chat.toJSON();
            let chatWithUserData = {
                ...chat,
                to: {
                    _id: chat.to,
                    image: toUser.image,
                    lastName: toUser.lastName,
                    firstName: toUser.firstName,
                },
                from: {
                    _id: chat.from,
                    image: fromUser.image,
                    lastName: fromUser.lastName,
                    firstName: fromUser.firstName,
                },
            };
            // send total and detail chat when user in another page
            // inside chat page so if received this push new message to first of the bar
            const fromTotalUnread = await getTotalUnread(fromId);
            const toTotalUnread = await getTotalUnread(toId);
            for (const socket of fromUser.sockets) {
                if (socketId != socket) {
                    io.to(socket).emit("FE_receive_message", {
                        totalUnreadWithUser: 0,
                        totalUnread: fromTotalUnread,
                        chat: chatWithUserData,
                    });
                }
            }
            let totalUnreadWithFromUser = toUser.chatWith.find(
                (u) => u.info == fromId,
            ).unRead;
            totalUnreadWithFromUser = totalUnreadWithFromUser
                ? totalUnreadWithFromUser
                : 1;
            for (const socket of toUser.sockets) {
                io.to(socket).emit("FE_receive_message", {
                    totalUnreadWithUser: totalUnreadWithFromUser,
                    totalUnread: toTotalUnread,
                    chat: chatWithUserData,
                });
            }
            const notificationMessage = generateMessage();
            notificationMessage.data.body = chat.body;
            notificationMessage.data.fromFirstName = fromUser.firstName;
            notificationMessage.data.fromLastName = fromUser.lastName;
            notificationMessage.data.fromId = fromId;
            await sendNotificationToUser(notificationMessage, toId);
        } catch (error) {
            console.log(error);
            socket.emit("error", "internal error. Cannot send message");
        }
    });
    socket.on("FE_get_total_unread", async () => {
        try {
            const userId = socket.userDetails.sub;
            const totalUnread = await getTotalUnread(userId);
            socket.emit("FE_receive_total_unread", totalUnread);
        } catch (error) {
            socket.emit("error", "internal error. Cannot get total unread");
        }
    });
    socket.on("FE_reset_unread", async ({ withId }) => {
        try {
            if (withId) {
                const userId = socket.userDetails.sub;
                const isChatWithBefore = await User.findOne({
                    _id: userId,
                    "chatWith.info": withId,
                });
                if (isChatWithBefore) {
                    await User.updateOne(
                        {
                            _id: userId,
                            "chatWith.info": withId,
                        },
                        {
                            $set: {
                                "chatWith.$.unRead": 0,
                            },
                        },
                        { upsert: true, new: true },
                    );
                }
                const totalUnread = await getTotalUnread(userId);
                socket.emit("FE_reset_unread_done", totalUnread);
            }
        } catch (error) {
            socket.emit("error", "internal error. Cannot reset unread");
        }
    });
    socket.on("FE_reset_unread_all", async () => {
        try {
            const userId = socket.userDetails.sub;
            await User.updateOne(
                {
                    _id: userId,
                },
                { $set: { "chatWith.$[].unRead": 0 } },
            );
            socket.emit("FE_reset_unread_all_done", 0);
        } catch (error) {
            socket.emit("error", "internal error. Cannot reset all unread");
        }
    });

    socket.on("FE_get_chat_with", async ({ skip = 0, size = 20 }) => {
        try {
            const userId = socket.userDetails.sub;
            const user = await User.aggregate([
                {
                    $match: { _id: userId },
                },
                {
                    $unwind: "$chatWith",
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "chatWith.info",
                        foreignField: "_id",
                        as: "chatWith.info",
                    },
                },
                {
                    $unwind: "$chatWith.info",
                },
                {
                    $skip: skip,
                },
                {
                    $limit: size,
                },
                {
                    $sort: { "chatWith.lastTimeCommunicate": -1 },
                },
                {
                    $project: {
                        chatWith: {
                            info: {
                                chatWith: 0,
                                sockets: 0,
                                email: 0,
                            },
                        },
                    },
                },
                {
                    $group: {
                        _id: userId,
                        chatWith: {
                            $push: "$chatWith",
                        },
                    },
                },
            ]);
            socket.emit("FE_receive_chat_with", user[0]);
        } catch (error) {
            socket.emit("error", "internal error. Cannot get chat with");
        }
    });
    socket.on(
        "FE_get_chat_history",
        async ({ withId, skip = 0, size = 20 }) => {
            try {
                const fromId = socket.userDetails.sub;
                let roomId = "";
                let order = fromId.localeCompare(withId);
                if (order < 0) {
                    roomId = fromId + "_" + withId;
                } else {
                    roomId = withId + "_" + fromId;
                }
                const messages = await Chat.find({ roomId })
                    .populate("from", "_id image lastName firstName")
                    .populate("to", "_id image lastName firstName")
                    .sort({ createAt: -1 })
                    .skip(skip)
                    .limit(size)
                    .select({
                        _id: 0,
                        roomId: 0,
                    });
                socket.emit("FE_receive_history_chat", {
                    messages,
                });
            } catch (error) {
                socket.emit("error", "internal error. Cannot get chat history");
            }
        },
    );
};
