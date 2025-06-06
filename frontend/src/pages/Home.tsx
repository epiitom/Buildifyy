import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button.tsx';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      navigate('/builder', { state: { prompt } });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header Section */}
      <header className="w-full px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold text-white">Buildify</span>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              className="text-white hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200"
            >
              Sign in
            </Button>
            <Button
              className="bg-white text-black hover:bg-gray-100 font-medium px-6 py-2 transition-all duration-200 hover:scale-105"
            >
              Get started
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Section */}
      <div className="flex-1 flex flex-col justify-center items-center p-4">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4">What's your next big idea?</h1>
          <p className="text-neutral-400 text-lg">Design websites by simply talking to AI</p>
        </div>

        <form onSubmit={handleSubmit} className="relative w-110 ">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-32 bg-neutral-900 text-white p-4 pr-12 rounded-2xl border border-neutral-700 focus:border-neutral-500 focus:outline-none resize-none placeholder-neutral-400 text-sm transition-all duration-200 hover:border-neutral-600"
            placeholder="Ask anything..."
            rows={3}
          />

          <button
            type="submit"
            className="absolute right-3 bottom-3 w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-neutral-200 transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="text-black"
            >
              <path
                d="M12 2L22 12L12 22L10.59 20.59L18.17 13H2V11H18.17L10.59 4.41L12 2Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}