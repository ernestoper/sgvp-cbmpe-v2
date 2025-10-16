import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { storage } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

interface DocumentUploadProps {
  processId: string;
  onUploadComplete?: (fileUrl: string, fileName: string) => void;
}

export function DocumentUpload({ processId, onUploadComplete }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState('');
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !documentType) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione um arquivo e informe o tipo de documento',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Upload para S3
      const fileUrl = await storage.upload(file, `processes/${processId}/documents`);
      
      console.log('File uploaded to:', fileUrl);

      // Callback com a URL do arquivo
      if (onUploadComplete) {
        onUploadComplete(fileUrl, file.name);
      }

      toast({
        title: 'Upload concluído!',
        description: `${file.name} foi enviado com sucesso.`,
      });

      // Limpar form
      setFile(null);
      setDocumentType('');
      
      // Limpar input
      const input = document.getElementById('file-upload') as HTMLInputElement;
      if (input) input.value = '';

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Erro no upload',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Enviar Documento</h3>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="document-type">Tipo de Documento</Label>
          <Input
            id="document-type"
            placeholder="Ex: Planta Baixa, Laudo Técnico, etc."
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="file-upload">Arquivo</Label>
          <Input
            id="file-upload"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange}
          />
          {file && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <File className="h-4 w-4" />
              <span>{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  const input = document.getElementById('file-upload') as HTMLInputElement;
                  if (input) input.value = '';
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <Button
          onClick={handleUpload}
          disabled={!file || !documentType || uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Enviar Documento
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
