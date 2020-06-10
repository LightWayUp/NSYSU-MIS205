((root) => {
    "use strict";

    const Gender = Object.freeze({
        OTHER: Symbol(0),
        MALE: Symbol(1),
        FEMALE: Symbol(2),
    });
    const JSON_MIME_TYPE = "application/json";
    const privateValidator = Symbol();

    let clientCounter = 0;

    class Client {

        constructor(_) {

            if (_ !== privateValidator) {
                throw new Error("Client is private");
            }

            const message = "Creating a new instance of Client";
            clientCounter++ ?
                console.warn(`${message}; there are now ${
                    clientCounter} instances, beware of the side effect!`) :
                debug(message);

            this.clientUser = undefined;
            this.token = JsonWebToken.fromLocalStorage();
            JsonWebToken.watchForChanges(this);
        }

        static newInstance() {

            const client = new Client(privateValidator);
            const clientToken = client.token;

            if (clientToken && !clientToken.hasExpired()) {
                debug("Authentication token exists and has not expired yet")

                return client.refreshTokenConditionally().then(changed => {
                    debug(`Authentication token has${changed ? "" : " not"
                        } changed in the Client instance creation flow`);
                    return client.setClientUser().catch(console.error);
                }).then(() => client);
            }

            return Promise.resolve(client);
        }

        isLoggedIn() {
            return !!this.clientUser;
        }

        register(email, password, userProfile) {

            email = unwrap(email);
            password = unwrap(password);
            if (!([email, password].every(credential => t(credential, "string")) && t(userProfile, UserProfile))) {
                throw new TypeError("Incorrect type(s) for register arguments!");
            }

            debug("Attempting to register for a new user");
            const finalUrl = apiUrl("users/new");
            return postAsJson(finalUrl, {
                email,
                password,
                name: userProfile.username,
                displayName: userProfile.displayName,
                gender: UserProfile.getGenderInformation(userProfile.gender),
                department: userProfile.department

            }, { cache: "no-store" }).then(response => responseToJson(response, finalUrl).catch(error => {
                if (t(error, SyntaxError)) {
                    return console.warn(
                        "Received malformed response from server, but registration seems to be successful");
                }
                throw error;

            })).then(userInformation => userInformation ?
                new User(privateValidator, userInformation.id,
                    new UserProfile(userInformation.name,
                        userInformation.displayName,
                        UserProfile.getGender(userInformation.gender),
                        userInformation.department)) :
                undefined);
        }

        login(email, password) {

            email = unwrap(email);
            password = unwrap(password);
            if (![email, password].every(credential => t(credential, "string"))) {
                throw new TypeError("Incorrect type(s) for login arguments!");
            }

            if (this.isLoggedIn()) {
                return Promise.reject(new Error(`Client is already logged in as user with ID ${this.clientUser.id}`));
            }

            debug("Attempting to log in");
            return postAsJson(apiUrl("token/new"), {
                email,
                password
            }, { cache: "no-store" }).then(responseToJson)
                .then(tokenInformation => {
                    const newToken = new JsonWebToken(tokenInformation);
                    this.token = newToken;
                    JsonWebToken.save(newToken);
                    return this.setClientUser().catch(console.error);
                }).then(() => this.token);
        }

        logout() {

            if (!this.isLoggedIn()) {
                return console.warn("Client is not logged in when logout is called");
            }

            this.token = JsonWebToken.save();
            this.clientUser = undefined;
        }

        refreshTokenConditionally(noRejectionOnFailure) {

            if (noRejectionOnFailure == null) {
                noRejectionOnFailure = true;
            } else {
                noRejectionOnFailure = unwrap(noRejectionOnFailure);
                if (!t(noRejectionOnFailure, "boolean")) {
                    throw new TypeError("Incorrect type for refreshTokenConditionally argument!");
                }
            }

            const token = this.token;
            if (!token) {
                return Promise.reject(new Error("No token is stored, can't refresh; a login is required"));
            }
            if (token.hasExpired()) {
                return Promise.reject(new Error("Token has already expired, can't refresh; a new login is required"));
            }
            if (!token.willExpire()) {
                debug("Authentication token isn't about to expire, ignoring");
                return Promise.resolve(false);
            }

            debug("Attempting to refresh authentication token");
            const promise = getFromJson(apiUrl("token/refresh"), optionsWithAuth(token))
                .then(tokenInformation => {
                    const newToken = new JsonWebToken(tokenInformation);
                    this.token = newToken;
                    JsonWebToken.save(newToken);
                    return true;
                });
            if (noRejectionOnFailure) {
                promise.catch(error => {
                    console.warn(error);
                    return false;
                });
            }
            return promise;
        }

        verifyEmail(verificationCode, email) {

            verificationCode = unwrap(verificationCode);
            email = unwrap(email);
            if (![verificationCode, email].every(string => t(string, "string"))) {
                throw new TypeError("Incorrect type(s) for verifyEmail arguments!");
            }

            debug(`Attempting to verify user account with email address ${email}`);
            const finalUrl = apiUrl("users/verify");
            return postAsJson(finalUrl, {
                verificationCode,
                email
            }).then(response => {
                if (response.status === 400) {
                    debug("User account verification failed");
                    return false;
                }
                if (response.ok) {
                    debug("User account verification succeeded");
                    return true;
                }
                ensureResponseOk(response, finalUrl);
            });
        }

        fetchUserById(id) {

            id = unwrap(id);
            if (!t(id, "string")) {
                throw new TypeError("Incorrect type for fetchUserById argument!");
            }

            debug(`Attempting to fetch details of user with ID ${id}`);
            return getFromJson(apiUrl(`users/${id}`)).then(userInformation =>
                new User(privateValidator, userInformation.id, new UserProfile(
                    userInformation.name,
                    userInformation.displayName,
                    UserProfile.getGender(userInformation.gender),
                    userInformation.department)));
        }

        fetchUsers(page) {

            if (page == null) {
                page = 1;
            } else {
                page = unwrap(page);
                if (!t(page, "number")) {
                    throw new TypeError("Incorrect type for fetchUsers argument!");
                }
                if (!Number.isInteger(page) || page < 1) {
                    throw new RangeError("Page number is invalid");
                }
            }

            debug(`Attempting to fetch details of all users on page ${page}`);
            return getFromJson(apiUrl(`users/all/${page}`)).then(userInformations =>
                userInformations.map(userInformation =>
                    new User(privateValidator, userInformation.id, new UserProfile(
                        userInformation.name,
                        userInformation.displayName,
                        UserProfile.getGender(userInformation.gender),
                        userInformation.department))));
        }

        fetchPostById(id) {

            id = unwrap(id);
            if (!t(id, "string")) {
                throw new TypeError("Incorrect type for fetchPostById argument!");
            }

            debug(`Attempting to fetch details of post with ID ${id}`);
            return getFromJson(apiUrl(`posts/${id}`)).then(postInformation =>
                new Post(privateValidator,
                    postInformation.id,
                    postInformation.title,
                    postInformation.content,
                    postInformation.timestamp,
                    postInformation.authorId));
        }

        fetchPosts(page) {

            if (page == null) {
                page = 1;
            } else {
                page = unwrap(page);
                if (!t(page, "number")) {
                    throw new TypeError("Incorrect type for fetchPosts argument!");
                }
                if (!Number.isInteger(page) || page < 1) {
                    throw new RangeError("Page number is invalid");
                }
            }

            debug(`Attempting to fetch details of all posts on page ${page}`);
            return getFromJson(apiUrl(`posts/all/${page}`)).then(postInformations =>
                postInformations.map(postInformation =>
                    new Post(privateValidator,
                        postInformation.id,
                        postInformation.title,
                        postInformation.content,
                        postInformation.timestamp,
                        postInformation.authorId)));
        }

        fetchCommentById(id, post) {

            id = unwrap(id);
            if (!(t(id, "string") && t(post, Post))) {
                throw new TypeError("Incorrect type(s) for fetchCommentById arguments!");
            }

            const postId = post.id;
            debug(`Attempting to fetch details of comment with ID ${id} of post with ID ${postId}`);
            return getFromJson(apiUrl(`posts/${postId}/comments/${id}`)).then(commentInformation =>
                new Comment(privateValidator,
                    commentInformation.id,
                    commentInformation.content,
                    commentInformation.timestamp,
                    commentInformation.postId,
                    commentInformation.authorId));
        }

        fetchComments(post, page) {

            page = page == null ? 1 : unwrap(page);
            if (!(t(post, Post) && t(page, "number"))) {
                throw new TypeError("Incorrect type(s) for fetchComments arguments!");
            }
            if (!Number.isInteger(page) || page < 1) {
                throw new RangeError("Page number is invalid");
            }

            const postId = post.id;
            debug(`Attempting to fetch details of all comments of post with ID ${postId} on page ${page}`);
            return getFromJson(apiUrl(`posts/${postId}/comments/all/${page}`)).then(commentInformations =>
                commentInformations.map(commentInformation =>
                    new Comment(privateValidator,
                        commentInformation.id,
                        commentInformation.content,
                        commentInformation.timestamp,
                        commentInformation.postId,
                        commentInformation.authorId)));
        }

        setClientUser() {

            const token = this.token;
            if (!token) {
                return Promise.reject(new Error("No token is stored; a login is required"));
            }
            if (token.hasExpired()) {
                return Promise.reject(new Error("Token has already expired; a new login is required"));
            }

            debug("Attempting to fetch user's own details");
            return getFromJson(apiUrl("users/self"), optionsWithAuth(token)).then(userInformation =>
                this.clientUser = new ClientUser(privateValidator, this, userInformation.email, userInformation.id,
                    new UserProfile(userInformation.name,
                        userInformation.displayName,
                        UserProfile.getGender(userInformation.gender),
                        userInformation.department)));
        }

        /**
         * @override
         */
        toString() {
            return super.toString().replace(/Object/g, this.constructor.name);
        }
    }

    class UserProfile {

        constructor(username, displayName, gender, department) {

            username = unwrap(username);
            displayName = unwrap(displayName);
            department = unwrap(department);
            if (!([username, department].every(property => t(property, "string")) &&
                (t(displayName, "string") || displayName == null) && UserProfile.isGender(gender))) {
                throw new TypeError("Incorrect type(s) for UserProfile arguments!");
            }

            this.username = username;
            this.displayName = undefinedIfNull(displayName);
            this.gender = gender;
            this.department = department;
        }

        getProfileName() {

            const displayName = this.displayName;
            return displayName == null ? this.username : displayName;
        }

        static isGender(any) {
            return Object.values(Gender).includes(any);
        }

        static getGender(genderInformation) {
            return Object.values(Gender).find(gender => UserProfile.getGenderInformation(gender) === genderInformation);
        }

        static getGenderInformation(gender) {

            if (!UserProfile.isGender(gender)) {
                throw new TypeError("Incorrect type for getGenderInformation argument!");
            }

            return Number(gender.description);
        }

        /**
         * @override
         */
        toString() {
            return super.toString().replace(/Object/g, this.constructor.name);
        }
    }

    class User {

        constructor(_, id, userProfile) {

            if (_ !== privateValidator) {
                throw new Error("User is private");
            }

            id = unwrap(id);
            if (!(t(id, "string") && t(userProfile, UserProfile))) {
                throw new TypeError("Incorrect type(s) for User arguments!");
            }

            this.id = id;
            this.userProfile = userProfile;
        }

        /**
         * @override
         */
        toString() {
            return super.toString().replace(/Object/g, this.constructor.name);
        }
    }

    class ClientUser extends User {

        constructor(_, client, email, id, userProfile) {

            if (_ !== privateValidator) {
                throw new Error("ClientUser is private");
            }

            email = unwrap(email);
            id = unwrap(id);
            if (!([email, id].every(property => t(property, "string"))
                && t(userProfile, UserProfile) && t(client, Client))) {
                throw new TypeError("Incorrect type(s) for ClientUser arguments!");
            }

            super(_, id, userProfile);
            this.client = client;
            this.email = email;
        }

        updateSelf(password) {

            password = unwrap(password);
            if (!(t(password, "string") || password == null)) {
                throw new TypeError("Incorrect type for updateSelf argument!");
            }

            debug("Attempting to update user's own details");
            const userProfile = this.userProfile;
            const finalUrl = apiUrl("users/self/update");
            return postAsJson(finalUrl, {
                email: this.email,
                password: undefinedIfNull(password),
                name: userProfile.username,
                displayName: userProfile.displayName,
                gender: UserProfile.getGenderInformation(userProfile.gender),
                department: userProfile.department
            }, optionsWithAuth(this.client.token)).then(response =>

                responseToJson(response, finalUrl).catch(error => {
                    if (t(error, SyntaxError)) {
                        return console.warn(
                            "Received malformed response from server, but updateSelf action seems to be successful");
                    }
                    throw error;
                })).then(data => {
                    if ((data && data.email !== this.email) || password != null) {
                        this.client.logout();
                        this.client = undefined;
                    }
                    return this;
                });
        }

        createPost(title, content) {

            title = unwrap(title);
            content = unwrap(content);
            if (![title, content].every(string => t(string, "string"))) {
                throw new TypeError("Incorrect type(s) for createPost arguments!");
            }

            debug("Attempting to create a new post");
            return postAsJson(apiUrl("posts/new"), {
                title,
                content
            }, optionsWithAuth(this.client.token)).then(responseToJson)
                .then(postInformation => new Post(privateValidator,
                    postInformation.id,
                    postInformation.title,
                    postInformation.content,
                    postInformation.timestamp,
                    postInformation.authorId));
        }

        createComment(content, post) {

            content = unwrap(content);
            if (!(t(content, "string") && t(post, Post))) {
                throw new TypeError("Incorrect type(s) for createComment arguments!");
            }

            const postId = post.id;
            debug(`Attempting to create a new comment of post with ID ${postId}`);
            return postAsJson(apiUrl(`posts/${postId}/comments/new`), { content },
                optionsWithAuth(this.client.token)).then(responseToJson)
                .then(commentInformation => new Comment(privateValidator,
                    commentInformation.id,
                    commentInformation.content,
                    commentInformation.timestamp,
                    commentInformation.postId,
                    commentInformation.authorId));
        }

        updatePost(post) {

            if (!t(post, Post)) {
                throw new TypeError("Incorrect type for updatePost argument!");
            }

            if (post.authorId !== this.id) {
                return Promise.reject(Error("Only posts by ClientUser may be edited"));
            }

            const id = post.id;
            debug(`Attempting to update details of post with ID ${id}`);
            const finalUrl = apiUrl(`posts/${id}/update`);
            return postAsJson(finalUrl, {
                title: post.title,
                content: post.content
            }, optionsWithAuth(this.client.token)).then(response =>

                responseToJson(response, finalUrl).catch(error => {
                    if (t(error, SyntaxError)) {
                        return console.warn(
                            "Received malformed response from server, but updatePost action seems to be successful");
                    }
                    throw error;
                })).then(() => post);
        }

        updateComment(comment) {

            if (!t(comment, Comment)) {
                throw new TypeError("Incorrect type for updateComment argument!");
            }

            if (comment.authorId !== this.id) {
                return Promise.reject(new Error("Only comments by ClientUser may be edited"));
            }

            const id = comment.id;
            const postId = comment.postId;
            debug(`Attempting to update details of comment with ID ${id} of post with ID ${postId}`);
            const finalUrl = apiUrl(`posts/${postId}/comments/${id}/update`);
            return postAsJson(finalUrl, { content: comment.content }, optionsWithAuth(this.client.token))

                .then(response => responseToJson(response, finalUrl).catch(error => {
                    if (t(error, SyntaxError)) {
                        return console.warn(
                            "Received malformed response from server, but updateComment action seems to be successful");
                    }
                    throw error;
                })).then(() => comment);
        }

        deletePost(post) {

            if (!t(post, Post)) {
                throw new TypeError("Incorrect type for deletePost argument!");
            }

            if (post.authorId !== this.id) {
                return Promise.reject(Error("Only posts by ClientUser may be deleted"));
            }

            const id = post.id;
            debug(`Attempting to delete post with ID ${id}`);
            const finalUrl = apiUrl(`posts/${id}`);
            return fetch(finalUrl, Object.assign({ method: "DELETE" }, optionsWithAuth(this.client.token)))
                .then(response => ensureResponseOk(response, finalUrl)).then(() => {});
        }

        deleteComment(comment) {

            if (!t(comment, Comment)) {
                throw new TypeError("Incorrect type for deleteComment argument!");
            }

            if (comment.authorId !== this.id) {
                return Promise.reject(new Error("Only comments by ClientUser may be deleted"));
            }

            const id = comment.id;
            const postId = comment.postId;
            debug(`Attempting to delete comment with ID ${id} of post with ID ${postId}`);
            const finalUrl = apiUrl(`posts/${postId}/comments/${id}`);
            return fetch(finalUrl, Object.assign({ method: "DELETE" }, optionsWithAuth(this.client.token)))
                .then(response => ensureResponseOk(response, finalUrl)).then(() => {});
        }
    }

    class Post {

        constructor(_, id, title, content, timestamp, authorId) {

            if (_ !== privateValidator) {
                throw new Error("Post is private");
            }

            id = unwrap(id);
            title = unwrap(title);
            content = unwrap(content);
            timestamp = unwrap(timestamp);
            authorId = unwrap(authorId);
            if (!([id, title, content, authorId].every(property => t(property, "string")) && t(timestamp, "number"))) {
                throw new TypeError("Incorrect type(s) for Post arguments!");
            }

            if (!Number.isInteger(timestamp) || timestamp < 0) {
                throw new RangeError("Invalid timestamp");
            }

            this.id = id;
            this.title = title;
            this.content = content;
            this.timestamp = timestamp;
            this.authorId = authorId;
        }

        /**
         * @override
         */
        toString() {
            return `${this.title} - ${this.content}`;
        }

        /**
         * @override
         */
        valueOf() {
            return this.toString();
        }
    }

    class Comment {

        constructor(_, id, content, timestamp, postId, authorId) {

            if (_ !== privateValidator) {
                throw new Error("Comment is private");
            }

            id = unwrap(id);
            content = unwrap(content);
            timestamp = unwrap(timestamp);
            postId = unwrap(postId);
            authorId = unwrap(authorId);
            if (!([id, content, postId, authorId].every(property => t(property, "string")) && t(timestamp, "number"))) {
                throw new TypeError("Incorrect type(s) for Comment arguments!");
            }

            if (!Number.isInteger(timestamp) || timestamp < 0) {
                throw new RangeError("Invalid timestamp");
            }

            this.id = id;
            this.content = content;
            this.timestamp = timestamp;
            this.postId = postId;
            this.authorId = authorId;
        }

        /**
         * @override
         */
        toString() {
            return this.content;
        }

        /**
         * @override
         */
        valueOf() {
            return this.toString();
        }
    }

    class JsonWebToken {

        constructor(tokenInformation) {

            const errorString = "Incorrect type for JsonWebToken argument!";
            if (tokenInformation == null) {
                throw new TypeError(errorString);
            }
            const value = unwrap(tokenInformation.token);
            const expirationTime = unwrap(tokenInformation.expiration);
            if (!(t(value, "string") && t(expirationTime, "number"))) {
                throw new TypeError(errorString);
            }

            if (!Number.isInteger(expirationTime) || expirationTime < 0) {
                throw new RangeError("Invalid token expiration time");
            }

            this.value = value;
            this.expirationTime = expirationTime;
        }

        get token() {
            return this.value;
        }

        get expiration() {
            return this.expirationTime;
        }

        hasExpired() {
            return this.willExpire(0);
        }

        willExpire(afterTime) {

            if (afterTime == null) {
                afterTime = 1000 * 60 * 60 * 24;
            } else {
                afterTime = unwrap(afterTime);
                if (!t(afterTime, "number")) {
                    throw new TypeError("Incorrect type for willExpireIn argument!");
                }
            }

            if (!Number.isInteger(afterTime) || afterTime < 0) {
                throw new RangeError("afterTime must be a non-negative integer");
            }

            return this.expirationTime <= Date.now() + afterTime;
        }

        static fromLocalStorage() {

            debug("Retrieving authentication token information from LocalStorage");
            const JwtKeys = JsonWebToken.StorageKeys;
            const value = localStorage.getItem(JwtKeys.TOKEN);
            const expirationTimeString = localStorage.getItem(JwtKeys.EXPIRATION_TIME);

            return [value, expirationTimeString].some(thing => thing === null) ?
                JsonWebToken.save() :
                new JsonWebToken({
                    token: value,
                    expiration: Number(expirationTimeString)
                });
        }

        static save(token) {

            const JwtKeys = JsonWebToken.StorageKeys;
            if (token == null) {
                debug("Removing all information of authentication token from LocalStorage");
                return Object.values(JwtKeys)
                    .forEach(storageKey => localStorage.removeItem(storageKey));
            }

            if (!t(token, JsonWebToken)) {
                throw new TypeError("Incorrect type for save argument!");
            }

            try {
                localStorage.setItem(JwtKeys.TOKEN, token.value);
                localStorage.setItem(JwtKeys.EXPIRATION_TIME, token.expirationTime);
            } catch (error) {
                if (t(error, DOMException) && error.name === "QuotaExceededError") {
                    console.error(
                        "Unable to store authentication token, user will need to log in again on every page navigation!");
                    return JsonWebToken.save();
                }
                throw error;
            }

            debug("Successfully saved authentication token information to LocalStorage");
            return token;
        }

        static watchForChanges(client) {

            if (!t(client, Client)) {
                throw new TypeError("Incorrect type for watchForChanges argument!");
            }

            addEventListener("storage", event => {
                const storageKey = event.key;

                if (storageKey === null || Object.values(JsonWebToken.StorageKeys).includes(storageKey)) {
                    console.log(
                        "Information of authentication token is modified in other scopes, syncing from LocalStorage");
                    client.token = JsonWebToken.fromLocalStorage();
                }
            });
        }

        static get StorageKeys() {

            return {
                TOKEN: "token",
                EXPIRATION_TIME: "token_expiration_time"
            };
        }

        /**
         * @override
         */
        toString() {
            return super.toString().replace(/Object/g, this.constructor.name);
        }

        /**
         * @override
         */
        valueOf() {
            return this.value;
        }
    }

    class HttpError extends Error {

        constructor(message, statusCode, url) {

            const isNumberErrorStatusCode = number =>
                Number.isInteger(number) && ((number >= 100 && number < 200) || number >= 300);

            let isOverloadedVariant = true;
            const primitiveMessage = unwrap(message);
            if (isNumberErrorStatusCode(primitiveMessage) && url == null) {
                if (statusCode != null) {
                    try {
                        statusCode = new URL(statusCode).href;
                    } catch (error) {
                        isOverloadedVariant = false;
                    }
                }
            } else {
                isOverloadedVariant = false;
            }

            if (isOverloadedVariant) {
                url = statusCode;
                statusCode = primitiveMessage;
                message = "";
            } else {

                statusCode = unwrap(statusCode);
                url = url == null ? undefined : new URL(url).href;
                if (!t(statusCode, "number")) {
                    throw new TypeError("Incorrect type for HttpError arguments!");
                }

                if (!isNumberErrorStatusCode(statusCode)) {
                    throw new RangeError("Invalid status code");
                }
            }

            super(message);
            this.name = this.constructor.name;
            this.statusCode = statusCode;
            this.url = url;
        }
    }

    /* !-- Ajax convenience utility functions -- */

    function optionsWithAuth(token) {

        if (t(token, JsonWebToken)) {
            token = token.value;
        } else {
            token = unwrap(token);
            if (!t(token, "string")) {
                throw new TypeError("Incorrect type for optionsWithAuth argument!");
            }
        }

        const headers = new Headers();
        headers.append("Authorization", `Bearer ${token}`);
        return { headers };
    }

    function postAsJson(url, bodyData, options) {

        url = new URL(url).href;
        if (options == null) {
            options = {};
        }
        const headers = new Headers(options.headers);
        headers.set("Content-Type", JSON_MIME_TYPE);
        options.headers = headers;
        const method = "POST";
        options.method = method;
        options.body = JSON.stringify(bodyData);

        debug(`${method} ${url}`);
        return fetch(url, options).then(response => ensureResponseOk(response, url));
    }

    function getFromJson(url, options) {

        url = new URL(url).href;
        if (options == null) {
            options = {};
        }
        const headers = new Headers(options.headers);
        headers.set("Accept", JSON_MIME_TYPE);
        options.headers = headers;
        const method = "GET";
        options.method = method;
        delete options.body;

        debug(`${method} ${url}`);
        return fetch(url, options).then(response => responseToJson(response, url));
    }

    function responseToJson(response, requestUrl) {

        if (!t(response, Response)) {
            throw new TypeError("Incorrect type for responseToJson arguments!");
        }

        try {
            ensureResponseOk(response, requestUrl);
        } catch (error) {
            if (t(error, HttpError)) {
                return Promise.reject(error);
            }
            throw error;
        }

        const contentType = response.headers.get("Content-Type");
        return /^application\/([-A-Za-z0-9!#$&^_]+\+)?json(;.+)?$/.test(contentType) ? response.json() :
            Promise.reject(new Error(`Server responded with data with unexpected content type "${contentType}"`));
    }

    function ensureResponseOk(response, requestUrl) {

        if (!t(response, Response)) {
            throw new TypeError("Incorrect type for ensureResponseOk arguments!");
        }

        if (!response.ok) {
            const statusCode = response.status;
            throw new HttpError(`Server responded with status ${statusCode}`, statusCode, requestUrl);
        }
        return response;
    }

    /* -- Ajax convenience utility functions -- */

    /* !-- Miscellaneous -- */

    function apiUrl(subUrl) {

        subUrl = unwrap(subUrl);
        if (!t(subUrl, "string")) {
            throw new TypeError("Incorrect type for apiUrl argument!");
        }

        return `${location.origin}/api/${subUrl.startsWith("/") ? subUrl.substring(1) : subUrl}`;
    }

    function debug(...data) {

        if (typeof DEBUG === "boolean" && DEBUG) {
            console.debug(...data);
        }
    }
    /* -- Miscellaneous -- */

    /* !-- Type utility functions -- */

    // t relies on:
    // unwrap
    function t(object, type) {

        type = unwrap(type);
        if (!["string", "function"].some(validType => typeof type === validType)) {
            throw new TypeError("Incorrect type for t arguments!");
        }

        // t(null, "null")
        if (object === null) {
            return type === "null";
        }

        // t(true, "boolean")
        if (typeof type === "string") {
            return typeof object === type;
        }

        // class A {}
        // class B extends A {}
        // t(new B(), A)
        return object instanceof type;
    }

    function wrap(value) {
        return ["boolean", "number", "string", "symbol"].some(type => typeof value === type) ? Object(value) : value;
    }

    function unwrap(object) {
        return [Boolean, Number, String, Symbol].some(wrapper => object instanceof wrapper) ? object.valueOf() : object;
    }

    function undefinedIfNull(any) {
        return any == null ? undefined : any;
    }

    function nullIfUndefined(any) {
        return any == null ? null : any;
    }

    /* -- Type utility functions -- */

    root.Api = {
        Client,
        UserProfile,
        User,
        ClientUser,
        Post,
        Comment,
        JsonWebToken,
        HttpError,
        Gender
    };
    root.Utilities = {
        Fetch: {
            postAsJson,
            getFromJson,
            responseToJson
        },
        Type: {
            t,
            unwrap,
            wrap,
            undefinedIfNull,
            nullIfUndefined
        }
    };
})(this);
