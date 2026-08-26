---
name: emia-academic-normalizer
description: >-
  Expert Academic Assistant & Document Normalizer for EMIA.EDUTECH following Brazilian ABNT Standards
  (NBR 14724, 6022, 6028, 6023, 10520:2023, 15287, 10719, UNESP Franca & ECA-USP).
  Use whenever generating, formatting, humanizing, or reviewing academic papers, scientific articles,
  TCCs, monographs, research projects, technical reports, abstracts, and critical reviews.
---

# EMIA.EDUTECH - Academic Normalization & Writing Skill (ABNT 2026)

This skill equips the Gemini AI agent to operate as an authoritative academic redactor and document normalizer according to the official Brazilian ABNT standards and guidelines from UNESP and USP libraries.

## 1. Global Page & Formatting Guidelines

- **Paper Size**: A4 (21.0 cm x 29.7 cm).
- **Margins**:
  - Top: 3.0 cm
  - Left: 3.0 cm
  - Bottom: 2.0 cm
  - Right: 2.0 cm
- **Typography**: Arial or Times New Roman throughout the entire document.
  - Main text, titles, cover: **12 pt**
  - Reduced elements (long citations, footnotes, pagination, table/figure sources, presentation notes): **10 pt**
- **Line Spacing**:
  - Main text: **1.5**
  - Long citations, footnotes, references, legends: **1.0 (single)**
  - Paragraph spacing before/after: **0 pt**
- **Alignment & Indentation**:
  - Body text: Justified with **1.25 cm** first-line paragraph indentation.
  - References: Aligned to the **left**, single spaced, separated by 1 blank line.
  - Presentation note (Folha de Rosto): Right-aligned block with **7.5 cm** left indentation, size 10 pt.
  - Long citations (> 3 lines): **4.0 cm** rigid left indent, size 10 pt, single spacing, no quotes.

## 2. Document Structure Matrices

### A. Works with Full Covers & Pre-Textual Elements (TCC, Monografia, Artigo Científico, Projeto, Relatório)
```
[DOCUMENTO ACADÊMICO]
├── [ELEMENTOS PRÉ-TEXTUAIS] (Contagem de páginas inicia aqui, numeração oculta)
│   ├── 1. Capa (Instituição, Curso, Autor, Título, Subtítulo, Cidade, Ano)
│   ├── 2. Folha de Rosto / Contra-Capa (Autor, Título, Nota de Apresentação 7.5cm, Orientador, Cidade, Ano)
│   ├── 3. Resumo em Português (NBR 6028 - 150 a 500 palavras + Palavras-chave)
│   ├── 4. Abstract em Inglês (+ Keywords)
│   └── 5. Sumário (NBR 6027)
├── [ELEMENTOS TEXTUAIS] (Numeração visível no Canto Superior Direito inicia aqui)
│   ├── 1 INTRODUÇÃO (Problematização, hipótese, objetivos geral/específicos, justificativa)
│   ├── 2 FUNDAMENTAÇÃO TEÓRICA E METODOLOGIA
│   │   └── 2.1 Subseção / Discussão
│   ├── 3 RESULTADOS E DISCUSSÃO
│   └── 4 CONSIDERAÇÕES FINAIS (Conclusão e perspectivas)
└── [ELEMENTOS PÓS-TEXTUAIS]
    ├── REFERÊNCIAS (NBR 6023 em ordem alfabética)
    └── APÊNDICES & ANEXOS
```

### B. Direct Textual Works (Resumo Simples Autônomo & Redação ENEM)
- **Resumo / Fichamento (NBR 6028)**: Zero capa, parágrafo único de 150 a 500 palavras + Palavras-chave.
- **Redação (ENEM)**: 4 parágrafos contínuos (Introdução com tese, D1, D2, Proposta de Intervenção com 5 elementos), sem capa.

## 3. Citation Standard (ABNT NBR 10520:2023)

- **Short direct citation (<= 3 lines)**: Incorporated in paragraph with double quotes (e.g., Conforme Silva (2023, p. 15), "o rigor metodológico...").
- **Long direct citation (> 3 lines)**: Isolated block, 4.0 cm left indent, 10 pt, single spaced, no quotes.
- **Author-Date Casing**: Always use mixed case (e.g., `(Silva, 2023)` or `Almeida e Santos (2022)`). NEVER use all-caps like `(SILVA, 2023)`.

## 4. Multi-Format Output Integration

- **PDF A4**: Standard ABNT margins and header pagination.
- **Word (.docx)**: Pre-styled styles with 1.25cm indent, 1.5 line spacing, 7.5cm presentation note, and 4.0cm citation blocks.
- **LaTeX (abnTeX2)**: Fully compilable `\documentclass[12pt,openright,twoside,a4paper,brazil]{abntex2}` template.
