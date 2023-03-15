const User = require("../models/userModel");

async function putImageController(req, res) {
    try {
        const image = req.body.image;
        const userId = req.kauth.grant.access_token.content.sub;
        const isUserExist = await User.checkUser(userId);
        if (!isUserExist) {
            await User.createUser({
                _id: userId,
                image,
            });
        } else {
            await User.updateOne(
                {
                    _id: userId,
                },
                {
                    image: image,
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
    putImageController,
};
