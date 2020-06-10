"use strict";

import Constants from "./Constants.js";

import express from "express";
import stoppable from "stoppable";

import http from "http";
import https from "https";
import EventEmitter from "events";
import path from "path";

import Type from "../utility/Type.js";

const ServerDefaults = Constants.ServerDefaults;
const ServerConstants = {
    Events: {
        API_REQUEST: "apiRequest",
        STARTED: "ready",
        STOPPED: "destroy",
        ERROR: "error"
    },
    States: {
        CONSTRUCTED: "constructed",
        STARTING: "starting",
        RUNNING: "running",
        FAILED_WHEN_STARTING: "failed when starting"
    }
};
const privateValidator = Symbol();

class Server extends EventEmitter {

    constructor(options) {

        super();
        options = new ServerOptions(options);
        this.options = options;
        const grace = options.serverCloseTimeout;
        const States = ServerConstants.States;

        const errorEvent = ServerConstants.Events.ERROR;
        const addErrorEventListener = server => server.on(errorEvent, error => {
            if (this.state === States.STARTING) {
                this.state = States.FAILED_WHEN_STARTING
            }
            this.emit(errorEvent, error);
        });

        const httpOptions = options.httpOptions;
        const httpApp = Server.newApp();
        httpApp.use((request, response) => response.status(301).location(
            `https://${request.hostname.replace(/\:\d+$/, `:${options.httpsPort}`)}${request.originalUrl}`).end());
        this.httpServer = addErrorEventListener(stoppable(
            httpOptions ? http.createServer(httpOptions, httpApp) : http.createServer(httpApp), grace));

        const app = this.setupApp(privateValidator);
        this.expressApp = app;
        this.httpsServer = addErrorEventListener(stoppable(https.createServer(options.httpsOptions, app), grace));

        this.state = States.CONSTRUCTED;
    }

    start() {

        const currentState = this.state;
        const States = ServerConstants.States;
        if (currentState !== States.CONSTRUCTED) {
            throw new Error(`start is called but server is already ${currentState}`);
        }

        this.state = States.STARTING;
        const options = this.options;

        const getServerListenPromise = (server, port) =>
            new Promise(resolve => server.listen(port, () => {
                const address = server.address();
                resolve(console.log(`Server is listening${
                    address ? ` at IP ${address.address} on port ${address.port}` : ""}`));
            }));
        Promise.all([
            getServerListenPromise(this.httpServer, options.httpPort),
            getServerListenPromise(this.httpsServer, options.httpsPort)
        ]).then(() => {
            this.state = States.RUNNING;
            this.emit(ServerConstants.Events.STARTED);
        });
    }

    close() {

        const stateAtCloseInvoked = this.state;
        const States = ServerConstants.States;
        if (stateAtCloseInvoked === States.STARTING) {
            return Promise.reject(new Error(`Server can't be stopped while ${stateAtCloseInvoked}`));
        }
        if (stateAtCloseInvoked === States.CONSTRUCTED) {
            return Promise.resolve(0);
        }

        const preDestroyTime = Date.now();
        const getServerStopPromise = server =>
            new Promise((resolve, reject) => server.listening ?
                server.stop(error => error ? reject(error) : resolve()) : resolve());

        const errors = [];
        return getServerStopPromise(this.httpsServer).catch(error => errors.push(error))
            .then(() => getServerStopPromise(this.httpServer)).catch(error => errors.push(error))
            .then(() => {
                this.state = States.CONSTRUCTED;
                if (stateAtCloseInvoked !== States.FAILED_WHEN_STARTING) {
                    this.emit(ServerConstants.Events.STOPPED);
                }

                const numberOfErrors = errors.length;
                if (numberOfErrors) {
                    throw new Error(`${numberOfErrors} error(s) occured while stopping servers`);
                }
                return Date.now() - preDestroyTime;
            });
    }

    // Disable X-Powered-By header, as per Express's suggestion
    // https://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
    static newApp() {
        return express().disable("x-powered-by");
    }

    setupApp(_, expressApp) {

        if (_ !== privateValidator) {
            throw new Error("setupApp is private");
        }
        if (expressApp == null) {
            expressApp = Server.newApp();
        } else if (!Type.t(expressApp, "function")) {
            throw new TypeError("Incorrect type for setupApp arguments!");
        }

        return expressApp
            .all("/api", (request, response, next) =>
                this.emit(ServerConstants.Events.API_REQUEST, request, response, next))
            .get("/", (_, response) => response.redirect("./homepage.html"))
            .use(express.static(path.resolve("./client")));
    }

    static get Options() {
        return ServerOptions;
    }

    static get Events() {
        return ServerConstants.Events;
    }

    static get States() {
        return ServerConstants.States;
    }

    /**
     * @override
     */
    toString() {
        return super.toString().replace(/Object/g, this.constructor.name);
    }
}

class ServerOptions {

    constructor(options) {

        this.httpPort = ServerDefaults.PORT_HTTP;
        this.httpsPort = ServerDefaults.PORT_HTTPS;
        this.httpOptions = undefined;
        this.httpsOptions = undefined;
        this.serverCloseTimeout = ServerDefaults.CLOSE_TIMEOUT;

        if (options == null) {
            return;
        }

        const isValidPort = port => Number.isInteger(port) && port >= 0 && port <= 0xffff;

        const httpsPort = Type.unwrap(options.httpsPort);
        if (isValidPort(httpsPort)) {
            this.httpsPort = httpsPort;
        }
        let httpsOptions = options.httpsOptions;
        if (httpsOptions != null) {
            this.httpsOptions = httpsOptions;
        }

        httpsOptions = this.httpsOptions;
        if (!(httpsOptions && (httpsOptions.pfx || (httpsOptions.key && httpsOptions.cert)))) {
            console.error("Certificate chain and private key are not provided, server won't start successfully!");
        }

        const httpPort = Type.unwrap(options.httpPort);
        if (isValidPort(httpPort) && this.httpsPort !== httpPort) {
            this.httpPort = httpPort;
        }
        const httpOptions = options.httpOptions;
        if (httpOptions != null) {
            this.httpOptions = httpOptions;
        }

        const serverCloseTimeout = Type.unwrap(options.serverCloseTimeout);
        if ((Number.isInteger(serverCloseTimeout) && serverCloseTimeout >= 0) ||
            serverCloseTimeout === Number.POSITIVE_INFINITY) {
            this.serverCloseTimeout = serverCloseTimeout;
        }
    }

    /**
     * @override
     */
    toString() {
        return super.toString().replace(/Object/g, this.constructor.name);
    }
}

export default Server;
