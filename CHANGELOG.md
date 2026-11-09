# Changelog

## 2026-11-08 (Meta ad videos)
- Added media/ads/ad1-loss, ad2-1pct, ad3-rate, ad4-hidden (.mp4): the four test Shorts with the ending changed from "Link in bio" to "Tap Learn more" for paid ads. build_short.py takes END_TEXT for the end card.

## 2026-11-08 (calculator update)
- rental-calc/ updated from the Rental-Income-Calculator repo: pitch line, FREE badge, result-first deal links, anonymous usage counts, privacy policy update. /deal/ links now add deal=<name> so the counts show which example a visitor came from.

## 2026-11-08 (ad landing links)
- Added /deal/<name>/ short links (maple-loss, maple, oak-1pct, birch-rate, pine-hidden). Each opens the calculator pre-filled with the exact deal from a Short, so an ad click lands on the same numbers the video showed. Extra query text (like utm tags) is passed through. They are noindex redirects, so they are not in sitemap.xml.

## 2026-11-08 (recap Short)
- Added media/shorts/equityfoundry-short-recap.mp4 (11/22 two-week recap, built from result screens of earlier Shorts). Rate Short title split to three lines so it fits.

## 2026-11-08 (Shorts batch 2)
- Added 10 Shorts to media/shorts/ (str_slow, brrrr2, flip2, flip3, capcoc, rate, hidden, dscr, duplex, strltr) for the 11/12 to 11/21 calendar. New rec_short.js scenarios; voice by tools/video/gen_voice.py (handles Airbnb as Air + bee en bee). The planned 'offer finder' Short for 11/21 was swapped for the flip-delay Short because the app has no offer finder for long-term rentals.

## 2026-11-08 (Shorts)
- Rental Shorts re-rendered with the clean end banner and renamed -v2 (Metricool keeps its own copy of media, so scheduled posts had to be updated by hand). Added the Wednesday 1% rule Short (media/shorts/equityfoundry-short-onepct.mp4; rec_short.js scenario onepct).

## 2026-11-08 (two more educational videos)
- Added media/edu/equityfoundry-edu-good-deal-5-numbers.mp4 (cash flow, cap rate, cash-on-cash, DSCR, 1% rule on a $250k rental) and media/edu/equityfoundry-edu-70-percent-rule.mp4 (fix-and-flip 70% rule, tested at three offers and a lower sale price). All numbers come from the calculator. Sources in tools/video/edu_g, edu_f and gen_edu.py.

## 2026-11-08 (BRRRR video)
- BRRRR video refinance scene redrawn (one stacked bar plus three rows; the small closing-cost bar was unreadable). File is now media/edu/equityfoundry-edu-brrrr-explained-v2.mp4.
- Added educational video "BRRRR Explained" (media/edu/equityfoundry-edu-brrrr-explained-v2.mp4); sources in tools/video/edu_brrrr/. Numbers come from the calculator (150k buy, 45k rehab, 260k value, 75% refi: cash left $17,844). Voice says BRRRR as the plain word "burr".

## 2026-11-08 (edu video)
- Added media/edu/equityfoundry-edu-str-5-numbers.mp4 (educational video, "Air bee en bee" pronunciation locked at speed 1.15; BURR is spoken as the plain word "burr").

## 2026-11-08
- Educational video: "B N B" in Air B N B spoken ~30% faster (voice line 1 built in three chunks, middle at speed 1.3).
- Video end cards: removed the navy rectangle around the EquityFoundry logo (keyed logo). Re-rendered the Mon/Tue rental Shorts; same file names, so scheduled posts pick them up. Educational video: "Airbnb" now spoken "Air B N B" (air-bee-en-bee) with the clean end banner.

## 2026-11-08 (educational video pilot)
- Built tools/video/edu: animated graphic explainer pipeline (stage.html scenes, render.js frames, assemble.py). First video: 'The 5 numbers that decide a short-term rental' (2:19). Not published yet; waiting on owner review.

## 2026-11-08 (calendar Shorts 1 and 2)
- Added two Shorts for the 14-day campaign calendar: 'Is this rental a good deal?' (Nov 9) and 'This rental loses money' (Nov 10). Files in media/shorts. Recorder gained a long-term rental scenario.

## 2026-11-07
- Added `/next-set-open`: where Next Set's sign-up and password-reset email links land. It passes the one-time code to the app and has an "Open Next Set" button. Not indexed, not in the sitemap, loads nothing from other sites.
- Added `/next-set/email/`: banner and icon images used inside Next Set's emails (hosted here because email apps can't load images from the app). Source and builder live in the next-set repo (`scripts/email/build.mjs`); copy new images here when they change.

## 2026-11-05 (voice fix)
- How-to videos: the closing line now says OctoPisces the right way (octo-pie-sees). Re-voiced and re-published all four videos and their captions. Page text unchanged.

## 2026-11-04 (shorts v2)
- Rebuilt the short-term, BRRRR and flip Shorts at about 50 seconds each, with every input shown (`media/shorts/*-v2.mp4`).

## 2026-11-04 (video tools)
- Saved the video scripts in `tools/video/` so the how-to and Shorts pipeline survives between sessions.

## 2026-11-04 (shorts)
- Added four vertical Shorts (long-term, short-term, BRRRR, flip) in `media/shorts/` so Metricool can publish them to YouTube Shorts, Facebook and Instagram. Not linked from any page.

## 2026-11-04 (how-to)
- New page /how-to/: four EquityFoundry video walkthroughs (long-term rental, short-term rental, BRRRR, fix and flip) in tabs, each with clickable chapters, captions and written steps with screenshots. Deep links like /how-to/#brrrr open that tab. Built by tools/build_howto.py from the recorder output; videos and captions in media/equityfoundry-howto-*.mp4/.vtt.
- Added How-To to the home page menu and the guide page menus (tools/build_calculators.py, guides regenerated), and to sitemap.xml.
- Fixed the broken EquityFoundry icon on the home page app card (it pointed at the retired icon.svg; now brand-mark-128.png).

## 2026-11-04
- Rewrote the home page and Next Set page copy in a more literary voice to match the new social bios: hero line, studio intro, app cards, the "Built to adapt" story (octopus with no shell, Pisces as two fish bound by one cord), contact line, Next Set intro and feature cards, and both meta descriptions.
- Removed the aviation maintenance line from the About section. Legal pages and pricing text unchanged.
- Added CLAUDE.md: start/finish routine (pull, changelog, push) and token-saving rules for Claude Code sessions.

## 2026-11-03 (voice)
- media/equityfoundry-video1.mp4 replaced with the finished version: AI voiceover (Kokoro, voice am_michael), captions synced to the voice, new slogan on the end card. 67 seconds.

## 2026-11-03 (later)
- Next Set page headline is now the new slogan: "Never guess your next set." (replaces "Your plan changes when you do").

## 2026-11-03
- Added media/equityfoundry-video1.mp4, the first EquityFoundry how-to video (captions, no voice yet). Hosted here so Descript can import it.

## 2026-11-02 (night)
- Home page EquityFoundry card and the guide pages no longer say pasting a listing link fills in the numbers (it fills in the address only).
- EquityFoundry re-published with the same fix to its search description and link preview.

## 2026-11-02 (evening)
- EquityFoundry re-published with fixed icons (the swoosh and roof are no longer clipped).

## 2026-11-02 (later)
- EquityFoundry re-published with new icons from its brand kit (tab icon, header logo, home-screen icons, link-preview image).
- The three EquityFoundry guide pages now use the EquityFoundry tab icon and link-preview image.

## 2026-11-02
- Added Google Search Console verification file (google474b1cf66d98dca4.html). Leave it in place or Search Console loses access.
- Added the Google Search Console verification meta tag to the home page head as well. Leave it in place too.
- Search: added robots.txt and sitemap.xml so Google can find every page.
- New guide pages: /brrrr-calculator, /airbnb-calculator and /cash-on-cash-return-calculator. Each explains the math in plain English with one worked example deal and a button that opens it in EquityFoundry. Built by tools/build_calculators.py.
- Changed the same day: the guide pages first went out with working calculators. Removed them so nothing paid is given away. BRRRR and Airbnb analysis stay in EquityFoundry Pro.
- Home page: Arm 03 card links to the three guides.
- EquityFoundry re-published with a search-friendly title, description and structured data.

## 2026-11-02
- Rental Calc is now **EquityFoundry** ("Know the deal before you buy."): midnight navy and champagne gold, house-and-bars icon, Playfair Display and Inter. Arm 03 card renamed with the new icon. Still at /rental-calc/.
- EquityFoundry: Account page (profile, plan, email preferences, settings, data export, delete account).

## 2026-10-30 (later)
- Rewrote the copy on every page in plain, conversational English: short sentences, contractions, you and your, and no em-dashes, semicolons or buzzwords. Covers the home page, studio privacy policy, the Next Set page and all six Next Set support and legal pages.
- Next Set Terms and Privacy: reworded only. Every rule, right and promise is unchanged. The lawyer placeholders are still there. Disclaimer and liability sections are now bold instead of all caps.
- Rental Calc: re-published from the Rental-Income-Calculator repo with plainer hints, Pro renewal note, help text and privacy policy.

## 2026-10-30
- Game: the Pisces now fly anywhere on screen instead of sliding along the bottom. Arrow keys or WASD move in all directions; the mouse steers both ways; on phones the fish sit just above your finger. They stop just below the octopus.
- Falling background slabs and enemy fire now target the fish wherever they are.

## 2026-10-29
- Arm 03 (Rental Calc): "iPhone and Android apps are in the works" with a bell button that opens a Notify me form. Emails go to the launch list in the Rental Calc Supabase project.
- Rental Calc: email sign-in, website checkout for Pro (switched on once RevenueCat Web Billing is set up), and a Notify me banner in the app.
- Privacy policy: launch-announcement emails, and RevenueCat/Stripe for website purchases.

## 2026-10-29
- Next Set page: medals screenshot updated to the new forged gunmetal medals with 3D icons.
- Next Set Terms and Privacy: company mailing address filled in (740 Joel Way, Fallon, NV 89406).

## 2026-10-28 (night)
- Rental Calc: City/State starts blank instead of Fallon, NV, with example placeholders.
- Rental Calc: every input has an (i) button with plain-English help (what it is, where to find it, typical values), plus a short explanation of each strategy.
- Rental Calc: every result (cash flow, cap rate, DSCR, cash-on-cash, IRR, breakdown rows, comparison rows) has an (i) button explaining what it means, how it's calculated and what's good.

## 2026-10-28 (evening)
- Added the Rental Calc web app at /rental-calc (copied from the Rental-Income-Calculator repo with its scripts/publish-site.sh). Its privacy policy is at /rental-calc/privacy.html.
- Arm 03 is now Rental Calc, marked "Live on the web", linking to /rental-calc/.

## 2026-10-28 (later)
- New company logo (gold octopus with the two astronaut Pisces). Emblem-only round mark now sits next to OCTOPISCES LABS in the header on every page.
- Added favicon, iPhone home-screen icon and a link-preview image (og-image) using the new logo. Full logo saved at img/logo-full-900.jpg.

## 2026-10-28
- Added the Next Set marketing page at /next-set: headline, six-screenshot carousel, eight feature cards, pricing ($69.99/yr with 7-day trial, $12.99/mo) and questions.
- Added Next Set support and legal pages: /next-set-support, /next-set-delete-account, /next-set-terms, /next-set-privacy, /next-set-health, /next-set-ai. Not linked in the main menu; linked from the Next Set page footer.
- Home page: "Next Set" added to the menu, and the Arm 01 card links to the Next Set page.
- Open items in Terms and Privacy (highlighted on the pages): company mailing address, dispute-resolution choice, AI provider data terms, EEA/UK review.

## 2026-10-27 (later)
- OctoPisces Labs LLC approved by the Nevada Secretary of State. Footer and privacy policy now use the legal name "OctoPisces Labs LLC".

## 2026-10-27
- Launched site on GitHub Pages with custom domain octopisceslabs.com.
- Home page: deep-space pixel theme, purple mecha octopus hero with two Pisces astronaut fish.
- Click the octopus to play: four-stage boss fight down the page (hero, apps, about, contact). The octopus grabs real page elements with its tentacles and throws them; tentacles are hazards; pieces stay gone until the game ends.
- Backstop each stage: when the octopus runs out of pieces it tears strips out of the background that you cannot dodge.
- Stage 4: the two Pisces from the About art turn red-eyed and fight for the octopus; beat them and they join your side.
- Contact email set to ellisbyo@octopisceslabs.com. Privacy policy page added.
