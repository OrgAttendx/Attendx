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
import { useToast } from "@/hooks/use-toast";
import { facultyAPI } from "@/services/api";

export const CreateClassModal = ({ open, onOpenChange, onCreated }) => {
  const { toast } = useToast();
  const [newClass, setNewClass] = useState({ name: "", joinCode: "" });
  const [creatingClass, setCreatingClass] = useState(false);

  const handleCreateClass = async () => {
    if (creatingClass) return;

    if (!newClass.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a class name.",
        variant: "destructive",
      });
      return;
    }
    try {
      setCreatingClass(true);
      const createdClass = await facultyAPI.createClass(newClass.name);
      toast({
        title: "Class Created",
        description: `${newClass.name} created successfully.`,
      });
      setNewClass({ name: "", joinCode: "" });
      onOpenChange(false);
      if (onCreated) {
        onCreated(createdClass);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to create class.",
        variant: "destructive",
      });
    } finally {
      setCreatingClass(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            Create New Class
          </DialogTitle>
          <DialogDescription className="text-sm">
            Add a new class to your dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="className" className="text-sm font-medium">
              Class Name
            </Label>
            <Input
              id="className"
              placeholder="e.g., Computer Science 101"
              value={newClass.name}
              onChange={(e) =>
                setNewClass({ ...newClass, name: e.target.value })
              }
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="joinCode" className="text-sm font-medium">
              Join Code (Optional)
            </Label>
            <Input
              id="joinCode"
              placeholder="Leave empty to auto-generate"
              value={newClass.joinCode}
              onChange={(e) =>
                setNewClass({ ...newClass, joinCode: e.target.value })
              }
              className="h-11"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 sm:h-11"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleCreateClass}
            disabled={creatingClass}
            className="h-10 sm:h-11"
          >
            {creatingClass ? "Creating..." : "Create Class"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateClassModal;
