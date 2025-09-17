const axios = require("axios").default;
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

// 🔑 Lê a chave privada salva no projeto
// O arquivo private.key deve estar dentro da pasta src/, mesma do hubspotFunction.js
const privateKeyPath = path.join(__dirname, "private.key");
const privateKey = fs.readFileSync(privateKeyPath);

// Configuração DocuSign
const account_id = "69784ef8-1393-4d49-927c-af9a1caed068";
const template_id = "2aebf175-843a-470a-89ae-b956a397dfd7";
const auth_server = "account.docusign.com"; // Produção

// Integration Key e User ID do DocuSign
const integrationKey = "32b34d39-c4ea-4174-9820-699a1ef7f26";
const userId = "4af0ba80-6b88-402d-a245-2751083f8a5c";

// Gera JWT
function gerarJWT() {
  const payload = {
    iss: integrationKey,
    sub: userId,
    aud: auth_server,
    scope: "signature impersonation",
  };

  return jwt.sign(payload, privateKey, { algorithm: "RS256", expiresIn: "10m" });
}

// Funções auxiliares
function dateFormated(val) {
  return new Date(parseInt(val)).toLocaleDateString("pt-BR");
}
function currencyFormated(val) {
  return parseFloat(val).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Função principal chamada pelo HubSpot
exports.main = async (event, callback) => {
  let has_error = false;
  let docusign_access_token;

  try {
    // 1 - Gera o JWT
    const assertion = gerarJWT();

    // 2 - Troca por um Access Token
    const tokenResponse = await axios.post(`https://${auth_server}/oauth/token`, {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });
    docusign_access_token = tokenResponse.data.access_token;
    console.log("Access token gerado:", docusign_access_token);

    // 3 - Monta os dados do envelope com base nos campos do HubSpot
    const {
      firstname: nome,
      nome_completo,
      email,
      nacionalidade,
      relationship_status: estado_civil,
      regime_de_casamento,
      rg,
      cpf_cnpj,
      address: rua,
      city: cidade,
      state: estado,
      zip,
    } = event.inputFields;

    const assunto = `Termo de Adesão | ${nome_completo}`;
    const descricao = "<p>Olá Sócio, segue o termo...</p>";

    const signature_data = {
      emailSubject: assunto,
      emailBlurb: descricao,
      status: "sent",
      templateId: template_id,
      templateRoles: [
        {
          roleName: "Sócio Aderente",
          email,
          name: nome,
          tabs: {
            textTabs: [
              { tabLabel: "Nacionalidade", value: nacionalidade },
              { tabLabel: "EstadoCivil", value: estado_civil },
              { tabLabel: "Regime de Casamento", value: regime_de_casamento },
              { tabLabel: "RG", value: rg },
              { tabLabel: "CPF", value: cpf_cnpj },
              { tabLabel: "CEP", value: zip },
              { tabLabel: "Rua_Endereço", value: rua },
              { tabLabel: "Cidade", value: cidade },
              { tabLabel: "Estado", value: estado },
            ],
          },
        },
      ],
    };

    // 4 - Envia o envelope
    const docusign_api = axios.create({
      baseURL: "https://na3.docusign.net/restapi",
    });

    const response = await docusign_api.post(
      `/v2.1/accounts/${account_id}/envelopes`,
      signature_data,
      {
        headers: {
          Authorization: `Bearer ${docusign_access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Envelope enviado:", response.data);
  } catch (err) {
    has_error = true;
    console.error("Erro ao enviar envelope:", err.response?.data || err.message);
  }

  callback({
    outputFields: {
      error: has_error,
    },
  });
};
