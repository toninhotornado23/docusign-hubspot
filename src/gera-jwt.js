const fs = require("fs");
const jwt = require("jsonwebtoken");

const privateKey = fs.readFileSync("C:\\Users\\gtakase\\Desktop\\CRM\\Gabriel\\Docusign\\private.key");

const payload = {
  iss: "32b34d39-c4ea-4174-9820-699a1ef7f266",
  sub: "4af0ba80-6b88-402d-a245-2751083f8a5c",
  aud: "account.docusign.com",
  scope: "signature impersonation"
};

const token = jwt.sign(payload, privateKey, { algorithm: "RS256", expiresIn: "1h" });

console.log(token);