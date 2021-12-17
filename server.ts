import config from "./config.json";
import express from "express";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { Schema, model, connect } from "mongoose";

/////////////////////// DATABASE ///////////////////////

interface Authenticator {
    credentialID: Buffer;
    credentialPublicKey: Buffer;
    counter: number;
    transports?: AuthenticatorTransport[];
};

const AuthenticatorSchema = new Schema<Authenticator>({
    credentialID: { type: Buffer, required: true },
    credentialPublicKey: { type: Buffer, required: true },
    counter: { type: Number, required: true },
    transports: { type: [] }
});

const AuthenticatorModel = model<Authenticator>("Authenticator", AuthenticatorSchema);

interface User {
    id: string;
    userName: string;
    displayName?: string;
    currentChallenge?: string;
    authenticator?: Authenticator;
};

const UserSchema = new Schema<User>({
    id: { type: String, required: true },
    userName: { type: String, required: true },
    displayName: { type: String },
    currentChallenge: { type: String },
    authenticator: { type: AuthenticatorSchema }
});

const UserModel = model<User>("User", UserSchema);

/////////////////////// TYPES ///////////////////////

/////////////////////// INIT ///////////////////////

const rpName = config.rpName;
const rpId = config.rpId;
const origin = `https://${rpId}`;

const app = express();
app.use(express.json());

init().catch((err) => {
    console.error("init() EXCEPTION:");
    console.error(err);
});
async function init(): Promise<void> {
    console.log("Connecting to MongoDB...");
    await connect("mongodb://localhost:27017/webauthn");
    console.log("...connected!");
}

/////////////////////// ROUTES ///////////////////////

app.get("/", (req, res) => {
    res.status(200).sendFile("./index.html", { root: __dirname });
});


app.get("/index.js", (req, res) => {
    res.status(200).sendFile("./index.js", { root: __dirname });
});


app.get("/index.umd.min.js", (req, res) => {
    res.status(200).sendFile("./index.umd.min.js", { root: __dirname });
});


app.get("/users", async (req, res) => {
    console.log("/users");
    const users = await UserModel.find();
    console.log("users:");
    console.log(users);
    res.status(200).send(users);
});


app.get("/auths", async (req, res) => {
    console.log("/auths");
    const auths = await AuthenticatorModel.find();
    console.log("auths:");
    console.log(auths);
    res.status(200).send(auths);
});


app.post("/register/options", async (req, res) => {
    console.log("/register/options");
    let statusCode = 200;
    let output;
    try {
        output = generateRegistrationOptions({
            "rpName": rpName,
            "rpID": rpId,
            "userID": req.body.userId,
            "userName": req.body.userName,
            "userDisplayName": req.body.displayName,
            "attestationType": "direct"
        });
        let user = await UserModel.findOne({ id: req.body.userId });
        if (user === null) {
            user = new UserModel({ 
                "id": req.body.userId,
                "userName": req.body.userName,
                "displayName": req.body.displayName,
                "currentChallenge": output.challenge
            });
        } else {
            user.userName = req.body.userName;
            user.displayName = req.body.displayName;
            user.currentChallenge = output.challenge;
        }
        user.save();
    } catch (exc) {
        statusCode = 500;
        output = { "message": exc };
        console.error("/register/options EXCEPTION:");
        console.error(exc);
    }
    res.status(statusCode).send(output);
});


app.post("/register/verify/:userId", async (req, res) => {
    console.log("/register/verify/:userId");
    let statusCode = 200;
    let output;
    try {
        const userId = req.params.userId;
        let user = await UserModel.findOne({ id: userId });
        if (user === null) {
            throw "User not found";
        }
        const challenge = user.currentChallenge || "";
        let verification = await verifyRegistrationResponse({
            credential: req.body,
            expectedChallenge: challenge,
            expectedOrigin: origin,
            expectedRPID: rpId
        });

        const { verified } = verification;
        let registrationInfo = verification.registrationInfo ?? {
            credentialID: null,
            credentialPublicKey: null,
            counter: null
        };

        const auth = new AuthenticatorModel({
            credentialID: registrationInfo.credentialID,
            credentialPublicKey: registrationInfo.credentialPublicKey,
            counter: registrationInfo.counter
        });
        auth.save();
        user.authenticator = auth;
        user.save();
        output = { verified };
    } catch (exc) {
        statusCode = 500;
        output = { "message": exc };
        console.error("/register/verify EXCEPTION:");
        console.error(exc);
    }
    res.status(statusCode).send(output);
});


app.get("/auth/options/:userId", async (req, res) => {
    console.log("/auth/options/:userId");
    let statusCode = 200;
    let output;
    try {
        let user = await UserModel.findOne({ id: req.params.userId });
        if (user === null) {
            throw "User not found";
        }
        let authenticator = await AuthenticatorModel.findOne({ credentialID: user.authenticator?.credentialID });
        if (authenticator === null) {
            throw "No valid authenticator for user";
        }
        output = generateAuthenticationOptions({
            allowCredentials: [{
                id: authenticator.credentialID,
                type: "public-key"
            }],
            userVerification: "preferred"
        });
        user.currentChallenge = output.challenge;
        user.save();
    } catch (exc) {
        statusCode = 500;
        output = { "message": exc };
        console.error("/register/verify EXCEPTION:");
        console.error(exc);
    }
    res.status(statusCode).send(output);
});


app.post("/auth/verify/:userId", async (req, res) => {
    console.log("/auth/verify/:userId");
    let statusCode = 200;
    let output;
    try {
        let user = await UserModel.findOne({ id: req.params.userId });
        if (user === null) {
            throw "User not found";
        }
        let authenticator = await AuthenticatorModel.findOne({ credentialID: user.authenticator?.credentialID });
        if (authenticator === null) {
            throw "No valid authenticator for user";
        }
        const verification = await verifyAuthenticationResponse({
            credential: req.body,
            expectedChallenge: user.currentChallenge || "",
            expectedOrigin: origin,
            expectedRPID: rpId,
            authenticator
        });
        const { verified, authenticationInfo } = verification;
        const { newCounter } = authenticationInfo;
        if (verified) {
            authenticator.counter = newCounter;
            authenticator.save();
        }
        output = { verified };
    } catch (exc) {
        statusCode = 500;
        output = { "message": exc };
        console.error("/register/verify EXCEPTION:");
        console.error(exc);
    }
    res.status(statusCode).send(output);
});

/////////////////////// MAIN ///////////////////////

app.listen(config.port, () => {
    console.log(`mt-webauthn-simple server is running at localhost:${config.port}`);
});
