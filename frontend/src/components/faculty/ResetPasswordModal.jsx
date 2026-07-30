import React, { useState, useEffect } from "react";
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
  KeyRound,
  Search,
  Eye,
  EyeOff,
  CheckCircle,
} from "lucide-react";
import { facultyAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

export const ResetPasswordModal = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    if (open) {
      loadUsers();
    } else {
      setSelectedUser(null);
      setUserSearch("");
      setNewPassword("");
      setConfirmPassword("");
      setAdminKey("");
      setShowNewPwd(false);
      setShowConfirmPwd(false);
    }
  }, [open]);

  const loadUsers = async () => {
    try {
      const users = await facultyAPI.listAllUsers();
      setAllUsers(users || []);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load users.",
        variant: "destructive",
      });
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setAdminKey("");
    setShowNewPwd(false);
    setShowConfirmPwd(false);
  };

  const handleAdminResetPassword = async () => {
    if (!selectedUser) return;
    if (newPassword.length < 6) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }
    if (!adminKey) {
      toast({
        title: "Validation Error",
        description: "Admin reset key is required.",
        variant: "destructive",
      });
      return;
    }
    try {
      setResettingPassword(true);
      await facultyAPI.adminResetPassword(
        selectedUser.user_id,
        newPassword,
        adminKey
      );
      toast({
        title: "Password Reset",
        description: `Password for ${selectedUser.name} has been reset successfully.`,
      });
      setSelectedUser(null);
      setNewPassword("");
      setConfirmPassword("");
      setAdminKey("");
    } catch (err) {
      toast({
        title: "Error",
        description:
          err?.response?.data?.detail || "Failed to reset password.",
        variant: "destructive",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-hidden p-0">
        <div className="flex flex-col h-full max-h-[90vh]">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-orange-500/10">
                <KeyRound className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <DialogTitle className="text-lg">Reset User Password</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Search for a student or faculty and set a new password.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Search */}
            {!selectedUser && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>

                {/* User List */}
                <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                  {allUsers
                    .filter(
                      (u) =>
                        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                        u.email.toLowerCase().includes(userSearch.toLowerCase())
                    )
                    .map((u) => (
                      <button
                        key={u.user_id}
                        onClick={() => handleSelectUser(u)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border/40 bg-card/60 hover:bg-muted/60 hover:border-primary/40 transition-all text-left group"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                            {u.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] font-semibold ${
                            u.role === "FACULTY"
                              ? "border-blue-500/50 text-blue-500 bg-blue-500/10"
                              : "border-green-500/50 text-green-600 bg-green-500/10"
                          }`}
                        >
                          {u.role === "FACULTY" ? "Faculty" : "Student"}
                        </Badge>
                      </button>
                    ))}
                  {allUsers.filter(
                    (u) =>
                      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                      u.email.toLowerCase().includes(userSearch.toLowerCase())
                  ).length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-6">
                      No users found.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Password Form — shown after selecting a user */}
            {selectedUser && (
              <div className="space-y-4">
                {/* Selected user banner */}
                <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-orange-500/30 bg-orange-500/5">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {selectedUser.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedUser.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold ${
                        selectedUser.role === "FACULTY"
                          ? "border-blue-500/50 text-blue-500 bg-blue-500/10"
                          : "border-green-500/50 text-green-600 bg-green-500/10"
                      }`}
                    >
                      {selectedUser.role === "FACULTY" ? "Faculty" : "Student"}
                    </Badge>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="reset-new-pwd" className="text-sm font-medium">
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="reset-new-pwd"
                      type={showNewPwd ? "text" : "password"}
                      placeholder="Min. 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPwd ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="reset-confirm-pwd"
                    className="text-sm font-medium"
                  >
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="reset-confirm-pwd"
                      type={showConfirmPwd ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`h-10 pr-10 ${
                        confirmPassword && confirmPassword !== newPassword
                          ? "border-destructive focus-visible:ring-destructive"
                          : confirmPassword && confirmPassword === newPassword
                          ? "border-green-500 focus-visible:ring-green-500"
                          : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPwd ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-xs text-destructive">
                      Passwords do not match.
                    </p>
                  )}
                  {confirmPassword && confirmPassword === newPassword && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Passwords match
                    </p>
                  )}
                </div>

                {/* Admin Reset Key */}
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <Label
                    htmlFor="admin-key"
                    className="text-sm font-medium text-orange-600"
                  >
                    Admin Reset Key
                  </Label>
                  <Input
                    id="admin-key"
                    type="password"
                    placeholder="Enter secret authorization key. To get password contact developer "
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    className="h-10 border-orange-500/30 focus-visible:ring-orange-500/50"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Required to authorize this password reset.
                  </p>
                </div>

                <Button
                  className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white mt-4"
                  onClick={handleAdminResetPassword}
                  disabled={
                    resettingPassword ||
                    !newPassword ||
                    !confirmPassword ||
                    !adminKey
                  }
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {resettingPassword ? "Resetting…" : "Reset Password"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResetPasswordModal;
