const axios = require("axios").default;
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

// 🔑 Lê a chave privada salva no projeto
const privateKeyPath = path.resolve(__dirname, "private.key");
const privateKey = fs.readFileSync(privateKeyPath, "utf8");

// Configuração DocuSign
const account_id = "69784ef8-1393-4d49-927c-af9a1caed068";
const template_id = "2aebf175-843a-470a-89ae-b956a397dfd7";
const auth_server = "account.docusign.com"; // produção

// Seu Integration Key e User ID do DocuSign
const integrationKey = "32b34d39-c4ea-4174-9820-699a1ef7f26";
const userId = "4af0ba80-6b88-402d-a245-2751083f8a5c";

function gerarJWT() {
  const payload = {
    iss: integrationKey,
    sub: userId,
    aud: auth_server,
    scope: "signature impersonation"
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
    currency: "BRL"
  });
}

exports.main = async (event, callback) => {
  let has_error = false;
  let docusign_access_token;

  try {
    // 1 - Gera o JWT
    const assertion = gerarJWT();

    // 2 - Troca por um Access Token
    const tokenResponse = await axios.post(`https://${auth_server}/oauth/token`, {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    });
    docusign_access_token = tokenResponse.data.access_token;
    console.log("Access token gerado:", docusign_access_token);

    // 3 - Monta os dados do envelope com base nos campos do HubSpot
    const nome = event.inputFields["firstname"];
    const nome_completo = event.inputFields["nome_completo"];
    const email = event.inputFields["email"];
    const nacionalidade = event.inputFields["nacionalidade"];
    const estado_civil = event.inputFields["relationship_status"];
    const regime_de_casamento = event.inputFields["regime_de_casamento"];
    const rg = event.inputFields["rg"];
    const cpf_cnpj = event.inputFields["cpf_cnpj"];
    const rua = event.inputFields["address"];
    const cidade = event.inputFields["city"];
    const estado = event.inputFields["state"];
    const zip = event.inputFields["zip"];

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
              { tabLabel: "Estado", value: estado }
            ]
          }
        }
      ]
    };

    // 4 - Envia o envelope
    const docusign_api = axios.create({
      baseURL: "https://na3.docusign.net/restapi"
    });

    const response = await docusign_api.post(
      `/v2.1/accounts/${account_id}/envelopes`,
      signature_data,
      {
        headers: {
          Authorization: `Bearer ${docusign_access_token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Envelope enviado:", response.data);
  } catch (err) {
    has_error = true;
    console.error("Erro ao enviar envelope:", err.response?.data || err.message);
  }

  callback({
    outputFields: {
      error: has_error
    }
  });
};
