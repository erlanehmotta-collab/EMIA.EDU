/**
 * EMIA.EDUTECH - Especificação Global e Algoritmos de Normalização ABNT
 * Baseado nas diretrizes oficiais da ABNT, UNESP Franca e ECA-USP
 */

export interface ABNTGlobalConfig {
  paperSize: "A4";
  dimensionsCm: { width: 21.0; height: 29.7 };
  margins: {
    top: "3.0cm";
    left: "3.0cm";
    bottom: "2.0cm";
    right: "2.0cm";
  };
  typography: {
    options: ["Arial", "Times New Roman"];
    sizeMainText: "12pt";
    sizeReducedElements: "10pt";
  };
  lineSpacing: {
    mainText: 1.5;
    reducedElements: 1.0;
    paragraphSpacingAfter: "0pt";
  };
  alignment: {
    body: "justified";
    references: "left";
    cover: "center";
  };
  indentation: {
    firstLineParagraph: "1.25cm";
    longCitationLeft: "4.0cm";
    titlePageNatureLeft: "7.5cm";
  };
}

export type DocumentTypeKey =
  | "monografia"
  | "trabalho_academico"
  | "artigo"
  | "artigo_cientifico"
  | "artigo_opiniao"
  | "resumo"
  | "resumo_expandido"
  | "resenha"
  | "projeto"
  | "relatorio"
  | "especializacao"
  | "redacao"
  | "estudo_caso";

export interface DocumentTypeMatrix {
  name: string;
  norm: string;
  hasIndependentCover: boolean;
  hasTitlePage: boolean;
  hasTOC: boolean;
  visiblePageNumberStartsAt: "textual" | "page_1" | "none";
  textFlow: "chapter_breaks" | "continuous";
  description: string;
}

export const ABNT_DOCUMENTS_MATRIX: Record<DocumentTypeKey, DocumentTypeMatrix> = {
  monografia: {
    name: "Monografia / TCC / Tese",
    norm: "ABNT NBR 14724",
    hasIndependentCover: true,
    hasTitlePage: true,
    hasTOC: true,
    visiblePageNumberStartsAt: "textual",
    textFlow: "chapter_breaks",
    description: "Estrutura pré-textual completa (Capa, Folha de Rosto, Folha de Aprovação, Resumo, Abstract, Sumário) com quebras a cada capítulo."
  },
  trabalho_academico: {
    name: "Trabalho Acadêmico (TCC)",
    norm: "ABNT NBR 14724",
    hasIndependentCover: true,
    hasTitlePage: true,
    hasTOC: true,
    visiblePageNumberStartsAt: "textual",
    textFlow: "chapter_breaks",
    description: "Trabalho de Conclusão de Curso com Capa, Folha de Rosto e numeração a partir da Introdução."
  },
  artigo: {
    name: "Artigo Acadêmico",
    norm: "ABNT NBR 6022",
    hasIndependentCover: false,
    hasTitlePage: false,
    hasTOC: false,
    visiblePageNumberStartsAt: "page_1",
    textFlow: "continuous",
    description: "Inicia no topo da página 1 com Título, Autoria, Resumo e Seções em fluxo contínuo."
  },
  artigo_cientifico: {
    name: "Artigo Científico",
    norm: "ABNT NBR 6022",
    hasIndependentCover: false,
    hasTitlePage: false,
    hasTOC: false,
    visiblePageNumberStartsAt: "page_1",
    textFlow: "continuous",
    description: "Artigo para publicação periódica: cabeçalho na página 1, sem capa avulsa."
  },
  artigo_opiniao: {
    name: "Artigo de Opinião",
    norm: "Gênero Jornalístico / Acadêmico",
    hasIndependentCover: false,
    hasTitlePage: false,
    hasTOC: false,
    visiblePageNumberStartsAt: "page_1",
    textFlow: "continuous",
    description: "Texto opinativo e dissertativo com título, autor e fluxo contínuo."
  },
  resumo: {
    name: "Resumo / Fichamento",
    norm: "ABNT NBR 6028",
    hasIndependentCover: false,
    hasTitlePage: false,
    hasTOC: false,
    visiblePageNumberStartsAt: "page_1",
    textFlow: "continuous",
    description: "Parágrafo único justificado (150 a 500 palavras) sem recuo e finalizado com Palavras-chave."
  },
  resumo_expandido: {
    name: "Resumo Expandido",
    norm: "ABNT NBR 6028",
    hasIndependentCover: false,
    hasTitlePage: false,
    hasTOC: false,
    visiblePageNumberStartsAt: "page_1",
    textFlow: "continuous",
    description: "Resumo estruturado em seções curtas (Introdução, Metodologia, Resultados, Referências) em fluxo contínuo."
  },
  resenha: {
    name: "Resenha Crítica",
    norm: "ABNT NBR 6028 & NBR 10520",
    hasIndependentCover: false,
    hasTitlePage: false,
    hasTOC: false,
    visiblePageNumberStartsAt: "page_1",
    textFlow: "continuous",
    description: "Inicia com a Referência completa da obra analisada no topo, identificação do resenhista e texto crítico contínuo."
  },
  projeto: {
    name: "Projeto de Pesquisa",
    norm: "ABNT NBR 15287",
    hasIndependentCover: true,
    hasTitlePage: true,
    hasTOC: true,
    visiblePageNumberStartsAt: "textual",
    textFlow: "chapter_breaks",
    description: "Estrutura prévia com Capa, Folha de Rosto, Sumário, Justificativa, Metodologia e Cronograma em tabela IBGE."
  },
  relatorio: {
    name: "Relatório Técnico / Científico",
    norm: "ABNT NBR 10719",
    hasIndependentCover: true,
    hasTitlePage: true,
    hasTOC: true,
    visiblePageNumberStartsAt: "textual",
    textFlow: "chapter_breaks",
    description: "Relatório de investigações ou estágio com Capa, Folha de Rosto, Sumário, Núcleo Técnico e Recomendações."
  },
  especializacao: {
    name: "Monografia de Especialização (Lato Sensu)",
    norm: "ABNT NBR 14724",
    hasIndependentCover: true,
    hasTitlePage: true,
    hasTOC: true,
    visiblePageNumberStartsAt: "textual",
    textFlow: "chapter_breaks",
    description: "Monografia com nota de apresentação específica para obtenção do título de Especialista."
  },
  redacao: {
    name: "Redação Dissertativo-Argumentativa",
    norm: "Padrão ENEM",
    hasIndependentCover: false,
    hasTitlePage: false,
    hasTOC: false,
    visiblePageNumberStartsAt: "none",
    textFlow: "continuous",
    description: "Prosa contínua em 4 parágrafos com proposta de intervenção de 5 elementos."
  },
  estudo_caso: {
    name: "Estudo de Caso",
    norm: "ABNT NBR 6022",
    hasIndependentCover: false,
    hasTitlePage: false,
    hasTOC: false,
    visiblePageNumberStartsAt: "page_1",
    textFlow: "continuous",
    description: "Diagnóstico aplicado em fluxo contínuo com cabeçalho institucional na 1ª página."
  }
};

/**
 * Algoritmo Oficial de Paginação ABNT:
 * Conta todas as páginas desde a folha de rosto (a capa não é contada e nem numerada),
 * mas apenas exibe o número no Canto Superior Direito a partir dos Elementos Textuais (Introdução).
 */
export function calculateABNTPagination(
  pages: string[],
  docType: DocumentTypeKey
): { pageNumber: number; isVisible: boolean }[] {
  const matrix = ABNT_DOCUMENTS_MATRIX[docType] || ABNT_DOCUMENTS_MATRIX.monografia;
  
  if (!matrix.hasIndependentCover) {
    return pages.map((_, idx) => ({
      pageNumber: idx + 1,
      isVisible: matrix.visiblePageNumberStartsAt === "page_1"
    }));
  }

  let counter = 1;
  return pages.map((_, idx) => {
    if (idx === 0) {
      return { pageNumber: 1, isVisible: false };
    }
    const currentNum = counter;
    counter++;
    const isTextualOrPost = idx >= 2;
    return {
      pageNumber: currentNum,
      isVisible: isTextualOrPost && matrix.visiblePageNumberStartsAt === "textual"
    };
  });
}
