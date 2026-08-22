import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Helper to call Gemini
  async function generateFromText(prompt: string, maxRetries = 3) {
    const personaDirective = `\n\nDIRETRIZ DE IDENTIDADE E PAPEL:\n- Atue como um redator e editor acadêmico e científico.\n- Crie textos de alta qualidade mantendo um tom formal e rigoroso.\n- Analise textos para detectar a presença de plágio e verificar se foram gerados ou não por inteligência artificial quando solicitado.\n- Se necessário e apropriado para o contexto, gere tabelas e imagens para enriquecer o conteúdo e a compreensão do texto.\n- Permita e processe o texto inserido ou enviado pelo usuário para verificação de plágio e opções de humanização de forma precisa.`;
    const strictConstraint = personaDirective + "\n\nIMPORTANTE: Não inclua frases introdutórias, cabeçalhos ou rodapés no resultado. Retorne apenas o conteúdo gerado. NÃO utilize formatação Markdown (remova asteriscos **, hashtags #, etc). Entregue o resultado em texto limpo, como se tivesse sido escrito por um humano em um editor de texto comum. Garanta que o documento gerado mantenha uma formatação e layout impecáveis, idênticos aos de um arquivo criado no Microsoft Word, sem quebras de página ou problemas de renderização.\n\nDIRETRIZ PERMANENTE: Nunca invente informações. Todas as informações utilizadas para criar textos devem ser buscadas e verificadas em fontes seguras e confiáveis. Para consultas baseadas em documentos específicos, como a constituição ou um texto base enviado, limite a geração de respostas estritamente às informações contidas no documento fornecido ou referenciado, sem extrapolações.\n\nDIRETRIZ DE CONHECIMENTO FATUAL: Baseie suas respostas em fatos e conhecimento factual, consultando fontes externas confiáveis ou conhecimento atualizado, sem gerar suposições.";
    const finalPrompt = prompt + strictConstraint;

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: finalPrompt,
        });
        return response.text;
      } catch (error: any) {
        const isRateLimit = error?.status === 429 || error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
        if (isRateLimit) {
          attempt++;
          if (attempt >= maxRetries) {
            throw new Error("Limite de requisições excedido na API (429). Por favor, tente novamente mais tarde ou verifique os limites de cota.");
          }
          // The API asks to wait ~22s, so we wait 25s, then 50s
          const delay = attempt * 25000;
          console.warn(`[API Gemini] Limite de requisições 429 atingido. Tentativa ${attempt} falhou. Aguardando ${delay/1000}s antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  app.post("/api/generate", upload.single("file"), async (req, res) => {
    try {
      const { 
        title, subtitle, documentType, prompt,
        studentName, institution, city, year, advisor 
      } = req.body;
      const file = req.file;
      
      let context = "";
      if (file) {
        context = file.buffer.toString('utf-8');
      }

      const typeMap: Record<string, string> = {
        "artigo": "artigo acadêmico",
        "resumo": "resumo/fichamento",
        "trabalho_academico": "trabalho acadêmico completo (TCC)",
        "monografia": "monografia",
        "projeto": "projeto de pesquisa",
        "artigo_opiniao": "artigo de opinião",
        "resenha": "resenha crítica",
        "estudo_caso": "estudo de caso",
        "relatorio": "relatório técnico",
        "artigo_cientifico": "artigo científico",
        "redacao": "redação"
      };
      const selectedType = typeMap[documentType] || documentType || "artigo acadêmico";
      const subtitleText = subtitle ? ` - Subtítulo: ${subtitle}` : "";

      const hasWorkData = studentName || institution || city || year || advisor;
      const coverInstruction = hasWorkData ? `
      IMPORTANTE: Como os dados do trabalho foram fornecidos, INICIE o documento gerando a Capa e a Folha de Rosto estritamente nas normas ABNT antes de começar o texto.
      Utilize as informações:
      - Instituição: ${institution || "Não informado"}
      - Autor/Aluno: ${studentName || "Não informado"}
      - Título: ${title || "Não informado"}
      - Orientador: ${advisor || "Não informado"}
      - Cidade: ${city || "Não informado"}
      - Ano: ${year || "Não informado"}
      ` : "";

      const instruction = `Crie um(a) ${selectedType} detalhado(a) sobre o tema "${title || "Não informado"}"${subtitleText}.
      
      DIRETRIZES OBRIGATÓRIAS (HUMANIZAÇÃO E ABNT):
      1. Garanta a exclusividade de cada texto gerado, assegurando que, mesmo para temas semelhantes, o conteúdo final seja sempre original e diferente.
      2. Evite a geração ou replicação de conteúdos que infrinjam direitos de propriedade intelectual de terceiros. Garanta que todo o texto seja uma produção original e síntese nova.
      3. Escreva de forma absolutamente original e humanizada, garantindo que o texto seja indetectável por verificadores de plágio e ferramentas de IA.
      4. Evite jargões comuns de IA e estruture as frases com fluidez e variação natural.
      5. O texto INTEIRO já deve ser gerado seguindo RIGOROSAMENTE as normas da ABNT (estrutura, títulos, referências).
      6. Caso haja necessidade, gere também tabelas e imagens apropriadas para enriquecer o conteúdo e a compreensão do texto.

      ${coverInstruction}
      Instruções adicionais detalhadas: ${prompt || "Siga a estrutura padrão acadêmica apropriada (ex: Introdução, Desenvolvimento, Conclusão, Referências)."}
      
      ${context ? `Use o seguinte documento como base:\n${context.substring(0, 10000)}` : ""}`;

      const generatedText = await generateFromText(instruction);
      res.json({ success: true, text: generatedText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Falha ao gerar conteúdo" });
    }
  });

  app.post("/api/format-abnt", async (req, res) => {
    try {
      const { text, rules } = req.body;
      const rulesContext = rules ? `Instruções adicionais específicas: ${rules}` : "";
      const instruction = `Reescreva e estruture o texto a seguir estritamente de acordo com as normas da ABNT. 
      
DIRETRIZES ABNT OBRIGATÓRIAS:
1. Estrutura Textual: Organize o conteúdo em parágrafos claros, coesos e bem estruturados.
2. Citações: Se houver citações diretas ou indiretas, formate-as corretamente conforme as regras da ABNT (incluindo autor, ano, e página para citações diretas).
3. Títulos e Subtítulos: Organize hierarquicamente se necessário.
4. Formatação: O texto deve ser preparado para exibição com recuos de parágrafo. (A fonte Arial 12, espaçamento 1,5 e alinhamento justificado já estão sendo aplicados na interface, portanto, garanta que o texto gerado flua perfeitamente nesse padrão).

      ${rulesContext}
      Retorne APENAS o texto formatado e estruturado, sem comentários adicionais.\n\n${text}`;
      const formattedText = await generateFromText(instruction);
      res.json({ success: true, text: formattedText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Falha ao formatar" });
    }
  });

  app.post("/api/humanize", async (req, res) => {
    try {
      const { text } = req.body;
      const instruction = `Reescreva o seguinte texto acadêmico para que soe mais natural e humano, removendo clichês comuns de inteligência artificial (como "em suma", "é importante notar", etc.), variando a estrutura das frases e melhorando a fluidez, mas mantendo o rigor acadêmico e as informações originais.\n\nTexto:\n${text}`;
      const humanizedText = await generateFromText(instruction);
      res.json({ success: true, text: humanizedText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Falha ao humanizar" });
    }
  });

  app.post("/api/check-authenticity", async (req, res) => {
    try {
      const { text } = req.body;
      const instruction = `Analise o texto para detectar a presença de plágio e verifique se foi gerado ou não por inteligência artificial.\n\nTexto:\n${text}`;
      
      const report = await generateFromText(instruction);
      res.json({ success: true, report });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Falha ao verificar autenticidade" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, context, history } = req.body;
      
      let prompt = `Você é o assistente de IA para o texto gerado no aplicativo EMIA.EDUTECH. Seu objetivo é conversar de forma dinâmica, interativa e adaptável.
      Explique os pontos do texto gerado pela IA de maneira didática e clara, detalhando conceitos complexos em partes menores e mais acessíveis, e ajustando a linguagem ao nível do usuário.
      Incentive uma exploração mais profunda dos conceitos fazendo perguntas que estimulem o raciocínio crítico e a compreensão detalhada do conteúdo. Além disso, quando solicitado, auxilie o usuário a modificar, editar ou reescrever partes do texto gerado.
      
      Para garantir estabilidade, segurança e precisão, siga rigorosamente estas instruções:
      - Baseie todas as informações estritamente em fontes oficiais e artigos de pesquisa científica confiáveis.
      - Nunca invente ou especule sobre fatos não comprovados.
      - Garanta que novas operações sejam sempre aditivas, mantendo e fortalecendo as diretrizes de segurança originais.
      - Mantenha o modelo ESTRITAMENTE restrito ao conteúdo do último texto gerado.
      - Não busque informações externas, não alucine e não responda com fatos fora do contexto específico deste texto.`;
      
      if (context) {
        prompt += `\n\n[CONTEXTO DO DOCUMENTO ATUAL DO USUÁRIO]\n${context.substring(0, 5000)}\n[/CONTEXTO]`;
      }
      
      prompt += `\n\n[HISTÓRICO DA CONVERSA]\n${history.map((h:any) => `${h.role === 'user' ? 'Aluno' : 'Assistente'}: ${h.text}`).join('\n')}\n[/HISTÓRICO]`;
      prompt += `\n\nAluno: ${message}\nAssistente:`;

      const responseText = await generateFromText(prompt);
      res.json({ success: true, text: responseText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Falha ao gerar resposta" });
    }
  });

  app.post("/api/generate-cover", async (req, res) => {
    try {
      const { text, title } = req.body;
      const instruction = `Com base no texto a seguir (ou no tema: ${title || 'Não informado'}), crie a folha de Capa perfeitamente alinhada e formatada contendo TODOS os elementos obrigatórios exigidos pelas normas da ABNT.
      NOTA: Não crie ou sugira o uso de imagens de capa (as normas da ABNT não permitem imagens na capa de trabalhos acadêmicos). Gere exclusivamente os elementos textuais obrigatórios.
      
      Elementos obrigatórios que devem ser gerados, centralizados na página:
      [NOME DA INSTITUIÇÃO] (no topo)
      [NOME DO AUTOR]
      
      [TÍTULO DO TRABALHO EM DESTAQUE E MAIÚSCULAS]
      [SUBTÍTULO - se houver, em minúsculas]
      
      [CIDADE / LOCAL] (na parte inferior)
      [ANO DE ENTREGA] (na parte inferior)
      
      Retorne APENAS o texto da capa formatado com quebras de linha para simular os espaços corretos. Nenhuma outra mensagem.\n\nTexto/Tema:\n${text ? text.substring(0, 3000) : "Sem texto"}`;
      
      const coverText = await generateFromText(instruction);
      res.json({ success: true, text: coverText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Falha ao gerar capa" });
    }
  });

  app.post("/api/paginate", async (req, res) => {
    try {
      const { text } = req.body;
      const instruction = `Organize o texto acadêmico a seguir numerando automaticamente todas as páginas do documento, seguindo a posição e o formato exigidos pelas normas da ABNT.
      
      Regras de Paginação da ABNT:
      1. A contagem de páginas começa na capa, mas a numeração NÃO deve ser exibida nela nem em elementos pré-textuais (como folha de rosto e sumário).
      2. A numeração visual (impressa) só deve começar a aparecer no início da Introdução (elementos textuais).
      3. A numeração deve aparecer no canto superior direito.
      
      Como este é um documento em texto contínuo, simule a numeração dividindo o texto em páginas de tamanho razoável e inserindo a marcação "--- [Página X] ---" (no topo à direita da quebra de página) onde a numeração visual deve aparecer, mantendo a contagem correta desde a capa.
      
      Texto Original:\n${text}`;
      
      const paginatedText = await generateFromText(instruction);
      res.json({ success: true, text: paginatedText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Falha ao paginar" });
    }
  });

  app.post("/api/improve-text", async (req, res) => {
    try {
      const { text, rules } = req.body;
      const extra = rules ? `\n\nInstruções extras do usuário: ${rules}` : "";
      const instruction = `Revise e aprimore o conteúdo a seguir para melhorar a gramática e a clareza, mantendo a mesma estrutura original.${extra}\n\nTexto original:\n${text}`;
      
      const improvedText = await generateFromText(instruction);
      res.json({ success: true, text: improvedText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Falha ao melhorar texto" });
    }
  });

  app.post("/api/csv-to-table", async (req, res) => {
    try {
      const { csvData } = req.body;
      const instruction = `Transforme os dados a seguir (formato CSV/Texto) em uma Tabela Markdown bem formatada, adequada para um trabalho acadêmico (normas ABNT). Adicione um título genérico de tabela acima se necessário.\n\nDados:\n${csvData}`;
      
      const tableText = await generateFromText(instruction);
      res.json({ success: true, text: tableText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Falha ao gerar tabela" });
    }
  });

  // Catch unmatched API routes so they don't return index.html
  app.use("/api", (req, res) => {
    res.status(404).json({ success: false, error: "API route not found" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
