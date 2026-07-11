import React from 'react'
import api from '../utils/api.js'
import { signInWithPopup, googleProvider, auth } from "../utils/firebase.js";

import { useSelector, useDispatch } from 'react-redux';
import { setUserData } from '../redux/userSlice.js';

const Home = () => {
  const user = useSelector((state) => state.user.userData);
  const dispatch = useDispatch();

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      console.log("Firebase ID Token:", token);

      // Send the token to the backend API gateway
      const response = await api.post('/api/auth/login', { token });
      
      dispatch(setUserData(response.data.user));
      console.log("Login successful:", response.data.user);
    } catch (error) {
      console.error("Sign in failed:", error.response?.data || error.message);
    }
  }

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
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      {user ? (
        <div className="p-8 bg-gray-800 rounded-2xl shadow-xl border border-gray-700 max-w-md w-full text-center">
          <div className="relative inline-block mb-4">
            <img
              src={user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=cortex"}
              alt={user.name}
              className="w-24 h-24 rounded-full mx-auto border-4 border-indigo-500 shadow-md object-cover"
            />
            <span className="absolute bottom-0 right-2 px-2 py-0.5 text-xs bg-indigo-600 rounded-full font-semibold border-2 border-gray-800">
              {user.plan ? user.plan.toUpperCase() : 'FREE'}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">{user.name}</h1>
          <p className="text-indigo-400 text-sm font-medium mb-6">{user.email}</p>

          <div className="bg-gray-700/40 p-4 rounded-xl mb-6 text-left border border-gray-700/60">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Account details</h3>
            <div className="flex justify-between text-xs text-gray-400 py-1">
              <span>Firebase UID</span>
              <span className="font-mono text-gray-300">{user.firebaseUid.substring(0, 12)}...</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 py-1">
              <span>Created At</span>
              <span className="text-gray-300">{new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 bg-red-600/90 hover:bg-red-700 text-white font-medium rounded-xl transition duration-200 shadow-lg shadow-red-600/20 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="p-8 bg-gray-800 rounded-2xl shadow-xl border border-gray-700 text-center max-w-sm w-full">
          <h1 className="text-3xl font-extrabold mb-2 text-indigo-400 tracking-tight">CortexAI</h1>
          <p className="text-gray-400 mb-8 text-sm">Access your workspace and projects securely.</p>
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-xl transition duration-200 shadow-lg cursor-pointer border border-gray-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default Home