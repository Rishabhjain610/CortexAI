import React, { useState, useEffect } from 'react'
import api from '../utils/api.js'
import { signInWithPopup, googleProvider, auth } from "../utils/firebase.js";

import { useSelector, useDispatch } from 'react-redux';
import { setUserData } from '../redux/userSlice.js';
import { setArtifactOpen } from '../redux/conversationSlice.js';

// Screen components ko import kar rahe hain (Sidebar, Chat content zone, and Right artifact side-drawer).
import SideBar from '../components/SideBar.jsx';
import ChatArea from '../components/ChatArea.jsx';
import Artifact from '../components/Artifact.jsx';

const Home = () => {
  // Redux state se user login information aur artifact container status check kar rahe hain.
  const user = useSelector((state) => state.user.userData);
  const isArtifactOpen = useSelector((state) => state.conversation.isArtifactOpen);
  const dispatch = useDispatch();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Screen size check karke Sidebar aur Artifact panel ki default visibility responsive tarike se manage karne wala hook.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
        dispatch(setArtifactOpen(true));
      } else {
        setIsSidebarOpen(false);
        dispatch(setArtifactOpen(false));
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [dispatch]);

  // Google account pop-up ke zariye user login authentication trigger karne wala trigger.
  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      console.log("Firebase ID Token:", token);

      // Backend API gateway ko token verify karne ke liye request send kar rahe hain.
      const response = await api.post('/api/auth/login', { token });
      
      dispatch(setUserData(response.data.user));
      console.log("Login successful:", response.data.user);
    } catch (error) {
      console.error("Sign in failed:", error.response?.data || error.message);
    }
  }

  // Active session logout karne ka helper function.
  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout', {});
      dispatch(setUserData(null));
      console.log("Logged out successfully");
    } catch (error) {
      console.error("Logout failed:", error.response?.data || error.message);
    }
  }

  return (
    <div className="w-screen h-screen flex overflow-hidden bg-base-900">
      {user ? (
        <div className="flex flex-1 overflow-hidden relative">
          {/* Mobile screen list overlay layer */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 z-30 lg:hidden bg-black/60"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Left panel chat selector sidebar */}
          <SideBar
            user={user}
            onLogout={handleLogout}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />

          {/* Middle panel central messaging area */}
          <ChatArea
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isArtifactOpen={isArtifactOpen}
            onToggleArtifact={() => dispatch(setArtifactOpen(!isArtifactOpen))}
          />

          {/* Right side live workspace builder drawer */}
          <Artifact
            isOpen={isArtifactOpen}
            onClose={() => dispatch(setArtifactOpen(false))}
          />
        </div>
      ) : (
        /* Sign-in screen jab user authenticated na ho */
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-base-900 w-full h-full">
          <div className="p-8 rounded-2xl text-center w-full max-w-[360px] bg-base-850 border border-white/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.5)] flex flex-col items-center">
            {/* CortexAI Logo */}
            <div className="mb-5">
              <svg width="42" height="42" viewBox="0 0 36 36" fill="none">
                <rect width="36" height="36" rx="9" fill="#7c7ec8"/>
                <path d="M10 18c0-4.42 3.58-8 8-8 2.58 0 4.88 1.22 6.36 3.12L21.6 14.6A5.5 5.5 0 0 0 18 13a5 5 0 0 0 0 10 5.5 5.5 0 0 0 3.6-1.6l2.76 1.52A7.97 7.97 0 0 1 18 26c-4.42 0-8-3.58-8-8Z" fill="white"/>
              </svg>
            </div>

            <h1 className="font-sans font-semibold text-[22px] text-base-100 mb-2 tracking-tight">
              Welcome to CortexAI
            </h1>
            <p className="font-sans text-[13px] text-base-400 mb-6 leading-relaxed">
              Your private AI workspace. Sign in to continue.
            </p>

            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-[14px] font-medium font-sans bg-white text-[#111] hover:bg-gray-100 cursor-pointer transition-colors shadow-[0_2px_10px_rgba(0,0,0,0.15)]"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>

            <p className="mt-5 font-sans text-[11px] text-base-500">
              By continuing you agree to our Terms & Privacy Policy.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;