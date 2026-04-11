export type Gender = "M" | "F" | "O";

export type ParentType = "father" | "mother";

export type FamilySide = "paternal" | "maternal" | "both";

export type MediaType = "photo" | "document" | "video" | "audio" | "certificate";

export type EventType =
  | "birth" | "death" | "wedding" | "baptism" | "graduation"
  | "reunion" | "funeral" | "anniversary" | "migration" | "other";

export type PlaceType =
  | "ancestral_home" | "church" | "school" | "workplace"
  | "burial" | "hospital" | "other";

export interface PersonFormData {
  firstName: string;
  lastName?: string;
  maidenName?: string;
  nickname?: string;
  gender?: Gender;
  dateOfBirth?: string;
  dateOfBirthApprox?: boolean;
  placeOfBirth?: string;
  dateOfDeath?: string;
  dateOfDeathApprox?: boolean;
  placeOfDeath?: string;
  isLiving?: boolean;
  biography?: string;
  occupation?: string;
  education?: string;
  religion?: string;
  denomination?: string;
  email?: string;
  phone?: string;
  currentCity?: string;
  currentState?: string;
  currentCountry?: string;
  photoUrl?: string;
  birthLatitude?: number;
  birthLongitude?: number;
  currentLatitude?: number;
  currentLongitude?: number;
  familySide?: FamilySide;
  birthOrder?: number;
  notes?: string;
  fatherId?: string;
  motherId?: string;
  spouseId?: string;
  childrenIds?: string[];
}
