# CF26-P03-StarXCode
# 🛡️ FlowGuard AI

**Write a business rule in plain English. FlowGuard checks it for mistakes before it goes live.**

Example: you type
> "If order > ₹50,000, get manager approval and create purchase order."

FlowGuard turns this sentence into a workflow diagram, checks it for 5 common types of mistakes, and tells you if it's safe to run — or how to fix it if it's not.

---

## Table of Contents
1. [What Problem Are We Solving?](#1-what-problem-are-we-solving)
2. [How It Works (Step by Step)](#2-how-it-works-step-by-step)
3. [How We Built It (The Technical Part)](#3-how-we-built-it-the-technical-part)
4. [Technology Used](#4-technology-used)
5. [Repository Structure](#5-repository-structure)
6. [How to Run This Project](#6-how-to-run-this-project)
7. [How to Use the App](#7-how-to-use-the-app)
8. [How We Tested It](#8-how-we-tested-it)
9. [What's Missing / What We'd Add Next](#9-whats-missing--what-wed-add-next)
10. [Team Members](#10-team-members)
11. [Did We Use AI to Build This?](#11-did-we-use-ai-to-build-this)

---

## 1. What Problem Are We Solving?

Companies write rules like *"if X happens, then Y must be approved by Z."* These rules usually start as plain English sentences in a policy document or a chat message.

The problem: when someone turns that sentence into an actual automated workflow (approval chain, payment system, etc.), mistakes creep in. For example:

- 🔄 **A never-ending loop** — a rejected request keeps looping back for review forever, with no way out.
- 🚫 **A step nobody can reach** — an action is written down but never actually gets triggered.
- ❓ **Vague wording** — "someone" approves it, or it's for "high value" orders — but no one defines *who* or *how much*.
- 🔓 **The wrong person approving something** — like an Intern approving a ₹2,50,000 payment they shouldn't be allowed to touch.
- 💰 **Breaking company policy** — the amount is too high, or it's missing a required second approval.

These mistakes are hard to catch just by reading the sentence. **FlowGuard catches them automatically**, before the rule is ever turned into a real, live system.

---

## 2. How It Works (Step by Step)

Think of FlowGuard like an assembly line with 6 stations. The app shows this exact pipeline at the top of the screen:

1. **You type a rule** in plain English.
2. **The AI reads and understands it** — it picks out the role (Manager), the condition (order > ₹50,000), and the action (approve, create PO).
3. **It turns that into structured data** (a JSON object) — basically a computer-readable version of your sentence.
4. **It draws a diagram** — boxes and arrows showing the steps, color-coded so it's easy to read.
5. **It runs 5 safety checks** on that diagram (explained below).
6. **It gives a final answer: Safe ✅ or Needs Fixing ❌**
   - If ✅ Safe → you get a **simulator** where you can test-run the workflow with real numbers.
   - If ❌ Not safe → you get a **plain-English explanation** of what's wrong, plus a suggested fixed version of your sentence.

```
Your Sentence  →  AI Reads It  →  Structured Data  →  Diagram  →  5 Safety Checks  →  Safe? Yes/No
```

A more detailed version of this diagram, with which file does what, is in [`docs/architecture.md`](docs/architecture.md).

---

## 3. How We Built It (The Technical Part)

*(This section is for anyone who wants to look under the hood — like a judge checking the code.)*

### Step 2–3: Turning English into structured data
File: `src/js/ai-engine.js`

We built our own simple rule-reading logic using **pattern matching** (regular expressions). It scans your sentence for:
- Role words (manager, intern, VP...)
- Numbers and comparisons (>, ₹50,000, "exceeds"...)
- Action words (approve, notify, create...)

Based on the patterns it finds, it builds a diagram made of **nodes** (steps) and **edges** (arrows connecting steps). This works **completely offline** — no internet or API needed.

*Bonus:* if you want smarter, more flexible understanding, you can plug in a free Google Gemini API key in Settings, and it'll use real AI instead. If that fails or isn't set up, it automatically falls back to our offline logic.

### Step 4: Drawing the diagram
File: `src/js/graph-renderer.js`

We draw the steps and arrows using plain SVG (a way to draw shapes in the browser) — with zoom, drag, and a mini-map, like a simple diagram editor.

### Step 5: The 5 Safety Checks
File: `src/js/verifier.js`

This is the heart of the project. Each check is a small algorithm that looks at the diagram:

| # | Check | In simple terms | What it catches |
|---|---|---|---|
| 5.1 | Loop Check | "Does this diagram go in a circle forever?" | Infinite approval loops |
| 5.2 | Reachability Check | "Can every step actually be reached from the start?" | Steps that are written but never used |
| 5.3 | Clarity Check | "Are there any vague words or missing 'else' paths?" | Ambiguous rules |
| 5.4 | Permission Check | "Is this person actually allowed to approve this?" | Wrong person approving |
| 5.5 | Policy Check | "Does this break the company's money rules?" | Budget/policy violations |

Each check gives a Pass, Fail, or Warning. We add up the results into one **safety score out of 100** and one final answer: **Safe** or **Needs Correction**.

### If it fails: Auto-Fix
File: `src/js/auto-fixer.js`

We look at *which* check failed and return a ready-made explanation + a rewritten version of your sentence that fixes the specific problem.

### If it passes: Simulator
File: `src/js/simulator.js`

Enter a test order amount and a manager decision, hit "Run," and watch a little animated token move step-by-step through your diagram — so you can see it actually working before trusting it.

---

## 4. Technology Used

| Part | What we used |
|---|---|
| Page structure | HTML |
| Styling / looks | CSS (hand-written, no framework) |
| Logic / brains | Plain JavaScript (no frameworks like React — just native browser JS) |
| Diagrams | SVG + HTML5 Canvas |
| Optional AI | Google Gemini API (only if you add your own key) |
| Server / database | **None — this is a pure front-end app.** Everything runs in your browser. |

We didn't use any build tools (no npm install, no React, no backend). It's simple on purpose — anyone can open it and see exactly what's happening.

---

## 5. Repository Structure

```
FlowGuard/
│
├── README.md              ← you are here
├── .env.example            ← shows the optional API key format (no real secrets)
├── .gitignore
│
├── src/                    ← all the actual app code
│   ├── index.html
│   ├── css/
│   └── js/
│       ├── ai-engine.js     (Steps 2-3: English → JSON AST)
│       ├── graph-renderer.js (Step 4: draws the diagram)
│       ├── verifier.js       (Step 5: the 5 safety checks)
│       ├── auto-fixer.js     (Branch: explains + fixes failures)
│       ├── simulator.js      (Branch: test-runs a safe workflow)
│       ├── presets.js        (benchmark rules + role/policy config)
│       └── app.js            (wires everything together)
│
├── tests/                  ← our test cases (see below)
│   └── benchmark-scenarios.md
│
├── results/                ← what happened when we ran the tests
│   └── validation-results.md
│
├── docs/                   ← extra documentation
│   └── architecture.md
│
└── assets/                 ← put screenshots / diagrams here before submitting
```

There's no `requirements.txt` or `package.json` — this project has **zero external dependencies** to install. It's plain HTML/CSS/JS.

---

## 6. How to Run This Project

You don't need to install anything.

**Easiest way:**
1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd FlowGuard
   ```
2. Open `src/index.html` in Chrome or Edge.
3. That's it — the app is running.

**If that shows a blank page** (some browsers block this for local files), run a tiny local server instead:
```bash
cd src
python3 -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

**Optional — enable real AI parsing:**
1. Get a free key from [Google AI Studio](https://aistudio.google.com/).
2. Click **🔑 AI Settings** in the app and paste it in.
3. Not required — the app works fully without it. See `.env.example` for the format; never commit a real key.

---

## 7. How to Use the App

1. **Type a rule**, or click a **preset button** to auto-load an example (we included 6 — one correct example, and 5 broken ones, one for each type of mistake).
2. **Pick who is submitting the request** from the role dropdown (Intern, Employee, Manager, etc.)
3. Click **⚡ Translate & Verify Workflow**.
4. Watch it:
   - Show the diagram
   - Run all 5 checks
   - Show a final verdict
5. **If it's Safe ✅** → try the simulator: type in a test order amount, click Run, and watch it play out.
6. **If it Needs Correction ❌** → read the explanation, then check the suggested fixed sentence.
7. Click **💾 Export** anytime to download the workflow as JSON / diagram code.

---

## 8. How We Tested It

Full details in [`tests/benchmark-scenarios.md`](tests/benchmark-scenarios.md) and [`results/validation-results.md`](results/validation-results.md). Short version:

We built **6 test cases** — one correct rule, and one broken example for *each* of the 5 mistake types:

| Test Case | Mistake it contains | Result |
|---|---|---|
| Valid PO Approval | None — clean example | ✅ Safe, 100/100 score |
| Rejected → Re-submit Loop | Infinite loop | ❌ Caught by Check 5.1 |
| VIP Gift Dispatch | Unreachable step | ❌ Caught by Check 5.2 |
| "Someone" approves "high value" orders | Vague wording | ❌ Caught by Check 5.3 |
| Intern approves ₹2,50,000 payment | Wrong permission | ❌ Caught by Check 5.4 |
| ₹6,50,000 order, single approval | Policy/budget breach | ❌ Caught by Check 5.5 |

We confirmed: (1) the right diagram gets built, (2) only the *intended* check fails — not the others by accident, and (3) the auto-fix suggestion, when re-run, comes back Safe.

> **Before you submit:** add real screenshots to `assets/` and drop them into `results/validation-results.md`. A couple of extra rules you tested yourself, beyond the 6 built-in ones, makes this section noticeably stronger.

---

## 9. What's Missing / What We'd Add Next

Being upfront about limits, since every real project has them:

- Our offline rule-reader looks for **patterns**, not true understanding — it's great at rules similar to our test cases, but a totally new style of sentence might confuse it (this is why we added the optional real-AI mode).
- If a sentence has more than one number in it, it only picks up the first one.
- English only, no other languages yet.
- Nothing is saved — refresh the page and your workflow is gone. No login, no saved history.
- The roles and money limits (Manager can approve up to ₹2,00,000, etc.) are hardcoded for the demo, not connected to a real company database.
- The simulator uses fake test data you type in — it doesn't talk to a real payment or approval system.

**What we'd build next:**
- Save/load workflows
- Smarter language understanding (better AI model)
- Export to real workflow tools companies already use (like BPMN/Camunda)
- Support more complex rules with multiple conditions
- Automated testing that runs our 6 test cases automatically every time we change the code

---

## 10. Team Members

| Name |
|---|
| Arkodeep sen  | 
| Bhavesh Raut  | 
| Devansh lakhade |
| Piyush petkar  |


---

## 11. Did We Use AI to Build This?

Be honest and specific here — judges usually check this.

- **Inside the app:** Yes, optionally — you can plug in a Google Gemini API key for smarter rule-reading. It's off by default; the app works fine without it.
- **While coding this project:** _write here exactly what you used._ For example: "We used [tool name] to help write boilerplate CSS and debug errors, but the core logic (the 5 checks, the parser patterns) was written and understood by our team." Fill this in truthfully with specifics — which parts had AI help and which didn't.

