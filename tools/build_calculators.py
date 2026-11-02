#!/usr/bin/env python3
"""Builds the guide pages for EquityFoundry (BRRRR, Airbnb, cash-on-cash).

These are guides, not calculators: nothing to type into. Each shows one worked
example deal. The example's results are worked out at build time with
EquityFoundry's own engine (rental-calc/calc.js), so they match the app. The
button opens that example in EquityFoundry, where Pro gating applies as usual.
Edit the PAGES list below, then run:

    python3 tools/build_calculators.py

and commit the generated folders.
"""
import html, json, os, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://octopisceslabs.com'

# kind: money (dollars), pct (entered as %, stored as a fraction), num
F = {
    'purchasePrice': ('Purchase price', 'money', 'What you plan to pay. Use your offer, not the asking price.'),
    'downPaymentPct': ('Down payment', 'pct', 'Investment loans usually want 20 to 25% down.'),
    'interestRate': ('Interest rate', 'pct', 'Rates on rentals usually run a bit higher than on a home you live in.'),
    'loanYears': ('Loan term (years)', 'num', ''),
    'closingCosts': ('Closing costs', 'money', 'Usually 2 to 5% of the price.'),
    'repairsUpfront': ('Repairs up front', 'money', ''),
    'rent': ('Monthly rent', 'money', 'Check what similar places nearby actually rent for.'),
    'vacancyRate': ('Vacancy', 'pct', 'Months it sits empty. 5 to 8% is common.'),
    'propertyTaxes': ('Property taxes (per year)', 'money', 'Find it on the listing or the county website.'),
    'insurance': ('Insurance (per year)', 'money', ''),
    'utilities': ('Utilities you pay (per year)', 'money', ''),
    'maintenancePct': ('Maintenance', 'pct', 'Share of rent set aside for repairs.'),
    'capexPct': ('Big repairs reserve (CapEx)', 'pct', 'Roof, HVAC, water heater. Share of rent.'),
    'mgmtPct': ('Property management', 'pct', '0 if you manage it yourself. 8 to 12% if not.'),
    'furnishing': ('Furniture and setup', 'money', 'Beds, linens, kitchen, decor, photos.'),
    'nightlyRate': ('Average nightly rate', 'money', 'Look at similar listings near it.'),
    'occupancy': ('Occupancy', 'pct', 'Share of nights booked. 55 to 70% is common.'),
    'avgStay': ('Average stay (nights)', 'num', ''),
    'cleaningFeeCharged': ('Cleaning fee guests pay', 'money', 'Per booking.'),
    'cleaningCost': ('What your cleaner costs', 'money', 'Per booking.'),
    'platformFeePct': ('Airbnb host fee', 'pct', 'Usually 3% with split fees.'),
    'strSupplies': ('Supplies (per month)', 'money', 'Toilet paper, coffee, soap, Wi-Fi.'),
    'rehabMonths': ('Months to fix, rent and refinance', 'num', 'Many lenders want you to own it 6 months first.'),
    'arv': ('Value after repairs (ARV)', 'money', 'What it will be worth fixed up. Use recent sold comps.'),
    'refiLtv': ('Refinance loan-to-value', 'pct', 'Most cash-out refis lend 70 to 75% of the new value.'),
    'refiRate': ('Refinance rate', 'pct', ''),
    'refiClosingCosts': ('Refinance closing costs', 'money', ''),
}

PAGES = [
    {
        'slug': 'cash-on-cash-return-calculator',
        'nav': 'Cash-on-cash',
        'strategy': 'rental',
        'title': 'Cash-on-Cash Return Calculator for Rental Property | EquityFoundry',
        'desc': 'What cash-on-cash return is, the formula, what a good number looks like and a worked example. Run your own deals in EquityFoundry.',
        'h1': 'Cash-on-cash return: how the numbers work',
        'lede': 'How hard is your money working? Here\'s how to tell, with a real example worked all the way through.',
        'groups': [
            ('The purchase', ['purchasePrice', 'downPaymentPct', 'interestRate', 'loanYears', 'closingCosts', 'repairsUpfront']),
            ('The rent', ['rent', 'vacancyRate']),
            ('Yearly costs', ['propertyTaxes', 'insurance', 'maintenancePct', 'capexPct', 'mgmtPct']),
        ],
        'example': {'purchasePrice': 250000, 'downPaymentPct': .25, 'interestRate': .07, 'loanYears': 30, 'closingCosts': 7500,
                    'repairsUpfront': 5000, 'rent': 2200, 'vacancyRate': .05, 'propertyTaxes': 2500, 'insurance': 1400,
                    'maintenancePct': .05, 'capexPct': .05, 'mgmtPct': 0},
        'results': [('cashOnCash', 'Cash-on-cash return', 'pct', True), ('monthlyCashFlow', 'Cash flow per month', 'money', False),
                    ('cashInvested', 'Cash you put in', 'money', False), ('capRate', 'Cap rate', 'pct', False),
                    ('monthlyMortgage', 'Mortgage payment', 'money', False)],
        'body': '''
<h2>What cash-on-cash return means</h2>
<p>It's the yearly cash flow divided by the cash you put into the deal. That's it. If you put in $70,000 and the place clears $4,200 a year after every bill and the mortgage, your cash-on-cash return is 6%.</p>
<p>It answers one question. What is my own money earning right now? It ignores appreciation and the loan getting paid down. Those matter too. They just aren't cash in your pocket this year.</p>
<h2>The formula</h2>
<p class="formula">Cash-on-cash return = yearly cash flow ÷ total cash invested</p>
<p><strong>Yearly cash flow</strong> is rent, minus vacancy, minus every expense, minus the mortgage. <strong>Cash invested</strong> is your down payment plus closing costs plus any repairs you pay for up front.</p>
<h2>What's a good number?</h2>
<p>Plenty of investors aim for 8 to 12%. Some markets never get there, and people buy anyway for appreciation. A negative number means the property costs you money every month. Know that before you sign.</p>
<p>Be honest with the inputs. Most bad deals look good because someone left out vacancy, repairs or big-ticket replacements. EquityFoundry sets money aside for all three by default.</p>
<h2>Cash-on-cash vs. cap rate</h2>
<p>Cap rate ignores the loan. It's the yearly profit before the mortgage divided by the price. Use it to compare properties to each other. Cash-on-cash includes your loan, so it tells you how <em>your</em> deal works with <em>your</em> financing.</p>
''',
    },
    {
        'slug': 'brrrr-calculator',
        'nav': 'BRRRR',
        'strategy': 'brrrr',
        'title': 'BRRRR Calculator: Cash Left in the Deal, Refinance and Cash Flow | EquityFoundry',
        'desc': 'How to run the numbers on a BRRRR deal: cash out at the refinance, cash left in the deal and cash flow after. With a worked example. Analyze yours in EquityFoundry.',
        'h1': 'BRRRR deals: how the numbers work',
        'lede': 'Buy, rehab, rent, refinance, repeat. Here\'s how to tell how much of your cash comes back out, with an example deal.',
        'groups': [
            ('Buy and rehab', ['purchasePrice', 'repairsUpfront', 'closingCosts', 'downPaymentPct', 'interestRate', 'rehabMonths']),
            ('Refinance', ['arv', 'refiLtv', 'refiRate', 'refiClosingCosts']),
            ('Rent and yearly costs', ['rent', 'vacancyRate', 'propertyTaxes', 'insurance', 'maintenancePct', 'capexPct', 'mgmtPct']),
        ],
        'example': {'purchasePrice': 150000, 'repairsUpfront': 45000, 'closingCosts': 4500, 'downPaymentPct': .2, 'interestRate': .11,
                    'loanYears': 30, 'rehabMonths': 6, 'arv': 260000, 'refiLtv': .75, 'refiRate': .072, 'refiYears': 30,
                    'refiClosingCosts': 5000, 'rent': 2100, 'vacancyRate': .05, 'propertyTaxes': 2200, 'insurance': 1300,
                    'maintenancePct': .05, 'capexPct': .05, 'mgmtPct': 0},
        'results': [('brrrr.cashLeftInDeal', 'Cash left in the deal', 'money', True), ('brrrr.cashOut', 'Cash out at the refinance', 'money', False),
                    ('monthlyCashFlow', 'Cash flow per month after refi', 'money', False), ('cashOnCash', 'Cash-on-cash return', 'pct', False),
                    ('brrrr.equityAfterRefi', 'Equity left after refi', 'money', False), ('brrrr.holdingCosts', 'Holding costs during rehab', 'money', False)],
        'body': '''
<h2>How a BRRRR works</h2>
<p>You buy a place that needs work. You fix it up and rent it out. Then you refinance based on what it's worth now, not what you paid. If the new value is high enough, the new loan pays off the old one and hands a big chunk of your cash back. You use that cash on the next one.</p>
<p>The number that matters most is <strong>cash left in the deal</strong>. Get it to zero and you own a rental with none of your money tied up. Go below zero and you walk away with extra cash.</p>
<h2>The math</h2>
<p class="formula">Cash out = new loan − old loan balance − refinance closing costs</p>
<p class="formula">Cash left in = down payment + closing + rehab + holding costs − cash out</p>
<p>The <strong>new loan</strong> is the after-repair value times the lender's loan-to-value, usually 70 to 75%. <strong>Holding costs</strong> are the mortgage, taxes and insurance you pay while it's being fixed and has no tenant.</p>
<h2>Where BRRRR deals go wrong</h2>
<p>The appraisal comes in low. Use the middle of your sold comps for the ARV, not the best one. Rehabs run long and over budget, so pad both. And check the cash flow <em>after</em> the refinance. A bigger loan means a bigger payment, and some deals pull all the cash out but lose money every month.</p>
<p>Many lenders also want you to own the place for 6 months before a cash-out refinance. Ask before you buy.</p>
''',
    },
    {
        'slug': 'airbnb-calculator',
        'nav': 'Airbnb',
        'strategy': 'str',
        'title': 'Airbnb Calculator: Short-Term Rental Profit and Cash Flow | EquityFoundry',
        'desc': 'How to run the numbers on an Airbnb or short-term rental: revenue, cleaning, fees, furniture and cash flow. With a worked example. Analyze yours in EquityFoundry.',
        'h1': 'Airbnb rentals: how the numbers work',
        'lede': 'Thinking about a short-term rental? Here\'s what it really clears after cleaning, fees, furniture and the mortgage.',
        'groups': [
            ('The purchase', ['purchasePrice', 'downPaymentPct', 'interestRate', 'loanYears', 'closingCosts', 'furnishing']),
            ('Bookings', ['nightlyRate', 'occupancy', 'avgStay', 'cleaningFeeCharged', 'cleaningCost', 'platformFeePct']),
            ('Yearly costs', ['propertyTaxes', 'insurance', 'utilities', 'strSupplies', 'maintenancePct', 'capexPct', 'mgmtPct']),
        ],
        'example': {'purchasePrice': 350000, 'downPaymentPct': .25, 'interestRate': .072, 'loanYears': 30, 'closingCosts': 10500,
                    'furnishing': 20000, 'nightlyRate': 185, 'occupancy': .62, 'avgStay': 3, 'cleaningFeeCharged': 95,
                    'cleaningCost': 85, 'platformFeePct': .03, 'strListings': 1, 'propertyTaxes': 3200, 'insurance': 2400,
                    'utilities': 4200, 'strSupplies': 120, 'maintenancePct': .05, 'capexPct': .05, 'mgmtPct': 0},
        'results': [('monthlyCashFlow', 'Cash flow per month', 'money', True), ('grossRent', 'Booking revenue per year', 'money', False),
                    ('cashOnCash', 'Cash-on-cash return', 'pct', False), ('cashInvested', 'Cash you put in', 'money', False),
                    ('nightsBooked', 'Nights booked per year', 'int', False)],
        'body': '''
<h2>How to run Airbnb numbers</h2>
<p>It starts with your nightly rate and how often you're booked. It adds the cleaning fees guests pay. Then it takes out everything a short-term rental really costs. That means your cleaner on every turnover, the Airbnb host fee, supplies, utilities, repairs and the mortgage.</p>
<p>Furniture and setup count as cash you put in, right next to your down payment. That's why a short-term rental can show big cash flow but a so-so return.</p>
<h2>Getting the inputs right</h2>
<p><strong>Nightly rate and occupancy</strong> make or break the deal. Look at similar listings near the property and check their calendars across a full year, not just summer. Plenty of markets run 55 to 70% occupancy.</p>
<p><strong>You pay the utilities</strong> on a short-term rental. Power, water, internet and streaming add up. So do supplies.</p>
<p><strong>Check the local rules first.</strong> Lots of cities limit or ban short-term rentals, require a permit or charge a lodging tax. A great number means nothing if you can't legally rent it.</p>
<h2>What's a good result?</h2>
<p>Short-term rentals take more work and more risk than a regular lease. Many investors want a clearly higher cash-on-cash return to make that worth it. In EquityFoundry you can run the same house as a long-term rental and compare the two side by side.</p>
''',
    },
]

CSS = '''
:root{--space:#070A1F;--panel:#10163B;--line:#262D63;--line2:#3A4290;--ink:#ECEBFA;--muted:#A4A7CE;--gold:#F4B23E;--gold2:#FFDB8C;color-scheme:dark;
  --body:"Figtree",system-ui,sans-serif;--wide:"Michroma","Eurostile",sans-serif}
*{box-sizing:border-box}
html{background:var(--space)}
body{margin:0;background:var(--space);color:var(--ink);font:400 17px/1.6 var(--body);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
a{color:var(--gold)}
a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.top,.foot,main{max-width:68rem;margin:0 auto}
.top{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;padding-block:1rem 2rem}
.brand{display:flex;align-items:center;gap:.6rem;text-decoration:none;color:var(--ink);font-family:var(--wide);font-size:.78rem;letter-spacing:.12em}
.brand img{width:36px;height:36px;border-radius:50%}
.top nav{display:flex;gap:1.1rem;flex-wrap:wrap}
.top nav a{color:var(--muted);text-decoration:none;font-weight:600;font-size:.95rem}
.top nav a:hover,.top nav a[aria-current]{color:var(--ink)}
h1,h2{line-height:1.15;text-wrap:balance}
h1{font-family:var(--wide);font-weight:400;font-size:clamp(1.6rem,4.6vw,2.6rem);letter-spacing:.02em;color:var(--gold);margin:0 0 .5rem}
h2{font-size:1.45rem;margin:2.2rem 0 .6rem}
.lede{font-size:1.15rem;color:var(--ink);max-width:46rem;margin:0 0 1.6rem}
.calc{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:20px;align-items:start}
form fieldset{border:1px solid var(--line);border-radius:12px;background:var(--panel);margin:0 0 14px;padding:14px 16px 6px}
legend{font-weight:700;padding:0 .4rem;color:var(--gold2)}
.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:4px 14px;align-items:start}
label{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;gap:4px;align-content:start;font-size:.92rem;font-weight:600;margin-bottom:10px}
label small{font-weight:400;color:var(--muted);font-size:.8rem;line-height:1.35}
.inp{display:flex;align-items:center;min-width:0;background:var(--space);border:1px solid var(--line2);border-radius:8px}
.inp span{padding:0 .55rem;color:var(--muted);font-size:.9rem}
.inp input{flex:1 1 0;width:0;min-width:0;background:transparent;border:0;color:var(--ink);font:500 1rem var(--body);padding:.55rem .6rem}
.inp input:focus{outline:none}.inp:focus-within{border-color:var(--gold)}
.example{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:6px 16px 12px}.example h2{margin:.6rem 0 .4rem;font-size:1.15rem}
.example table{width:100%;border-collapse:collapse;font-size:.95rem}.example td{padding:.4rem 0;border-bottom:1px solid var(--line)}.example td:last-child{text-align:right;font-weight:600}
.example tr.grp th{text-align:left;color:var(--gold2);padding:.9rem 0 .2rem;font-size:.9rem}
.results{position:sticky;top:12px;background:var(--panel);border:2px solid var(--gold);border-radius:14px;padding:18px}
.hero-k{font-size:.85rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.hero-v{font-family:var(--wide);font-size:clamp(1.7rem,5vw,2.4rem);color:var(--gold);margin:.2rem 0 .8rem}
.hero-v.neg{color:#FF7A6B}
dl{display:grid;grid-template-columns:1fr auto;gap:.5rem 1rem;margin:0 0 1rem;border-top:1px solid var(--line);padding-top:.9rem}
dt{color:var(--muted)}dd{margin:0;font-weight:700;text-align:right}
.btn{display:block;text-align:center;background:var(--gold);color:#1A1203;font-weight:700;text-decoration:none;border-radius:9px;padding:.85rem 1rem}
.btn:hover{filter:brightness(1.08)}
.fine{font-size:.82rem;color:var(--muted);margin:.7rem 0 0}
.formula{background:var(--panel);border-left:3px solid var(--gold);padding:.7rem 1rem;border-radius:6px;font-weight:600}
.prose{max-width:46rem}
.more{display:flex;gap:10px;flex-wrap:wrap;margin:1rem 0 0}
.more a{border:1px solid var(--line2);border-radius:8px;padding:.5rem .8rem;text-decoration:none;color:var(--ink);font-weight:600}
.foot{border-top:1px solid var(--line);margin-top:3rem;padding-block:1.4rem 2.4rem;color:var(--muted);font-size:.9rem;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.foot nav{display:flex;gap:1rem;flex-wrap:wrap}.foot a{color:var(--muted)}
@media (max-width:820px){.calc{grid-template-columns:minmax(0,1fr)}.results{position:static;order:-1}}
'''



HEAD_FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Michroma&display=swap">'


import subprocess


def compute(inp):
    """Runs EquityFoundry's engine on one input so the example matches the app."""
    calc = os.path.join(ROOT, 'rental-calc', 'calc.js')
    js = ('const C=require(process.argv[1]);const i=JSON.parse(process.argv[2]);'
          'process.stdout.write(JSON.stringify(C.analyze(i),(k,v)=>v===Infinity?"Infinity":v));')
    return json.loads(subprocess.check_output(['node', '-e', js, calc, json.dumps(inp)]))


def fmt(v, kind):
    if v == 'Infinity':
        return 'All your cash back'
    if v is None:
        return '–'
    if kind == 'money':
        return ('−$' if v < 0 else '$') + f'{abs(round(v)):,}'
    if kind == 'pct':
        return f'{v * 100:.1f}%'
    if kind == 'int':
        return f'{round(v):,}'
    return f'{v:g}'


def get(o, path):
    for k in path.split('.'):
        o = None if o is None else o.get(k)
    return o


def nav(cur):
    links = ['<a href="/rental-calc/">EquityFoundry</a>'] + [
        f'<a href="/{p["slug"]}/"{" aria-current=\"page\"" if p["slug"] == cur else ""}>{p["nav"]}</a>' for p in PAGES]
    return ''.join(links)


def build(p):
    full = dict(p['example'])
    inp = dict(full)
    if 'rent' in inp:
        inp['units'] = [{'label': 'Unit 1', 'count': 1, 'rent': inp.pop('rent')}]
    inp['strategy'] = p['strategy']
    r = compute(inp)
    rows = ''
    for title, names in p['groups']:
        rows += f'<tr class="grp"><th colspan="2">{html.escape(title)}</th></tr>'
        for n in names:
            label, kind, _ = F[n]
            rows += f'<tr><td>{html.escape(label)}</td><td>{fmt(full[n], kind)}</td></tr>'
    first = p['results'][0]
    res = ''.join(f'<dt>{html.escape(lab)}</dt><dd>{fmt(get(r, key), kind)}</dd>' for key, lab, kind, _ in p['results'][1:])
    hv = get(r, first[0])
    neg = ' neg' if isinstance(hv, (int, float)) and hv < 0 else ''
    app_inp = {**json.loads(subprocess.check_output(['node', '-e',
               'process.stdout.write(JSON.stringify(require(process.argv[1]).DEFAULTS))',
               os.path.join(ROOT, 'rental-calc', 'calc.js')])), **inp}
    open_href = '/rental-calc/?p=' + urllib.parse.quote(json.dumps(app_inp, separators=(',', ':')))
    url = f'{SITE}/{p["slug"]}/'
    ld = json.dumps({'@context': 'https://schema.org', '@type': 'Article', 'headline': p['h1'],
                     'description': p['desc'], 'url': url, 'datePublished': '2026-11-02',
                     'author': {'@type': 'Organization', 'name': 'OctoPisces Labs LLC', 'url': SITE + '/'},
                     'publisher': {'@type': 'Organization', 'name': 'OctoPisces Labs LLC', 'url': SITE + '/'}})
    others = ''.join(f'<a href="/{o["slug"]}/">{html.escape(o["h1"])}</a>' for o in PAGES if o is not p)
    pro = p['strategy'] != 'rental'
    cta = ('Run your own deal in EquityFoundry Pro' if pro else 'Run your own deal in EquityFoundry')
    fine = ('BRRRR' if p['strategy'] == 'brrrr' else 'Airbnb') + ' analysis is part of EquityFoundry Pro. ' if pro else ''
    doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(p["title"])}</title>
<meta name="description" content="{html.escape(p["desc"])}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article"><meta property="og:site_name" content="OctoPisces Labs">
<meta property="og:title" content="{html.escape(p["h1"])}"><meta property="og:description" content="{html.escape(p["desc"])}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/img/og-image.jpg">
<link rel="icon" href="/img/favicon-32.png"><link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
{HEAD_FONTS}
<style>{CSS}</style>
<script type="application/ld+json">{ld}</script>
</head>
<body>
<header class="top">
  <a class="brand" href="/"><img src="/img/logo-mark-128.png" alt="" width="36" height="36">OCTOPISCES LABS</a>
  <nav aria-label="Guides">{nav(p["slug"])}</nav>
</header>
<main>
<h1>{html.escape(p["h1"])}</h1>
<p class="lede">{html.escape(p["lede"])}</p>
<div class="calc">
  <section class="example" aria-labelledby="ex-h">
    <h2 id="ex-h">Example deal</h2>
    <table>{rows}</table>
  </section>
  <aside class="results">
    <div class="hero-k">{html.escape(first[1])}</div><div class="hero-v{neg}">{fmt(hv, first[2])}</div>
    <dl>{res}</dl>
    <a class="btn" href="{open_href}">{cta}</a>
    <p class="fine">Made-up numbers to show how the math works. EquityFoundry runs your real deal: paste a Zillow or Redfin link, change anything, save it and compare. {fine}Estimates, not financial advice.</p>
  </aside>
</div>
<div class="prose">{p["body"]}
<h2>More guides</h2>
<div class="more">{others}<a href="/rental-calc/">Open EquityFoundry</a></div>
</div>
</main>
<footer class="foot">
  <span>&copy; 2026 OctoPisces Labs LLC &middot; Nevada</span>
  <nav aria-label="Legal"><a href="/rental-calc/privacy.html">Privacy</a><a href="/rental-calc/terms.html">Terms of Sale</a><a href="/">Studio</a></nav>
</footer>
</body>
</html>
'''
    d = os.path.join(ROOT, p['slug'])
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'index.html'), 'w').write(doc)
    print('wrote', p['slug'])


for page in PAGES:
    build(page)
