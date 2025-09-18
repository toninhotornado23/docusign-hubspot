import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json()); // interpreta JSON do HubSpot

// 🔹 Rota de teste
app.get("/", (req, res) => {
  res.send("Servidor DocuSign-HubSpot rodando! ✅");
});

// 🔹 Endpoint que o HubSpot vai chamar
app.post("/enviar-envelope", async (req, res) => {
  try {
    console.log("Payload recebido do HubSpot:", req.body);

    // ⚙️ Configurações do DocuSign (pegas das variáveis do Render)
    const integratorKey = process.env.DOCUSIGN_INTEGRATOR_KEY; // Client ID
    const userId = process.env.DOCUSIGN_USER_ID; // GUID do usuário (API Username)
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID; // ID da conta (fica no painel da API)
    const templateId = process.env.DOCUSIGN_TEMPLATE_ID; // ID do template
    const authServer = "account.docusign.com"; // produção → troque p/ "account-d.docusign.com" em sandbox
    const privateKeyPath = path.resolve("private.key"); // chave salva na raiz
    const privateKey = fs.readFileSync(privateKeyPath, "utf8");

    // 🔑 Autenticação JWT → gera novo access_token
    const dsApiClient = new docusign.ApiClient();
    dsApiClient.setOAuthBasePath(authServer);

    const results = await dsApiClient.requestJWTUserToken(
      integratorKey,
      userId,
      ["signature", "impersonation"],
      privateKey,
      3600 // expira em 1h
    );

    const accessToken = results.body.access_token;
    console.log("Novo access_token gerado:", accessToken);

    // 🔹 Pega dados do HubSpot
    const { nome, email, nome_completo, nacionalidade } = req.body;

    const assunto = "Termo de Adesão ao Acordo de Sócios" + " " + "| " + `${nome_completo}`;
    const descricao =  "<p>Olá Sócio Acqua Vero, boa tarde!  Você está recebendo o Termo de Adesão ao Acordo de Sócios conforme estabelece o Contrato Social, o qual está vinculado. Para assinatura deste documento será necessário que seu e-CPF esteja conectado ao computador. Caso tenha alguma dificuldade para assinar entre em contato com sua certificadora.</p><br /><p>Atenciosamente,<br />Jurídico AVIN</p>";

    // 🔹 Monta envelope
    const envelopeDefinition = {
      emailSubject: assunto,
      emailBlurb: descricao,
      status: "sent",
      templateId: templateId,
      templateRoles: [
        {
          roleName: "Sócio Aderente", // deve bater com o role configurado no template
          email: email,
          name: nome,
          tabs: {
            textTabs: [
              { tabLabel: "Nacionalidade", value: nacionalidade },
            ],
          },
        },
      ],
    };

    // 🔹 Chama API DocuSign
    const docusignApi = axios.create({
      baseURL: "https://na3.docusign.net/restapi",
    });

    const response = await docusignApi.post(
      `/v2.1/accounts/${accountId}/envelopes`,
      envelopeDefinition,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Envelope enviado com sucesso:", response.data);

    res.json({ success: true, data: response.data });

  } catch (err) {
    console.error("Erro ao enviar envelope:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
});

// 🔹 Inicializa servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
