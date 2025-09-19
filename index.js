import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
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
    console.log("Payload recebido do HubSpot:", req.body);

    // ⚙️ Configurações do DocuSign
    const integratorKey = "32b34d39-c4ea-4174-9820-699a1ef7f266";
    const userId = "4af0ba80-6b88-402d-a245-2751083f8a5c";
    const accountId = "69784ef8-1393-4d49-927c-af9a1caed068";
    const templateId = "2aebf175-843a-470a-89ae-b956a397dfd7";
    const authServer = "account.docusign.com";
    const privateKeyPath = path.resolve("private.key");
    const privateKey = fs.readFileSync(privateKeyPath, "utf8");

    // 🔑 Autenticação JWT
    const dsApiClient = new docusign.ApiClient();
    dsApiClient.setOAuthBasePath(authServer);

    const results = await dsApiClient.requestJWTUserToken(
      integratorKey,
      userId,
      ["signature", "impersonation"],
      privateKey,
      3600
    );

    const accessToken = results.body.access_token;
    console.log("✅ Novo access_token gerado:", accessToken);

    // 🔹 Campos do HubSpot
    const {
      nome, email, nome_completo, nacionalidade, relationship_status,
      rg, cpf_cnpj, address, city, state, naturalidade, orgao_emissor_do_rg,
      zip, numero__endereco_, bairro__distrito, complemento,
      r__mutuo_total, remuneracao_mensal, data_inicial__controle_financeiro_,
      data_final__controle_financeiro_, vencimento__controle_mutuo_, job_function, data_de_hoje
    } = req.body;

    const endereco_completo = `${address} - ${city}/${state}`;

    // Funções de formatação
    const dateFormated = val => new Date(parseInt(val)).toLocaleDateString('pt-br');
    const currencyFormated = val => parseFloat(val).toLocaleString('pt-br',{style:'currency',currency:'BRL'});

    const Valor_total_mutuo = currencyFormated(r__mutuo_total);
    const Valor_parcela_mutuo = currencyFormated(remuneracao_mensal);
    const Data_inicial_mutuo = dateFormated(data_inicial__controle_financeiro_);
    const Data_final_mutuo = dateFormated(data_final__controle_financeiro_);
    const Data_hoje = dateFormated(data_de_hoje);

    const assunto = "Termo de Adesão ao Acordo de Sócios | " + nome_completo;
    const descricao = "<p>Olá Sócio Acqua Vero, boa tarde! Você está recebendo o Termo de Adesão ao Acordo de Sócios conforme estabelece o Contrato Social. Para assinatura será necessário que seu e-CPF esteja conectado ao computador. Caso tenha dificuldade, entre em contato com sua certificadora.</p><br /><p>Atenciosamente,<br />Jurídico AVIN</p>";

    // 🔹 Monta envelope
    const envelopeDefinition = {
      emailSubject: assunto,
      emailBlurb: descricao,
      status: "sent",
      templateId: templateId,
      templateRoles: [
        {
          roleName: "Sócio Aderente",
          email: email,
          name: nome,
          tabs: {
            textTabs: [
              { tabLabel: "Nacionalidade", value: nacionalidade },
              { tabLabel: "EstadoCivil", value: relationship_status },
              { tabLabel: "Regime de Casamento", value: "" }, // se necessário
              { tabLabel: "Naturalidade", value: naturalidade },
              { tabLabel: "CEP", value: zip },
              { tabLabel: "Número_Endereço", value: numero__endereco_ },
              { tabLabel: "Data_de_hoje", value: Data_hoje },
              { tabLabel: "Rua_Endereço", value: address },
              { tabLabel: "Bairro_Endereço", value: bairro__distrito },
              { tabLabel: "Cidade", value: city },
              { tabLabel: "complemento", value: complemento },
              { tabLabel: "Estado", value: state },
              { tabLabel: "RG", value: rg },
              { tabLabel: "Orgao_Emissor", value: orgao_emissor_do_rg },
              { tabLabel: "NomeCompletoHS", value: nome_completo },
              { tabLabel: "CPF", value: cpf_cnpj },
              { tabLabel: "Email", value: email },
              { tabLabel: "Valor_total_mutuo", value: Valor_total_mutuo },
              { tabLabel: "Valor_parcela_mutuo", value: Valor_parcela_mutuo },
              { tabLabel: "Data_inicial_mutuo", value: Data_inicial_mutuo },
              { tabLabel: "Data_final_mutuo", value: Data_final_mutuo },
              { tabLabel: "vencimento__controle_mutuo_", value: vencimento__controle_mutuo_ },
              { tabLabel: "profissao", value: job_function },
              { tabLabel: "Endereco", value: endereco_completo }
            ]
          }
        },
        { roleName: "Testemunha 1", email: "eferreira@acquavero.com.br", name: "Edna Ferreira da Silva Marcolino" },
        { roleName: "Testemunha 2", email: "rcarvalho@avinoffice.com.br", name: "Raquel Mathias Carvalho Guerreiro" }
      ]
    };

    // 🔹 Chama API DocuSign
    const docusignApi = axios.create({ baseURL: "https://na3.docusign.net/restapi" });
    const response = await docusignApi.post(
      `/v2.1/accounts/${accountId}/envelopes`,
      envelopeDefinition,
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );

    console.log("✅ Envelope enviado com sucesso:", response.data);

    // 🔹 Retorno limpo para HubSpot
    res.json({ success: true, data: response.data });

  } catch (err) {
    console.error("❌ Erro ao enviar envelope:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// 🔹 Inicializa servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
