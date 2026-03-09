const { createClient } = require("@supabase/supabase-js");

// Use environment variables or fallback to known values
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://cihtzqcqbxaqniwtnrvr.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpaHR6cWNxYnhhcW5pd3RucnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTI3MjExNDQsImV4cCI6MjAwODI5NzE0NH0.xWXJ4xoLhLITGg7D1BRFM0EVkU2ugaH0ZKwDzR5yHnQ";

console.log("🔧 Initializing Supabase client...");
console.log(`   URL: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function calculateUserBalances() {
  try {
    console.log("\n🔍 Fetching all users from Supabase...");
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, balance, account_balance");

    if (usersError) {
      console.error("❌ Error fetching users:", usersError);
      throw usersError;
    }

    console.log(`✅ Found ${users.length} users\n`);

    const updates = [];
    const balanceReport = [];

    for (const user of users) {
      console.log(`\n📊 Processing user: ${user.email} (ID: ${user.id})`);
      const currentBalance = user.balance || user.account_balance || 0;
      console.log(`   Current balance: KSH ${currentBalance}`);

      // Get all bets for this user
      const { data: bets, error: betsError } = await supabase
        .from("bets")
        .select("id, stake, status, amount_won")
        .eq("user_id", user.id);

      if (betsError) {
        console.warn(`⚠️ Error fetching bets for user ${user.id}:`, betsError);
        continue;
      }

      // Separate bets by status
      const wonBets = bets.filter((b) => b.status === "Won");
      const lostBets = bets.filter((b) => b.status === "Lost");
      const openBets = bets.filter((b) => b.status === "Open");

      // Calculate totals
      const totalWon = wonBets.reduce((sum, b) => sum + (b.amount_won || 0), 0);
      const totalLostStakes = lostBets.reduce((sum, b) => sum + (b.stake || 0), 0);
      const totalOpenStakes = openBets.reduce((sum, b) => sum + (b.stake || 0), 0);

      // Formula: won amount - lost stakes - open stakes + 1000 bonus
      const calculatedBalance = Math.max(0, totalWon - totalLostStakes - totalOpenStakes + 1000);

      console.log(`   Won bets: ${wonBets.length} | Total won: KSH ${totalWon}`);
      console.log(`   Lost bets: ${lostBets.length} | Total stakes lost: KSH ${totalLostStakes}`);
      console.log(`   Open bets: ${openBets.length} | Total stakes at risk: KSH ${totalOpenStakes}`);
      console.log(`   ➜ Calculation: ${totalWon} - ${totalLostStakes} - ${totalOpenStakes} + 1000`);
      console.log(`   ✓ Calculated balance: KSH ${calculatedBalance}`);

      updates.push({
        userId: user.id,
        email: user.email,
        oldBalance: currentBalance,
        newBalance: calculatedBalance,
        won: totalWon,
        lost: totalLostStakes,
        open: totalOpenStakes,
        wonBets: wonBets.length,
        lostBets: lostBets.length,
        openBets: openBets.length,
      });

      balanceReport.push({
        email: user.email,
        oldBalance: currentBalance,
        newBalance: calculatedBalance,
        difference: calculatedBalance - currentBalance,
      });
    }

    // Display summary
    console.log("\n" + "=".repeat(80));
    console.log("📋 BALANCE CALCULATION SUMMARY");
    console.log("=".repeat(80));

    balanceReport.forEach((report) => {
      const diff = report.difference > 0 ? `+${report.difference}` : report.difference;
      console.log(`${report.email}`);
      console.log(`  Old: KSH ${report.oldBalance} → New: KSH ${report.newBalance} (${diff})`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("🔄 Updating balances in Supabase...");
    console.log("=".repeat(80));

    // Update all balances
    let successCount = 0;
    for (const update of updates) {
      try {
        // Update both balance and account_balance fields
        const { error: updateError } = await supabase
          .from("users")
          .update({ balance: update.newBalance, account_balance: update.newBalance })
          .eq("id", update.userId);

        if (updateError) {
          console.log(`❌ Error updating ${update.email}: ${updateError.message}`);
        } else {
          console.log(`✅ Updated ${update.email}: KSH ${update.oldBalance} → KSH ${update.newBalance}`);
          successCount++;
        }
      } catch (err) {
        console.log(`❌ Exception updating ${update.email}: ${err.message}`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log(`✨ SUCCESS: ${successCount}/${updates.length} users updated`);
    console.log("=".repeat(80));

    console.log("\n📋 Detailed Summary:");
    updates.forEach((u) => {
      console.log(`\n${u.email}:`);
      console.log(`  Bets: Won ${u.wonBets}, Lost ${u.lostBets}, Open ${u.openBets}`);
      console.log(`  Calculation: ${u.won} - ${u.lost} - ${u.open} + 1000 = ${u.newBalance}`);
      console.log(`  Balance: ${u.oldBalance} → ${u.newBalance}`);
    });

    return { success: true, updatedCount: successCount, totalCount: updates.length };
  } catch (error) {
    console.error("❌ Error:", error.message);
    return { success: false, error: error.message };
  }
}

calculateUserBalances();
