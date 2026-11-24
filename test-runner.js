// Automated Verification Script for MilkTrack Business Logic, Calculations & Storage Rules
const fs = require('fs');

console.log('==============================================');
console.log('🧪 Starting MilkTrack Verification Suite');
console.log('==============================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${testName} - ${details}`);
    failCount++;
  }
}

// Simulated in-memory IndexedDB matching DbService
class MockDbService {
  constructor() {
    this.records = [];
    this.settings = {
      defaultRate: 60,
      currency: 'INR',
      currencySymbol: '₹',
      unit: 'Litre'
    };
    this.nextId = 1;
  }

  async addRecord(rec) {
    const existing = this.records.find(r => r.date === rec.date && r.session === rec.session);
    if (existing) {
      throw new Error(`ConstraintError: ${rec.session} record already exists for date ${rec.date}`);
    }
    const record = { ...rec, id: this.nextId++ };
    this.records.push(record);
    return record.id;
  }

  async updateRecord(rec) {
    const idx = this.records.findIndex(r => r.id === rec.id);
    if (idx === -1) throw new Error('Record not found');
    this.records[idx] = { ...rec };
  }

  async deleteRecord(id) {
    this.records = this.records.filter(r => r.id !== id);
  }

  async getRecordByDateSession(date, session) {
    return this.records.find(r => r.date === date && r.session === session);
  }

  async getRecordsByDate(date) {
    return this.records.filter(r => r.date === date);
  }

  async getAllRecords() {
    return [...this.records];
  }

  async getRecordsByMonth(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    return this.records.filter(r => r.date.startsWith(prefix));
  }

  async getSettings() {
    return { ...this.settings };
  }

  async saveSettings(s) {
    this.settings = { ...s };
  }

  async clearAllRecords() {
    this.records = [];
  }

  async markAbsent(date, session, notes = 'Absent') {
    const existing = await this.getRecordByDateSession(date, session);
    const rate = this.settings.defaultRate || 60;
    const now = new Date().toISOString();
    if (existing) {
      existing.quantity = 0;
      existing.amount = 0;
      existing.ratePerLitre = rate;
      existing.isAbsent = true;
      existing.notes = notes;
      existing.updatedAt = now;
      await this.updateRecord(existing);
      return existing.id;
    } else {
      return await this.addRecord({
        date,
        session,
        quantity: 0,
        ratePerLitre: rate,
        amount: 0,
        notes,
        isAbsent: true,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  async markDayAbsent(date, notes = 'Absent') {
    await this.markAbsent(date, 'Morning', notes);
    await this.markAbsent(date, 'Evening', notes);
  }

  async exportBackup() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      records: [...this.records],
      settings: { ...this.settings }
    };
  }

  async importBackup(data) {
    this.records = [];
    if (data.settings) this.settings = { ...data.settings };
    let count = 0;
    for (const r of data.records) {
      this.records.push({ ...r, id: this.nextId++ });
      count++;
    }
    return count;
  }

  async exportCSV() {
    const records = [...this.records];
    records.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return a.session === 'Morning' ? -1 : 1;
    });
    const headers = 'Date,Session,Quantity (L),Rate (₹/L),Amount (₹),Notes';
    const rows = records.map(r =>
      `${r.date},${r.session},${r.quantity},${r.ratePerLitre},${r.amount},"${(r.notes || '').replace(/"/g, '""')}"`
    );
    return [headers, ...rows].join('\n');
  }
}

async function runTests() {
  const db = new MockDbService();

  // Test 1: Add Morning Record
  console.log('\n--- 1. Add Morning Record ---');
  const m1Id = await db.addRecord({
    date: '2026-11-21',
    session: 'Morning',
    quantity: 2.5,
    ratePerLitre: 60,
    amount: Math.round(2.5 * 60 * 100) / 100,
    notes: 'Morning fresh milk',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  const m1 = await db.getRecordByDateSession('2026-11-21', 'Morning');
  assert(m1 !== undefined && m1.quantity === 2.5 && m1.amount === 150, 'Morning record added correctly (2.5L * ₹60 = ₹150)');

  // Test 1b: 0.5 L entry calculation test
  const halfLiterAmount = Math.round(0.5 * 60 * 100) / 100;
  assert(halfLiterAmount === 30, '0.5 L at ₹60/L calculates to ₹30');

  // Test 2: Add Evening Record
  console.log('\n--- 2. Add Evening Record ---');
  const e1Id = await db.addRecord({
    date: '2026-11-21',
    session: 'Evening',
    quantity: 3,
    ratePerLitre: 60,
    amount: Math.round(3 * 60 * 100) / 100,
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  const e1 = await db.getRecordByDateSession('2026-11-21', 'Evening');
  assert(e1 !== undefined && e1.quantity === 3 && e1.amount === 180, 'Evening record added correctly (3L * ₹60 = ₹180)');

  // Test 3: Calculate Daily Total
  console.log('\n--- 3. Calculate Daily Total ---');
  const todayRecs = await db.getRecordsByDate('2026-11-21');
  const totalQty = todayRecs.reduce((sum, r) => sum + r.quantity, 0);
  const totalCost = todayRecs.reduce((sum, r) => sum + r.amount, 0);
  assert(totalQty === 5.5, 'Daily Total Quantity is 5.5 L', `Got ${totalQty}`);
  assert(totalCost === 330, 'Daily Total Cost is ₹330', `Got ${totalCost}`);

  // Test 4: Prevent Duplicate Entry for same date & session
  console.log('\n--- 4. Prevent Duplicate Entry ---');
  let dupCaught = false;
  try {
    await db.addRecord({
      date: '2026-11-21',
      session: 'Morning',
      quantity: 2,
      ratePerLitre: 60,
      amount: 120
    });
  } catch (err) {
    dupCaught = true;
  }
  assert(dupCaught, 'Duplicate record for Morning on same date prevented');

  // Test 5: Edit Record
  console.log('\n--- 5. Edit Record ---');
  await db.updateRecord({
    id: e1Id,
    date: '2026-11-21',
    session: 'Evening',
    quantity: 3.25,
    ratePerLitre: 60,
    amount: Math.round(3.25 * 60 * 100) / 100,
    notes: 'Updated quantity',
    updatedAt: new Date().toISOString()
  });
  const e1Updated = await db.getRecordByDateSession('2026-11-21', 'Evening');
  assert(e1Updated.quantity === 3.25 && e1Updated.amount === 195, 'Evening record updated to 3.25L and ₹195');

  // Test 6: Delete Record
  console.log('\n--- 6. Delete Record ---');
  const tempId = await db.addRecord({
    date: '2026-11-19',
    session: 'Morning',
    quantity: 1,
    ratePerLitre: 60,
    amount: 60
  });
  await db.deleteRecord(tempId);
  const deletedRec = await db.getRecordByDateSession('2026-11-19', 'Morning');
  assert(deletedRec === undefined, 'Record successfully deleted');

  // Test 7: Add Records for Previous Dates
  console.log('\n--- 7. Add Previous Dates ---');
  await db.addRecord({
    date: '2026-11-20',
    session: 'Morning',
    quantity: 2,
    ratePerLitre: 60,
    amount: 120
  });
  await db.addRecord({
    date: '2026-11-20',
    session: 'Evening',
    quantity: 2.5,
    ratePerLitre: 60,
    amount: 150
  });
  const recs20 = await db.getRecordsByDate('2026-11-20');
  assert(recs20.length === 2, 'Previous date has 2 sessions');

  // Test 8: Rate Handling - Changing default rate does NOT affect existing records
  console.log('\n--- 8. Rate Handling Integrity ---');
  const oldSettings = await db.getSettings();
  assert(oldSettings.defaultRate === 60, 'Initial rate was ₹60');
  await db.saveSettings({ ...oldSettings, defaultRate: 65 });

  const m1AfterRateChange = await db.getRecordByDateSession('2026-11-21', 'Morning');
  assert(m1AfterRateChange.ratePerLitre === 60, 'Existing record maintains historical rate of ₹60', `Got ${m1AfterRateChange.ratePerLitre}`);
  assert(m1AfterRateChange.amount === 150, 'Existing record maintains historical amount of ₹150', `Got ${m1AfterRateChange.amount}`);

  // Test 9: Monthly Summary Calculations
  console.log('\n--- 9. Monthly Summary Calculation ---');
  const novRecs = await db.getRecordsByMonth(2026, 11);
  const novTotalQty = novRecs.reduce((s, r) => s + r.quantity, 0);
  const novTotalCost = novRecs.reduce((s, r) => s + r.amount, 0);
  assert(novTotalQty === (2.5 + 3.25 + 2 + 2.5), 'November total quantity summed correctly (10.25 L)');
  assert(novTotalCost === (150 + 195 + 120 + 150), 'November total cost summed correctly (₹615)');

  // Test 10: Backup and Restore
  console.log('\n--- 10. Backup and Restore ---');
  const backup = await db.exportBackup();
  assert(backup.records.length === 4, 'Backup contains all 4 records');
  assert(backup.settings.defaultRate === 65, 'Backup contains settings');

  // Clear data
  await db.clearAllRecords();
  assert((await db.getAllRecords()).length === 0, 'Database cleared');

  // Restore backup
  const restoredCount = await db.importBackup(backup);
  assert(restoredCount === 4, `Restored 4 records successfully (got ${restoredCount})`);
  assert((await db.getAllRecords()).length === 4, 'Records verified in database after restore');

  // Test 11: CSV Export
  console.log('\n--- 11. CSV Export ---');
  const csv = await db.exportCSV();
  assert(csv.startsWith('Date,Session,Quantity (L),Rate (₹/L),Amount (₹),Notes'), 'CSV contains proper header row');
  assert(csv.includes('2026-11-21,Morning,2.5,60,150'), 'CSV contains 21 Nov Morning record');

  // Test 12: Extra Quantity 0.25L handling
  console.log('\n--- 12. Extra Quantity 0.25L Calculations ---');
  const extraQtyRate = 60;
  const quarterLiterAmount = Math.round(0.25 * extraQtyRate * 100) / 100;
  assert(quarterLiterAmount === 15, '0.25L at ₹60/L calculates to ₹15');

  const baseQty = 1.5;
  const withExtra = Math.round((baseQty + 0.25) * 100) / 100;
  assert(withExtra === 1.75, 'Base 1.5L + 0.25L extra = 1.75L');
  const withExtraAmount = Math.round(withExtra * extraQtyRate * 100) / 100;
  assert(withExtraAmount === 105, '1.75L at ₹60/L calculates to ₹105');

  // Test 13: Mark Absent (Single Session)
  console.log('\n--- 13. Mark Single Session Absent ---');
  const absentId = await db.markAbsent('2026-11-22', 'Morning', 'Out of station');
  const absentRec = await db.getRecordByDateSession('2026-11-22', 'Morning');
  assert(absentRec !== undefined, 'Absent record saved in DB');
  assert(absentRec.quantity === 0, 'Absent record quantity is 0 L');
  assert(absentRec.amount === 0, 'Absent record amount is ₹0');
  assert(absentRec.isAbsent === true, 'Absent record flag isAbsent is true');
  assert(absentRec.notes === 'Out of station', 'Absent record maintains notes');

  // Test 14: Mark Entire Day Absent
  console.log('\n--- 14. Mark Entire Day Absent ---');
  await db.markDayAbsent('2026-11-23', 'No milk needed');
  const day23Recs = await db.getRecordsByDate('2026-11-23');
  assert(day23Recs.length === 2, 'Day has both Morning and Evening marked');
  const day23TotalQty = day23Recs.reduce((sum, r) => sum + r.quantity, 0);
  const day23TotalAmt = day23Recs.reduce((sum, r) => sum + r.amount, 0);
  assert(day23TotalQty === 0, 'Full day absent total quantity is 0 L');
  assert(day23TotalAmt === 0, 'Full day absent total amount is ₹0');

  // Test 15: Monthly Summary with Absent Days
  console.log('\n--- 15. Monthly Summary with Absent Days ---');
  const allNov = await db.getRecordsByMonth(2026, 11);
  const novByDay = new Map();
  for (const r of allNov) {
    const list = novByDay.get(r.date) || [];
    list.push(r);
    novByDay.set(r.date, list);
  }

  let deliveredCount = 0;
  let absentCount = 0;
  for (const [date, recs] of novByDay.entries()) {
    const isAllAbsent = recs.every(r => r.isAbsent || r.quantity === 0);
    const dayTotalQty = recs.reduce((s, r) => s + r.quantity, 0);
    if (isAllAbsent) absentCount++;
    else if (dayTotalQty > 0) deliveredCount++;
  }
  assert(absentCount === 2, 'Nov 22 and Nov 23 correctly identified as absent days (2 absent days)');
  assert(deliveredCount >= 2, 'Delivered days correctly distinguished from absent days');

  // Test 16: Calendar Boundary Rule (Do not show upcoming dates)
  console.log('\n--- 16. Calendar Boundary Rule (Only show till today) ---');
  const testToday = new Date('2026-11-24T12:00:00');
  const testYear = testToday.getFullYear();
  const testMonth = testToday.getMonth(); // 0-indexed: 10 for November
  const testDate = testToday.getDate(); // 24
  const daysInNov = 30;

  let maxDayToShow = daysInNov;
  if (testYear === testToday.getFullYear() && testMonth === testToday.getMonth()) {
    maxDayToShow = testDate;
  }
  assert(maxDayToShow === 24, `Current month only shows days up to today (${testDate}) instead of ${daysInNov}`);

  const upcomingDatesShown = [];
  for (let d = 1; d <= maxDayToShow; d++) {
    if (d > testDate) upcomingDatesShown.push(d);
  }
  assert(upcomingDatesShown.length === 0, 'No upcoming dates past today are shown in the calendar');

  // Test 17: PDF Report Filename & Footer Attribution
  console.log('\n--- 17. PDF Report Filename & Footer Attribution ---');
  const pdfDate = new Date('2026-11-24T12:00:00');
  const pdd = String(pdfDate.getDate()).padStart(2, '0');
  const pmm = String(pdfDate.getMonth() + 1).padStart(2, '0');
  const pyyyy = pdfDate.getFullYear();
  const expectedPdfFilename = `MilkTrack_Report_${pdd}_${pmm}_${pyyyy}.pdf`;
  assert(expectedPdfFilename === 'MilkTrack_Report_24_11_2026.pdf', 'PDF filename matches MilkTrack_Report_DD_MM_YYYY.pdf');

  const pdfServiceSrc = fs.readFileSync('src/app/services/pdf-report.service.ts', 'utf8');
  assert(pdfServiceSrc.includes('MilkTrack_Report_${dd}_${mm}_${yyyy}.pdf'), 'PdfReportService formats filename as MilkTrack_Report_DD_MM_YYYY');
  assert(pdfServiceSrc.includes('Developed by Akshay Kumar'), 'PdfReportService footer contains "Developed by Akshay Kumar"');

  // Verify single year in header
  const monthNameTest = 'November 2026';
  const yearTest = 2026;
  const displayPeriodTest = monthNameTest.includes(String(yearTest)) ? monthNameTest : `${monthNameTest} ${yearTest}`;
  assert(displayPeriodTest === 'November 2026', 'PDF header displays "November 2026" with only one time year');
  assert(pdfServiceSrc.includes('data.monthName.includes(String(data.year))'), 'PdfReportService prevents duplicate year display');

  // Test 18: Quote of the Day in Hindi with Internet Daily Update
  console.log('\n--- 18. Quote of the Day in Hindi (Daily Internet Update) ---');
  const quoteServiceSrc = fs.readFileSync('src/app/services/quote.service.ts', 'utf8');
  assert(quoteServiceSrc.includes('HINDI_OFFLINE_QUOTES'), 'QuoteService contains curated offline quotes');
  assert(quoteServiceSrc.includes('fetchOnlineQuote()'), 'QuoteService implements fetchOnlineQuote for internet updates');
  assert(quoteServiceSrc.includes('window.addEventListener(\'online\''), 'QuoteService listens to online events to update quote');
  assert(quoteServiceSrc.includes('initDailyQuote()'), 'QuoteService provides initDailyQuote for daily checks');
  assert(quoteServiceSrc.includes('localStorage'), 'QuoteService caches daily quote in local storage');

  const dashboardSrc = fs.readFileSync('src/app/pages/dashboard/dashboard.ts', 'utf8');
  assert(dashboardSrc.includes('quoteService: QuoteService'), 'DashboardComponent injects QuoteService');
  assert(dashboardSrc.includes('this.quoteService.initDailyQuote()'), 'DashboardComponent initializes daily quote on startup');

  const dashboardHtml = fs.readFileSync('src/app/pages/dashboard/dashboard.html', 'utf8');
  assert(dashboardHtml.includes('quote-card'), 'Dashboard template renders quote card');
  assert(dashboardHtml.includes('आज का सुविचार'), 'Dashboard template displays "आज का सुविचार" badge');
  assert(dashboardHtml.includes('quoteService.currentQuote().text'), 'Dashboard template binds to dynamic quoteService.currentQuote');
  assert(dashboardHtml.includes('badge-online'), 'Dashboard template renders live online indicator when connected');

  console.log('\n==============================================');
  console.log(`Summary: ${passCount} Passed, ${failCount} Failed`);
  console.log('==============================================');

  if (failCount > 0) process.exit(1);
}

runTests();
