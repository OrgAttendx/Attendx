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
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader,
  Users,
  FileText,
  KeyRound,
  X,
} from "lucide-react";

export const BulkStudentUploadModal = ({ isOpen, onClose, classId, className, onSuccess }) => {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [defaultPassword, setDefaultPassword] = useState("Student@123");
  const [loading, setLoading] = useState(false);
  const [resultSummary, setResultSummary] = useState(null);

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewRows([]);
    setResultSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // ✅ Client-side preview parser using XLSX
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        setPreviewRows(jsonRows.slice(0, 5)); // Preview first 5 rows
      } catch (err) {
        console.error("Error reading preview file:", err);
      }
    };
    reader.readAsBinaryString(file);
  };

  // ✅ Download Sample CSV Template
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
  };

  // ✅ Upload Action
  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please choose a CSV or Excel file to upload.",
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
        description: `Registered ${data.created_users_count} new accounts and enrolled ${data.enrolled_count} students.`,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Error uploading bulk file:", err);
      toast({
        title: "Upload Failed ❌",
        description: err.response?.data?.detail || "Failed to process bulk upload.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] bg-card p-6 border-border shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight">
                  Bulk Add Students & Class Enrollment
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Class: <strong className="text-foreground">{className}</strong>
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSample}
              className="text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Sample CSV</span>
            </Button>
          </div>
        </DialogHeader>

        {!resultSummary ? (
          <div className="space-y-4 py-2">
            {/* File Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                selectedFile
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500">
                    <FileText className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Click to change file
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 rounded-full bg-primary/10 text-primary">
                    <UploadCloud className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Click to choose or drop Excel / CSV file
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports .csv, .xlsx, .xls formats
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Default Password Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-primary" /> Default Password for New Students
              </Label>
              <Input
                type="text"
                value={defaultPassword}
                onChange={(e) => setDefaultPassword(e.target.value)}
                placeholder="Student@123"
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Newly registered students receive this default password and will be prompted to change it on their first login.
              </p>
            </div>

            {/* Data Preview Table */}
            {previewRows.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs font-bold text-foreground">
                  File Preview (First {previewRows.length} rows):
                </p>
                <div className="max-h-[160px] overflow-auto rounded-xl border border-border bg-muted/20">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-muted/80 text-muted-foreground font-semibold sticky top-0">
                      <tr>
                        {Object.keys(previewRows[0]).map((key) => (
                          <th key={key} className="px-3 py-1.5 border-b border-border">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/50">
                          {Object.values(row).map((val, i) => (
                            <td key={i} className="px-3 py-1.5">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Result Summary View */
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-600 dark:text-emerald-400 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Bulk Import Successfully Completed!</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="bg-card/50 p-2.5 rounded-lg border border-emerald-500/20">
                  <p className="text-muted-foreground text-[10px]">New Accounts Created</p>
                  <p className="text-lg font-extrabold text-foreground">
                    {resultSummary.created_users_count}
                  </p>
                </div>
                <div className="bg-card/50 p-2.5 rounded-lg border border-emerald-500/20">
                  <p className="text-muted-foreground text-[10px]">Enrolled in Class</p>
                  <p className="text-lg font-extrabold text-foreground">
                    {resultSummary.enrolled_count}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                🔑 Default password assigned: <strong className="font-mono text-foreground">{resultSummary.default_password}</strong>
              </p>
            </div>

            {resultSummary.errors?.length > 0 && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 space-y-1 text-xs text-destructive">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> Skipped Rows / Errors ({resultSummary.errors.length}):
                </p>
                <ul className="list-disc list-inside max-h-[100px] overflow-auto text-[11px] space-y-0.5 text-muted-foreground">
                  {resultSummary.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {!resultSummary ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleUpload}
                disabled={loading || !selectedFile}
                className="gap-2 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Processing Upload...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    <span>Upload & Register</span>
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" onClick={handleClose} className="w-full">
              Done & Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkStudentUploadModal;
