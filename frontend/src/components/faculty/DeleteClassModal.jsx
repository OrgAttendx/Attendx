import React, { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

export const DeleteClassModal = ({
  open,
  onOpenChange,
  classToDelete,
  onConfirmDelete,
  deletingClass,
}) => {
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setDeleteConfirmationText("");
    }
    onOpenChange(isOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Delete Class?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span>
              Are you sure you want to permanently delete <strong>{classToDelete?.class_name}</strong>?
              This action is <strong className="text-destructive">irreversible</strong> and will permanently delete all related attendance sessions, students' records, and classes' statistics.
            </span>
            <div className="pt-2 space-y-1.5">
              <Label htmlFor="delete-confirm-input" className="text-xs font-semibold text-foreground/80">
                Please type <strong className="text-destructive select-all">delete</strong> to confirm:
              </Label>
              <Input
                id="delete-confirm-input"
                placeholder='Type "delete" here'
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                className="h-10 border-destructive/20 focus-visible:ring-destructive/30"
                autoComplete="off"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletingClass}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmDelete}
            disabled={deletingClass || deleteConfirmationText !== "delete"}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deletingClass ? "Deleting..." : "Delete Permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteClassModal;
