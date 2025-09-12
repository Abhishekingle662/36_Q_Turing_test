// Enable client-side functionality (required for onClick handlers and interactivity)
'use client';

// Import Next.js optimized Image component for better performance
import Image from "next/image";

// Main home page component - serves as the landing page for the research study
export default function Home() {
  return (
    // Main container: full height screen with gradient background and responsive padding
    <div className="min-h-screen gradient-bg py-12 px-4">
      {/* Content wrapper: centers content and limits max width for readability */}
      <div className="max-w-4xl mx-auto">
        
        {/* HERO SECTION: Main header with logo, title, and introduction */}
        <div className="text-center mb-12 animate-fade-in">
          {/* Main title with integrated IU logo */}
          <h1 className="text-hero text-shadow mb-6">
            {/* IU Logo - optimized Next.js Image component */}
            <Image 
              src="/Indiana_Hoosiers_logo.svg" 
              alt="Indiana University Logo" 
              width={40} 
              height={50}
              className="inline-block mr-3"
            />
            Welcome to Our Research Study
          </h1>
          {/* Welcome message - primary introduction text */}
          <p className="text-xl leading-relaxed max-w-3xl mx-auto text-shadow">
            Thank you for your interest in participating!
          </p>
          {/* Study description - explains the research purpose */}
          <p className="text-lg leading-relaxed max-w-3xl mx-auto text-shadow mt-4">
            This project is part of an academic research study exploring how people connect and build relationships through conversation.
          </p>
        </div>

        {/* STUDY PROCESS SECTION: Explains what participants will do */}
        <div className="max-w-2xl mx-auto mb-12">
          {/* Card container with primary styling and staggered animation */}
          <div className="card card-primary animate-slide-in" style={{animationDelay: '0.3s'}}>
            
            {/* Section header with icon and title */}
            <div className="flex items-center gap-3 mb-6">
              {/* Rocket icon in circular background */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor: 'var(--primary)'}}>
                <span className="text-white text-lg">🚀</span>
              </div>
              <h2 className="text-section text-emphasis">What Will You Do?</h2>
            </div>
            
            {/* List of study steps */}
            <ul className="space-y-4">
              {/* Step 1: Login and pairing */}
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{backgroundColor: 'var(--primary-light)'}}>
                  <span className="text-xs font-bold text-brand-primary">•</span>
                </div>
                <span className="text-secondary">You'll log in and be paired with another participant.</span>
              </li>
              {/* Step 2: Conversation */}
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{backgroundColor: 'var(--primary-light)'}}>
                  <span className="text-xs font-bold text-brand-primary">•</span>
                </div>
                <span className="text-secondary">Together, you'll have a conversation in a chat interface.</span>
              </li>
              {/* Step 3: Post-conversation survey */}
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{backgroundColor: 'var(--primary-light)'}}>
                  <span className="text-xs font-bold text-brand-primary">•</span>
                </div>
                <span className="text-secondary">After the conversation, you'll complete a short survey about your experience.</span>
              </li>
              {/* Step 4: Data storage explanation */}
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{backgroundColor: 'var(--primary-light)'}}>
                  <span className="text-xs font-bold text-brand-primary">•</span>
                </div>
                <span className="text-secondary">Your responses and chat transcript will be stored securely for research purposes.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* ETHICS & PRIVACY SECTION: Important information about participant rights */}
        <div className="card card-neutral animate-fade-in mb-12" style={{animationDelay: '0.5s'}}>
          
          {/* Section header with lock icon */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">🔒</span>
            <h2 className="text-section text-emphasis">Important Information</h2>
          </div>
          
          {/* Three-column grid layout for key information points */}
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Column 1: Data Privacy */}
            <div className="text-center">
              {/* Icon container with light background */}
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{backgroundColor: 'var(--primary-light)'}}>
                <span className="text-lg">🔐</span>
              </div>
              <h3 className="font-semibold mb-2 text-emphasis">Confidentiality</h3>
              <p className="text-sm text-muted">All responses and chat logs will be stored securely and anonymized.</p>
            </div>
            
            {/* Column 2: Voluntary Participation */}
            <div className="text-center">
              {/* Icon container with light background */}
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{backgroundColor: 'var(--primary-light)'}}>
                <span className="text-lg">🚪</span>
              </div>
              <h3 className="font-semibold mb-2 text-emphasis">Voluntary Participation</h3>
              <p className="text-sm text-muted">You can withdraw at any time without penalty.</p>
            </div>
            
            {/* Column 3: Ethics Approval */}
            <div className="text-center">
              {/* Icon container with light background */}
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{backgroundColor: 'var(--primary-light)'}}>
                <span className="text-lg">✓</span>
              </div>
              <h3 className="font-semibold mb-2 text-emphasis">Ethics Approval</h3>
              <p className="text-sm text-muted">This study has been reviewed under university IRB guidelines.</p>
            </div>
          </div>
        </div>

        {/* CALL TO ACTION SECTION: Final section to begin the study */}
        <div className="text-center card animate-fade-in" style={{animationDelay: '0.6s', background: 'linear-gradient(135deg, var(--primary-light), var(--light-neutral))'}}>
          
          {/* Action prompt text */}
          <div className="mb-8">
            <h2 className="text-lg text-gray-200 mb-6 text-emphasis">
              Ready to participate in our research study? Click below to enter the conversation interface.
            </h2>
          </div>
          
          {/* Start button container */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* Main CTA button - navigates to chat page when clicked */}
            <button 
              className="btn btn-primary group text-xl px-8 py-4"
              onClick={() => window.location.href = '/chat'} // Client-side navigation to chat page
            >
              {/* Chat emoji icon */}
              <span className="text-2xl mr-3">💬</span>
              Start Conversation
              {/* Animated arrow that moves on hover */}
              <span className="ml-3 transition-transform group-hover:translate-x-1">→</span>
            </button>
            
            {/* Moderator access button */}
            <button 
              className="btn btn-secondary group text-lg px-6 py-3"
              onClick={() => window.location.href = '/moderator'} // Navigate to moderator dashboard
            >
              <span className="text-xl mr-2">👥</span>
              Moderator Access
              <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>
      </div> {/* End content wrapper */}
    </div> 
  );
}

