import PublicHeader from "@/components/PublicHeader";

const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "PaperMaker PK";

export default function TermsPage() {
  return (
    <>
      <PublicHeader />
      <main className="container" style={{ maxWidth: 800 }}>
        <div className="card">
          <h1>Terms of use & copyright</h1>
          <p><b>{APP}</b> (software, design, templates, OMR layout and code) is the property of <b>Pajee Technologies</b>. © {new Date().getFullYear()} Pajee Technologies. All rights reserved.</p>
          <h3>Your content</h3>
          <p>Questions, papers, student marks and textbooks you upload remain yours. You confirm that you have the right to use any textbook or material you upload for your own institution&apos;s teaching and assessment.</p>
          <h3>Licence</h3>
          <p>Each registered institution gets a non-transferable licence to use the service for its own students. Copying, reselling, reverse-engineering or re-hosting the software without written permission from Pajee Technologies is prohibited.</p>
          <h3>Payments</h3>
          <p>Pro plans are paid manually (JazzCash, EasyPaisa or bank transfer) and activated after the Transaction ID is verified. Plans run for the purchased period.</p>
          <h3>Data & privacy</h3>
          <p>Textbook PDFs, scanned answer sheets and Excel files are processed inside your browser. Only the text, questions and marks you choose to save are stored in our database. Student and parent phone numbers are used only to show WhatsApp links to you.</p>
        </div>
      </main>
    </>
  );
}
