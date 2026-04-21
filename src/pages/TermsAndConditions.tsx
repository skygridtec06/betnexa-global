import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { useUser } from "@/context/UserContext";

const TermsAndConditions = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useUser();

  const handleDownloadPDF = () => {
    try {
      const link = document.createElement("a");
      link.href = "/betnexa-terms.pdf";
      link.download = "betnexa-terms.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading PDF:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex-1 container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Terms & Conditions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Please read our terms and conditions carefully
            </p>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden mb-6">
          <div className="bg-secondary border-b border-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-medium">betnexa-terms.pdf</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>

          {/* PDF Embed */}
          <iframe
            src="/betnexa-terms.pdf"
            className="w-full h-[800px] bg-background"
            title="Terms and Conditions"
          />
        </div>

        {/* Fallback Message */}
        <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            If the PDF viewer doesn't work, you can download and view the PDF directly.
          </p>
          <Button
            onClick={handleDownloadPDF}
            className="w-full sm:w-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Terms & Conditions
          </Button>
        </div>
      </div>

      {isLoggedIn && <BottomNav />}
    </div>
  );
};

export default TermsAndConditions;
