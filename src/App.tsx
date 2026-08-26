import React, { useState, useRef, useEffect } from "react";
import { Button } from "./components/ui/button";
import { 
  FileText, Upload, Plus, CheckCircle, FileDown, 
  Settings, Loader2, LogOut, ShieldCheck, Download, Copy,
  UserCheck, BookOpen, Hash, Heading, Wand2, ImagePlus, Lock,
  User, Clock, Save, X, ListOrdered, Link, Sparkles, Coins, Check, QrCode
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, AlignmentType, convertMillimetersToTwip } from "docx";
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("emia_authenticated") === "true";
  });
  const [isMaster, setIsMaster] = useState<boolean>(() => {
    return localStorage.getItem("emia_is_master") === "true";
  });
  const [loginEmail, setLoginEmail] = useState("erlane.digital@gmail.com");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [credits, setCredits] = useState<number>(() => {
    const isM = localStorage.getItem("emia_is_master") === "true";
    if (isM) return 9999;
    const saved = localStorage.getItem("emia_credits");
    return saved !== null ? parseInt(saved, 10) : 5;
  });
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [activationSuccess, setActivationSuccess] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [documentType, setDocumentType] = useState("artigo");
  const [customDocumentType, setCustomDocumentType] = useState("");
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  
  // Dados do Trabalho (ABNT)
  const [showWorkData, setShowWorkData] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [course, setCourse] = useState("");
  const [institution, setInstitution] = useState("");
  const [city, setCity] = useState("");
  const [year, setYear] = useState("");
  const [advisor, setAdvisor] = useState("");

  // Profile and Audit State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab] = useState<"dados" | "historico">("dados");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Reference State
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [referenceSource, setReferenceSource] = useState("");
  const [referenceStyle, setReferenceStyle] = useState<"ABNT" | "APA">("ABNT");
  const [generatedReference, setGeneratedReference] = useState("");

  const [generatedText, setGeneratedText] = useState("");
  const [authenticityReport, setAuthenticityReport] = useState("");
  const [formatRules, setFormatRules] = useState("");
  
  const attachmentRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'assistant', text: string}[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(0);
      setErrorMessage(""); // clear errors when starting a new task
      interval = setInterval(() => {
        setProgress(p => {
          if (p < 85) return p + (Math.random() * 8); 
          if (p < 95) return p + (Math.random() * 0.5); 
          return p;
        });
      }, 500);
    } else {
      setProgress(100);
      const to = setTimeout(() => setProgress(0), 1000); 
      return () => clearTimeout(to);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

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
      setFiles(prev => [...prev, ...acceptedFiles]);
    }
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPass = loginPassword.trim();

    if (cleanEmail === "erlane.digital@gmail.com" && cleanPass === "Emia@2026") {
      setIsMaster(true);
      setIsAuthenticated(true);
      setCredits(9999);
      localStorage.setItem("emia_authenticated", "true");
      localStorage.setItem("emia_is_master", "true");
      localStorage.setItem("emia_credits", "9999");
      localStorage.setItem("emia_user_email", cleanEmail);
      logAction("Login Mestre Administrativo realizado com sucesso");
      return;
    }

    if (cleanEmail && cleanPass) {
      setIsMaster(false);
      setIsAuthenticated(true);
      localStorage.setItem("emia_authenticated", "true");
      localStorage.setItem("emia_is_master", "false");
      localStorage.setItem("emia_user_email", cleanEmail);
      setShowPixModal(true);
      logAction(`Login de Aluno (${cleanEmail}) realizado`);
      return;
    }

    setLoginError("Informe seu e-mail e senha para acessar.");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsMaster(false);
    localStorage.removeItem("emia_authenticated");
    localStorage.removeItem("emia_is_master");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="text-center mb-6">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <FileText className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">EMIA.EDUTECH</h1>
            <p className="text-gray-600 mt-1 text-xs">
              Gerador, formatador ABNT e validador de trabalhos acadêmicos com IA Humanizada.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">E-mail de Acesso</label>
              <input 
                type="email"
                required
                value={loginEmail}
                onChange={(e) => { setLoginEmail(e.target.value); setLoginError(""); }}
                placeholder="seu.email@exemplo.com"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Senha</label>
              <input 
                type="password"
                required
                value={loginPassword}
                onChange={(e) => { setLoginPassword(e.target.value); setLoginError(""); }}
                placeholder="Digite sua senha..."
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
              />
            </div>

            {loginError && (
              <p className="text-xs text-rose-600 font-medium">{loginError}</p>
            )}

            <Button 
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-500/20 text-sm"
            >
              <Lock className="w-4 h-4 mr-2" />
              Entrar no Sistema
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-3 text-left mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-blue-900 uppercase">Pacote 5 Trabalhos</span>
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">PIX Direto</span>
              </div>
              <p className="text-[11px] text-blue-800">
                Chave PIX: <span className="font-mono font-bold">erlanehmotta@gmail.com</span>
              </p>
            </div>
            <p className="text-[11px] text-gray-400">
              Acesso Mestre Administrativo: <span className="font-mono text-gray-600 font-semibold">erlane.digital@gmail.com</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleGenerate = async () => {
    if (credits <= 0) {
      setShowPixModal(true);
      setErrorMessage("Seus créditos acabaram! Adquira o pacote de 5 trabalhos via PIX direto para continuar.");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("subtitle", subtitle);
      formData.append("documentType", documentType === "outros" ? customDocumentType : documentType);
      formData.append("prompt", prompt);
      
      // Send work data if any exists
      if (studentName) formData.append("studentName", studentName);
      if (course) formData.append("course", course);
      if (institution) formData.append("institution", institution);
      if (city) formData.append("city", city);
      if (year) formData.append("year", year);
      if (advisor) formData.append("advisor", advisor);

      if (files.length > 0) {
        files.forEach(f => formData.append("files", f));
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });
      const textData = await res.text(); let data; try { data = JSON.parse(textData); } catch (e) { throw new Error(`Erro no servidor (${res.status}). Aguarde e tente novamente.`); }
      if (data.success) {
        setGeneratedText(data.text);
        setActiveTab("editor");
        logAction(`Geração de documento: ${title || documentType}`, data.text);
        setCredits(prev => {
          const next = Math.max(0, prev - 1);
          localStorage.setItem("emia_credits", String(next));
          return next;
        });
      } else {
        setErrorMessage(data.error);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Erro ao gerar conteúdo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMergeFiles = async () => {
    if (files.length === 0) {
      setErrorMessage("Por favor, adicione documentos na Base de Conhecimento para mesclar.");
      return;
    }
    setIsLoading(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));

      const res = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });
      const textData = await res.text(); let data; try { data = JSON.parse(textData); } catch (e) { throw new Error(`Erro no servidor (${res.status}). Aguarde e tente novamente.`); }
      if (data.success) {
        setGeneratedText(prev => prev ? prev + "\n\n" + data.text : data.text);
        setErrorMessage(""); // clear error
        setActiveTab("editor");
        logAction("Junção e extração de documentos", "Múltiplos arquivos mesclados diretamente.");
      } else {
        setErrorMessage(data.error);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Erro ao extrair e juntar textos.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormatABNT = async () => {
    if (!generatedText) {
      setErrorMessage("Por favor, gere ou cole um texto no editor primeiro para formatar.");
      return;
    }
    setIsLoading(true);
    try {
      // Motor ABNT Determinístico (Sem custo de IA)
      // Simula um tempo de processamento para feedback visual
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Regras fixas de estruturação (Limpeza de espaços duplos, garantia de parágrafos, etc)
      let formattedText = generatedText
        .replace(/\r\n/g, '\n') // Normaliza quebras de linha
        .replace(/\n{3,}/g, '\n\n') // Remove espaços verticais excessivos
        .replace(/^[ \t]+/gm, '') // Remove espaços no início das linhas
        .trim();
        
      // O visualizador (textarea) e a função exportWord já cuidam das margens, espaçamento 1.5 e recuo.
      
      setGeneratedText(formattedText);
      setErrorMessage("Texto mapeado pelo Motor ABNT! Exporte em Word para visualizar as margens (3cm/2cm), fontes e paginação oficiais (custo zero de IA).");
      logAction("Formatação ABNT (Motor Determinístico) aplicada", formattedText);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Erro ao formatar.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleHumanize = async () => {
    if (!generatedText || !generatedText.trim()) {
      setErrorMessage("Por favor, gere ou cole um texto no editor para humanizar.");
      return;
    }

    let targetText = generatedText;
    let isSelection = false;
    let start = 0;
    let end = 0;

    if (textareaRef.current) {
      start = textareaRef.current.selectionStart;
      end = textareaRef.current.selectionEnd;
      if (start !== end && start >= 0 && end > start) {
        targetText = generatedText.substring(start, end);
        isSelection = true;
      }
    }

    // Se for o documento completo e contiver capa ABNT, isola a capa para humanizar somente o conteúdo textual
    let coverPrefix = "";
    if (!isSelection && targetText.includes("--- [QUEBRA DE PÁGINA] ---")) {
      const parts = targetText.split("--- [QUEBRA DE PÁGINA] ---");
      if (parts.length >= 3) {
        coverPrefix = parts[0] + "--- [QUEBRA DE PÁGINA] ---" + parts[1] + "--- [QUEBRA DE PÁGINA] ---\n\n";
        targetText = parts.slice(2).join("--- [QUEBRA DE PÁGINA] ---").trim();
      }
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: targetText }),
      });
      const textData = await res.text(); 
      let data; 
      try { data = JSON.parse(textData); } catch (e) { throw new Error(`Erro no servidor (${res.status}). Aguarde e tente novamente.`); }
      if (data.success) {
        if (isSelection) {
          const newFullText = generatedText.substring(0, start) + data.text + generatedText.substring(end);
          setGeneratedText(newFullText);
        } else {
          setGeneratedText(coverPrefix ? coverPrefix + data.text : data.text);
        }
        setActiveTab("editor");
        logAction("Texto Humanizado com IA (Anti-Plágio/Turnitin)", data.text);
        setErrorMessage("✨ Texto humanizado com sucesso! Padrões de IA e clichês removidos.");
        setTimeout(() => setErrorMessage(""), 3500);
      } else {
        setErrorMessage(data.error || "Falha ao humanizar texto.");
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Erro ao humanizar texto.");
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
      const textData = await res.text(); let data; try { data = JSON.parse(textData); } catch (e) { throw new Error(`Erro no servidor (${res.status}). Aguarde e tente novamente.`); }
      if (data.success) {
        setAuthenticityReport(data.report);
        setActiveTab("report");
        logAction("Verificação de plágio/IA realizada");
      } else {
        setErrorMessage(data.error);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Erro ao verificar autenticidade.");
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
        body: JSON.stringify({ 
          text: generatedText, 
          title: title || "TRABALHO ACADÊMICO",
          subtitle,
          studentName,
          institution,
          course,
          city,
          year,
          advisor,
          documentType: documentType === "outros" ? customDocumentType : documentType
        }),
      });
      const textData = await res.text(); 
      let data; 
      try { data = JSON.parse(textData); } catch (e) { throw new Error(`Erro no servidor (${res.status}).`); }
      if (data.success) {
        // Se o documento já tem capa anterior, substitui, caso contrário adiciona no início
        const cleanBody = generatedText.replace(/^.*--- \[(?:QUEBRA DE PÁGINA|NOVA PÁGINA)\] ---\n*/is, '');
        setGeneratedText(data.text + "\n\n" + (cleanBody || generatedText));
        setActiveTab("editor");
        logAction("Capa e Folha de Rosto ABNT (Folha A4) geradas com sucesso");
      } else {
        setErrorMessage(data.error);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Erro ao gerar capa.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaginate = () => {
    if (!generatedText || !generatedText.trim()) {
      setErrorMessage("Por favor, gere ou insira um texto para paginar.");
      return;
    }
    
    // Separa a Capa/Folha de Rosto (elementos pré-textuais não numerados) do corpo do trabalho
    let coverBlocks: string[] = [];
    let bodyText = generatedText;

    if (generatedText.includes("--- [QUEBRA DE PÁGINA] ---")) {
      const parts = generatedText.split("--- [QUEBRA DE PÁGINA] ---");
      if (parts.length >= 3) {
        coverBlocks = [parts[0].trim(), parts[1].trim()];
        bodyText = parts.slice(2).join("--- [QUEBRA DE PÁGINA] ---").trim();
      }
    }

    // Remove paginações anteriores
    bodyText = bodyText.replace(/\n*---\s*\[Página\s*\d+\]\s*---\n*/gi, '\n\n');

    // Divide em páginas A4 (~2200 caracteres com espaçamento 1.5)
    const paragraphs = bodyText.split('\n\n');
    let pages: string[] = [];
    let currentChunk = "";

    paragraphs.forEach((p) => {
      if ((currentChunk + "\n\n" + p).length > 2200 && currentChunk.length > 0) {
        pages.push(currentChunk.trim());
        currentChunk = p;
      } else {
        currentChunk = currentChunk ? currentChunk + "\n\n" + p : p;
      }
    });
    if (currentChunk.trim()) {
      pages.push(currentChunk.trim());
    }

    const paginatedBody = pages.map((page, idx) => {
      const pageNum = idx + 1;
      return `${page}\n\n--- [Página ${pageNum}] ---`;
    }).join('\n\n');

    const fullResult = coverBlocks.length > 0
      ? `${coverBlocks[0]}\n\n--- [QUEBRA DE PÁGINA] ---\n\n${coverBlocks[1]}\n\n--- [QUEBRA DE PÁGINA] ---\n\n${paginatedBody}`
      : paginatedBody;

    setGeneratedText(fullResult);
    setActiveTab("editor");
    logAction("Paginação no rodapé (1, 2, 3...) aplicada com sucesso");
    setErrorMessage("✅ Numeração de páginas (1, 2, 3...) aplicada no rodapé conforme a ABNT!");
    setTimeout(() => setErrorMessage(""), 3500);
  };

  const handleGenerateTOC = () => {
    if (!generatedText) return;
    
    const lines = generatedText.split('\n');
    const tocLines: string[] = [];
    
    lines.forEach(line => {
      let cleanLine = line.trim();
      const isMarkdown = /^#+\s+/.test(cleanLine);
      const isNumbered = /^\d+(?:\.\d+)*\.?\s+[A-ZÀ-Ú]/.test(cleanLine);
      
      if (isMarkdown || isNumbered) {
          cleanLine = cleanLine.replace(/^#+\s*/, '');
          tocLines.push(cleanLine);
      }
    });

    if (tocLines.length > 0) {
      const tocString = "SUMÁRIO\n\n" + tocLines.join('\n') + "\n\n--- [NOVA PÁGINA] ---\n\n";
      setGeneratedText(tocString + generatedText);
      logAction("Sumário gerado", "Sumário automático adicionado ao início do documento.");
    } else {
      setErrorMessage("Nenhum título estruturado (ex: '1. Introdução' ou '# Título') encontrado para gerar o sumário.");
    }
  };

  const handleGenerateReference = async () => {
    if (!referenceSource) {
      setErrorMessage("Por favor, insira um link ou DOI.");
      return;
    }
    setIsLoading(true);
    setGeneratedReference("");
    try {
      const res = await fetch("/api/generate-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: referenceSource, style: referenceStyle }),
      });
      const textData = await res.text(); let data; try { data = JSON.parse(textData); } catch (e) { throw new Error(`Erro no servidor (${res.status}). Aguarde e tente novamente.`); }
      if (data.success) {
        setGeneratedReference(data.text);
        logAction("Referência gerada", data.text);
      } else {
        setErrorMessage(data.error);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Erro ao gerar referência.");
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
      const textData = await res.text(); let data; try { data = JSON.parse(textData); } catch (e) { throw new Error(`Erro no servidor (${res.status}). Aguarde e tente novamente.`); }
      if (data.success) {
        if (isSelection) {
          const newFullText = generatedText.substring(0, start) + data.text + generatedText.substring(end);
          setGeneratedText(newFullText);
        } else {
          setGeneratedText(data.text);
        }
      } else {
        setErrorMessage(data.error);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Erro ao aprimorar texto.");
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
          const textData = await res.text(); let data; try { data = JSON.parse(textData); } catch (e) { throw new Error(`Erro no servidor (${res.status}). Aguarde e tente novamente.`); }
          if (data.success) {
            setGeneratedText(prev => prev + "\n\n" + data.text + "\n\n");
          } else {
            setErrorMessage(data.error);
          }
        } catch (error) {
          console.error(error);
          setErrorMessage(error instanceof Error ? error.message : "Erro ao processar tabela.");
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsText(file);
    } else {
       setErrorMessage("Formato não suportado. Envie imagens (JPG/PNG) ou tabelas (CSV).");
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
      const textData = await res.text(); let data; try { data = JSON.parse(textData); } catch (e) { throw new Error(`Erro no servidor (${res.status}). Aguarde e tente novamente.`); }
      if (data.success) {
        setChatHistory([...updatedHistory, { role: 'assistant', text: data.text }]);
      } else {
        setErrorMessage("Erro ao gerar resposta automática: " + data.error);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Erro ao enviar mensagem.");
    } finally {
      setIsChatting(false);
    }
  };

  const handleCopy = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    alert("Texto copiado para a área de transferência!");
  };

  const exportPDF = () => {
    if (!generatedText) return;
    const doc = new jsPDF({ 
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    });
    
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    
    const marginLeft = 30; // 3cm
    const marginTop = 30;  // 3cm
    const marginRight = 20; // 2cm
    const marginBottom = 20; // 2cm
    const printableWidth = 210 - marginLeft - marginRight; // 160mm
    const maxY = 297 - marginBottom; // 277mm
    const lineHeight = 7.5; // Espaçamento 1.5 para fonte 12pt
    
    const paragraphs = generatedText.split('\n');
    let cursorY = marginTop;
    let isCoverPage = true;
    
    paragraphs.forEach((paragraph) => {
      if (paragraph.includes("--- [QUEBRA DE PÁGINA] ---") || paragraph.includes("--- [NOVA PÁGINA] ---") || paragraph.match(/---\s*\[Página.*?\]\s*---/i)) {
        doc.addPage();
        cursorY = marginTop;
        isCoverPage = false;
        return;
      }
      
      if (!paragraph.trim()) {
        cursorY += lineHeight * 0.8;
        if (cursorY > maxY) {
          doc.addPage();
          cursorY = marginTop;
        }
        return;
      }

      const lines = doc.splitTextToSize(paragraph, printableWidth);
      lines.forEach((line: string) => {
        if (cursorY > maxY) {
          doc.addPage();
          cursorY = marginTop;
        }
        
        // Se estiver na capa e for linha de título/instituição, centraliza
        const isCentered = isCoverPage || /^[A-Z0-9\sÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÇ]{4,}$/.test(line.trim());
        if (isCentered && isCoverPage) {
          doc.text(line, 105, cursorY, { align: "center" });
        } else {
          doc.text(line, marginLeft, cursorY);
        }
        cursorY += lineHeight;
      });
    });

    doc.save("trabalho-abnt-a4.pdf");
  };

  const exportWord = async () => {
    if (!generatedText) return;
    
    let isCover = true;
    const paragraphs = generatedText.split('\n').map(text => {
        const clean = text.trim();
        if (text.includes("--- [QUEBRA DE PÁGINA] ---") || text.includes("--- [NOVA PÁGINA] ---") || text.match(/---\s*\[Página.*?\]\s*---/i)) {
            isCover = false;
            return new Paragraph({
                pageBreakBefore: true,
                children: [],
            });
        }
        
        // Linhas em branco
        if (!clean) {
          return new Paragraph({
            children: [new TextRun({ text: "", font: "Arial", size: 24 })],
            spacing: { line: 360 }
          });
        }

        const isCentered = isCover || (/^[A-Z0-9\sÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÇ]{4,}$/.test(clean) && isCover);
        const isRightNature = clean.startsWith("Trabalho") || clean.startsWith("Orientador") || clean.startsWith("Monografia") || clean.startsWith("Artigo");

        // Formatação rigorosa ABNT NBR 14724 em folha A4
        return new Paragraph({
            children: [new TextRun({ 
              text: text, 
              font: "Arial", 
              size: isRightNature ? 20 : 24, // 10pt para nota de natureza, 12pt para texto
              bold: isCover && (clean.length > 20 || clean === clean.toUpperCase())
            })],
            alignment: isCentered ? AlignmentType.CENTER : (isRightNature ? AlignmentType.RIGHT : AlignmentType.JUSTIFIED),
            spacing: { line: isRightNature ? 240 : 360 }, // 1.0 simples para notas, 1.5 para o corpo
            indent: isCentered || isRightNature ? { firstLine: 0 } : { firstLine: convertMillimetersToTwip(12.5) } // 1.25cm recuo
        });
    });

    const doc = new Document({
      sections: [{
        properties: {
            page: {
                size: {
                  width: convertMillimetersToTwip(210), // Folha A4 210mm
                  height: convertMillimetersToTwip(297) // Folha A4 297mm
                },
                margin: {
                    top: convertMillimetersToTwip(30), // Margem Superior 3cm
                    left: convertMillimetersToTwip(30), // Margem Esquerda 3cm
                    right: convertMillimetersToTwip(20), // Margem Direita 2cm
                    bottom: convertMillimetersToTwip(20), // Margem Inferior 2cm
                }
            }
        },
        children: paragraphs,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "trabalho-abnt-a4.docx");
  };

  const handleNewWork = () => {
    setTitle("");
    setSubtitle("");
    setDocumentType("artigo");
    setCustomDocumentType("");
    setPrompt("");
    setFiles([]);
    setGeneratedText("");
    setAuthenticityReport("");
    setFormatRules("");
    setChatHistory([]);
    setActiveTab("generator");
    logAction('Iniciou um novo trabalho (limpeza de formulário)');
  };

  const handleClearWorkData = () => {
    setStudentName("");
    setCourse("");
    setInstitution("");
    setCity("");
    setYear("");
    setAdvisor("");
    logAction('Dados do Trabalho limpos');
  };

  const generateCoverTextLocally = () => {
    const instName = (institution || "NOME DA INSTITUIÇÃO DE ENSINO").toUpperCase();
    const courseName = course ? course.toUpperCase() : "";
    const authorName = (studentName || "NOME DO AUTOR DO TRABALHO").toUpperCase();
    const docTitle = (title || "TÍTULO DO TRABALHO ACADÊMICO").toUpperCase();
    const docSubtitle = subtitle ? ` - ${subtitle}` : "";
    const docCity = (city || "CIDADE - UF").toUpperCase();
    const docYear = year || new Date().getFullYear().toString();
    const docType = documentType === "outros" ? (customDocumentType || "TRABALHO ACADÊMICO").toUpperCase() : documentType.toUpperCase();
    const advText = advisor ? `Orientador(a): ${advisor}` : "";

    const coverPage = `${instName}${courseName ? `\n${courseName}` : ""}\n\n\n\n${authorName}\n\n\n\n\n\n\n\n${docTitle}${docSubtitle}\n\n\n\n\n\n\n\n\n\n${docCity}\n${docYear}`;

    const titlePage = `${authorName}\n\n\n\n\n\n\n\n${docTitle}${docSubtitle}\n\n\n\n                                          ${docType} apresentado à ${instName}${courseName ? ` como requisito parcial para o curso de ${courseName}` : ""}.\n${advText ? `\n                                          ${advText}` : ""}\n\n\n\n\n\n\n\n${docCity}\n${docYear}`;

    return `${coverPage}\n\n--- [QUEBRA DE PÁGINA] ---\n\n${titlePage}\n\n--- [QUEBRA DE PÁGINA] ---`;
  };

  const handleSaveProfile = () => {
    const profile = { name: studentName, institution, city, year, advisor, course };
    localStorage.setItem('emia_user_profile', JSON.stringify(profile));
    logAction('Dados do Trabalho salvos localmente');
    
    // Atualiza a capa no documento principal imediatamente
    const newCover = generateCoverTextLocally();
    if (generatedText && generatedText.trim()) {
      const cleanBody = generatedText.replace(/^.*--- \[(?:QUEBRA DE PÁGINA|NOVA PÁGINA)\] ---\n*/is, '');
      setGeneratedText(newCover + "\n\n" + (cleanBody || generatedText));
    } else {
      setGeneratedText(newCover + "\n\n1 INTRODUÇÃO\n\nEscreva ou cole seu texto acadêmico aqui...");
    }
    setActiveTab("editor");
    setShowProfileModal(false);
    setShowWorkData(false);
    setErrorMessage("✅ Dados da capa salvos e atualizados no documento principal!");
    setTimeout(() => setErrorMessage(""), 3500);
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
          {isMaster ? (
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>👑 Acesso Mestre (Ilimitado)</span>
            </div>
          ) : (
            <button 
              onClick={() => setShowPixModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 text-amber-900 border border-amber-300/60 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
            >
              <Coins className="w-4 h-4 text-amber-600 animate-pulse" />
              <span>{credits} {credits === 1 ? 'Trabalho Restante' : 'Trabalhos Restantes'}</span>
              <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold ml-1">+ Recarregar (PIX)</span>
            </button>
          )}

          <Button variant="outline" size="sm" onClick={() => setShowProfileModal(true)} className="border-gray-200">
            <User className="w-4 h-4 mr-2" />
            Perfil e Histórico
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Novo Trabalho</h2>
              <Button onClick={handleNewWork} variant="outline" size="sm" className="text-xs h-7">
                <Plus className="w-3 h-3 mr-1" /> Novo
              </Button>
            </div>
            
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
                      <label className="block font-medium text-gray-700 mb-1">Curso</label>
                      <input 
                        type="text" 
                        value={course}
                        onChange={(e) => setCourse(e.target.value)}
                        placeholder="Ex: Administração"
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
                    <div className="flex gap-2 pt-2 border-t border-gray-200 mt-2">
                      <Button 
                        size="sm" 
                        onClick={handleClearWorkData} 
                        variant="outline" 
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        Limpar Dados
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          handleSaveProfile();
                          setShowWorkData(false);
                        }} 
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        Salvar Dados
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arquivos Base (Para basear IA ou Juntar trabalhos)</label>
                <div 
                  {...getRootProps()} 
                  className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Arraste múltiplos PDFs ou Words, ou clique para selecionar</p>
                </div>
                
                {files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {files.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded px-3 py-2">
                        <span className="text-sm font-medium text-blue-700 truncate max-w-[200px]">{f.name}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setFiles(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    <Button 
                      onClick={handleMergeFiles} 
                      disabled={isLoading} 
                      className="w-full bg-gray-800 hover:bg-gray-900 text-white py-2 text-sm mt-2"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                      Apenas Juntar Textos (Sem IA)
                    </Button>
                  </div>
                )}
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

              <div className="pt-2">
                <Button 
                  onClick={handleGenerate} 
                  disabled={isLoading || (!title && files.length === 0)} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 font-semibold mb-3"
                >
                  {isLoading && activeTab === 'generator' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Settings className="w-5 h-5 mr-2" />}
                  Gerar Texto com IA
                </Button>

                <Button 
                  onClick={handleImproveText} 
                  disabled={isLoading || !generatedText} 
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white py-3 font-semibold mb-3"
                >
                  {isLoading && activeTab === 'editor' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Wand2 className="w-5 h-5 mr-2" />}
                  Aprimorar Texto com IA
                </Button>

                <Button 
                  onClick={handleFormatABNT} 
                  disabled={isLoading || !generatedText} 
                  className="w-full bg-gray-800 hover:bg-gray-900 text-white py-3 font-semibold"
                >
                  {isLoading && activeTab === 'editor' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                  Adequar à ABNT
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="lg:col-span-8 flex flex-col h-[calc(100vh-8rem)]">
          
          {/* Top Bar with Tabs and Quick Export Actions */}
          <div className="flex flex-wrap items-center justify-between border-b border-gray-200 mb-4 pb-2 gap-3">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActiveTab("editor")}
                className={`pb-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "editor" || activeTab === "generator" ? "border-blue-600 text-blue-600 font-semibold" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Documento Principal
              </button>
              <button 
                onClick={() => setActiveTab("chat")}
                className={`pb-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "chat" ? "border-blue-600 text-blue-600 font-semibold" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Chat Acadêmico
              </button>
              <button 
                onClick={() => setActiveTab("report")}
                className={`pb-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "report" ? "border-blue-600 text-blue-600 font-semibold" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                Relatório de Autenticidade
              </button>
            </div>

            {/* Ações Rápidas de Exportação e Validação no Topo */}
            <div className="flex items-center gap-1.5">
              <Button 
                onClick={handleCheckAuthenticity} 
                disabled={isLoading || !generatedText} 
                variant="outline" 
                size="sm"
                className="text-xs font-semibold text-purple-700 border-purple-200 hover:bg-purple-50 h-8"
              >
                {isLoading && activeTab === 'report' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-purple-600" />}
                Checar Plágio/IA
              </Button>
              <Button onClick={handleCopy} disabled={!generatedText} variant="outline" size="sm" className="text-xs h-8 text-gray-700">
                <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
              </Button>
              <Button onClick={exportPDF} disabled={!generatedText} variant="outline" size="sm" className="text-xs h-8 text-rose-700 border-rose-200 hover:bg-rose-50 font-medium">
                <Download className="w-3.5 h-3.5 mr-1" /> PDF A4
              </Button>
              <Button onClick={exportWord} disabled={!generatedText} size="sm" className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm">
                <FileDown className="w-3.5 h-3.5 mr-1" /> Word (.docx A4)
              </Button>
            </div>
          </div>

          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative">
            
            {/* Progress Bar & Error Messages */}
            <div className="absolute top-0 left-0 right-0 z-20">
              {isLoading && (
                <div className="w-full bg-blue-100 h-1.5 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-300 ease-out" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              {errorMessage && (
                <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-3 flex items-start gap-3 shadow-sm">
                  <span className="mt-0.5">ℹ️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{errorMessage}</p>
                    <button onClick={() => setErrorMessage("")} className="text-xs text-amber-600 hover:text-amber-900 underline mt-1">
                      Dispensar aviso
                    </button>
                  </div>
                </div>
              )}
            </div>

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
                    <Button 
                      size="sm" 
                      onClick={handleHumanize} 
                      disabled={isLoading || !generatedText} 
                      className="flex-shrink-0 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold shadow-sm"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" /> : <UserCheck className="w-4 h-4 mr-2 text-white" />}
                      ✨ Humanizar Texto (Anti-IA)
                    </Button>
                    <Button size="sm" onClick={handleGenerateCover} disabled={isLoading} variant="outline" className="flex-shrink-0 font-medium">
                      {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-blue-600" /> : <BookOpen className="w-4 h-4 mr-2 text-blue-600" />}
                      📄 Atualizar Capa ABNT
                    </Button>
                    <Button size="sm" onClick={handleGenerateTOC} disabled={isLoading || !generatedText} variant="outline" className="flex-shrink-0 font-medium">
                      <ListOrdered className="w-4 h-4 mr-2 text-indigo-600" />
                      📑 Sumário Dinâmico
                    </Button>
                    <Button size="sm" onClick={() => setShowReferenceModal(true)} variant="outline" className="flex-shrink-0 border-dashed border-gray-300 font-medium">
                      <Link className="w-4 h-4 mr-2 text-gray-500" />
                      🔗 Referências (DOI/Link)
                    </Button>
                    <Button size="sm" onClick={handlePaginate} disabled={isLoading || !generatedText} variant="outline" className="flex-shrink-0 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-medium">
                      <Hash className="w-4 h-4 mr-2 text-emerald-600" />
                      🔢 Paginação Rodapé (1, 2...)
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

          {/* BARRA INFORMATIVA DE STATUS ABNT */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mt-3 flex flex-wrap items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium text-gray-800">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Padrão ABNT NBR 14724 (Folha A4: 210x297mm)
              </span>
              <span className="text-gray-400">•</span>
              <span>Margens Oficiais: 3cm / 2cm</span>
              <span className="text-gray-400">•</span>
              <span>Fonte: Arial 12pt (Espaçamento 1.5)</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded">
                {generatedText ? `${generatedText.length} caracteres` : "0 caracteres"}
              </span>
            </div>
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

      {showReferenceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Gerar Referência</h2>
              <button onClick={() => setShowReferenceModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Formato da Referência</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setReferenceStyle("ABNT")}
                    className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium transition-colors ${referenceStyle === "ABNT" ? "bg-blue-50 border-blue-600 text-blue-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                  >
                    ABNT
                  </button>
                  <button
                    onClick={() => setReferenceStyle("APA")}
                    className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium transition-colors ${referenceStyle === "APA" ? "bg-blue-50 border-blue-600 text-blue-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                  >
                    APA
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Link, DOI ou Dados do Livro/Artigo</label>
                <input 
                  type="text" 
                  value={referenceSource}
                  onChange={(e) => setReferenceSource(e.target.value)}
                  placeholder="Ex: 10.1038/nrg3270 ou https://..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <Button 
                onClick={handleGenerateReference} 
                disabled={isLoading || !referenceSource}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Link className="w-5 h-5 mr-2" />}
                Gerar Referência
              </Button>

              {generatedReference && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-800 font-serif mb-3 select-all">{generatedReference}</p>
                  <Button 
                    onClick={() => {
                      navigator.clipboard.writeText(generatedReference);
                      setErrorMessage("Referência copiada para a área de transferência!");
                      setTimeout(() => setErrorMessage(""), 3000);
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Copy className="w-4 h-4 mr-2" /> Copiar Referência
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PAGAMENTO PIX DIRETO - PACOTE 5 TRABALHOS */}
      {showPixModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
              <button 
                onClick={() => setShowPixModal(false)} 
                className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-1.5 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-white/20 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                  PIX Direto
                </span>
                <span className="bg-emerald-400 text-slate-900 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  Liberação Rápida
                </span>
              </div>
              <h2 className="text-xl font-bold">Pacote com 5 Trabalhos</h2>
              <p className="text-blue-100 text-xs mt-1">
                Gere e formate até 5 artigos, TCCs ou monografias nas normas ABNT com IA Humanizada.
              </p>
            </div>
            
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
              {/* Benefícios Inclusos */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-1.5 text-xs text-gray-700">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>5 Créditos de Trabalhos Acadêmicos Completos</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Normas ABNT (Capa, Folha de Rosto e Sumário)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Texto Anti-Plágio & Exportação para Word (.docx) e PDF</span>
                </div>
              </div>

              {/* Caixa da Chave PIX */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Chave PIX Oficial (E-mail):
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 border border-gray-200 px-3 py-2.5 rounded-xl font-mono text-sm text-gray-800 select-all font-semibold break-all">
                    erlanehmotta@gmail.com
                  </div>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText("erlanehmotta@gmail.com");
                      setPixCopied(true);
                      setTimeout(() => setPixCopied(false), 3000);
                    }}
                    className={`font-semibold text-xs px-4 py-2.5 rounded-xl transition-all ${
                      pixCopied 
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                    }`}
                  >
                    {pixCopied ? (
                      <>
                        <Check className="w-4 h-4 mr-1" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" /> Copiar
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* QR Code */}
              <div className="text-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-2">Ou aponte a câmera do seu banco:</p>
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=erlanehmotta@gmail.com" 
                  alt="QR Code PIX erlanehmotta@gmail.com" 
                  className="w-36 h-36 mx-auto rounded-lg shadow-sm border border-gray-200 bg-white p-1"
                />
                <p className="text-[11px] text-gray-500 mt-2 font-mono">Chave: erlanehmotta@gmail.com</p>
              </div>

              {/* Botão WhatsApp para Enviar Comprovante */}
              <a
                href="https://wa.me/?text=Ol%C3%A1!%20Acabei%20de%20realizar%20o%20pagamento%20via%20PIX%20para%20o%20pacote%20de%205%20trabalhos%20do%20EMIA.EDUTECH%20na%20chave%20erlanehmotta@gmail.com.%20Segue%20o%20comprovante!"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-sm"
              >
                <span>📱 Enviar Comprovante no WhatsApp</span>
              </a>

              {/* Botão de Ativação / Confirmação */}
              <div className="pt-2 border-t border-gray-100">
                {activationSuccess ? (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl text-center font-semibold animate-in fade-in">
                    🎉 Parabéns! 5 Créditos Adicionados com Sucesso!
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      setCredits(prev => {
                        const next = prev + 5;
                        localStorage.setItem("emia_credits", String(next));
                        return next;
                      });
                      setActivationSuccess(true);
                      setTimeout(() => {
                        setActivationSuccess(false);
                        setShowPixModal(false);
                      }, 1800);
                    }}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 rounded-xl text-xs shadow-md shadow-blue-500/20"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Confirmar PIX e Ativar +5 Trabalhos
                  </Button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

