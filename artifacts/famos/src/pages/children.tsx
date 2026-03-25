/**
 * Children — manage the kids linked to your account.
 *
 * Each child's name is used during email extraction to attribute
 * events, deadlines, and action items to the right person.
 */

import { useState, type FormEvent } from "react";
import { Shell } from "@/components/layout/Shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserRound,
  School,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Users,
} from "lucide-react";
import { getChildren, addChild, updateChild, deleteChild } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import type { Child } from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────

function isDuplicateName(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505");
}

// ── Add child form ─────────────────────────────────────────────────────────

function AddChildForm({
  userId,
  existingNames,
  onCancel,
}: {
  userId: string;
  existingNames: string[];
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [name,       setName]       = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [localError, setLocalError] = useState("");

  const mutation = useMutation({
    mutationFn: () => addChild(userId, name, schoolName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children", userId] });
      onCancel();
    },
    onError: (err) => {
      setLocalError(
        isDuplicateName(err)
          ? `You already have a child named "${name}".`
          : (err instanceof Error ? err.message : "Something went wrong.")
      );
    },
  });

  const trimmedName = name.trim();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (!trimmedName) { setLocalError("Name is required."); return; }
    if (existingNames.map(n => n.toLowerCase()).includes(trimmedName.toLowerCase())) {
      setLocalError(`You already have a child named "${trimmedName}".`);
      return;
    }
    mutation.mutate();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-primary/20 bg-primary/5 p-4"
    >
      <p className="mb-3 text-sm font-semibold text-foreground">Add a child</p>
      <div className="flex flex-col gap-2.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <UserRound className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Child's name *"
              value={name}
              onChange={(e) => { setName(e.target.value); setLocalError(""); }}
              autoFocus
              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="relative flex-1">
            <School className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="School name (optional)"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {localError && (
          <p className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">{localError}</p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={mutation.isPending || !name.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
              : <><Check className="h-3.5 w-3.5" /> Add child</>}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Child row (view + inline edit) ────────────────────────────────────────

function ChildRow({
  child,
  userId,
  existingNames,
}: {
  child: Child;
  userId: string;
  existingNames: string[];
}) {
  const queryClient = useQueryClient();
  const [editing,    setEditing]    = useState(false);
  const [editName,   setEditName]   = useState(child.name);
  const [editSchool, setEditSchool] = useState(child.school_name ?? "");
  const [localError, setLocalError] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  const updateMutation = useMutation({
    mutationFn: () => updateChild(child.id, userId, editName, editSchool),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children", userId] });
      setEditing(false);
      setLocalError("");
    },
    onError: (err) => {
      setLocalError(
        isDuplicateName(err)
          ? `You already have a child named "${editName.trim()}".`
          : (err instanceof Error ? err.message : "Something went wrong.")
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteChild(child.id, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["children", userId] }),
  });

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");
    const trimmed = editName.trim();
    if (!trimmed) { setLocalError("Name is required."); return; }
    const otherNames = existingNames
      .filter((n) => n.toLowerCase() !== child.name.toLowerCase())
      .map((n) => n.toLowerCase());
    if (otherNames.includes(trimmed.toLowerCase())) {
      setLocalError(`You already have a child named "${trimmed}".`);
      return;
    }
    updateMutation.mutate();
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditName(child.name);
    setEditSchool(child.school_name ?? "");
    setLocalError("");
  };

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <UserRound className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={editName}
              onChange={(e) => { setEditName(e.target.value); setLocalError(""); }}
              autoFocus
              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="relative flex-1">
            <School className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={editSchool}
              onChange={(e) => setEditSchool(e.target.value)}
              placeholder="School name (optional)"
              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {localError && (
          <p className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">{localError}</p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={updateMutation.isPending || !editName.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {updateMutation.isPending
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
              : <><Check className="h-3 w-3" /> Save</>}
          </button>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm">
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
        {child.name.slice(0, 1).toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{child.name}</p>
        {child.school_name && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <School className="h-3 w-3" />
            {child.school_name}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setEditing(true)}
          title="Edit"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        {confirmDel ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-red-600 font-medium">Remove?</span>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            title="Delete"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/20 px-8 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Users className="h-7 w-7 text-primary" />
      </div>
      <div>
        <p className="font-semibold text-foreground">No children added yet</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          Add your children's names so FamOS can automatically link school
          emails to the right kid — events, deadlines, and action items will
          show whose they are.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Add your first child
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ChildrenPage() {
  const { user } = useAuth();
  const userId   = user!.id;
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: children = [], isLoading, error } = useQuery({
    queryKey: ["children", userId],
    queryFn:  () => getChildren(userId),
    staleTime: 30_000,
  });

  const existingNames = children.map((c) => c.name);

  return (
    <Shell>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your Children</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Names are used to match events and action items in school emails.
          </p>
        </div>

        {children.length > 0 && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add child
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load children: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <div className="flex flex-col gap-3">
          {/* Empty state */}
          {children.length === 0 && !adding && (
            <EmptyState onAdd={() => setAdding(true)} />
          )}

          {/* Child list */}
          {children.map((child) => (
            <ChildRow
              key={child.id}
              child={child}
              userId={userId}
              existingNames={existingNames}
            />
          ))}

          {/* Add form */}
          {adding && (
            <AddChildForm
              userId={userId}
              existingNames={existingNames}
              onCancel={() => setAdding(false)}
            />
          )}
        </div>
      )}

      {/* Tip */}
      {!isLoading && children.length > 0 && (
        <p className="mt-6 text-xs text-muted-foreground/70 text-center">
          Tip: use the exact name as it appears in school emails for best matching.
          School emails often use first names only.
        </p>
      )}
    </Shell>
  );
}
