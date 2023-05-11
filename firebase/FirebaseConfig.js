var admin = require("firebase-admin");

var serviceAccount = require("../firebase_key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
