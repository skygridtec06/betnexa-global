import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useUser } from "@/context/UserContext";

const TermsAndConditions = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useUser();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Terms & Conditions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Last updated: April 21, 2026
            </p>
          </div>
        </div>

        {/* Terms Content */}
        <div className="prose prose-invert max-w-none space-y-6 text-foreground">
          {/* Introduction */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to BETNEXA ("we," "our," "us," or "Company"). These Terms and Conditions ("Terms") 
              govern your use of our website, mobile application, and all related services (collectively, the "Platform"). 
              By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree with any part 
              of these Terms, please discontinue use of the Platform immediately.
            </p>
          </section>

          {/* User Eligibility */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">2. User Eligibility</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-3">
                <span className="text-primary font-bold">2.1</span>
                <span>You must be at least 18 years of age to use this Platform.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">2.2</span>
                <span>You are responsible for ensuring that your use of the Platform complies with all applicable laws and regulations in your jurisdiction.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">2.3</span>
                <span>You may not use the Platform if you are from a jurisdiction where sports betting is prohibited or restricted.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">2.4</span>
                <span>You warrant that all information you provide is accurate, truthful, and complete.</span>
              </li>
            </ul>
          </section>

          {/* Account Registration */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">3. Account Registration and Security</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-3">
                <span className="text-primary font-bold">3.1</span>
                <span>You agree to provide accurate and complete information during the registration process.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">3.2</span>
                <span>You are responsible for maintaining the confidentiality of your account credentials and password.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">3.3</span>
                <span>You are fully responsible for all activities that occur under your account.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">3.4</span>
                <span>You must notify us immediately of any unauthorized access or security breach.</span>
              </li>
            </ul>
          </section>

          {/* Betting and Wagering */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">4. Betting and Wagering</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-3">
                <span className="text-primary font-bold">4.1</span>
                <span>All bets placed on the Platform are at your sole risk and discretion.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">4.2</span>
                <span>Odds are subject to change at any time without notice. Once a bet is accepted, odds are locked.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">4.3</span>
                <span>We reserve the right to cancel, void, or suspend any bet that appears to be fraudulent or in violation of these Terms.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">4.4</span>
                <span>Minimum and maximum betting limits apply and may be adjusted at our discretion.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">4.5</span>
                <span>Bets must be placed before the start of the event. Late bets are not accepted.</span>
              </li>
            </ul>
          </section>

          {/* Deposits and Withdrawals */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">5. Deposits and Withdrawals</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-3">
                <span className="text-primary font-bold">5.1</span>
                <span>Deposits are processed via M-Pesa or other approved payment methods.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">5.2</span>
                <span>All deposits are subject to a verification process to prevent fraud and money laundering.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">5.3</span>
                <span>Withdrawal requests must be submitted through your account dashboard.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">5.4</span>
                <span>Withdrawal activation fee applies. Details are available in your account settings.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">5.5</span>
                <span>Processing times vary. We aim to process withdrawals within 24-48 hours.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">5.6</span>
                <span>We reserve the right to deny withdrawal requests that appear suspicious or fraudulent.</span>
              </li>
            </ul>
          </section>

          {/* Settlement and Disputes */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">6. Settlement and Disputes</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-3">
                <span className="text-primary font-bold">6.1</span>
                <span>All bets are settled based on official match results and statistics.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">6.2</span>
                <span>Settlement typically occurs within 24 hours of match completion.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">6.3</span>
                <span>In case of disputes, we will investigate and make a final determination within 7 days.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">6.4</span>
                <span>Cancelled matches will result in void bets unless otherwise stated.</span>
              </li>
            </ul>
          </section>

          {/* Responsible Gambling */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">7. Responsible Gambling</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-3">
                <span className="text-primary font-bold">7.1</span>
                <span>We are committed to promoting responsible gambling and preventing problem gambling.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">7.2</span>
                <span>You acknowledge that gambling involves risk and you may lose money.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">7.3</span>
                <span>If you believe you have a gambling problem, please seek help from appropriate support services.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">7.4</span>
                <span>We reserve the right to suspend or close accounts showing signs of problem gambling.</span>
              </li>
            </ul>
          </section>

          {/* Prohibited Activities */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">8. Prohibited Activities</h2>
            <p className="text-muted-foreground mb-4">You agree not to:</p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-3">
                <span className="text-primary">•</span>
                <span>Engage in fraud, match-fixing, or any illegal activities</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary">•</span>
                <span>Use multiple accounts or create accounts for other individuals</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary">•</span>
                <span>Attempt to manipulate betting markets or odds</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary">•</span>
                <span>Use bots, scripts, or automated tools to access the Platform</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary">•</span>
                <span>Harass, threaten, or abuse other users or staff members</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary">•</span>
                <span>Share your account credentials with third parties</span>
              </li>
            </ul>
          </section>

          {/* Limitation of Liability */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">9. Limitation of Liability</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-3">
                <span className="text-primary font-bold">9.1</span>
                <span>The Platform is provided "as is" without any warranties or guarantees.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">9.2</span>
                <span>We are not liable for any direct, indirect, incidental, or consequential damages arising from your use of the Platform.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">9.3</span>
                <span>Your total liability is limited to the amount you have deposited on the Platform.</span>
              </li>
            </ul>
          </section>

          {/* Account Suspension and Termination */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">10. Account Suspension and Termination</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-3">
                <span className="text-primary font-bold">10.1</span>
                <span>We reserve the right to suspend or terminate your account if you violate these Terms.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">10.2</span>
                <span>Banned users forfeit all remaining balances on their accounts.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">10.3</span>
                <span>You may request account termination at any time through your account settings.</span>
              </li>
            </ul>
          </section>

          {/* Changes to Terms */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">11. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting. 
              Your continued use of the Platform constitutes acceptance of the modified Terms.
            </p>
          </section>

          {/* Contact Information */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold text-primary mb-4">12. Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              If you have any questions about these Terms and Conditions, please contact us:
            </p>
            <div className="space-y-2 text-muted-foreground">
              <p>Email: support@betnexa.co.ke</p>
              <p>Website: https://betnexa.co.ke</p>
              <p>Jurisdiction: Kenya</p>
            </div>
          </section>

          {/* Acknowledgment */}
          <section className="rounded-lg border border-primary/20 bg-primary/10 p-6">
            <p className="text-foreground font-semibold">
              By using the BETNEXA Platform, you acknowledge that you have read, understood, and agree to be bound 
              by these Terms and Conditions. Your use of the Platform constitutes acceptance of these Terms.
            </p>
          </section>
        </div>
      </div>

      {isLoggedIn && <BottomNav />}
    </div>
  );
};

export default TermsAndConditions;
