// Enable client-side functionality (required for onClick handlers and interactivity)
'use client';

// Import Next.js optimized Image component for better performance
import Image from "next/image";
import { useRouter } from 'next/navigation';

// Main home page component - serves as the landing page for the research study
export default function Home() {
  const router = useRouter();

  const handleStartChat = () => {
    router.push('/chat');
  };

  return (
  <div className="min-h-screen font-serif flex flex-col justify-start items-center relative overflow-hidden" style={{ fontFamily: 'Georgia, Cambria, Times New Roman, Times, serif', fontSize: '1.15rem', height: '100vh' }}>
    {/* Chat avatars for research context */}
    <div className="hidden md:block absolute left-0 top-1/4 z-10" style={{width: '220px', maxWidth: '30vw', transform: 'translateY(-20%)'}}>
      <Image src="/female.png" alt="Participant 1 at computer" width={220} height={170} priority />
    </div>
    <div className="hidden md:block absolute right-0 bottom-1/6 z-10" style={{width: '220px', maxWidth: '30vw', transform: 'translateY(20%)'}}>
      <Image src="/male.png" alt="Participant 2 at computer" width={220} height={170} priority />
    </div>
      {/* Header */}
      <header style={{ 
        background: 'var(--surface-elevated)', 
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)', // matches Tailwind's shadow-sm
        borderBottom: '1px solid var(--primary-light)',
        backdropFilter: 'blur(6px)'
      }}>
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-6xl font-extrabold text-center tracking-tight" style={{ letterSpacing: '-0.02em', color: 'var(--primary)' }}>Research Study</h1>
            <p className="text-lg text-secondary text-center italic mt-1" style={{fontSize: '1.25rem'}}>Human-AI Relationship Study</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl w-full flex-1 flex flex-col justify-center items-center px-6 py-4" style={{minHeight: 0}}>
        <div className="card shadow-lg w-full" style={{ marginBottom: '1.5rem', background: 'var(--surface-elevated)', opacity: 0.93, backdropFilter: 'blur(8px)', borderRadius: '1.25rem', boxShadow: '0 6px 32px rgba(0,0,0,0.10)', padding: '1.5rem 1.5rem' }}>
          <h2 className="text-4xl font-extrabold text-primary mb-6 tracking-tight" style={{letterSpacing: '-0.01em', fontSize: '2.25rem'}}>Welcome!</h2>
          <div className="space-y-7 text-primary leading-relaxed text-xl">
            <p className="text-2xl font-light mb-2" style={{fontFamily: 'Georgia, Cambria, Times New Roman, Times, serif', opacity: 0.96, fontSize: '1.45rem'}}>
              Thank you for participating in this study, part of a project exploring how people connect and build relationships with other people vs. AI.
            </p>
            <div>
              <h3 className="text-xl font-semibold text-accent mb-4">What will you do?</h3>
              <ul className="space-y-3 pl-4">
                <li className="flex items-start gap-3">
                  <span className="text-accent font-bold">•</span>
                  <span className="opacity-90" style={{fontSize: '1.15rem'}}>You will start with a brief pre-conversation survey.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent font-bold">•</span>
                  <span className="opacity-90" style={{fontSize: '1.15rem'}}>Next, you&apos;ll be paired with either a human partner or an AI partner (an LLM, like ChatGPT) to have a structured conversation. You can chat with your partner as you would normally, answering the questions they ask.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent font-bold">•</span>
                  <span className="opacity-90" style={{fontSize: '1.15rem'}}>Then, once the conversation ends, you&apos;ll fill out a final brief survey about your experience participating in that conversation.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent font-bold">•</span>
                  <span className="opacity-90" style={{fontSize: '1.15rem'}}>Compensation will be provided to participants who complete all three parts of this study (pre-conversation survey, conversation, and final post-conversation survey). Participants found to provide fraudulent data or who do not pass the attention checks will not be compensated.</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-accent mb-4">Important Information:</h3>
              <ul className="space-y-3 pl-4">
                <li className="flex items-start gap-3">
                  <span className="text-accent font-bold">•</span>
                  <span className="opacity-90" style={{fontSize: '1.15rem'}}><strong>Confidentiality:</strong> Your survey responses and chat transcripts will be stored securely and anonymized.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent font-bold">•</span>
                  <span className="opacity-90" style={{fontSize: '1.15rem'}}><strong>Voluntary participation:</strong> You can withdraw from this study at any time.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent font-bold">•</span>
                  <span className="opacity-90" style={{fontSize: '1.15rem'}}><strong>Ethics approval:</strong> This study has been approved by Indiana University Bloomington&apos;s Institutional Review Board.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Start Button */}
  <div className="text-center mt-6">
          <button 
            onClick={handleStartChat}
            className="btn btn-primary text-xl px-12 py-5 shadow-md transition-transform duration-150 hover:scale-105 hover:shadow-lg"
            style={{ 
              fontSize: '1.35rem',
              color: 'var(--white)',
              fontWeight: 600,
              letterSpacing: '0.01em',
              borderRadius: '0.75rem',
              boxShadow: '0 2px 12px rgba(0,0,0,0.10)'
            }}
          >
            Start Participating
          </button>
          <p className="text-base text-muted mt-3" style={{opacity: 0.9, fontSize: '1.1rem'}}>
            Click above to begin the study
          </p>
        </div>

       
      </div>
    </div>
  );
}

