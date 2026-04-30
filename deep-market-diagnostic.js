/**
 * DEEP DIAGNOSTIC: Market Persistence & Visibility Flow
 * 
 * This script traces:
 * 1. Market save -> database storage
 * 2. Database read -> frontend fetch
 * 3. Frontend display consistency
 * 4. Background sync interference
 * 5. Market regeneration/overwriting
 */

import fetch from 'node-fetch';
import { setTimeout as sleep } from 'timers/promises';

const API_URL = process.env.API_URL || 'https://betnexa-globalback.vercel.app';

class MarketDiagnostic {
  constructor() {
    this.testGameId = null;
    this.results = {
      marketsSaved: {},
      databaseState: {},
      frontendFetches: [],
      syncInterference: [],
      issues: []
    };
  }

  log(stage, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] ${stage}`);
    console.log(`   ${message}`);
    if (data) console.log(`   ${JSON.stringify(data)}`);
  }

  async findTestGame() {
    this.log('STEP 1', 'Finding a manual game to test...');
    try {
      const response = await fetch(`${API_URL}/api/admin/games`);
      const data = await response.json();
      
      if (!data.games || data.games.length === 0) {
        this.results.issues.push('No games found in database');
        return null;
      }

      const manualGame = data.games.find(g => !String(g.id || g.game_id).startsWith('af-'));
      if (!manualGame) {
        this.results.issues.push('No manual games found (all are API-managed)');
        return null;
      }

      this.testGameId = manualGame.id || manualGame.game_id;
      this.log('✅', `Found test game: ${this.testGameId}`, {
        homeTeam: manualGame.home_team,
        awayTeam: manualGame.away_team,
        currentMarketCount: Object.keys(manualGame.markets || {}).length
      });

      return manualGame;
    } catch (error) {
      this.results.issues.push(`Failed to fetch games: ${error.message}`);
      return null;
    }
  }

  async saveTestMarkets() {
    this.log('STEP 2', 'Saving test market values...');
    
    const testMarkets = {
      bttsYes: 1.75,
      over25: 1.88,
      doubleChanceHomeOrDraw: 1.52,
      cs10: 8.25,
      cs20: 12.50,
    };

    try {
      const response = await fetch(`${API_URL}/api/admin/games/${this.testGameId}/markets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: 'admin@test.com',
          markets: testMarkets
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        this.results.issues.push(`Market save failed: ${data.error}`);
        this.log('❌', 'Market save failed', data);
        return null;
      }

      this.results.marketsSaved = testMarkets;
      this.log('✅', 'Markets saved successfully', {
        marketCount: data.marketCount,
        savedMarketsInResponse: data.savedMarkets ? Object.keys(data.savedMarkets).length : 0
      });

      return data.savedMarkets || testMarkets;
    } catch (error) {
      this.results.issues.push(`Save request failed: ${error.message}`);
      return null;
    }
  }

  async checkDatabaseState(checkName) {
    this.log('DATABASE CHECK', `Reading database state (${checkName})...`);
    
    try {
      const response = await fetch(`${API_URL}/api/admin/games`);
      const data = await response.json();
      
      const game = data.games.find(g => (g.id || g.game_id) === this.testGameId);
      if (!game) {
        this.results.issues.push(`Game disappeared from database during ${checkName}`);
        return null;
      }

      const savedState = {
        timestamp: new Date().toISOString(),
        checkName,
        marketCount: Object.keys(game.markets || {}).length,
        markets: game.markets || {},
        sampleMarkets: Object.entries(game.markets || {}).slice(0, 5).reduce((acc, [k, v]) => {
          acc[k] = v;
          return acc;
        }, {})
      };

      // Verify test markets are present
      const testKeys = Object.keys(this.results.marketsSaved);
      const missingKeys = testKeys.filter(k => !(game.markets || {})[k]);
      
      if (missingKeys.length > 0) {
        this.results.issues.push(`Missing markets in DB during ${checkName}: ${missingKeys.join(', ')}`);
        savedState.missingMarkets = missingKeys;
      }

      // Check if values match what was saved
      const valueChanges = [];
      for (const [key, savedValue] of Object.entries(this.results.marketsSaved)) {
        const dbValue = (game.markets || {})[key];
        if (dbValue !== undefined && dbValue !== savedValue) {
          valueChanges.push(`${key}: saved=${savedValue}, db=${dbValue}`);
        }
      }

      if (valueChanges.length > 0) {
        this.results.issues.push(`Market values changed in DB during ${checkName}: ${valueChanges.join('; ')}`);
        savedState.changedValues = valueChanges;
      }

      this.results.databaseState[checkName] = savedState;
      
      this.log('📊', `DB State Check (${checkName})`, {
        totalMarkets: savedState.marketCount,
        testMarketsPresent: testKeys.length - missingKeys.length,
        missingCount: missingKeys.length,
        valuesChanged: valueChanges.length
      });

      return savedState;
    } catch (error) {
      this.results.issues.push(`DB check failed (${checkName}): ${error.message}`);
      return null;
    }
  }

  async monitorFetches(durationMs = 3000, intervalMs = 500) {
    this.log('STEP 4', `Monitoring frontend fetches for ${durationMs}ms...`);
    
    const startTime = Date.now();
    let fetchCount = 0;

    while (Date.now() - startTime < durationMs) {
      try {
        const before = Date.now();
        const response = await fetch(`${API_URL}/api/admin/games`);
        const data = await response.json();
        const fetchTime = Date.now() - before;

        const game = data.games.find(g => (g.id || g.game_id) === this.testGameId);
        if (!game) continue;

        const testKeys = Object.keys(this.results.marketsSaved);
        const present = testKeys.filter(k => (game.markets || {})[k]).length;
        const missing = testKeys.filter(k => !(game.markets || {})[k]);

        const fetchRecord = {
          fetchNum: ++fetchCount,
          timestamp: new Date().toISOString(),
          responseTimeMs: fetchTime,
          totalMarkets: Object.keys(game.markets || {}).length,
          testMarketsPresent: present,
          testMarketsMissing: missing.length,
          sampleValues: Object.entries(game.markets || {}).slice(0, 3).reduce((acc, [k, v]) => {
            acc[k] = v;
            return acc;
          }, {})
        };

        if (missing.length > 0) {
          fetchRecord.missingMarkets = missing;
          this.results.issues.push(`Fetch ${fetchCount}: Missing markets ${missing.join(', ')}`);
        }

        this.results.frontendFetches.push(fetchRecord);

        console.log(`   Fetch ${fetchCount}: ${present}/${testKeys.length} test markets present (${fetchTime}ms)`);

      } catch (error) {
        console.log(`   Fetch error: ${error.message}`);
      }

      await sleep(intervalMs);
    }

    this.log('✅', `Completed ${fetchCount} fetches`, {
      totalFetches: this.results.frontendFetches.length,
      withMissingMarkets: this.results.frontendFetches.filter(f => f.testMarketsMissing > 0).length
    });
  }

  async checkLiveSyncInterference() {
    this.log('STEP 5', 'Checking for live sync overwriting...');
    
    // Check if there are any API-managed games that might trigger sync
    try {
      const response = await fetch(`${API_URL}/api/admin/games`);
      const data = await response.json();
      
      const apiManagedGames = data.games.filter(g => String(g.id || g.game_id).startsWith('af-'));
      
      if (apiManagedGames.length > 0) {
        this.log('⚠️', 'API-managed games found - may trigger live sync', {
          count: apiManagedGames.length,
          liveGames: apiManagedGames.filter(g => g.status === 'live').length,
          upcomingGames: apiManagedGames.filter(g => g.status === 'upcoming').length
        });
      } else {
        this.log('✅', 'No API-managed games - live sync unlikely to interfere');
      }

      // Check if manually_edited_at protection is working
      this.log('🔒', 'Manual edit protection status: Should prevent sync from overwriting', {
        feature: 'manually_edited_at column',
        threshold: '60 seconds'
      });

    } catch (error) {
      this.results.issues.push(`Sync check failed: ${error.message}`);
    }
  }

  async checkMarketMatching() {
    this.log('STEP 6', 'Verifying saved vs fetched market values match exactly...');
    
    try {
      const response = await fetch(`${API_URL}/api/admin/games`);
      const data = await response.json();
      
      const game = data.games.find(g => (g.id || g.game_id) === this.testGameId);
      if (!game) return;

      const comparison = {
        exactMatches: 0,
        typeMismatches: 0,
        valueMismatches: 0,
        missing: []
      };

      for (const [key, savedValue] of Object.entries(this.results.marketsSaved)) {
        const dbValue = (game.markets || {})[key];
        
        if (dbValue === undefined) {
          comparison.missing.push(key);
        } else if (typeof dbValue !== typeof savedValue) {
          comparison.typeMismatches++;
          this.results.issues.push(`Type mismatch for ${key}: saved=${typeof savedValue}, db=${typeof dbValue}`);
        } else if (parseFloat(dbValue) !== parseFloat(savedValue)) {
          comparison.valueMismatches++;
          this.results.issues.push(`Value mismatch for ${key}: saved=${savedValue}, db=${dbValue}`);
        } else {
          comparison.exactMatches++;
        }
      }

      this.log('🔍', 'Market Value Matching Results', comparison);
      
      if (comparison.missing.length > 0) {
        this.results.issues.push(`Missing markets in final check: ${comparison.missing.join(', ')}`);
      }

    } catch (error) {
      this.results.issues.push(`Matching check failed: ${error.message}`);
    }
  }

  async generateReport() {
    this.log('REPORT', 'FINAL DIAGNOSTIC REPORT', null);
    
    console.log('\n' + '='.repeat(80));
    console.log('MARKET PERSISTENCE DIAGNOSTIC REPORT');
    console.log('='.repeat(80));

    console.log('\n📋 TEST SUMMARY');
    console.log('  Game ID:', this.testGameId);
    console.log('  Markets Edited:', Object.keys(this.results.marketsSaved).length);
    console.log('  Total Fetches:', this.results.frontendFetches.length);
    console.log('  Issues Found:', this.results.issues.length);

    if (this.results.issues.length > 0) {
      console.log('\n❌ ISSUES DETECTED:');
      this.results.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
    } else {
      console.log('\n✅ NO ISSUES DETECTED - Markets appear to persist correctly');
    }

    console.log('\n📊 FETCH CONSISTENCY:');
    if (this.results.frontendFetches.length > 0) {
      const withIssues = this.results.frontendFetches.filter(f => f.testMarketsMissing > 0);
      const consistency = ((this.results.frontendFetches.length - withIssues.length) / this.results.frontendFetches.length * 100).toFixed(1);
      console.log(`  Consistent across ${consistency}% of fetches`);
      console.log(`  Fetches with missing markets: ${withIssues.length}`);
      
      if (withIssues.length > 0) {
        console.log('\n  ⚠️ Inconsistent Fetches:');
        withIssues.forEach(f => {
          console.log(`    Fetch ${f.fetchNum}: Missing ${f.missingMarkets.join(', ')}`);
        });
      }
    }

    console.log('\n💾 DATABASE STATE PROGRESSION:');
    for (const [checkName, state] of Object.entries(this.results.databaseState)) {
      console.log(`  ${checkName}: ${state.marketCount} total, ${Object.keys(state.sampleMarkets).length} sample`);
    }

    console.log('\n🎯 DIAGNOSTICS COMPLETE');
    console.log('='.repeat(80));

    return this.results;
  }

  async runFullDiagnostic() {
    console.log('\n🔍 STARTING COMPREHENSIVE MARKET PERSISTENCE DIAGNOSTIC\n');
    
    const game = await this.findTestGame();
    if (!game) {
      this.log('❌', 'Cannot proceed without a test game');
      return this.generateReport();
    }

    // Phase 1: Save markets
    await this.saveTestMarkets();
    if (!this.testGameId) {
      this.log('❌', 'Cannot proceed without successful market save');
      return this.generateReport();
    }

    // Phase 2: Immediate check
    await sleep(100);
    await this.checkDatabaseState('Immediately After Save');

    // Phase 3: Monitor fetches during background processing
    await this.monitorFetches(5000, 400);

    // Phase 4: Check after monitoring
    await this.checkDatabaseState('After Monitoring Period');

    // Phase 5: Check for sync interference
    await this.checkLiveSyncInterference();

    // Phase 6: Final verification
    await this.checkMarketMatching();

    // Phase 7: Generate report
    return this.generateReport();
  }
}

// Run the diagnostic
const diagnostic = new MarketDiagnostic();
diagnostic.runFullDiagnostic().catch(console.error);
