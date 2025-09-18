const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

// 🔑 Lê a chave privada (deve estar no mesmo nível deste arquivo)
const privateKeyPath = path.join(__dirname, "private.key");
const privateKey = fs.readFileSync(privateKeyPath);

// Configuração DocuSign
const account_id = "69784ef8-1393-4d49-927c-af9a1caed068";
const template_id = "2aebf175-843a-470a-89ae-b956a397dfd7";
const auth_server = "account.docusign.com"; // produção

// Credenciais
const integrationKey = "32b34d39-c4ea-4174-9820-699a1ef7f26";
const userId = "4af0ba80-6b88-402d-a245-2751083f8a5c";

// 🔐 Gera o JWT
function gerarJWT() {
  const payload = {
    iss: integrationKey,
    sub: userId,
    aud: auth_server,
    scope: "signature impersonation",
  };
  return jwt.sign(payload, privateKey, { algorithm: "RS256", expiresIn: "10m" });
}

// 🌍 Endpoint que o HubSpot vai chamar
app.post("/enviar-envelope", async (req, res) => {
  try {
    // 1 - Gera o JWT
    const assertion = gerarJWT();

    // 2 - Troca por Access Token no DocuSign
    const tokenResponse = await axios.post(`https://${auth_server}/oauth/token`, {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });
    const docusign_access_token = tokenResponse.data.access_token;

    // 3 - Pega os dados enviados pelo HubSpot
    const {
      nome,
      email,
      nome_completo,
      nacionalidade,
      estado_civil,
      regime_de_casamento,
      rg,
      cpf_cnpj,
      rua,
      cidade,
      estado,
      zip
    } = req.body;

    // 4 - Monta o envelope
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

    // 5 - Envia o envelope
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
    res.json({ success: true, data: response.data });

  } catch (err) {
    console.error("Erro ao enviar envelope:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// 🔊 Render exige que o servidor escute a porta
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
