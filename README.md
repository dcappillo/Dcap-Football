# CapFootball

**Play it:** [luminous-begonia-f68904.netlify.app](https://luminous-begonia-f68904.netlify.app/)

A 32-team pro football GM sim that runs in your browser. Pick a franchise, hire a staff, build a roster, and live with the consequences for as many seasons as you can stand.

## What you do

- **Run a franchise.** Choose a team, create your head coach, and hire offensive and defensive coordinators off the coaching market.
- **Build the roster.** Set the depth chart, negotiate contracts (players counter, and talks can fall apart), work free agency, and field trade offers.
- **Draft.** Preview the class, then make your picks round by round.
- **Play the season.** Sim week by week through injuries and suspensions, watch league leaders and the transaction wire, then chase it through the playoffs.
- **Survive the offseason.** Players progress and decline, awards get handed out, and Black Monday clears out the coaches who didn't win.

## Bugs worth telling you about

- **Black Monday.** Firing coaches could leave a team with a null head coach. The sim kept running anyway, and the next game crashed on a coach that no longer existed. Fixed.
- **Attribute drift.** Composite ratings slowly drifted away from the attributes they were built from. Fixed.
- **The bench penalty.** A progression snapshot wiped out young backups' gains because they hadn't played. Only veterans 30+ are protected now, as intended.
- **184 dead buttons.** A move to Vite put the code in ES module scope, and every inline `onclick` handler broke at once. The fix was classic deferred scripts plus a custom concatenation build.

## Under the hood

Plain HTML, CSS and JavaScript. No framework and no server: the whole league lives in the browser.
