import BookViewer from "@/components/BookViewer";

export default function BookPage({ params }: { params: { id: string } }) {
  return <BookViewer bookId={params.id} />;
}
