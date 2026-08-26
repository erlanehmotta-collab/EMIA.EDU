import React, { useState, useRef, useEffect } from "react";
import { Button } from "./components/ui/button";
import { 
  FileText, Upload, Plus, CheckCircle, FileDown, 
  Settings, Loader2, LogOut, ShieldCheck, Download, Copy,
  UserCheck, BookOpen, Hash, Heading, Wand2, ImagePlus, Lock,
  User, Clock, Save, X, ListOrdered, Link, Sparkles, Coins, Check, QrCode, Printer,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ZoomIn, ZoomOut, Maximize2, Minimize2,
  Presentation, Play, Sliders, PanelLeftClose, PanelLeftOpen, Share2, ChevronsDown, ChevronDown, ArrowDown
} from "lucide-react";
import pptxgen from "pptxgenjs";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, AlignmentType, convertMillimetersToTwip, Header, PageNumber } from "docx";
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
  const [selectedPixPlan, setSelectedPixPlan] = useState<'single' | 'trio' | 'pro'>('trio');
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
  const [editorMode, setEditorMode] = useState<"a4" | "raw">("a4");
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [viewLayout, setViewLayout] = useState<"book" | "continuous">("book");
  const [zoomScale, setZoomScale] = useState<number>(65); // 65% proporção padrão do Microsoft Word e Adobe Acrobat em visualização contínua
  const [isStageExpanded, setIsStageExpanded] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [stageHeight, setStageHeight] = useState<number>(0);
  const [showSlidesModal, setShowSlidesModal] = useState<boolean>(false);
  const [slidesTheme, setSlidesTheme] = useState<"academic" | "modern" | "dark">("academic");

  // Sincroniza atalhos de teclado (Seta Esquerda / Direita) para passar páginas estilo livro
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em campos de texto
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      const pagesCount = generatedText ? generatedText.split("--- [QUEBRA DE PÁGINA] ---").length : 1;
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        setCurrentPageIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        setCurrentPageIndex(prev => Math.min(pagesCount - 1, prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [generatedText]);

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

  const [aiProvider, setAiProvider] = useState<"gemini" | "openai">(() => (localStorage.getItem("emia_ai_provider") as any) || "gemini");
  const [customGeminiKey, setCustomGeminiKey] = useState<string>(() => localStorage.getItem("emia_custom_gemini_key") || "");
  const [customOpenaiKey, setCustomOpenaiKey] = useState<string>(() => localStorage.getItem("emia_custom_openai_key") || "");
  const [googleUser, setGoogleUser] = useState<{ name?: string; email?: string; picture?: string } | null>(() => {
    try {
      const saved = localStorage.getItem("emia_google_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const getApiHeaders = () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    headers["x-ai-provider"] = aiProvider;
    if (customGeminiKey && customGeminiKey.trim()) {
      headers["x-gemini-api-key"] = customGeminiKey.trim();
    }
    if (customOpenaiKey && customOpenaiKey.trim()) {
      headers["x-openai-api-key"] = customOpenaiKey.trim();
    }
    return headers;
  };

  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState("");
  const [selectedEngine, setSelectedEngine] = useState<"gemini" | "openai">("gemini");

  const handleGoogleLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = googleEmailInput.trim().toLowerCase();
    if (!clean) return;

    const userName = clean.split("@")[0].replace(/[\._]/g, " ").toUpperCase();
    const userInfo = { name: userName, email: clean };

    setGoogleUser(userInfo);
    setAiProvider(selectedEngine);
    localStorage.setItem("emia_ai_provider", selectedEngine);
    localStorage.setItem("emia_google_user", JSON.stringify(userInfo));
    localStorage.setItem("emia_authenticated", "true");
    localStorage.setItem("emia_user_email", clean);

    if (clean === "erlane.digital@gmail.com") {
      setIsMaster(true);
      setCredits(9999);
      localStorage.setItem("emia_is_master", "true");
      localStorage.setItem("emia_credits", "9999");
      logAction(`Login Mestre Administrativo via Google (${selectedEngine === 'gemini' ? 'Google Gemini' : 'ChatGPT'}) realizado`);
    } else {
      setIsMaster(false);
      setShowPixModal(true);
      logAction(`Login de Aluno via Google (${clean} • IA: ${selectedEngine}) realizado`);
    }

    setShowGoogleModal(false);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsMaster(false);
    setGoogleUser(null);
    localStorage.removeItem("emia_authenticated");
    localStorage.removeItem("emia_is_master");
    localStorage.removeItem("emia_google_user");
    localStorage.removeItem("emia_google_token");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 md:p-10 text-center">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/30">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">EMIA.EDUTECH</h1>
          <p className="text-gray-600 mt-2 text-xs leading-relaxed max-w-xs mx-auto mb-8">
            Assistente acadêmico com IA Google Gemini & ChatGPT nas normas ABNT NBR 14724 em folha A4 oficial.
          </p>

          {/* BOTÃO ÚNICO DE ENTRADA EXCLUSIVA COM GOOGLE */}
          <button
            onClick={() => setShowGoogleModal(true)}
            type="button"
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 text-gray-800 font-bold py-3.5 px-6 rounded-2xl shadow-sm hover:shadow-md transition-all text-sm group active:scale-[0.98]"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Entrar com o Google</span>
          </button>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-400 font-medium">
              Conexão automática com Google Gemini & ChatGPT • PWA
            </p>
          </div>
        </div>

        {/* MODAL OFICIAL GOOGLE SIGN-IN COM SELEÇÃO DE IA */}
        {showGoogleModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 md:p-8 border border-gray-100 animate-in fade-in zoom-in-95 duration-150 relative">
              <button 
                onClick={() => setShowGoogleModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-5">
                <svg className="w-10 h-10 mx-auto mb-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <h3 className="text-lg font-bold text-gray-900">Entrar com o Google</h3>
                <p className="text-xs text-gray-500 mt-0.5">Vincule sua Conta e Motor de IA</p>
              </div>

              <form onSubmit={handleGoogleLoginSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    E-mail Google:
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    placeholder="seu.email@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                  />
                </div>

                {/* SELETOR DE MOTOR DE IA */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Motor de IA:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEngine("gemini")}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        selectedEngine === "gemini" 
                          ? "bg-blue-50 border-blue-600 text-blue-700 shadow-xs" 
                          : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span>🌟</span> Google Gemini
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEngine("openai")}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        selectedEngine === "openai" 
                          ? "bg-emerald-50 border-emerald-600 text-emerald-700 shadow-xs" 
                          : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span>🤖</span> ChatGPT
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all mt-2"
                >
                  Continuar com a Conta Google
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleGenerate = async () => {
    const hasOwnQuota = !!customGeminiKey || !!googleUser;
    if (credits <= 0 && !isMaster && !hasOwnQuota) {
      setShowPixModal(true);
      setErrorMessage("Seus créditos acabaram! Adquira o pacote de 5 trabalhos via PIX direto ou conecte sua própria Conta Google / Chave Gemini.");
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

      const customHeaders: Record<string, string> = {};
      if (customGeminiKey && customGeminiKey.trim()) {
        customHeaders["x-gemini-api-key"] = customGeminiKey.trim();
      }
      const token = localStorage.getItem("emia_google_token");
      if (token) {
        customHeaders["authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: customHeaders,
        body: formData,
      });
      const textData = await res.text(); let data; try { data = JSON.parse(textData); } catch (e) { throw new Error(`Erro no servidor (${res.status}). Aguarde e tente novamente.`); }
      if (data.success) {
        setGeneratedText(data.text);
        setActiveTab("editor");
        logAction(`Geração de documento: ${title || documentType}`, data.text);
        if (!isMaster && !hasOwnQuota) {
          setCredits(prev => {
            const next = Math.max(0, prev - 1);
            localStorage.setItem("emia_credits", String(next));
            return next;
          });
        }
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
        headers: getApiHeaders(),
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

  const handleCorrectSpelling = async () => {
    if (!generatedText || !generatedText.trim()) {
      setErrorMessage("Por favor, gere ou insira um texto para verificar e corrigir a ortografia.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/correct-spelling", {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ text: generatedText }),
      });
      const textData = await res.text();
      let data;
      try { data = JSON.parse(textData); } catch (e) { throw new Error(`Erro no servidor (${res.status}). Aguarde e tente novamente.`); }
      if (data.success) {
        setGeneratedText(data.text);
        setActiveTab("editor");
        logAction("Correção Ortográfica e Gramatical Aplicada", data.text);
        setErrorMessage("✅ Ortografia, gramática e concordâncias corrigidas com sucesso!");
        setTimeout(() => setErrorMessage(""), 3500);
      } else {
        setErrorMessage(data.error || "Falha ao corrigir ortografia.");
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Erro ao corrigir ortografia.");
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
        headers: getApiHeaders(),
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
        headers: getApiHeaders(),
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
        headers: getApiHeaders(),
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
            headers: getApiHeaders(),
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
        headers: getApiHeaders(),
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
    
    // Divide por quebras de página ABNT
    const rawPages = generatedText.split("--- [QUEBRA DE PÁGINA] ---");
    let pageCount = 0;

    rawPages.forEach((pageContent, pageIdx) => {
      if (pageIdx > 0) doc.addPage();
      pageCount++;
      
      // Regra ABNT NBR 14724 Oficial: Numeração arábica a partir da página 3 (Introdução) no Canto Superior Direito
      if (pageCount >= 3) {
        doc.setFontSize(10);
        doc.text(String(pageCount), 190, 20, { align: "right" });
        doc.setFontSize(12);
      }

      let cursorY = marginTop;
      const isCover = pageIdx === 0;
      const isTitlePage = pageIdx === 1;

      const paragraphs = pageContent.split('\n');
      paragraphs.forEach((paragraph) => {
        if (!paragraph.trim()) {
          cursorY += lineHeight * 0.8;
          if (cursorY > maxY) {
            doc.addPage();
            pageCount++;
            if (pageCount >= 3) {
              doc.setFontSize(10);
              doc.text(String(pageCount), 190, 20, { align: "right" });
              doc.setFontSize(12);
            }
            cursorY = marginTop;
          }
          return;
        }

        // Folha de Rosto: Nota de Natureza recuada à direita com fonte 10pt
        const isRightNature = isTitlePage && (paragraph.trim().startsWith("Trabalho") || paragraph.trim().startsWith("Monografia") || paragraph.trim().startsWith("Artigo") || paragraph.trim().startsWith("Dissertação") || paragraph.trim().startsWith("Tese") || paragraph.trim().startsWith("Orientador"));
        
        if (isRightNature) {
          doc.setFontSize(10);
          const natureLines = doc.splitTextToSize(paragraph.trim(), 80);
          natureLines.forEach((nLine: string) => {
            if (cursorY > maxY) {
              doc.addPage();
              pageCount++;
              cursorY = marginTop;
            }
            doc.text(nLine, 110, cursorY);
            cursorY += 5;
          });
          doc.setFontSize(12);
          return;
        }

        const lines = doc.splitTextToSize(paragraph, printableWidth);
        lines.forEach((line: string) => {
          if (cursorY > maxY) {
            doc.addPage();
            pageCount++;
            if (pageCount >= 3) {
              doc.setFontSize(10);
              doc.text(String(pageCount), 190, 20, { align: "right" });
              doc.setFontSize(12);
            }
            cursorY = marginTop;
          }
          
          if (isCover || (isTitlePage && cursorY < 120)) {
            doc.text(line, 105, cursorY, { align: "center" });
          } else {
            doc.text(line, marginLeft, cursorY);
          }
          cursorY += lineHeight;
        });
      });
    });

    doc.save("trabalho-abnt-a4.pdf");
  };

  const exportWord = async () => {
    if (!generatedText) return;
    
    const rawPages = generatedText.split("--- [QUEBRA DE PÁGINA] ---");
    const docSections: any[] = [];

    rawPages.forEach((pageContent, pageIdx) => {
      const isCover = pageIdx === 0;
      const isTitlePage = pageIdx === 1;
      const isBody = pageIdx >= 2;

      const paragraphs = pageContent.split('\n').map(text => {
        const clean = text.trim();
        if (!clean) {
          return new Paragraph({
            children: [new TextRun({ text: "", font: "Arial", size: 24 })],
            spacing: { line: 360 }
          });
        }

        const isRightNature = isTitlePage && (clean.startsWith("Trabalho") || clean.startsWith("Monografia") || clean.startsWith("Artigo") || clean.startsWith("Orientador") || clean.startsWith("Dissertação"));
        const isCentered = isCover || (isTitlePage && !isRightNature && (clean === clean.toUpperCase() || clean.length < 50));

        return new Paragraph({
          children: [new TextRun({ 
            text: clean, 
            font: "Arial", 
            size: isRightNature ? 20 : 24, // 10pt para nota, 12pt para corpo
            bold: isCover && (clean.length > 20 || clean === clean.toUpperCase())
          })],
          alignment: isCentered ? AlignmentType.CENTER : (isRightNature ? AlignmentType.RIGHT : AlignmentType.JUSTIFIED),
          spacing: { line: isRightNature ? 240 : 360 }, // 1.0 para nota, 1.5 para corpo
          indent: isCentered || isRightNature ? { firstLine: 0 } : { firstLine: convertMillimetersToTwip(12.5) } // 1.25cm recuo
        });
      });

      docSections.push({
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
        headers: isBody ? {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Arial",
                    size: 20 // 10pt no cabeçalho superior direito
                  })
                ]
              })
            ]
          })
        } : undefined,
        children: paragraphs,
      });
    });

    const doc = new Document({
      sections: docSections.length > 0 ? docSections : [{
        children: [new Paragraph({ children: [new TextRun({ text: generatedText, font: "Arial", size: 24 })] })]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "trabalho-abnt-a4.docx");
  };

  // Função para Estruturar o Texto Acadêmico em Roteiro de Slides
  const parseDocumentIntoSlides = (text: string) => {
    const pages = text ? text.split("--- [QUEBRA DE PÁGINA] ---") : [];
    const mainBody = pages.slice(2).join("\n\n") || text;

    return [
      {
        title: (title || "Apresentação de Trabalho Acadêmico").toUpperCase(),
        subtitle: subtitle || (course ? `Curso de ${course}` : "Seminário & Defesa"),
        author: studentName || "Autor(a)",
        institution: institution || "Instituição de Ensino",
        year: year || new Date().getFullYear().toString(),
        isCover: true,
        bullets: [
          `Autor: ${studentName || "Acadêmico"}`,
          `Orientador: ${advisor || "Docente Responsável"}`,
          `Instituição: ${institution || "Universidade / Faculdade"}`,
          `Ano: ${year || new Date().getFullYear()}`
        ],
        notes: "Slide inicial: Agradeça à banca examinadora e apresente o título do seu trabalho."
      },
      {
        title: "1. Introdução e Contextualização",
        isCover: false,
        bullets: [
          "Relevância e atualidade do tema no cenário acadêmico contemporâneo.",
          "Justificativa da pesquisa e motivação teórica/prática.",
          "Delimitação do escopo e contextualização do problema investigado.",
          "Aderência às diretrizes e estado da arte da literatura."
        ],
        notes: "Destaque por que esse tema é importante e o que motivou a realização desta pesquisa."
      },
      {
        title: "2. Problema de Pesquisa & Objetivos",
        isCover: false,
        bullets: [
          "Problema Central: Como solucionar ou analisar o fenômeno proposto?",
          "Objetivo Geral: Investigar, mapear e analisar criticamente as variáveis.",
          "Objetivos Específicos: Levantar referencial, aplicar metodologia e analisar dados.",
          "Hipótese condutora do estudo e impacto esperado."
        ],
        notes: "Apresente a pergunta norteadora e deixe claro o objetivo que você buscou alcançar."
      },
      {
        title: "3. Fundamentação Teórica & Metodologia",
        isCover: false,
        bullets: [
          "Bases conceituais fundamentadas em autores e referências consolidadas.",
          "Abordagem metodológica: Classificação (Qualitativa / Quantitativa).",
          "Procedimentos de coleta e análise sistemática dos dados.",
          "Critérios de rigor científico e conformidade normativa ABNT."
        ],
        notes: "Explique como o estudo foi conduzido metodologicamente e quais autores apoiaram a teoria."
      },
      {
        title: "4. Desenvolvimento & Principais Achados",
        isCover: false,
        bullets: [
          "Apresentação dos principais resultados obtidos na investigação.",
          "Discussão crítica correlacionando os dados com a literatura.",
          "Evidências encontradas e confirmação das hipóteses levantadas.",
          "Análise dos impactos práticos observados na área de estudo."
        ],
        notes: "Este é o coração da apresentação: mostre com clareza o que foi descoberto ou analisado."
      },
      {
        title: "5. Considerações Finais & Conclusão",
        isCover: false,
        bullets: [
          "Cumprimento integral dos objetivos propostos no início da pesquisa.",
          "Principais contribuições teóricas e práticas para a comunidade.",
          "Limitações metodológicas identificadas durante o percurso.",
          "Sugestões e perspectivas para investigações e estudos futuros."
        ],
        notes: "Sintetize as respostas aos objetivos e encerre reforçando o valor do trabalho."
      },
      {
        title: "6. Referências Bibliográficas (ABNT)",
        isCover: false,
        bullets: [
          `ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 14724. Rio de Janeiro: ABNT, ${year || new Date().getFullYear()}.`,
          "Fontes científicas, artigos indexados e obras especializadas citadas no corpo do texto.",
          "Material disponível para consulta detalhada no documento completo."
        ],
        notes: "Mencione as principais fontes utilizadas e abra espaço para perguntas da banca."
      }
    ];
  };

  // Exportação Direta em PowerPoint (.pptx) 100% compatível com Google Slides
  const exportPPTXSlides = async () => {
    const pptx = new pptxgen();
    pptx.layout = "LAYOUT_16x9";
    pptx.title = title || "Apresentação Acadêmica";
    pptx.author = studentName || "EMIA.EDUTECH";

    const slidesData = parseDocumentIntoSlides(generatedText);

    slidesData.forEach((s, idx) => {
      const slide = pptx.addSlide();
      
      const primaryColor = slidesTheme === 'academic' ? "1E3A8A" : slidesTheme === 'modern' ? "0D9488" : "0F172A";

      if (s.isCover) {
        slide.background = { color: primaryColor };
        slide.addText(s.title, {
          x: "10%",
          y: "25%",
          w: "80%",
          h: "30%",
          fontSize: 28,
          bold: true,
          color: "FFFFFF",
          align: "center",
          fontFace: "Arial"
        });

        slide.addText(s.subtitle || (course ? `Curso: ${course}` : "Apresentação Acadêmica"), {
          x: "10%",
          y: "55%",
          w: "80%",
          h: "10%",
          fontSize: 16,
          color: "E2E8F0",
          align: "center",
          fontFace: "Arial"
        });

        slide.addText(`${s.author} • ${s.institution} (${s.year})`, {
          x: "10%",
          y: "75%",
          w: "80%",
          h: "10%",
          fontSize: 13,
          color: "CBD5E1",
          align: "center",
          fontFace: "Arial"
        });
      } else {
        slide.background = { color: "F8FAFC" };

        slide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: "100%",
          h: "15%",
          fill: { color: primaryColor }
        });

        slide.addText(s.title, {
          x: "5%",
          y: "2%",
          w: "90%",
          h: "11%",
          fontSize: 20,
          bold: true,
          color: "FFFFFF",
          fontFace: "Arial",
          valign: "middle"
        });

        const textItems = s.bullets.map(b => ({
          text: b,
          options: {
            fontSize: 15,
            color: "1E293B",
            breakLine: true,
            bullet: { type: "bullet", code: "25AA" },
            fontFace: "Arial",
            lineSpacingMultiple: 1.3
          }
        }));

        slide.addText(textItems as any, {
          x: "6%",
          y: "22%",
          w: "88%",
          h: "68%",
          valign: "top"
        });

        slide.addText(`${title || "Trabalho Acadêmico"} | Slide ${idx + 1} de ${slidesData.length}`, {
          x: "5%",
          y: "93%",
          w: "90%",
          h: "5%",
          fontSize: 9,
          color: "94A3B8",
          fontFace: "Arial"
        });
      }

      if (s.notes) {
        slide.addNotes(s.notes);
      }
    });

    await pptx.writeFile({ fileName: `apresentacao-${(title || "slides-academicos").toLowerCase().replace(/[^a-z0-9]/g, "-")}.pptx` });
    setErrorMessage("✨ Apresentação de slides gerada com sucesso!");
    setTimeout(() => setErrorMessage(""), 3500);
  };

  const openInGoogleSlides = () => {
    const slidesData = parseDocumentIntoSlides(generatedText);
    const outlineText = slidesData.map((s, i) => `=== SLIDE ${i + 1}: ${s.title} ===\n${s.bullets.map(b => `• ${b}`).join('\n')}\n[Notas do Apresentador: ${s.notes || ''}]\n`).join('\n\n');
    
    navigator.clipboard.writeText(outlineText);
    window.open("https://docs.google.com/presentation/u/0/create", "_blank");
    setErrorMessage("🚀 Google Slides aberto! O roteiro dos slides foi copiado para sua área de transferência.");
    setTimeout(() => setErrorMessage(""), 4500);
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
          {/* Seletor Rápido de IA: Google Gemini ou ChatGPT */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold">
            <button
              onClick={() => {
                setAiProvider("gemini");
                localStorage.setItem("emia_ai_provider", "gemini");
                setErrorMessage("Motor ativo alterado para Google Gemini 2.5.");
                setTimeout(() => setErrorMessage(""), 2500);
              }}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                aiProvider === "gemini" 
                  ? "bg-white text-blue-700 shadow-xs border border-gray-200" 
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <span>🌟</span> Gemini 2.5
            </button>
            <button
              onClick={() => {
                setAiProvider("openai");
                localStorage.setItem("emia_ai_provider", "openai");
                setErrorMessage("Motor ativo alterado para OpenAI ChatGPT.");
                setTimeout(() => setErrorMessage(""), 2500);
              }}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                aiProvider === "openai" 
                  ? "bg-white text-emerald-700 shadow-xs border border-gray-200" 
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <span>🤖</span> ChatGPT
            </button>
          </div>

          {/* Indicador de Cota Própria / Créditos */}
          {isMaster ? (
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>👑 Acesso Mestre (Ilimitado)</span>
            </div>
          ) : (customGeminiKey || customOpenaiKey) ? (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs px-3 py-1.5 rounded-lg shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Cota Própria Conectada (Ilimitado)</span>
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

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 md:p-6 flex flex-col lg:flex-row gap-4 items-start relative">
        
        {/* Botão flutuante para reabrir a barra lateral quando recolhida */}
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            title="Expandir formulário do trabalho"
            className="hidden lg:flex items-center gap-1.5 bg-white border border-gray-300 hover:border-blue-500 shadow-lg text-gray-800 hover:text-blue-600 px-3 py-2 rounded-r-xl font-bold text-xs fixed left-0 top-32 z-30 transition-all hover:translate-x-1 group"
          >
            <PanelLeftOpen className="w-4 h-4 text-blue-600 group-hover:scale-110" />
            <span>Formulário</span>
          </button>
        )}

        {/* Sidebar Controls (Recolhível para puxar o palco) */}
        {!isSidebarCollapsed && (
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col gap-6 transition-all">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Novo Trabalho</h2>
                <div className="flex items-center gap-1">
                  <Button onClick={handleNewWork} variant="outline" size="sm" className="text-xs h-7">
                    <Plus className="w-3 h-3 mr-1" /> Novo
                  </Button>
                  <Button 
                    onClick={() => setIsSidebarCollapsed(true)} 
                    variant="ghost" 
                    size="sm" 
                    title="Puxar o palco (recolher painel)"
                    className="text-xs h-7 px-2 text-gray-500 hover:text-blue-600"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </Button>
                </div>
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
      )}

        {/* Editor Area (Palco Padrão com +150px de altura e visualização completa A4 estilo Word e PDF) */}
        <div 
          className="flex-1 w-full min-w-0 flex flex-col transition-all"
          style={{ height: 'calc(100vh - 4.5rem + 150px)', minHeight: '830px' }}
        >
          
          {/* Top Bar with Tabs and Quick Export Actions */}
          <div className="flex flex-wrap items-center justify-between border-b border-gray-200 mb-3 pb-2 gap-2">
            <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button 
                onClick={handleCorrectSpelling} 
                disabled={isLoading || !generatedText} 
                variant="outline" 
                size="sm" 
                className="text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-8"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />}
                ✍️ Correção Ortográfica
              </Button>
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
              <Button 
                onClick={() => {
                  if (!generatedText) {
                    setErrorMessage("Gere ou insira um texto primeiro para criar os slides.");
                    return;
                  }
                  setShowSlidesModal(true);
                }} 
                disabled={!generatedText} 
                size="sm" 
                className="text-xs h-8 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold shadow-xs flex items-center gap-1"
              >
                <Presentation className="w-3.5 h-3.5 mr-1 animate-pulse" />
                📽️ Slides (Google / PPTX)
              </Button>
              <Button onClick={exportPDF} disabled={!generatedText} variant="outline" size="sm" className="text-xs h-8 text-rose-700 border-rose-200 hover:bg-rose-50 font-medium">
                <Download className="w-3.5 h-3.5 mr-1" /> PDF A4
              </Button>
              <Button onClick={exportWord} disabled={!generatedText} size="sm" className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm">
                <FileDown className="w-3.5 h-3.5 mr-1" /> Word (.docx A4)
              </Button>
            </div>
          </div>

          {/* Canvas Area with Progress Bar */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative">
            <div className="relative z-10">
              {isLoading && (
                <div className="w-full bg-blue-100 h-1.5 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-300 ease-out" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>

            {(activeTab === "editor" || activeTab === "generator") && (
              <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-100">
                {(() => {
                  let pages: string[] = [];
                  
                  if (generatedText && generatedText.includes("--- [QUEBRA DE PÁGINA] ---")) {
                    pages = generatedText.split("--- [QUEBRA DE PÁGINA] ---");
                  } else if (generatedText && generatedText.trim()) {
                    let bodyContent = generatedText;
                    let referencesContent = "";

                    const refMatch = bodyContent.match(/\n\s*(?:#+\s*)?(?:REFERÊNCIAS(?:\s+BIBLIOGRÁFICAS)?|REFERENCIAS)\s*\n([\s\S]*)$/i);
                    if (refMatch) {
                      referencesContent = `REFERÊNCIAS\n\n${refMatch[1].trim()}`;
                      bodyContent = bodyContent.substring(0, refMatch.index).trim();
                    }

                    // Divide o texto em blocos de páginas A4 (~2200 caracteres cada)
                    const paragraphs = bodyContent.split(/\n\n+/);
                    const bodyPages: string[] = [];
                    let curPage = "";
                    for (const para of paragraphs) {
                      if ((curPage + "\n\n" + para).length > 2200 && curPage.trim().length > 0) {
                        bodyPages.push(curPage.trim());
                        curPage = para;
                      } else {
                        curPage = curPage ? curPage + "\n\n" + para : para;
                      }
                    }
                    if (curPage.trim()) bodyPages.push(curPage.trim());

                    if (referencesContent) {
                      bodyPages.push(referencesContent);
                    }

                    pages = ["CAPA_AUTO", "FOLHA_ROSTO_AUTO", ...bodyPages];
                  } else {
                    pages = ["CAPA_AUTO", "FOLHA_ROSTO_AUTO", ""];
                  }

                  const renderSingleA4Sheet = (text: string, pIdx: number) => {
                    const isCover = pIdx === 0;
                    const isTitlePage = pIdx === 1;
                    const isBodyPage = pIdx >= 2;
                    const pageNum = pIdx + 1;
                    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

                    return (
                      <div 
                        key={pIdx}
                        className="w-full max-w-[760px] bg-white text-gray-900 shadow-md border border-gray-200 rounded-sm relative flex flex-col p-8 sm:p-12 md:p-16 my-4 select-text print:shadow-none print:border-none print:m-0 print:p-0 print:h-[297mm] print:w-[210mm] print:break-after-page min-h-[900px]"
                      >
                        {/* NUMERAÇÃO OFICIAL IMPRESSA NO CANTO SUPERIOR DIREITO */}
                        {isBodyPage && (
                          <div className="absolute top-[4%] right-[5%] font-mono text-xs font-bold text-gray-800 select-none">
                            {pageNum}
                          </div>
                        )}

                        {/* RENDERIZAÇÃO DA CAPA ABNT (TOTALMENTE EDITÁVEL) */}
                        {isCover ? (
                          <div className="flex-1 flex flex-col justify-between text-center font-['Arial'] text-gray-900 py-4 select-text">
                            {/* TOPO: INSTITUIÇÃO E CURSO */}
                            <div>
                              {((institution && institution.trim()) || (lines[0] && lines[0] !== "CAPA_AUTO" && lines[0].trim())) && (
                                <div
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => setInstitution(e.currentTarget.innerText.trim())}
                                  className="font-bold text-sm sm:text-base uppercase tracking-wider focus:outline-none focus:bg-blue-50/50 p-1 rounded"
                                >
                                  {institution || lines[0]}
                                </div>
                              )}
                              {((course && course.trim()) || (lines[1] && lines[1] !== lines[0] && lines[1] !== "CAPA_AUTO" && lines[1].trim())) && (
                                <div
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => setCourse(e.currentTarget.innerText.trim())}
                                  className="font-semibold text-xs sm:text-sm uppercase text-gray-700 mt-1 focus:outline-none focus:bg-blue-50/50 p-1 rounded"
                                >
                                  {course || lines[1]}
                                </div>
                              )}
                            </div>

                            {/* AUTOR: CENTRALIZADO ENTRE O TOPO E O MEIO CONFORME ABNT NBR 14724 */}
                            {((studentName && studentName.trim()) || (lines[2] && lines[2] !== "CAPA_AUTO" && lines[2].trim())) && (
                              <div className="my-auto py-4">
                                <div
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => setStudentName(e.currentTarget.innerText.trim())}
                                  className="font-semibold text-sm sm:text-base uppercase tracking-wide focus:outline-none focus:bg-blue-50/50 p-1 rounded"
                                >
                                  {studentName || lines[2]}
                                </div>
                              </div>
                            )}

                            {/* CENTRO: TÍTULO E SUBTÍTULO */}
                            <div className="my-auto py-6">
                              {((title && title.trim()) || (lines[3] && lines[3] !== "CAPA_AUTO" && lines[3].trim())) && (
                                <div
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => setTitle(e.currentTarget.innerText.trim())}
                                  className="font-extrabold text-base sm:text-lg uppercase tracking-tight text-gray-900 leading-snug focus:outline-none focus:bg-blue-50/50 p-1 rounded"
                                >
                                  {title || lines[3]}
                                </div>
                              )}
                              {((subtitle && subtitle.trim()) || (lines[4] && lines[4] !== "CAPA_AUTO" && lines[4].trim())) && (
                                <div
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => setSubtitle(e.currentTarget.innerText.trim())}
                                  className="font-normal text-xs sm:text-sm text-gray-700 mt-1 focus:outline-none focus:bg-blue-50/50 p-1 rounded"
                                >
                                  {subtitle || lines[4]}
                                </div>
                              )}
                            </div>

                            {/* RODAPÉ: CIDADE E ANO (SOMENTE SE INFORMADO) */}
                            {(((city && city.trim()) || (lines[5] && lines[5] !== "CAPA_AUTO" && lines[5].trim())) || ((year && year.trim()) || (lines[6] && lines[6] !== "CAPA_AUTO" && lines[6].trim()))) && (
                              <div className="mt-auto pt-6">
                                {((city && city.trim()) || (lines[5] && lines[5] !== "CAPA_AUTO" && lines[5].trim())) && (
                                  <div
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => setCity(e.currentTarget.innerText.trim())}
                                    className="font-bold text-xs sm:text-sm uppercase text-gray-800 focus:outline-none focus:bg-blue-50/50 p-1 rounded"
                                  >
                                    {city || lines[5]}
                                  </div>
                                )}
                                {((year && year.trim()) || (lines[6] && lines[6] !== "CAPA_AUTO" && lines[6].trim())) && (
                                  <div
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => setYear(e.currentTarget.innerText.trim())}
                                    className="font-bold text-xs sm:text-sm text-gray-800 focus:outline-none focus:bg-blue-50/50 p-1 rounded"
                                  >
                                    {year || lines[6]}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : isTitlePage ? (
                          /* RENDERIZAÇÃO DA FOLHA DE ROSTO ABNT (TOTALMENTE EDITÁVEL) */
                          <div className="flex-1 flex flex-col justify-between font-['Arial'] text-gray-900 py-4 select-text">
                            <div className="text-center">
                              {((studentName && studentName.trim()) || (lines[0] && lines[0] !== "FOLHA_ROSTO_AUTO" && lines[0].trim())) && (
                                <div
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => setStudentName(e.currentTarget.innerText.trim())}
                                  className="font-semibold text-sm sm:text-base uppercase tracking-wide focus:outline-none focus:bg-blue-50/50 p-1 rounded"
                                >
                                  {studentName || lines[0]}
                                </div>
                              )}
                            </div>

                            <div className="my-auto text-center py-6">
                              {((title && title.trim()) || (lines[1] && lines[1] !== "FOLHA_ROSTO_AUTO" && lines[1].trim())) && (
                                <div
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => setTitle(e.currentTarget.innerText.trim())}
                                  className="font-bold text-base sm:text-lg uppercase tracking-tight text-gray-900 focus:outline-none focus:bg-blue-50/50 p-1 rounded"
                                >
                                  {title || lines[1]}
                                </div>
                              )}
                              {((subtitle && subtitle.trim()) || (lines[2] && lines[2] !== "FOLHA_ROSTO_AUTO" && lines[2].trim())) && (
                                <div
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => setSubtitle(e.currentTarget.innerText.trim())}
                                  className="font-normal text-xs sm:text-sm text-gray-700 mt-1 focus:outline-none focus:bg-blue-50/50 p-1 rounded"
                                >
                                  {subtitle || lines[2]}
                                </div>
                              )}
                            </div>

                            <div className="my-auto w-full flex justify-end">
                              <div 
                                contentEditable
                                suppressContentEditableWarning
                                className="w-3/5 text-justify text-[10pt] sm:text-[10.5pt] leading-[1.3] text-gray-800 bg-gray-50/50 p-3 rounded border border-gray-200 focus:outline-none focus:bg-blue-50/50"
                              >
                                <p>
                                  {(documentType === "outros" ? customDocumentType : documentType) || "Trabalho Acadêmico"} apresentado à {institution || "Instituição de Ensino"}{course ? ` como requisito parcial de avaliação para o curso de ${course}` : ""}.
                                </p>
                                {advisor && (
                                  <p className="mt-2 font-semibold text-gray-900 text-[9.5pt]">
                                    Orientador(a): {advisor}
                                  </p>
                                )}
                              </div>
                            </div>

                            {(((city && city.trim()) || (lines[3] && lines[3] !== "FOLHA_ROSTO_AUTO" && lines[3].trim())) || ((year && year.trim()) || (lines[4] && lines[4] !== "FOLHA_ROSTO_AUTO" && lines[4].trim()))) && (
                              <div className="text-center mt-auto pt-6">
                                {((city && city.trim()) || (lines[3] && lines[3] !== "FOLHA_ROSTO_AUTO" && lines[3].trim())) && (
                                  <div
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => setCity(e.currentTarget.innerText.trim())}
                                    className="font-bold text-xs sm:text-sm uppercase text-gray-800 focus:outline-none focus:bg-blue-50/50 p-1 rounded"
                                  >
                                    {city || lines[3]}
                                  </div>
                                )}
                                {((year && year.trim()) || (lines[4] && lines[4] !== "FOLHA_ROSTO_AUTO" && lines[4].trim())) && (
                                  <div
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => setYear(e.currentTarget.innerText.trim())}
                                    className="font-bold text-xs sm:text-sm text-gray-800 focus:outline-none focus:bg-blue-50/50 p-1 rounded"
                                  >
                                    {year || lines[4]}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* RENDERIZAÇÃO DO CORPO DO TRABALHO ABNT (PÁGINAS 3 EM DIANTE - 100% EDITÁVEL) */
                          <div className="flex-1 flex flex-col font-['Arial'] text-gray-900 select-text">
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              spellCheck={true}
                              lang="pt-BR"
                              onInput={(e) => {
                                const newPages = [...pages];
                                newPages[pIdx] = e.currentTarget.innerText;
                                setGeneratedText(newPages.join("\n\n--- [QUEBRA DE PÁGINA] ---\n\n"));
                              }}
                              className="w-full focus:outline-none font-['Arial'] text-gray-900 leading-[1.6] text-justify text-sm sm:text-base indent-8 bg-transparent min-h-[500px] whitespace-pre-wrap focus:ring-1 focus:ring-blue-300 p-2 rounded"
                            >
                              {text && text !== "CAPA_AUTO" && text !== "FOLHA_ROSTO_AUTO" ? text.trimStart() : ""}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div className="flex-1 w-full h-full flex flex-col items-center justify-start py-6 px-3 md:px-8 pb-24 relative overflow-y-auto overflow-x-hidden select-text">
                      
                      {/* BOTÃO PARA AUMENTAR OU DIMINUIR A PÁGINA NO PALCO */}
                      <div className="fixed right-6 bottom-24 z-30 flex items-center bg-white/95 backdrop-blur border border-gray-300 shadow-2xl rounded-2xl p-1 gap-1 select-none print:hidden">
                        <button
                          onClick={() => setZoomScale(z => Math.max(30, z - 10))}
                          title="Diminuir Página (Zoom -)"
                          className="p-2 hover:bg-gray-100 rounded-xl text-gray-700 hover:text-blue-600 transition-all active:scale-95"
                        >
                          <ZoomOut className="w-4 h-4 stroke-[2.5]" />
                        </button>
                        
                        <button
                          onClick={() => setZoomScale(65)}
                          title="Padrão Word / PDF (65%)"
                          className="px-2.5 py-1 text-xs font-extrabold text-gray-800 hover:text-blue-600 hover:bg-gray-100 rounded-xl"
                        >
                          {zoomScale}%
                        </button>
                        
                        <button
                          onClick={() => setZoomScale(z => Math.min(150, z + 10))}
                          title="Aumentar Página (Zoom +)"
                          className="p-2 hover:bg-gray-100 rounded-xl text-gray-700 hover:text-blue-600 transition-all active:scale-95"
                        >
                          <ZoomIn className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>

                      {/* DOCUMENTO CONTÍNUO COM TODAS AS PÁGINAS A4 EMPILHADAS */}
                      <div className="w-full flex flex-col items-center gap-6">
                        {pages.map((pText, idx) => renderSingleA4Sheet(pText, idx))}
                      </div>

                    </div>
                  );
                })()}

                <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-4px_10px_rgba(0,0,0,0.08)] z-20">
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
                      🔢 Repaginar ABNT A4
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
              <h2 className="text-xl font-bold text-gray-900">Perfil e Dados do Trabalho</h2>
              <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex border-b border-gray-100 px-6 pt-2">
              <button 
                onClick={() => setProfileTab('dados')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${profileTab === 'dados' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Meus Dados (Capa ABNT)
              </button>
              <button 
                onClick={() => setProfileTab('historico')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${profileTab === 'historico' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Histórico de Textos
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">

              {profileTab === 'dados' && (
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
              )}

              {profileTab === 'historico' && (
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

      {/* MODAL DE PAGAMENTO PIX DIRETO - PACOTES 3 TRABALHOS (R$ 5) OU 7 TRABALHOS (R$ 10) */}
      {showPixModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
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
                  Reconhecimento Automático
                </span>
              </div>
              <h2 className="text-xl font-bold">Escolha seu Pacote de Trabalhos</h2>
              <p className="text-blue-100 text-xs mt-1">
                Formatação completa ABNT A4, Anti-Plágio Turnitin e Exportação Word/PDF.
              </p>
            </div>
            
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
              {/* SELEÇÃO DOS 3 PACOTES */}
              <div className="grid grid-cols-3 gap-2.5">
                {/* Pacote 1: R$ 1,99 = 1 Trabalho */}
                <div 
                  onClick={() => setSelectedPixPlan('single')}
                  className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left relative ${
                    selectedPixPlan === 'single' 
                      ? 'border-blue-600 bg-blue-50/60 shadow-sm ring-1 ring-blue-500' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div>
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Avulso</span>
                    <h3 className="text-sm font-black text-gray-900 mt-0.5">1 Trabalho</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">R$ 1,99</p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-gray-200/60 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-800">R$ 1,99</span>
                    <input 
                      type="radio" 
                      name="pixPlan" 
                      checked={selectedPixPlan === 'single'} 
                      onChange={() => setSelectedPixPlan('single')}
                      className="text-blue-600"
                    />
                  </div>
                </div>

                {/* Pacote 2: R$ 5,00 = 3 Trabalhos */}
                <div 
                  onClick={() => setSelectedPixPlan('trio')}
                  className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left relative ${
                    selectedPixPlan === 'trio' 
                      ? 'border-blue-600 bg-blue-50/60 shadow-sm ring-1 ring-blue-500' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <span className="absolute -top-2 right-1.5 bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase">
                    Econômico
                  </span>
                  <div>
                    <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Trio</span>
                    <h3 className="text-sm font-black text-gray-900 mt-0.5">3 Trabalhos</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">R$ 1,66/un</p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-gray-200/60 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-700">R$ 5,00</span>
                    <input 
                      type="radio" 
                      name="pixPlan" 
                      checked={selectedPixPlan === 'trio'} 
                      onChange={() => setSelectedPixPlan('trio')}
                      className="text-blue-600"
                    />
                  </div>
                </div>

                {/* Pacote 3: R$ 9,90 = 7 Trabalhos */}
                <div 
                  onClick={() => setSelectedPixPlan('pro')}
                  className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left relative ${
                    selectedPixPlan === 'pro' 
                      ? 'border-amber-500 bg-amber-50/60 shadow-sm ring-1 ring-amber-500' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <span className="absolute -top-2 right-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase">
                    Popular
                  </span>
                  <div>
                    <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Semestre</span>
                    <h3 className="text-sm font-black text-gray-900 mt-0.5">7 Trabalhos</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">R$ 1,41/un</p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-gray-200/60 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-800">R$ 9,90</span>
                    <input 
                      type="radio" 
                      name="pixPlan" 
                      checked={selectedPixPlan === 'pro'} 
                      onChange={() => setSelectedPixPlan('pro')}
                      className="text-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Caixa da Chave PIX */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Chave PIX Oficial (E-mail):
                  </label>
                  <span className="text-xs font-bold text-blue-700">
                    Valor: {selectedPixPlan === 'single' ? 'R$ 1,99' : selectedPixPlan === 'trio' ? 'R$ 5,00' : 'R$ 9,90'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 border border-gray-200 px-3.5 py-2.5 rounded-xl font-mono text-xs md:text-sm text-gray-800 select-all font-semibold break-all">
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
              <div className="text-center bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  Pague {selectedPixPlan === 'single' ? 'R$ 1,99 (1 Trabalho)' : selectedPixPlan === 'trio' ? 'R$ 5,00 (3 Trabalhos)' : 'R$ 9,90 (7 Trabalhos)'} pelo app do banco:
                </p>
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=erlanehmotta@gmail.com" 
                  alt="QR Code PIX erlanehmotta@gmail.com" 
                  className="w-32 h-32 mx-auto rounded-xl shadow-xs border border-gray-200 bg-white p-1"
                />
                <p className="text-[11px] text-gray-500 mt-1.5 font-mono">Chave: erlanehmotta@gmail.com</p>
              </div>

              {/* Botão de Liberação Automática do App */}
              <div className="pt-2">
                {activationSuccess ? (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-2xl text-center font-bold animate-in fade-in">
                    🎉 PIX Confirmado! +{selectedPixPlan === 'single' ? '1' : selectedPixPlan === 'trio' ? '3' : '7'} Trabalho(s) Liberado(s)!
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      const addedCredits = selectedPixPlan === 'single' ? 1 : selectedPixPlan === 'trio' ? 3 : 7;
                      setCredits(prev => {
                        const next = prev + addedCredits;
                        localStorage.setItem("emia_credits", String(next));
                        return next;
                      });
                      setActivationSuccess(true);
                      setTimeout(() => {
                        setActivationSuccess(false);
                        setShowPixModal(false);
                      }, 1200);
                    }}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3.5 rounded-2xl text-xs md:text-sm shadow-md shadow-emerald-500/25 active:scale-[0.98] transition-all"
                  >
                    <CheckCircle className="w-4 h-4 mr-2 text-white" />
                    Já fiz o PIX / Liberar Agora ({selectedPixPlan === 'single' ? '+1 Trabalho' : selectedPixPlan === 'trio' ? '+3 Trabalhos' : '+7 Trabalhos'})
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE APRESENTAÇÃO DE SLIDES (GOOGLE SLIDES / PPTX) */}
      {showSlidesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
                  <Presentation className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-bold">Apresentação de Slides</h3>
                  <p className="text-xs text-amber-100">Geração automática para Google Slides & PowerPoint</p>
                </div>
              </div>
              <button
                onClick={() => setShowSlidesModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              
              {/* Tema Visual dos Slides */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Tema Visual dos Slides:
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    onClick={() => setSlidesTheme("academic")}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      slidesTheme === "academic"
                        ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="w-full h-3 rounded bg-blue-900 mb-2" />
                    <p className="text-xs font-bold text-gray-900">Acadêmico NBR</p>
                    <p className="text-[10px] text-gray-500">Azul Marinho & Branco</p>
                  </button>

                  <button
                    onClick={() => setSlidesTheme("modern")}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      slidesTheme === "modern"
                        ? "border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="w-full h-3 rounded bg-teal-700 mb-2" />
                    <p className="text-xs font-bold text-gray-900">Moderno Tech</p>
                    <p className="text-[10px] text-gray-500">Verde Petróleo & Slate</p>
                  </button>

                  <button
                    onClick={() => setSlidesTheme("dark")}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      slidesTheme === "dark"
                        ? "border-slate-800 bg-slate-100 ring-2 ring-slate-800/20"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="w-full h-3 rounded bg-slate-900 mb-2" />
                    <p className="text-xs font-bold text-gray-900">Minimalista</p>
                    <p className="text-[10px] text-gray-500">Grafite & Cinza Claro</p>
                  </button>
                </div>
              </div>

              {/* Pré-visualização da Estrutura dos Slides */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-800">Estrutura Gerada (6 Slides)</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">Pronto para Defesa</span>
                </div>
                <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
                  <li><strong className="text-gray-800">Slide 1:</strong> Capa com Título, Autor, Orientador e Instituição</li>
                  <li><strong className="text-gray-800">Slide 2:</strong> Introdução, Relevância & Contextualização</li>
                  <li><strong className="text-gray-800">Slide 3:</strong> Problema de Pesquisa, Objetivos e Hipótese</li>
                  <li><strong className="text-gray-800">Slide 4:</strong> Fundamentação Teórica & Metodologia</li>
                  <li><strong className="text-gray-800">Slide 5:</strong> Desenvolvimento & Principais Resultados</li>
                  <li><strong className="text-gray-800">Slide 6:</strong> Conclusão & Referências ABNT</li>
                </ul>
              </div>

              {/* Botões de Ação */}
              <div className="space-y-2.5 pt-2">
                <Button
                  onClick={openInGoogleSlides}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3.5 rounded-2xl text-xs md:text-sm shadow-md shadow-amber-500/25 flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  🚀 Criar e Abrir no Google Slides (Com Roteiro Copiado)
                </Button>

                <Button
                  onClick={exportPPTXSlides}
                  variant="outline"
                  className="w-full border-2 border-gray-300 hover:border-gray-400 text-gray-800 font-bold py-3.5 rounded-2xl text-xs md:text-sm flex items-center justify-center gap-2 bg-white"
                >
                  <Download className="w-4 h-4 text-orange-600" />
                  📥 Baixar Arquivo .pptx (Compatível com Google Slides & PowerPoint)
                </Button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

