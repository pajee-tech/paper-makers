import type { AcademicClass, Institution, SavedPaper, Subject } from "@prisma/client";
import type { PaperDTO, PaperSection, PrintSettings } from "./types";

type Full = SavedPaper & {
  institution: Pick<Institution, "name" | "city" | "address" | "logoDataUrl">;
  class: AcademicClass | null;
  subject: Subject | null;
};

export function toPaperDTO(p: Full, watermarkText?: string): PaperDTO {
  return {
    id: p.id,
    title: p.title,
    paperType: p.paperType,
    examDate: p.examDate ? p.examDate.toISOString() : null,
    timeAllowed: p.timeAllowed,
    totalMarks: p.totalMarks,
    sections: p.sections as unknown as PaperSection[],
    printSettings: (p.printSettings as unknown as PrintSettings) ?? null,
    watermark: p.watermark,
    watermarkText,
    className: p.class?.name ?? null,
    subjectName: p.subject?.name ?? null,
    subjectIsUrdu: p.subject?.isUrdu ?? false,
    institution: { name: p.institution.name, city: p.institution.city, address: p.institution.address, logoDataUrl: p.institution.logoDataUrl },
  };
}
