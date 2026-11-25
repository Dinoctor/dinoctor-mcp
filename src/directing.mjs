// How Dinoctor's own editor directs a video: the owner's taste, written down from her own words (2026-11-24) and her
// films (the Eiffel Tower documentary, the Tesla explainer). The MCP hands it to Claude before it makes a video, so a
// person who only says "make a documentary about X" gets a film directed her way. It is a way of thinking, not a
// template: every film should still look like its own.

export const DIRECTING = `# Directing a Dinoctor video (read this before you build)

These are the rules of the editor who made Dinoctor. Follow them unless the person asks for something else. They are
a structure, not a template: keep every film different (its worlds, presets, transitions and surprises), never the
same recipe twice.

## 0. Story first: script, then idea, then shots
- A video is a story, not a row of pictures. Before you build anything, have the words: the person's script (with
  their voice if they made one), or a script you write with them. Without a script a film feels random.
- Then think it through like a director and write the idea down for yourself: the hook, the beats (one per line or
  thought), the turn, and the ending. For EVERY beat decide what the shot SHOWS: the hero's state, what else is in
  the frame (an object, a document, a chart, a second person, a place), the important word, the world, the light
  and the camera move. Only then build.
- Every shot needs a reason to exist and something new in it. The same figure standing in five shots with only the
  background changing is not a story.

## 1. The picture follows the script
- Build the film from the script, line by line. Each line is a beat. Ask: what does this sentence SHOW?
- When the voice names a person or a thing, show it at that moment: the man when "a man" is said, the Eiffel Tower when
  "the Eiffel Tower" is said. Time entrances to the spoken word (direct_cast at, set_text at, set_element enter).
- When the voice talks about something you have no picture for, show a word instead: a preset with a short, strong
  word (like a yellow box with "TWICE"). Use the exact word, or something related, accurate and fun or serious to
  match the film's subject (she put "BIG MONEY" over a line about money). Every film is a visual story made from the
  script, not pictures dropped next to it.
- MAPS ARE FULL SCREEN, IN THEIR OWN SHOT (owner, 2026-11-25): a map fills the whole frame (options size "full") as its
  own shot or moment, and the person comes in the next shot. Never a map card over or beside the person, blocking
  them. The map's colours follow the palette (options look "dark" or "night" for dark palettes, accentColor = the
  palette's accent); never a tan or brown map unless the palette is brown, paper or vintage.
- PLACE AND DATE ARE ALWAYS A PRESET: "Ohio, 2007", a city, a date or a year is shown with a place or date preset
  (dc-place "Place label", dc-set-date "Big date card", dc-year "Year ticker", the dc-ch-* chapter cards), never as
  plain typed text in a plain font. The same for the big words of a shot: use a word preset (dc-giant-word,
  dc-behind-word, dc-impact, dc-slam, dc-pill, dc-tape) rather than plain text.
- When the script names a country, a city or a journey, use the "Real map" preset (dc-ex-realmap): its words are a
  place ("Iran"), several places ("Iran, Iraq"), or a route with > between stops ("Southampton > New York"). It draws the
  real borders and the real path. Give a journey a traveler (options traveler: ship, plane...).
- When the script gives numbers or statistics, use a chart preset (add_preset: "presets" has charts, bars, counters)
  for that shot.
- Combine things: a person, an object, a word and an effect together make a shot. Ideas from her films: the person
  slides to one side as a second person or a chart comes in; a newspaper, a stamp ("Denied", "Accepted", "Official"),
  a document or a photo arrives as the voice mentions it.

## 2. The hero and the frame
- The hero (the main person or object) is BIG and clearly visible, and the face is never cut or covered. Centred is
  the home position, NOT a rule for every second: the camera zooms into the hero, pans so the hero goes to one side,
  pulls back to a wide shot; the hero can enter the screen. Centre is where a shot often starts or ends, not where
  everything stays.
- Use the rule of thirds for everything else. When the camera pans the hero to one side, the empty side gets the
  important word, a preset or an explainer.
- SIZES HAVE CONTRAST. Nothing is the same size as everything else:
  - wide shot: people smaller, the place and big objects bigger;
  - close-up: the person big, words, stickers and labels smaller;
  - two stickers or words in the same shot: one clearly bigger than the other.
- Explainers, charts and stickers sized to the scene, never covering a face or the hero object. An explainer that can
  go without its background goes without it (ground "none") over the scene.
- ORGANISED, NEVER MESSY: few things at once, lined up, with space around them. Centred things are exactly centred
  (x 50, y 50). A picture card or explainer either fills the whole frame or is a smaller card exactly in the middle
  with rounded corners (cards smaller than the frame round their corners by themselves; never move them off-centre
  by accident).
- Every rectangle has rounded corners: cards, boxes, panels, frames.
- A word or object may sit behind the hero (visible enough) or in front of things, but NEVER covers a face. Words
  never sit on top of the captions. Words appear only while the voice is talking about them, not before.

## 3. Pace: vertical is fast, horizontal is calmer
- Vertical (9:16) films are for Instagram Reels, TikTok and Shorts: FAST. Quick camera keys, short shots, things
  arriving and changing often (her Eiffel Tower reel is this pace). No pauses.
- Horizontal (16:9) films are for YouTube: shots are LONGER. Calmer camera moves, keyframes further apart, one shot
  often holding a whole thought (10 to 20 seconds) while things happen inside it. The intro (cold open) can be a bit
  faster than the rest.
- The camera follows the script's speed: a slow line gets slow moves, a fast line gets fast changes of perspective.
- This is the pace of everything: keyframe timing, how often shots change, how fast things come in. Check the
  project's format (get_project) before you plan the moves.

## 4. How a film opens
- Vertical (reels, shorts): OPEN with a zoom in or a zoom out as the hook (for example: tight on the face, then out to
  the full figure). Fast, from the first frame.
- Horizontal documentaries (YouTube): the opening is SLOW in pace (the camera still moves, but there is no hook zoom).
  It sets a mood first and is the most creative moment of the film. Pick an opening that fits THIS film's subject;
  never the same opening as the last film. Ways she opens (examples to spark ideas, not a list to choose from):
  - a slow fade in from black;
  - real footage of the subject first (a video clip, an archive shot);
  - a TV in a room, playing a news report or footage about the subject, before the camera goes into it;
  - black bars that open, while the date, time, city or the situation types on (typewriter) over the dark;
  - something else that suits the story: invent one. The rule is the slow, mood-first start, not the form.
- The first words on screen (a date, a place) always type on, typewriter style.

## 5. The camera: one continuous move
- The camera always moves, as if the whole scene were one shot: seamless, never a dead stop. Always a little handheld
  wiggle (set_camera wiggle about 0.15 to 0.25); a very still, factual scene can take a bit more, never a lot.
- Easing is tight: slow start, FAST middle, slow end. Give camera keys a bez curve like [0.8, 0, 0.2, 1], not a
  plain "smooth".
- When something comes in during a camera move (the tower as the camera zooms), it moves in with the SAME easing and
  speed as the camera, starting off screen, so everything arrives together. Nothing pops in from nowhere unless it is
  meant to be a fun "pop".
- Play with focus to point at what matters (Documentary set_camera focus; set_keyframes on "dof:shot"): something
  near the camera sharp and the background soft, then, as the script moves on, pull focus so the far thing is sharp
  and the near thing goes soft.

## 6. Backgrounds: never show an edge
- ALWAYS check the background is big enough for the camera move. A zoom out or a pan must never show the edge of the
  background picture. Scale it up (set_keyframes on "backdrop:shot" scale, or a bigger place) until it covers the frame
  for the whole move, then check with look_at_shot at the start, middle and end of the shot.

## 7. Colour palette and worlds
THE PALETTE IS LAW.
- Ask for the palette if the person didn't give one (in your questions). Then use ONLY those colours, in everything:
  worlds, lights, words, presets, stickers, labels, charts, effects, accents. No other colour appears, ever: no blue
  sticker in a black and yellow film. Set every preset's color and accent to the palette (set_text color / accent),
  and choose worlds and lights in the palette's colours.
- What a word means:
  - "yellow": yellow and black, white now and then.
  - "red": red and black, white now and then.
  - two or three colours named: only those, plus black and white for text when needed.
  - "neon" / "cyberpunk": neon colours (magenta, cyan, violet) on deep dark, light rims, glow, atmosphere.
  - "vintage": faded warm colours: sepia, cream, brown, muted red, soft black.
  - "paper" / "paperish": cream and brown paper, black ink, one accent colour; paper texture.
- Each look has its own taste (use a little, not everywhere, and only with a reason):
  - Paper: Brown card (dw-kraft) and Paper yellow (dw-paper-yellow) are its two worlds. A little wiggly line
    (set_look warp, very low), light grain, TV lines now and then (element oldtv), paper bits or boiling paper
    (boilpaper) for texture.
  - Vintage: Old film (dw-film-noir), Old map (dw-parchment), Newsprint (dw-newsprint); grain, dirt specks
    (specks), film burn (burn) on transitions, choppy film (set_look hold) now and then.
  - Cyberpunk / neon: Neon night (dw-neon), Dark cinema (dw-dark-cinema); light rims on people, glow, lights with
    colour, rain (rain, lensdrops) sometimes, not all the time; scanlines or TV static now and then.
  - Serious / explainer: few effects, and only with a reason (fog for a sad moment, sparks for danger). A clean,
    calm background behind serious words, never a busy one.
- NO BROWN unless the palette asks for it (brown, vintage, paper, sepia, warm wood): never a brownish world or
  background (Gold's brown pattern, Brown card, Evidence board, Warm studio, Old map, Paper yellow) in a navy, red,
  yellow, neon or any other palette. Brown muddies every colour on top of it.
- BACKGROUNDS ARE SIMPLE: a clean, near-plain world (a soft gradient, a light texture at most) so the eye goes to
  the hero. Patterned or textured worlds (fans, lattice, cork, grids, heavy grain) only when the look asks for it, and
  then with very little texture.
- BUSY BACKGROUND = FEW THINGS. If the background is busy (a photo, a generated picture, a patterned world), the shot
  gets only the hero and ONE word or sticker in a colour that contrasts strongly with it. No effects, no extra cards.
  If the background is simple and empty, then effects, elements, samples and more things can come in.
- CONTRAST AND TASTE IN TEXT: every word must stand out from what is behind it: light words on dark, dark words on
  light, and the palette's strongest accent (never a pale tint of it: no light red on brown, no pale gold on cream).
  If a word doesn't pop at a glance, change its colour or the background.
- Cards and checklists are big enough to read at a glance: at least a quarter of the frame wide, a few big words,
  not a tiny box with small print.
- WORLDS PER SCENE: pick 2 or 3 worlds for a scene and stay with them; never a new world every shot. One of them can
  be for the b-roll shots (b-roll is not in every shot). The worlds CONTRAST: after a yellow world a red one, after a
  light world a darker one, while all stay inside the palette.
- PEOPLE KEEP THEIR OWN COLOURS: the world colours the background, never the people (shot moves set this). Faces
  stay natural, with colour and contrast, never pink, washed out or grey (black and white only as a deliberate look
  for a whole shot). A light on the face, not a tint over it.
- A LITTLE LIFE IN FRONT: most shots get low, see-through fog along the bottom in front of the people, some get a few
  slow sparks. Very little: it makes the scene feel alive, it never hides anything. Shot moves add it.
- CAPTIONS: they may sit over a body, never over a face. If a caption covers a face, frame the face higher. Wide
  films: at most 5 words a line. Tall films (reels): at most 2 words a line, above Instagram's buttons (about y 72).
- REELS: every shot gets a shot move (short versions from 2.5 s; a drift when nobody is in the shot). A shot of
  words alone is empty: always show what the line is about, and keep something on screen the whole shot.
- CINEMATIC MEANS CONTRAST, NOT DARKNESS: a dark background with a well-lit subject. Never a murky shot where
  everything is dark. If a shot reads dark, raise the light on the subject first.
- Loud or tech worlds (neon, code green, pink, orange, violet, red and blue split) only when the palette or subject
  calls for them: never a cyberpunk shot in a history documentary.
- Grain is a seasoning: off in most shots, low when on (10 to 20).
- Light can move (set_light, then set_keyframes on "light:<id>"): darken the scene a little, then let the light
  travel to what the script is about, brighter as it arrives. Play with light sometimes, not in every shot.

## 8. Effects (set_element)
- Every shot gets a little moving life, CHOSEN FOR WHAT IS HAPPENING. Search library "elements" (about 130) and pick
  the one that fits the line, not the same one every time. Shot moves add a low fog or a few sparks as a default
  when a shot has none: replace it (set_element change or remove, then add) whenever something fits better. Ideas:
  - money, a win, a loss: falling money, money circling, bills bursting;
  - the past, memory, archives: dust, dirt specks, film burn, old TV lines;
  - loss, death, sadness: slow rain, falling ash, mist, a shadow passing;
  - danger, a shock, a verdict: embers, lightning, a light burst, a shockwave ring;
  - night, cities, casinos, neon: bokeh lights, glow motes, light beams, a light leak;
  - police, crime, the law: police lights, a spotlight sweep;
  - paper, documents, news: paper bits, pages bursting, boiling paper grain;
  - cold, lonely: snow, blizzard, wind-blown mist; warm, hopeful: sun rays, a warm light leak.
- Always LOW and slow: see-through, a small amount, never covering a face or the words. On a busy background, at most
  one very light effect (or none).
- When something serious or emotional happens: fire, sparks, dust, mist or fog to make the scene alive.
- Effects are never too fast, too big or too small, and never sit in the middle of the frame. Spread them over the
  whole screen, or along the bottom for mist, fog and fire.
- A light line wiggle (set_look warp, very low), a TV effect, black-and-white word presets, a little grain now and
  then (set_look grain, low). Bars (letterbox) sometimes, keyframed in or out; sometimes none.
- Use presets often: papers, newspapers, stamps ("denied", "accepted"), labels, charts, important-word presets.

## 9. Transitions
- Use the cool transitions: they are a big part of the look and were barely used. Browse library "transitions" and
  pick ones that fit the moment and the look: through the window, whip with blur, zoom through, magnifying glass,
  shot becomes a photo, fly into a screen, page turn, torn paper and crumpled paper (paper looks), ink splat and ink
  ring (the past), light sweep and white flash (reveals), glitch tear and TV switch off (tech, neon), film strip roll
  (vintage), punch in cut (a hit). Most changes are still cuts or camera moves; a real transition at each change of
  place, time, mood or section, and a different one each time.
- Transitions that open from a point (magnifying glass and others) open on the person's FACE, or on the hero object
  if there is no person (set_transition point).

## 10. People and their moves (direct_cast)
- Actions only sometimes, when they fit the moment: a "pop" for fun, light moments; never on every person in every
  shot.
- People pictures: check the rig. Head moves (head tilt, talking head) are safe; prefer them. Use arm and body moves
  only when the picture has the hands clearly apart from the body and the rig is clean. Otherwise stay with the head.

## 11. Important words
- When the voice says something important, show it as a big word with a preset (the exact word, or a related one
  that is accurate, and fun or serious to fit the film).

## 12. The story happens INSIDE the shot
- Visual storytelling is not changing shots back to back. One person, a caption, a small camera move and one sticker
  is NOT a shot. Often the best storytelling is one longer shot where the camera travels through the story. For
  example, a 15 second shot:
  1. the camera zooms into the person's face;
  2. it pans so the person goes to the left, and the empty right side gets an important-word preset; it holds about
     a second (slow script: slow; fast script: fast);
  3. the camera pulls back to a wide shot and other objects come into the screen;
  4. it zooms into one of those objects, which has its own sticker or explainer (a chart, a map, a document);
  5. the camera changes perspective to another thing and shows it.
- NEVER SPLIT A LINE INTO SHORT SHOTS in a wide film: "something new on each word" means things ARRIVE INSIDE the
  long shot (shot_move, entrances, words on their word), not cutting the shot into 3-second pieces.
- The shot_move tool builds these camera stories for you from the shot's hero, its other things and its words
  (spotlight, entrance, reveal, orbit, compare). Use it on most shots, a different move each time, then adjust.
- Build the scene in your head first, so every move and every arrival makes sense with the script.
- Play with the camera sometimes (zoom in, zoom out, pan, change perspective, follow something entering), with focus
  and depth of field (keyframe the focus: set_keyframes "dof:shot"), with blur (keyframe a word's or card's blur on
  its entrance or exit), with light. Sometimes, not all of them in every shot.
- KEYFRAMES ALWAYS EASE (only very rarely linear). Mostly an easy ease (bez [0.8, 0, 0.2, 1] or ease "inOut"); now
  and then ease in or ease out alone.
- Charts and explainers can live in the same shot as the person, without a background, beside them.
- Bring things in: the objects the story mentions, a chart for numbers, a newspaper or document for news, a stamp for
  a verdict, a second person for a meeting. Use stickers and explainers, and sparks, fog, mist or dust for cinematic
  moments.
- Across the film: a surprise every few shots, and the ending feels like an ending (a pull back, a name, a date, a
  final word).

## 13. The pro documentary craft (studied from the top faceless documentary channels)
These are how the best documentary channels on YouTube build every minute. Do all of them.

STRUCTURE
- Cold open (the hook, 45 to 90 seconds): it starts the owner's way (section 4: a slow, mood-first first few
  seconds, the date or place typing on), then builds speed through the most dramatic moments of the story. Then about one second of
  black, a title card (the film's name, big), another breath of black, then "Chapter 1: <name>" (presets dc-chapter
  or the dc-ch-* chapter cards). Every new chapter gets its own chapter card.
- Turning lines ("But", "Then everything changed", "Here's where it gets strange") get a full-screen big word
  (dc-giant-word, dc-slam, dc-impact) on its own beat.
- The ending of a section pulls back or fades; the ending of the film lands on a name, a date or one final word.

FRAMES ARE FULL
- A picture card (a picture put in as media becomes a card, dc-nested) either FILLS the frame (x 50, y 50, size 1,
  nothing of the background showing around it) or is clearly a smaller card (size 0.55 to 0.8, a visible border or
  shadow) over a full background of its own. To show a photo from the project's Media full-frame, make it the shot's
  background: set_place picture: <its id or name>. Never a nearly-full card pushed off-centre that leaves dark strips at
  the sides: that reads as a mistake. People's photos look best filling the frame.
- Every frame has something to look at behind the words: the person's picture, a place, a map, a document, a
  textured world. Words alone on plain black only for a title, a chapter card, or one single turning beat.
- A person is never cut at the head: frame head and shoulders, waist up, or full figure. Never a headless torso,
  never only a jacket. If a picture is cropped that way, scale it down or move it until the face shows.
- People are BIG, and BIG MEANS THE FACE: waist up or head and shoulders, the face in the upper third of the frame,
  the top of the head just inside the frame (5 to 15 percent from the top), the body filling 60 to 90 percent of the
  height. Zooming into a photo until only the chest or the jacket shows is the opposite of this: if the face is not
  in the picture, it is wrong, whatever else is right. Put people's photos in as cast members (put_picture as
  character, then set_cast size and y) so you control where the head is, rather than as a full-frame background that
  the camera crops; and keep camera pushes small on people so the head stays in. A small full figure in the middle of an empty
  frame looks amateur: use the full figure only once, to introduce someone or show them alone in a big place.
- A word behind a person must still read: put the person to one side (a third of the frame) and the word across the
  other two thirds, or make the word so wide that the person covers at most one letter. Check it in look_at_shot:
  if you can't read the word in the picture, move the person or the word. The same for signs, dates and neon: never
  hide a word behind a building or a person.
- Words need a calm place to sit. Never put a word, a date or the captions straight over busy detail: handwriting,
  printed text, signs, logos, patterns or bright lights. Put the word on a plate (dc-pill, dc-tape, dc-lower,
  dc-keyline), move it to an empty part of the picture, or darken that part (a dark gradient or dim the picture).
  Never stack your word on top of a sign or text that is already in the picture.
- Captions keep their plain caption style (white words, a soft shadow, one or two lines). If the picture behind
  them is busy, darken the bottom of the picture (a dark gradient, a darker world or light) rather than boxing each
  word: boxes around every caption word look cluttered.
- Every label, tag and card sits fully inside the frame, at least 5 percent from every edge, for the whole shot.
- Giant words fit the frame: a big word (dc-giant-word, dc-slam, dc-impact) is checked at its biggest moment (the
  middle of its animation) and must show every letter. If letters run off the sides, shorten it (one or two words)
  or make it smaller.

PACE: CHANGE THE SHOT, DON'T ONLY CUT
- They cut less than you think (often 5 to 10 seconds between real cuts) but something NEW arrives every 1.5 to 3
  seconds: a word, an object, a label, a second person, a chart, a camera move to a new framing. Build long shots that
  keep changing (things enter on the spoken word, the camera moves to them) instead of many static shots.
- Hook: something new every 1.5 to 2 seconds. Story sections: every 2 to 4 seconds. Calm reflective lines may hold
  4 to 6 seconds with only a slow camera push and a light moving.
- When the script is already cut into one shot per line, make neighbouring lines about the same subject feel like
  ONE continuing shot: the same background and picture, the camera carrying on from where the last one stopped, and
  only the new thing arriving. Change the background only for a new place, time or mood.
- Every noun, name, number, place and date in the script gets a visual at the moment it is spoken (within half a
  second). "Britain, Portugal and Holland" = three flags arriving one by one on each name. "South Africa" = the real
  map. "Thousands of diamonds" = diamonds pouring in. "Profits went up" = a chart rising behind the person.
- Turn figures of speech into pictures: "his heart began to race" = a glowing red heart over his chest; "the walls
  were closing in" = dark shapes moving in; "money poured in" = falling money (element moneyfall).

COLOUR (the most important part of their look)
- BEFORE YOU FINISH, measure: look_at_shot on at least five shots spread through the film and read info.light. If
  most are under brightness 65, the whole film is too dark: raise every shot (set_look whole_scene: curve brightness
  +6 to +12, shadows +0.05, vignette no more than 55) and measure again. Do not end with a dark film.
- MEASURED on their films, and look_at_shot gives you the same numbers (info.light): brightness 70 to 95, darkest
  25 to 45 (blacks lifted, never crushed to pure black), brightest 150 to 200, colour 10 to 35. Dark and cinematic
  is mid-dark with contrast, never a black frame. If a shot measures brightness under 60 or darkest under 15: brighter
  world or background, more light on the subject, set_look curve shadows up a little (0.04 to 0.1) and brightness up,
  then look again. Pure black only for the second of black before a title or chapter card.
- ONE locked palette per film: the subject's own colours (the brand, the country, the era) or one mood, as two
  colours plus black and white. Every world, light, word and effect uses only those. Example: a bank story in deep
  blue and cyan with one red accent; an airline in its blue and yellow; a casino in dark navy, gold and one red.
- A strong grade: deep shadows, high contrast (set_look curve contrast 15 to 30), dark corners always (vignette 40 to
  60), a little glow on lights. Grain light (10 to 18) and only on some shots.
- History and the past: desaturated, sepia or black and white (light dc-mono or dc-amber, world dw-film-noir,
  dw-parchment, dw-newsprint). Danger and the turn: shift the grade to red or a cold teal for that moment, then back.
- People's photos are often black and white or tinted to the palette, standing on a coloured background.

WORDS ON SCREEN
- Key ideas as huge bold condensed words, two to four words at most, filling 60 to 90 percent of the width, often
  BEHIND the person (dc-behind-word, dc-giant-word, dc-impact): the person stands in front of their own headline.
- A person's name: a bold name card at the lower left (dc-lower), arriving with them.
- Dates and places: typewriter on, or a huge year behind the person (dc-ch-bignum, dc-year, dc-set-date, dc-place).
- Claims and news: a real-looking headline or article (dc-clip, dc-page, dc-ex-scroll, dc-ex-news) with the key
  phrase highlighted (dc-marker) while the camera pushes into it.
- Never more than one big text idea at a time. Captions stay small and low.

OBJECTS, MAPS AND DATA
- Maps whenever a place or journey is named: the Real map presets (dc-ex-realmap, dc-ex-realregion, dc-ex-realroute).
  They know every country, every US state ("Ohio", "West Virginia") and 34,000 cities: "Ohio, West Virginia" lights
  both states; "West Virginia: Wheeling" pins a city in a state; "Pittsburgh > Wheeling" draws the trip.
- Numbers: counters (dc-count, dc-scramble, dc-heronum), charts that rise behind the subject (dc-ex-line, dc-ex-peak,
  dc-ex-bars), money (elements moneyfall, moneyswirl, billburst).
- Documents, phones, notifications, emails and screens for evidence (dc-ex-notify, dc-ex-email, dc-ex-chat,
  dc-ex-monitor, dc-redact). Stamps and marks for verdicts (pb-stamp, pb-ban, pb-marker-circle).
- Two people compared or meeting: side by side (dc-split-talk, dc-set-two), each half the frame.

CAMERA AND LIGHT
- The camera never rests: slow push-ins on faces and documents (dc-push, slow-push, hero-push), parallax drifts on
  layered pictures (story-layer-drift, parallax-slide), a fast move or punch-in on the punch word (dc-punch,
  crash-zoom, story-step-zoom), and moves ACROSS a map from one place to the next.
- Light tells you where to look: rim and back light on silhouettes, a spot or light beams on the subject (elements
  beams, spotlight, rays), lens flares and light leaks on reveals (leak, flare). Light moves to what the voice names.

TRANSITIONS (match them to the script)
- Most changes are cuts or camera moves on the beat. Use a real transition only at a change of time, place or mood:
  ink or smoke (ink-splat, smoke-roll, ink-ring) going into the past; white flash or light leak (flash-white,
  light-dissolve, color-leak) for a reveal; glass or crack (crack-open, shard burst) for a shock; fade to black or
  dip (fade-black-blur, dip) before a title or chapter card; match moves (match-zoom-in, match-pan-left) to carry a
  shape from one shot to the next.

## 14. Check your own work
- After each shot, look_at_shot at its start, middle and end. Check: the hero is centred and the face is clear,
  nothing covers a face or the captions, no background edge shows, entrances match the voice, and the camera keeps
  moving, the subject is bright enough, grain is light.
- Then watch the film's flow: worlds that belong together, a surprise every few shots, and no two films built alike.
`;
