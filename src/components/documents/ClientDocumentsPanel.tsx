import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  BookOpen,
  Image,
  Type,
  Palette,
  Layout,
  Camera,
  Upload,
  Download,
  Trash2,
  Eye,
  File,
  Loader2,
  X,
} from 'lucide-react';

// Document category configuration
const DOCUMENT_CATEGORIES = [
  { id: 'brandbook', label: 'Brandbook', icon: BookOpen, accept: '.pdf,.pptx', description: 'Brand guidelines and style guides' },
  { id: 'logos', label: 'Logos', icon: Image, accept: '.png,.jpg,.jpeg,.svg,.pdf', description: 'Logo files in various formats' },
  { id: 'fonts', label: 'Fonts', icon: Type, accept: '.otf,.ttf,.woff,.woff2', description: 'Typography files' },
  { id: 'color_palettes', label: 'Color Palettes', icon: Palette, accept: '.pdf,.png,.jpg,.jpeg', description: 'Color specifications' },
  { id: 'templates', label: 'Templates', icon: Layout, accept: '.pdf,.pptx,.png,.jpg,.jpeg', description: 'Design templates and mockups' },
  { id: 'photography', label: 'Photography', icon: Camera, accept: '.png,.jpg,.jpeg', description: 'Brand photos and stock images' },
] as const;

type CategoryId = typeof DOCUMENT_CATEGORIES[number]['id'];

export interface ClientDocument {
  id: string;
  project_id: string;
  category: string;
  name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

interface ClientDocumentsPanelProps {
  projectId: string;
  documents: ClientDocument[];
  readOnly?: boolean;
  onRefresh: () => void;
  shareToken?: string; // For anonymous access via share link
}

export function ClientDocumentsPanel({
  projectId,
  documents,
  readOnly = false,
  onRefresh,
  shareToken,
}: ClientDocumentsPanelProps) {
  const [uploading, setUploading] = useState<CategoryId | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [dragOverCategory, setDragOverCategory] = useState<CategoryId | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getDocumentsByCategory = (categoryId: string) => {
    return documents.filter(doc => doc.category === categoryId);
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string | null, name: string) => {
    if (!mimeType) {
      // Infer from extension
      const ext = name.split('.').pop()?.toLowerCase();
      if (['png', 'jpg', 'jpeg', 'svg'].includes(ext || '')) return Image;
      if (['otf', 'ttf', 'woff', 'woff2'].includes(ext || '')) return Type;
      if (ext === 'pdf') return File;
    }
    if (mimeType?.startsWith('image/')) return Image;
    if (mimeType?.includes('font')) return Type;
    return File;
  };

  const isPreviewable = (mimeType: string | null, name: string): boolean => {
    if (mimeType?.startsWith('image/')) return true;
    if (mimeType === 'application/pdf') return true;
    const ext = name.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'svg', 'pdf'].includes(ext || '');
  };

  const handleFileSelect = async (category: CategoryId, files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(category);
    setDragOverCategory(null);

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${projectId}/${category}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('client-documents')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}: ${uploadError.message}`);
          continue;
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        // Insert record into client_documents table
        // Using 'as any' because table was just created and types haven't regenerated
        const { error: dbError } = await (supabase as any)
          .from('client_documents')
          .insert({
            project_id: projectId,
            category,
            name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: user?.id || null,
          });

        if (dbError) {
          console.error('DB error:', dbError);
          // Try to clean up the uploaded file
          await supabase.storage.from('client-documents').remove([filePath]);
          toast.error(`Failed to save ${file.name}: ${dbError.message}`);
          continue;
        }

        toast.success(`Uploaded ${file.name}`);
      }

      onRefresh();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload file(s)');
    } finally {
      setUploading(null);
      // Reset file input
      const input = fileInputRefs.current[category];
      if (input) input.value = '';
    }
  };

  const handleDelete = async (doc: ClientDocument) => {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;

    setDeleting(doc.id);

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([doc.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue anyway to delete the DB record
      }

      // Delete from database
      // Using 'as any' because table was just created and types haven't regenerated
      const { error: dbError } = await (supabase as any)
        .from('client_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) {
        console.error('DB delete error:', dbError);
        toast.error(`Failed to delete: ${dbError.message}`);
        return;
      }

      toast.success('File deleted');
      onRefresh();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const handlePreview = async (doc: ClientDocument) => {
    setPreviewDoc(doc);
    setLoadingPreview(true);

    try {
      const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(doc.file_path, 3600); // 1 hour

      if (error) {
        console.error('Preview URL error:', error);
        toast.error('Failed to load preview');
        setPreviewDoc(null);
        return;
      }

      setPreviewUrl(data.signedUrl);
    } catch (err) {
      console.error('Preview error:', err);
      toast.error('Failed to load preview');
      setPreviewDoc(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async (doc: ClientDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(doc.file_path, 60); // 1 minute

      if (error) {
        console.error('Download URL error:', error);
        toast.error('Failed to generate download link');
        return;
      }

      // Create a temporary link and click it
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download file');
    }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl(null);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent, categoryId: CategoryId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly) {
      setDragOverCategory(categoryId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCategory(null);
  };

  const handleDrop = (e: React.DragEvent, categoryId: CategoryId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCategory(null);
    
    if (readOnly) return;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(categoryId, files);
    }
  };

  return (
    <div className="space-y-4">
      <Accordion type="multiple" className="space-y-2" defaultValue={['brandbook', 'logos']}>
        {DOCUMENT_CATEGORIES.map((category) => {
          const categoryDocs = getDocumentsByCategory(category.id);
          const Icon = category.icon;

          return (
            <AccordionItem 
              key={category.id} 
              value={category.id}
              className="border rounded-lg overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{category.label}</span>
                  <Badge variant="secondary" className="ml-2">
                    {categoryDocs.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-sm text-muted-foreground mb-4">
                  {category.description}
                </p>

                {/* Upload button + Drag-and-drop zone (only in edit mode) */}
                {!readOnly && (
                  <>
                    <input
                      type="file"
                      ref={(el) => { fileInputRefs.current[category.id] = el; }}
                      accept={category.accept}
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileSelect(category.id, e.target.files)}
                    />
                    
                    {/* Upload Button */}
                    <div className="mb-4 flex items-center gap-2">
                      <Button
                        onClick={() => fileInputRefs.current[category.id]?.click()}
                        disabled={uploading === category.id}
                        size="sm"
                      >
                        {uploading === category.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload {category.label}
                          </>
                        )}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {category.accept}
                      </span>
                    </div>

                    {/* Drag-and-drop zone */}
                    <div
                      className={cn(
                        "mb-4 border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
                        dragOverCategory === category.id
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-muted-foreground/50"
                      )}
                      onDragOver={(e) => handleDragOver(e, category.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, category.id)}
                      onClick={() => fileInputRefs.current[category.id]?.click()}
                    >
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        {dragOverCategory === category.id ? (
                          <>
                            <Upload className="w-8 h-8 text-primary" />
                            <p className="text-sm font-medium text-primary">Drop files here</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Drag & drop files here, or click to browse
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Document list */}
                {categoryDocs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                    <Icon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No {category.label.toLowerCase()} uploaded yet</p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {categoryDocs.map((doc) => {
                      const FileIcon = getFileIcon(doc.mime_type, doc.name);
                      const canPreview = isPreviewable(doc.mime_type, doc.name);

                      return (
                        <Card key={doc.id} className="overflow-hidden">
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <FileIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(doc.file_size)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {canPreview && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handlePreview(doc)}
                                  title="Preview"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownload(doc)}
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              {!readOnly && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(doc)}
                                  disabled={deleting === doc.id}
                                  title="Delete"
                                  className="text-destructive hover:text-destructive"
                                >
                                  {deleting === doc.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="truncate pr-4">
                {previewDoc?.name}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => previewDoc && handleDownload(previewDoc)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-muted/30">
            {loadingPreview ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewUrl ? (
              previewDoc?.mime_type?.startsWith('image/') || 
              ['png', 'jpg', 'jpeg', 'svg'].includes(previewDoc?.name.split('.').pop()?.toLowerCase() || '') ? (
                <div className="flex items-center justify-center h-full p-4">
                  <img
                    src={previewUrl}
                    alt={previewDoc?.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title={previewDoc?.name}
                />
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ClientDocumentsPanel;
