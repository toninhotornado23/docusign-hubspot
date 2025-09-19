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

// 🔹 Endpoint principal
app.post("/enviar-envelope", (req, res) => {
  console.log("Payload recebido do HubSpot:", req.body);

  // ✅ Responde imediatamente ao HubSpot para evitar timeout
  res.json({ received: true });

  // 🔹 Processamento assíncrono
  (async () => {
    try {
      // ⚙️ Configurações DocuSign
      const integratorKey = "32b34d39-c4ea-4174-9820-699a1ef7f266";
      const userId = "4af0ba80-6b88-402d-a245-2751083f8a5c";
      const accountId = "69784ef8-1393-4d49-927c-af9a1caed068";
      const templateId = "2aebf175-843a-470a-89ae-b956a397dfd7";
      const authServer = "account.docusign.com"; // produção

      const privateKeyPath = path.resolve("private.key");
      console.log("📂 Lendo chave privada em:", privateKeyPath);
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
        rg, cpf_cnpj, address: rua, city, state, naturalidade,
        complemento, zip, numero__endereco_, bairro__distrito,
        r__mutuo_total, remuneracao_mensal, data_inicial__controle_financeiro_,
        data_final__controle_financeiro_, vencimento__controle_mutuo_, job_function,
        regime_de_casamento, data_de_hoje
      } = req.body;

      // Conversões de data/valor (mesmo que estava funcionando)
      const dateFormated = (val) => new Date(parseInt(val)).toLocaleDateString('pt-br');
      const currencyFormated = (val) => parseFloat(val).toLocaleString('pt-br',{ style: 'currency', currency: 'BRL' });

      const envelopeDefinition = {
        emailSubject: `Termo de Adesão ao Acordo de Sócios | ${nome_completo}`,
        emailBlurb: `<p>Olá Sócio Acqua Vero, boa tarde! Você está recebendo o Termo de Adesão ao Acordo de Sócios conforme estabelece o Contrato Social...</p>`,
        status: "sent",
        templateId: templateId,
        templateRoles: [
          {
            roleName: "Sócio Aderente",
            email: email,
            name: nome_completo,
            tabs: {
              textTabs: [
                { tabLabel: "Nacionalidade", value: nacionalidade },
                { tabLabel: "EstadoCivil", value: relationship_status },
                { tabLabel: "Regime de Casamento", value: regime_de_casamento },
                { tabLabel: "Naturalidade", value: naturalidade },
                { tabLabel: "CEP", value: zip },
                { tabLabel: "Número_Endereço", value: numero__endereco_ },
                { tabLabel: "Data_de_hoje", value: data_de_hoje },
                { tabLabel: "Rua_Endereço", value: rua },
                { tabLabel: "Bairro_Endereço", value: bairro__distrito },
                { tabLabel: "Cidade", value: city },
                { tabLabel: "complemento", value: complemento },
                { tabLabel: "Estado", value: state },
                { tabLabel: "RG", value: rg },
                { tabLabel: "Orgao_Emissor", value: req.body.orgao_emissor_do_rg },
                { tabLabel: "NomeCompletoHS", value: nome_completo },
                { tabLabel: "CPF", value: cpf_cnpj },
                { tabLabel: "Email", value: email },
                { tabLabel: "Valor_total_mutuo", value: currencyFormated(r__mutuo_total) },
                { tabLabel: "Valor_parcela_mutuo", value: currencyFormated(remuneracao_mensal) },
                { tabLabel: "Data_inicial_mutuo", value: dateFormated(data_inicial__controle_financeiro_) },
                { tabLabel: "Data_final_mutuo", value: dateFormated(data_final__controle_financeiro_) },
                { tabLabel: "vencimento__controle_mutuo_", value: vencimento__controle_mutuo_ },
                { tabLabel: "profissao", value: job_function },
                { tabLabel: "Endereco", value: `${rua} - ${city}/${state}` }
              ]
            }
          },
          {
            roleName: "Testemunha 1",
            email: "eferreira@acquavero.com.br",
            name: "Edna Ferreira da Silva Marcolino"
          },
          {
            roleName: "Testemunha 2",
            email: "rcarvalho@avinoffice.com.br",
            name: "Raquel Mathias Carvalho Guerreiro"
          }
        ]
      };

      // 🔹 Envio do envelope
      const docusignApi = axios.create({ baseURL: "https://na3.docusign.net/restapi" });
      const response = await docusignApi.post(
        `/v2.1/accounts/${accountId}/envelopes`,
        envelopeDefinition,
        { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
      );

      console.log("✅ Envelope enviado com sucesso:", response.data);

    } catch (err) {
      console.error("❌ Erro ao enviar envelope:", err.response?.data || err.message);
    }
  })();
});

// 🔹 Inicializa servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
