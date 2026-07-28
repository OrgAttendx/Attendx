import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { facultyAPI } from "@/services/api";
import { attendanceApi } from "@/api/attendance";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Download,
  ChevronDown,
  Search,
  X,
  UserMinus,
  Trash2,
  AlertTriangle,
  Loader,
  Calendar as CalendarIcon,
  CalendarX,
} from "lucide-react";
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
  const queryClient = useQueryClient();

  // Selection states
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);

  // Search & row updating states
  const [searchQuery, setSearchQuery] = useState("");
  const [rowUpdating, setRowUpdating] = useState({});

  // Date range export states
  const [showDateRangeDialog, setShowDateRangeDialog] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [exportLoading, setExportLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  // Delete Session confirmation state
  const [deleteSessionStep, setDeleteSessionStep] = useState(0); // 0: closed, 1: step 1, 2: step 2
  const [deleteSessionInput, setDeleteSessionInput] = useState("");

  /* ---------------------------------------------------
     REACT QUERY: Fetch all sessions & attendance at once
  --------------------------------------------------- */
  const {
    data: classSessionsData,
    isLoading: loading,
    isError,
  } = useQuery({
    queryKey: ["class-sessions", classItem?.class_id],
    queryFn: () => facultyAPI.getAllSessionsWithAttendance(classItem?.class_id),
    enabled: !!classItem?.class_id,
    staleTime: 10000,
    refetchOnWindowFocus: false,
  });

  const rawSessions = useMemo(() => {
    return Array.isArray(classSessionsData?.sessions) ? classSessionsData.sessions : [];
  }, [classSessionsData]);

  /* ---------------------------------------------------
     DERIVED DATA: Distinct session dates
  --------------------------------------------------- */
  const sessionDates = useMemo(() => {
    const map = new Map();
    rawSessions.forEach((s) => {
      const dateStr = new Date(s.start_time).toLocaleDateString("en-CA");
      if (!map.has(dateStr)) {
        map.set(dateStr, { date: dateStr, session_count: 0, latest_start_time: s.start_time });
      }
      const item = map.get(dateStr);
      item.session_count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [rawSessions]);

  // Auto-select latest date if none selected or invalid
  useEffect(() => {
    if (sessionDates.length > 0) {
      if (!selectedDate || !sessionDates.some((d) => d.date === selectedDate)) {
        setSelectedDate(sessionDates[0].date);
      }
    } else {
      setSelectedDate("");
      setSelectedSession(null);
    }
  }, [sessionDates]);

  /* ---------------------------------------------------
     DERIVED DATA: Sessions for current selected date
  --------------------------------------------------- */
  const sessions = useMemo(() => {
    if (!selectedDate) return [];
    return rawSessions
      .filter((s) => new Date(s.start_time).toLocaleDateString("en-CA") === selectedDate)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }, [rawSessions, selectedDate]);

  // Auto-select latest session for selectedDate
  useEffect(() => {
    if (sessions.length > 0) {
      if (!selectedSession || !sessions.some((s) => s.session_id === selectedSession)) {
        setSelectedSession(sessions[sessions.length - 1].session_id);
      }
    } else {
      setSelectedSession(null);
    }
  }, [sessions]);

  /* ---------------------------------------------------
     DERIVED DATA: Active session records & totals
  --------------------------------------------------- */
  const activeSession = useMemo(() => {
    return rawSessions.find((s) => s.session_id === selectedSession) || null;
  }, [rawSessions, selectedSession]);

  const rows = useMemo(() => {
    if (!activeSession) return [];
    const recs = Array.isArray(activeSession.records) ? activeSession.records : [];
    return [...recs].sort((a, b) => {
      const sectionA = (a.section || "").toUpperCase();
      const sectionB = (b.section || "").toUpperCase();
      if (sectionA && sectionB && sectionA !== sectionB) {
        return sectionA.localeCompare(sectionB, undefined, { numeric: true });
      }
      if (sectionA && !sectionB) return -1;
      if (!sectionA && sectionB) return 1;
      const rollA = a.roll_number || "";
      const rollB = b.roll_number || "";
      if (rollA && rollB) {
        const rollCompare = rollA.localeCompare(rollB, undefined, { numeric: true });
        if (rollCompare !== 0) return rollCompare;
      }
      return (a.student_name || "").localeCompare(b.student_name || "");
    });
  }, [activeSession]);

  const totals = useMemo(() => {
    if (activeSession?.totals) {
      const t = activeSession.totals;
      return { present: t.present + (t.late || 0), late: 0, absent: t.absent };
    }
    if (!activeSession) return { present: 0, late: 0, absent: 0 };
    const recs = Array.isArray(activeSession.records) ? activeSession.records : [];
    const present = recs.filter((x) => x.status === "PRESENT" || x.status === "LATE").length;
    const absent = recs.filter((x) => x.status === "ABSENT").length;
    return { present, late: 0, absent };
  }, [activeSession]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return rows;
    return rows.filter((r) => {
      return (
        (r.student_name && r.student_name.toLowerCase().includes(query)) ||
        (r.roll_number && r.roll_number.toLowerCase().includes(query)) ||
        (r.section && r.section.toLowerCase().includes(query))
      );
    });
  }, [rows, searchQuery]);

  /* ---------------------------------------------------
     REACT QUERY MUTATIONS
  --------------------------------------------------- */
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId) => facultyAPI.deleteSession(sessionId),
    onSuccess: (_, deletedId) => {
      toast({
        title: "Session Deleted 🗑️",
        description: "The session and its attendance records have been deleted.",
      });
      setDeleteSessionStep(0);
      setDeleteSessionInput("");

      // Update React Query Cache immediately
      queryClient.setQueryData(["class-sessions", classItem.class_id], (old) => {
        if (!old?.sessions) return old;
        return {
          ...old,
          sessions: old.sessions.filter((s) => s.session_id !== deletedId),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["class-sessions", classItem.class_id] });
    },
    onError: (err) => {
      toast({
        title: "Error Deleting Session",
        description: err.response?.data?.detail || err.message || "Failed to delete session.",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ sessionId, studentId, newStatus }) =>
      attendanceApi.markManualAttendance(sessionId, studentId, newStatus),
    onMutate: async ({ sessionId, studentId, newStatus }) => {
      setRowUpdating((prev) => ({ ...prev, [studentId]: true }));
      await queryClient.cancelQueries({ queryKey: ["class-sessions", classItem.class_id] });
      const previousData = queryClient.getQueryData(["class-sessions", classItem.class_id]);

      queryClient.setQueryData(["class-sessions", classItem.class_id], (old) => {
        if (!old?.sessions) return old;
        return {
          ...old,
          sessions: old.sessions.map((s) => {
            if (s.session_id !== sessionId) return s;
            const recs = (s.records || []).map((r) => {
              if (r.student_id !== studentId) return r;
              return {
                ...r,
                status: newStatus,
                marked_at: new Date().toISOString().replace("Z", ""),
              };
            });
            const present = recs.filter((x) => x.status === "PRESENT" || x.status === "LATE").length;
            const absent = recs.filter((x) => x.status === "ABSENT").length;
            return { ...s, records: recs, totals: { present, late: 0, absent } };
          }),
        };
      });
      return { previousData };
    },
    onError: (err, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["class-sessions", classItem.class_id], context.previousData);
      }
      toast({
        title: "Error",
        description: err.message || "Failed to update attendance status.",
        variant: "destructive",
      });
    },
    onSettled: (_, __, { studentId }) => {
      setRowUpdating((prev) => ({ ...prev, [studentId]: false }));
      queryClient.invalidateQueries({ queryKey: ["class-sessions", classItem.class_id] });
    },
  });

  const handleOpenDeleteSession = () => {
    setDeleteSessionInput("");
    setDeleteSessionStep(1);
  };

  const handleConfirmDeleteStep1 = () => {
    setDeleteSessionInput("");
    setDeleteSessionStep(2);
  };

  const handleConfirmDeleteStep2 = () => {
    if (!selectedSession) return;
    if (deleteSessionInput.trim().toLowerCase() !== "delete") {
      toast({
        title: "Validation Error",
        description: 'Please type "delete" to confirm.',
        variant: "destructive",
      });
      return;
    }
    deleteSessionMutation.mutate(selectedSession);
  };

  const handleUpdateStatus = (studentId, studentName, newStatus) => {
    if (!selectedSession || !studentId) return;
    updateStatusMutation.mutate({ sessionId: selectedSession, studentId, newStatus });
  };

  /* ---------------------------------------------------
     EXPORT FUNCTIONS
  --------------------------------------------------- */
  const formatRowsForExport = (exportRowsList, sessionDate, sessionTime) => {
    const sections = {};
    exportRowsList.forEach((r) => {
      const sec = r.section || "Unassigned";
      if (!sections[sec]) sections[sec] = [];
      sections[sec].push(r);
    });

    const exportRows = [];
    exportRows.push({ "Student Name": `Class: ${classItem.class_name}` });
    exportRows.push({ "Student Name": `Date: ${sessionDate}` });
    exportRows.push({ "Student Name": `Time: ${sessionTime}` });
    exportRows.push({});

    const colHeaders = {
      "Roll Number": "Roll Number",
      "Student Name": "Student Name",
      Section: "Section",
      Status: "Status",
      "Marked At": "Marked At",
    };

    Object.keys(sections)
      .sort()
      .forEach((sec) => {
        const students = sections[sec];
        const presentList = students
          .filter((s) => s.status === "PRESENT" || s.status === "LATE")
          .sort((a, b) => (a.student_name || "").localeCompare(b.student_name || ""));
        const absentList = students
          .filter((s) => s.status === "ABSENT" || !s.status)
          .sort((a, b) => (a.student_name || "").localeCompare(b.student_name || ""));

        exportRows.push({ "Student Name": `SECTION: ${sec}` });

        if (presentList.length > 0) {
          exportRows.push({ "Student Name": `--- PRESENT (${presentList.length}) ---` });
          exportRows.push(colHeaders);
          presentList.forEach((r) => {
            exportRows.push({
              "Roll Number": r.roll_number || "—",
              Section: r.section || "—",
              "Student Name": r.student_name,
              Status: "PRESENT",
              "Marked At": r.marked_at
                ? new Date(r.marked_at + "Z").toLocaleString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "—",
            });
          });
          exportRows.push({});
        }

        if (absentList.length > 0) {
          exportRows.push({ "Student Name": `--- ABSENT (${absentList.length}) ---` });
          exportRows.push(colHeaders);
          absentList.forEach((r) => {
            exportRows.push({
              "Roll Number": r.roll_number || "—",
              Section: r.section || "—",
              "Student Name": r.student_name,
              Status: "ABSENT",
              "Marked At": "—",
            });
          });
          exportRows.push({});
        }

        exportRows.push({ "Student Name": `Total Present: ${presentList.length}` });
        exportRows.push({ "Student Name": `Total Absent: ${absentList.length}` });
        exportRows.push({ "Student Name": `Total Strength: ${presentList.length + absentList.length}` });
        exportRows.push({});
        exportRows.push({});
      });

    return exportRows;
  };

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

    const exportData = formatRowsForExport(rows, selectedDate, sessionTime);
    const ws = XLSX.utils.json_to_sheet(exportData, { skipHeader: true });
    ws["!cols"] = [{ wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 20 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    const timeStr = sessionTime.replace(/:/g, "-");
    const filename = `${classItem.class_name}_${selectedDate}_${timeStr}.xlsx`;
    XLSX.writeFile(wb, filename);

    toast({
      title: "Success",
      description: "Current session exported successfully.",
    });
  };

  const exportCurrentDate = () => {
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

      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        const recs = Array.isArray(session.records) ? session.records : [];
        const sTime = new Date(session.start_time).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        const exportData = formatRowsForExport(recs, selectedDate, sTime);
        const ws = XLSX.utils.json_to_sheet(exportData, { skipHeader: true });
        ws["!cols"] = [{ wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 20 }];

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

  // Shared helper: builds a single datewise pivot sheet from a list of sessions
  // Each session gets its own column. If multiple sessions on the same date,
  // columns show "date HH:mm" to distinguish them.
  const buildDatewisePivotSheet = (sessionsList) => {
    // Sort sessions chronologically
    const sorted = [...sessionsList].sort(
      (a, b) => new Date(a.start_time) - new Date(b.start_time)
    );

    // Build session column keys: { key, sessionId }
    // Count sessions per date to decide labeling
    const dateCounts = {};
    sorted.forEach((s) => {
      if (!s.start_time) return;
      const d = new Date(s.start_time).toLocaleDateString("en-CA");
      dateCounts[d] = (dateCounts[d] || 0) + 1;
    });

    const sessionColumns = []; // { key: column header string, sessionId }
    const dateSessionIndex = {}; // track per-date session numbering
    sorted.forEach((s) => {
      if (!s.start_time) return;
      const dt = new Date(s.start_time);
      const dateStr = dt.toLocaleDateString("en-CA");
      const timeStr = dt.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      let colKey;
      if (dateCounts[dateStr] > 1) {
        // Multiple sessions on this date — show date + time
        if (!dateSessionIndex[dateStr]) dateSessionIndex[dateStr] = 0;
        dateSessionIndex[dateStr]++;
        colKey = `${dateStr} ${timeStr}`;
      } else {
        colKey = dateStr;
      }

      sessionColumns.push({ key: colKey, sessionId: s.session_id });
    });

    // Build student map: studentId -> { info, sessionStatus: { sessionId -> P/A } }
    const studentMap = new Map();

    sorted.forEach((session) => {
      const recs = Array.isArray(session.records) ? session.records : [];
      recs.forEach((r) => {
        const sid = r.student_id;
        if (!studentMap.has(sid)) {
          studentMap.set(sid, {
            roll_number: r.roll_number || "—",
            student_name: r.student_name || "",
            email: r.email || "—",
            section: r.section || "—",
            sessionStatus: {},
          });
        }
        const student = studentMap.get(sid);
        const isPresent = r.status === "PRESENT" || r.status === "LATE";
        student.sessionStatus[session.session_id] = isPresent ? "P" : "A";
      });
    });

    // Build rows sorted by roll number
    const students = Array.from(studentMap.values()).sort((a, b) =>
      (a.roll_number || "").localeCompare(b.roll_number || "", undefined, { numeric: true })
    );

    const sheetData = students.map((s) => {
      const row = {
        "Roll Number": s.roll_number,
        "Student Name": s.student_name,
        "Email": s.email,
        "Section": s.section,
      };
      let totalPresent = 0;
      sessionColumns.forEach((col) => {
        const status = s.sessionStatus[col.sessionId] || "A";
        row[col.key] = status;
        if (status === "P") totalPresent++;
      });
      row["Total Present"] = totalPresent;
      row["Total Sessions"] = sessionColumns.length;
      row["Attendance %"] = sessionColumns.length > 0
        ? ((totalPresent / sessionColumns.length) * 100).toFixed(1) + "%"
        : "0.0%";
      return row;
    });

    if (sheetData.length === 0) return null;

    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = [
      { wch: 14 }, // Roll Number
      { wch: 22 }, // Student Name
      { wch: 28 }, // Email
      { wch: 10 }, // Section
      ...sessionColumns.map(() => ({ wch: 16 })),
      { wch: 14 }, // Total Present
      { wch: 14 }, // Total Sessions
      { wch: 14 }, // Attendance %
    ];
    return ws;
  };

  const exportDateRange = () => {
    try {
      setExportLoading(true);
      setExportProgress("Processing date range...");

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

      const filteredSessions = rawSessions.filter((session) => {
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

      const ws = buildDatewisePivotSheet(filteredSessions);
      if (!ws) {
        toast({ title: "No Data", description: "No student data found.", variant: "destructive" });
        setExportLoading(false);
        setExportProgress("");
        return;
      }

      const wb = XLSX.utils.book_new();
      const sheetName = classItem.class_name.replace(/[\\/*?:\[\]]/g, "").substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const filename = `${classItem.class_name}_${startDate.toLocaleDateString(
        "en-CA"
      )}_to_${endDate.toLocaleDateString("en-CA")}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast({
        title: "Success",
        description: `Exported datewise attendance for ${classItem.class_name}.`,
      });
      setShowDateRangeDialog(false);
    } catch (error) {
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

  const exportAllDates = () => {
    try {
      setExportLoading(true);
      setExportProgress("Preparing full history export...");

      if (rawSessions.length === 0) {
        toast({
          title: "No Data",
          description: "No sessions found for this class.",
          variant: "destructive",
        });
        setExportLoading(false);
        setExportProgress("");
        return;
      }

      const ws = buildDatewisePivotSheet(rawSessions);
      if (!ws) {
        toast({ title: "No Data", description: "No student data found.", variant: "destructive" });
        setExportLoading(false);
        setExportProgress("");
        return;
      }

      const wb = XLSX.utils.book_new();
      const sheetName = classItem.class_name.replace(/[\\/*?:\[\]]/g, "").substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const filename = `${classItem.class_name}_AllSessions_Datewise.xlsx`;
      XLSX.writeFile(wb, filename);

      toast({
        title: "Success",
        description: `Exported datewise attendance for ${classItem.class_name}.`,
      });
    } catch (error) {
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-muted-foreground">
        <Loader className="h-7 w-7 animate-spin text-primary" />
        <span className="text-sm font-medium">Loading class attendance data...</span>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-3 pb-4">
      <h2 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4">
        {classItem.class_name} Attendance
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Session Dates List */}
        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col border shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CalendarIcon className="h-4.5 w-4.5 text-primary" />
                  Session Dates
                </CardTitle>
                <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                  {sessionDates.length} {sessionDates.length === 1 ? "Date" : "Dates"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-3 flex-1 overflow-y-auto max-h-[520px]">
              {sessionDates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-muted-foreground rounded-lg border border-dashed bg-muted/10 my-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                    <CalendarX className="h-6 w-6 text-muted-foreground/70" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No Sessions Recorded</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                    There are no recorded attendance sessions for this class yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessionDates.map((item) => {
                    const dateStr = item.date;
                    const count = item.session_count;
                    const isSelected = selectedDate === dateStr;

                    const dateObj = new Date(dateStr + "T00:00:00");
                    const formattedDate = dateObj.toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => setSelectedDate(dateStr)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer group ${
                          isSelected
                            ? "bg-primary/10 border-primary text-primary font-medium shadow-sm ring-1 ring-primary/30"
                            : "bg-card hover:bg-muted/50 border-border hover:border-muted-foreground/30 text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg transition-colors ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                            }`}
                          >
                            <CalendarIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold leading-none mb-1">
                              {formattedDate}
                            </div>
                            <div className="text-xs opacity-70 font-mono">
                              {dateStr}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={isSelected ? "default" : "outline"}
                          className="text-[10px] px-2 py-0.5"
                        >
                          {count} {count === 1 ? "session" : "sessions"}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-col items-start justify-between gap-3 pb-4">
              <CardTitle className="text-base sm:text-lg">
                Attendance for {selectedDate || "N/A"}
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
                      Current Date ({selectedDate || "N/A"})
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
              {/* Session Dropdown & Actions */}
              {sessions.length > 0 && (
                <div className="mb-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                    <div className="flex-1">
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
                            Session #{s.session_id} — {new Date(s.start_time).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })} {s.status === 'ACTIVE' ? '(ACTIVE)' : '(CLOSED)'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedSession && (
                      <div className="flex items-center gap-2 pt-1 sm:pt-0">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleOpenDeleteSession}
                          className="h-10 text-xs sm:text-sm gap-1.5"
                          disabled={deleteSessionMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Session
                        </Button>
                      </div>
                    )}
                  </div>
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

              {/* Table - Mobile Responsive */}
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
                                ? new Date(r.marked_at + "Z").toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
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
              Select a date range to export all attendance sessions within that period.
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

      {/* Delete Session Confirmation - Step 1 */}
      <Dialog
        open={deleteSessionStep === 1}
        onOpenChange={(open) => {
          if (!open) setDeleteSessionStep(0);
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <DialogTitle className="text-lg sm:text-xl">
                Delete Session #{selectedSession}?
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              Are you sure you want to delete Session #{selectedSession}? All student attendance records recorded for this session will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteSessionStep(0)}
              className="h-10 sm:h-11"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteStep1}
              className="h-10 sm:h-11"
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Session Confirmation - Step 2 */}
      <Dialog
        open={deleteSessionStep === 2}
        onOpenChange={(open) => {
          if (!open) setDeleteSessionStep(0);
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-1">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <DialogTitle className="text-lg sm:text-xl">
                Final Confirmation
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              This action cannot be undone. Are you 100% sure you want to delete Session #{selectedSession}?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3">
            <Label className="text-xs font-medium text-muted-foreground">
              To confirm deletion, please type <span className="font-bold text-destructive">delete</span> below:
            </Label>
            <Input
              value={deleteSessionInput}
              onChange={(e) => setDeleteSessionInput(e.target.value)}
              placeholder='Type "delete" to confirm'
              className="h-11 border-destructive/40 focus-visible:ring-destructive"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteSessionStep(0)}
              className="h-10 sm:h-11"
              disabled={deleteSessionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteStep2}
              className="h-10 sm:h-11"
              disabled={
                deleteSessionMutation.isPending ||
                deleteSessionInput.trim().toLowerCase() !== "delete"
              }
            >
              {deleteSessionMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader className="h-4 w-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                "Yes, Delete Session"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClassDetails;