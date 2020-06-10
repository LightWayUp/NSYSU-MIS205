"use strict";

import forge from "node-forge";

function generateCertAndKeyPairSync(certificateAttributes) {

    if (!Array.isArray(certificateAttributes)) {
        throw new TypeError("Incorrect type for generateCertAndKeyPairSync argument!");
    }

    const pki = forge.pki;
    const forgeKeyPair = pki.rsa.generateKeyPair(2048);
    const forgeCertificate = pki.createCertificate();
    forgeCertificate.publicKey = forgeKeyPair.publicKey;
    forgeCertificate.serialNumber = "01";
    const currentDate = new Date();
    forgeCertificate.validity.notBefore = currentDate;
    forgeCertificate.validity.notAfter = new Date(currentDate.getTime() + 1000 * 60 * 60 * 24);
    forgeCertificate.setSubject(certificateAttributes);
    forgeCertificate.setIssuer(certificateAttributes);
    forgeCertificate.sign(forgeKeyPair.privateKey);

    return {
        publicKey: pki.publicKeyToPem(forgeKeyPair.publicKey),
        privateKey: pki.privateKeyToPem(forgeKeyPair.privateKey),
        certificate: pki.certificateToPem(forgeCertificate)
    };
}

const CryptoUtilities = {
    generateCertAndKeyPairSync
};

export default CryptoUtilities;
