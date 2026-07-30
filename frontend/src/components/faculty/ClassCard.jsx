import React from "react";
import {
  Users,
  Calendar,
  Play,
  CheckCircle,
  Clock,
  Eye,
  SlidersHorizontal,
  Trash2,
  FileSpreadsheet,
  MoreVertical,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/enhanced-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export const ClassCard = ({
  classItem,
  status,
  onViewDetails,
  onDelete,
  onEndSession,
  onStartSession,
  onGoToAttendance,
  onFilterExport,
  onBulkUpload,
  onViewStudents,
  startingSession,
}) => {
  return (
    <Card className="group relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 hover:-translate-y-1">
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <CardHeader className="relative pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base sm:text-lg font-semibold truncate">
              {classItem.class_name}
            </CardTitle>
            <CardDescription className="font-mono text-xs sm:text-sm mt-1">
              Code:{" "}
              <span className="text-primary font-semibold">
                {classItem.join_code}
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {status && (
              <Badge
                variant={
                  status === "active"
                    ? "default"
                    : status === "ended"
                      ? "secondary"
                      : "outline"
                }
                className={
                  status === "active"
                    ? "bg-green-600 hover:bg-green-700 text-white text-xs"
                    : "text-xs"
                }
              >
                {status === "ended" ? (
                  <span className="flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1 text-green-600 dark:text-green-400" />
                    Ended
                  </span>
                ) : status === "active" ? (
                  <span className="flex items-center capitalize">
                    <span className="h-1.5 w-1.5 mr-1.5 bg-white rounded-full animate-pulse"></span>
                    Live
                  </span>
                ) : (
                  status
                )}
              </Badge>
            )}

            {/* Three Dots Options Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Class options"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => onBulkUpload(classItem)}
                  className="cursor-pointer gap-2 font-medium"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Bulk Upload Students</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onFilterExport(classItem)}
                  className="cursor-pointer gap-2 font-medium"
                >
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <span>Attendance Filter & Export</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onDelete(classItem)}
                  className="cursor-pointer gap-2 font-medium text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Class</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4 pt-0">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div
            onClick={() => onViewStudents?.(classItem)}
            className="flex items-center gap-2 p-2.5 sm:p-3 rounded-xl bg-muted/50 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 cursor-pointer transition-all duration-200 border border-transparent hover:border-blue-500/30 group/students"
            title="Click to view student details"
          >
            <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10 group-hover/students:bg-blue-500/20 transition-colors">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold group-hover/students:text-blue-600 dark:group-hover/students:text-blue-400 transition-colors">
                {classItem.students_count || 0}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground group-hover/students:text-blue-600 dark:group-hover/students:text-blue-400 font-medium transition-colors">
                Students
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2.5 sm:p-3 rounded-xl bg-muted/50">
            <div className="p-1.5 sm:p-2 rounded-lg bg-purple-500/10">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold">
                {classItem.sessions_count || 0}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Sessions
              </p>
            </div>
          </div>
        </div>

        {classItem.last_session && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Last: {classItem.last_session}</span>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          {/* Main Action Button */}
          <Button
            variant={status === "active" ? "default" : "outline"}
            size="sm"
            className={`w-full h-9 sm:h-10 text-xs sm:text-sm font-semibold ${
              status === "active" ? "shadow-lg bg-green-600 hover:bg-green-700 text-white" : ""
            }`}
            disabled={startingSession}
            onClick={() => {
              if (status === "active") {
                onGoToAttendance(classItem);
              } else {
                onStartSession(classItem);
              }
            }}
          >
            <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
            {startingSession
              ? "Starting..."
              : status === "active"
                ? "Go to Attendance"
                : status === "ended"
                  ? "Start New Session"
                  : "Start Session"}
          </Button>

          {/* View Details Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 sm:h-10 text-xs sm:text-sm flex items-center justify-center gap-1.5 font-medium hover:border-primary/50"
            onClick={() => onViewDetails(classItem)}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>View Details</span>
          </Button>

          {/* End Active Session Button */}
          {status === "active" && (
            <Button
              variant="destructive"
              size="sm"
              className="w-full h-8 text-xs font-semibold gap-1.5"
              onClick={() => onEndSession(classItem)}
            >
              <X className="h-3.5 w-3.5" />
              <span>End Active Session</span>
            </Button>
          )}
        </div>
        {status === "ended" && (
          <div className="text-center text-green-600 font-semibold text-sm mt-2">
            ✓ Session Complete
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClassCard;
