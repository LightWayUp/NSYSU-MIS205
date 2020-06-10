"use strict";

const Constants = {
    Binaries: {
        DIRECTORY_PATH: "binary",
        PRIVATE_KEY: "private-key.pem",
        PUBLIC_KEY: "public-key.pem",
        CERTIFICATE: "certificate.pem",
        DATABASE: "database.db"
    },
    ExitCodes: {
        GENERIC_ERROR: 1,
        SERVER_START_FAILURE: 2
    },
    ServerDefaults: {
        CLOSE_TIMEOUT: 2000,
        PORT_HTTP: 8080,
        PORT_HTTPS: 8443
    },
    JsonWebToken: {
        ALGORITHM: "RS256",
        ISSUER: "Socializor",
        MAX_AGE: "5 days"
    },
    DATABASE_RESULTS_PER_PAGE: 25
};

export default Constants;
