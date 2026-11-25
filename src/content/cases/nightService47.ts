import type { CaseDefinition } from "@/domain/case/CaseDefinition";

/**
 * The first real case. Original content: the places, people and railway are invented.
 *
 * Every answer needs something from each side. The Carriage Inspector sees the
 * train itself; the Line Controller sees only records. Neither can name a person
 * or a place alone — one holds a mark, the other holds the list it belongs to.
 */
export const nightService47: CaseDefinition = {
  slug: "night-service-47",
  version: 1,
  title: "Night Service 47",
  synopsis:
    "An overnight train crosses the Stenn Pass with nine passengers and arrives with eight. One of you is aboard; the other is watching the line from a desk.",
  estimatedMinutes: 20,
  roles: {
    A: {
      name: "Carriage Inspector",
      summary: "Rode the train. Can search the carriages, but has no records.",
      briefing: [
        "Night Service 47 left Harrowmere at 22:40 and reached Calder Vale at 06:14, running over the Stenn Pass through the dark. You rode it as the company's inspector, asleep in carriage A for most of it.",
        "At Calder Vale the sleeping car attendant knocked for berth 7C and got no answer. The berth was empty. The passenger booked into it, listed as R. Maddox, is not on the train and never left it at any station where the platform doors opened.",
        "You have the carriages to yourself until the cleaners arrive at eight. Nobody has touched anything yet. What you cannot do is look anything up: the registers, logs and rosters are all back at the control office, with your partner.",
        "Between you, settle three things. Who was really in berth 7C. Where they left the train. And who opened the door for them.",
      ],
    },
    B: {
      name: "Line Controller",
      summary: "Watched the line from the control office. Has every record, and no train.",
      briefing: [
        "You were on the desk at Harrowmere control all night, following Night Service 47 across the Stenn Pass on paper and by radio. The service ran four minutes down and made one unscheduled stop for a signal.",
        "At 06:20 Calder Vale reported a passenger missing from berth 7C, booked as R. Maddox. Nobody of that name has come forward, and no platform door opened for them between the two ends of the line.",
        "Everything written down that night is in front of you: the booking register, the door logs, the crew roster, the engineering notices. What you have never seen is the train. You cannot look inside a carriage, and the cleaners board at eight.",
        "Between you, settle three things. Who was really in berth 7C. Where they left the train. And who opened the door for them.",
      ],
    },
  },
  evidence: [
    {
      id: "berth-7c",
      heldBy: "A",
      name: "Berth 7C",
      summary: "The empty sleeper compartment, still made up for the night.",
      details: [
        "The bunk has not been slept in. The blanket is folded the way the depot folds them, and the pillow is square.",
        "A grey travelling suit hangs behind the door, pressed and left behind. Inside the collar there is a laundry tag stitched in red thread: N. F.",
        "The ticket is in the ashtray, torn once across. It reads R. Maddox, berth 7C, Harrowmere to Calder Vale. The suit and the ticket do not agree with each other.",
      ],
    },
    {
      id: "vestibule-c",
      heldBy: "A",
      name: "The vestibule of carriage C",
      summary: "The space by the service door, between carriages C and D.",
      details: [
        "There is grit tracked across the floor plate and nowhere else in the carriage. It is coarse and red, like crushed brick, and shot through with flecks of blue-green slag. Every yard we have walked this year has been grey stone.",
        "The service door's safety catch has been wedged back with a folded card, jammed in hard enough to score the paint. The catch cannot engage while the card is in place.",
        "The card is a crew duty slip. The name has been torn off the top, but the issuing stamp is intact and reads 214.",
      ],
    },
    {
      id: "attendant-sheet",
      heldBy: "A",
      name: "The attendant's round sheet",
      summary: "The hourly walk-through sheet for the sleeping car, signed each round.",
      details: [
        "The sleeping car attendant signs the sheet at the end of every hourly round. The 01:00 and 02:00 rounds are signed in the same quick hand.",
        "The 03:00 round is blank. Not crossed out, not initialled late. Blank.",
        "The 04:00 round is signed again, and the pen has been pressed harder than on the earlier lines.",
      ],
    },
    {
      id: "dining-car",
      heldBy: "A",
      name: "Table four, dining car",
      summary: "A table cleared by nobody, at the far end of the dining car.",
      details: [
        "Two cups, both used. Two people sat here late, long after the kitchen shut.",
        "Under one saucer there is a note in pencil, unsigned: \"If anyone asks for me at the Vale, I was never on this train. Thank you for this. You know what it costs you.\"",
        "There is no bag, no coat and no second ticket. Whoever sat here came with nothing and left with nothing.",
      ],
    },
    {
      id: "booking-register",
      heldBy: "B",
      name: "The booking register",
      summary: "How berth 7C was paid for, and by whom.",
      details: [
        "Berth 7C was booked four days ahead in the name R. Maddox. No address, no telephone, no return leg.",
        "It was not paid in cash. It was put against a staff concession account, which the company issues to railway employees and their households.",
        "That concession is shared by three people this quarter: Dale Orsk, Nia Faro and Pieter Hall. The register records the account, never which of the three used it.",
      ],
    },
    {
      id: "door-log",
      heldBy: "B",
      name: "The door log",
      summary: "Every door on the train, every time it opened, to the second.",
      details: [
        "At the five scheduled stops the platform doors opened and closed as they should, and the counts of passengers off and on balance at each one.",
        "Between stops there is one entry. The service door of carriage C opened at 02:48 and stayed open for ninety-four seconds.",
        "The train was stationary at the time, held outside a signal. The log records that it was halted but not where: signal stops are not booked to a place.",
      ],
    },
    {
      id: "ballast-notice",
      heldBy: "B",
      name: "Engineering notice 1144",
      summary: "What the permanent way gangs laid on this line, and where, this month.",
      details: [
        "The notice lists every site relaid this month. Almost all of them took the usual grey stone, which is what the whole route runs on.",
        "Two did not. Dunmoor Loop took clean red granite from the Aldwick quarry. Kestrel Siding, on the Stenn Pass climb, took red granite cut beside the old smelter, which the notice warns is fouled with blue-green slag and should be washed before use.",
        "Red granite crushes finer than grey and carries badly. The notice warns gangs that it tracks onto boots and into vehicles.",
      ],
    },
    {
      id: "crew-roster",
      heldBy: "B",
      name: "The crew roster",
      summary: "Who worked the service, and under which staff number.",
      details: [
        "Staff are booked on by number, not by name, and the roster is the only place the two are written side by side.",
        "On Night Service 47 that night: 214 Teodor Vance, sleeping car. 219 Mira Holt, dining car. 230 Anders Crale, guard.",
        "Vance has worked the Stenn Pass sleeper for eleven years without a mark against him.",
      ],
    },
  ],
  puzzles: [
    {
      id: "who-was-in-7c",
      name: "Who was in berth 7C",
      prompt:
        "The ticket says R. Maddox and nobody of that name exists. Give the full name of the person who actually travelled in berth 7C.",
      requires: ["berth-7c", "booking-register"],
      check: {
        kind: "exact-text",
        accept: ["Nia Faro", "N. Faro", "N Faro", "Faro"],
      },
      hints: [
        "The compartment holds something marked with initials. The register holds a short list of people, and no initials.",
        "Only one of the three people sharing that concession account has the initials stitched into the collar of the suit.",
      ],
      solvedNote:
        "Nia Faro travelled under a name that belongs to nobody, on a concession that could be traced to her household only if someone thought to look.",
    },
    {
      id: "where-they-left",
      name: "Where they left the train",
      prompt:
        "No platform door opened for them. Name the place where they got off.",
      requires: ["vestibule-c", "door-log", "ballast-notice"],
      check: {
        kind: "exact-text",
        accept: ["Kestrel Siding", "Kestrel"],
      },
      hints: [
        "One door opened between stations, at a stop that was never booked to a place. The vestibule it opened from is not clean.",
        "Two sites on the route are laid in red. Only one of them has anything else mixed into it.",
      ],
      solvedNote:
        "She stepped down at Kestrel Siding at 02:48, while the train stood at a signal on the climb, and walked off across fresh red ballast.",
    },
    {
      id: "who-opened-the-door",
      name: "Who opened the door",
      prompt:
        "The service door was wedged from the inside. Give the full name of the crew member who did it.",
      requires: ["vestibule-c", "attendant-sheet", "crew-roster"],
      check: {
        kind: "exact-text",
        accept: ["Teodor Vance", "T. Vance", "T Vance", "Vance"],
      },
      hints: [
        "Whatever held that catch back came off a crew member, and it still carries the only part of them the railway writes down.",
        "One hourly round was never walked. Match the number on the wedge to the roster.",
      ],
      solvedNote:
        "Teodor Vance wedged the catch with his own duty slip, missed the 03:00 round while the door stood open, and told the control office at 02:52 that everything was secure. Eleven clean years, and he spent them on a stranger who left him a note under a saucer.",
    },
  ],
};
