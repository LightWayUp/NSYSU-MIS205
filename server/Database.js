"use strict";

import Constants from "./Constants.js";

import { open as sqliteOpen } from "sqlite";
import sqlite3 from "sqlite3";

import fs from "fs";
import path from "path";

import Type from "../utility/Type.js";

const DATABASE_CREATION_QUERIES = [
    `
    CREATE TABLE "User" (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        displayName TEXT,
        gender INTEGER DEFAULT 0 NOT NULL,
        department TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        verificationCode TEXT
    )
    `,
    `
    CREATE TABLE Post (
        id TEXT NOT NULL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        "timestamp" INTEGER DEFAULT 0 NOT NULL,
        authorId TEXT NOT NULL,
        FOREIGN KEY (authorId) REFERENCES "User"(id) ON DELETE CASCADE
    )
    `,
    `
    CREATE TABLE Comment (
        id TEXT NOT NULL PRIMARY KEY,
        content TEXT NOT NULL,
        "timestamp" INTEGER DEFAULT 0 NOT NULL,
        postId TEXT NOT NULL,
        authorId TEXT NOT NULL,
        FOREIGN KEY (postId) REFERENCES Post(id) ON DELETE CASCADE,
        FOREIGN KEY (authorId) REFERENCES "User"(id) ON DELETE CASCADE
    )
    `,
    `
    CREATE TABLE Room (
        id TEXT NOT NULL PRIMARY KEY,
        password TEXT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        initiatorId TEXT,
        participantCount INTEGER,
        activityDate TEXT,
        FOREIGN KEY (initiatorId) REFERENCES "User"(id) ON DELETE SET NULL
    )
    `,
    `
    CREATE TABLE ChatRecord (
        id TEXT NOT NULL PRIMARY KEY,
        content TEXT NOT NULL,
        "timestamp" INTEGER DEFAULT 0 NOT NULL,
        roomId TEXT NOT NULL,
        authorId TEXT NOT NULL,
        FOREIGN KEY (roomId) REFERENCES Room(id) ON DELETE CASCADE,
        FOREIGN KEY (authorId) REFERENCES "User"(id) ON DELETE CASCADE
    )
    `
];

let databasePromise;

function getDatabase() {

    if (!databasePromise) {
        const Binaries = Constants.Binaries;
        const binariesDirectoryPath = path.join(Binaries.DIRECTORY_PATH, ".");
        const openConfig = {
            filename: path.join(binariesDirectoryPath, Binaries.DATABASE),
            driver: sqlite3.Database
        };

        try {
            fs.mkdirSync(binariesDirectoryPath, { recursive: true });
        } catch (error) {
            console.warn(
                "Unable to create directories to satisfy binaries directory path setting, database opening might fail");
        }

        const setupDatabase = database => {
            database.on("error", console.error);
            return database.run("PRAGMA foreign_keys = TRUE").catch(console.warn).then(() => database);
        };
        sqlite3.verbose();
        // Verbose stacktrace is broken with any
        // version of sqlite3 lower than 5.0.0.
        // See https://github.com/kriasoft/node-sqlite/issues/113

        databasePromise = sqliteOpen(Object.assign({ mode: sqlite3.OPEN_READWRITE }, openConfig))
            .then(setupDatabase, () => sqliteOpen(openConfig).then(database =>

                Promise.all(DATABASE_CREATION_QUERIES.map(query => database.run(formatQuery(query))))
                .then(() => setupDatabase(database), () => {
                    throw new Error("Failed to create one or more tables");
                })).catch(console.error));
    }
    return databasePromise;
}

function closeDatabase() {

    if (process.env.DATABASE_CLOSED) {
        return Promise.reject(new Error("closeDatabase is called but it was already called previously."));
    }

    return getDatabase().then(async database => {

        if (!database) {
            throw new Error("Can't access database!");
        }

        await database.close();
        process.env.DATABASE_CLOSED = "true";
    });
}

function formatQuery(string) {

    string = Type.unwrap(string);
    if (!Type.t(string, "string")) {
        throw new TypeError("Incorrect type for formatQuery argument!");
    }

    return string.trim().replace(/(\s*\r*\n+\s*)|(\s+)/g, " ");
}

const Database = {
    getDatabase,
    closeDatabase,
    formatQuery
};

export default Database;
