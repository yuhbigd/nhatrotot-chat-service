const User = require("../models/userModel");
async function updateUserHandle(req, res) {
    try {
        const body = req.body;
        const userId = req.kauth.grant.access_token.content.sub;
        const isUserExist = await User.checkUser(userId);
        if (!isUserExist) {
            await User.createUser({
                _id: userId,
                image: body.image,
                lastName: body.lastName,
                firstName: body.firstName,
            });
        } else {
            await User.updateOne(
                {
                    _id: userId,
                },
                {
                    image: body.image,
                    lastName: body.lastName,
                    firstName: body.firstName,
                },
            );
        }
        res.status(200).send("ok");
    } catch (error) {
        res.status(400).send("error");
        console.log("error put image");
    }
}
module.exports = {
    updateUserHandle,
};
