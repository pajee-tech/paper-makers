// Copyright (c) Pajee Technologies. All rights reserved.
import type { Level } from "./types";

/**
 * Standard Pakistani class ladder (Playgroup → BS Hons) with the subjects commonly taught
 * (Single National Curriculum / Punjab, Federal, KP & Sindh boards). Seeded for every new
 * institution; schools and academies can add or delete their own classes and subjects.
 * `urdu: true` → subject is printed right-to-left in Nastaliq.
 */
export interface StdSubject { name: string; urdu?: boolean }
export interface StdClass { name: string; level: Level; subjects: StdSubject[] }

const S = (...names: string[]): StdSubject[] => names.map((n) => ({ name: n, urdu: /^(Urdu|اردو|Islamiat \(Urdu\)|Tarjuma-tul-Quran|Nazra Quran|Arabic)/.test(n) }));

const EARLY = S("English", "Urdu", "Mathematics", "General Knowledge", "Islamiat (Urdu)", "Nazra Quran", "Drawing & Colouring", "Rhymes / Oral");
const PRIMARY_LOW = S("English", "Urdu", "Mathematics", "General Knowledge", "Islamiat (Urdu)", "Nazra Quran", "Computer", "Drawing");
const PRIMARY_HIGH = S("English", "Urdu", "Mathematics", "General Science", "Social Studies", "Islamiat (Urdu)", "Nazra Quran", "Computer", "Drawing");
const MIDDLE = S("English", "Urdu", "Mathematics", "General Science", "History & Geography", "Islamiat", "Islamiat (Urdu)", "Computer Science", "Arabic", "Tarjuma-tul-Quran", "Home Economics");
const MATRIC = S(
  "English", "Urdu", "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science", "General Science", "General Mathematics",
  "Islamiat", "Islamiat (Urdu)", "Pakistan Studies", "Tarjuma-tul-Quran", "Education", "Civics", "Economics", "Food & Nutrition", "Home Economics", "Arabic", "Physical Education",
);
const INTER = S(
  "English", "Urdu", "Islamiat", "Islamiat (Urdu)", "Pakistan Studies", "Tarjuma-tul-Quran", "Physics", "Chemistry", "Biology", "Mathematics", "Computer Science",
  "Statistics", "Economics", "Accounting", "Business Mathematics", "Principles of Commerce", "Principles of Economics", "Banking", "Business Statistics", "Commercial Geography",
  "Civics", "Psychology", "Sociology", "Education", "Islamic Studies", "History", "Health & Physical Education", "Fine Arts",
);
const BA_BSC = S(
  "English", "Urdu", "Islamiat", "Pakistan Studies", "Economics", "Political Science", "History", "Psychology", "Sociology", "Education", "Islamic Studies",
  "Mathematics A", "Mathematics B", "Physics", "Chemistry", "Botany", "Zoology", "Statistics", "Computer Science", "Geography", "Journalism", "Library Science",
);
const ADP = S(
  "Functional English", "Islamic Studies", "Pakistan Studies", "Quantitative Reasoning", "ICT", "Principles of Management", "Principles of Marketing",
  "Financial Accounting", "Cost Accounting", "Business Communication", "Microeconomics", "Macroeconomics", "Business Statistics", "Programming Fundamentals", "Database Systems",
);
const BS = S(
  "Functional English", "Expository Writing", "Islamic Studies", "Ideology & Constitution of Pakistan", "Quantitative Reasoning", "Applications of ICT", "Civics & Community Engagement",
  "Calculus & Analytical Geometry", "Linear Algebra", "Probability & Statistics", "Discrete Structures",
  "Programming Fundamentals", "Object Oriented Programming", "Data Structures & Algorithms", "Database Systems", "Operating Systems", "Computer Networks", "Software Engineering", "Artificial Intelligence",
  "Principles of Management", "Principles of Marketing", "Financial Accounting", "Business Finance", "Human Resource Management", "Organizational Behaviour", "Supply Chain Management", "Entrepreneurship",
  "Microeconomics", "Macroeconomics", "Business Research Methods",
  "Physics", "Chemistry", "Botany", "Zoology", "Mathematics", "English Literature", "Linguistics", "Psychology", "Sociology", "Education", "Mass Communication", "Political Science", "International Relations",
);

export const STANDARD_CLASSES: StdClass[] = [
  { name: "Playgroup", level: "EARLY_YEARS", subjects: EARLY },
  { name: "Nursery", level: "EARLY_YEARS", subjects: EARLY },
  { name: "KG", level: "EARLY_YEARS", subjects: EARLY },
  { name: "Prep", level: "EARLY_YEARS", subjects: EARLY },
  { name: "Class 1", level: "PRIMARY", subjects: PRIMARY_LOW },
  { name: "Class 2", level: "PRIMARY", subjects: PRIMARY_LOW },
  { name: "Class 3", level: "PRIMARY", subjects: PRIMARY_HIGH },
  { name: "Class 4", level: "PRIMARY", subjects: PRIMARY_HIGH },
  { name: "Class 5", level: "PRIMARY", subjects: PRIMARY_HIGH },
  { name: "Class 6", level: "MIDDLE", subjects: MIDDLE },
  { name: "Class 7", level: "MIDDLE", subjects: MIDDLE },
  { name: "Class 8", level: "MIDDLE", subjects: MIDDLE },
  { name: "9th", level: "MATRIC", subjects: MATRIC },
  { name: "10th", level: "MATRIC", subjects: MATRIC },
  { name: "1st Year (11th)", level: "INTERMEDIATE", subjects: INTER },
  { name: "2nd Year (12th)", level: "INTERMEDIATE", subjects: INTER },
  { name: "BA / BSc (Associate)", level: "GRADUATION", subjects: BA_BSC },
  { name: "ADP", level: "GRADUATION", subjects: ADP },
  { name: "BS (Hons)", level: "GRADUATION", subjects: BS },
];
