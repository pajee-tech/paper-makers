import type { PaperDTO, QuestionSnapshot } from "./types";

const mcq = (id: string, text: string, options: string[], correct: number): QuestionSnapshot => ({ id, type: "MCQ", text, options, correctOption: correct, marks: 1 });
const short = (id: string, text: string): QuestionSnapshot => ({ id, type: "SHORT", text, marks: 2 });

/** Sample paper for the public /demo page (no login, no database). */
export const DEMO_PAPER: PaperDTO = {
  id: "demo",
  title: "Send-Up Examination 2026",
  paperType: "SEND_UP",
  examDate: "2026-12-10T00:00:00.000Z",
  timeAllowed: "2:10 Hours",
  totalMarks: 0,
  watermark: true,
  className: "10th",
  subjectName: "Mathematics (Science Group)",
  institution: { name: "The Model School System", city: "Rawalpindi", address: "Satellite Town" },
  sections: [
    {
      id: "s1", title: "Part-I (Objective)", questionType: "MCQ", marksEach: 1, isObjective: true, timeNote: "Time: 15 Minutes",
      instructions: "Fill the correct bubble on the OMR sheet.",
      questions: [
        mcq("d1", "The roots of $x^2 - 5x + 6 = 0$ are:", ["2, 3", "−2, −3", "1, 6", "−1, 6"], 0),
        mcq("d2", "If $\\sin\\theta = \\frac{1}{2}$, then $\\theta$ equals:", ["$30^\\circ$", "$45^\\circ$", "$60^\\circ$", "$90^\\circ$"], 0),
        mcq("d3", "The discriminant of $ax^2+bx+c=0$ is:", ["$b^2-4ac$", "$b^2+4ac$", "$4ac-b^2$", "$\\sqrt{b^2-4ac}$"], 0),
        mcq("d4", "The number of elements in the power set of $\\{a,b,c\\}$ is:", ["3", "6", "8", "9"], 2),
        mcq("d5", "$\\log_{10} 1000 =$", ["2", "3", "10", "100"], 1),
        mcq("d6", "A circle has ______ lines of symmetry.", ["1", "2", "4", "infinite"], 3),
      ],
    },
    {
      id: "s2", title: "Q.2 Write short answers to any FOUR questions.", questionType: "SHORT", marksEach: 2, attemptAny: 4, pageBreakBefore: true,
      urduInstructions: "کوئی سے چار سوالات کے مختصر جوابات لکھیں۔",
      questions: [
        short("d7", "Solve by factorization: $3x^2 + 4x + 1 = 0$"),
        short("d8", "Define a proportion and give one example."),
        short("d9", "Find the mean of 12, 15, 18, 21 and 24."),
        short("d10", "Prove that $\\sec^2\\theta - \\tan^2\\theta = 1$."),
        short("d11", "Write the formula for the volume of a cone."),
        short("d12", "If $A = \\{1,2,3\\}$ and $B = \\{2,3,4\\}$, find $A \\cap B$."),
      ],
    },
    {
      id: "s3", title: "Part-II — Attempt any TWO questions.", questionType: "LONG", marksEach: 8, attemptAny: 2,
      questions: [
        { id: "d13", type: "LONG", text: "(a) Solve the equation $\\sqrt{x+7} + \\sqrt{x+2} = \\sqrt{6x+13}$.\n(b) Find the value of $k$ if the roots of $x^2 + kx + 9 = 0$ are equal.", marks: 8 },
        { id: "d14", type: "LONG", text: "Prove that the perpendicular from the centre of a circle on a chord bisects it.", marks: 8 },
        { id: "d15", type: "LONG", text: "Construct a triangle $ABC$ with $AB = 6\\text{ cm}$, $BC = 5\\text{ cm}$ and $\\angle B = 60^\\circ$. Draw its circumcircle.", marks: 8 },
      ],
    },
  ],
};
DEMO_PAPER.totalMarks = 6 + 8 + 16;

export const DEMO_PRIMARY: PaperDTO = {
  id: "demo-kg",
  title: "Monthly Test — November",
  paperType: "MONTHLY",
  timeAllowed: "1 Hour",
  totalMarks: 19,
  watermark: false,
  className: "KG",
  subjectName: "English",
  institution: { name: "Little Stars Montessori", city: "Lahore" },
  sections: [
    { id: "k1", title: "Q.1 Match the picture with its name.", questionType: "MATCH_COLUMNS", marksEach: 4, questions: [{ id: "km", type: "MATCH_COLUMNS", text: "", marks: 4, matchPairs: [{ left: "Apple", right: "A" }, { left: "Ball", right: "B" }, { left: "Cat", right: "C" }, { left: "Dog", right: "D" }] }] },
    { id: "k2", title: "Q.2 Fill in the missing letters.", questionType: "MISSING_LETTERS", marksEach: 1, questions: [{ id: "kl1", type: "MISSING_LETTERS", text: "C _ T", answer: "A", marks: 1 }, { id: "kl2", type: "MISSING_LETTERS", text: "B _ L L", answer: "A", marks: 1 }, { id: "kl3", type: "MISSING_LETTERS", text: "1  2  _  4  _", answer: "3, 5", marks: 1 }] },
    { id: "k3", title: "Q.3 Look and write the name.", questionType: "PICTURE", marksEach: 2, questions: [{ id: "kp1", type: "PICTURE", text: "", icon: "apple", answer: "Apple", marks: 2 }, { id: "kp2", type: "PICTURE", text: "", icon: "fish", answer: "Fish", marks: 2 }] },
    { id: "k4", title: "Q.4 Trace and write.", questionType: "TRACING", marksEach: 2, questions: [{ id: "kt1", type: "TRACING", text: "Aa Bb Cc Dd", lineStyle: "FOUR_LINE", lineCount: 2, marks: 2 }, { id: "kt2", type: "TRACING", text: "1 2 3 4 5 6 7 8 9", lineStyle: "SQUARE", lineCount: 2, marks: 2 }] },
    { id: "k5", title: "Q.5 Write True or False.", questionType: "TRUE_FALSE", marksEach: 1, questions: [{ id: "kf1", type: "TRUE_FALSE", text: "A cat says meow.", answer: "True", marks: 1 }, { id: "kf2", type: "TRUE_FALSE", text: "The sun comes out at night.", answer: "False", marks: 1 }, { id: "kf3", type: "TRUE_FALSE", text: "We have two eyes.", answer: "True", marks: 1 }] },
  ],
};
