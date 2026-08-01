import React, { useState, useEffect, useCallback } from "react";
import { facultyAPI, api } from "@/services/api";
import {
  Plus,
  Users,
  Calendar,
  Play,
  Filter,
  Search,
  CheckCircle,
  BookOpen,
  Sparkles,
  TrendingUp,
  KeyRound,
  Download,
  Loader,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/enhanced-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAttendance } from "@/contexts/AttendanceContext";
import ClassDetails from "@/components/ClassDetails";
import BulkStudentUploadModal from "@/components/BulkStudentUploadModal";
import ClassStudentsModal from "@/components/ClassStudentsModal";

// Extracted faculty sub-components & utilities
import ClassCard from "@/components/faculty/ClassCard";
import CreateClassModal from "@/components/faculty/CreateClassModal";
import StartSessionLocationModal from "@/components/faculty/StartSessionLocationModal";
import EndSessionConfirmModal from "@/components/faculty/EndSessionConfirmModal";
import DeleteClassModal from "@/components/faculty/DeleteClassModal";
import AttendanceFilterExportModal from "@/components/faculty/AttendanceFilterExportModal";
import ResetPasswordModal from "@/components/faculty/ResetPasswordModal";
import { exportAllClassesExcel } from "@/utils/exportAllClassesExcel";

const FacultyDashboard = () => {
  const { toast } = useToast();
  const {
    sessions,
    updateCounter,
    startSession,
    endSession,
  } = useAttendance();
  const navigate = useNavigate();

  // Primary Data States
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [endedClassIds, setEndedClassIds] = useState([]);
  const [activeSessions, setActiveSessions] = useState({});
  const [startingSession, setStartingSession] = useState(false);
  const [deletingClass, setDeletingClass] = useState(false);
  const [exportAllLoading, setExportAllLoading] = useState(false);

  // Dialog / Modal Visibility States
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [endSessionDialogOpen, setEndSessionDialogOpen] = useState(false);
  const [classToEnd, setClassToEnd] = useState(null);
  const [deleteClassDialogOpen, setDeleteClassDialogOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState(null);

  // Attendance filter/export dialog states
  const [filterExportOpen, setFilterExportOpen] = useState(false);
  const [filterClass, setFilterClass] = useState(null);

  // Bulk Upload states
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadClass, setBulkUploadClass] = useState(null);

  // Student Details Modal states
  const [studentsModalOpen, setStudentsModalOpen] = useState(false);
  const [selectedStudentsClass, setSelectedStudentsClass] = useState(null);

  // Reset Password states
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);

  // Location-based attendance states
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [classToStart, setClassToStart] = useState(null);

  // Load classes and active sessions from backend
  const loadClasses = useCallback(async () => {
    try {
      const apiClasses = await facultyAPI.getClasses();
      const loadedClasses = (apiClasses || []).map((c) => ({
        ...c,
        students_count: c.students_count ?? 0,
        sessions_count: c.sessions_count ?? 0,
        last_session: c.last_session
          ? new Date(c.last_session).toLocaleString()
          : null,
      }));
      setClasses(loadedClasses);

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.user_id) {
        const { data: activeSessionsData } = await api.get(
          "/faculty/sessions/active",
          { params: { faculty_id: user.user_id } },
        );
        const sessionMap = {};
        activeSessionsData.forEach((session) => {
          sessionMap[session.class_id] = {
            status: "active",
            sessionId: session.session_id,
            generatedCode: session.generated_code,
            startTime: session.start_time,
          };
        });
        setActiveSessions(sessionMap);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to load classes",
        variant: "destructive",
      });
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // Merge context sessions with loaded active sessions
  const mergedSessions = { ...activeSessions, ...sessions };

  // ---- Session Management Handlers ----
  const handleStartSession = (classItem) => {
    if (startingSession) return;
    setClassToStart(classItem);
    setLocationDialogOpen(true);
  };

  const proceedWithSessionStart = async ({
    useLocation,
    sessionLocation,
    currentDiameter,
    calculatedRadius,
  }) => {
    if (!classToStart) return;

    try {
      setStartingSession(true);
      let locationData = null;

      if (useLocation && sessionLocation) {
        locationData = {
          latitude: sessionLocation.latitude,
          longitude: sessionLocation.longitude,
          radius_meters: calculatedRadius,
        };
      }

      const session = await facultyAPI.startSession(
        classToStart.class_id,
        locationData
      );
      const sessionId = session?.session_id;
      if (!sessionId) throw new Error("Invalid session response");

      startSession(classToStart.class_id);
      setLocationDialogOpen(false);
      setClassToStart(null);

      navigate(`/attendance/${classToStart.class_id}?sessionId=${sessionId}`);

      toast({
        title: "Session Started",
        description: useLocation
          ? `${classToStart.class_name} session started with location verification (${currentDiameter}m diameter / ${calculatedRadius}m radius).`
          : `${classToStart.class_name} session is active.`,
      });
    } catch (error) {
      console.error("[FacultyDashboard] Error starting session:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start session",
        variant: "destructive",
      });
    } finally {
      setStartingSession(false);
    }
  };

  const handleEndSession = (classItem) => {
    setClassToEnd(classItem);
    setEndSessionDialogOpen(true);
  };

  const confirmEndSession = async () => {
    if (!classToEnd) return;
    try {
      const activeSession = mergedSessions[classToEnd.class_id];
      if (!activeSession?.sessionId) throw new Error("No active session found");
      await facultyAPI.endSession(classToEnd.class_id, activeSession.sessionId);
      endSession(classToEnd.class_id);
      setEndedClassIds((prev) => [...prev, classToEnd.class_id]);
      toast({
        title: "Session Ended",
        description: `${classToEnd.class_name} session has ended.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to end session",
        variant: "destructive",
      });
    } finally {
      setEndSessionDialogOpen(false);
      setClassToEnd(null);
    }
  };

  const handleGoToAttendance = async (classItem) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const { data } = await api.get(
        `/class/${classItem.class_id}/active-session`,
        { baseURL: API_URL }
      );

      if (data.session_id) {
        navigate(
          `/attendance/${classItem.class_id}?sessionId=${data.session_id}`
        );
      } else {
        throw new Error("No active session found for this class");
      }
    } catch (error) {
      console.error("Navigation error:", error);
      toast({
        title: "Error",
        description:
          error.message ||
          "Failed to navigate to attendance. Please try starting a new session.",
        variant: "destructive",
      });
    }
  };

  // ---- Class Delete Handler ----
  const handleDeleteClass = (classItem) => {
    setClassToDelete(classItem);
    setDeleteClassDialogOpen(true);
  };

  const confirmDeleteClass = async () => {
    if (!classToDelete) return;
    try {
      setDeletingClass(true);
      await facultyAPI.deleteClass(classToDelete.class_id);
      setClasses((prev) =>
        prev.filter((cls) => cls.class_id !== classToDelete.class_id)
      );
      toast({
        title: "Class Deleted",
        description: `${classToDelete.class_name} has been deleted.`,
        variant: "destructive",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete class",
        variant: "destructive",
      });
    } finally {
      setDeletingClass(false);
      setDeleteClassDialogOpen(false);
      setClassToDelete(null);
    }
  };

  // ---- Details & Modal Open Handlers ----
  const handleViewDetails = (classItem) => {
    setSelectedClass(classItem);
    setDetailsOpen(true);
  };

  const handleFilterExport = (classItem) => {
    setFilterClass(classItem);
    setFilterExportOpen(true);
  };

  const handleOpenBulkUpload = (classItem) => {
    setBulkUploadClass(classItem);
    setBulkUploadOpen(true);
  };

  const handleViewStudents = (classItem) => {
    setSelectedStudentsClass(classItem);
    setStudentsModalOpen(true);
  };

  // ---- Class Lists Filter Logic ----
  const filteredClasses = classes.filter((cls) =>
    cls.class_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeClasses = filteredClasses.filter(
    (cls) =>
      mergedSessions[cls.class_id]?.status === "active" &&
      !endedClassIds.includes(cls.class_id)
  );

  const endedClasses = filteredClasses.filter(
    (cls) =>
      mergedSessions[cls.class_id]?.status === "ended" ||
      endedClassIds.includes(cls.class_id)
  );

  const scheduledClasses = filteredClasses.filter(
    (cls) =>
      (!mergedSessions[cls.class_id] ||
        (mergedSessions[cls.class_id]?.status !== "active" &&
          mergedSessions[cls.class_id]?.status !== "ended")) &&
      !endedClassIds.includes(cls.class_id)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            Loading your classes...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" key={updateCounter}>
      <Header />

      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 sm:mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-primary/10">
                <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
                Faculty Dashboard
              </h1>
            </div>
            <p className="text-xs sm:text-sm lg:text-base text-muted-foreground ml-11 sm:ml-12">
              Manage your classes and attendance sessions
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="flex items-center gap-2 w-full sm:w-auto h-10 sm:h-11 text-sm sm:text-base rounded-xl border-orange-500/40 text-orange-600 hover:bg-orange-500/10 hover:text-orange-600 hover:border-orange-500/60 transition-all"
              onClick={() => setResetPasswordOpen(true)}
            >
              <KeyRound className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Reset Password</span>
            </Button>

            <Button
              variant="hero"
              onClick={() => setIsCreateDialogOpen(true)}
              className="flex items-center gap-2 w-full sm:w-auto h-10 sm:h-11 text-sm sm:text-base rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Create Class</span>
            </Button>
          </div>
        </div>

        {/* Search & Global Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search classes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 sm:h-11 bg-card/50 border-border/50 focus:border-primary"
            />
          </div>
          <Button
            variant="outline"
            className="flex items-center justify-center gap-2 h-10 sm:h-11 w-full sm:w-auto"
          >
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => exportAllClassesExcel(classes, toast, setExportAllLoading)}
            disabled={exportAllLoading || classes.length === 0}
            className="flex items-center justify-center gap-2 h-10 sm:h-11 w-full sm:w-auto border-dashed hover:border-primary/50 hover:text-primary"
          >
            <Download className="h-4 w-4" />
            <span>{exportAllLoading ? "Exporting…" : "Export All Classes"}</span>
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-2.5 rounded-xl bg-blue-500/10">
                  <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold">
                    {classes.length}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Total Classes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-2.5 rounded-xl bg-green-500/10">
                  <Play className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold">
                    {activeClasses.length}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Active Now
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-2.5 rounded-xl bg-purple-500/10">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold">
                    {classes.reduce(
                      (sum, c) => sum + (c.students_count || 0),
                      0
                    )}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Total Students
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-2.5 rounded-xl bg-orange-500/10">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold">
                    {classes.reduce(
                      (sum, c) => sum + (c.sessions_count || 0),
                      0
                    )}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Total Sessions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Sessions Section */}
        {activeClasses.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <h2 className="text-lg sm:text-xl font-semibold">
                Active Sessions
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {activeClasses.map((classItem) => (
                <ClassCard
                  key={classItem.class_id}
                  classItem={classItem}
                  status="active"
                  onViewDetails={handleViewDetails}
                  onDelete={handleDeleteClass}
                  onEndSession={handleEndSession}
                  onStartSession={handleStartSession}
                  onGoToAttendance={handleGoToAttendance}
                  onFilterExport={handleFilterExport}
                  onBulkUpload={handleOpenBulkUpload}
                  onViewStudents={handleViewStudents}
                  startingSession={startingSession}
                />
              ))}
            </div>
          </div>
        )}

        {/* Ended Sessions Section */}
        {endedClasses.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              <h2 className="text-lg sm:text-xl font-semibold">
                Ended Sessions
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {endedClasses.map((classItem) => (
                <ClassCard
                  key={classItem.class_id}
                  classItem={classItem}
                  status="ended"
                  onViewDetails={handleViewDetails}
                  onDelete={handleDeleteClass}
                  onEndSession={handleEndSession}
                  onStartSession={handleStartSession}
                  onGoToAttendance={handleGoToAttendance}
                  onFilterExport={handleFilterExport}
                  onBulkUpload={handleOpenBulkUpload}
                  onViewStudents={handleViewStudents}
                  startingSession={startingSession}
                />
              ))}
            </div>
          </div>
        )}

        {/* Your Classes Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <h2 className="text-lg sm:text-xl font-semibold">Your Classes</h2>
          </div>
          {scheduledClasses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {scheduledClasses.map((classItem) => (
                <ClassCard
                  key={classItem.class_id}
                  classItem={classItem}
                  status={null}
                  onViewDetails={handleViewDetails}
                  onDelete={handleDeleteClass}
                  onEndSession={handleEndSession}
                  onStartSession={handleStartSession}
                  onGoToAttendance={handleGoToAttendance}
                  onFilterExport={handleFilterExport}
                  onBulkUpload={handleOpenBulkUpload}
                  onViewStudents={handleViewStudents}
                  startingSession={startingSession}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-card/30">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground font-medium">
                {searchTerm
                  ? "No classes match your search."
                  : "No classes created yet."}
              </p>
              {!searchTerm && (
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="mt-4 border-primary/50 text-primary hover:bg-primary/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Class
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Class Details Modal */}
      {selectedClass && (
        <ClassDetails
          isOpen={detailsOpen}
          onClose={() => {
            setDetailsOpen(false);
            setSelectedClass(null);
          }}
          classItem={selectedClass}
        />
      )}

      {/* Create Class Modal */}
      <CreateClassModal
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={(createdClass) => {
          setClasses((prev) => [
            ...prev,
            {
              ...createdClass,
              students_count: 0,
              sessions_count: 0,
              last_session: null,
            },
          ]);
        }}
      />

      {/* Start Session / Location Capture Modal */}
      <StartSessionLocationModal
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        classToStart={classToStart}
        onProceed={proceedWithSessionStart}
        startingSession={startingSession}
      />

      {/* End Session Confirmation Modal */}
      <EndSessionConfirmModal
        open={endSessionDialogOpen}
        onOpenChange={setEndSessionDialogOpen}
        classToEnd={classToEnd}
        onConfirm={confirmEndSession}
      />

      {/* Delete Class Confirmation Modal */}
      <DeleteClassModal
        open={deleteClassDialogOpen}
        onOpenChange={setDeleteClassDialogOpen}
        classToDelete={classToDelete}
        onConfirmDelete={confirmDeleteClass}
        deletingClass={deletingClass}
      />

      {/* Attendance Filter & Export Modal */}
      <AttendanceFilterExportModal
        open={filterExportOpen}
        onOpenChange={setFilterExportOpen}
        classItem={filterClass}
      />

      {/* Admin Reset Password Modal */}
      <ResetPasswordModal
        open={resetPasswordOpen}
        onOpenChange={setResetPasswordOpen}
      />

      {/* Bulk Student Upload Modal */}
      {bulkUploadClass && (
        <BulkStudentUploadModal
          isOpen={bulkUploadOpen}
          onClose={() => {
            setBulkUploadOpen(false);
            setBulkUploadClass(null);
          }}
          classId={bulkUploadClass.class_id}
          className={bulkUploadClass.class_name}
          onSuccess={() => {
            loadClasses();
          }}
        />
      )}

      {/* Student Details Modal */}
      {selectedStudentsClass && (
        <ClassStudentsModal
          open={studentsModalOpen}
          onOpenChange={(open) => {
            setStudentsModalOpen(open);
            if (!open) setSelectedStudentsClass(null);
          }}
          classItem={selectedStudentsClass}
          onBulkUpload={handleOpenBulkUpload}
        />
      )}

      <p className="text-center text-xs text-muted-foreground py-6">
        &copy; 2026 Achyut Shekhar Singh. All Rights Reserved.
      </p>
    </div>
  );
};

export default FacultyDashboard;