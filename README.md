# Aaron's Rogue Agent Lab

> Three browser-based, fully sandboxed simulations of prompt-injection
> attacks against tool-using AI agents. Built for live demos at
> **DEFCON 2026**.

By [Aaron Ang](https://www.linkedin.com/in/aaronangsg/)

## What's inside

| Module | Attack | Key teaching point |
|---|---|---|
| **Lab 01** | Poisoned Webpage Attack | Retrieved content is treated as instructions |
| **Lab 02** | Tool Response Poisoning | Tool output is trusted like a system prompt |
| **Lab 03** | Agentic Kill Chain | Vector-DB persistence + multi-agent lateral movement |

## Pages

- **`/`** (`index.html`) — Presenter-style slide deck briefing (9 slides, arrow-key navigation)
- **`/app.html`** — Unified lab shell with left-sidebar nav and all 3 modules
- **`/lab1.html`**, **`/lab2.html`**, **`/lab3.html`** — Standalone lab pages

## How to use during a demo

1. Open `/` and present the briefing slides (`→` to advance, `Esc` to skip to lab).
2. End on the "Enter the Lab" slide; click through to `/app.html`.
3. Pick a lab from the left sidebar (or use keyboard: `1`, `2`, `3`).
4. Type the suggested commands into the simulated terminal.
5. Use the on-screen presenter cues (italic blocks under each step) to
   support your narration.

## Safety

Everything is JavaScript in the browser. No real shell, no real network
calls, no real secrets. The fictional `attacker.example` domain is
non-routable.

## License

Educational use. © 2026 Aaron Ang.
