
// Enable client-side functionality (required for onClick handlers and interactivity)
'use client';

import Image from "next/image"; // Optimized Image component for better performance
import { useRouter } from "next/navigation";

// Main home page component - serves as the landing page for the research study
export default function Home() {
  const router = useRouter();

  const handleStartChat = () => {
    router.push('/chat');
  };

  return (
    <div className="min-h-screen white-bg px-4 py-8">
      <div className="max-w-5xl mx-auto">

        {/* HEADER SECTION */}
        <header className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            
            <h1 className="text-5xl font-bold black-text">Welcome!</h1>
          </div>
          <div className="max-w-3xl mx-auto">
            <p className="text-xl black-text leading-relaxed">
              Thank you for participating in this study, part of a project exploring how people connect and build relationships with <strong>other people vs. AI</strong>.
            </p>
          </div>
        </header>

        {/* MAIN CONTENT GRID */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">

          {/* LEFT COLUMN: What will you do? */}
          <div className="white-bg rounded-2xl shadow-lg p-8 lilac-border border-2">
            <div className="flex items-center mb-6">
              <div className="lilac-bg rounded-full p-3 mr-4">
                <span className="white-text text-2xl">📋</span>
              </div>
              <h2 className="text-3xl font-bold black-text">What will you do?</h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-start">
                <div className="lilac-light-bg rounded-full w-8 h-8 flex items-center justify-center mr-4 mt-1 flex-shrink-0">
                  <span className="lilac-dark-text font-bold text-sm">1</span>
                </div>
                <p className="black-text text-lg">You will start with a <strong>brief pre-conversation survey</strong>.</p>
              </div>

              <div className="flex items-start">
                <div className="lilac-light-bg rounded-full w-8 h-8 flex items-center justify-center mr-4 mt-1 flex-shrink-0">
                  <span className="lilac-dark-text font-bold text-sm">2</span>
                </div>
                <p className="black-text text-lg">Next, you&apos;ll be paired with either a <strong>human partner</strong> or an <strong>AI partner</strong> (an LLM, like ChatGPT) to have a structured conversation. You can chat with your partner as you would normally, answering the questions they ask.</p>
              </div>

              <div className="flex items-start">
                <div className="lilac-light-bg rounded-full w-8 h-8 flex items-center justify-center mr-4 mt-1 flex-shrink-0">
                  <span className="lilac-dark-text font-bold text-sm">3</span>
                </div>
                <p className="black-text text-lg">Then, once the conversation ends, you&apos;ll fill out a <strong>final brief survey</strong> about your experience participating in that conversation.</p>
              </div>

              <div className="lilac-light-bg lilac-border border-2 rounded-lg p-4 mt-6">
                <div className="flex items-start">
                  <span className="lilac-dark-text text-xl mr-3">💰</span>
                  <p className="black-text text-base"><strong>Compensation</strong> will be provided to participants who complete all three parts of this study. Participants found to provide fraudulent data or who do not pass the attention checks will not be compensated.</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Important Information */}
          <div className="white-bg rounded-2xl shadow-lg p-8 lilac-border border-2">
            <div className="flex items-center mb-6">
              <div className="lilac-dark-bg rounded-full p-3 mr-4">
                <span className="white-text text-2xl">ℹ️</span>
              </div>
              <h2 className="text-3xl font-bold black-text">Important Information</h2>
            </div>

            <div className="space-y-6">
              <div className="border-l-4 lilac-border pl-4">
                <h3 className="font-bold text-lg black-text mb-2">🔒 Confidentiality</h3>
                <p className="black-text">Your survey responses and chat transcripts will be stored securely and anonymized.</p>
              </div>

              <div className="border-l-4 lilac-border pl-4">
                <h3 className="font-bold text-lg black-text mb-2">🚪 Voluntary Participation</h3>
                <p className="black-text">You can withdraw from this study at any time.</p>
              </div>

              <div className="border-l-4 lilac-border pl-4">
                <h3 className="font-bold text-lg black-text mb-2">✅ Ethics Approval</h3>
                <p className="black-text">This study has been approved by Indiana University Bloomington&apos;s Institutional Review Board.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CALL TO ACTION SECTION */}
        <div className="lilac-bg rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-4 white-text">Ready to Begin?</h2>
          <p className="text-lg mb-8 white-text">Start your participation in our research study</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              className="bg-white text-lilac-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-lilac-50 transition-colors duration-200 shadow-lg"
              onClick={() => window.location.href = '/chat'}
            >
              <span className="text-2xl mr-3">📝</span>
              Start Conversation
            </button>

            <button
              className="bg-lilac-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-lilac-900 transition-colors duration-200"
              onClick={() => window.location.href = '/moderator'}
            >
              <span className="text-xl mr-2">👥</span>
              Moderator Access
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

