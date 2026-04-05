-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "maiden_name" TEXT,
    "nickname" TEXT,
    "gender" TEXT,
    "date_of_birth" TEXT,
    "date_of_birth_approx" BOOLEAN NOT NULL DEFAULT false,
    "place_of_birth" TEXT,
    "date_of_death" TEXT,
    "date_of_death_approx" BOOLEAN NOT NULL DEFAULT false,
    "place_of_death" TEXT,
    "is_living" BOOLEAN NOT NULL DEFAULT true,
    "biography" TEXT,
    "occupation" TEXT,
    "education" TEXT,
    "religion" TEXT,
    "denomination" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "current_city" TEXT,
    "current_state" TEXT,
    "current_country" TEXT,
    "photo_url" TEXT,
    "birth_latitude" REAL,
    "birth_longitude" REAL,
    "current_latitude" REAL,
    "current_longitude" REAL,
    "generation" INTEGER,
    "family_side" TEXT,
    "birth_order" INTEGER,
    "added_by" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "parent_child" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parent_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "parent_type" TEXT NOT NULL,
    "is_biological" BOOLEAN NOT NULL DEFAULT true,
    "is_adopted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parent_child_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "persons" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "parent_child_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "persons" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "spouses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "person1_id" TEXT NOT NULL,
    "person2_id" TEXT NOT NULL,
    "marriage_date" TEXT,
    "marriage_place" TEXT,
    "divorce_date" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "marriage_order" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "spouses_person1_id_fkey" FOREIGN KEY ("person1_id") REFERENCES "persons" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "spouses_person2_id_fkey" FOREIGN KEY ("person2_id") REFERENCES "persons" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "person_id" TEXT,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "date_taken" TEXT,
    "uploaded_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "media_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "event_date" TEXT,
    "location" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "event_persons" (
    "event_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "role" TEXT,
    PRIMARY KEY ("event_id", "person_id"),
    CONSTRAINT "event_persons_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_persons_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "places" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "stories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "narrator_id" TEXT,
    "tags" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stories_narrator_id_fkey" FOREIGN KEY ("narrator_id") REFERENCES "persons" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "parent_child_parent_id_child_id_key" ON "parent_child"("parent_id", "child_id");

-- CreateIndex
CREATE UNIQUE INDEX "spouses_person1_id_person2_id_key" ON "spouses"("person1_id", "person2_id");
