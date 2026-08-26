import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import dotenv from "dotenv";

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Validadores para evitar envio de OAuth tokens ou strings inválidas como API Key
  function isValidGeminiKey(key?: string | null): boolean {
    if (!key) return false;
    const clean = key.trim();
    return clean.length >= 20 && clean.startsWith("AIzaSy");
  }

  function isValidOpenaiKey(key?: string | null): boolean {
    if (!key) return false;
    const clean = key.trim();
    return clean.length >= 20 && clean.startsWith("sk-");
  }

  // Helper to dynamically get Google GenAI client or OpenAI credentials
  function getAiCredentials(req?: express.Request) {
    const provider = (req?.headers["x-ai-provider"] as string) || "gemini";
    
    // Procura chave Gemini válida (AIzaSy...)
    const geminiCandidate = (req?.headers["x-gemini-api-key"] as string) || 
                            (req?.headers["x-google-api-key"] as string) || 
                            process.env.GEMINI_API_KEY ||
                            process.env.GOOGLE_API_KEY ||
                            process.env.VITE_GEMINI_API_KEY;

    const userGeminiKey = isValidGeminiKey(geminiCandidate) ? geminiCandidate!.trim() : null;

    // Procura chave OpenAI válida (sk-...)
    const openaiCandidate = (req?.headers["x-openai-api-key"] as string) ||
                            process.env.OPENAI_API_KEY ||
                            process.env.VITE_OPENAI_API_KEY;

    const userOpenaiKey = isValidOpenaiKey(openaiCandidate) ? openaiCandidate!.trim() : null;

    const geminiClient = userGeminiKey 
      ? new GoogleGenAI({ apiKey: userGeminiKey }) 
      : null;

    return {
      provider,
      geminiKey: userGeminiKey,
      geminiClient,
      openaiKey: userOpenaiKey,
    };
  }

  // Helper to call OpenAI ChatGPT API
  async function generateFromOpenAI(prompt: string, apiKey: string, isDocument = true) {
    const systemPrompt = isDocument 
      ? "Você é um redator e editor acadêmico sênior especializado em normas ABNT NBR 14724. Retorne apenas o conteúdo solicitado sem introduções ou frases de cortesia. Nunca use Markdown desnecessário em documentos que simulam Word/A4."
      : "Você é um tutor acadêmico e assistente educacional no EMIA.EDUTECH. Responda de forma didática, clara e prestativa.";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Erro na API OpenAI (Status ${response.status})`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "";
  }

  // Helper to call Gemini / OpenAI with automatic fallback & retries
  async function generateFromText(prompt: string, req?: express.Request, maxRetries = 5, isDocument = true) {
    const personaDirective = `\n\nDIRETRIZ DE IDENTIDADE E PAPEL:\n- Atue como um redator e editor acadêmico e científico.\n- Crie textos de alta qualidade mantendo um tom formal e rigoroso.\n- Analise textos para detectar a presença de plágio e verificar se foram gerados ou não por inteligência artificial quando solicitado.\n- Se necessário e apropriado para o contexto, gere tabelas e imagens para enriquecer o conteúdo e a compreensão do texto.\n- Permita e processe o texto inserido ou enviado pelo usuário para verificação de plágio e opções de humanização de forma precisa.`;
    const strictConstraint = "\n\nIMPORTANTE: Não inclua frases introdutórias, cabeçalhos ou rodapés no resultado. Retorne apenas o conteúdo gerado. NÃO utilize formatação Markdown (remova asteriscos **, hashtags #, etc). Entregue o resultado em texto limpo, como se tivesse sido escrito por um humano em um editor de texto comum. Garanta que o documento gerado mantenha uma formatação e layout impecáveis, idênticos aos de um arquivo criado no Microsoft Word, sem inserção textual de marcações de 'quebra de página' visíveis na impressão final.\n\nDIRETRIZ PERMANENTE: Nunca invente informações. Todas as informações utilizadas para criar textos devem ser buscadas e verificadas em fontes seguras e confiáveis. Para consultas baseadas em documentos específicos, como a constituição ou um texto base enviado, limite a geração de respostas estritamente às informações contidas no documento fornecido ou referenciado, sem extrapolações.\n\nDIRETRIZ DE CONHECIMENTO FATUAL: Baseie suas respostas em fatos e conhecimento factual, consultando fontes externas confiáveis ou conhecimento atualizado, sem gerar suposições.";
    const chatConstraint = "\n\nIMPORTANTE: Responda diretamente e de forma clara, utilizando formatação em Markdown (como negrito, listas e blocos de código) para facilitar a leitura. Seja prestativo e ajude a esclarecer dúvidas ou refinar o texto.";
    
    const finalPrompt = prompt + personaDirective + (isDocument ? strictConstraint : chatConstraint);
    const { provider, geminiClient, geminiKey, openaiKey } = getAiCredentials(req);

    // 1. Se o usuário escolheu OpenAI ChatGPT ou informou chave OpenAI
    if ((provider === "openai" || !geminiClient) && openaiKey) {
      return await generateFromOpenAI(finalPrompt, openaiKey, isDocument);
    }

    // 2. Se temos cliente Google Gemini configurado
    if (geminiClient && geminiKey) {
      let attempt = 0;
      while (attempt < maxRetries) {
        try {
          const response = await geminiClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents: finalPrompt,
          });
          return response.text;
        } catch (error: any) {
          const status = error?.status || error?.error?.code || error?.error?.status;
          const msg = error?.message || '';
          
          const isRateLimit = status === 429 || status === 'RESOURCE_EXHAUSTED' || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
          const isOverloaded = status === 503 || status === 'UNAVAILABLE' || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
          
          if (isRateLimit || isOverloaded) {
            attempt++;
            if (attempt >= maxRetries) {
              // Se tiver chave OpenAI como fallback, tenta OpenAI
              if (openaiKey) {
                return await generateFromOpenAI(finalPrompt, openaiKey, isDocument);
              }
              throw new Error("Aguarde e tente novamente, tráfego elevado na IA.");
            }
            const delay = isOverloaded ? 4000 * attempt : 8000 * attempt;
            console.warn(`[API Gemini] Erro temporário (${isOverloaded ? '503 Overloaded' : '429 Rate Limit'}). Tentativa ${attempt} falhou. Aguardando ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // Se falhar e tiver OpenAI, tenta fallback
            if (openaiKey) {
              return await generateFromOpenAI(finalPrompt, openaiKey, isDocument);
            }
            throw error;
          }
        }
      }
    }

    // 3. Se nenhuma chave foi encontrada
    throw new Error("Nenhuma conexão de IA (Google Gemini ou ChatGPT) encontrada. Conecte sua Conta Google ou informe sua Chave de IA no app.");
  }

  app.post("/api/generate", upload.array("files"), async (req, res) => {
    try {
      const { 
        title, subtitle, documentType, prompt,
        studentName, course, institution, city, year, advisor 
      } = req.body;
      const files = req.files as Express.Multer.File[];
      
      let context = "";
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            if (file.originalname.toLowerCase().endsWith(".pdf") || file.mimetype === "application/pdf") {
              const pdfData = await pdfParse(file.buffer);
              context += `\n--- Arquivo: ${file.originalname} ---\n${pdfData.text}\n`;
            } else if (file.originalname.toLowerCase().endsWith(".docx") || file.mimetype.includes("wordprocessingml")) {
              const result = await mammoth.extractRawText({ buffer: file.buffer });
              context += `\n--- Arquivo: ${file.originalname} ---\n${result.value}\n`;
            } else {
              context += `\n--- Arquivo: ${file.originalname} ---\n${file.buffer.toString('utf-8')}\n`;
            }
          } catch (e) {
            console.error("Erro ao ler arquivo:", e);
          }
        }
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

      const hasWorkData = studentName || course || institution || city || year || advisor;
      const coverInstruction = hasWorkData ? `
      IMPORTANTE: Como os dados do trabalho foram fornecidos, INICIE o documento estruturando a Capa e a Folha de Rosto estritamente nas normas ABNT.
      Simule o espaçamento e a hierarquia visual usando quebras de linha e CAIXA ALTA onde necessário.
      - Capa: NOME DA INSTITUIÇÃO no topo (caixa alta), NOME DO CURSO (se houver, abaixo da instituição), NOME DO AUTOR em seguida (caixa alta), TÍTULO no meio da página (caixa alta e destaque), CIDADE e ANO na parte inferior.
      - Folha de Rosto: NOME DO AUTOR no topo, TÍTULO no meio, Nota de apresentação (ex: "Trabalho apresentado...") simulando recuo com o Curso (${course}) e Orientador (${advisor}), CIDADE e ANO na parte inferior.
      - Adicione o marcador explícito "--- [QUEBRA DE PÁGINA] ---" entre a capa, a folha de rosto e o início do texto.

      Utilize as informações:
      - Instituição: ${institution || "Não informado"}
      - Curso: ${course || "Não informado"}
      - Autor/Aluno: ${studentName || "Não informado"}
      - Título: ${title || "Não informado"}
      - Orientador: ${advisor || "Não informado"}
      - Cidade: ${city || "Não informado"}
      - Ano: ${year || "Não informado"}
      ` : "";

      const instruction = `Crie um(a) ${selectedType} detalhado(a) sobre o tema "${title || "Não informado"}"${subtitleText}.
      
      DIRETRIZES OBRIGATÓRIAS (HUMANIZAÇÃO E ABNT):
      1. ALTA BURSTINESS E PERPLEXIDADE: Intercale frases curtas e diretas com períodos mais longos e complexos. Use um vocabulário rico, orgânico e menos previsível para quebrar os padrões matemáticos de detecção de IA.
      2. ZERO CLICHÊS DE IA: É ESTRITAMENTE PROIBIDO usar transições artificiais como "Em suma", "Vale ressaltar", "É importante notar", "No cenário atual", "Podemos concluir", "Desde os primórdios", "Além disso". Faça conexões lógicas e diretas.
      3. RITMO HUMANO: O texto DEVE ser indetectável por ferramentas como GPTZero ou Turnitin. Simule o ritmo cognitivo humano, com argumentação progressiva, fluxo natural e pausas retóricas.
      4. ORIGINALIDADE: Todo o conteúdo deve ser 100% autoral, garantindo zero plágio em verificadores.
         6. Caso haja necessidade, gere também tabelas e imagens apropriadas para enriquecer o conteúdo.

      ${coverInstruction}
      Instruções adicionais detalhadas: ${prompt || "Siga a estrutura padrão acadêmica apropriada (ex: Introdução, Desenvolvimento, Conclusão, Referências)."}
      
      ${context ? `Use o seguinte documento como base:\n${context.substring(0, 10000)}` : ""}`;

      // PASSO 1: Geração Bruta
      let generatedText = await generateFromText(instruction, req);

      // PASSO 2a: Filtro Determinístico de Varredura (Remoção de rastros e clichês)
      let deterministicFiltered = generatedText
        .replace(/^```[a-z]*\n?/gm, "")
        .replace(/```$/gm, "")
        .replace(/^(Aqui está.*|Com certeza!.*|Claro,.*|Segue o.*|Espero que.*|Nota do modelo:.*|Como um assistente.*|Entendido.*)$/gim, "")
        .replace(/\b(Contudo,)\b/gi, "No entanto,")
        .replace(/\b(Diante disso,)\b/gi, "Assim,")
        .replace(/\b(No panorama atual,)\b/gi, "Atualmente,")
        .replace(/\b(Vale ressaltar que)\b/gi, "Nota-se que")
        .replace(/\b(É importante notar que)\b/gi, "Observa-se que")
        .replace(/\b(Podemos concluir que)\b/gi, "Dessa forma,")
        .replace(/\b(Em suma,)\b/gi, "Em síntese,")
        .replace(/\b(Desde os primórdios,)\b/gi, "Historicamente,")
        .trim();

      // PASSO 2b: Filtro Estocástico de Humanização (Anti-IA)
      const humanizeInstruction = `Você é a camada de sanitização final estocástica. Sua tarefa é reescrever o texto a seguir para destruir 100% da assinatura de IA (perplexidade artificial e cadência previsível), garantindo aprovação em detectores como Turnitin/GPTZero, mas mantendo o rigor acadêmico intacto.

Diretrizes Estritas de Pós-Processamento:
1. Eliminar Cadência Monótona: Quebre a estrutura matemática de parágrafos. Intercale parágrafos curtos (2-3 linhas) com densos (5-6 linhas) simulando a respiração e o fluxo cognitivo humano.
2. Variação Sintática (Burstiness): Force a variação de ritmo usando orações diretas e incisivas contrastando com períodos longos. 
3. Vocabulário Orgânico (Alta Perplexidade): Fuja do rebuscamento óbvio da IA. Substitua palavras estatisticamente previsíveis por escolhas precisas do jargão acadêmico, sem exageros.
4. Remoção Definitiva de Clichês e Transições Artificiais: Zere o uso de "Além disso", "Neste contexto", "Sendo assim" em inícios de parágrafos sequenciais.
5. PRESERVAÇÃO ESTRUTURAL ABNT: Preserve rigorosamente qualquer marcação de "--- [QUEBRA DE PÁGINA] ---", CAIXA ALTA (como Capa e Sumário). Aplique a humanização apenas no texto discursivo.
6. ZERO METADADOS: Retorne EXCLUSIVAMENTE o documento final, sem cabeçalhos, sem saudações e sem comentários.

Texto bruto para sanitização estocástica:
\n${deterministicFiltered}`;
      
      generatedText = await generateFromText(humanizeInstruction, req);
      
      // Varredura final de segurança
      generatedText = generatedText
        .replace(/^```[a-z]*\n?/gm, "")
        .replace(/```$/gm, "")
        .replace(/^(Aqui está.*|Com certeza!.*|Claro,.*|Segue o.*|Espero que.*|Nota do modelo:.*)$/gim, "")
        .trim();

      res.json({ success: true, text: generatedText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Falha ao gerar conteúdo" });
    }
  });

  app.post("/api/extract", upload.array("files"), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      let context = "";
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            if (file.originalname.toLowerCase().endsWith(".pdf") || file.mimetype === "application/pdf") {
              const pdfData = await pdfParse(file.buffer);
              context += `\n\n--- Início do Arquivo: ${file.originalname} ---\n\n${pdfData.text}\n`;
            } else if (file.originalname.toLowerCase().endsWith(".docx") || file.mimetype.includes("wordprocessingml")) {
              const result = await mammoth.extractRawText({ buffer: file.buffer });
              context += `\n\n--- Início do Arquivo: ${file.originalname} ---\n\n${result.value}\n`;
            } else {
              context += `\n\n--- Início do Arquivo: ${file.originalname} ---\n\n${file.buffer.toString('utf-8')}\n`;
            }
          } catch (e) {
            console.error("Erro ao ler arquivo para extração:", e);
          }
        }
      }
      
      res.json({ success: true, text: context.trim() });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Falha ao extrair textos" });
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
      const formattedText = await generateFromText(instruction, req);
      res.json({ success: true, text: formattedText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Falha ao formatar" });
    }
  });

  app.post("/api/generate-reference", async (req, res) => {
    try {
      const { source, style } = req.body;
      const formatStyle = style === 'APA' ? 'apa' : 'associacao-brasileira-de-normas-tecnicas';
      
      let doiMatch = source.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
      
      if (doiMatch) {
        const doi = doiMatch[0];
        const url = `https://doi.org/${doi}`;
        const response = await fetch(url, {
            headers: { "Accept": `text/x-bibliography; style=${formatStyle}` },
            redirect: 'follow'
        });
        
        if (response.ok) {
            const data = await response.text();
            return res.json({ success: true, text: data.trim() });
        }
      }
      
      // Fallback para IA se não for DOI ou falhar
      const instruction = `Gere a referência bibliográfica no formato ${style} para a seguinte fonte (livro, site, artigo ou link):\n${source}\nRetorne APENAS a referência formatada, de forma limpa, sem asteriscos ou formatações Markdown.`;
      const formattedReference = await generateFromText(instruction, req);
      res.json({ success: true, text: formattedReference });
      
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Falha ao gerar referência" });
    }
  });

  app.post("/api/humanize", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, error: "Texto não fornecido para humanização." });
      }

      const instruction = `Atue como um escritor e editor humano de alto nível. Sua tarefa é reescrever o texto a seguir com máxima naturalidade para contornar 100% de detectores de IA (Turnitin, GPTZero, CopyLeaks):

DIRETRIZES DE HUMANIZAÇÃO:
1. ALTA BURSTINESS (Variação de Ritmo): Intercale frases curtas, incisivas e dinâmicas com períodos mais elaborados. Elimine a cadência robótica previsível.
2. ALTA PERPLEXIDADE: Utilize um vocabulário rico, variado e orgânico. Fuja de fórmulas matemáticas e clichês de modelos de linguagem.
3. ZERO CLICHÊS DE IA: É ESTRITAMENTE PROIBIDO utilizar: "Em suma", "Vale ressaltar", "É importante notar", "No panorama atual", "Podemos concluir", "Desde os primórdios", "Além disso", "Neste sentido".
4. PRESERVAÇÃO DE FATOS E ESTRUTURA: Mantenha as citações, conceitos e argumentação científica do texto original.
5. RESPOSTA DIRETA: Retorne APENAS o texto reescrito, sem introduções ou frases de cortesia.

Texto para humanizar:\n${text}`;

      let humanizedText = await generateFromText(instruction, req, 5, true);
      
      // Limpeza estocástica e determinística de vestígios
      humanizedText = (humanizedText || "")
        .replace(/^```[a-z]*\n?/gm, "")
        .replace(/```$/gm, "")
        .replace(/^(Aqui está.*|Com certeza!.*|Claro,.*|Segue o.*|Espero que.*|Nota do modelo:.*)$/gim, "")
        .replace(/\b(Contudo,)\b/gi, "No entanto,")
        .replace(/\b(Diante disso,)\b/gi, "Assim,")
        .replace(/\b(No panorama atual,)\b/gi, "Atualmente,")
        .replace(/\b(Vale ressaltar que)\b/gi, "Nota-se que")
        .replace(/\b(É importante notar que)\b/gi, "Observa-se que")
        .replace(/\b(Podemos concluir que)\b/gi, "Dessa forma,")
        .replace(/\b(Em suma,)\b/gi, "Em síntese,")
        .trim();

      res.json({ success: true, text: humanizedText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Falha ao humanizar" });
    }
  });

  app.post("/api/check-authenticity", async (req, res) => {
    try {
      const { text } = req.body;
      const instruction = `Analise o texto para detectar a presença de plágio e verifique se foi gerado ou não por inteligência artificial.\n\nTexto:\n${text}`;
      
      const report = await generateFromText(instruction, req);
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

      const responseText = await generateFromText(prompt, req, 5, false);
      res.json({ success: true, text: responseText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Falha ao gerar resposta" });
    }
  });

  app.post("/api/generate-cover", async (req, res) => {
    try {
      const { text, title, subtitle, studentName, institution, course, city, year, advisor, documentType } = req.body;
      
      const instName = (institution || "NOME DA INSTITUIÇÃO DE ENSINO").toUpperCase();
      const courseName = course ? course.toUpperCase() : "";
      const authorName = (studentName || "NOME DO AUTOR DO TRABALHO").toUpperCase();
      const docTitle = (title || "TÍTULO DO TRABALHO ACADÊMICO").toUpperCase();
      const docSubtitle = subtitle ? ` - ${subtitle}` : "";
      const docCity = (city || "CIDADE - UF").toUpperCase();
      const docYear = year || new Date().getFullYear().toString();
      const docType = documentType ? documentType.toUpperCase() : "TRABALHO ACADÊMICO";
      const advText = advisor ? `Orientador(a): ${advisor}` : "";

      // CAPA ABNT NBR 14724 (Folha A4)
      const coverPage = `${instName}${courseName ? `\n${courseName}` : ""}\n\n\n\n${authorName}\n\n\n\n\n\n\n\n${docTitle}${docSubtitle}\n\n\n\n\n\n\n\n\n\n${docCity}\n${docYear}`;

      // FOLHA DE ROSTO ABNT NBR 14724 (Folha A4)
      const titlePage = `${authorName}\n\n\n\n\n\n\n\n${docTitle}${docSubtitle}\n\n\n\n                                          ${docType} apresentado à ${instName}${courseName ? ` como requisito parcial de avaliação para o curso de ${courseName}` : ""}.\n${advText ? `\n                                          ${advText}` : ""}\n\n\n\n\n\n\n\n${docCity}\n${docYear}`;

      const fullCover = `${coverPage}\n\n--- [QUEBRA DE PÁGINA] ---\n\n${titlePage}\n\n--- [QUEBRA DE PÁGINA] ---`;
      
      res.json({ success: true, text: fullCover });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Falha ao gerar capa" });
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
      
      const paginatedText = await generateFromText(instruction, req);
      res.json({ success: true, text: paginatedText });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Falha ao paginar" });
    }
  });

  app.post("/api/improve-text", async (req, res) => {
    try {
      const { text, rules } = req.body;
      const extra = rules ? `\n\nInstruções extras do usuário: ${rules}` : "";
      
      const instruction = `Atue como um escritor e editor humano de excelência. Sua tarefa é reescrever o texto a seguir de forma que contorne 100% dos detectores de IA (Turnitin, GPTZero, etc), mantendo o significado original e o rigor.${extra}

Aplique as seguintes técnicas rigorosamente:
1. Alta Burstiness (Variação de Ritmo): Intercale frases curtas, impactantes e diretas com frases mais longas. O ritmo não pode ser monótono ou matemático.
2. Alta Perplexidade (Vocabulário Orgânico): Evite as palavras e estruturas estatisticamente prováveis. Use vocabulário preciso e fuja do rebuscamento artificial.
3. Estrutura de Parágrafos Irregular: Parágrafos humanos variam de tamanho. Crie parágrafos de 2 linhas e outros de 5 ou 6 linhas.
4. Remoção de Marcadores de IA: É estritamente PROIBIDO usar transições robóticas como: "Em suma", "Vale ressaltar", "É importante notar", "No cenário atual", "Podemos concluir", "Além disso", "Por outro lado", "Neste contexto", "Crucial", "Desde os primórdios".
5. Voz Ativa e Direta: Vá direto ao ponto sem enrolação, eliminando a voz passiva excessiva.
6. Zero Formatação Extra: Não inclua introduções. Apenas devolva o texto reescrito.
7. PRESERVAÇÃO ESTRUTURAL ABNT: Se o texto original contiver uma Capa, Folha de Rosto, Sumário ou marcações como "--- [QUEBRA DE PÁGINA] ---", você DEVE mantê-los exatamente como estão, com as mesmas informações (caixa alta, alinhamentos simulados). Aplique a humanização e variação de ritmo APENAS no corpo textual (introdução, desenvolvimento, etc).

Texto original:\n${text}`;
      
      const improvedText = await generateFromText(instruction, req);
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
      
      const tableText = await generateFromText(instruction, req);
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
