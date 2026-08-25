const text = `
1. Introdução
Este é um texto de teste.

2. METODOLOGIA
Aqui vai a metodologia.
2.1 Tipo de Pesquisa
Teste
3 CONCLUSÃO
Fim.
3.1.2 Sub-conclusão
Mais texto.
# 4. Outro teste
## 4.1 Teste Markdown
`;

function generateTOC(text) {
  const lines = text.split('\n');
  const tocLines = [];
  const headingRegex = /^(?:#+\s*)?(?:(\d+(?:\.\d+)*\.?)\s+)?([A-ZÀ-Ú][^\n]{2,})$/;
  
  lines.forEach(line => {
    let cleanLine = line.trim();
    // match numbered headings or Markdown headings
    const isMarkdown = /^#+\s+/.test(cleanLine);
    const isNumbered = /^\d+(?:\.\d+)*\.?\s+[A-ZÀ-Ú]/.test(cleanLine);
    // ABNT typically has fully uppercase main headings, but let's be flexible
    if (isMarkdown || isNumbered) {
        // remove markdown hashes
        cleanLine = cleanLine.replace(/^#+\s*/, '');
        // format nicely for TOC
        tocLines.push(cleanLine);
    }
  });
  return tocLines;
}

console.log(generateTOC(text));
