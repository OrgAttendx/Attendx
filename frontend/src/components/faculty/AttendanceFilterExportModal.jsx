import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart2, Download, Filter, Users } from "lucide-react";
import { facultyAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

export const AttendanceFilterExportModal = ({ open, onOpenChange, classItem }) => {
  const { toast } = useToast();
  const [filterMinPct, setFilterMinPct] = useState("");
  const [filterMaxPct, setFilterMaxPct] = useState("");
  const [filterStudents, setFilterStudents] = useState([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterApplied, setFilterApplied] = useState(false);

  const handleClose = (isOpen) => {
    if (!isOpen) {
      setFilterStudents([]);
      setFilterApplied(false);
      setFilterMinPct("");
      setFilterMaxPct("");
    }
    onOpenChange(isOpen);
  };

  const handleApplyFilter = async () => {
    if (!classItem) return;
    setFilterLoading(true);
    try {
      const params = {};
      if (filterMinPct !== "") params.min_pct = parseFloat(filterMinPct);
      if (filterMaxPct !== "") params.max_pct = parseFloat(filterMaxPct);
      const students = await facultyAPI.getStudentsAttendanceStats(
        classItem.class_id,
        params
      );
      setFilterStudents(students);
      setFilterApplied(true);
    } catch (err) {
      toast({
        title: "Error",
        description:
          err?.response?.data?.detail || "Failed to fetch attendance data.",
        variant: "destructive",
      });
    } finally {
      setFilterLoading(false);
    }
  };

  const handleExportFilterCSV = () => {
    if (filterStudents.length === 0) {
      toast({
        title: "No Data",
        description: "No students to export.",
        variant: "destructive",
      });
      return;
    }
    const headers = [
      "Roll Number",
      "Name",
      "Email",
      "Total Sessions",
      "Present",
      "Attendance %",
    ];
    const csvRows = [
      headers.join(","),
      ...filterStudents.map((s) =>
        [
          `"${s.roll_number || "—"}"`,
          `"${s.student_name || ""}"`,
          `"${s.email || "—"}"`,
          s.total_sessions ?? 0,
          s.present_count ?? 0,
          s.attendance_percentage ?? 0,
        ].join(",")
      ),
    ];
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const minLabel = filterMinPct !== "" ? `min${filterMinPct}` : "";
    const maxLabel = filterMaxPct !== "" ? `max${filterMaxPct}` : "";
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${classItem?.class_name}_attendance_${minLabel}${
        maxLabel ? `-${maxLabel}` : ""
      }.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: "Exported",
      description: `${filterStudents.length} student(s) exported to CSV.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <BarChart2 className="h-5 w-5 text-primary" />
            Attendance Filter &amp; Export
            {classItem && (
              <span className="text-muted-foreground font-normal text-sm ml-1">
                — {classItem.class_name}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Filter students by attendance percentage, preview the results, and
            export to CSV.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="filter-min-pct"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              Min Attendance %
            </Label>
            <Input
              id="filter-min-pct"
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 0"
              value={filterMinPct}
              onChange={(e) => setFilterMinPct(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="filter-max-pct"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              Max Attendance %
            </Label>
            <Input
              id="filter-max-pct"
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 75"
              value={filterMaxPct}
              onChange={(e) => setFilterMaxPct(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Quick preset chips */}
        <div className="flex flex-wrap gap-2 pb-3 border-b border-border/40">
          <span className="text-xs text-muted-foreground self-center">
            Quick filters:
          </span>
          {[
            { label: "Below 75%", min: "", max: "74.99" },
            { label: "Below 50%", min: "", max: "49.99" },
            { label: "Above 75%", min: "75", max: "" },
            { label: "Above 90%", min: "90", max: "" },
            { label: "All", min: "", max: "" },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setFilterMinPct(preset.min);
                setFilterMaxPct(preset.max);
              }}
              className="px-2.5 py-1 rounded-full text-xs border border-border hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Apply button */}
        <div className="flex justify-end pt-1 pb-2">
          <Button
            size="sm"
            onClick={handleApplyFilter}
            disabled={filterLoading}
            className="gap-2 h-9"
          >
            <Filter className="h-3.5 w-3.5" />
            {filterLoading ? "Loading…" : "Apply Filter"}
          </Button>
        </div>

        {/* Results */}
        {filterApplied && (
          <div className="space-y-3">
            {/* Summary bar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {filterStudents.length} student
                  {filterStudents.length !== 1 ? "s" : ""}
                </Badge>
                {filterStudents.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Avg:{" "}
                    <strong className="text-foreground">
                      {(
                        filterStudents.reduce(
                          (sum, s) =>
                            sum + parseFloat(s.attendance_percentage || 0),
                          0
                        ) / filterStudents.length
                      ).toFixed(1)}
                      %
                    </strong>
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportFilterCSV}
                disabled={filterStudents.length === 0}
                className="gap-1.5 h-8 text-xs border-dashed hover:border-primary/50 hover:text-primary"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>

            {filterStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 border rounded-lg bg-muted/10 text-center">
                <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium">No students match the filter</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try adjusting the percentage range.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="whitespace-nowrap text-xs py-2">
                        Roll No.
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-xs py-2">
                        Name
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-xs py-2 text-center">
                        Sessions
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-xs py-2 text-center">
                        Present
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-xs py-2 text-center">
                        Attendance %
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterStudents.map((s) => {
                      const pct = parseFloat(s.attendance_percentage || 0);
                      const pctColor =
                        pct >= 75
                          ? "text-green-600 dark:text-green-400"
                          : pct >= 50
                          ? "text-yellow-600 dark:text-yellow-400"
                          : "text-red-600 dark:text-red-400";
                      return (
                        <TableRow key={s.student_id} className="hover:bg-muted/20">
                          <TableCell className="text-xs py-2 font-mono">
                            {s.roll_number || "—"}
                          </TableCell>
                          <TableCell className="text-xs py-2 font-medium">
                            {s.student_name}
                          </TableCell>
                          <TableCell className="text-xs py-2 text-center text-muted-foreground">
                            {s.total_sessions ?? 0}
                          </TableCell>
                          <TableCell className="text-xs py-2 text-center text-muted-foreground">
                            {s.present_count ?? 0}
                          </TableCell>
                          <TableCell className="text-xs py-2 text-center">
                            <span className={`font-bold ${pctColor}`}>
                              {pct.toFixed(1)}%
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceFilterExportModal;
