const admin = require("firebase-admin");
const NotificationToken = require("../../models/notifcationTokenModel");
// update token to new User
const updateToken = async (token, userId) => {
    if (token.length === 0) {
        return;
    }
    const tokenInDb = await NotificationToken.findOne({
        deviceToken: token,
    });
    if (tokenInDb) {
        if (userId !== tokenInDb.userId) {
            await NotificationToken.findOneAndUpdate(tokenInDb, {
                userId,
            });
        } else {
            return;
        }
    } else {
        await NotificationToken.create({
            userId,
            deviceToken: token,
        });
    }
};
// remove when logout or token is staled
const removeToken = async (token, userId) => {
    await NotificationToken.findOneAndRemove({
        userId,
        deviceToken: token,
    });
};

const getTokens = async (userId) => {
    const notiTokens = await NotificationToken.find({ userId });
    const tokens = [];
    notiTokens.forEach((notiToken) => {
        tokens.push(notiToken.deviceToken);
    });
    return tokens;
};

const generateMessage = () => {
    return {
        notification: {},
        data: {},
        android: {},
        apns: {},
        webpush: {},
        tokens: [],
    };
};
const chunkArray = (array, size) => {
    return array.reduce((arr, item, idx) => {
        return idx % size === 0
            ? [...arr, [item]]
            : [...arr.slice(0, -1), [...arr.slice(-1)[0], item]];
    }, []);
};
const sendNotificationToUser = async (message, userId) => {
    try {
        const userTokens = await getTokens(userId);
        // firebase can only send to 500 devices in one rq
        const tokenArrayChunks = chunkArray(userTokens, 500);
        const multicastPromises = [];
        const multicastPromise = async (tokens) => {
            message.tokens = tokens;
            const response = await admin
                .messaging()
                .sendEachForMulticast(message);
            const failedTokens = [];
            response.responses.forEach((resp, index) => {
                if (resp.success) return;
                const failedToken = tokens[index];
                failedTokens.push(failedToken);
            });
            await NotificationToken.deleteMany({
                deviceToken: { $in: failedTokens },
            });
        };
        tokenArrayChunks.forEach((chunk) =>
            multicastPromises.push(multicastPromise(chunk)),
        );
        await Promise.all(multicastPromises);
    } catch (error) {
        console.log(error);
    }
};
module.exports = {
    updateToken,
    removeToken,
    getTokens,
    generateMessage,
    sendNotificationToUser,
};
