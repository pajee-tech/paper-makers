"use client";
import { useRouter } from "next/navigation";

export default function DeletePaperButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      className="btn-danger btn-sm"
      onClick={async () => {
        if (!confirm("Delete this paper and its results? (This does not give back a free-trial credit.)")) return;
        await fetch(`/api/papers/${id}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      Delete
    </button>
  );
}
