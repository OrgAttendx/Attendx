import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Search,
  Download,
  FileSpreadsheet,
  Copy,
  Check,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  Mail,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { facultyAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

export const ClassStudentsModal = ({
  open,
  onOpenChange,
  classItem,
  onBulkUpload,
}) => {
  const { toast } = useToast();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchStudents = async () => {
    if (!classItem?.class_id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await facultyAPI.getStudentsAttendanceStats(
        classItem.class_id
      );
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch student details:", err);
      setError("Failed to load student details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && classItem?.class_id) {
      fetchStudents();
      setSearchQuery("");
    }
  }, [open, classItem?.class_id]);

  const handleCopyCode = () => {
    if (classItem?.join_code) {
      navigator.clipboard.writeText(classItem.join_code);
      setCopiedCode(true);
      toast({
        title: "Copied!",
        description: `Class code ${classItem.join_code} copied to clipboard.`,
      });
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.toLowerCase().trim();
    return students.filter(
      (s) =>
        (s.student_name || "").toLowerCase().includes(query) ||
        (s.roll_number || "").toLowerCase().includes(query) ||
        (s.section || "").toLowerCase().includes(query) ||
        (s.email || "").toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

  // Derived statistics
  const stats = useMemo(() => {
    const total = students.length;
    if (total === 0)
      return { total: 0, avgAttendance: 0, totalSessions: 0, highAttendance: 0, lowAttendance: 0 };

    const totalPct = students.reduce(
      (acc, s) => acc + (parseFloat(s.attendance_percentage) || 0),
      0
    );
    const avgAttendance = Math.round((totalPct / total) * 10) / 10;
    const maxSessions = Math.max(...students.map((s) => s.total_sessions || 0), 0);
    const highAttendance = students.filter(
      (s) => (parseFloat(s.attendance_percentage) || 0) >= 75
    ).length;
    const lowAttendance = students.filter(
      (s) => (parseFloat(s.attendance_percentage) || 0) < 75
    ).length;

    return { total, avgAttendance, totalSessions: maxSessions, highAttendance, lowAttendance };
  }, [students]);

  const handleExportCSV = () => {
    if (filteredStudents.length === 0) {
      toast({
        title: "No Data",
        description: "No student records available to export.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Roll Number",
      "Student Name",
      "Section",
      "Email",
      "Present Sessions",
      "Total Sessions",
      "Attendance %",
    ];

    const rows = filteredStudents.map((s) => [
      `"${s.roll_number || ""}"`,
      `"${s.student_name || ""}"`,
      `"${s.section || ""}"`,
      `"${s.email || ""}"`,
      s.present_count || 0,
      s.total_sessions || 0,
      `${s.attendance_percentage || 0}%`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = `${(classItem?.class_name || "class")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}_students.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exported!",
      description: `Exported ${filteredStudents.length} student record(s) to CSV.`,
    });
  };

  const getAttendanceBadgeVariant = (pct) => {
    if (pct >= 75)
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    if (pct >= 60)
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  };

  const getProgressBarColor = (pct) => {
    if (pct >= 75) return "[&>div]:bg-emerald-500";
    if (pct >= 60) return "[&>div]:bg-amber-500";
    return "[&>div]:bg-rose-500";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                    {classItem?.class_name || "Class Details"}
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Enrolled students & overall attendance overview
                  </DialogDescription>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                className="h-8 gap-1.5 text-xs font-mono"
                title="Click to copy join code"
              >
                <span>Code: <strong className="text-primary font-bold">{classItem?.join_code}</strong></span>
                {copiedCode ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4">
            <div className="p-2.5 sm:p-3 rounded-xl bg-background border flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold leading-none">
                  {stats.total}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-1">
                  Enrolled Students
                </p>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-background border flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold leading-none">
                  {stats.highAttendance}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-1">
                  Good (≥75%)
                </p>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-background border flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold leading-none">
                  {stats.lowAttendance}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-1">
                  At Risk (&lt;75%)
                </p>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-background border flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold leading-none">
                  {stats.avgAttendance}%
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-1">
                  Avg. Attendance
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar: Search, Refresh, Actions */}
        <div className="p-4 border-b flex flex-col sm:flex-row items-center justify-between gap-3 bg-card flex-shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, roll no, section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs sm:text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStudents}
              disabled={loading}
              className="h-9 gap-1.5 text-xs"
              title="Refresh list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {onBulkUpload && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onBulkUpload(classItem);
                }}
                className="h-9 gap-1.5 text-xs font-medium"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Bulk Upload</span>
              </Button>
            )}

            <Button
              variant="default"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredStudents.length === 0}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Student List Content Area */}
        <div className="flex-1 overflow-y-auto min-h-[250px] p-4 sm:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Loading student records...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-10 w-10 text-rose-500 mb-2" />
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStudents}
                className="mt-4 gap-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center border border-dashed rounded-xl bg-muted/20">
              <div className="p-3 rounded-full bg-blue-500/10 text-blue-500 mb-3">
                <Users className="h-8 w-8" />
              </div>
              <h4 className="text-base font-semibold">No Enrolled Students Yet</h4>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mt-1 mb-4">
                Share the join code <strong className="text-primary font-mono">{classItem?.join_code}</strong> with your students or use Bulk Upload to enroll them.
              </p>
              {onBulkUpload && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onBulkUpload(classItem);
                  }}
                  className="gap-2 text-xs font-semibold"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Bulk Upload Students
                </Button>
              )}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                No students found matching "{searchQuery}"
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="mt-2 text-xs text-primary"
              >
                Clear Search Filter
              </Button>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[80px] font-semibold text-xs">Roll No.</TableHead>
                    <TableHead className="font-semibold text-xs">Student</TableHead>
                    <TableHead className="w-[80px] font-semibold text-xs">Section</TableHead>
                    <TableHead className="w-[180px] font-semibold text-xs">Attendance %</TableHead>
                    <TableHead className="w-[130px] font-semibold text-xs text-right">Sessions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((s) => {
                    const pct = parseFloat(s.attendance_percentage) || 0;
                    const initials = (s.student_name || "S")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <TableRow key={s.student_id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                          {s.roll_number || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-semibold truncate leading-tight">
                                {s.student_name || "Unknown"}
                              </p>
                              {s.email && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate mt-0.5">
                                  <Mail className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{s.email}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {s.section ? (
                            <Badge variant="outline" className="text-[11px] font-mono font-medium">
                              {s.section}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5 pr-2">
                            <div className="flex items-center justify-between gap-2">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold py-0.5 px-1.5 border ${getAttendanceBadgeVariant(
                                  pct
                                )}`}
                              >
                                {pct}%
                              </Badge>
                            </div>
                            <Progress
                              value={pct}
                              className={`h-1.5 ${getProgressBarColor(pct)}`}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs font-semibold font-mono">
                            {s.present_count || 0}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {" "}/ {s.total_sessions || 0}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClassStudentsModal;
