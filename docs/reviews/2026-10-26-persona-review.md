# Persona review of the two SiteSeer sites: 26 Oct 2026

Seven reviewers each looked at the live review sites as one of SiteSeer's real audiences:

- university course coordinator
- TAFE construction trainer
- high-school Design & Technology teacher
- builder's training and recruitment manager
- apprentice on a phone
- university IT and procurement
- accessibility auditor

They worked from 130 screenshots at desktop and true phone width, and tested the pages themselves in headless Chrome.

**What's already fixed** (commit `7074efe`, deployed): broken cross-site links, mobile page weight, touch-target sizes, the hero's pause behaviour, screen-reader gaps, the phone header, label inconsistencies, and the "0 site-safety risk" stat. axe reports 0 violations on all five pages.

**What's left** is below. None of it is a code problem. Each item needs a decision or facts that only the team has.

## What every reviewer asked for

| # | Gap | Who raised it | What to add |
|---|---|---|---|
| 1 | **How a pilot works, and what it costs** | All four buyers | A short "How a pilot works" section or page: length, seats or projects, cost (or "free for the first semester"), what SiteSeer sets up, what the institution or builder provides, and how success is measured. |
| 2 | **A proper contact route** | All seven | Every call to action is a `mailto:` to one academic's university address, which fails on lab and work machines and looks informal. Options: a short web form (a Cloudflare Pages Function can email it to you), or a role address such as hello@siteseer.education. Ask for institution type: university, TAFE/RTO, school, builder. |
| 3 | **"Available now" vs "Upcoming"** | Coordinator, school, builder | Tracking, assessment, curriculum mapping and induction records are all listed as upcoming, which reads as "it doesn't do this yet". Add an "Available now" list beside the roadmap, and give roadmap items a quarter or year. |
| 4 | **Proof** | All buyers | Track record is "1,000+ learners over ten years". Add one or two named quotes: a teaching colleague, a learner, Damian's classes, a TAFE SA contact. Any measured outcome you have, even small, beats adjectives. Industry has no builder proof yet; "Proven in the classroom, now on site" admits that. A first builder pilot is the fix. |
| 5 | **Trust and IT pack** | IT and procurement (blocker), TAFE, school | For a university or school to say yes to a pilot, at minimum: a **privacy statement** (what is collected, where it's hosted, retention); **deployment specs** (Windows/macOS minimums, GPU, install size, admin rights, whether the "web version" runs in the browser or is streamed); **how the LMS link works** (LTI 1.3 or an embed; SSO or not); an **accessibility statement**; **terms or pilot agreement**; and **company details** (legal entity, ABN, address, and the relationship to Adelaide University). |

## Audience-specific gaps

**TAFE / VET**
- No units of competency mapping.
- "Safe: zero site risk" sells the *absence* of WHS. Trainers want to see SiteSeer *teach* hazards and safe sequence.
- Wording reads university-first: "a first-year class", "Lecturer in Architecture", "for construction and architecture courses".
- Suggest a TAFE/RTO line in the hero statement and one Cert III example.

**Schools**
- No curriculum fit (Australian Curriculum Design & Technologies, SACE).
- No student-safety or privacy statement for parents and principals.
- No teacher resources.
- "Recruitment into industry" only half lands. A "meet the trade" card for each system on the model (what the job is, the pathway, school-based apprenticeships) would make the systems view do double duty.

**Industry**
- No setup time.
- No sense of what "Inductions" means today (facilitated walkthrough vs tracked completion).
- Some education language still leaks in: "learners", "how people learn", "gamification".
- The workforce angle is thin. Add a card along the lines of "Apprentices and graduates: show a first-year how the building goes together before day one."

**Phone users (apprentices)**
- Nothing to *try*. The blog says SiteSeer runs in the browser on phones, but nothing links to it.
- A "Try it on your phone" button would be the strongest single addition, if a public demo can be shared.

## Claims a reviewer would query

Have a source ready, or soften the wording:
- "Modelled to the last flashing" and "matched 1-to-1 with what gets built": what is the source, and how is it verified?
- "Used by more than a thousand learners": under what agreement?
- "Unreal Engine Academic Partner": does that licence allow commercial distribution?
- "Piloting SiteSeer… through AU Online": is there an agreement that can be referenced?
- The industry footer still shows "Draft copy, under review". Set `draft: false` in `src/content/sites/industry.json` once the copy is signed off.

## Decisions needed

1. Pilot terms and price, even as a range.
2. The contact route: form or role address.
3. What is available now vs upcoming, with dates.
4. Whether a public browser demo can be linked.
5. Who drafts the privacy, accessibility and terms pages, and the company details.
6. One or two quotes, and permission to use them.
