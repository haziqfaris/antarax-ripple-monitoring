# Usability test: the Outcomes mock with REKA project managers

**Purpose.** Before anything is built, find out whether the people who will use Outcomes every week can set up a client, read what each client is getting, and act on what needs them, without help. Above all: does organising the console by client (PRD 0.5) match how they actually work?

**Method.** Five moderated sessions of 60 minutes, one person each, thinking aloud, on the clickable mock. Remote with screen sharing, or in person. One moderator, one note-taker.

**When.** During Phase 0, after the design workshop and before Phase 1 planning. Allow one week: two days to recruit and schedule, three days of sessions, one day to analyse.

## What we want to learn

| # | Question | Where in the mock | We are right if |
|---|---|---|---|
| Q1 | Do they look for work by **client** first, or by project or solution? | Home, Clients, sidebar | Most go to a client before a project without being told, and say the grouping matches how they think |
| Q2 | Can they find **which client needs them most**, and why, in under a minute? | Clients list (Need you filter), Home client cards | 4 of 5 name Bina Jaya's quote drafter (not answering) and say what to do |
| Q3 | Do they understand **measured vs estimated**, the likely range, and why some hours aren't counted? | Contoh Logistik client page, "How totals are counted" | 4 of 5 explain in their own words that hours saved is an estimate from the baseline, and why Invoice triage's hours are not added |
| Q4 | Can they **connect a first project** without documentation? | Fresh workspace: welcome, checklist, the 4-step connect flow and its connection map | 4 of 5 finish; no step needs the moderator; they can say what the developer must do |
| Q5 | Do the **approval rules** make sense, or feel like an obstacle? | Approvals; switching person in the profile menu | They can say why they cannot approve their own change, and do not call it a bug |
| Q6 | Is **client view** trusted enough to show a client? | Client page, Team view / Client view | They say what is hidden from the client and would share that screen |
| Q7 | Do **Ask** and **Analytics** answer questions they actually get asked? | Ask, Analytics by client | They try a question of their own and judge the answer usable, with its source |

## Participants

| # | Who | Rights in the mock | Why |
|---|---|---|---|
| P1 to P3 | REKA project managers running a live client | Daniel Lim (Approve) | The main daily users |
| P4 | An analyst who prepares client reports | Nurul Aina (Measurement, no approval) | Proposes KPIs, drafts reports |
| P5 | Leadership with commercial oversight | Aisyah Rahman (Approve, Commercial) | Fees, renewals, the portfolio view |

Nobody who worked on the PRD or the mock. Tell each person it is a test of the product, not of them, and that the figures are invented.

## Set-up

- **The mock** at the published link (claude.ai artifact "Outcomes Console Mock"). It is private: share it with each participant before the session, or share your screen and let them direct you. Or run it locally: `python3 -m http.server -d mocks` and open `http://localhost:8000`.
- Start each session from a **fresh load** (reload the page) so the workspace is empty and the first-use flow shows.
- Desktop browser at full width. If time allows, repeat T2 on a phone for P5.
- Note-taker uses the sheet at the end of this file, one row per task.

## Session script (60 minutes)

**Welcome (5 min).** "We're testing an early design for a tool REKA would use to show clients what their AI solutions deliver. Nothing is built; every client and number is made up. Please think aloud: say what you're looking for, what you expect, and what surprises you. There are no wrong answers. If you get stuck, that tells us something about the design, not about you."

Warm-up questions:
1. When a client asks "is the AI working for us?", what do you show them today?
2. In a normal week, what do you check first, and how do you find it?

**Tasks (45 min).** Read each task aloud. Don't point at the screen. If someone is stuck for two minutes, give the hint and mark the task "assisted".

| # | Task as read aloud | Starts at | Success | Hint after 2 minutes |
|---|---|---|---|---|
| T1 | "You've just been given access. Set up your workspace and get your first client's project measured. The client is Teladan Properties; their solution reads leases." | Sign in | Reaches the developer brief in the connect wizard, and can say what the developer must do and what happens next | "What does the checklist on Home suggest?" |
| T2 | "Switch to the example workspace. Which client needs you most right now, and what would you do about it?" | Home (example clients) | Names Bina Jaya's quote drafter (not answering) and opens it | "Where would you see all your clients?" |
| T3 | "Your contact at Contoh Logistik asks how many hours the system saved them last month. What would you tell them, and how sure are you?" | Clients | Gives the hours with the range, says it's an estimate against the baseline, and can explain why Invoice triage isn't added | "Is there anything that says how the total is counted?" |
| T4 | "Before you send it, check exactly what Contoh Logistik would see on their side." | Contoh Logistik page | Switches to Client view and names something hidden (fees, notes, the draft summary) | "Is there a way to see it as the client does?" |
| T5 | "The September summary for Contoh Logistik is ready. Get it approved." | Contoh Logistik page | Approves it as Daniel, or, as Nurul, explains why they can't and who can | "Who is allowed to approve this?" |
| T6 | "Your manager asks which client improved most over the last 90 days. Find out." | Anywhere | Uses Analytics by client or Ask, gives an answer with its source | "Is there a place for comparing clients?" |
| T7 | "Ask the tool a question you've actually been asked by a client this month." | Ask | Gets an answer and says whether they'd trust it | (none) |
| T8 (if time) | "A prospect, Harapan Foods, is coming in tomorrow. Prepare a demo that shows what they'd get." | Anywhere | Opens the demo workspace and simulates a project in Demo studio | "Is there somewhere to try things without touching real clients?" |

After each task, ask: **"How easy or hard was that, from 1 (very hard) to 7 (very easy)?"** and "What did you expect to happen?" when they hesitated.

**Wrap-up (10 min).**
1. If you had this tomorrow, what would you use first? What would you ignore?
2. Is anything here wrong for how REKA actually works with clients?
3. What would make you trust a number enough to put it in front of a client?
4. The menu says Clients, Analytics, Ask, Approvals, Reports. Would you change any of those words?
5. Anything you expected to find and didn't?

## What to record

- **Per task:** done, done with help, or not done; time; the 1 to 7 rating; where they looked first; words they used for things (do they say client, organisation, account, project?); any wrong turn.
- **Quotes**, word for word, especially about trust in the numbers and about clients.
- **Bugs** in the mock, separately: they are not findings about the design.

## Analysis

The day after the last session:

1. Fill one table: tasks across, participants down, each cell done, help or not done, with time and rating.
2. List every problem seen. Rate each one:
   - **Blocks**: they couldn't finish.
   - **Slows**: they finished but lost time or confidence.
   - **Cosmetic**.
   Count how many participants hit it.
3. Answer Q1 to Q7 with yes, partly or no, and the evidence.
4. Turn each Blocks or Slows problem into a change: in the mock, in the PRD (cite the requirement id, for example FR-DSH-11), or as a new open decision in PRD §20.
5. Share a one-page summary at the Phase 1 planning meeting, with three short clips or quotes.

**Stop and rethink** if 3 or more participants fail T2 or T3. Those two tasks are why the client-first layout and the measured/estimated labels exist.

## Note-taking sheet

| Participant | Task | Result (done / help / not done) | Time | Rating 1 to 7 | First place looked | Wrong turns | Quote |
|---|---|---|---|---|---|---|---|
| P1 | T1 | | | | | | |
| P1 | T2 | | | | | | |
| … | | | | | | | |
