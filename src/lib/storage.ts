// Armazenamento de arquivos - S3 ou local
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const USE_S3 = import.meta.env.VITE_USE_S3 === 'true';
const S3_BUCKET = import.meta.env.VITE_S3_BUCKET || 'cbmpe-documents';
const S3_REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1';

// Cliente S3
const s3Client = USE_S3 ? new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
  },
}) : null;

export const storage = {
  // Upload de arquivo
  upload: async (file: File, path: string): Promise<string> => {
    if (USE_S3 && s3Client) {
      // Upload para S3
      const key = `${path}/${Date.now()}-${file.name}`;
      
      // Converter File para ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      });
      
      await s3Client.send(command);
      
      // Retornar URL pública
      return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
    } else {
      // Desenvolvimento: converter para base64 e armazenar no DynamoDB
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  },
  
  // Gerar URL assinada (temporária) para download
  getSignedUrl: async (key: string, expiresIn: number = 3600): Promise<string> => {
    if (USE_S3 && s3Client) {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      });
      
      return await getSignedUrl(s3Client, command, { expiresIn });
    } else {
      // Em desenvolvimento, retornar a URL diretamente (base64)
      return key;
    }
  },
  
  // Deletar arquivo
  delete: async (key: string): Promise<void> => {
    if (USE_S3 && s3Client) {
      // Implementar delete do S3
    }
  },
};
