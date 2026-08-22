import React, { useState, useRef, useEffect } from "react";
import { Button } from "./components/ui/button";
import { 
  FileText, Upload, CheckCircle, FileDown, 
  Settings, Loader2, LogOut, ShieldCheck, Download,
  UserCheck, BookOpen, Hash, Heading, Wand2, ImagePlus, Lock,
  User, Clock, Save, X
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import { useDropzone } from "react-dropzone";

type UserProfile = {
  name: string;
  institution: string;
  city: string;
  year: string;
  advisor: string;
};

type AuditLog = {
  action: string;
  content?: string;
  timestamp: string;
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [documentType, setDocumentType] = useState("artigo");
  const [customDocumentType, setCustomDocumentType] = useState("");
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  // Dados do Trabalho (ABNT)
  const [showWorkData, setShowWorkData] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [institution, setInstitution] = useState("");
  const [city, setCity] = useState("");
  const [year, setYear] = useState("");
  const [advisor, setAdvisor] = useState("");

  // Profile and Audit State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab] = useState<"dados" | "historico">("dados");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [generatedText, setGeneratedText] = useState("");
  const [authenticityReport, setAuthenticityReport] = useState("");
  const [formatRules, setFormatRules] = useState("");
  
  const attachmentRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'assistant', text: string}[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"generator" | "editor" | "report" | "chat">("generator");

  const logAction = (actionDesc: string, content?: string) => {
    setAuditLogs(prev => {
      const newLog = { action: actionDesc, content, timestamp: new Date().toISOString() };
      const updated = [newLog, ...prev];
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const filtered = updated.filter(log => new Date(log.timestamp) > oneWeekAgo);
      localStorage.setItem('emia_audit_logs', JSON.stringify(filtered));
      return filtered;
    });
  };

  useEffect(() => {
    // Load profile
    const storedProfile = localStorage.getItem('emia_user_profile');
    if (storedProfile) {
      try {
        const p: UserProfile = JSON.parse(storedProfile);
        if (p.name) setStudentName(p.name);
        if (p.institution) setInstitution(p.institution);
        if (p.city) setCity(p.city);
        if (p.year) setYear(p.year);
        if (p.advisor) setAdvisor(p.advisor);
      } catch (e) {}
    }

    // Load logs
    const storedLogs = localStorage.getItem('emia_audit_logs');
    if (storedLogs) {
      try {
        const logs: AuditLog[] = JSON.parse(storedLogs);
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const filtered = logs.filter(log => new Date(log.timestamp) > oneWeekAgo);
        setAuditLogs(filtered);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      logAction("Acesso ao sistema via Demonstração");
    }
  }, [isAuthenticated]);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="bg-blue-600 text-white w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">EMIA.EDUTECH</h1>
            <p className="text-gray-500 mt-2">Gere, formate e avalie seus trabalhos acadêmicos com Inteligência Artificial.</p>
          </div>
          <Button className="w-full" onClick={() => setIsAuthenticated(true)}>
            Entrar (Demonstração)
          </Button>
        </div>
      </div>
    );
  }

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("subtitle", subtitle);
      formData.append("documentType", documentType === "outros" ? customDocumentType : documentType);
      formData.append("prompt", prompt);
      
      // Send work data if any exists
      if (studentName) formData.append("studentName", studentName);
      if (institution) formData.append("institution", institution);
      if (city) formData.append("city", city);
      if (year) formData.append("year", year);
      if (advisor) formData.append("advisor", advisor);

      if (file) {
        formData.append("file", file);
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedText(data.text);
        setActiveTab("editor");
        logAction(`Geração de documento: ${title || documentType}`, data.text);
      } else {
        alert("Erro: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar conteúdo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormatABNT = async () => {
    if (!generatedText) {
      alert("Por favor, gere ou cole um texto no editor primeiro para formatar.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/format-abnt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: generatedText, rules: formatRules }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedText(data.text);
        logAction("Formatação ABNT aplicada", data.text);
      } else {
        alert("Erro: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao formatar.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckAuthenticity = async () => {
    if (!generatedText) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/check-authenticity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: generatedText }),
      });
      const data = await res.json();
      if (data.success) {
        setAuthenticityReport(data.report);
        setActiveTab("report");
        logAction("Verificação de plágio/IA realizada");
      } else {
        alert("Erro: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao verificar autenticidade.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCover = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: generatedText, title: title }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedText(data.text + "\n\n--- [NOVA PÁGINA] ---\n\n" + generatedText);
      } else {
        alert("Erro: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar capa.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaginate = async () => {
    if (!generatedText) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/paginate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: generatedText }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedText(data.text);
      } else {
        alert("Erro: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao paginar.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImproveText = async () => {
    if (!generatedText) return;

    let targetText = generatedText;
    let isSelection = false;
    let start = 0;
    let end = 0;

    if (textareaRef.current) {
      start = textareaRef.current.selectionStart;
      end = textareaRef.current.selectionEnd;
      if (start !== end) {
        targetText = generatedText.substring(start, end);
        isSelection = true;
      }
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/improve-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: targetText, rules: formatRules }),
      });
      const data = await res.json();
      if (data.success) {
        if (isSelection) {
          const newFullText = generatedText.substring(0, start) + data.text + generatedText.substring(end);
          setGeneratedText(newFullText);
        } else {
          setGeneratedText(data.text);
        }
      } else {
        alert("Erro: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao aprimorar texto.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttachmentFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result;
        const imageMarkdown = `\n\n![Figura inserida](${base64})\n\n`;
        setGeneratedText(prev => prev + imageMarkdown);
      };
      reader.readAsDataURL(file);
    } else if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        setIsLoading(true);
        try {
          const res = await fetch("/api/csv-to-table", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ csvData: content }),
          });
          const data = await res.json();
          if (data.success) {
            setGeneratedText(prev => prev + "\n\n" + data.text + "\n\n");
          } else {
            alert("Erro: " + data.error);
          }
        } catch (error) {
          console.error(error);
          alert("Erro ao processar tabela.");
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsText(file);
    } else {
       alert("Formato não suportado. Envie imagens (JPG/PNG) ou tabelas (CSV).");
    }
    
    if (attachmentRef.current) attachmentRef.current.value = "";
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMessage = chatMessage;
    setChatMessage("");
    const updatedHistory = [...chatHistory, { role: 'user' as const, text: userMessage }];
    setChatHistory(updatedHistory);
    setIsChatting(true);
    logAction("Envio de instrução/mensagem no Chat de Edição");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMessage, 
          history: chatHistory,
          context: generatedText // Send current document as context
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChatHistory([...updatedHistory, { role: 'assistant', text: data.text }]);
      } else {
        alert("Erro ao gerar resposta automática: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar mensagem.");
    } finally {
      setIsChatting(false);
    }
  };

  const exportPDF = () => {
    if (!generatedText) return;
    const doc = new jsPDF();
    
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    
    const lines = doc.splitTextToSize(generatedText, 170);
    let cursorY = 20;
    
    lines.forEach((line: string) => {
      if (cursorY > 280) {
        doc.addPage();
        cursorY = 20;
      }
      doc.text(line, 20, cursorY);
      cursorY += 7;
    });

    doc.save("trabalho-abnt.pdf");
  };

  const exportWord = async () => {
    if (!generatedText) return;
    const paragraphs = generatedText.split('\n').map(text => new Paragraph({
        children: [new TextRun(text)],
    }));

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "trabalho-abnt.docx");
  };

  const handleSaveProfile = () => {
    const profile = { name: studentName, institution, city, year, advisor };
    localStorage.setItem('emia_user_profile', JSON.stringify(profile));
    logAction('Atualização do perfil de usuário salva localmente');
    setShowProfileModal(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white w-8 h-8 rounded-md flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <span className="font-semibold text-gray-900 text-lg">EMIA.EDUTECH</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowProfileModal(true)} className="border-gray-200">
            <User className="w-4 h-4 mr-2" />
            Perfil e Histórico
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsAuthenticated(false)}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Novo Trabalho</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
                <select 
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                >
                  <option value="artigo">Artigo Acadêmico</option>
                  <option value="resumo">Resumo / Fichamento</option>
                  <option value="trabalho_academico">Trabalho Acadêmico (TCC)</option>
                  <option value="monografia">Monografia / Dissertação</option>
                  <option value="projeto">Projeto de Pesquisa</option>
                  <option value="artigo_opiniao">Artigo de Opinião</option>
                  <option value="resenha">Resenha Crítica</option>
                  <option value="estudo_caso">Estudo de Caso</option>
                  <option value="relatorio">Relatório Técnico</option>
                  <option value="artigo_cientifico">Artigo Científico</option>
                  <option value="redacao">Redação</option>
                  <option value="outros">Outros</option>
                </select>
                {documentType === "outros" && (
                  <div className="mt-2">
                    <input 
                      type="text" 
                      value={customDocumentType}
                      onChange={(e) => setCustomDocumentType(e.target.value)}
                      placeholder="Especifique o tipo de texto..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título / Tema</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Inteligência Artificial na Educação"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo (Opcional)</label>
                <input 
                  type="text" 
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Ex: Uma análise contemporânea"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instruções / Diretrizes</label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Escreva um artigo de 3 páginas abordando os impactos positivos..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm h-24 resize-none"
                />
              </div>

              <div>
                <Button 
                  onClick={() => setShowWorkData(!showWorkData)} 
                  variant="outline" 
                  className="w-full bg-gray-50 border-gray-300 hover:bg-gray-100 flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-gray-700">Dados do Trabalho (Capa ABNT)</span>
                  <span className="text-gray-500 text-xs">{showWorkData ? "Ocultar" : "Preencher"}</span>
                </Button>
                
                {showWorkData && (
                  <div className="mt-3 space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-md text-sm">
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">Nome do Aluno(a)</label>
                      <input 
                        type="text" 
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Ex: João da Silva"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">Instituição de Ensino</label>
                      <input 
                        type="text" 
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        placeholder="Ex: Universidade de São Paulo"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Cidade</label>
                        <input 
                          type="text" 
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Ex: São Paulo"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Ano</label>
                        <input 
                          type="text" 
                          value={year}
                          onChange={(e) => setYear(e.target.value)}
                          placeholder="Ex: 2024"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">Orientador(a) (Opcional)</label>
                      <input 
                        type="text" 
                        value={advisor}
                        onChange={(e) => setAdvisor(e.target.value)}
                        placeholder="Ex: Prof. Dr. Carlos Souza"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Button 
                  onClick={handleImproveText} 
                  disabled={isLoading || !generatedText} 
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white flex items-center justify-center gap-2"
                >
                  {isLoading && activeTab === 'editor' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  Aprimorar Texto com IA
                </Button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base de Conhecimento (Texto base)</label>
                <div 
                  {...getRootProps()} 
                  className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  {file ? (
                    <p className="text-sm font-medium text-blue-600 truncate">{file.name}</p>
                  ) : (
                    <p className="text-sm text-gray-500">Arraste um PDF/Word ou clique</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inserir no Documento (Imagens / Tabelas)</label>
                <Button 
                  onClick={() => attachmentRef.current?.click()} 
                  disabled={isLoading} 
                  variant="outline" 
                  className="w-full bg-gray-50 border-dashed border-2 hover:bg-gray-100 h-auto py-4 flex flex-col items-center justify-center gap-2"
                >
                  <ImagePlus className="w-6 h-6 text-gray-400" />
                  <span className="text-sm text-gray-500 font-normal">Adicionar Imagem ou Tabela (CSV)</span>
                </Button>
                <input 
                  type="file" 
                  className="hidden" 
                  ref={attachmentRef} 
                  accept="image/*,.csv,.txt" 
                  onChange={handleAttachmentFile} 
                />
              </div>

              <Button 
                onClick={handleGenerate} 
                disabled={isLoading || (!title && !file)} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4 py-3 font-semibold"
              >
                {isLoading && activeTab === 'generator' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Settings className="w-5 h-5 mr-2" />}
                Gerar Texto com IA
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Verificação e Exportação</h3>

            <Button onClick={handleCheckAuthenticity} disabled={isLoading || !generatedText} variant="outline" className="w-full justify-start">
              {isLoading && activeTab === 'report' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2 text-purple-600" />}
              Checar plágio ou IA
            </Button>
            
            <div className="pt-4 mt-2 border-t border-gray-100 grid grid-cols-2 gap-2">
              <Button onClick={exportPDF} disabled={!generatedText} variant="secondary" className="w-full text-xs">
                <Download className="w-3 h-3 mr-1" /> PDF
              </Button>
              <Button onClick={exportWord} disabled={!generatedText} variant="secondary" className="w-full text-xs">
                <FileDown className="w-3 h-3 mr-1" /> Word
              </Button>
            </div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="lg:col-span-8 flex flex-col h-[calc(100vh-8rem)]">
          
          <div className="flex border-b border-gray-200 mb-4 gap-4">
            <button 
              onClick={() => setActiveTab("editor")}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "editor" || activeTab === "generator" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              Documento Principal
            </button>
            <button 
              onClick={() => setActiveTab("chat")}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "chat" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              Chat para Edição e Consulta do Texto
            </button>
            <button 
              onClick={() => setActiveTab("report")}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "report" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              Relatório de Autenticidade
            </button>
          </div>

          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            {(activeTab === "editor" || activeTab === "generator") && (
              <div className="flex flex-col h-full relative">
                <textarea 
                  ref={textareaRef}
                  className="flex-1 w-full p-8 pb-28 resize-none focus:outline-none text-gray-800 text-justify text-[12pt] leading-[1.5] font-['Arial'] bg-gray-50/50 focus:bg-white transition-colors"
                  value={generatedText}
                  onChange={(e) => setGeneratedText(e.target.value)}
                  placeholder="Seu documento gerado aparecerá aqui...&#10;&#10;Dica: Você também pode colar seu próprio texto aqui e usar as ferramentas de edição ao lado para Formatar ou Humanizar."
                />
                
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gray-50 border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide pb-1">
                    <input 
                      type="text" 
                      value={formatRules}
                      onChange={(e) => setFormatRules(e.target.value)}
                      placeholder="Instruções extra de formatação (opcional)..."
                      className="w-64 flex-shrink-0 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <Button size="sm" onClick={handleFormatABNT} disabled={isLoading || !generatedText} className="flex-shrink-0 bg-gray-800 hover:bg-gray-900 text-white">
                      {isLoading && activeTab === 'editor' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Adequar à ABNT
                    </Button>
                    <Button size="sm" onClick={handleCheckAuthenticity} disabled={isLoading || !generatedText} variant="outline" className="flex-shrink-0">
                      {isLoading && activeTab === 'editor' ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-purple-600" /> : <ShieldCheck className="w-4 h-4 mr-2 text-purple-600" />}
                      Verificar plágio e IA
                    </Button>
                    <Button size="sm" onClick={handleGenerateCover} disabled={isLoading} variant="outline" className="flex-shrink-0">
                      {isLoading && activeTab === 'editor' ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-blue-600" /> : <BookOpen className="w-4 h-4 mr-2 text-blue-600" />}
                      Gerar Capa
                    </Button>
                    <Button size="sm" onClick={handlePaginate} disabled={isLoading || !generatedText} variant="outline" className="flex-shrink-0">
                      {isLoading && activeTab === 'editor' ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-emerald-600" /> : <Hash className="w-4 h-4 mr-2 text-emerald-600" />}
                      Paginar
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === "chat" && (
              <div className="flex flex-col h-full bg-gray-50/30">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {chatHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center">
                      <UserCheck className="w-12 h-12 mb-4 text-blue-200" />
                      <p>Olá! Sou o Assistente de Estudos do EMIA.EDUTECH.</p>
                      <p className="text-sm mt-2">Dúvidas sobre o texto gerado? Me faça uma pergunta! Eu lerei o seu documento e te ajudarei a compreender os conceitos de forma dinâmica. Você também pode me pedir para ajudar a modificar, editar ou reescrever partes do seu texto.</p>
                    </div>
                  ) : (
                    chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'}`}>
                          <div className={msg.role === 'user' ? '' : 'prose prose-sm'}>
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isChatting && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] p-4 rounded-xl text-sm bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm flex items-center">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600 mr-2" /> Gerando resposta...
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-white border-t border-gray-200">
                  <form onSubmit={handleSendMessage} className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Faça uma pergunta ou peça para gerar algo..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button type="submit" disabled={isChatting || !chatMessage.trim()} className="bg-blue-600">
                      Enviar
                    </Button>
                  </form>
                  <p className="text-xs text-center text-gray-400 flex items-center justify-center">
                    <Lock className="w-3 h-3 mr-1" />
                    Criptografia de ponta a ponta: apenas o remetente e o destinatário autorizado acessam as mensagens.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "report" && (
              <div className="w-full h-full p-8 overflow-y-auto prose prose-blue max-w-none font-sans text-gray-700">
                {authenticityReport ? (
                  <ReactMarkdown>{authenticityReport}</ReactMarkdown>
                ) : (
                  <p className="text-gray-400 italic">Nenhum relatório gerado ainda. Execute a Verificação de Autenticidade.</p>
                )}
              </div>
            )}
          </div>
        </div>

      </main>

      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Perfil e Configurações</h2>
              <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex border-b border-gray-100 px-6 pt-2">
              <button 
                onClick={() => setProfileTab('dados')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${profileTab === 'dados' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Meus Dados (Preenchimento Automático)
              </button>
              <button 
                onClick={() => setProfileTab('historico')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${profileTab === 'historico' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Histórico de Textos Gerados
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {profileTab === 'dados' ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-6">
                    Salve seus dados padrão. Eles serão preenchidos automaticamente na "Capa ABNT" e inseridos no cabeçalho e rodapé dos novos trabalhos.
                  </p>
                  
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                      <input 
                        type="text" 
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Ex: João da Silva"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Instituição de Ensino</label>
                      <input 
                        type="text" 
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        placeholder="Ex: Universidade de São Paulo"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                        <input 
                          type="text" 
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                        <input 
                          type="text" 
                          value={year}
                          onChange={(e) => setYear(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Orientador(a)</label>
                      <input 
                        type="text" 
                        value={advisor}
                        onChange={(e) => setAdvisor(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end">
                    <Button onClick={handleSaveProfile} className="bg-blue-600">
                      <Save className="w-4 h-4 mr-2" /> Salvar Perfil
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-6">
                    Abaixo está o registro de todos os textos gerados, formatados e humanizados durante os últimos 7 dias. Este banco de dados é controlado automaticamente para economizar espaço no seu navegador.
                  </p>
                  
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>Nenhum registro encontrado ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {auditLogs.map((log, idx) => (
                        <div key={idx} className="flex flex-col p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-gray-800">{log.action}</span>
                            <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                              {new Date(log.timestamp).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          {log.content && (
                            <div className="mt-2 p-3 bg-white rounded border border-gray-200 text-xs text-gray-600 font-serif max-h-40 overflow-y-auto whitespace-pre-wrap">
                              {log.content}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

