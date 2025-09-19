import express from "express";
import fs from "fs";
import path from "path";
import docusign from "docusign-esign";

const app = express();
app.use(express.json());

// 🔹 Rota de teste
app.get("/", (req, res) => {
  res.send("Servidor DocuSign-HubSpot rodando! ✅");
});

// 🔹 Endpoint que o HubSpot chama
app.post("/enviar-envelope", async (req, res) => {
  try {
    console.log("➡️ Payload recebido do HubSpot:", req.body);

    // ⚙️ Configurações do DocuSign (Render → Environment Variables)
    const integratorKey = process.env.DOCUSIGN_INTEGRATOR_KEY; 
    const userId = process.env.DOCUSIGN_USER_ID; 
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID; 
    const templateId = process.env.DOCUSIGN_TEMPLATE_ID; 
    const authServer = "account.docusign.com"; // Produção
    const privateKeyPath = path.resolve("private.key");
    const privateKey = fs.readFileSync(privateKeyPath);

    // 🔑 Autenticação JWT → gera access_token
    const dsApiClient = new docusign.ApiClient();
    dsApiClient.setOAuthBasePath(authServer);

    console.log("⚙️ Gerando novo access_token...");
    const results = await dsApiClient.requestJWTUserToken(
      integratorKey,
      userId,
      ["signature", "impersonation"],
      privateKey,
      3600
    );

    const accessToken = results.body.access_token;
    console.log("✅ Novo access_token gerado com sucesso.");

    // 🔹 Pega dados do HubSpot
    const { nome, email, nome_completo, nacionalidade } = req.body;

    const assunto = `Termo de Adesão | ${nome_completo}`;
    const descricao =
      "<p>Olá Sócio Acqua Vero, boa tarde! Você está recebendo o Termo de Adesão ao Acordo de Sócios conforme estabelece o Contrato Social.</p>";

    // 🔹 Monta envelope usando template
    const envelopeDefinition = {
      emailSubject: assunto,
      emailBlurb: descricao,
      status: "sent",
      templateId: templateId,
      templateRoles: [
        {
          roleName: "Sócio Aderente", // deve bater com o Role do template
          email,
          name: nome,
          tabs: {
            textTabs: [
              { tabLabel: "Nacionalidade", value: nacionalidade },
            ],
          },
        },
      ],
    };

    // 🔹 Envia envelope
    const envelopesApi = new docusign.EnvelopesApi(dsApiClient);
    dsApiClient.addDefaultHeader("Authorization", `Bearer ${accessToken}`);

    const response = await envelopesApi.createEnvelope(accountId, {
      envelopeDefinition,
    });

    console.log("📩 Envelope enviado com sucesso:", response);
    res.json({ success: true, data: response });

  } catch (err) {
    console.error("❌ Erro ao enviar envelope:", err.response?.body || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.body || err.message,
    });
  }
});

// 🔹 Inicializa servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
