import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  FileIcon,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useReducer, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useUploadFile } from "../api/useUploadFile";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { toast } from "sonner";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500mb

enum FileUploadStatus {
  QUEUED = "queued",
  PENDING = "pending",
  SUCCESS = "success",
  ERROR = "error",
}

interface FileUpload {
  id: string;
  file: File;
  status: FileUploadStatus;
}

interface UploadState {
  files: FileUpload[];
}

type FileAction =
  | { type: "ADD_FILES"; files: File[] }
  | { type: "UPDATE_FILE_STATUS"; id: string; status: FileUploadStatus }
  | { type: "REMOVE_FILE"; id: string }
  | { type: "RESET" };

function reducer(state: UploadState, action: FileAction): UploadState {
  switch (action.type) {
    case "ADD_FILES": {
      const newFiles = action.files.map((file) => ({
        id: Math.random().toString(36).substring(2, 9),
        file,
        status: FileUploadStatus.QUEUED,
      }));
      return {
        ...state,
        files: [...state.files, ...newFiles],
      };
    }
    case "UPDATE_FILE_STATUS":
      return {
        ...state,
        files: state.files.map((file) =>
          file.id === action.id ? { ...file, status: action.status } : file,
        ),
      };
    case "REMOVE_FILE":
      return {
        ...state,
        files: state.files.filter((file) => file.id !== action.id),
      };
    case "RESET":
      return { files: [] };
    default:
      return state;
  }
}

export function UploadDialog() {
  const { mutateAsync } = useUploadFile();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  const { organizationId } = useParams();

  const [uploadState, dispatch] = useReducer(reducer, {
    files: [],
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(
      (file) => file.size > 0 && file.size <= MAX_FILE_SIZE,
    );
    if (validFiles.length > 0) {
      dispatch({ type: "ADD_FILES", files: validFiles });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    maxSize: MAX_FILE_SIZE,
    disabled: isUploading,
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (event.clipboardData && event.clipboardData.files.length > 0) {
        const files = Array.from(event.clipboardData.files);
        onDrop(files);
      }
    };

    if (isOpen && !isUploading) {
      window.addEventListener("paste", handlePaste);
    }

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [isOpen, isUploading, onDrop]);

  const handleUpload = async () => {
    if (isUploading) return;
    setIsUploading(true);
    const results = await Promise.all(uploadState.files.map(async (file) => {
      if (file.status === FileUploadStatus.SUCCESS) return true;
      dispatch({
        type: "UPDATE_FILE_STATUS",
        id: file.id,
        status: FileUploadStatus.PENDING,
      });
      try {
        await mutateAsync(file.file);
        dispatch({
          type: "UPDATE_FILE_STATUS",
          id: file.id,
          status: FileUploadStatus.SUCCESS,
        });
        return true;
      } catch (error) {
        dispatch({
          type: "UPDATE_FILE_STATUS",
          id: file.id,
          status: FileUploadStatus.ERROR,
        });
        toast.error(`${file.file.name}: ${error instanceof Error ? error.message : "Upload failed"}`);
        return false;
      }
    }));
    setIsUploading(false);
    void queryClient.invalidateQueries({ queryKey: ["storage", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["organization-stats", organizationId] });
    if (results.every(Boolean)) {
      toast.success("Files uploaded");
      setIsOpen(false);
      dispatch({ type: "RESET" });
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (isUploading) return;
    setIsOpen(open);
    if (!open) {
      dispatch({ type: "RESET" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button>Upload files</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
        </DialogHeader>

        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center transition-colors cursor-pointer",
            isDragActive && "border-primary bg-muted/50",
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="p-4 bg-muted rounded-full">
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">
                Click to upload or drag and drop
              </h3>
              <p className="text-xs text-muted-foreground">
                SVG, PNG, JPG or GIF (max. 500MB)
              </p>
            </div>
            <Button type="button" onClick={open} variant="secondary" size="sm" disabled={isUploading}>
              Select files
            </Button>
          </div>
        </div>

        {uploadState.files.length > 0 && (
          <div className="space-y-2 mt-4 max-h-60 overflow-y-auto pr-2">
            <h4 className="text-sm font-medium">Files to upload</h4>
            <ul className="divide-y divide-border rounded-md border">
              {uploadState.files.map((fileUpload) => (
                <li
                  key={fileUpload.id}
                  className="flex items-center justify-between p-3"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-muted rounded-md shrink-0">
                      <FileIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-sm overflow-hidden">
                      <p
                        className="font-medium truncate max-w-[200px]"
                        title={fileUpload.file.name}
                      >
                        {fileUpload.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(fileUpload.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {fileUpload.status === FileUploadStatus.QUEUED && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                        Queued
                      </span>
                    )}
                    {fileUpload.status === FileUploadStatus.PENDING && (
                      <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                        Uploading...
                      </div>
                    )}
                    {fileUpload.status === FileUploadStatus.SUCCESS && (
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Uploaded
                      </span>
                    )}
                    {fileUpload.status === FileUploadStatus.ERROR && (
                      <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-200">
                        <XCircle className="h-3 w-3" />
                        Error
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        dispatch({ type: "REMOVE_FILE", id: fileUpload.id })
                      }
                      disabled={isUploading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={
              uploadState.files.length === 0 ||
              uploadState.files.every(
                (f) => f.status === FileUploadStatus.SUCCESS,
              ) ||
              isUploading
            }
          >
            Upload{" "}
            {uploadState.files.length > 0
              ? `(${uploadState.files.length})`
              : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
