# Changelog

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
