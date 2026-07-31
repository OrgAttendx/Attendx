import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { facultyAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  KeyRound,
  X,
  Sparkles,
  Users,
  Check,
  HelpCircle,
} from "lucide-react";

export const BulkStudentUploadModal = ({
  isOpen,
  onClose,
  classId,
  className,
  onSuccess,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [totalRowsCount, setTotalRowsCount] = useState(0);
  const [defaultPassword, setDefaultPassword] = useState("Student@123");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [resultSummary, setResultSummary] = useState(null);

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewRows([]);
    setTotalRowsCount(0);
    setResultSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // File change handler (CSV / Excel)
  const processFile = (file) => {
    if (!file) return;

    // Validate file extension
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext)) {
      toast({
        title: "Invalid file type",
        description: "Please select a valid CSV or Excel file (.csv, .xlsx, .xls).",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setResultSummary(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        setTotalRowsCount(jsonRows.length);
        setPreviewRows(jsonRows.slice(0, 5)); // Preview up to 5 rows
      } catch (err) {
        console.error("Error reading file preview:", err);
        toast({
          title: "File Read Error",
          description: "Could not parse file content. Make sure it is a valid CSV spreadsheet.",
          variant: "destructive",
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  };

  // Download Sample Template CSV
  const handleDownloadSample = () => {
    const csvContent =
      "Name,Email,Roll Number,Section\n" +
      "John Doe,john.doe@school.edu,21CS001,A\n" +
      "Jane Smith,jane.smith@school.edu,21CS002,A\n" +
      "Alex Johnson,alex.j@school.edu,21CS003,B\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "student_bulk_registration_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Template Downloaded",
      description: "Sample CSV template has been downloaded to your computer.",
    });
  };

  // Upload Submit Handler
  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please choose a CSV file to upload.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const data = await facultyAPI.bulkRegisterStudents(
        classId,
        selectedFile,
        defaultPassword
      );

      setResultSummary(data);

      toast({
        title: "Bulk Upload Complete! 🎉",
        description: `Successfully registered ${data.created_users_count || 0} accounts and enrolled ${data.enrolled_count || 0} students.`,
      });

      if (onSuccess) {
        try {
          onSuccess();
        } catch (cbErr) {
          console.error("Error in onSuccess callback:", cbErr);
        }
      }
    } catch (err) {
      console.error("Bulk upload error:", err);
      toast({
        title: "Upload Failed",
        description:
          err.response?.data?.detail ||
          "Failed to process bulk upload. Please check file format and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[620px] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b bg-muted/40 relative pr-12">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
                Bulk Student Upload
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Class: <strong className="text-foreground">{className}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {!resultSummary ? (
            <>
              {/* Template Download Banner */}
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <HelpCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium truncate">
                    Need standard CSV formatting? Download our template.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSample}
                  className="h-8 text-xs font-semibold gap-1.5 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 flex-shrink-0 bg-background"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Sample CSV</span>
                </Button>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? "border-primary bg-primary/10 scale-[1.01]"
                    : selectedFile
                    ? "border-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-500/10"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0 text-left">
                      <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                        <FileText className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {selectedFile.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {totalRowsCount} student row(s) detected
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReset();
                      }}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full flex-shrink-0"
                      title="Remove selected file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2.5 py-3">
                    <div className="p-3.5 rounded-full bg-primary/10 text-primary">
                      <UploadCloud className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Drag and drop your CSV file here, or{" "}
                        <span className="text-primary underline underline-offset-2 font-bold">
                          browse files
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Only CSV (`.csv`) files are supported
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Default Password Setting */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <KeyRound className="h-3.5 w-3.5 text-primary" /> Default Student Password
                  </Label>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Temporary
                  </Badge>
                </div>
                <Input
                  type="text"
                  value={defaultPassword}
                  onChange={(e) => setDefaultPassword(e.target.value)}
                  placeholder="Student@123"
                  className="text-xs font-mono bg-background"
                />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Newly created student accounts will be assigned this initial password and prompted to change it upon first login.
                </p>
              </div>

              {/* Data Preview Table */}
              {previewRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Data Preview (First {previewRows.length} rows):
                    </p>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Total: <strong>{totalRowsCount}</strong> records
                    </span>
                  </div>

                  <div className="max-h-[170px] overflow-auto rounded-xl border border-border bg-card shadow-inner">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/80 text-muted-foreground font-semibold sticky top-0 border-b">
                        <tr>
                          {Object.keys(previewRows[0]).map((key) => (
                            <th key={key} className="px-3 py-2 font-mono text-[11px]">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {previewRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-muted/40 transition-colors">
                            {Object.values(row).map((val, i) => (
                              <td key={i} className="px-3 py-2 truncate max-w-[140px] text-[11px]">
                                {String(val) || "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Upload Result Summary Screen */
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-3">
                <div className="flex items-center gap-2.5 font-bold text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>Bulk Upload Completed Successfully!</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-background/80 p-3 rounded-lg border border-emerald-500/20 shadow-sm">
                    <p className="text-muted-foreground text-[11px] font-medium">New User Accounts</p>
                    <p className="text-xl font-extrabold text-foreground mt-0.5">
                      {resultSummary.created_users_count || 0}
                    </p>
                  </div>
                  <div className="bg-background/80 p-3 rounded-lg border border-emerald-500/20 shadow-sm">
                    <p className="text-muted-foreground text-[11px] font-medium">Enrolled in Class</p>
                    <p className="text-xl font-extrabold text-foreground mt-0.5">
                      {resultSummary.enrolled_count || 0}
                    </p>
                  </div>
                </div>

                {resultSummary.default_password && (
                  <p className="text-xs text-muted-foreground pt-1">
                    🔑 Default password assigned:{" "}
                    <strong className="font-mono text-foreground">{resultSummary.default_password}</strong>
                  </p>
                )}
              </div>

              {/* Errors or Skipped rows */}
              {resultSummary.errors?.length > 0 && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 space-y-2 text-xs text-destructive">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Skipped Rows / Issues ({resultSummary.errors.length}):
                  </p>
                  <ul className="list-disc list-inside max-h-[120px] overflow-auto text-[11px] space-y-1 text-muted-foreground">
                    {resultSummary.errors.map((err, i) => (
                      <li key={i} className="leading-tight">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 border-t bg-muted/20 gap-2 sm:gap-0 flex-shrink-0">
          {!resultSummary ? (
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={loading}
                className="h-9 px-4 text-xs font-medium"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleUpload}
                disabled={loading || !selectedFile}
                className="h-9 px-4 text-xs font-semibold gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing Upload...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    <span>Upload & Enroll</span>
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleClose}
              className="w-full h-9 text-xs font-semibold gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Done & Return to Dashboard</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkStudentUploadModal;
