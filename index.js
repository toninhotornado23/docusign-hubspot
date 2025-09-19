import express from "express";
import fs from "fs";
import path from "path";
import axios from "axios";
import docusign from "docusign-esign";

const app = express();
app.use(express.json());

// 🔹 Rota de teste
app.get("/", (req, res) => {
  res.send("Servidor DocuSign-HubSpot rodando! ✅");
});

// 🔹 Endpoint que o HubSpot vai chamar
app.post("/enviar-envelope", async (req, res) => {
  try {
    console.log("➡️ Payload recebido do HubSpot:", req.body);

    // ⚙️ Configurações do DocuSign (valores fixos)
    const integratorKey = "32b34d39-c4ea-4174-9820-699a1ef7f266"; // Client ID
    const userId = "4af0ba80-6b88-402d-a245-2751083f8a5c"; // GUID do usuário
    const accountId = "69784ef8-1393-4d49-927c-af9a1caed068"; // ID da conta
    const templateId = "2aebf175-843a-470a-89ae-b956a397dfd7"; // ID do template
    const authServer = "account.docusign.com"; // produção
    const privateKeyPath = path.resolve("private.key");
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
    console.log("✅ Novo access_token gerado:", accessToken);

    // 🔹 Campos recebidos do HubSpot
    const {
      firstname: nome,
      nome_completo,
      nacionalidade,
      relationship_status: estado_civil,
      rg,
      cpf_cnpj,
      email,
      address: rua,
      city,
      state,
      naturalidade,
      orgao_emissor_do_rg,
      zip,
      numero__endereco_,
      bairro__distrito,
      r__mutuo_total,
      remuneracao_mensal,
      data_inicial__controle_financeiro_,
      data_final__controle_financeiro_,
      vencimento__controle_mutuo_,
      complemento,
      data_de_hoje,
      empresa,
      regime_de_casamento,
      job_function: profissao
    } = req.body;

    const endereco_completo = `${rua} - ${city}/${state}`;

    function dateFormated(val) {
      return new Date(parseInt(val)).toLocaleDateString("pt-br");
    }

    function currencyFormated(val) {
      return parseFloat(val).toLocaleString("pt-br", {
        style: "currency",
        currency: "BRL",
      });
    }

    // 🔹 Monta envelope
    const envelopeDefinition = {
      emailSubject: `Termo de Adesão ao Acordo de Sócios | ${nome_completo}`,
      emailBlurb:
        "<p>Olá Sócio Acqua Vero, boa tarde! Você está recebendo o Termo de Adesão ao Acordo de Sócios conforme estabelece o Contrato Social...</p><br /><p>Atenciosamente,<br />Jurídico AVIN</p>",
      status: "sent",
      templateId: templateId,
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
              { tabLabel: "Naturalidade", value: naturalidade },
              { tabLabel: "CEP", value: zip },
              { tabLabel: "Número_Endereço", value: numero__endereco_ },
              { tabLabel: "Data_de_hoje", value: dateFormated(data_de_hoje) },
              { tabLabel: "Rua_Endereço", value: rua },
              { tabLabel: "Bairro_Endereço", value: bairro__distrito },
              { tabLabel: "Cidade", value: city },
              { tabLabel: "complemento", value: complemento },
              { tabLabel: "Estado", value: state },
              { tabLabel: "RG", value: rg },
              { tabLabel: "Orgao_Emissor", value: orgao_emissor_do_rg },
              { tabLabel: "NomeCompletoHS", value: nome_completo },
              { tabLabel: "CPF", value: cpf_cnpj },
              { tabLabel: "Email", value: email },
              { tabLabel: "Valor_total_mutuo", value: currencyFormated(r__mutuo_total) },
              { tabLabel: "Valor_parcela_mutuo", value: currencyFormated(remuneracao_mensal) },
              { tabLabel: "Data_inicial_mutuo", value: dateFormated(data_inicial__controle_financeiro_) },
              { tabLabel: "Data_final_mutuo", value: dateFormated(data_final__controle_financeiro_) },
              { tabLabel: "vencimento__controle_mutuo_", value: vencimento__controle_mutuo_ },
              { tabLabel: "profissao", value: profissao },
              { tabLabel: "Endereco", value: endereco_completo },
            ],
          },
        },
        {
          roleName: "Testemunha 1",
          email: "eferreira@acquavero.com.br",
          name: "Edna Ferreira da Silva Marcolino",
        },
        {
          roleName: "Testemunha 2",
          email: "rcarvalho@avinoffice.com.br",
          name: "Raquel Mathias Carvalho Guerreiro",
        },
      ],
    };

    // 🔹 Envia para DocuSign
    const docusignApi = axios.create({ baseURL: "https://na3.docusign.net/restapi" });
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

    console.log("✅ Envelope enviado:", response.data);
    res.json({ success: true, data: response.data });
  } catch (err) {
    console.error("❌ Erro ao enviar envelope:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// 🔹 Inicializa servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
