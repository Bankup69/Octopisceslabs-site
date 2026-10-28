// Rental property analysis. The long-term rental model is a direct port of the
// "Simple Rental Property Calculator / Spreadsheet" (RENTAL PROPERTY ANALYSIS
// tab); spreadsheet cell references are noted beside each figure so results can
// be traced back. Short-term rental, BRRRR, flip and multi-year projections
// build on the same operating model.
(function (root) {
  'use strict';

  const STRATEGIES = {
    rental: 'Long-term rental',
    str: 'Short-term rental',
    brrrr: 'BRRRR',
    flip: 'Fix & flip',
  };

  const DEFAULTS = {
    strategy: 'rental',
    propertyName: '',
    address: '',
    cityState: 'Fallon, NV',
    listingUrl: '',

    // Cost assumptions
    purchasePrice: 0,          // D12
    landPct: 0.3,              // D13 = D12 * 0.3
    repairsUpfront: 0,         // D15
    closingCosts: 0,           // D16

    // Rental revenue assumptions. H7:H10 in the spreadsheet allowed four
    // units; here any number of unit groups, each a count of identical units
    // at one monthly rent.
    units: [{ label: 'Unit 1', count: 1, rent: 0 }],
    vacancyRate: 0.05,         // H12
    repairRentalLoss: 0,       // L5 (rent lost while up-front repairs happen)

    // Short-term rental revenue
    strListings: 1,
    nightlyRate: 0,
    occupancy: 0.65,
    avgStay: 3,                // nights per booking
    cleaningFeeCharged: 0,     // per booking, paid by the guest
    cleaningCost: 0,           // per booking, paid to the cleaner
    platformFeePct: 0.03,      // host fee, % of booking revenue
    furnishing: 0,             // one-time, added to cash invested
    strSupplies: 0,            // monthly, per listing

    // Financing assumptions
    downPaymentPct: 0,         // H16
    interestRate: 0,           // H19
    interestOnly: false,       // H20
    loanYears: 30,             // H21

    // BRRRR / flip
    arv: 0,                    // after-repair value
    rehabMonths: 4,
    refiLtv: 0.75,
    refiRate: 0.07,
    refiYears: 30,
    refiClosingCosts: 0,
    holdMonths: 6,             // flip: months from purchase to sale

    // Appreciation assumptions
    fullValue: 0,              // L7
    appreciationRate: 0.05,    // L8

    // Long-term assumptions (projections)
    rentGrowth: 0.03,
    expenseGrowth: 0.03,
    holdYears: 10,
    sellingCostPct: 0.07,

    // Expenses
    propertyTaxes: 0,          // E34 (annual $)
    insurance: 0,              // E35 (annual $)
    maintenancePct: 0.05,      // E36 (% of gross rent)
    utilities: 0,              // E37 (annual $)
    mgmtPct: 0,                // E38 (% of gross adjusted income)
    mgmtFixed: 0,              // E39 (annual $)
    mortgageInsPct: 0,         // E40 (% of loan amount)
    capexPct: 0.05,            // E41 (% of gross rent)
  };

  // Excel/Sheets PMT, returned as a positive payment.
  function payment(rate, periods, principal) {
    if (periods <= 0 || principal === 0) return 0;
    if (rate === 0) return principal / periods;
    return (principal * rate) / (1 - Math.pow(1 + rate, -periods));
  }

  // Excel/Sheets CUMPRINC for periods start..end (end-of-period payments),
  // returned as a positive amount of principal repaid.
  function cumulativePrincipal(rate, periods, principal, start, end) {
    if (periods <= 0 || principal === 0) return 0;
    const pmt = payment(rate, periods, principal);
    let balance = principal;
    let paid = 0;
    for (let p = 1; p <= Math.min(end, periods); p++) {
      const principalPart = pmt - balance * rate;
      if (p >= start) paid += principalPart;
      balance -= principalPart;
    }
    return paid;
  }

  // Loan balance after `months` payments.
  function balanceAfter(loan, months) {
    if (!loan.amount || loan.interestOnly) return loan.amount;
    const paid = cumulativePrincipal(loan.rate / 12, loan.years * 12, loan.amount, 1, months);
    return Math.max(0, loan.amount - paid);
  }

  function monthlyPayment(loan) {
    return loan.interestOnly
      ? (loan.amount * loan.rate) / 12
      : payment(loan.rate / 12, 12 * loan.years, loan.amount);
  }

  // Internal rate of return for yearly cash flows (flows[0] is today).
  function irr(flows) {
    if (!flows.some((f) => f < 0) || !flows.some((f) => f > 0)) return null;
    const npv = (r) => flows.reduce((a, f, t) => a + f / Math.pow(1 + r, t), 0);
    let lo = -0.9999;
    let hi = 10;
    if (npv(lo) * npv(hi) > 0) return null;
    for (let k = 0; k < 200; k++) {
      const mid = (lo + hi) / 2;
      if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  function safeDiv(a, b) {
    return b ? a / b : null;
  }

  // Accepts the current units list or the older four-rent array.
  function normalizeUnits(input) {
    if (Array.isArray(input.units)) {
      return input.units.map((u, idx) => ({
        label: u.label || `Unit ${idx + 1}`,
        count: Math.max(0, Math.floor(Number(u.count) || 0)),
        rent: Number(u.rent) || 0,
      }));
    }
    if (Array.isArray(input.rents)) {
      return input.rents
        .map((rent, idx) => ({ label: `Unit ${idx + 1}`, count: 1, rent: Number(rent) || 0 }))
        .filter((u, idx) => idx === 0 || u.rent);
    }
    return DEFAULTS.units.map((u) => Object.assign({}, u));
  }

  // One year of operations. `growth` scales income, `costGrowth` scales
  // fixed-dollar expenses; `firstYear` applies the year-1-only rules.
  function operatingYear(i, ctx, growth, costGrowth, firstYear) {
    const str = i.strategy === 'str';
    let grossRent;
    let vacancyLoss = 0;
    let repairLoss = 0;
    const extra = {};

    if (str) {
      const listings = Math.max(0, i.strListings);
      const nights = 365 * i.occupancy * listings;
      const bookings = i.avgStay > 0 ? nights / i.avgStay : 0;
      const bookingRevenue = nights * i.nightlyRate * growth;
      grossRent = bookingRevenue + bookings * i.cleaningFeeCharged * growth;
      extra.platformFees = i.platformFeePct * grossRent;
      extra.cleaning = bookings * i.cleaningCost * costGrowth;
      extra.supplies = i.strSupplies * 12 * listings * costGrowth;
      ctx.bookings = bookings;
      ctx.nightsBooked = nights;
    } else {
      grossRent = ctx.monthlyRent * 12 * growth;                         // F27
      repairLoss = firstYear && i.strategy === 'rental' ? -i.repairRentalLoss : 0; // F30
      // The spreadsheet skips the vacancy allowance in a year that already
      // carries rent lost to up-front repairs.
      vacancyLoss = repairLoss === 0 ? -grossRent * i.vacancyRate : 0;   // F29
    }
    const grossAdjustedIncome = grossRent + vacancyLoss + repairLoss;    // F31

    const expenses = Object.assign({
      propertyTaxes: i.propertyTaxes * costGrowth,                       // F34
      insurance: i.insurance * costGrowth,                               // F35
      maintenance: i.maintenancePct * grossRent,                         // F36
      utilities: i.utilities * costGrowth,                               // F37
      mgmtVariable: i.mgmtPct * grossAdjustedIncome,                     // F38
      mgmtFixed: i.mgmtFixed * costGrowth,                               // F39
      mortgageInsurance: i.mortgageInsPct * ctx.loanForInsurance,        // F40
      capex: i.capexPct * grossRent,                                     // F41
    }, extra);
    const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0); // F42
    const noi = grossAdjustedIncome - totalExpenses;                     // F45
    return { grossRent, vacancyLoss, repairLoss, grossAdjustedIncome, expenses, totalExpenses, noi };
  }

  function analyze(input) {
    const i = Object.assign({}, DEFAULTS, input);
    if (!STRATEGIES[i.strategy]) i.strategy = 'rental';
    const units = normalizeUnits(input || {});

    // Cost assumptions
    const landValue = i.purchasePrice * i.landPct;                       // D13
    const buildingValue = i.purchasePrice - landValue;                   // D14
    const totalCost = i.purchasePrice + i.repairsUpfront + i.closingCosts; // D17

    // Purchase financing
    const monthlyRent = units.reduce((a, u) => a + u.count * u.rent, 0); // H11
    const doors = i.strategy === 'str' ? Math.max(0, i.strListings) : units.reduce((a, u) => a + u.count, 0);
    const loan = {
      amount: (1 - i.downPaymentPct) * i.purchasePrice,                  // H17
      rate: i.interestRate,
      years: i.loanYears,
      interestOnly: i.interestOnly,
    };
    const downPayment = i.downPaymentPct * i.purchasePrice;              // H18
    const purchaseMortgage = monthlyPayment(loan);                       // H22
    const carryingPerMonth = (i.propertyTaxes + i.insurance + i.utilities) / 12;

    const base = {
      strategy: i.strategy,
      units, doors, landValue, buildingValue, totalCost, monthlyRent, downPayment,
      loanAmount: loan.amount,
    };

    if (i.strategy === 'flip') return Object.assign(base, analyzeFlip(i, loan, purchaseMortgage, carryingPerMonth));

    // Hold strategies: rental, short-term rental, BRRRR (after refinance).
    let operatingLoan = loan;
    let cashInvested = downPayment + i.repairsUpfront + i.closingCosts;  // H23
    let value = i.fullValue || i.purchasePrice;
    let brrrr = null;

    if (i.strategy === 'str') cashInvested += i.furnishing;

    if (i.strategy === 'brrrr') {
      const holdingCosts = i.rehabMonths * (purchaseMortgage + carryingPerMonth);
      const refiLoan = i.arv * i.refiLtv;
      const payoff = balanceAfter(loan, i.rehabMonths);
      const cashOut = refiLoan - payoff - i.refiClosingCosts;
      const cashIn = cashInvested + holdingCosts;
      brrrr = {
        holdingCosts, refiLoan, payoff, cashOut, cashIn,
        cashLeftInDeal: cashIn - cashOut,
        equityAfterRefi: i.arv - refiLoan,
      };
      operatingLoan = { amount: refiLoan, rate: i.refiRate, years: i.refiYears, interestOnly: false };
      cashInvested = brrrr.cashLeftInDeal;
      value = i.arv || value;
    }

    const ctx = { monthlyRent, loanForInsurance: operatingLoan.amount };
    const op = operatingYear(i, ctx, 1, 1, true);
    const monthlyMortgage = monthlyPayment(operatingLoan);
    const annualMortgage = monthlyMortgage * 12;                         // F49
    const annualCashFlow = op.noi - annualMortgage;                      // F50
    const principalPaydown = operatingLoan.interestOnly || !operatingLoan.amount // F52
      ? 0
      : cumulativePrincipal(operatingLoan.rate / 12, 12 * operatingLoan.years, operatingLoan.amount, 1, 12);
    // F58 uses the full value; when it's left blank, fall back to the price.
    const appreciation = value * i.appreciationRate;
    const returnCashflowAmort = annualCashFlow + principalPaydown;       // F56
    const returnTotal = returnCashflowAmort + appreciation;              // F59
    // In a BRRRR that returns all the cash put in, returns on cash are infinite.
    const onCash = (n) => (cashInvested > 0 ? n / cashInvested : cashInvested <= 0 && i.strategy === 'brrrr' && n > 0 ? Infinity : null);

    return Object.assign(base, op, {
      brrrr,
      bookings: ctx.bookings || 0,
      nightsBooked: ctx.nightsBooked || 0,
      operatingLoanAmount: operatingLoan.amount,
      monthlyMortgage,
      cashInvested,
      expenseRatio: safeDiv(op.totalExpenses - op.vacancyLoss, op.grossRent), // F43
      monthlyNoi: op.noi / 12,
      annualMortgage,
      annualCashFlow,
      monthlyCashFlow: annualCashFlow / 12,
      principalPaydown,
      appreciation,
      cashOnCash: onCash(annualCashFlow),                                // F54
      returnCashflowAmort,
      roiCashflowAmort: onCash(returnCashflowAmort),                     // F57
      returnTotal,
      roiTotal: onCash(returnTotal),                                     // F60
      // Common investor metrics not in the original sheet.
      capRate: safeDiv(op.noi, i.strategy === 'brrrr' ? i.arv : i.purchasePrice),
      dscr: safeDiv(op.noi, annualMortgage),
      onePercentRule: i.strategy === 'str' ? null : safeDiv(monthlyRent, i.purchasePrice),
      pricePerDoor: safeDiv(i.purchasePrice, doors),
      cashFlowPerDoor: safeDiv(annualCashFlow / 12, doors),
      projection: project(i, ctx, operatingLoan, value, cashInvested, annualCashFlow),
    });
  }

  function analyzeFlip(i, loan, purchaseMortgage, carryingPerMonth) {
    const months = Math.max(0, i.holdMonths);
    const holdingCosts = months * (purchaseMortgage + carryingPerMonth);
    const sellingCosts = i.arv * i.sellingCostPct;
    const payoff = balanceAfter(loan, months);
    const cashInvested = i.downPaymentPct * i.purchasePrice + i.repairsUpfront + i.closingCosts + holdingCosts;
    const saleProceeds = i.arv - sellingCosts - payoff;
    const profit = saleProceeds - cashInvested;
    const roi = safeDiv(profit, cashInvested);
    return {
      arv: i.arv,
      holdMonths: months,
      holdingCosts,
      sellingCosts,
      payoff,
      monthlyMortgage: purchaseMortgage,
      cashInvested,
      saleProceeds,
      profit,
      roi,
      annualizedRoi: roi !== null && months > 0 && roi > -1 ? Math.pow(1 + roi, 12 / months) - 1 : null,
      // Rule of thumb: pay no more than 70% of ARV minus repairs.
      maxOffer70: i.arv * 0.7 - i.repairsUpfront,
      profitMargin: safeDiv(profit, i.arv),
      // Fields the dashboard reads for every strategy.
      monthlyCashFlow: null,
      annualCashFlow: null,
      cashOnCash: null,
      capRate: null,
      dscr: null,
      roiTotal: roi,
      returnTotal: profit,
      pricePerDoor: null,
      cashFlowPerDoor: null,
      projection: null,
    };
  }

  // Year-by-year projection for hold strategies, with a sale at the end of
  // each year to show what an exit then would return.
  function project(i, ctx, loan, startValue, cashInvested, year1CashFlow) {
    const years = Math.max(1, Math.min(40, Math.round(i.holdYears) || 10));
    const pmt = monthlyPayment(loan) * 12;
    const rows = [];
    let cumulative = 0;
    for (let y = 1; y <= Math.max(years, 30); y++) {
      const op = operatingYear(i, ctx, Math.pow(1 + i.rentGrowth, y - 1), Math.pow(1 + i.expenseGrowth, y - 1), y === 1);
      const cashFlow = y === 1 ? year1CashFlow : op.noi - pmt;
      cumulative += cashFlow;
      const value = startValue * Math.pow(1 + i.appreciationRate, y);
      const balance = balanceAfter(loan, y * 12);
      const saleNet = value * (1 - i.sellingCostPct) - balance;
      rows.push({
        year: y, grossRent: op.grossRent, noi: op.noi, cashFlow, cumulativeCashFlow: cumulative,
        value, loanBalance: balance, equity: value - balance, saleNet,
        totalProfit: cumulative + saleNet - cashInvested,
      });
    }
    const exit = rows[years - 1];
    const flows = [-cashInvested].concat(rows.slice(0, years).map((r, k) => r.cashFlow + (k === years - 1 ? r.saleNet : 0)));
    return {
      holdYears: years,
      rows,
      exit,
      irr: cashInvested > 0 ? irr(flows) : null,
      equityMultiple: cashInvested > 0 ? (exit.cumulativeCashFlow + exit.saleNet) / cashInvested : null,
    };
  }

  const api = { STRATEGIES, DEFAULTS, analyze, normalizeUnits, payment, cumulativePrincipal, irr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RentalCalc = api;
})(typeof self !== 'undefined' ? self : this);
