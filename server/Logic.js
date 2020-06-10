"use strict";

import Database from "./Database.js";
import Constants from "./Constants.js";

import express from "express";
import jwt from "jsonwebtoken";
import { v4 as uuidV4 } from "uuid";

import crypto from "crypto";
import http from "http";

import Type from "../utility/Type.js";

const BAD_REQUEST_PARAMETERS = "Bad request parameters";
const JsonWebTokenConstants = Constants.JsonWebToken;
let keyPairs;

function setup(providedKeyPairs, expressApp) {

    if (!Type.t(expressApp, "function")) {
        throw new TypeError("Incorrect type for setup arguments!");
    }
    if (!(providedKeyPairs.privateKey && providedKeyPairs.publicKey)) {
        console.error("Trying to set up routing without keys, authentication flow will fail!");
    }

    keyPairs = providedKeyPairs;

    return expressApp.use("/api", apiRouter());
}

/* !-- Router creations -- */

function apiRouter() {

    return express.Router()

        .use(express.json())
        .use((request, response, next) =>
            (["POST", "PUT", "PATCH"].some(method => method === request.method) &&
            !/^application\/([-A-Za-z0-9!#$&^_]+\+)?json(;.+)?$/.test(request.get("Content-Type"))) ?
                respondError(response, "Content-Type must be application/json or its variants", 415) : next())

        .use("/token", tokenRouter())
        .use("/users", usersRouter())
        .use("/posts", postsRouter());
}

function tokenRouter() {

    const sign = (request, response) => {
        try {
            const payload = {};
            response.json({
                token: jwt.sign(payload, keyPairs.privateKey, {
                    algorithm: JsonWebTokenConstants.ALGORITHM,
                    expiresIn: JsonWebTokenConstants.MAX_AGE,
                    issuer: JsonWebTokenConstants.ISSUER,
                    subject: response.locals.userId,
                    mutatePayload: true
                }),
                expiration: payload.exp * 1000
            });
        } catch (error) {
            internalServerError(response, error);
        }
    };

    return express.Router()

        .post("/new", (request, response) => {
            const userCredentials = request.body;
            const email = userCredentials.email;
            const password = userCredentials.password;
            [email, password].every(property => Type.t(property, "string")) ?

                doWithDatabase(response, database =>
                    database.get(Database.formatQuery(`
                        SELECT id, password
                        FROM "User"
                        WHERE email=? AND verificationCode IS NULL
                    `), email.trim()).then(row => {
                        if (!row) {
                            return notFound(response);
                        }
                        const id = row.id;
                        if (row.password !== passwordToHashedString(password.trim(), id)) {
                            return forbidden(response, "Incorrect credentials");
                        }
                        response.locals.userId = id;
                        sign(request, response);
                    }, error => internalServerError(response, error))) :

                badRequest(response, BAD_REQUEST_PARAMETERS);

        }).get("/refresh", authenticate, sign);
}

function usersRouter() {

    return express.Router()
        .use("/self", usersSelfRouter())

        .post("/new", (request, response) => {
            const normalized = normalizeUserModifiableContent(request.body);
            normalized ?

                doWithDatabase(response, database => {
                    const email = normalized.email;
                    database.get(Database.formatQuery(`
                        SELECT COUNT(*)
                        FROM "User"
                        WHERE email=?
                    `), email).then(count => {
                        if (Object.values(count)[0]) {
                            return respondError(response, "User with the same email address already exists", 409);
                        }

                        const id = uuidV4();
                        const name = normalized.name;
                        const displayName = normalized.displayName;
                        const gender = normalized.gender;
                        const department = normalized.department;
                        return database.run(Database.formatQuery(`
                                INSERT INTO "User"
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            `),
                            id,
                            name,
                            displayName,
                            gender,
                            department,
                            email,
                            passwordToHashedString(normalized.password, id),
                            (Math.floor(Math.random() * 900000) + 100000).toString()).then(() => {
                                response.status(201).json({
                                    id,
                                    name,
                                    displayName,
                                    gender,
                                    department
                                });
                                sendVerification(email);
                            });
                    }).catch(error => internalServerError(response, error));

                }) : badRequest(response, BAD_REQUEST_PARAMETERS);

        }).post("/verify", (request, response) => {
            const userCredentials = request.body;
            let email = userCredentials.email;
            const verificationCode = userCredentials.verificationCode;
            if (![email, verificationCode].every(property => Type.t(property, "string"))) {
                return badRequest(response, BAD_REQUEST_PARAMETERS);
            }

            email = email.trim();
            doWithDatabase(response, database =>
                database.get(Database.formatQuery(`
                    SELECT verificationCode
                    FROM "User"
                    WHERE email=?
                `), email).then(row => {
                    if (!row) {
                        return notFound(response);
                    }
                    const storedVerificationCode = row.verificationCode;
                    if (storedVerificationCode === null) {
                        return response.json({});
                    }
                    return storedVerificationCode === verificationCode.trim() ?
                        database.run(Database.formatQuery(`
                            UPDATE "User"
                            SET verificationCode=?
                            WHERE email=?
                        `), null, email).then(() => response.json({})) :
                        forbidden(response, "Incorrect verification code");
                }).catch(error => internalServerError(response, error)));

        }).get(paginationPaths("/all"), (request, response) =>
            doWithDatabase(response, database => {
                const pageInfo = page(request.params.page);
                database.all(Database.formatQuery(`
                    SELECT id, name, displayName, gender, department
                    FROM "User"
                    ORDER BY name, id
                    LIMIT ${pageInfo.limit} OFFSET ${pageInfo.offset}
                `)).then(rows => response.json(rows), error => internalServerError(response, error));
            }))

        .get("/:id", (request, response) =>
            doWithDatabase(response, database =>
                database.get(Database.formatQuery(`
                    SELECT id, name, displayName, gender, department
                    FROM "User"
                    WHERE id=?
                `), request.params.id).then(row => row ? response.json(row) : notFound(response),
                    error => internalServerError(response, error))));
}

function usersSelfRouter() {

    return express.Router().use(authenticate)

        .get("/", (request, response) =>
            doWithDatabase(response, database =>
                database.get(Database.formatQuery(`
                    SELECT id, name, displayName, gender, department, email
                    FROM "User"
                    WHERE id=?
                `), response.locals.userId).then(row => {
                    if (!row) {
                        console.warn("User whose ID is specified in authentication token doesn't exist?");
                        return internalServerError(response, "Unable to find user that existed previously");
                    }
                    response.json(row);
                }, error => internalServerError(response, error))))

        .post("/update", (request, response) => {
            const data = request.body;
            const passwordChanged = data.password != null;
            if (!passwordChanged) { /* Ugly workaround */
                data.password = "password";
            }
            const normalized = normalizeUserModifiableContent(request.body);
            if (!normalized) {
                return badRequest(response, BAD_REQUEST_PARAMETERS);
            }
            if (!passwordChanged) {
                normalized.password = null;
            }

            doWithDatabase(response, database => {
                const id = response.locals.userId;
                database.get(Database.formatQuery(`
                    SELECT email
                    FROM "User"
                    WHERE id=?
                `), id).then(row => {
                    if (!row) {
                        console.warn("User whose ID is specified in authentication token doesn't exist?");
                        return internalServerError(response, "Unable to find user that existed previously");
                    }
                    const oldEmail = row.email;

                    let setQuery = "name=?, displayName=?, gender=?, department=?, email=?";
                    const name = normalized.name;
                    const displayName = normalized.displayName;
                    const gender = normalized.gender;
                    const department = normalized.department;
                    const newEmail = normalized.email;
                    const array = [name, displayName, gender, department, newEmail];
                    if (passwordChanged) {
                        setQuery += ", password=?";
                        array.push(passwordToHashedString(normalized.password, id));
                    }
                    array.push(id);

                    return database.run(Database.formatQuery(`
                            UPDATE "User"
                            SET ${setQuery}
                            WHERE id=?
                        `), ...array).then(() => {
                            response.json({
                                email: oldEmail,
                                id,
                                name,
                                displayName,
                                gender,
                                department
                            });
                            if (newEmail !== oldEmail) {
                                sendVerification(newEmail);
                            }
                        });
                }).catch(error => internalServerError(response, error));
            });
        });
}

function postsRouter() {

    return express.Router()

        .post("/new", authenticate, (request, response) => {
            const normalized = normalizePostModifiableContent(request.body);
            if (!normalized) {
                return badRequest(response, BAD_REQUEST_PARAMETERS);
            }

            const id = uuidV4();
            const title = normalized.title;
            const content = normalized.content;
            const category = normalized.category;
            const timestamp = Date.now();
            const authorId = response.locals.userId;
            doWithDatabase(response, database =>
                database.run(Database.formatQuery(`
                    INSERT INTO Post
                    VALUES (?, ?, ?, ?, ?, ?)
                `),
                id,
                title,
                content,
                category,
                timestamp,
                authorId).then(() =>
                    response.status(201).json({
                        id,
                        title,
                        content,
                        category,
                        timestamp,
                        authorId
                    }), error => internalServerError(response, error)));

        }).delete("/:id", (request, response) => {
            doWithDatabase(response, database => {
                const id = request.params.id;
                database.get(Database.formatQuery(`
                    SELECT COUNT(*)
                    FROM Post
                    WHERE id=?
                `), id).then(count =>
                    Object.values(count)[0] ?
                        database.run(Database.formatQuery(`
                            DELETE FROM Post
                            WHERE id=?
                        `), id).then(() => response.json({})) :
                        notFound(response))
                .catch(error => internalServerError(response, error));
            });
        });
}

/* -- Router creations -- */

/* !-- Middlewares -- */

function authenticate(request, response, next) {

    if (!(isRequest(request) && isResponse(response) && Type.t(next, "function"))) {
        throw new TypeError("Incorrect type(s) for authenticate arguments!");
    }

    const unauthenticated = error => respondError(response, error, 401);

    const authHeaderName = "Authorization";
    const authHeader = request.get(authHeaderName);
    if (!authHeader) {
        return unauthenticated(`No ${authHeaderName} header exist`);
    }

    try {
        const decoded = jwt.verify(authHeader.replace("Bearer ", ""), keyPairs.publicKey, {
            algorithms: [JsonWebTokenConstants.ALGORITHM],
            issuer: JsonWebTokenConstants.ISSUER,
            maxAge: JsonWebTokenConstants.MAX_AGE
        });
        response.locals.userId = decoded.sub;
        next();

    } catch (error) {
        unauthenticated(error);
    }
}

/* -- Middlewares -- */

/* !-- Data validation and normalization -- */

function normalizeUserModifiableContent(object) {

    if (object == null) {
        return;
    }

    let email = object.email;
    let password = object.password;
    let name = object.name;
    let department = object.department;
    if (![email, password, name, department].every(string => Type.t(string, "string"))) {
        return;
    }

    email = email.trim();
    password = password.trim();
    name = name.trim();
    department = department.trim();
    if (!([email, password, name, department].every(string => string.length) && /^.+@.+$/.test(email))) {
        return;
    }

    let displayName = object.displayName;
    if (displayName == null) {
        displayName = null;
    } else if (!Type.t(displayName, "string")) {
        return;
    } else {
        displayName = displayName.trim();
        if (!displayName.length) {
            return;
        }
    }

    const gender = object.gender;
    if (!Number.isInteger(gender) || gender < 0 || gender > 2) {
        return;
    }

    return {
        email,
        password,
        name,
        displayName,
        gender,
        department
    };
}

function normalizePostModifiableContent(object) {

    if (object == null) {
        return;
    }

    let title = object.title;
    let content = object.content;
    if (![title, content].every(string => Type.t(string, "string"))) {
        return;
    }

    title = title.trim();
    if (![title, content.trim()].every(string => string.length)) {
        return;
    }

    let category = object.category;
    if (category == null) {
        category = null;
    } else if (!Type.t(category, "string")) {
        return;
    } else {
        category = category.trim();
        if (!category.length) {
            return;
        }
    }

    return {
        title,
        content,
        category
    };
}

/* -- Data validation and normalization -- */

/* !-- Miscellaneous -- */

function doWithDatabase(response, callback) {

    if (!(isResponse(response) && Type.t(callback, "function"))) {
        throw new TypeError("Incorrect type(s) for doWithDatabase arguments!");
    }

    Database.getDatabase().then(database => database ? callback(database) :
        internalServerError(response, "Can't access database!"));
}

function isRequest(any) {
    return Type.t(any, http.IncomingMessage);
}

function isResponse(any) {
    return Type.t(any, http.ServerResponse);
}

function page(pageRequestParam) {

    pageRequestParam = Type.unwrap(pageRequestParam);
    if (!(Type.t(pageRequestParam, "string") || pageRequestParam == null)) {
        throw new TypeError("Incorrect type for page argument!");
    }

    let page = Number(pageRequestParam);
    if (!Number.isInteger(page) || page < 1) {
        page = 1;
    }

    const maximumResultsPerPage = Constants.DATABASE_RESULTS_PER_PAGE;
    return {
        limit: maximumResultsPerPage,
        offset: maximumResultsPerPage * (page - 1)
    };
}

function paginationPaths(path) {

    path = Type.unwrap(path);
    if (!Type.t(path, "string")) {
        throw new TypeError("Incorrect type for paginationPaths argument!");
    }

    return [path, `${path.endsWith("/") ? path : `${path}/`}:page`];
}

function passwordToHashedString(password, salt) {

    password = Type.unwrap(password);
    salt = salt == null ? "" : Type.unwrap(salt);
    if (![password, salt].every(string => Type.t(string, "string"))) {
        throw new TypeError("Incorrect type(s) for passwordToHashedString arguments!");
    }

    return crypto.createHash("sha256").update(password).update(salt).digest("base64");
}

function sendVerification(email) {

    email = Type.unwrap(email);
    if (!Type.t(email, "string")) {
        throw new TypeError("Incorrect type for sendVerification argument!");
    }

    ;
}

/* -- Miscellaneous -- */

/* !-- Response utilities -- */

function badRequest(response, reason) {

    if (!isResponse(response)) {
        throw new TypeError("Incorrect type for badRequest arguments!");
    }

    return respondError(response, reason, 400);
}

function forbidden(response, reason) {

    if (!isResponse(response)) {
        throw new TypeError("Incorrect type for forbidden arguments!");
    }

    return respondError(response, reason, 403);
}

function notFound(response) {

    if (!isResponse(response)) {
        throw new TypeError("Incorrect type for notFound argument!");
    }

    return respondError(response, "The specified resource was not found", 404);
}

function internalServerError(response, error) {

    if (!isResponse(response)) {
        throw new TypeError("Incorrect type for internalServerError arguments!");
    }

    return respondError(response, error);
}

function respondError(response, error, statusCode) {

    statusCode = Type.unwrap(statusCode);
    if (!(isResponse(response) && (statusCode == null || Type.t(statusCode, "number")))) {
        throw new TypeError("Incorrect type(s) for respondError arguments!");
    }

    if (statusCode == null) {
        statusCode = 500;
    } else if (!Number.isInteger(statusCode) || statusCode < 100) {
        throw new RangeError("Invalid status code");
    } else if (statusCode < 400 || statusCode >= 600) {
        statusCode = 500;
    }

    return response.status(statusCode).json({ message: Type.t(error, Error) ? error.message : String(error) });
}

/* -- Response utilities -- */

const ApiRoutes = {
    setup
};

export default ApiRoutes;
