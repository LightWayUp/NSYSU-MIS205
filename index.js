"use strict";

import Server from "./server/Server.js";
import Database from "./server/Database.js";
import ApiRoutes from "./server/Logic.js";
import Constants from "./server/Constants.js";
import CryptoUtilities from "./utility/CryptoUtilities.js";

import fs from "fs";
import path from "path";

import Type from "./utility/Type.js";
import credentials from "./credentials.js";

const ServerEvents = Server.Events;
const ExitCodes = Constants.ExitCodes;
const Binaries = Constants.Binaries;

const binariesDirectoryPath = path.join(Binaries.DIRECTORY_PATH, ".");
const binaryPaths = new Map(Array.from(new Map()
    .set("privateKey", Binaries.PRIVATE_KEY)
    .set("publicKey", Binaries.PUBLIC_KEY)
    .set("certificate", Binaries.CERTIFICATE))
    .map(pair => [pair[0], path.join(binariesDirectoryPath, pair[1])]));
const certAndKeyPairs = {};
let shouldGenerate = false;

binaryPaths.forEach((binaryPath, propertyKey) => {
    try {
        certAndKeyPairs[propertyKey] = fs.readFileSync(binaryPath, "utf8");
    } catch (error) {
        shouldGenerate = true
        console.warn(`Unable to read ${propertyKey}`);
    }
});

if (shouldGenerate) {
    console.log(`New certificate chain and keys will be created for starting server with TLS/SSL protocol support, and for use with JSON Web Token.`);
    try {
        fs.mkdirSync(binariesDirectoryPath, { recursive: true });
        const generated = CryptoUtilities.generateCertAndKeyPairSync(credentials.CERTIFICATE_ATTRIBUTES);
        binaryPaths.forEach((binaryPath, propertyKey) => fs.writeFileSync(binaryPath, generated[propertyKey]));
        Object.assign(certAndKeyPairs, generated);
    } catch (error) {
        console.error(`Unable to generate or save certificate chain and keys!\n\n${error.stack}`);
    }
}

const httpsOptionsMap = new Map().set("key", certAndKeyPairs.privateKey)
    .set("cert", certAndKeyPairs.certificate);
const httpsOptions = Array.from(httpsOptionsMap.values()).some(value => value == null) ?
    undefined : Object.fromEntries(httpsOptionsMap);

const server = new Server(httpsOptions ? { httpsOptions } : undefined)
    .on(ServerEvents.ERROR, error => {
        console.error(error);
        exit(error.code === "EADDRINUSE" ? ExitCodes.SERVER_START_FAILURE : ExitCodes.GENERIC_ERROR);
    });

process.on("uncaughtException", error => {
    console.error(error);
    exit(ExitCodes.GENERIC_ERROR);
}).on("unhandledRejection", console.error);

["SIGHUP", "SIGINT", "SIGTERM", "SIGBREAK"]
.forEach(signal => process.on(signal, () => exit()));

server.on(ServerEvents.STARTED, () => {
    console.log("Server has started!");
    ApiRoutes.setup(certAndKeyPairs, server.expressApp);
}).on(ServerEvents.API_REQUEST, (request, response, next) => next()).start();

function exit(exitCode) {

    exitCode = Type.unwrap(exitCode);
    if (!(Type.t(exitCode, "number") || exitCode == null)) {
        throw new TypeError("Incorrect type for exit argument!");
    }

    if (exitCode == null) {
        exitCode = 0;
    } else if (!Number.isInteger(exitCode)) {
        throw new RangeError("exitCode must be an integer!");
    }

    if (process.env.EXITING) {
        return console.log("exit is called but it was already called previously.");
    }

    process.env.EXITING = "true";
    console.log(`exit is called with exit code ${exitCode}`);

    server.close().then(time => console.log(`Closing server took ${time}ms`))
    .finally(() => Database.closeDatabase().then(() => console.log("Database closed")))
    .catch(error => {
        console.error(error);
        console.warn("Forcibly exiting");
        process.exit(exitCode);
    });

    console.log("About to set process exit code, process will exit when no more tasks are pending.");
    process.exitCode = exitCode;
}

// TODO Add more logging everywhere
