import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
// pdf.js (renderização)
// Usamos a versão legacy para compatibilidade e apontamos o worker para CDN
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
// Usa o worker local instalado via npm
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type SizeOpt = "small" | "medium" | "large";

interface StampModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string; // URL assinada para visualização/uso
  processId: string;
  processNumber?: string;
  companyName?: string;
  documentName: string;
  approverMatricula?: string;
  approverPosto?: string;
  approverNome?: string;
  onStamped: (result: { blob: Blob; filename: string; code: string; page: number }) => Promise<void>;
}

export function StampModal(props: StampModalProps) {
  const {
    open,
    onOpenChange,
    pdfUrl,
    processId,
    processNumber,
    companyName,
    documentName,
    approverMatricula = "",
    approverPosto = "",
    approverNome = "",
    onStamped,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [loadingPage, setLoadingPage] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [positioned, setPositioned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [size, setSize] = useState<SizeOpt>("medium");
  const [rotation, setRotation] = useState(0); // graus
  const [stampPos, setStampPos] = useState<{ x: number; y: number } | null>(null); // coordenadas em pixels do canvas
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [matricula, setMatricula] = useState(approverMatricula);
  const [posto, setPosto] = useState(approverPosto);
  const [nome, setNome] = useState(approverNome);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadPdf = async () => {
      try {
        const doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNumber(1);
      } catch (err) {
        console.error("Erro ao carregar PDF para carimbo:", err);
      }
    };
    loadPdf();
    return () => {
      cancelled = true;
      setPdfDoc(null);
      setNumPages(0);
      setStampPos(null);
      setPositioned(false);
    };
  }, [open, pdfUrl]);

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;
    setLoadingPage(true);
    try {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) {
      console.error("Erro ao renderizar página:", err);
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    renderPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, pageNumber, scale]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!containerRef.current || positioned) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStampPos({ x, y });
    setPositioned(true);
  };

  // Drag & drop: permite mover o carimbo antes da confirmação
  const onOverlayMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || !stampPos) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setDragOffset({ x: stampPos.x - mouseX, y: stampPos.y - mouseY });
    setDragging(true);
    e.stopPropagation();
    e.preventDefault();
  };

  const onContainerMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !containerRef.current || !dragOffset) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const newX = mouseX + dragOffset.x;
    const newY = mouseY + dragOffset.y;
    setStampPos({ x: Math.max(0, Math.min(rect.width, newX)), y: Math.max(0, Math.min(rect.height, newY)) });
  };

  const onContainerMouseUp = () => {
    if (dragging) {
      setDragging(false);
      setDragOffset(null);
    }
  };

  const beginReposition = () => {
    if (!positioned) return;
    const confirm = window.confirm("Deseja alterar a posição do carimbo? A versão anterior será substituída.");
    if (confirm) {
      setStampPos(null);
      setPositioned(false);
    }
  };

  const stampWidthPx = size === "small" ? 220 : size === "large" ? 340 : 280;
  const stampHeightPx = size === "small" ? 140 : size === "large" ? 200 : 170;

  const formatDate = (d: Date) => {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} – ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const generateVerificationCode = () => {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const digits = "23456789";
    const part = (len: number, charset: string) => Array.from({ length: len }, () => charset[Math.floor(Math.random() * charset.length)]).join("");
    return `CBMPE-${part(4, digits)}${part(4, letters)}`;
  };

  const handleConfirmStamp = async () => {
    if (!stampPos) return;
    if (!matricula.trim() || !posto.trim()) {
      alert("Informe matrícula e posto/graduação para o carimbo.");
      return;
    }
    setProcessing(true);
    try {
      // Baixa o PDF original
      const resp = await fetch(pdfUrl);
      const arrayBuf = await resp.arrayBuffer();
      const pdfDocLib = await PDFDocument.load(arrayBuf);
      const pages = pdfDocLib.getPages();
      const targetPage = pages[pageNumber - 1];
      const { width: pageW, height: pageH } = targetPage.getSize();

      // Converte posição do canvas para coordenadas do PDF (origem inferior-esquerda)
      const canvas = canvasRef.current!;
      const xRatio = stampPos.x / canvas.width;
      const yRatio = stampPos.y / canvas.height;
      const stampW = (stampWidthPx / canvas.width) * pageW;
      const stampH = (stampHeightPx / canvas.height) * pageH;
      const xPdf = xRatio * pageW;
      // y no PDF é a base do carimbo: converter considerando altura do carimbo e sistema invertido
      const yPdfTop = (1 - yRatio) * pageH; // topo relativo
      const yPdf = yPdfTop - stampH; // base

      // Gera QR Code e prepara fontes
      const code = generateVerificationCode();
      const qrUrl = `${window.location.origin}/verificar?codigo=${code}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 128 });
      const qrImage = await pdfDocLib.embedPng(qrDataUrl);
      const helvetica = await pdfDocLib.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDocLib.embedFont(StandardFonts.HelveticaBold);
      const approvalDate = new Date();

      // Tentativa de incluir logo (opcional)
      let logoImage: any = null;
      try {
        const logoResp = await fetch("/cbmpe_logo.png");
        if (logoResp.ok) {
          const logoBuf = await logoResp.arrayBuffer();
          logoImage = await pdfDocLib.embedPng(logoBuf);
        }
      } catch {}

      // Desenha o carimbo: fundo branco com borda, logo, textos e QR
      // Rotação: aplicamos via rotate em cada elemento
      // Fundo
      targetPage.drawRectangle({ x: xPdf, y: yPdf, width: stampW, height: stampH, color: rgb(1, 1, 1), opacity: 0.85, rotate: degrees(rotation) });

      // Logo no canto superior esquerdo (se disponível)
      const padding = 6;
      let cursorX = xPdf + padding;
      let cursorY = yPdf + stampH - padding - 24; // topo menos 24px
      if (logoImage) {
        targetPage.drawImage(logoImage, { x: cursorX, y: cursorY, width: 24, height: 24, rotate: degrees(rotation) });
        cursorX += 28;
      }

      // Título
      targetPage.drawText("CORPO DE BOMBEIROS MILITAR DE PERNAMBUCO", {
        x: cursorX,
        y: cursorY + 8,
        size: 9,
        font: helveticaBold,
        color: rgb(0, 0, 0),
        rotate: degrees(rotation),
      });

      // Subtítulo
      targetPage.drawText("Documento aprovado conforme protocolo técnico CBM-PE.", {
        x: xPdf + padding,
        y: cursorY - 12,
        size: 8,
        font: helvetica,
        color: rgb(0, 0, 0),
        rotate: degrees(rotation),
      });

      // Dados
      const lines = [
        `Responsável: ${nome ? nome + " – " : ""}${posto}${matricula ? " – Matrícula " + matricula : ""}`,
        `Data/Hora: ${formatDate(approvalDate)}`,
        `Código de Autenticação: ${code}`,
        processNumber ? `Processo: ${processNumber}` : "",
        companyName ? `Empresa: ${companyName}` : "",
      ].filter(Boolean);

      let textY = cursorY - 26;
      lines.forEach((text) => {
        targetPage.drawText(text, {
          x: xPdf + padding,
          y: textY,
          size: 8,
          font: helvetica,
          color: rgb(0, 0, 0),
          rotate: degrees(rotation),
        });
        textY -= 12;
      });

      // QR no canto inferior direito do carimbo
      const qrSize = Math.min(stampH - 40, 64);
      targetPage.drawImage(qrImage, {
        x: xPdf + stampW - padding - qrSize,
        y: yPdf + padding,
        width: qrSize,
        height: qrSize,
        rotate: degrees(rotation),
      });
      targetPage.drawText("Verifique em: cbmpe.gov.br/validar-doc", {
        x: xPdf + padding,
        y: yPdf + padding + 4,
        size: 7,
        font: helvetica,
        color: rgb(0, 0, 0),
        rotate: degrees(rotation),
      });

      const stampedPdfBytes = await pdfDocLib.save();
      const blob = new Blob([stampedPdfBytes], { type: "application/pdf" });
      const dateStr = `${approvalDate.getFullYear()}-${String(approvalDate.getMonth() + 1).padStart(2, "0")}-${String(approvalDate.getDate()).padStart(2, "0")}_${String(approvalDate.getHours()).padStart(2, "0")}-${String(approvalDate.getMinutes()).padStart(2, "0")}`;
      const filename = `Documento_Carimbado_${dateStr}.pdf`;

      await onStamped({ blob, filename, code, page: pageNumber });

      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao aplicar carimbo:", err);
      alert(err?.message || "Falha ao aplicar carimbo no PDF.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Carimbar Documento: {documentName}</DialogTitle>
          <DialogDescription>
            Posicione o carimbo sobre o PDF e confirme. Ajuste zoom, página, tamanho e rotação conforme necessário.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3">
            <div className="flex items-center gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}>-</Button>
              <span className="text-xs">Zoom: {(scale * 100).toFixed(0)}%</span>
              <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.min(3, s + 0.25))}>+</Button>
              <div className="ml-4 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPageNumber((p) => Math.max(1, p - 1))}>Anterior</Button>
                <span className="text-xs">Página {pageNumber}/{numPages || "-"}</span>
                <Button variant="outline" size="sm" onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}>Próxima</Button>
              </div>
            </div>
            <div
              ref={containerRef}
              className="relative border rounded bg-muted/30 overflow-hidden"
              onClick={handleCanvasClick}
              style={{ cursor: positioned ? "default" : "crosshair" }}
            onMouseMove={onContainerMouseMove}
            onMouseUp={onContainerMouseUp}
            >
              <canvas ref={canvasRef} className="block mx-auto" />
              {stampPos && (
                <div
                  className="absolute bg-white/60 border border-border shadow-sm"
                  style={{
                    left: stampPos.x - stampWidthPx / 2,
                    top: stampPos.y - stampHeightPx / 2,
                    width: stampWidthPx,
                    height: stampHeightPx,
                    transform: `rotate(${rotation}deg)`,
                  }}
                  onMouseDown={onOverlayMouseDown}
                >
                  <div className="p-2 text-[10px]">
                    <p className="font-semibold">CBM-PE • Pré-visualização do carimbo</p>
                    <p>Responsável: {nome || "—"} {posto ? `• ${posto}` : ""} {matricula ? `• Matrícula ${matricula}` : ""}</p>
                    <p className="text-[9px]">(A aparência final terá QR e dados completos)</p>
                  </div>
                </div>
              )}
              {loadingPage && <div className="absolute inset-0 flex items-center justify-center text-xs">Carregando...</div>}
            </div>
          </div>

          <div className="md:col-span-2 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Bombeiro</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: 1º Ten. João Silva" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="matricula">Matrícula</Label>
                <Input id="matricula" value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Ex.: 123456" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="posto">Posto/Graduação</Label>
                <Input id="posto" value={posto} onChange={(e) => setPosto(e.target.value)} placeholder="Ex.: Cap." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tamanho do carimbo</Label>
              <div className="flex gap-2">
                <Button variant={size === "small" ? "default" : "outline"} size="sm" onClick={() => setSize("small")}>Pequeno</Button>
                <Button variant={size === "medium" ? "default" : "outline"} size="sm" onClick={() => setSize("medium")}>Médio</Button>
                <Button variant={size === "large" ? "default" : "outline"} size="sm" onClick={() => setSize("large")}>Grande</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rotação</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setRotation((r) => (r - 5 + 360) % 360)}>−5°</Button>
                <span className="text-xs">{rotation}°</span>
                <Button variant="outline" size="sm" onClick={() => setRotation((r) => (r + 5) % 360)}>+5°</Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={beginReposition} disabled={!positioned}>Reposicionar</Button>
              <Button onClick={handleConfirmStamp} disabled={!positioned || processing}>
                {processing ? "Aplicando..." : "Confirmar Carimbo"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">O carimbo só pode ser posicionado uma vez. Se necessário, use "Reposicionar" com confirmação.</p>
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-end w-full">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}