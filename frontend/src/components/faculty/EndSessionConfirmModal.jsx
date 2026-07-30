import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const EndSessionConfirmModal = ({
  open,
  onOpenChange,
  classToEnd,
  onConfirm,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End Attendance Session?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to end the attendance session for{" "}
            <strong>{classToEnd?.class_name}</strong>? This action will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Mark all unmarked students as absent</li>
              <li>Close the session permanently</li>
            </ul>
            You will still be able to view the attendance records, but no
            further attendance can be marked.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            End Session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default EndSessionConfirmModal;
