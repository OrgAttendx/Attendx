import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { facultyAPI } from "@/services/api";
import { attendanceApi } from "@/api/attendance";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ChevronDown, Search, X, UserMinus } from "lucide-react";
import * as XLSX from "xlsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ClassDetails = ({ classItem }) => {
  const { toast } = useToast();

  const [date, setDate] = useState(new Date());
  const [month, setMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const selectedDate = date.toLocaleDateString("en-CA");

  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);

  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ present: 0, late: 0, absent: 0 });
  const [loading, setLoading] = useState(true);

  // Date range export states
  const [showDateRangeDialog, setShowDateRangeDialog] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [exportLoading, setExportLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  const pollRef = useRef(null);

  const [rowUpdating, setRowUpdating] = useState({});
  const [searchQuery, setSearchQuery] = useState("");

  const handleUpdateStatus = async (studentId, studentName, newStatus) => {
    if (!selectedSession || !studentId) return;
    
    setRowUpdating(prev => ({ ...prev, [studentId]: true }));
    try {
      await attendanceApi.markManualAttendance(selectedSession, studentId, newStatus);
      
      // Update local table data instantly
      setRows(prevRows => 
        prevRows.map(row => 
          row.student_id === studentId 
            ? { ...row, status: newStatus, marked_at: new Date().toISOString().replace('Z', '') }
            : row
        )
      );

      // Recalculate totals
      setRows(currentRows => {
        const updatedRows = currentRows.map(row => 
          row.student_id === studentId 
            ? { ...row, status: newStatus }
            : row
        );
        const present = updatedRows.filter(x => x.status === "PRESENT" || x.status === "LATE").length;
        const absent = updatedRows.filter(x => x.status === "ABSENT").length;
        setTotals({ present, late: 0, absent });
        return updatedRows;
      });

      toast({
        title: "Attendance Updated",
        description: `Successfully marked ${studentName} as ${newStatus}.`,
      });
    } catch (err) {
      console.error("[ClassDetails] Error updating attendance:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update attendance status.",
        variant: "destructive",
      });
    } finally {
      setRowUpdating(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const filteredRows = rows.filter((r) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (r.student_name && r.student_name.toLowerCase().includes(query)) ||
      (r.roll_number && r.roll_number.toLowerCase().includes(query)) ||
      (r.section && r.section.toLowerCase().includes(query))
    );
  });

  /* ---------------------------------------------------
     Export attendance to Excel
  --------------------------------------------------- */
  // Helper to format rows for Excel
  const formatRowsForExport = (rows, sessionDate, sessionTime) => {
    // 1. Group by Section
    const sections = {};
    rows.forEach((r) => {
      const sec = r.section || "Unassigned";
      if (!sections[sec]) sections[sec] = [];
      sections[sec].push(r);
    });

    const exportRows = [];

    // Header Info
    exportRows.push({ "Student Name": `Class: ${classItem.class_name}` });
    exportRows.push({ "Student Name": `Date: ${sessionDate}` });
    exportRows.push({ "Student Name": `Time: ${sessionTime}` });
    exportRows.push({}); // spacer

    const colHeaders = {
      "Roll Number": "Roll Number",
      "Student Name": "Student Name",
      Section: "Section",
      Status: "Status",
      "Marked At": "Marked At",
    };

    // 2. Process each section
    Object.keys(sections)
      .sort()
      .forEach((sec) => {
        const students = sections[sec];

        // Separation
        const presentList = students
          .filter(s => s.status === 'PRESENT' || s.status === 'LATE')
          .sort((a, b) => a.student_name.localeCompare(b.student_name));
          
        const absentList = students
          .filter(s => s.status === 'ABSENT' || !s.status)
          .sort((a, b) => a.student_name.localeCompare(b.student_name));

        // --- SECTION HEADER ---
        exportRows.push({ "Student Name": `SECTION: ${sec}` });
        
        // --- PRESENT BLOCK ---
        if (presentList.length > 0) {
           exportRows.push({ "Student Name": `--- PRESENT (${presentList.length}) ---` });
           exportRows.push(colHeaders);
           presentList.forEach(r => {
             exportRows.push({
              "Roll Number": r.roll_number || "—",
              Section: r.section || "—",
              "Student Name": r.student_name,
              Status: r.status === "LATE" ? "PRESENT" : "PRESENT",
              "Marked At": r.marked_at
                ? new Date(r.marked_at + "Z").toLocaleString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "—",
            });
           });
           exportRows.push({}); // spacer
        }

        // --- ABSENT BLOCK ---
        if (absentList.length > 0) {
           exportRows.push({ "Student Name": `--- ABSENT (${absentList.length}) ---` });
           exportRows.push(colHeaders);
           absentList.forEach(r => {
             exportRows.push({
              "Roll Number": r.roll_number || "—",
              Section: r.section || "—",
              "Student Name": r.student_name,
              Status: "ABSENT",
              "Marked At": "—",
            });
           });
           exportRows.push({}); // spacer
        }

        // Section Summary 
        exportRows.push({ "Student Name": `Total Present: ${presentList.length}` });
        exportRows.push({ "Student Name": `Total Absent: ${absentList.length}` });
        exportRows.push({ "Student Name": `Total Strength: ${presentList.length + absentList.length}` });
        exportRows.push({}); // large spacer between sections
        exportRows.push({}); 
      });

      return exportRows;
  };

  // Export current session only
  const exportCurrentSession = () => {
    if (rows.length === 0) {
      toast({
        title: "No Data",
        description: "No attendance data to export.",
        variant: "destructive",
      });
      return;
    }

    const sessionInfo = sessions.find((s) => s.session_id === selectedSession);
    const sessionTime = sessionInfo
      ? new Date(sessionInfo.start_time).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "Unknown Time";

    // Use the new helper
    const exportData = formatRowsForExport(rows, selectedDate, sessionTime);

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData, { skipHeader: true });

    // Auto-width columns roughly
    const wscols = [
      { wch: 15 }, // Roll
      { wch: 10 }, // Section
      { wch: 30 }, // Name
      { wch: 15 }, // Status
      { wch: 20 }, // Marked At
    ];
    ws["!cols"] = wscols;

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    // Generate filename
    const timeStr = sessionTime.replace(/:/g, "-");
    const filename = `${classItem.class_name}_${selectedDate}_${timeStr}.xlsx`;

    // Download file
    XLSX.writeFile(wb, filename);

    toast({
      title: "Success",
      description: "Current session exported successfully.",
    });
  };

  // Export all sessions for selected date
  const exportCurrentDate = async () => {
    if (sessions.length === 0) {
      toast({
        title: "No Data",
        description: "No sessions found for this date.",
        variant: "destructive",
      });
      return;
    }

    try {
      setExportLoading(true);
      setExportProgress(`Exporting ${sessions.length} session(s)...`);
      const wb = XLSX.utils.book_new();

      // Fetch attendance for each session with progress
      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        setExportProgress(
          `Processing session ${i + 1} of ${sessions.length}...`
        );

        const data = await facultyAPI.getSessionAttendanceFlat(
          session.session_id
        );
        const recs = Array.isArray(data?.records) ? data.records : [];

        // Get time
        const sTime = new Date(session.start_time).toLocaleTimeString("en-IN", {
           hour: "2-digit",
           minute: "2-digit",
           hour12: false
        });

        // Use helper
        const exportData = formatRowsForExport(recs, selectedDate, sTime);

        const ws = XLSX.utils.json_to_sheet(exportData, { skipHeader: true });
        
        // Auto-width columns
        const wscols = [
          { wch: 15 }, 
          { wch: 10 }, 
          { wch: 30 }, 
          { wch: 15 }, 
          { wch: 20 }, 
        ];
        ws["!cols"] = wscols;

        // Use index to ensure unique sheet names
        const sheetName = `Session_${i + 1}`;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      const filename = `${classItem.class_name}_${selectedDate}_AllSessions.xlsx`;
      XLSX.writeFile(wb, filename);

      toast({
        title: "Success",
        description: `Exported ${sessions.length} session(s) successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export sessions.",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
      setExportProgress("");
    }
  };

  // Export date range
  const exportDateRange = async () => {
    try {
      setExportLoading(true);
      setExportProgress("Loading sessions...");

      // Get all dates in range
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        toast({
          title: "Invalid Range",
          description: "Start date must be before end date.",
          variant: "destructive",
        });
        setExportLoading(false);
        setExportProgress("");
        return;
      }

      // Fetch all sessions at once using the optimized endpoint
      const allData = await facultyAPI.getAllSessionsWithAttendance(
        classItem.class_id
      );

      if (!allData || !allData.sessions || allData.sessions.length === 0) {
        toast({
          title: "No Data",
          description: "No sessions found for this class.",
          variant: "destructive",
        });
        setExportLoading(false);
        setExportProgress("");
        return;
      }

      // Filter sessions within the date range
      const filteredSessions = allData.sessions.filter((session) => {
        const sessionDate = new Date(session.start_time);
        return sessionDate >= start && sessionDate <= end;
      });

      if (filteredSessions.length === 0) {
        toast({
          title: "No Data",
          description: "No sessions found in the selected date range.",
          variant: "destructive",
        });
        setExportLoading(false);
        setExportProgress("");
        return;
      }

      const wb = XLSX.utils.book_new();

      // Process filtered sessions with progress updates
      for (let i = 0; i < filteredSessions.length; i++) {
        const session = filteredSessions[i];
        setExportProgress(
          `Processing session ${i + 1} of ${filteredSessions.length}...`
        );

        const recs = Array.isArray(session.records) ? session.records : [];

        const exportData = recs.map((r) => ({
          "Roll Number": r.roll_number || "—",
          Section: r.section || "—",
          "Student Name": r.student_name,
          Status: r.status === "LATE" ? "PRESENT" : r.status,
          "Marked At": r.marked_at
            ? new Date(r.marked_at + "Z").toLocaleString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "—",
        }));

        // Add summary from totals
        const totals = session.totals || { present: 0, late: 0, absent: 0 };
        const present = totals.present + totals.late;

        exportData.push({});
        exportData.push({
          "Roll Number": "",
          Section: "",
          "Student Name": "SUMMARY",
          Status: "",
          "Marked At": "",
        });
        exportData.push({
          "Roll Number": "",
          Section: "",
          "Student Name": "Present",
          Status: present,
          "Marked At": "",
        });
        exportData.push({
          "Roll Number": "",
          Section: "",
          "Student Name": "Absent",
          Status: totals.absent,
          "Marked At": "",
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const dateStr = new Date(session.start_time).toLocaleDateString(
          "en-CA"
        );
        // Use index to ensure unique sheet names
        const sheetName = `${dateStr}_S${i + 1}`.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      const filename = `${classItem.class_name}_${startDate.toLocaleDateString(
        "en-CA"
      )}_to_${endDate.toLocaleDateString("en-CA")}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast({
        title: "Success",
        description: `Exported ${filteredSessions.length} session(s) from date range.`,
      });
      setShowDateRangeDialog(false);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to export date range.",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
      setExportProgress("");
    }
  };

  // Export all dates (all time)
  const exportAllDates = async () => {
    try {
      setExportLoading(true);
      setExportProgress("Loading all sessions...");

      // Use the new optimized endpoint that fetches everything in one query
      const data = await facultyAPI.getAllSessionsWithAttendance(
        classItem.class_id
      );

      if (!data || !data.sessions || data.sessions.length === 0) {
        toast({
          title: "No Data",
          description: "No sessions found for this class.",
          variant: "destructive",
        });
        setExportLoading(false);
        setExportProgress("");
        return;
      }

      const wb = XLSX.utils.book_new();
      const sessions = data.sessions;
      const usedSheetNames = new Set();


      // Process sessions with progress updates
      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        setExportProgress(
          `Processing session ${i + 1} of ${sessions.length}...`
        );


        const recs = Array.isArray(session.records) ? session.records : [];

        const exportData = recs.map((r) => ({
          "Roll Number": r.roll_number || "—",
          Section: r.section || "—",
          "Student Name": r.student_name,
          Status: r.status === "LATE" ? "PRESENT" : r.status,
          "Marked At": r.marked_at
            ? new Date(r.marked_at + "Z").toLocaleString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "—",
        }));

        // Add summary from totals
        const totals = session.totals || { present: 0, late: 0, absent: 0 };
        const present = totals.present + totals.late; // Combine present and late

        exportData.push({});
        exportData.push({
          "Roll Number": "",
          Section: "",
          "Student Name": "SUMMARY",
          Status: "",
          "Marked At": "",
        });
        exportData.push({
          "Roll Number": "",
          Section: "",
          "Student Name": "Present",
          Status: present,
          "Marked At": "",
        });
        exportData.push({
          "Roll Number": "",
          Section: "",
          "Student Name": "Absent",
          Status: totals.absent,
          "Marked At": "",
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const dateStr = new Date(session.start_time).toLocaleDateString(
          "en-CA"
        );
        const timeStr = new Date(session.start_time)
          .toLocaleTimeString("en-US", { hour12: false })
          .replace(/:/g, "-");

        // Create unique sheet name by appending counter if duplicate
        let baseSheetName = `${dateStr}_${timeStr}`.substring(0, 28);
        let sheetName = baseSheetName;
        let counter = 1;

        while (usedSheetNames.has(sheetName)) {
          sheetName = `${baseSheetName}_${counter}`;
          counter++;
        }

        usedSheetNames.add(sheetName);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }


      const filename = `${classItem.class_name}_AllSessions_Complete.xlsx`;
      XLSX.writeFile(wb, filename);

      toast({
        title: "Success",
        description: `Exported ${sessions.length} session(s) successfully.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to export all sessions. " + error.message,
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
      setExportProgress("");
    }
  };

  /* ---------------------------------------------------
     STEP 1 — Load ALL sessions on the selected date
  --------------------------------------------------- */
  const loadSessions = async () => {
    try {
      setLoading(true);
      const list = await facultyAPI.getSessionsByDate(
        classItem.class_id,
        selectedDate
      );

      setSessions(list);

      if (list.length > 0) {
        const latest = list[list.length - 1].session_id;
        setSelectedSession(latest); // auto-select latest
      } else {
        setSelectedSession(null);
        setRows([]);
        setTotals({ present: 0, late: 0, absent: 0 });
        setLoading(false); // Clear loading when no sessions
      }
    } catch (err) {
      console.error("[ClassDetails] Error loading sessions:", err);
      toast({
        title: "Error",
        description: "Failed to load sessions.",
        variant: "destructive",
      });
      setLoading(false); // Clear loading on error
    }
  };

  /* ---------------------------------------------------
     STEP 2 — Load attendance for ONE specific session
  --------------------------------------------------- */
  const loadSessionAttendance = async (sessionId, silent = false) => {
    if (!sessionId) return;

    try {
      if (!silent) setLoading(true);

      const data = await facultyAPI.getSessionAttendanceFlat(sessionId);

      const recs = Array.isArray(data?.records) ? data.records : (Array.isArray(data) ? data : []);

      // Count LATE as PRESENT
      const present = recs.filter(
        (x) => x.status === "PRESENT" || x.status === "LATE"
      ).length;
      const absent = recs.filter((x) => x.status === "ABSENT").length;

      setTotals({ present, late: 0, absent });
      setRows(
        recs.sort((a, b) => {
          const sectionA = (a.section || "").toUpperCase();
          const sectionB = (b.section || "").toUpperCase();
          if (sectionA && sectionB && sectionA !== sectionB) {
            return sectionA.localeCompare(sectionB, undefined, {
              numeric: true,
            });
          }
          if (sectionA && !sectionB) return -1;
          if (!sectionA && sectionB) return 1;
          // Sort by roll number first, then by name if roll numbers are equal or missing
          const rollA = a.roll_number || "";
          const rollB = b.roll_number || "";
          if (rollA && rollB) {
            const rollCompare = rollA.localeCompare(rollB, undefined, {
              numeric: true,
            });
            if (rollCompare !== 0) return rollCompare;
          }
          // If roll numbers are the same or missing, sort by name
          return a.student_name.localeCompare(b.student_name);
        })
      );
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load attendance.",
        variant: "destructive",
      });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  /* ---------------------------------------------------
     Load sessions whenever date changes
  --------------------------------------------------- */
  useEffect(() => {
    loadSessions();
  }, [selectedDate]);

  /* ---------------------------------------------------
     Load attendance whenever selectedSession changes
  --------------------------------------------------- */
  useEffect(() => {
    if (!selectedSession) return;

    loadSessionAttendance(selectedSession, false);

    if (pollRef.current) clearInterval(pollRef.current);

    // Live update every 10s
    pollRef.current = setInterval(() => {
      loadSessionAttendance(selectedSession, true);
    }, 10000);

    return () => pollRef.current && clearInterval(pollRef.current);
  }, [selectedSession]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        Loading…
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-3 pb-4">
      <h2 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4">
        {classItem.class_name} Attendance
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Calendar */}
        <div className="lg:col-span-1 flex justify-center">
          <Calendar
            mode="single"
            month={month}
            onMonthChange={setMonth}
            selected={date}
            onSelect={(d) => {
              if (!d) return;
              setDate(d);
              setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
            className="rounded-md border w-full max-w-sm"
          />
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-col items-start justify-between gap-3 pb-4">
              <CardTitle className="text-base sm:text-lg">
                Attendance for {selectedDate}
              </CardTitle>
              <div className="flex flex-col w-full sm:w-auto gap-2">
                {exportProgress && (
                  <span className="text-xs text-muted-foreground">
                    {exportProgress}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center justify-center gap-2 w-full sm:w-auto"
                      disabled={exportLoading}
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {exportLoading ? "Exporting..." : "Export to Excel"}
                      </span>
                      <span className="sm:hidden">Export</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={exportCurrentSession}
                      disabled={rows.length === 0}
                    >
                      Current Session Only
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={exportCurrentDate}
                      disabled={sessions.length === 0}
                    >
                      Current Date ({selectedDate})
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowDateRangeDialog(true)}
                    >
                      Custom Date Range...
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportAllDates}>
                      All Dates (Complete History)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>

            <CardContent>
              {/* Session Dropdown */}
              {sessions.length > 0 && (
                <div className="mb-4">
                  <label className="text-sm font-medium text-foreground">
                    Select Session
                  </label>
                  <select
                    className="border rounded-md w-full p-2 mt-1 bg-background text-foreground border-input focus:ring-2 focus:ring-ring"
                    value={selectedSession || ""}
                    onChange={(e) => setSelectedSession(Number(e.target.value))}
                  >
                    {sessions.map((s) => (
                      <option key={s.session_id} value={s.session_id}>
                        Session {s.session_id} at{" "}
                        {new Date(s.start_time).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Totals */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
                <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">
                    Present
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-300">
                    {totals.present}
                  </p>
                </div>

                <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-400">
                    Absent
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-red-700 dark:text-red-300">
                    {totals.absent}
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              {rows.length > 0 && (
                <div className="mb-4 mt-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                      <Input
                        placeholder="Search student by name, roll no, or section..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-9 w-full bg-background/50 border-input/60 hover:border-input focus-visible:ring-1 focus-visible:ring-ring/40 transition-all rounded-lg"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted transition-colors"
                          type="button"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground select-none">
                      <span>
                        Found <strong className="text-foreground">{filteredRows.length}</strong> of{" "}
                        <strong className="text-foreground">{rows.length}</strong> students
                      </span>
                      {searchQuery && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10 border-transparent text-[10px] sm:text-xs">
                          Filtered
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Table - Mobile Responsive with Horizontal Scroll */}
              {filteredRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center border rounded-lg bg-muted/10 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 mb-3 ring-6 ring-muted/10">
                    <UserMinus className="h-5 w-5 text-muted-foreground/80" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">No students found</h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                    {rows.length === 0 
                      ? "There are no student records for this session."
                      : `We couldn't find any students matching "${searchQuery}".`}
                  </p>
                  {searchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchQuery("")}
                      className="mt-3 gap-1.5 hover:bg-muted rounded-lg shadow-sm border-dashed text-xs h-8"
                    >
                      <X className="h-3 w-3" />
                      Clear Search
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">
                            Roll Number
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Section
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Student
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Status
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Time
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {filteredRows.map((r) => (
                        <TableRow key={r.student_id ? `${r.student_id}-${r.roll_number}` : `${r.student_name}-${Math.random()}`}>
                          <TableCell>{r.roll_number || "—"}</TableCell>
                          <TableCell>{r.section || "—"}</TableCell>
                          <TableCell>{r.student_name}</TableCell>

                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild disabled={rowUpdating[r.student_id]}>
                                <button className="cursor-pointer focus:outline-none transition-transform active:scale-95 disabled:opacity-50">
                                  <Badge
                                    variant={
                                      r.status === "PRESENT" || r.status === "LATE"
                                        ? "default"
                                        : "destructive"
                                    }
                                    className="hover:opacity-85 transition-opacity px-2.5 py-1 text-xs select-none cursor-pointer flex items-center gap-1 font-semibold"
                                  >
                                    {r.status === "LATE" ? "PRESENT" : r.status}
                                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                                  </Badge>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="min-w-[100px] rounded-lg shadow-md border-border bg-popover">
                                <DropdownMenuItem
                                  onClick={() => handleUpdateStatus(r.student_id, r.student_name, "PRESENT")}
                                  className="text-xs sm:text-sm font-medium hover:bg-muted py-1.5 cursor-pointer text-green-600 focus:text-green-600 focus:bg-green-50 dark:focus:bg-green-950/20"
                                >
                                  Present
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleUpdateStatus(r.student_id, r.student_name, "ABSENT")}
                                  className="text-xs sm:text-sm font-medium hover:bg-muted py-1.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                                >
                                  Absent
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>

                          <TableCell>
                            {r.marked_at
                              ? new Date(r.marked_at + "Z").toLocaleTimeString(
                                  "en-IN",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  }
                                )
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Date Range Export Dialog */}
      <Dialog open={showDateRangeDialog} onOpenChange={setShowDateRangeDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              Export Date Range
            </DialogTitle>
            <DialogDescription className="text-sm">
              Select a date range to export all attendance sessions within that
              period.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(d) => d && setStartDate(d)}
                  className="rounded-md border w-full max-w-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(d) => d && setEndDate(d)}
                  className="rounded-md border w-full max-w-sm"
                />
              </div>
            </div>
          </div>
          {exportProgress && (
            <div className="text-xs sm:text-sm text-center text-muted-foreground py-2">
              {exportProgress}
            </div>
          )}
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowDateRangeDialog(false)}
              disabled={exportLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={exportDateRange}
              disabled={exportLoading}
              className="w-full sm:w-auto"
            >
              {exportLoading ? "Exporting..." : "Export"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClassDetails;