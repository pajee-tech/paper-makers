import BookUploader from "@/components/BookUploader";
import { getSession } from "@/lib/auth";

export default async function UploadBookPage() {
  const s = await getSession();
  return (
    <div>
      <h1>Add a textbook / syllabus</h1>
      <p className="muted">Upload a class book or syllabus PDF once. Every page is saved as text with its chapters, topics and exercises, so teachers can pick questions by chapter and question number.</p>
      <BookUploader isSuper={s?.user.role === "SUPER_ADMIN"} />
    </div>
  );
}
