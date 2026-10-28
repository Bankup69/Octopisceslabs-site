// Plain-English help for every input: what it means, where to find the
// number, and what's typical. Written for first-time rental buyers.
(function (root) {
  'use strict';

  // what: what the field is; find: where to get the number; typical: a
  // sensible range or example; note: anything else worth knowing.
  const HELP = {
    listingUrl: {
      what: 'The web address of the property’s listing on Zillow, Redfin, Realtor.com, Trulia or a similar site. The app reads the address from the link and keeps it, so you can jump back to the photos and details later.',
      find: 'In the listing app, tap Share → Copy link. In a browser, copy the address bar. Then tap Paste. On Android you can also share the listing straight to this app.',
    },
    propertyName: {
      what: 'A nickname so you can tell properties apart on the dashboard and in reports.',
      find: 'Anything you like, e.g. “Maple St Duplex”. Leave it blank and the address is used.',
    },
    address: {
      what: 'The property’s street address. For your reference only; it doesn’t change any numbers.',
      find: 'From the listing. Paste a listing link and it’s filled in for you.',
    },
    cityState: {
      what: 'The city and state. For your reference only; it doesn’t change any numbers.',
      find: 'From the listing, e.g. “Austin, TX”.',
    },
    purchasePrice: {
      what: 'The price you expect to pay: your offer, which can differ from the asking price. Try the price you plan to offer to see whether the deal works at that number.',
      find: 'Start with the list price, then check what similar homes nearby actually sold for (on Zillow or Redfin, filter by “Sold”). A real estate agent can pull these “comps” for you.',
      typical: 'Many investors offer below asking, especially if a home has sat on the market or needs work.',
    },
    repairsUpfront: {
      what: 'Money you’ll spend fixing the property before it’s rented (or, for BRRRR and flips, the full renovation budget).',
      find: 'Walk through the property, read the home inspection report, and get quotes from contractors. Add 10–20% extra for surprises.',
      typical: 'Paint, flooring and fixtures: $5k–15k. Kitchen, bath, roof or systems: $25k and up.',
    },
    closingCosts: {
      what: 'One-time fees you pay as the buyer when the purchase closes: lender fees, appraisal, inspection, title insurance, escrow and recording fees. Your down payment is separate and not included here.',
      find: 'Your lender’s Loan Estimate lists them (page 2). Before you have one, use a percentage of the price.',
      typical: '2–5% of the purchase price.',
    },
    landPct: {
      what: 'How much of the price is for the land rather than the building. It only splits the price into land and building in the Deal summary. Buildings can be depreciated for taxes and land can’t, so your tax preparer may ask for this. It doesn’t change cash flow.',
      find: 'Your county assessor’s website shows a “land value” and an “improvement value”. Divide land by the total.',
      typical: '20–30% in most suburbs; higher in expensive cities.',
    },
    furnishing: {
      what: 'One-time cost to make a short-term rental guest-ready: furniture, beds and linens, kitchenware, decor, a smart lock, and professional photos.',
      find: 'Price out a room-by-room list, or ask local Airbnb hosts.',
      typical: '$10k–30k for a typical 2–3 bedroom home; more for luxury listings.',
    },
    arv: {
      what: 'After-repair value: what the property will be worth once the work is done. BRRRR refinances and flip sale prices are based on it.',
      find: 'Look at homes nearby that recently sold in renovated condition: similar size, bedrooms and bathrooms, sold in the last 6 months, within about half a mile. An agent can pull these comps, and the lender’s appraisal sets the final number.',
      typical: 'Be conservative. Use the middle of your comps, not the best one.',
    },
    rehabMonths: {
      what: 'Months from buying the property until it’s fixed up, rented, and refinanced. During this time you pay the loan, taxes and insurance with no rent coming in.',
      find: 'Contractor timelines plus time to find a tenant. Ask lenders how long you must own the property before a cash-out refinance (called “seasoning”).',
      typical: '3–6 months; many lenders require 6 months of ownership.',
    },
    holdMonths: {
      what: 'Months from buying the property until the sale closes, including renovation, listing, and time under contract. You pay holding costs (loan, taxes, insurance, utilities) the whole time.',
      find: 'Contractor timeline + average days on market in the area (shown on Redfin and Zillow) + about 30–45 days to close.',
      typical: '4–8 months.',
    },
    refiLtv: {
      what: 'Loan-to-value: how big the new loan is as a percentage of the after-repair value. A higher percentage pulls more cash out but makes the monthly payment larger.',
      find: 'Ask lenders about “cash-out refinance on an investment property” or “DSCR loans”.',
      typical: '70–75% for investment properties.',
    },
    refiRate: {
      what: 'The interest rate on the new loan after you refinance.',
      find: 'A lender quote. Investment property rates usually run 0.5–1% above rates for a home you live in.',
    },
    refiYears: {
      what: 'How many years the refinance loan lasts.',
      typical: '30 years is standard and keeps payments lowest.',
    },
    refiClosingCosts: {
      what: 'Fees to take out the refinance loan: lender origination, appraisal, title and recording.',
      find: 'The lender’s Loan Estimate for the refinance.',
      typical: '2–3% of the new loan.',
    },
    sellingCostPct: {
      what: 'Costs of selling, as a percentage of the sale price: agent commissions, the seller’s closing costs, transfer taxes, and any credits you give the buyer.',
      find: 'Ask a listing agent what commissions are typical locally, and check your state’s transfer tax.',
      typical: '6–8% of the sale price.',
    },
    units: {
      what: 'The rentable units and what each will rent for per month. Add a row for each type of unit. For an apartment building, use the count column (e.g. 24 × 1-bed at $950) instead of 24 separate rows.',
      find: 'Look up similar rentals nearby on Zillow Rentals, Apartments.com, Rentometer or Facebook Marketplace, or ask a local property manager. If the property is already rented, ask the seller for the “rent roll” (current leases), but price vacant units at today’s market rent.',
      typical: 'Use realistic rent, not the highest listing you can find.',
    },
    vacancyRate: {
      what: 'The share of rent you expect to lose to empty months between tenants and to rent that never gets paid.',
      find: 'Ask local property managers about vacancy in that neighborhood. Census and Zillow data also show rental vacancy by city.',
      typical: '5% (about 18 days a year) to 8% (about one month a year). Use more for student housing or weak markets.',
    },
    repairRentalLoss: {
      what: 'Rent you’ll miss while doing up-front repairs before the first tenant moves in, e.g. 2 months × $1,500 = $3,000.',
      find: 'The contractor’s timeline × monthly rent.',
      note: 'As in the original spreadsheet, entering an amount here replaces the vacancy allowance for year 1 instead of adding to it.',
    },
    strListings: {
      what: 'How many separate short-term rentals the property will have. A duplex with both sides on Airbnb is 2. The nightly rate and other numbers below are per listing.',
    },
    nightlyRate: {
      what: 'The average price per night across the whole year (called ADR, average daily rate), not counting cleaning fees. Weekends and peak season run higher and off-season lower, so use the year-round average.',
      find: 'Market data tools such as AirDNA, PriceLabs or Rabbu, or search Airbnb for similar homes nearby on dates spread through the year and average the prices.',
    },
    occupancy: {
      what: 'The share of nights in the year that are booked.',
      find: 'AirDNA or PriceLabs market data for the area. Similar listings’ Airbnb calendars give a rough idea.',
      typical: '50–75% in established markets. New listings often book less in their first few months.',
    },
    avgStay: {
      what: 'The average number of nights per booking. It sets how many cleanings you pay for.',
      find: 'Market data tools, or the minimum-stay rules on similar listings.',
      typical: '2–4 nights in cities and vacation spots; longer for mid-term rentals.',
    },
    cleaningFeeCharged: {
      what: 'The cleaning fee each guest pays per booking. It counts as income.',
      find: 'Look at what similar listings charge.',
      typical: '$75–200 depending on size.',
    },
    cleaningCost: {
      what: 'What you pay your cleaner for each turnover, including laundry.',
      find: 'Ask local cleaning services or turnover companies for a quote.',
      typical: '$75–200 per turnover.',
    },
    platformFeePct: {
      what: 'The booking site’s cut of your booking revenue.',
      find: 'Airbnb’s split fee (where guests pay part) is about 3% for hosts. Its host-only fee, common with property management software, is about 14–16%. Vrbo is about 8%.',
      typical: '3% for most individual Airbnb hosts.',
    },
    strSupplies: {
      what: 'Monthly running costs per listing beyond utilities: toiletries, coffee, paper goods, internet, streaming, pricing software and restocking.',
      typical: '$100–300 a month.',
    },
    downPaymentPct: {
      what: 'The share of the price you pay in cash. The rest is borrowed. Enter 100% for an all-cash purchase.',
      find: 'Ask a lender what they require for an investment property.',
      typical: 'Investment loans: 15–25% (often 15% for a single-family home, 25% for 2–4 units). Living in one unit (“house hacking”) can qualify for FHA at 3.5% or conventional at 5%. Hard-money loans for flips: 10–20%.',
    },
    interestRate: {
      what: 'The yearly interest rate on the purchase loan.',
      find: 'Get a quote or Loan Estimate from a lender. Freddie Mac and Mortgage News Daily publish today’s average rates; investment property rates usually run 0.5–0.75% higher.',
      typical: 'Hard-money loans for flips and BRRRR: 10–13%.',
    },
    loanYears: {
      what: 'How many years you have to pay the loan back.',
      typical: '30 years is standard. 15 years means higher payments but much less interest. Hard-money loans are usually 1 year.',
    },
    interestOnly: {
      what: 'Tick this if the loan only charges interest each month and the full balance is paid off at the end (when you sell or refinance). Common for hard-money and bridge loans used for flips and BRRRR. Most regular mortgages are not interest-only.',
    },
    propertyTaxes: {
      what: 'Property tax for a full year.',
      find: 'Check “Tax history” on the Zillow or Redfin listing, or your county assessor’s or treasurer’s website. Many states reassess after a sale, so the seller’s bill can be too low. To be safe, multiply your purchase price by the local tax rate.',
      typical: 'Roughly 0.5–2.5% of the price per year depending on the state.',
    },
    insurance: {
      what: 'Yearly landlord insurance (a “dwelling fire” or DP-3 policy). It costs more than a regular homeowner’s policy. Short-term rentals need a policy that specifically covers them.',
      find: 'Get a quote from an insurance agent with the address. It only takes a few minutes.',
      typical: 'About 0.3–1% of the home’s value per year; more in coastal, wildfire and hail areas.',
    },
    utilities: {
      what: 'Utilities you pay as the owner each year: water, sewer and trash are often owner-paid in multifamily buildings, plus anything a vacant or short-term rental uses. Also a good place for HOA dues and other fixed yearly costs.',
      find: 'Ask the seller or agent for the last 12 months of bills, or check the city utility’s rates. For HOA dues, see the listing.',
    },
    maintenancePct: {
      what: 'Money for everyday repairs: leaky faucets, broken appliances, patching and painting between tenants. Entered as a percentage of rent.',
      typical: '5–10% of rent; use the high end for older homes.',
    },
    capexPct: {
      what: 'Savings for big-ticket replacements that come every 10–25 years, such as roof, furnace or AC, water heater, appliances, flooring and parking lot. Entered as a percentage of rent. Even if nothing breaks this year, setting this aside keeps a big bill from wiping out years of cash flow.',
      typical: '5–10% of rent; more for older properties.',
    },
    mgmtPct: {
      what: 'The property manager’s fee as a percentage of the rent collected. Enter 0 if you’ll manage it yourself, but your time has value, and it’s safer to check the deal still works with a manager.',
      find: 'Call two or three local property management companies for quotes.',
      typical: '8–12% for long-term rentals; 20–30% for short-term rentals.',
    },
    mgmtFixed: {
      what: 'Flat yearly management costs that aren’t a percentage of rent: tenant placement fees, lease renewal fees, bookkeeping or landlord software, or a flat monthly management fee × 12.',
      typical: 'Placement fees are often 50–100% of one month’s rent each time a new tenant moves in.',
    },
    mortgageInsPct: {
      what: 'Mortgage insurance (PMI, or MIP on FHA loans), as a yearly percentage of the loan. Usually only charged when you put less than 20% down.',
      find: 'The lender’s Loan Estimate shows it.',
      typical: '0% with 20%+ down; about 0.3–1.5% of the loan per year otherwise.',
    },
    fullValue: {
      what: 'What the property is actually worth today. It can be higher than the price if you’re buying below market. Appreciation and long-term projections start from this value.',
      find: 'The appraisal, recent sold comps, or a Zillow or Redfin estimate as a rough guide. Leave it at 0 to use the purchase price.',
    },
    appreciationRate: {
      what: 'How much you expect the property’s value to rise each year.',
      find: 'Look at the area’s home value history on Zillow (Home Values) or Redfin (Data Center).',
      typical: 'The long-run US average is about 3–4% a year. Use a lower number to be safe; good deals shouldn’t depend on appreciation.',
    },
    rentGrowth: {
      what: 'How much you expect rent to rise each year. Used for the long-term projection.',
      find: 'Zillow’s Observed Rent Index or Apartment List’s rent reports for the city.',
      typical: '2–4% a year.',
    },
    expenseGrowth: {
      what: 'How much you expect fixed costs (taxes, insurance, utilities) to rise each year. Used for the long-term projection.',
      typical: '2–4% a year. Insurance has been rising faster in many states.',
    },
    holdYears: {
      what: 'How many years you plan to keep the property before selling. The projection’s IRR (your average yearly return) and total profit assume you sell at the end of this period.',
      typical: '5–10 years is common. Try a few to see how the returns change.',
    },
  };

  const STRATEGY_HELP = {
    rental: 'Long-term rental: buy a property and rent it to tenants on year-long leases. The classic buy-and-hold investment, and what the original spreadsheet models.',
    str: 'Short-term rental: rent the property by the night on Airbnb or Vrbo. It can earn more than a long-term rental, but it costs more to run (furnishing, cleaning, platform fees) and is more work. Check local short-term rental rules before you buy.',
    brrrr: 'BRRRR, short for Buy, Rehab, Rent, Refinance, Repeat. You buy a property that needs work (often with cash or a short-term loan), fix it up, rent it out, then refinance based on its higher value to pull your cash back out for the next deal.',
    flip: 'Fix & flip: buy a property below value, renovate it, and sell it for a profit. There’s no rent; your return comes from the sale.',
  };

  const api = { HELP, STRATEGY_HELP };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.FieldHelp = api;

  // ---- UI: an ⓘ button beside each label that opens the help in place ----

  let counter = 0;

  function panelFor(entry) {
    const panel = document.createElement('div');
    panel.className = 'help-panel';
    panel.hidden = true;
    panel.id = `help-${++counter}`;
    [['What it is', entry.what], ['Where to find it', entry.find], ['Typical', entry.typical], ['Note', entry.note]].forEach(([title, text]) => {
      if (!text) return;
      const p = document.createElement('p');
      const b = document.createElement('strong');
      b.textContent = title + ': ';
      p.append(b, text);
      panel.appendChild(p);
    });
    // Clicks inside a <label> would otherwise focus its input (and pop up
    // the keyboard on phones).
    panel.addEventListener('click', (ev) => ev.preventDefault());
    return panel;
  }

  function helpButton(label, panel) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'help-btn';
    b.textContent = 'i';
    b.setAttribute('aria-label', `What is “${label}”?`);
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', panel.id);
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const open = panel.hidden;
      panel.hidden = !open;
      b.setAttribute('aria-expanded', String(open));
      const host = b.closest('label, fieldset');
      if (host && host.tagName === 'LABEL') host.classList.toggle('help-open', open);
    });
    return b;
  }

  // Puts the button right after the label's own text.
  function attachToLabel(labelEl, key) {
    const entry = HELP[key];
    if (!entry || labelEl.querySelector('.help-btn')) return;
    const textNode = [...labelEl.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    const name = textNode ? textNode.textContent.trim() : key;
    const panel = panelFor(entry);
    const btn = helpButton(name, panel);
    const wrap = document.createElement('span');
    wrap.className = 'label-text';
    if (textNode) {
      textNode.textContent = textNode.textContent.trim();
      labelEl.insertBefore(wrap, textNode);
      wrap.append(textNode, btn);
    } else {
      labelEl.prepend(wrap);
      wrap.append(btn);
    }
    labelEl.appendChild(panel);
  }

  function init() {
    const form = document.getElementById('form');
    if (!form) return;
    form.querySelectorAll('input[name], input[data-mirror]').forEach((input) => {
      const key = input.name || input.dataset.mirror;
      const label = input.closest('label');
      if (label && key !== 'strategy') attachToLabel(label, key);
    });

    // Units editor: one button for the whole table, beside its legend.
    const legend = document.querySelector('.units-fieldset legend');
    if (legend && HELP.units) {
      const panel = panelFor(HELP.units);
      legend.appendChild(helpButton('Units & rent', panel));
      legend.parentElement.insertBefore(panel, legend.nextSibling);
    }

    // A one-line explanation of the selected strategy.
    const strategies = document.getElementById('strategies');
    if (strategies) {
      const note = document.createElement('p');
      note.className = 'strategy-help';
      note.id = 'strategy-help';
      strategies.insertAdjacentElement('afterend', note);
      const update = () => {
        const checked = strategies.querySelector('[aria-checked="true"]');
        note.textContent = STRATEGY_HELP[checked ? checked.dataset.strategy : 'rental'];
      };
      new MutationObserver(update).observe(strategies, { attributes: true, subtree: true, attributeFilter: ['aria-checked'] });
      update();
    }
  }

  init();
})(typeof self !== 'undefined' ? self : this);
