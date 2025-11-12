'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Plus,
    CloudUpload,
    FileText,
    X,
    CheckCircle,
    AlertCircle,
    Loader2,
    Upload,
    Check,
    FileIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { FileNameValidator, useNameValidation } from '@/lib/validation';
import { cn } from '@/lib/utils';
import { type Folder } from '@/hooks/react-query/knowledge-base/use-folders';
import { getApiUrl } from '@/lib/get-api-url';

interface FileUploadStatus {
    file: File;
    status: 'queued' | 'uploading' | 'success' | 'error';
    progress: number;
    error?: string;
}

interface CommandsKbEntryModalProps {
    folders: Folder[];
    onUploadComplete: () => void;
    sunaFolderId: string; // Pre-set to Suna folder ID
    trigger?: React.ReactNode;
    defaultTab?: 'upload' | 'text';
}

const API_URL = getApiUrl();

export function CommandsKbEntryModal({
    folders,
    onUploadComplete,
    sunaFolderId,
    trigger,
    defaultTab = 'text'
}: CommandsKbEntryModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(defaultTab);
    
    // File upload state
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadStatuses, setUploadStatuses] = useState<FileUploadStatus[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    // Text entry state
    const [commandName, setCommandName] = useState('');
    const [prompt, setPrompt] = useState('');
    const [isCreatingText, setIsCreatingText] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Validation for command name
    const commandNameValidation = useNameValidation(commandName, 'file');

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const fileArray = Array.from(files);
            addFiles(fileArray);
        }
    };

    const addFiles = (newFiles: File[]) => {
        setSelectedFiles(prev => [...prev, ...newFiles]);
        setUploadStatuses(prev => [
            ...prev,
            ...newFiles.map(file => ({
                file,
                status: 'queued' as const,
                progress: 0
            }))
        ]);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            addFiles(files);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setUploadStatuses(prev => prev.filter((_, i) => i !== index));
    };

    const handleFileUpload = async () => {
        if (!sunaFolderId) {
            toast.error('Suna folder not found');
            return;
        }

        if (selectedFiles.length === 0) {
            toast.error('Please select files to upload');
            return;
        }

        setIsUploading(true);

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('No session found');
            }

            let completedFiles = 0;

            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];

                setUploadStatuses(prev => prev.map((status, index) =>
                    index === i ? { ...status, status: 'uploading', progress: 0 } : status
                ));

                try {
                    const formData = new FormData();
                    formData.append('file', file);

                    const response = await fetch(`${API_URL}/knowledge-base/folders/${sunaFolderId}/upload`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`,
                        },
                        body: formData
                    });

                    if (response.ok) {
                        setUploadStatuses(prev => prev.map((status, index) =>
                            index === i ? { ...status, status: 'success', progress: 100 } : status
                        ));
                        completedFiles++;
                    } else {
                        let errorMessage = `Upload failed: ${response.status}`;
                        if (response.status === 413) {
                            try {
                                const errorData = await response.json();
                                errorMessage = errorData.detail || 'Knowledge base limit (50MB) exceeded';
                            } catch {
                                errorMessage = 'Knowledge base limit (50MB) exceeded';
                            }
                        }

                        setUploadStatuses(prev => prev.map((status, index) =>
                            index === i ? {
                                ...status,
                                status: 'error',
                                progress: 0,
                                error: errorMessage
                            } : status
                        ));
                    }
                } catch (fileError) {
                    setUploadStatuses(prev => prev.map((status, index) =>
                        index === i ? {
                            ...status,
                            status: 'error',
                            progress: 0,
                            error: `Upload failed: ${fileError}`
                        } : status
                    ));
                }
            }

            if (completedFiles === selectedFiles.length) {
                toast.success(`Successfully uploaded ${completedFiles} file(s)`);
                resetAndClose();
            } else if (completedFiles > 0) {
                toast.success(`Uploaded ${completedFiles} of ${selectedFiles.length} files`);
            } else {
                toast.error('Failed to upload files');
            }

            onUploadComplete();

        } catch (error) {
            console.error('Error uploading files:', error);
            toast.error('Failed to upload files');
        } finally {
            setIsUploading(false);
        }
    };

    const handleTextCreate = async () => {
        if (!sunaFolderId) {
            toast.error('Suna folder not found');
            return;
        }

        if (!commandNameValidation.isValid) {
            toast.error(commandNameValidation.friendlyError || 'Invalid command name');
            return;
        }

        if (!prompt.trim()) {
            toast.error('Please enter a prompt');
            return;
        }

        setIsCreatingText(true);

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('No session found');
            }

            const finalFilename = commandName.includes('.') ? commandName.trim() : `${commandName.trim()}.txt`;
            const textBlob = new Blob([prompt], { type: 'text/plain' });
            const file = new File([textBlob], finalFilename, { type: 'text/plain' });

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_URL}/knowledge-base/folders/${sunaFolderId}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                toast.success('Slash command created successfully');

                if (result.filename_changed) {
                    toast.info(`Command was renamed to "${result.final_filename}" to avoid conflicts`);
                }

                onUploadComplete();
                resetAndClose();
            } else {
                const errorData = await response.json().catch(() => null);
                toast.error(errorData?.detail || 'Failed to create slash command');
            }
        } catch (error) {
            console.error('Error creating slash command:', error);
            toast.error('Failed to create slash command');
        } finally {
            setIsCreatingText(false);
        }
    };

    const resetAndClose = () => {
        setTimeout(() => {
            setSelectedFiles([]);
            setUploadStatuses([]);
            setCommandName('');
            setPrompt('');
            setIsOpen(false);
        }, 1500);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create Command
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="text-xl font-semibold">Create New Slash Command</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Upload a prompt file or create a new command with text
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto">
                    <div className="space-y-6 p-1">
                        {/* Content Creation Tabs */}
                        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="upload" className="gap-2">
                                    <CloudUpload className="h-4 w-4" />
                                    Upload Prompt File
                                </TabsTrigger>
                                <TabsTrigger value="text" className="gap-2">
                                    <FileText className="h-4 w-4" />
                                    Text Entry
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="upload" className="space-y-4 mt-6">
                                <div className="space-y-4">
                                    {/* File Drop Zone */}
                                    <div
                                        className={cn(
                                            "relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
                                            isDragOver 
                                                ? "border-foreground bg-muted/50" 
                                                : "border-border hover:border-muted-foreground hover:bg-muted/30"
                                        )}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            onChange={handleFileSelect}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            disabled={isUploading}
                                        />
                                        <div className="flex flex-col items-center gap-4">
                                            <CloudUpload className="h-8 w-8 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">
                                                    {isDragOver ? 'Drop files here' : 'Drag & drop prompt files here'}
                                                </p>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    or <button 
                                                        type="button"
                                                        className="underline font-medium"
                                                        onClick={() => fileInputRef.current?.click()}
                                                    >
                                                        browse files
                                                    </button> to upload
                                                </p>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Supports .md, .txt, .prompt.md files • Max 50MB total
                                            </p>
                                        </div>
                                    </div>

                                    {/* Selected Files */}
                                    {selectedFiles.length > 0 && (
                                        <div className="space-y-3">
                                            <Label className="text-sm font-medium">
                                                Selected Files ({selectedFiles.length})
                                            </Label>
                                            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                                                {uploadStatuses.map((status, index) => (
                                                    <div key={index} className="flex items-center gap-3 p-2 rounded border">
                                                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-sm font-medium truncate">{status.file.name}</p>
                                                                <div className="flex items-center gap-2 ml-2">
                                                                    {status.status === 'uploading' && (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    )}
                                                                    {status.status === 'success' && (
                                                                        <CheckCircle className="h-4 w-4" />
                                                                    )}
                                                                    {status.status === 'error' && (
                                                                        <AlertCircle className="h-4 w-4" />
                                                                    )}
                                                                    {status.status === 'queued' && !isUploading && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => removeFile(index)}
                                                                            className="h-6 w-6 p-0"
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between mt-1">
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatFileSize(status.file.size)}
                                                                </span>
                                                                <span className="text-xs">
                                                                    {status.status === 'success' ? 'Uploaded' :
                                                                     status.status === 'error' ? 'Failed' :
                                                                     status.status === 'uploading' ? 'Uploading...' :
                                                                     'Ready'}
                                                                </span>
                                                            </div>
                                                            {status.status === 'error' && status.error && (
                                                                <p className="text-xs text-red-600 mt-1">{status.error}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="text" className="space-y-4 mt-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="commandName" className="text-sm font-medium">
                                            New Slash Command
                                        </Label>
                                        <Input
                                            id="commandName"
                                            placeholder="e.g., summarize or draft-email"
                                            value={commandName}
                                            onChange={(e) => setCommandName(e.target.value)}
                                            className={cn(
                                                "font-mono text-sm",
                                                !commandNameValidation.isValid && commandName && "border-red-500"
                                            )}
                                        />
                                        {!commandNameValidation.isValid && commandName && (
                                            <p className="text-sm text-red-600">{commandNameValidation.friendlyError}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            Command name will be used when invoked with /
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="prompt" className="text-sm font-medium">
                                            Prompt
                                        </Label>
                                        <Textarea
                                            id="prompt"
                                            placeholder="Enter your prompt template here..."
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            rows={16}
                                            className="resize-none min-h-[200px] max-h-[200px]"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            This prompt will be prepended to your message when the command is invoked
                                        </p>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button
                                variant="outline"
                                onClick={() => setIsOpen(false)}
                                disabled={isUploading || isCreatingText}
                            >
                                Cancel
                            </Button>
                            {activeTab === 'upload' && (
                                <Button
                                    onClick={handleFileUpload}
                                    disabled={selectedFiles.length === 0 || isUploading}
                                    className="gap-2"
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4" />
                                            Upload {selectedFiles.length} file(s)
                                        </>
                                    )}
                                </Button>
                            )}
                            {activeTab === 'text' && (
                                <Button
                                    onClick={handleTextCreate}
                                    disabled={!commandName.trim() || !prompt.trim() || !commandNameValidation.isValid || isCreatingText}
                                    className="gap-2"
                                >
                                    {isCreatingText ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="h-4 w-4" />
                                            Create Command
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
