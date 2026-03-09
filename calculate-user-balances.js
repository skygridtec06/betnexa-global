import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://cihtzqcqbxaqniwtnrvr.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpaHR6cWNxYnhhcW5pd3RucnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTI3MjExNDQsImV4cCI6MjAwODI5NzE0NH0.xWXJ4xoLhLITGg7D1BRFM0EVkU2ugaH0ZKwDzR5yHnQ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function calculateUserBalances() {
  try {
    console.log("🔍 Fetching all users...");
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, balance");

    if (usersError) throw usersError;
    console.log(`✅ Found ${users.length} users\n`);

    const updates = [];
    const balanceReport = [];

    for (const user of users) {
      console.log(`\n📊 Processing user: ${user.email} (ID: ${user.id})`);
      console.log(`   Current balance: KSH ${user.balance}`);

      // Get all bets for this user
      const { data: bets, error: betsError } = await supabase
        .from("bets")
        .select("id, stake, status, amount_won")
        .eq("user_id", user.id);

      if (betsError) throw betsError;

      // Separate bets by status
      const wonBets = bets.filter((b) => b.status === "Won");
      const lostBets = bets.filter((b) => b.status === "Lost");
      const openBets = bets.filter((b) => b.status === "Open");

      // Calculate totals
      const totalWon = wonBets.reduce((sum, b) => sum + (b.amount_won || 0), 0);
      const totalLostStakes = lostBets.reduce((sum, b) => sum + (b.stake || 0), 0);
      const totalOpenStakes = openBets.reduce((sum, b) => sum + (b.stake || 0), 0);

      // Formula: won amount - lost stakes - open stakes + 1000 bonus
      const calculatedBalance = totalWon - totalLostStakes - totalOpenStakes + 1000;

      console.log(`   Won bets: ${wonBets.length} | Total won: KSH ${totalWon}`);
      console.log(`   Lost bets: ${lostBets.length} | Total stakes lost: KSH ${totalLostStakes}`);
      console.log(`   Open bets: ${openBets.length} | Total stakes at risk: KSH ${totalOpenStakes}`);
      console.log(`   ➜ Calculation: ${totalWon} - ${totalLostStakes} - ${totalOpenStakes} + 1000`);
      console.log(`   ✓ Calculated balance: KSH ${calculatedBalance}`);

      updates.push({
        userId: user.id,
        email: user.email,
        oldBalance: user.balance,
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
        oldBalance: user.balance,
        newBalance: calculatedBalance,
        difference: calculatedBalance - user.balance,
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
      const { error } = await supabase
        .from("users")
        .update({ balance: update.newBalance })
        .eq("id", update.userId);

      if (error) {
        console.log(`❌ Error updating ${update.email}: ${error.message}`);
      } else {
        console.log(`✅ Updated ${update.email}: KSH ${update.oldBalance} → KSH ${update.newBalance}`);
        successCount++;
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log(`✨ SUCCESS: ${successCount}/${updates.length} users updated`);
    console.log("=".repeat(80));

    return { success: true, updatedCount: successCount, totalCount: updates.length };
  } catch (error) {
    console.error("❌ Error:", error.message);
    return { success: false, error: error.message };
  }
}

calculateUserBalances();
