/**
 * @loan-generator
 * Deterministic loan application data generator for UDF example setup.
 * Produces deeply nested JSON payloads matching the loan detail extraction UDF schema.
 */

import { mulberry32 } from '../utils/synthetic-data';

// --- Variation pools ---

const FIRST_NAMES = [
  'James', 'Maria', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
];

const MIDDLE_NAMES = [
  'A', 'B', 'C', 'D', 'E', 'J', 'K', 'L', 'M', 'R',
];

const EMPLOYERS = [
  'Acme Corp', 'GlobalTech Inc', 'First National Bank', 'Pacific Holdings', 'Summit Partners',
  'Blue Ridge LLC', 'Northern Trust', 'Atlas Industries', 'Pinnacle Group', 'Horizon Ventures',
  'Silver Oak Capital', 'Redwood Analytics', 'Cascade Systems', 'Vertex Solutions', 'Sterling & Co',
];

const JOB_TITLES = [
  'Software Engineer', 'Product Manager', 'Accountant', 'Nurse Practitioner',
  'Marketing Director', 'Sales Manager', 'Data Analyst', 'Operations Lead',
  'Financial Advisor', 'Project Coordinator', 'HR Specialist', 'Civil Engineer',
];

const LOAN_TYPES = ['CONVENTIONAL', 'FHA', 'VA', 'JUMBO'] as const;
const LOAN_PURPOSES = ['PURCHASE', 'REFINANCE', 'HOME_EQUITY', 'CASH_OUT'] as const;
const FRAUD_RESULTS = ['PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'REVIEW', 'REVIEW', 'FAIL'] as const;
const PROPERTY_TYPES = ['SINGLE_FAMILY', 'CONDO', 'TOWNHOUSE', 'MULTI_FAMILY'] as const;
const ACCOUNT_TYPES = ['MORTGAGE', 'AUTO', 'CREDIT_CARD', 'STUDENT', 'PERSONAL'] as const;
const LENDERS = [
  'Chase', 'Wells Fargo', 'Bank of America', 'Citi', 'US Bank',
  'Capital One', 'Discover', 'Ally', 'SoFi', 'PNC',
];
const ACCOUNT_STATUSES = ['CURRENT', 'CURRENT', 'CURRENT', 'LATE_30', 'LATE_60', 'CLOSED'] as const;
const CONDITIONS = [
  'Verify employment within 10 days',
  'Provide two months bank statements',
  'Obtain flood insurance certificate',
  'Title search must clear liens',
  'Appraisal must meet minimum value',
  'Verify source of down payment funds',
];

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function rangeFloat(min: number, max: number, rng: () => number, decimals = 2): number {
  return parseFloat((min + rng() * (max - min)).toFixed(decimals));
}

function rangeInt(min: number, max: number, rng: () => number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

interface LoanApplicationRecord {
  loan_id: string;
  json_payload: string;
}

export function generateLoanApplication(seed: number): LoanApplicationRecord {
  const rng = mulberry32(seed);

  const loanId = `LN-2024-${String(rangeInt(1, 99999, rng)).padStart(5, '0')}`;
  const firstName = pick(FIRST_NAMES, rng);
  const lastName = pick(LAST_NAMES, rng);
  const middleName = pick(MIDDLE_NAMES, rng);

  const employer = pick(EMPLOYERS, rng);
  const jobTitle = pick(JOB_TITLES, rng);
  const annualIncome = rangeInt(45000, 250000, rng);

  const loanType = pick(LOAN_TYPES, rng);
  const loanPurpose = pick(LOAN_PURPOSES, rng);
  const amountRequested = rangeInt(150000, 900000, rng);
  const interestRate = rangeFloat(5.5, 8.0, rng);
  const termMonths = pick([180, 240, 360] as const, rng);

  const creditScore = rangeInt(580, 850, rng);
  const dtiRatio = rangeFloat(0.15, 0.50, rng);
  const riskLevel = creditScore >= 740 ? 'LOW' : creditScore >= 660 ? 'MODERATE' : 'HIGH';
  const fraudResult = pick(FRAUD_RESULTS, rng);

  // Tradelines: 1-5 accounts
  const tradelineCount = rangeInt(1, 5, rng);
  const tradelines = Array.from({ length: tradelineCount }, () => ({
    account_type: pick(ACCOUNT_TYPES, rng),
    lender: pick(LENDERS, rng),
    balance: rangeInt(500, 300000, rng),
    credit_limit: rangeInt(5000, 500000, rng),
    status: pick(ACCOUNT_STATUSES, rng),
  }));

  // Conditions: 1-3 items
  const conditionCount = rangeInt(1, 3, rng);
  const conditionSet = new Set<string>();
  while (conditionSet.size < conditionCount) {
    conditionSet.add(pick(CONDITIONS, rng));
  }

  const propertyType = pick(PROPERTY_TYPES, rng);
  const appraisedValue = Math.round(amountRequested * rangeFloat(0.90, 1.10, rng));

  const payload = {
    application: {
      applicant: {
        name: { first: firstName, middle: middleName, last: lastName },
        contact: {
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${pick(['gmail.com', 'yahoo.com', 'outlook.com', 'proton.me'] as const, rng)}`,
          phone: `${rangeInt(200, 999, rng)}-${rangeInt(200, 999, rng)}-${rangeInt(1000, 9999, rng)}`,
        },
        ssn_last_four: String(rangeInt(1000, 9999, rng)),
        employment: {
          employer,
          title: jobTitle,
          annual_income: annualIncome,
          years_employed: rangeInt(1, 25, rng),
        },
      },
      loan: {
        type: loanType,
        purpose: loanPurpose,
        amount_requested: amountRequested,
        interest_rate: interestRate,
        term_months: termMonths,
      },
      collateral: {
        property_type: propertyType,
        appraised_value: appraisedValue,
        address: {
          street: `${rangeInt(100, 9999, rng)} ${pick(['Main', 'Oak', 'Elm', 'Maple', 'Cedar', 'Pine'] as const, rng)} St`,
          city: pick(['Denver', 'Austin', 'Portland', 'Seattle', 'Chicago', 'Miami'] as const, rng),
          state: pick(['CO', 'TX', 'OR', 'WA', 'IL', 'FL'] as const, rng),
          zip: String(rangeInt(10000, 99999, rng)),
        },
      },
    },
    underwriting: {
      risk_assessment: {
        risk_level: riskLevel,
        overall_risk: riskLevel,
        credit_analysis: {
          bureau_data: {
            score: creditScore,
            tradelines,
          },
        },
        dti_ratio: dtiRatio,
      },
      fraud_check: {
        result: fraudResult,
        provider: 'LexisNexis',
        timestamp: new Date(2024, 0, 1 + rangeInt(0, 364, rng)).toISOString(),
      },
      conditions: [...conditionSet],
    },
  };

  return {
    loan_id: loanId,
    json_payload: JSON.stringify(payload),
  };
}

export function generateLoanApplicationDataset(
  count: number,
  startSeed = 1000
): LoanApplicationRecord[] {
  return Array.from({ length: count }, (_, i) =>
    generateLoanApplication(startSeed + i)
  );
}
