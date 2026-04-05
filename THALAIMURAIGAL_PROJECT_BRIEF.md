# Thalaimuraigal - Family Tree Website

## Project Overview

**Name:** Thalaimuraigal (தலைமுறைகள் - "Generations")
**Repo:** github.com/sherinveronicka/thalaimuraigal
**Stack:** Next.js + TypeScript + SQLite (Prisma ORM) + Tailwind CSS
**Domain:** thalaimuraigal.com
**Deployment:** Vercel

A family tree website that supports tree view, table view, and map view. Members can be added without accounts. Each member has a profile with name, photo, relationship, DOB/DOD, and biography.

---

## Database Schema

### Design Philosophy

Only TWO primary relationship types are stored in the database:
1. **Parent-Child** (with mother/father distinction)
2. **Spouse** (with marriage order for multiple marriages)

Everything else (sibling, uncle, aunt, cousin, grandparent, nephew, niece, in-law, etc.) is **derived programmatically** from these two primitives. This keeps the data clean and avoids duplication or inconsistency.

### Generation Calculation (Async-Safe, Relative)

Data will be added in any order -- a child before parents, a cousin before siblings, 
disconnected branches that later get linked. There is NO guaranteed root person at any point.

**Approach: Reference Person + Relative Numbering**

- A `reference_person_id` is stored in app settings. This person = Generation 0.
- Everyone else is computed relative to the reference person:
  - Parent of Gen N = Gen N-1
  - Child of Gen N = Gen N+1
  - Spouse inherits same generation as partner
- Generations can be negative (ancestors) or positive (descendants)

**How it works with async data entry:**

1. Person added with NO relationships → `generation = NULL` (unlinked)
2. Person linked as child of someone with a generation → auto-assigned parent's gen + 1
3. Person linked as parent of someone with a generation → auto-assigned child's gen - 1
4. Spouse linked → inherits partner's generation
5. Two disconnected sub-trees connected by a new relationship → recalculate the smaller sub-tree to align with the larger one
6. Reference person changed → full recalculation of all generations

**Edge cases:**
- Multiple disconnected sub-trees can co-exist with independent generation numbers until connected
- Unlinked persons (generation = NULL) are NOT blocked from any feature. They appear normally in table view, search, profiles, and can have photos, stories, events. The UI shows a soft warning badge ("not yet linked to family tree") on their profile. Tree view and generation view naturally exclude them since they have no position, but everything else works fully.
- Circular relationships are rejected at insert time (validation: a person cannot be their own ancestor)

**Recalculation trigger:** Any INSERT/UPDATE/DELETE on `parent_child` or `spouses` table triggers generation recalculation using BFS from the reference person outward.

### Birth Order

Siblings are ordered by:
1. `birth_order` field (manually set integer, 1 = eldest)
2. Fallback to `date_of_birth` if birth_order is not set
3. This determines elder/younger brother/sister relationships

---

### Tables

#### persons

```
id                  TEXT PRIMARY KEY (UUID)
first_name          TEXT NOT NULL
last_name           TEXT
maiden_name         TEXT (original surname before marriage)
nickname            TEXT
gender              TEXT CHECK('M', 'F', 'O')

date_of_birth       TEXT (ISO format or partial: "1892-04-08" or "1892" or null)
date_of_birth_approx BOOLEAN DEFAULT 0 (flag if DOB is approximate)
place_of_birth      TEXT
date_of_death       TEXT
date_of_death_approx BOOLEAN DEFAULT 0
place_of_death      TEXT
is_living           BOOLEAN DEFAULT 1

biography           TEXT (short paragraph)
occupation          TEXT
education           TEXT
religion            TEXT
denomination        TEXT

email               TEXT
phone               TEXT
current_city        TEXT
current_state       TEXT
current_country     TEXT

photo_url           TEXT (profile photo)

birth_latitude      REAL
birth_longitude     REAL
current_latitude    REAL
current_longitude   REAL

generation          INTEGER (cached, computed from parent-child chain)
family_side         TEXT ('paternal', 'maternal', 'both')
birth_order         INTEGER (among siblings: 1 = eldest)

added_by            TEXT
notes               TEXT
created_at          DATETIME DEFAULT NOW
updated_at          DATETIME DEFAULT NOW
```

#### parent_child

Stores the ONE fundamental relationship: who is parent of whom.

```
id                  TEXT PRIMARY KEY (UUID)
parent_id           TEXT NOT NULL REFERENCES persons(id)
child_id            TEXT NOT NULL REFERENCES persons(id)
parent_type         TEXT NOT NULL CHECK('father', 'mother')
is_biological       BOOLEAN DEFAULT 1
is_adopted          BOOLEAN DEFAULT 0
notes               TEXT
created_at          DATETIME DEFAULT NOW

UNIQUE(parent_id, child_id)
```

#### spouses

Stores marriages/unions. Supports multiple marriages with ordering.

```
id                  TEXT PRIMARY KEY (UUID)
person1_id          TEXT NOT NULL REFERENCES persons(id)
person2_id          TEXT NOT NULL REFERENCES persons(id)
marriage_date       TEXT
marriage_place      TEXT
divorce_date        TEXT
is_current          BOOLEAN DEFAULT 1
marriage_order      INTEGER DEFAULT 1 (1st marriage, 2nd, etc.)
notes               TEXT
created_at          DATETIME DEFAULT NOW

UNIQUE(person1_id, person2_id)
```

#### media

```
id                  TEXT PRIMARY KEY (UUID)
person_id           TEXT REFERENCES persons(id) (nullable for family-level media)
type                TEXT CHECK('photo', 'document', 'video', 'audio', 'certificate')
url                 TEXT NOT NULL
caption             TEXT
date_taken          TEXT
uploaded_by         TEXT
created_at          DATETIME DEFAULT NOW
```

#### events

Family milestones.

```
id                  TEXT PRIMARY KEY (UUID)
title               TEXT NOT NULL
type                TEXT CHECK('birth', 'death', 'wedding', 'baptism', 'graduation', 'reunion', 'funeral', 'anniversary', 'migration', 'other')
event_date          TEXT
location            TEXT
latitude            REAL
longitude           REAL
description         TEXT
created_at          DATETIME DEFAULT NOW
```

#### event_persons

```
event_id            TEXT NOT NULL REFERENCES events(id)
person_id           TEXT NOT NULL REFERENCES persons(id)
role                TEXT (e.g., 'bride', 'groom', 'guest', 'officiant')
PRIMARY KEY (event_id, person_id)
```

#### places

Significant family locations for the map view.

```
id                  TEXT PRIMARY KEY (UUID)
name                TEXT NOT NULL
type                TEXT CHECK('ancestral_home', 'church', 'school', 'workplace', 'burial', 'hospital', 'other')
address             TEXT
city                TEXT
state               TEXT
country             TEXT
latitude            REAL
longitude           REAL
description         TEXT
```

#### stories

Oral history and family narratives.

```
id                  TEXT PRIMARY KEY (UUID)
title               TEXT NOT NULL
content             TEXT
narrator_id         TEXT REFERENCES persons(id)
tags                TEXT (comma separated)
created_at          DATETIME DEFAULT NOW
```

#### settings

App-level configuration. Stores reference person for generation calculation.

```
key                 TEXT PRIMARY KEY
value               TEXT
updated_at          DATETIME DEFAULT NOW

-- Required rows:
-- 'reference_person_id'  → UUID of the person who is Generation 0
-- 'family_name'          → e.g., 'Vidva-Veronicka Family'
-- 'site_title'           → 'Thalaimuraigal'
-- 'default_language'     → 'en' or 'ta'
```

---

## Derived Relationship Logic

All extended relationships are computed from `parent_child` and `spouses` tables. Here is the complete derivation logic:

### Direct Relationships (from stored data)

| Relationship | How to find |
|---|---|
| Father | parent_child WHERE child_id = me AND parent_type = 'father' |
| Mother | parent_child WHERE child_id = me AND parent_type = 'mother' |
| Children | parent_child WHERE parent_id = me |
| Sons | children WHERE gender = 'M' |
| Daughters | children WHERE gender = 'F' |
| Spouse | spouses WHERE person1_id = me OR person2_id = me |
| Husband | spouse WHERE gender = 'M' |
| Wife | spouse WHERE gender = 'F' |

### Sibling Relationships (derived)

| Relationship | How to derive |
|---|---|
| Siblings | persons who share at least one parent with me |
| Full siblings | persons who share BOTH parents with me |
| Half siblings | persons who share exactly ONE parent with me |
| Elder brother | male sibling with birth_order < my birth_order (or DOB earlier) |
| Younger brother | male sibling with birth_order > my birth_order |
| Elder sister | female sibling with birth_order < my birth_order |
| Younger sister | female sibling with birth_order > my birth_order |

### Grandparent / Grandchild (2 generations)

| Relationship | How to derive |
|---|---|
| Paternal grandfather | father's father |
| Paternal grandmother | father's mother |
| Maternal grandfather | mother's father |
| Maternal grandmother | mother's mother |
| Grandchildren | children of my children |

### Uncle / Aunt (parent's siblings)

| Relationship | How to derive |
|---|---|
| Paternal uncle (Periyappa/Chithappa) | father's brother (elder = Periyappa, younger = Chithappa) |
| Paternal aunt (Athai) | father's sister |
| Maternal uncle (Mama) | mother's brother |
| Maternal aunt (Periamma/Chithhi) | mother's sister (elder = Periamma, younger = Chithhi) |
| Uncle by marriage | spouse of parent's sibling |
| Aunt by marriage | spouse of parent's sibling |

### Nephew / Niece (sibling's children)

| Relationship | How to derive |
|---|---|
| Nephew | brother's son OR sister's son |
| Niece | brother's daughter OR sister's daughter |

### Cousin (parent's sibling's children)

| Relationship | How to derive |
|---|---|
| Paternal cousin | father's sibling's children |
| Maternal cousin | mother's sibling's children |

### In-Law Relationships

| Relationship | How to derive |
|---|---|
| Father-in-law | spouse's father |
| Mother-in-law | spouse's mother |
| Son-in-law | daughter's husband |
| Daughter-in-law | son's wife |
| Brother-in-law | spouse's brother OR sister's husband |
| Sister-in-law | spouse's sister OR brother's wife |

### Great-grandparent / Great-uncle etc.

Follow the same pattern recursively:
- Great-grandfather = grandparent's father
- Great-uncle = grandparent's brother
- Second cousin = parent's cousin's child

### Tamil Relationship Terms (for UI display)

```
Appa        = Father
Amma        = Mother
Thatha      = Grandfather
Paati       = Grandmother
Anna        = Elder brother
Thambi      = Younger brother
Akka        = Elder sister
Thangai     = Younger sister
Mama        = Maternal uncle
Maami       = Maternal uncle's wife
Athai       = Paternal aunt
Athimber    = Paternal aunt's husband
Periyappa   = Father's elder brother
Periyamma   = Mother's elder sister
Chithappa   = Father's younger brother
Chithhi     = Mother's younger sister
Maaple      = Son-in-law / Brother-in-law
Mathini     = Daughter-in-law
Machan      = Male cousin / Brother-in-law (informal)
Machchan    = Same as Machan
```

---

## Features to Build

### Phase 1 - Core (MVP)

1. **Data model setup**
   - Set up Prisma with SQLite
   - Implement all tables from schema above
   - Seed script to load initial data

2. **Add/Edit person**
   - Form to add a new family member
   - Fields: name, nickname, gender, DOB, DOD, photo upload, biography, occupation
   - Link to parents (select from existing persons)
   - Link to spouse (select from existing persons)
   - Set birth order among siblings
   - No authentication required

3. **Table view**
   - List all persons in a sortable, filterable table
   - Columns: name, generation, gender, DOB, DOD, spouse, parents
   - Filter by: generation, family side, living/deceased, gender
   - Search by name
   - Click row to open person profile

4. **Person profile page**
   - Photo, name, dates, biography
   - List of relationships (parents, spouse, children, siblings)
   - Show Tamil relationship terms
   - Timeline of life events
   - Gallery of media

### Phase 2 - Views

5. **Tree view**
   - Interactive family tree visualization
   - Navigate up (ancestors) and down (descendants)
   - Click any person to center the tree on them
   - Show spouse connections
   - Color code by generation or family side
   - Expand/collapse branches
   - Use D3.js or react-d3-tree

6. **Map view**
   - Plot family members on a map by birth location or current location
   - Cluster markers by place
   - Click marker to see person card
   - Show migration paths if data exists
   - Use Leaflet (free, no API key)

7. **Generation view**
   - Horizontal bands showing each generation
   - See all people in a generation at a glance
   - Show sibling order within each family unit

### Phase 3 - Enrichment

8. **Photo gallery**
   - Upload photos per person or per event
   - Family album view
   - Tag people in photos

9. **Stories / Oral history**
   - Add family stories with rich text
   - Link stories to persons
   - Tag by generation or theme

10. **Events timeline**
    - Chronological view of all family events
    - Filter by type (births, deaths, weddings)
    - Visualize on a timeline

11. **Statistics dashboard**
    - Total members by generation
    - Living vs deceased
    - Locations distribution
    - Average lifespan
    - Largest family branches

### Phase 4 - Polish

12. **Search**
    - Global search across all persons, stories, places
    - Relationship finder: "How is person A related to person B?"

13. **Export**
    - Export tree as PDF/image
    - Export data as GEDCOM (standard genealogy format)
    - Export as CSV

14. **Responsive design**
    - Mobile-friendly for sharing with family members
    - Progressive Web App for offline access

---

## Project Structure

```
thalaimuraigal/
  prisma/
    schema.prisma         # Database schema
    seed.ts               # Seed initial data
  src/
    app/
      page.tsx            # Landing page
      persons/
        page.tsx          # Table view (list all persons)
        [id]/
          page.tsx        # Person profile
        new/
          page.tsx        # Add new person
        [id]/edit/
          page.tsx        # Edit person
      tree/
        page.tsx          # Tree view
      map/
        page.tsx          # Map view
      generations/
        page.tsx          # Generation bands view
      stories/
        page.tsx          # Stories listing
      timeline/
        page.tsx          # Events timeline
      api/
        persons/
          route.ts        # CRUD for persons
        relationships/
          route.ts        # Parent-child + spouse APIs
        media/
          route.ts        # File upload
        search/
          route.ts        # Search API
    components/
      PersonCard.tsx
      PersonForm.tsx
      FamilyTree.tsx
      MapView.tsx
      TableView.tsx
      RelationshipBadge.tsx
      GenerationBand.tsx
      Navbar.tsx
    lib/
      db.ts               # Prisma client
      relationships.ts    # Derived relationship logic
      generations.ts      # Generation calculation
      tamil-terms.ts      # Tamil relationship term mapper
    types/
      index.ts            # TypeScript interfaces
  public/
    uploads/              # Uploaded photos
```

---

## Relationship Derivation Algorithm

```
function getRelationship(personA, personB):
  1. Find path from A to B through parent-child and spouse links
  2. Count "up" steps (to common ancestor) and "down" steps
  3. Map to relationship type:
     - up=1, down=0 → parent
     - up=0, down=1 → child
     - up=1, down=1 → sibling
     - up=2, down=0 → grandparent
     - up=0, down=2 → grandchild
     - up=2, down=1 → uncle/aunt
     - up=1, down=2 → nephew/niece
     - up=2, down=2 → cousin
     - spouse link at any point → add "in-law" modifier
  4. Apply gender to get specific term (brother/sister, uncle/aunt)
  5. Apply birth order to get elder/younger
  6. Map to Tamil term based on paternal/maternal side
```

## Generation Recalculation Algorithm

Called whenever a relationship (parent-child or spouse) is added, edited, or deleted.

```
function recalculateGenerations():
  1. Get reference_person_id from settings
  2. If no reference person set, pick the first person added and prompt user to confirm
  3. Set reference person generation = 0
  4. BFS outward from reference person:
     a. Queue = [reference_person]
     b. Visited = Set()
     c. While queue is not empty:
        - current = queue.pop()
        - Mark current as visited
        - For each parent of current:
            if not visited: set parent.generation = current.generation - 1, add to queue
        - For each child of current:
            if not visited: set child.generation = current.generation + 1, add to queue
        - For each spouse of current:
            if not visited: set spouse.generation = current.generation, add to queue
  5. Any person NOT reached by BFS = unlinked (generation = NULL)
  6. Batch update all generation values in DB

function onRelationshipChange(type, parent_id, child_id):
  1. Validate no circular reference (child cannot be ancestor of parent)
  2. Call recalculateGenerations()
  3. Return updated generation map
```

## Handling Disconnected Sub-trees

When data is added async, you can have multiple disconnected groups:

```
Group A: Grandpa → Dad → Me → My Kid
Group B: Uncle → Cousin (not yet linked to Group A)
Group C: Random person (no links yet)
```

- Groups A and B each have their own internal generation numbering
- Group C has generation = NULL but all features (profile, photos, stories, table view, search) work normally
- When someone links Uncle as Dad's brother (same parents), Group B merges into Group A
- Recalculation runs: Uncle gets same generation as Dad, Cousin gets same as Me
- Group C persons show a soft warning badge on their profile: "Not yet linked to family tree"
- No feature is blocked for unlinked persons. Linking is encouraged, not enforced.

---

## Technical Notes

- **No auth required** for Phase 1. Anyone with the link can view and add members.
- **Async data entry**: Persons can be added in any order without parents or relationships. Relationships can be added later. Generations auto-recalculate when links are made.
- **SQLite** is sufficient for a family-scale project (under 10k records). Can migrate to PostgreSQL later if needed.
- **Photo storage**: Start with local filesystem (`public/uploads/`), move to Cloudinary or S3 later.
- **Tamil terms**: Create a utility that takes (relationship_type, gender, birth_order, side) and returns the correct Tamil term.
- **GEDCOM compatibility**: Consider importing/exporting in GEDCOM format for interoperability with other genealogy software.
- **Validation rules (hard errors - prevent save):**
  - A person cannot be their own ancestor (no circular parent-child chains)
  - A person can have at most 1 father and 1 mother (biological)
  - Birth order must be unique among siblings sharing the same parents
- **Soft warnings (show badge/indicator, never block):**
  - Person has no parents linked
  - Person has no spouse linked
  - Person has no generation (unlinked to tree)
  - Person has no photo
  - Person has no DOB/DOD
  - Missing fields show as "Unknown" in UI, not as errors
- **Other rules:**
  - A person can have multiple spouses (with marriage_order tracking)
  - Deleting a person should prompt: keep children (re-link to grandparent) or orphan them
  - All fields except first_name are optional

---

## Sample Data

The initial family data has been extracted from an Excel file with 3 family sides:
- DAD's side: John Subbaiya & Muthamal lineage
- MOM's side: Arul Anantham & Mary lineage, Subanatha Raj & Nallamuthu lineage
- ROBIN's side: Andrew lineage, Samuel & Pushpa lineage

Key connecting person: Theodore James & Chandra appear on both DAD and MOM sides, linking the two families.

Total known persons: ~183 across 5 generations.

Seed data files: `seed_data.json` and `seed_data.csv` (to be manually reviewed and corrected before import).
