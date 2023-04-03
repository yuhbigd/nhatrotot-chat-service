const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const fs = require("fs");
const mongoose = require("mongoose");
const ClientConnectHandle = require("./handlers/ClientConnectHandle");
const ChatHandle = require("./handlers/ChatHandle");
require("dotenv").config();

const session = require("express-session");
const Keycloak = require("keycloak-connect");
const { updateUserHandle } = require("./controller/updateUserController");

const kcConfig = {
    clientId: process.env.KEYCLOAK_CLIENID,
    bearerOnly: true,
    serverUrl: process.env.KEYCLOAK_URL,
    realm: process.env.KEYCLOAK_REALM,
    realmPublicKey: process.env.KEYCLOAK_KEY,
};

const memoryStore = new session.MemoryStore();
const keycloak = new Keycloak({ store: memoryStore }, kcConfig);
app.use(
    session({
        secret: "ssssss123444",
        resave: false,
        saveUninitialized: true,
        store: memoryStore,
    }),
);
app.use(express.json());
app.set("trust proxy", true);
app.use(keycloak.middleware());

const server = require("http").createServer(app);
const io = require("socket.io")(server);
const publicKey = fs.readFileSync("./key.pem");
mongoose
    .connect(process.env.MONGO_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then((result) => {
        console.log("db OK");
        return result;
    })
    .catch((err) => console.log(err));
io.use(function (socket, next) {
    if (!socket.handshake.auth.token) {
        return next(new Error("Authentication error"));
    }
    const token = socket.handshake.auth.token;
    jwt.verify(token, publicKey, { algorithms: ["RS256"] }, (err, decoded) => {
        if (err) {
            next(new Error("Authentication error"));
        } else {
            socket.userDetails = decoded;
            next();
        }
    });
});
io.on("connection", (socket) => {
    try {
        ClientConnectHandle(io, socket).then(() => {
            ChatHandle(io, socket);
        });
    } catch (error) {
        console.log(error.message);
    }
});
app.put("/user", keycloak.protect(), updateUserHandle);
app.get("/test-connect", (req, res) => {
    res.send("okla");
});
app.get("/test-protect", keycloak.protect(), (req, res) => {
    res.send("okla");
});
server.listen(4444, () => {
    console.log("server is listen on port 4444");
});
