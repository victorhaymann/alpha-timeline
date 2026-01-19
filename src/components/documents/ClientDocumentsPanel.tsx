import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BookOpen,
  Image,
  Box,
  FileText,
  Sparkles,
  Upload,
  Loader2,
  Download,
  Eye,
  Trash2,
  File,
  Scale,
} from 'lucide-react';
import { toast } from 'sonner';
import { DocumentUploader } from './DocumentUploader';
import { format } from 'date-fns';

// Document categories - merged Logos & Fonts, added GTC & Content Rights
const DOCUMENT_CATEGORIES = [
  { id: 'brandbook', label: 'Brandbook', icon: BookOpen, accept: '.pdf,.pptx,.ai', description: 'Brand guidelines and style guides' },
  { id: 'logos_fonts', label: 'Logos & Fonts', icon: Image, accept: '.png,.jpg,.jpeg,.svg,.ai,.pdf,.otf,.ttf,.woff,.woff2', description: 'Logo files and typography' },
  { id: '3d_assets', label: '3D Assets', icon: Box, accept: '.glb,.gltf,.fbx,.obj,.stl,.step,.stp,.iges,.igs', description: '3D models and CAD files' },
  { id: 'client_brief', label: 'Client Brief', icon: FileText, accept: '.pdf,.docx,.pptx,.txt', description: 'Project briefs and requirements' },
  { id: 'artistic_direction', label: 'Artistic Direction', icon: Sparkles, accept: '.pdf,.png,.jpg,.jpeg,.svg,.ai,.pptx', description: 'Visual direction and moodboards' },
  { id: 'gtc_content_rights', label: 'GTC & Content Rights', icon: Scale, accept: '.pdf', description: 'General terms and content rights' },
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

export interface ProjectDocument {
  id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

interface ClientDocumentsPanelProps {
  projectId: string;
  documents: ClientDocument[];
  readOnly?: boolean;
  canUpload?: boolean; // Allow uploads even when readOnly (for clients via share link)
  onRefresh: () => void;
  // Quotations & Invoices
  quotations?: ProjectDocument[];
  invoices?: ProjectDocument[];
  onQuotationsRefresh?: () => void;
  showQuotationsInvoices?: boolean;
  // Shared view props for PM notifications
  shareToken?: string;
  isSharedView?: boolean;
}

export function ClientDocumentsPanel({
  projectId,
  documents,
  readOnly = false,
  canUpload = true, // Default to true - uploads allowed unless explicitly disabled
  onRefresh,
  quotations = [],
  invoices = [],
  onQuotationsRefresh,
  showQuotationsInvoices = false,
  shareToken,
  isSharedView = false,
}: ClientDocumentsPanelProps) {
  const [uploading, setUploading] = useState<CategoryId | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [dragOverCategory, setDragOverCategory] = useState<CategoryId | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  
  // Quotations/Invoices preview state (for read-only clients)
  const [quotationPreviewDoc, setQuotationPreviewDoc] = useState<ProjectDocument | null>(null);
  const [quotationPreviewUrl, setQuotationPreviewUrl] = useState<string | null>(null);
  const [quotationLoadingPreview, setQuotationLoadingPreview] = useState(false);

  const getDocumentsByCategory = (categoryId: string) => {
    return documents.filter(doc => doc.category === categoryId);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent, categoryId: CategoryId) => {
    e.preventDefault();
    e.stopPropagation();
    if (canUpload) {
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
    
    if (!canUpload) return;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(categoryId, files);
    }
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

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${projectId}/${category}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('client-documents')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}: ${uploadError.message}`);
          continue;
        }

        const { data: { user } } = await supabase.auth.getUser();

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
          await supabase.storage.from('client-documents').remove([filePath]);
          toast.error(`Failed to save ${file.name}: ${dbError.message}`);
          continue;
        }

        toast.success(`Uploaded ${file.name}`);

        // Notify PM if this is a shared view upload
        if (isSharedView && shareToken) {
          try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            await fetch(`${supabaseUrl}/functions/v1/notify-pm-upload`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({
                projectId,
                fileName: file.name,
                category,
                shareToken,
              }),
            });
          } catch (notifyError) {
            // Silently log - don't disrupt user experience
            console.error('Failed to send PM notification:', notifyError);
          }
        }
      }

      onRefresh();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload file(s)');
    } finally {
      setUploading(null);
      const input = fileInputRefs.current[category];
      if (input) input.value = '';
    }
  };

  const handleDelete = async (doc: ClientDocument) => {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;

    setDeleting(doc.id);

    try {
      const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([doc.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

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
        .createSignedUrl(doc.file_path, 3600);

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
        .createSignedUrl(doc.file_path, 60);

      if (error) {
        console.error('Download URL error:', error);
        toast.error('Failed to generate download link');
        return;
      }

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

  // Quotation/Invoice preview for read-only mode
  const handleQuotationPreview = async (doc: ProjectDocument) => {
    setQuotationPreviewDoc(doc);
    setQuotationLoadingPreview(true);

    try {
      const { data, error } = await supabase.storage
        .from('project-documents')
        .createSignedUrl(doc.file_path, 3600);

      if (error) {
        console.error('Quotation preview URL error:', error);
        toast.error('Failed to load preview');
        setQuotationPreviewDoc(null);
        return;
      }

      setQuotationPreviewUrl(data.signedUrl);
    } catch (err) {
      console.error('Quotation preview error:', err);
      toast.error('Failed to load preview');
      setQuotationPreviewDoc(null);
    } finally {
      setQuotationLoadingPreview(false);
    }
  };

  const handleQuotationDownload = async (doc: ProjectDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-documents')
        .createSignedUrl(doc.file_path, 60);

      if (error) {
        console.error('Quotation download URL error:', error);
        toast.error('Failed to generate download link');
        return;
      }

      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Quotation download error:', err);
      toast.error('Failed to download file');
    }
  };

  const closeQuotationPreview = () => {
    setQuotationPreviewDoc(null);
    setQuotationPreviewUrl(null);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Document Categories */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DOCUMENT_CATEGORIES.map((category) => {
          const categoryDocs = getDocumentsByCategory(category.id);
          const Icon = category.icon;
          const isUploading = uploading === category.id;
          const isDragOver = dragOverCategory === category.id;

          return (
            <Card 
              key={category.id} 
              className={cn(
                categoryDocs.length === 0 ? "border-dashed" : "",
                isDragOver && canUpload && "border-primary border-2 bg-primary/5 transition-colors",
                canUpload && "cursor-pointer"
              )}
              onDragOver={(e) => handleDragOver(e, category.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, category.id)}
            >
              {/* Hidden file input */}
              <input
                type="file"
                ref={(el) => { fileInputRefs.current[category.id] = el; }}
                accept={category.accept}
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(category.id, e.target.files)}
              />

              {categoryDocs.length === 0 ? (
                /* Empty state */
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors",
                    isDragOver ? "bg-primary/20" : "bg-muted"
                  )}>
                    <Icon className={cn(
                      "w-6 h-6 transition-colors",
                      isDragOver ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{category.label}</h3>
                  <p className="text-xs text-muted-foreground text-center mb-4 max-w-[180px]">
                    {isDragOver ? "Drop files here" : category.description}
                  </p>
                  {canUpload && (
                    <Button 
                      size="sm" 
                      onClick={() => fileInputRefs.current[category.id]?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Import
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              ) : (
                /* Has documents */
                <>
                  <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      {category.label}
                    </CardTitle>
                    {canUpload && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => fileInputRefs.current[category.id]?.click()}
                        disabled={isUploading}
                        className="h-7 text-xs"
                      >
                        {isUploading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-3 h-3 mr-1" />
                            Import
                          </>
                        )}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0 px-4 pb-4">
                    <div className="space-y-1">
                      {categoryDocs.map((doc) => {
                        const canPreview = isPreviewable(doc.mime_type, doc.name);
                        const isDeleting = deleting === doc.id;

                        return (
                          <div 
                            key={doc.id} 
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group"
                          >
                            <File className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-sm truncate" title={doc.name}>
                              {doc.name}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canPreview && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7"
                                  onClick={() => handlePreview(doc)}
                                  title="Preview"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={() => handleDownload(doc)}
                                title="Download"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                              {!readOnly && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(doc)}
                                  disabled={isDeleting}
                                  title="Delete"
                                >
                                  {isDeleting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          );
        })}
      </div>

      {/* Quotations & Invoices Section */}
      {showQuotationsInvoices && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-t pt-6 mt-2">Quotations & Invoices</h3>
          
          {!readOnly ? (
            // PM View: Full document uploader with upload/delete
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Quotations</h4>
                <DocumentUploader
                  projectId={projectId}
                  type="quotations"
                  documents={quotations}
                  onUploadComplete={onQuotationsRefresh || onRefresh}
                />
              </div>
              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Invoices</h4>
                <DocumentUploader
                  projectId={projectId}
                  type="invoices"
                  documents={invoices}
                  onUploadComplete={onQuotationsRefresh || onRefresh}
                />
              </div>
            </div>
          ) : (
            // Client View: Read-only with preview/download
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Quotations</h4>
                {quotations.length > 0 ? (
                  <div className="space-y-2">
                    {quotations.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(doc.file_size)} • {format(new Date(doc.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {doc.name.toLowerCase().endsWith('.pdf') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleQuotationPreview(doc)}
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleQuotationDownload(doc)}
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      No quotations available.
                    </CardContent>
                  </Card>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Invoices</h4>
                {invoices.length > 0 ? (
                  <div className="space-y-2">
                    {invoices.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(doc.file_size)} • {format(new Date(doc.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {doc.name.toLowerCase().endsWith('.pdf') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleQuotationPreview(doc)}
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleQuotationDownload(doc)}
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      No invoices available.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="truncate pr-4">
                {previewDoc?.name}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {previewDoc && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(previewDoc)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-muted/30">
            {loadingPreview ? (
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            ) : previewUrl ? (
              previewDoc?.name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0 rounded"
                  title={previewDoc?.name}
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={previewDoc?.name}
                  className="max-w-full max-h-full object-contain rounded"
                />
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quotation/Invoice Preview Dialog (for read-only) */}
      <Dialog open={!!quotationPreviewDoc} onOpenChange={(open) => !open && closeQuotationPreview()}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="truncate pr-4">
                {quotationPreviewDoc?.name}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {quotationPreviewDoc && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuotationDownload(quotationPreviewDoc)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-muted/30">
            {quotationLoadingPreview ? (
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            ) : quotationPreviewUrl ? (
              <iframe
                src={quotationPreviewUrl}
                className="w-full h-full border-0 rounded"
                title={quotationPreviewDoc?.name}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
