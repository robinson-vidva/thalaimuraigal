type RelationshipType =
  | "father" | "mother" | "grandfather" | "grandmother"
  | "elder_brother" | "younger_brother" | "elder_sister" | "younger_sister"
  | "maternal_uncle" | "maternal_uncle_wife" | "paternal_aunt" | "paternal_aunt_husband"
  | "father_elder_brother" | "mother_elder_sister" | "father_younger_brother" | "mother_younger_sister"
  | "son_in_law" | "daughter_in_law" | "son" | "daughter"
  | "husband" | "wife" | "grandson" | "granddaughter";

const TAMIL_TERMS: Record<RelationshipType, { tamil: string; english: string }> = {
  father: { tamil: "\u0B85\u0BAA\u0BCD\u0BAA\u0BBE", english: "Appa" },
  mother: { tamil: "\u0B85\u0BAE\u0BCD\u0BAE\u0BBE", english: "Amma" },
  grandfather: { tamil: "\u0BA4\u0BBE\u0BA4\u0BCD\u0BA4\u0BBE", english: "Thatha" },
  grandmother: { tamil: "\u0BAA\u0BBE\u0B9F\u0BCD\u0B9F\u0BBF", english: "Paati" },
  elder_brother: { tamil: "\u0B85\u0BA3\u0BCD\u0BA3\u0BBE", english: "Anna" },
  younger_brother: { tamil: "\u0BA4\u0BAE\u0BCD\u0BAA\u0BBF", english: "Thambi" },
  elder_sister: { tamil: "\u0B85\u0B95\u0BCD\u0B95\u0BBE", english: "Akka" },
  younger_sister: { tamil: "\u0BA4\u0B99\u0BCD\u0B95\u0BC8", english: "Thangai" },
  maternal_uncle: { tamil: "\u0BAE\u0BBE\u0BAE\u0BBE", english: "Mama" },
  maternal_uncle_wife: { tamil: "\u0BAE\u0BBE\u0BAE\u0BBF", english: "Maami" },
  paternal_aunt: { tamil: "\u0B85\u0BA4\u0BCD\u0BA4\u0BC8", english: "Athai" },
  paternal_aunt_husband: { tamil: "\u0B85\u0BA4\u0BCD\u0BA4\u0BBF\u0BAE\u0BCD\u0BAA\u0BC7\u0BB0\u0BCD", english: "Athimber" },
  father_elder_brother: { tamil: "\u0BAA\u0BC6\u0BB0\u0BBF\u0BAF\u0BAA\u0BCD\u0BAA\u0BBE", english: "Periyappa" },
  mother_elder_sister: { tamil: "\u0BAA\u0BC6\u0BB0\u0BBF\u0BAF\u0BAE\u0BCD\u0BAE\u0BBE", english: "Periamma" },
  father_younger_brother: { tamil: "\u0B9A\u0BBF\u0BA4\u0BCD\u0BA4\u0BAA\u0BCD\u0BAA\u0BBE", english: "Chithappa" },
  mother_younger_sister: { tamil: "\u0B9A\u0BBF\u0BA4\u0BCD\u0BA4\u0BBF", english: "Chithhi" },
  son_in_law: { tamil: "\u0BAE\u0BBE\u0BAA\u0BCD\u0BAA\u0BBF\u0BB3\u0BCD\u0BB3\u0BC8", english: "Maaple" },
  daughter_in_law: { tamil: "\u0BAE\u0BB0\u0BC1\u0BAE\u0B95\u0BB3\u0BCD", english: "Mathini" },
  son: { tamil: "\u0BAE\u0B95\u0BA9\u0BCD", english: "Magan" },
  daughter: { tamil: "\u0BAE\u0B95\u0BB3\u0BCD", english: "Magal" },
  husband: { tamil: "\u0B95\u0BA3\u0BB5\u0BB0\u0BCD", english: "Kanavar" },
  wife: { tamil: "\u0BAE\u0BA9\u0BC8\u0BB5\u0BBF", english: "Manaivi" },
  grandson: { tamil: "\u0BAA\u0BC7\u0BB0\u0BA9\u0BCD", english: "Peran" },
  granddaughter: { tamil: "\u0BAA\u0BC7\u0BA4\u0BCD\u0BA4\u0BBF", english: "Pethi" },
};

export function getTamilTerm(
  relationship: RelationshipType
): { tamil: string; english: string } | null {
  return TAMIL_TERMS[relationship] ?? null;
}

export function getSiblingRelationship(
  gender: string | null,
  isElder: boolean
): RelationshipType | null {
  if (gender === "M") return isElder ? "elder_brother" : "younger_brother";
  if (gender === "F") return isElder ? "elder_sister" : "younger_sister";
  return null;
}

export { type RelationshipType, TAMIL_TERMS };
