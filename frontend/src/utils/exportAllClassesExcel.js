import * as XLSX from "xlsx";
import { facultyAPI } from "@/services/api";

/**
 * Export all faculty classes datewise attendance data into an Excel spreadsheet (.xlsx)
 * @param {Array} classes - List of class objects
 * @param {Function} toast - Toast notification function
 * @param {Function} setExportLoading - Callback to update loading state boolean
 */
export const exportAllClassesExcel = async (classes, toast, setExportLoading) => {
  if (!classes || classes.length === 0) {
    toast({ title: "No Classes", description: "No classes to export.", variant: "destructive" });
    return;
  }
  if (setExportLoading) setExportLoading(true);
  toast({ title: "Exporting…", description: "Fetching attendance data for all classes. This may take a moment." });

  try {
    const wb = XLSX.utils.book_new();
    const usedSheetNames = new Set();

    for (const cls of classes) {
      let sessionsData;
      try {
        sessionsData = await facultyAPI.getAllSessionsWithAttendance(cls.class_id);
      } catch {
        continue; // skip classes that fail
      }
      const sessions = Array.isArray(sessionsData?.sessions) ? sessionsData.sessions : [];
      if (sessions.length === 0) continue;

      // Sort sessions chronologically
      const sorted = [...sessions].sort(
        (a, b) => new Date(a.start_time) - new Date(b.start_time)
      );

      // Count sessions per date to decide column labeling
      const dateCounts = {};
      sorted.forEach((s) => {
        if (!s.start_time) return;
        const d = new Date(s.start_time).toLocaleDateString("en-CA");
        dateCounts[d] = (dateCounts[d] || 0) + 1;
      });

      // Build session columns: { key, sessionId }
      const sessionColumns = [];
      const dateSessionIndex = {};
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

      // Build rows sorted by section first (e.g. A, B, C...), then by roll number
      const students = Array.from(studentMap.values()).sort((a, b) => {
        const secA = (a.section || "—").toUpperCase();
        const secB = (b.section || "—").toUpperCase();
        if (secA !== secB) {
          return secA.localeCompare(secB, undefined, { numeric: true });
        }
        return (a.roll_number || "").localeCompare(b.roll_number || "", undefined, { numeric: true });
      });

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

      if (sheetData.length === 0) continue;

      const ws = XLSX.utils.json_to_sheet(sheetData);
      // Auto-size columns
      const colWidths = [
        { wch: 14 }, // Roll Number
        { wch: 22 }, // Student Name
        { wch: 28 }, // Email
        { wch: 10 }, // Section
        ...sessionColumns.map(() => ({ wch: 16 })),
        { wch: 14 }, // Total Present
        { wch: 14 }, // Total Sessions
        { wch: 14 }, // Attendance %
      ];
      ws["!cols"] = colWidths;

      // Generate unique sheet name (max 31 chars)
      let baseName = cls.class_name.replace(/[\\/*?:\[\]]/g, "").substring(0, 31);
      let sheetName = baseName;
      let counter = 1;
      while (usedSheetNames.has(sheetName)) {
        const suffix = `_${counter}`;
        sheetName = baseName.substring(0, 31 - suffix.length) + suffix;
        counter++;
      }
      usedSheetNames.add(sheetName);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    if (wb.SheetNames.length === 0) {
      toast({ title: "No Data", description: "No attendance data found for any class.", variant: "destructive" });
      return;
    }

    const today = new Date().toLocaleDateString("en-CA");
    XLSX.writeFile(wb, `All_Classes_Attendance_${today}.xlsx`);
    toast({ title: "Success", description: `Exported ${wb.SheetNames.length} class(es) to Excel.` });
  } catch (err) {
    console.error("Export error:", err);
    toast({ title: "Error", description: "Failed to export attendance data.", variant: "destructive" });
  } finally {
    if (setExportLoading) setExportLoading(false);
  }
};
